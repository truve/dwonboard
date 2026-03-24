import json
import logging
import traceback
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.alert import Alert
from app.models.darkweb_item import DarkWebItem
from app.models.embedding import EmbeddingRecord
from app.models.organization import Organization
from app.models.profile import OrgProfile, ProfileEntry
from app.services.alert_generator import generate_alerts_for_org
from app.services.cyber_risk import generate_cyber_risk_summary
from app.services.darkweb_ingest import embed_darkweb_items
from app.services.profile_generator import generate_profile
from app.services.recorded_future import (
    DailyStats,
    _parse_references,
    get_rf_client,
    search_entity,
)

logger = logging.getLogger(__name__)


def _extract_domains_from_profile(org: Organization, db: Session) -> list[str]:
    """Extract domains from the org's profile entries and the org's own domain."""
    domains: set[str] = set()

    if org.domain:
        for d in org.domain.split(","):
            d = d.lower().strip()
            if d:
                domains.add(d)

    profile = db.query(OrgProfile).filter_by(org_id=org.id).first()
    if not profile:
        return list(domains)

    entries = db.query(ProfileEntry).filter_by(profile_id=profile.id).all()
    for entry in entries:
        value = entry.value.lower().strip()
        key = entry.key.lower()

        if any(kw in key for kw in ("domain", "website", "url", "web")):
            domain = _clean_domain(value)
            if domain:
                domains.add(domain)

        if entry.category == "assets" and "." in value:
            domain = _clean_domain(value)
            if domain:
                domains.add(domain)

    logger.info(f"Extracted domains for {org.name}: {domains}")
    return list(domains)


def _clean_domain(value: str) -> str | None:
    for prefix in ("https://", "http://", "www."):
        if value.startswith(prefix):
            value = value[len(prefix):]
    value = value.split("/")[0].strip()
    if "." in value and " " not in value and len(value) < 255:
        return value
    return None


async def _find_logo_url(domains: list[str]) -> str | None:
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for domain in domains:
            clearbit_url = f"https://logo.clearbit.com/{domain}"
            try:
                resp = await client.head(clearbit_url)
                if resp.status_code == 200:
                    logger.info(f"Found logo via Clearbit: {clearbit_url}")
                    return clearbit_url
            except Exception:
                pass

        for domain in domains:
            google_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128"
            try:
                resp = await client.head(google_url)
                if resp.status_code == 200:
                    logger.info(f"Found logo via Google favicon: {google_url}")
                    return google_url
            except Exception:
                pass

    return None


def _clear_previous_data(org_id: str, db: Session) -> None:
    db.query(Alert).filter_by(org_id=org_id).delete()
    profile = db.query(OrgProfile).filter_by(org_id=org_id).first()
    if profile:
        db.query(ProfileEntry).filter_by(profile_id=profile.id).delete()
        db.query(OrgProfile).filter_by(id=profile.id).delete()
    db.query(EmbeddingRecord).delete()
    # Only delete darkweb items not referenced by any remaining alerts
    referenced = db.query(Alert.darkweb_item_id).subquery()
    db.query(DarkWebItem).filter(DarkWebItem.id.notin_(referenced)).delete(synchronize_session="fetch")
    db.commit()
    logger.info(f"Cleared previous data for org {org_id}")


def get_entity_ids_for_org(org: Organization, db: Session) -> list[str]:
    """Resolve RF entity ID + domain entity IDs for an organization.

    Stored as JSON in org.ingestion_stats under key '_entity_ids' for reuse.
    """
    # Check if already resolved
    if org.ingestion_stats:
        try:
            data = json.loads(org.ingestion_stats)
            if isinstance(data, dict) and "_entity_ids" in data:
                return data["_entity_ids"]
        except (json.JSONDecodeError, TypeError):
            pass

    return []


async def run_onboarding_pipeline(org_id: str) -> None:
    """Phase 1: Logo + Profile generation. Stops at 'collecting' status.

    The frontend then drives per-day collection via collect_one_day(),
    and triggers analysis via run_analysis().
    """
    db: Session = SessionLocal()
    try:
        org = db.query(Organization).filter_by(id=org_id).first()
        if not org:
            logger.error(f"Organization {org_id} not found")
            return

        logger.info(f"Starting onboarding pipeline for {org.name}")

        _clear_previous_data(org_id, db)

        # Step 0: Find org logo
        if not org.logo_url:
            logo_domains = []
            if org.domain:
                logo_domains = [d.strip() for d in org.domain.split(",") if d.strip()]
            if not logo_domains:
                guess = org.name.lower().replace(" ", "") + ".com"
                logo_domains = [guess]
            org.logo_url = await _find_logo_url(logo_domains)
            db.commit()

        # Step 1: Generate profile
        org.status = "profiling"
        db.commit()

        await generate_profile(org, db)

        org.status = "profiled"
        db.commit()

        # Step 2: Extract domains and resolve RF entities
        domains = _extract_domains_from_profile(org, db)

        if not org.logo_url and domains:
            org.logo_url = await _find_logo_url(domains)
            db.commit()

        # Resolve RF entity
        entity_id = await search_entity(org.name)
        if not entity_id:
            raise ValueError(f"No Recorded Future entity found for '{org.name}'")

        entity_ids = [entity_id]
        for domain in domains:
            entity_ids.append(f"idn:{domain}")

        logger.info(f"RF entity IDs for {org.name}: {entity_ids}")

        # Store entity IDs and initialize stats for the collection phase
        org.ingestion_stats = json.dumps({
            "_entity_ids": entity_ids,
            "days": [],
        })
        org.status = "collecting"
        db.commit()

        logger.info(f"Profile complete for {org.name}, ready for collection")

    except Exception as e:
        logger.error(f"Onboarding failed for {org_id}: {e}\n{traceback.format_exc()}")
        try:
            org = db.query(Organization).filter_by(id=org_id).first()
            if org:
                org.status = "error"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


async def collect_one_day(
    org_id: str, days_back: int, db: Session
) -> dict:
    """Fetch one day of dark web + OSINT data from RF.

    Called by the frontend one day at a time. Returns the day's stats
    and a few sample items for display.
    """
    from dataclasses import asdict
    from app.services.darkweb_ingest import _extract_refs, _get_total_count

    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise ValueError(f"Organization {org_id} not found")

    # Parse stored state
    stats_data = json.loads(org.ingestion_stats or "{}")
    entity_ids = stats_data.get("_entity_ids", [])
    days_stats = stats_data.get("days", [])

    if not entity_ids:
        raise ValueError("No entity IDs resolved — run profiling first")

    client = get_rf_client()
    if not client:
        raise ValueError("RF_TOKEN not configured")

    today = datetime.now(timezone.utc).date()
    query_date = datetime(today.year, today.month, today.day, tzinfo=timezone.utc) - timedelta(days=days_back)
    date_str = str(query_date.date())

    existing_titles: set[str] = {
        row.title for row in db.query(DarkWebItem.title).all() if row.title
    }

    dw_total = 0
    dw_fetched = 0
    cr_total = 0
    cr_fetched = 0
    sample_items: list[dict] = []

    # --- Dark web search ---
    try:
        dw_result = client.get_dark_web_references_for_day(entity_ids, date=query_date, limit=50)
        dw_refs = _extract_refs(dw_result)
        dw_total = _get_total_count(dw_result, dw_refs)
        parsed = _parse_references(dw_refs)
        for rf_item in parsed:
            if rf_item["title"] in existing_titles:
                continue
            item = DarkWebItem(
                source=rf_item["source"],
                title=rf_item["title"],
                content=rf_item["content"],
                author=rf_item.get("author"),
                posted_at=rf_item["posted_at"],
                item_type=rf_item["item_type"],
                tags=json.dumps(rf_item.get("tags", [])),
            )
            db.add(item)
            existing_titles.add(rf_item["title"])
            dw_fetched += 1
            if len(sample_items) < 3:
                sample_items.append({
                    "title": rf_item["title"],
                    "source": rf_item["source"],
                    "item_type": rf_item["item_type"],
                    "snippet": (rf_item["content"] or "")[:200],
                })
    except Exception as e:
        logger.error(f"Dark web fetch failed for {date_str}: {e}")

    # --- Cyber risk search ---
    try:
        cr_result = client.get_cyber_risk_references_for_day(entity_ids, date=query_date, limit=50)
        cr_refs = _extract_refs(cr_result)
        cr_total = _get_total_count(cr_result, cr_refs)
        parsed = _parse_references(cr_refs)
        for rf_item in parsed:
            if rf_item["title"] in existing_titles:
                continue
            item = DarkWebItem(
                source=rf_item["source"],
                title=rf_item["title"],
                content=rf_item["content"],
                author=rf_item.get("author"),
                posted_at=rf_item["posted_at"],
                item_type=rf_item["item_type"],
                tags=json.dumps(rf_item.get("tags", [])),
            )
            db.add(item)
            existing_titles.add(rf_item["title"])
            cr_fetched += 1
            if len(sample_items) < 3:
                sample_items.append({
                    "title": rf_item["title"],
                    "source": rf_item["source"],
                    "item_type": rf_item["item_type"],
                    "snippet": (rf_item["content"] or "")[:200],
                })
    except Exception as e:
        logger.error(f"Cyber risk fetch failed for {date_str}: {e}")

    # Update stats
    day_stat = asdict(DailyStats(
        date=date_str,
        darkweb_total=dw_total,
        darkweb_fetched=dw_fetched,
        cyber_risk_total=cr_total,
        cyber_risk_fetched=cr_fetched,
    ))
    days_stats.append(day_stat)
    stats_data["days"] = days_stats
    org.ingestion_stats = json.dumps(stats_data)
    db.commit()

    logger.info(f"Day {date_str}: dark_web={dw_fetched}/{dw_total}, osint={cr_fetched}/{cr_total}")

    return {
        "date": date_str,
        "darkweb_total": dw_total,
        "darkweb_fetched": dw_fetched,
        "cyber_risk_total": cr_total,
        "cyber_risk_fetched": cr_fetched,
        "samples": sample_items,
    }


async def run_analysis(org_id: str) -> None:
    """Phase 3: Embed items, generate alerts, and produce risk assessment.

    Called after all days have been collected.
    """
    db: Session = SessionLocal()
    try:
        org = db.query(Organization).filter_by(id=org_id).first()
        if not org:
            logger.error(f"Organization {org_id} not found")
            return

        org.status = "analyzing"
        db.commit()

        await embed_darkweb_items(db)
        alerts = await generate_alerts_for_org(org_id, db)

        risk_summary = await generate_cyber_risk_summary(org_id, db)
        org.cyber_risk_summary = risk_summary

        org.status = "onboarded"
        org.updated_at = datetime.now(timezone.utc)
        db.commit()

        logger.info(f"Analysis complete for {org.name}: {len(alerts)} alerts")

    except Exception as e:
        logger.error(f"Analysis failed for {org_id}: {e}\n{traceback.format_exc()}")
        try:
            org = db.query(Organization).filter_by(id=org_id).first()
            if org:
                org.status = "error"
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
