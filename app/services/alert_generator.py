import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.alert import Alert
from app.models.darkweb_item import DarkWebItem
from app.models.organization import Organization
from app.models.profile import OrgProfile, ProfileEntry
from app.services.openai_client import chat_completion
from app.services.vector_search import embed_texts, find_similar

logger = logging.getLogger(__name__)

CLASSIFICATION_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "alert_classification",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "relevant": {"type": "boolean"},
                "title": {"type": "string"},
                "description": {"type": "string"},
                "severity": {
                    "type": "string",
                    "enum": ["critical", "high", "medium", "low", "info"],
                },
                "relevance": {
                    "type": "string",
                    "enum": ["direct_match", "likely_match", "ambiguous"],
                },
                "classification": {
                    "type": "string",
                    "enum": [
                        "credentials_dump",
                        "access_sale",
                        "data_leak",
                        "vulnerability",
                        "ransomware_listing",
                        "other",
                    ],
                },
                "reasoning": {"type": "string"},
            },
            "required": [
                "relevant",
                "title",
                "description",
                "severity",
                "relevance",
                "classification",
                "reasoning",
            ],
            "additionalProperties": False,
        },
    },
}

CLASSIFICATION_SYSTEM_PROMPT = """You are a dark web threat intelligence analyst. You are given:
1. A dark web post/listing
2. An organization's profile with specific facts
3. Profile entries that are most similar to this post (by embedding similarity)

Your job: determine if this dark web post represents a threat to this specific organization.

Classify the threat and assess relevance:

Relevance levels:
- "direct_match": The post specifically mentions the organization by name, domain, executive name, \
or other unique identifiers
- "likely_match": The post describes characteristics (industry, size, geography, technology) that \
strongly match the organization profile, even without naming it directly
- "ambiguous": The post could potentially be about this organization but also many others

Severity levels:
- "critical": Active data breach, credential dump, or ransomware attack
- "high": Access being sold, specific targeting discussed
- "medium": Mention in threat context, vulnerability relevant to their stack
- "low": General industry threat, tangential relevance
- "info": Background intelligence, no immediate threat

If the post is clearly irrelevant (similarity was a false positive), set relevant=false. \
Otherwise set relevant=true and provide your full classification.

IMPORTANT: When the threat involves a specific domain, URL, IP address, or phishing site, \
you MUST include the exact domain/URL/IP in both the title and description fields. \
For example: "Phishing site targeting swedbank.lv-ssl.cfd" not just "Phishing site detected". \
Always surface the specific IOCs (indicators of compromise) so the analyst can take action.

Respond in the provided JSON schema."""


from collections.abc import Callable, Awaitable

OnAlertCallback = Callable[[Alert, int, int], Awaitable[None]] | None


async def generate_alerts_for_org(
    org_id: str, db: Session, on_alert: OnAlertCallback = None
) -> list[Alert]:
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise ValueError(f"Organization {org_id} not found")

    profile = db.query(OrgProfile).filter_by(org_id=org_id).first()
    if not profile:
        raise ValueError(f"No profile found for org {org_id}")

    entries = db.query(ProfileEntry).filter_by(profile_id=profile.id).all()
    entry_map = {e.id: e for e in entries}

    cutoff = datetime.now(timezone.utc) - timedelta(days=settings.DARKWEB_LOOKBACK_DAYS)
    darkweb_items = db.query(DarkWebItem).filter(DarkWebItem.posted_at >= cutoff).all()

    if not darkweb_items:
        logger.info("No dark web items in lookback window")
        return []

    logger.info(
        f"Scanning {len(darkweb_items)} dark web items against {org.name}'s profile"
    )

    # For each dark web item, find similar profile entries
    candidates: list[tuple[DarkWebItem, list[tuple[str, float]]]] = []
    for item in darkweb_items:
        item_text = f"{item.title or ''}\n\n{item.content}"
        item_vectors = await embed_texts([item_text])
        if not item_vectors:
            continue

        similar = find_similar(
            db,
            query_embedding=item_vectors[0],
            source_type="profile_entry",
            top_k=5,
            threshold=settings.SIMILARITY_THRESHOLD,
        )
        if similar:
            candidates.append((item, similar))

    logger.info(f"{len(candidates)} items passed vector similarity threshold")

    total_candidates = len(candidates)
    alerts: list[Alert] = []

    # Process one at a time so we can commit + report progress incrementally
    for i, (item, matches) in enumerate(candidates):
        try:
            alert = await _classify_item(item, org, profile, entries, matches, entry_map, db)
            if alert is not None:
                alerts.append(alert)
                db.commit()
                if on_alert:
                    await on_alert(alert, i + 1, total_candidates)
        except Exception as e:
            logger.error(f"Classification failed: {e}")

    alerts.sort(key=lambda a: a.relevance_score, reverse=True)
    logger.info(f"Generated {len(alerts)} alerts for {org.name}")
    return alerts


async def _classify_item(
    item: DarkWebItem,
    org: Organization,
    profile: OrgProfile,
    entries: list[ProfileEntry],
    matches: list[tuple[str, float]],
    entry_map: dict[str, ProfileEntry],
    db: Session,
) -> Alert | None:
    matched_entries = []
    for entry_id, score in matches:
        entry = entry_map.get(entry_id)
        if entry:
            matched_entries.append(
                f"- [{entry.category}] {entry.key}: {entry.value} (similarity: {score:.2f})"
            )

    max_score = max(score for _, score in matches)

    user_msg = f"""Dark web post:
Source: {item.source}
Type: {item.item_type}
Author: {item.author or 'unknown'}
Title: {item.title or 'N/A'}
Content: {item.content}

---

Organization: {org.name}
Domain: {org.domain or 'unknown'}
Industry: {org.industry or 'unknown'}

Profile summary: {profile.summary}

Most similar profile entries:
{chr(10).join(matched_entries)}
"""

    response_text = await chat_completion(
        messages=[
            {"role": "system", "content": CLASSIFICATION_SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        model=settings.OPENAI_CLASSIFICATION_MODEL,
        response_format=CLASSIFICATION_SCHEMA,
        temperature=0.1,
        max_tokens=1024,
    )

    result = json.loads(response_text)

    if not result.get("relevant", False):
        return None

    matched_ids = [entry_id for entry_id, _ in matches]

    alert = Alert(
        org_id=org.id,
        darkweb_item_id=item.id,
        title=result["title"],
        description=result["description"],
        severity=result["severity"],
        relevance=result["relevance"],
        relevance_score=max_score,
        matched_profile_entries=json.dumps(matched_ids),
        classification=result["classification"],
        ai_reasoning=result["reasoning"],
    )
    db.add(alert)
    return alert
