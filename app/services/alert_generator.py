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
                "relevance_score": {
                    "type": "number",
                    "description": "0.0 to 1.0 indicating how relevant this is to the organization",
                },
                "iocs": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {
                                "type": "string",
                                "enum": ["domain", "ip", "url"],
                            },
                            "value": {"type": "string"},
                        },
                        "required": ["type", "value"],
                        "additionalProperties": False,
                    },
                },
            },
            "required": [
                "relevant",
                "title",
                "description",
                "severity",
                "relevance",
                "classification",
                "reasoning",
                "relevance_score",
                "iocs",
            ],
            "additionalProperties": False,
        },
    },
}

CLASSIFICATION_SYSTEM_PROMPT = """You are a dark web threat intelligence analyst. You are given:
1. A dark web post/listing
2. An organization's profile with specific facts

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

If the post is clearly irrelevant, set relevant=false.
Otherwise set relevant=true and provide your full classification.

Set relevance_score to a number between 0.0 and 1.0 indicating how relevant this post is \
to the specific organization (1.0 = directly about them, 0.0 = completely unrelated).

IMPORTANT: When the threat involves a specific domain, URL, IP address, or phishing site, \
you MUST include the exact domain/URL/IP in both the title and description fields. \
For example: "Phishing site targeting swedbank.lv-ssl.cfd" not just "Phishing site detected". \
Always surface the specific IOCs (indicators of compromise) so the analyst can take action.

Extract ALL domains, IP addresses, and URLs mentioned in the post into the "iocs" array. \
Each IOC should have a "type" (domain, ip, or url) and the exact "value". \
If no IOCs are found, return an empty array.

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

    darkweb_items = db.query(DarkWebItem).filter_by(session_id=org.session_id).all()

    if not darkweb_items:
        logger.info("No dark web items in lookback window")
        return []

    # Build profile summary for the LLM
    profile_text = _build_profile_text(org, profile, entries)

    logger.info(
        f"Classifying {len(darkweb_items)} dark web items against {org.name}'s profile"
    )

    total = len(darkweb_items)
    alerts: list[Alert] = []

    for i, item in enumerate(darkweb_items):
        try:
            alert = await _classify_item(item, org, profile_text, db)
            if alert is not None:
                alerts.append(alert)
                db.commit()
                if on_alert:
                    await on_alert(alert, i + 1, total)
        except Exception as e:
            logger.error(f"Classification failed for item {item.id}: {e}")

    alerts.sort(key=lambda a: a.relevance_score, reverse=True)
    logger.info(f"Generated {len(alerts)} alerts for {org.name}")
    return alerts


def _build_profile_text(
    org: Organization, profile: OrgProfile, entries: list[ProfileEntry]
) -> str:
    """Build a concise profile summary for the LLM prompt."""
    lines = [
        f"Organization: {org.name}",
        f"Domain: {org.domain or 'unknown'}",
        f"Industry: {org.industry or 'unknown'}",
        "",
        f"Summary: {profile.summary}",
        "",
        "Key facts:",
    ]
    for entry in entries:
        lines.append(f"- [{entry.category}] {entry.key}: {entry.value}")
    return "\n".join(lines)


async def _classify_item(
    item: DarkWebItem,
    org: Organization,
    profile_text: str,
    db: Session,
) -> Alert | None:
    user_msg = f"""Dark web post:
Source: {item.source}
Type: {item.item_type}
Author: {item.author or 'unknown'}
Title: {item.title or 'N/A'}
Content: {item.content}

---

{profile_text}
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

    # Enrich IOCs with RF risk scores
    iocs = result.get("iocs", [])
    ioc_enrichments = None
    if iocs:
        logger.info(f"Enriching {len(iocs)} IOCs: {[i.get('value') for i in iocs]}")
        from app.services.recorded_future import get_rf_client
        rf_client = get_rf_client()
        if rf_client:
            try:
                enriched = rf_client.get_ioc_risk_scores(iocs)
                if enriched:
                    ioc_enrichments = json.dumps(enriched)
                    logger.info(f"IOC enrichment complete: {len(enriched)} results")
            except Exception as e:
                logger.warning(f"IOC enrichment failed: {e}")
    else:
        logger.info("No IOCs extracted from this alert")

    alert = Alert(
        org_id=org.id,
        session_id=org.session_id,
        darkweb_item_id=item.id,
        title=result["title"],
        description=result["description"],
        severity=result["severity"],
        relevance=result["relevance"],
        relevance_score=result.get("relevance_score", 0.5),
        matched_profile_entries=None,
        classification=result["classification"],
        ai_reasoning=result["reasoning"],
        ioc_enrichments=ioc_enrichments,
    )
    db.add(alert)
    return alert
