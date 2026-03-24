import json
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.organization import Organization
from app.models.profile import OrgProfile, ProfileEntry
from app.services.openai_client import chat_completion
from app.services.vector_search import embed_texts, store_embeddings

logger = logging.getLogger(__name__)

PROFILE_CATEGORIES = [
    "business_operations",
    "environment",
    "vips",
    "brands",
    "technology_stack",
    "employee_info",
    "assets",
    "geography",
]

PROFILE_SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "organization_profile",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "categories": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "category": {
                                "type": "string",
                                "enum": PROFILE_CATEGORIES,
                            },
                            "facts": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "key": {"type": "string"},
                                        "value": {"type": "string"},
                                        "citation_url": {"type": "string"},
                                        "citation_snippet": {"type": "string"},
                                    },
                                    "required": [
                                        "key",
                                        "value",
                                        "citation_url",
                                        "citation_snippet",
                                    ],
                                    "additionalProperties": False,
                                },
                            },
                        },
                        "required": ["category", "facts"],
                        "additionalProperties": False,
                    },
                }
            },
            "required": ["categories"],
            "additionalProperties": False,
        },
    },
}

SYSTEM_PROMPT = """You are an expert OSINT (Open Source Intelligence) analyst specializing in \
corporate intelligence. Given an organization name and optional domain/industry, \
build a comprehensive profile using only publicly available information.

You MUST produce a JSON object matching the provided schema exactly.

For EVERY fact you include, provide a citation with:
- citation_url: The most likely public source URL (company website, LinkedIn, SEC filings, \
news articles, Wikipedia, Crunchbase, etc.)
- citation_snippet: A brief quote or description of what the source says

Cover these categories thoroughly:
1. business_operations: What the company does, revenue, business lines, market position
2. environment: Regulatory environment, competitors, market conditions
3. vips: C-suite executives, board members, other public-facing leaders
4. brands: Product brands, subsidiaries, trade names
5. technology_stack: Known technologies (from job postings, tech blogs, vendor pages)
6. employee_info: Approximate headcount, key office locations, hiring patterns
7. assets: Known digital assets (domains, IP ranges if public), physical assets, AUM
8. geography: Headquarters, regional offices, operating countries

If you are uncertain about a fact, include it but note the uncertainty in the citation snippet. \
Prefer well-known, verifiable facts over speculation. Include at least 3 facts per category."""

SUMMARY_SYSTEM_PROMPT = """You are a concise business analyst. Given a structured organization \
profile in JSON, write a 3-5 sentence executive summary that captures the most important \
characteristics of the organization. Focus on what would be relevant for threat intelligence: \
size, industry, geography, key assets, and public exposure."""


async def generate_profile(org: Organization, db: Session) -> OrgProfile:
    logger.info(f"Generating profile for {org.name} (id={org.id})")

    user_msg = (
        f"Build a comprehensive profile for: {org.name}\n"
        f"Domain: {org.domain or 'unknown'}\n"
        f"Industry: {org.industry or 'unknown'}"
    )

    raw_json = await chat_completion(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_msg},
        ],
        response_format=PROFILE_SCHEMA,
        temperature=0.2,
        max_tokens=16384,
    )

    profile_data = json.loads(raw_json)

    summary = await chat_completion(
        messages=[
            {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
            {"role": "user", "content": raw_json},
        ],
        temperature=0.3,
        max_tokens=512,
    )

    profile = OrgProfile(
        org_id=org.id,
        summary=summary,
        raw_json=raw_json,
        generated_at=datetime.now(timezone.utc),
    )
    db.add(profile)
    db.flush()

    entries: list[ProfileEntry] = []
    for cat in profile_data.get("categories", []):
        for fact in cat.get("facts", []):
            entry = ProfileEntry(
                profile_id=profile.id,
                category=cat["category"],
                key=fact["key"],
                value=fact["value"],
                citation_url=fact.get("citation_url"),
                citation_text=fact.get("citation_snippet"),
            )
            db.add(entry)
            entries.append(entry)

    db.flush()

    # Embed all profile entries for vector search
    texts = [f"{e.category}: {e.key} = {e.value}" for e in entries]
    if texts:
        vectors = await embed_texts(texts)
        store_embeddings(
            db,
            source_type="profile_entry",
            items=[
                (entries[i].id, texts[i], vectors[i]) for i in range(len(entries))
            ],
        )

    db.commit()
    logger.info(
        f"Profile generated for {org.name}: {len(entries)} entries across "
        f"{len(profile_data.get('categories', []))} categories"
    )
    return profile
