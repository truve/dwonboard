import json
import logging
from dataclasses import asdict
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models.darkweb_item import DarkWebItem
from app.models.organization import Organization
from app.services.vector_search import embed_texts, store_embeddings

logger = logging.getLogger(__name__)


def _extract_refs(result: dict) -> list[dict]:
    """Extract references/instances from an RF API response."""
    return (
        result.get("references")
        or result.get("instances")
        or result.get("items")
        or []
    )


def _get_total_count(result: dict, refs: list) -> int:
    """Get total count from RF response metadata."""
    count = result.get("count", {})
    if isinstance(count, dict):
        # Could be nested: {"references": {"total": N}} or {"total": N}
        for v in count.values():
            if isinstance(v, dict) and "total" in v:
                return v["total"]
        return count.get("total", len(refs))
    return len(refs)


def _dedup_and_persist(
    items: list[dict],
    source_label: str,
    existing_titles: set[str],
    db: Session,
) -> list[DarkWebItem]:
    """Deduplicate parsed items and persist new ones to the DB."""
    from app.services.recorded_future import _parse_references

    parsed = _parse_references(items)
    new_items: list[DarkWebItem] = []

    for rf_item in parsed:
        title = rf_item["title"]
        if title in existing_titles:
            continue

        item = DarkWebItem(
            source=rf_item["source"],
            title=title,
            content=rf_item["content"],
            author=rf_item.get("author"),
            posted_at=rf_item["posted_at"],
            item_type=rf_item["item_type"],
            tags=json.dumps(rf_item.get("tags", [])),
        )
        db.add(item)
        new_items.append(item)
        existing_titles.add(title)

    return new_items


async def ingest_rf_data(
    org_id: str, org_name: str, domains: list[str], db: Session
) -> list[DarkWebItem]:
    """Fetch dark web + cyber risk data from Recorded Future day by day.

    Two searches per day:
    1. Dark web search: OYHH7k media type filter, no event type restriction
    2. Cyber risk search: No media type filter, cyber event type restriction

    Searches for the org entity ID plus domain entity IDs (idn:xxx.com).

    After each day, items are persisted and org.ingestion_stats is updated
    so the frontend can show progress incrementally.

    Returns all newly ingested items.
    """
    from app.services.recorded_future import (
        DailyStats,
        get_rf_client,
        search_entity,
    )

    # Step 1: Resolve org entity
    logger.info(f"Resolving RF entity for '{org_name}'...")
    entity_id = await search_entity(org_name)
    if not entity_id:
        logger.error(f"Could not resolve RF entity for '{org_name}'")
        raise ValueError(f"No Recorded Future entity found for '{org_name}'")
    logger.info(f"Resolved RF entity: {entity_id}")

    # Build list of all entity IDs to search: org + domains
    entity_ids = [entity_id]
    for domain in domains:
        domain_id = f"idn:{domain}"
        entity_ids.append(domain_id)
    logger.info(f"Searching RF with entity IDs: {entity_ids}")

    client = get_rf_client()
    if not client:
        raise ValueError("RF_TOKEN not configured")

    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise ValueError(f"Organization {org_id} not found")

    existing_titles: set[str] = {
        row.title for row in db.query(DarkWebItem.title).all() if row.title
    }

    all_new_items: list[DarkWebItem] = []
    daily_stats: list[dict] = []
    today = datetime.now(timezone.utc).date()
    lookback_days = settings.DARKWEB_LOOKBACK_DAYS

    # Step 2: Fetch day by day, newest first
    for days_back in range(lookback_days + 1):
        query_date = datetime(
            today.year, today.month, today.day, tzinfo=timezone.utc
        ) - timedelta(days=days_back)
        date_str = str(query_date.date())

        dw_total = 0
        dw_fetched = 0
        cr_total = 0
        cr_fetched = 0

        # --- Dark web search (all content from dark web sources) ---
        try:
            dw_result = client.get_dark_web_references_for_day(
                entity_ids, date=query_date, limit=50
            )
            dw_refs = _extract_refs(dw_result)
            dw_total = _get_total_count(dw_result, dw_refs)
            dw_new = _dedup_and_persist(dw_refs, "darkweb", existing_titles, db)
            dw_fetched = len(dw_new)
            all_new_items.extend(dw_new)
        except Exception as e:
            logger.error(f"Dark web fetch failed for {date_str}: {e}")

        # --- Cyber risk search (all sources, cyber event types) ---
        try:
            cr_result = client.get_cyber_risk_references_for_day(
                entity_ids, date=query_date, limit=50
            )
            cr_refs = _extract_refs(cr_result)
            cr_total = _get_total_count(cr_result, cr_refs)
            cr_new = _dedup_and_persist(cr_refs, "cyber_risk", existing_titles, db)
            cr_fetched = len(cr_new)
            all_new_items.extend(cr_new)
        except Exception as e:
            logger.error(f"Cyber risk fetch failed for {date_str}: {e}")

        # Record stats and commit
        daily_stats.append(asdict(DailyStats(
            date=date_str,
            darkweb_total=dw_total,
            darkweb_fetched=dw_fetched,
            cyber_risk_total=cr_total,
            cyber_risk_fetched=cr_fetched,
        )))
        _update_org_stats(org, daily_stats, db)

        logger.info(
            f"Day {date_str}: "
            f"dark_web={dw_fetched}/{dw_total}, "
            f"cyber_risk={cr_fetched}/{cr_total}"
        )

    logger.info(
        f"RF ingestion complete for {org_name}: "
        f"{len(all_new_items)} new items over {lookback_days + 1} days"
    )
    return all_new_items


def _update_org_stats(
    org: Organization, daily_stats: list[dict], db: Session
) -> None:
    """Persist current daily_stats to the org and commit."""
    org.ingestion_stats = json.dumps(daily_stats)
    db.commit()


async def embed_darkweb_items(db: Session) -> int:
    """Compute and store embeddings for all dark web items that lack them."""
    items = db.query(DarkWebItem).all()
    if not items:
        return 0

    from app.models.embedding import EmbeddingRecord

    existing_ids = {
        r.source_id
        for r in db.query(EmbeddingRecord.source_id)
        .filter_by(source_type="darkweb_item")
        .all()
    }

    to_embed = [item for item in items if item.id not in existing_ids]
    if not to_embed:
        logger.info("All dark web items already embedded")
        return 0

    texts = [f"{item.title or ''}\n\n{item.content}" for item in to_embed]
    vectors = await embed_texts(texts)

    store_embeddings(
        db,
        source_type="darkweb_item",
        items=[
            (to_embed[i].id, texts[i], vectors[i]) for i in range(len(to_embed))
        ],
    )

    logger.info(f"Embedded {len(to_embed)} dark web items")
    return len(to_embed)
