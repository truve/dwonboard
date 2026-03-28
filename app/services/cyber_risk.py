"""Generate an open-source cyber risk assessment from ingested OSINT data."""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.darkweb_item import DarkWebItem
from app.models.organization import Organization
from app.models.profile import OrgProfile
from app.services.openai_client import chat_completion

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """\
You are a senior cyber threat intelligence analyst. You are given:
1. An organization's profile summary
2. A collection of OSINT references (dark web posts, cyber events, vulnerability reports) \
that mention or relate to the organization over the past 14 days.

Produce a structured open-source cyber risk assessment. Use this format:

## Risk Rating
Give an overall risk rating: CRITICAL, HIGH, MEDIUM, or LOW with a one-sentence justification.

## Key Findings
Bullet points of the most significant findings from the data. Be specific — \
reference actual content from the references where possible.

## Threat Landscape
A paragraph describing the current threat landscape for this organization based \
on the data: what types of threats are active, what actors or campaigns are relevant, \
and what attack surfaces are exposed.

## Recommendations
3-5 actionable recommendations based on the findings.

Be concise, factual, and base your assessment only on the provided data. \
Do not speculate beyond what the evidence supports."""


async def generate_cyber_risk_summary(org_id: str, db: Session) -> str:
    """Generate a cyber risk assessment from the org profile + ingested references."""
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise ValueError(f"Organization {org_id} not found")

    profile = db.query(OrgProfile).filter_by(org_id=org_id).first()
    profile_summary = profile.summary if profile else f"Organization: {org.name}"

    # Get dark web / OSINT items for this session
    items = (
        db.query(DarkWebItem)
        .filter_by(session_id=org.session_id)
        .order_by(DarkWebItem.posted_at.desc())
        .limit(100)
        .all()
    )

    if not items:
        return "No OSINT references found in the last 14 days. Insufficient data for risk assessment."

    # Build references summary for the LLM
    refs_text = []
    for i, item in enumerate(items, 1):
        refs_text.append(
            f"[{i}] Source: {item.source} | Type: {item.item_type} | "
            f"Date: {item.posted_at.strftime('%Y-%m-%d')}\n"
            f"Title: {item.title or 'N/A'}\n"
            f"Content: {item.content[:500]}"
        )

    user_msg = (
        f"Organization Profile:\n{profile_summary}\n\n"
        f"---\n\n"
        f"OSINT References ({len(items)} items from the last 14 days):\n\n"
        + "\n\n".join(refs_text)
    )

    logger.info(f"Generating cyber risk assessment for {org.name} ({len(items)} references)")

    summary = await chat_completion(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.3,
        max_tokens=2048,
    )

    return summary
