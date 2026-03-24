"""Recorded Future API client for dark web intelligence.

Uses the rfapi SDK (same pattern as the newsaround project) for query operations,
and direct HTTP for entity search.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import httpx
from rfapi import RawApiClient

from app.config import settings

logger = logging.getLogger(__name__)

# Map RF event types to our internal item_type
RF_TYPE_MAP = {
    "CredentialLeak": "credentials_dump",
    "CardDump": "credentials_dump",
    "CyberAttack": "access_sale",
    "CyberExploit": "vulnerability",
    "DisclosedVulnerability": "vulnerability",
    "WebReportedVulnerability": "vulnerability",
    "UpdatedVulnerability": "vulnerability",
    "MalwareAnalysis": "other",
    "ServiceDisruption": "other",
    "DDoSTrafficAnalysis": "other",
    "NetworkTrafficAnalysis": "other",
    "SnortRule": "other",
    "WhoisUpdate": "other",
    "WebsiteScan": "other",
    "InfrastructureAnalysis": "other",
    "TTPAnalysis": "other",
}

# Dark web media type entity ID (from dw.json template)
DARK_WEB_MEDIA_TYPE_ID = "OYHH7k"


class RecordedFutureClient:
    """Client for Recorded Future dark web intelligence queries."""

    def __init__(self, api_token: str, timeout: tuple = (30, 600)):
        self.api_token = api_token
        self.logger = logging.getLogger(__name__)
        self.api = RawApiClient(auth=self.api_token, timeout=timeout)

    def _make_query(self, query: dict) -> dict:
        """Execute a query via the RF API SDK."""
        try:
            self.logger.info(f"RF query: {json.dumps(query, default=str)}")
            response = self.api.query(query)
            result = response.result
            self.logger.info(f"RF response keys: {list(result.keys()) if isinstance(result, dict) else type(result)}")
            if isinstance(result, dict):
                count = result.get("count", {})
                self.logger.info(f"RF count: {count}")
                for key in ("references", "instances", "items"):
                    if key in result and result[key]:
                        self.logger.info(f"RF {key}: {len(result[key])} entries")
            return result
        except Exception as e:
            self.logger.error(f"RF API query failed: {e}")
            raise

    def test_connection(self) -> bool:
        """Test if the RF API connection works."""
        try:
            result = self._make_query({"source": {"limit": 1}})
            return bool(result)
        except Exception:
            return False

    def get_dark_web_references_for_day(
        self, entity_ids: list[str], date: datetime, limit: int = 200
    ) -> dict:
        """Fetch ALL dark web content for entities for a single day.

        Uses the OYHH7k media type filter (dark web sources) with no
        event type restriction. Searches for org entity + domain entities.
        """
        day_str = date.strftime("%Y-%m-%d")
        next_day_str = (date + timedelta(days=1)).strftime("%Y-%m-%d")
        query = {
            "reference": {
                "document": {
                    "published": {
                        "min": day_str,
                        "max": next_day_str,
                    }
                },
                "attributes": [
                    {
                        "entity": {"id": [DARK_WEB_MEDIA_TYPE_ID]},
                        "name": [["Event.document", "Source.media_type"]],
                    },
                    {"entity": {"id": entity_ids}},
                ],
                "limit": limit,
            },
        }

        self.logger.info(
            f"Querying RF dark web: entities={entity_ids}, date={day_str}"
        )
        return self._make_query(query)

    def get_cyber_risk_references_for_day(
        self, entity_ids: list[str], date: datetime, limit: int = 200
    ) -> dict:
        """Fetch cyber risk references for entities for a single day.

        No media type restriction — searches all sources, but filtered
        to cyber-relevant event types. Searches for org entity + domain entities.
        """
        day_str = date.strftime("%Y-%m-%d")
        next_day_str = (date + timedelta(days=1)).strftime("%Y-%m-%d")
        query = {
            "reference": {
                "type": list(RF_TYPE_MAP.keys()),
                "document": {
                    "published": {
                        "min": day_str,
                        "max": next_day_str,
                    }
                },
                "attributes": [
                    {"entity": {"id": entity_ids}},
                ],
                "limit": limit,
            },
        }

        self.logger.info(
            f"Querying RF cyber risk: entities={entity_ids}, date={day_str}"
        )
        return self._make_query(query)

    def search_entity_by_name(self, name: str, entity_type: str = "Company") -> dict:
        """Search for entities by freetext name."""
        query = {
            "entity": {
                "type": entity_type,
                "freetext": name,
                "limit": 10,
            }
        }
        return self._make_query(query)


# Module-level singleton
_client: RecordedFutureClient | None = None


def get_rf_client() -> RecordedFutureClient | None:
    """Get the RF client singleton. Returns None if no token configured."""
    global _client
    if not settings.RF_TOKEN:
        return None
    if _client is None:
        _client = RecordedFutureClient(api_token=settings.RF_TOKEN)
    return _client


async def search_entity(org_name: str) -> str | None:
    """Search RF for a Company entity ID matching the organization name.

    Uses the rfapi SDK entity query for freetext search.
    Falls back to direct HTTP if the SDK doesn't support entity search well.
    """
    client = get_rf_client()
    if not client:
        logger.warning("RF_TOKEN not set, skipping entity search")
        return None

    try:
        # Try SDK-based entity search first
        result = client.search_entity_by_name(org_name, "Company")
        entities = result.get("entities", [])
        entity_details = result.get("entity_details", {})

        if entities:
            entity_id = entities[0] if isinstance(entities[0], str) else entities[0].get("id")
            detail = entity_details.get(entity_id, {})
            entity_name = detail.get("name", entity_id)
            logger.info(f"Found RF entity via SDK: {entity_name} (id={entity_id})")
            return entity_id

    except Exception as e:
        logger.warning(f"SDK entity search failed, trying HTTP: {e}")

    # Fallback to direct HTTP entity search
    try:
        async with httpx.AsyncClient(timeout=30) as http_client:
            resp = await http_client.get(
                f"{settings.RF_API_BASE}/entity/search",
                params={"query": org_name, "type": "Company", "limit": 5},
                headers={
                    "X-RFToken": settings.RF_TOKEN,
                    "Accept": "application/json",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        entities = data.get("data", {}).get("results", [])
        if entities:
            entity = entities[0]
            entity_id = entity.get("entity", {}).get("id")
            entity_name = entity.get("entity", {}).get("name", "unknown")
            logger.info(f"Found RF entity via HTTP: {entity_name} (id={entity_id})")
            return entity_id

    except Exception as e:
        logger.error(f"HTTP entity search also failed: {e}")

    logger.info(f"No RF entity found for '{org_name}'")
    return None


@dataclass
class DailyStats:
    date: str
    darkweb_total: int
    darkweb_fetched: int
    cyber_risk_total: int
    cyber_risk_fetched: int


@dataclass
class FetchResult:
    items: list[dict]
    daily_stats: list[DailyStats]


async def fetch_dark_web_references(
    entity_id: str, lookback_days: int = 14
) -> FetchResult:
    """Fetch dark web references for an entity from the RF API.

    Queries one day at a time (up to 200 references per day), starting from
    today and going back to `lookback_days` days ago.

    Returns a FetchResult with items and per-day statistics.
    """
    client = get_rf_client()
    if not client:
        logger.warning("RF_TOKEN not set, skipping RF fetch")
        return FetchResult(items=[], daily_stats=[])

    all_items: list[dict] = []
    daily_stats: list[DailyStats] = []
    today = datetime.now(timezone.utc).date()

    for days_back in range(lookback_days + 1):
        query_date = datetime(
            today.year, today.month, today.day, tzinfo=timezone.utc
        ) - timedelta(days=days_back)

        try:
            result = client.get_dark_web_references_for_day(
                entity_id, date=query_date, limit=200
            )
        except Exception as e:
            logger.error(
                f"Failed to fetch RF references for {query_date.date()}: {e}"
            )
            daily_stats.append(DailyStats(
                date=str(query_date.date()),
                total_references=0,
                fetched=0,
            ))
            continue

        references = result.get("references", result.get("items", []))
        # total_references is the count RF reports (may exceed our limit of 200)
        total_count = result.get("count", {}).get("total", len(references))
        day_items = _parse_references(references)
        all_items.extend(day_items)

        daily_stats.append(DailyStats(
            date=str(query_date.date()),
            total_references=total_count,
            fetched=len(day_items),
        ))

        logger.info(
            f"RF day {query_date.date()}: {total_count} total, "
            f"{len(day_items)} fetched"
        )

    logger.info(
        f"RF total: {len(all_items)} items over {lookback_days + 1} days "
        f"for entity {entity_id}"
    )
    return FetchResult(items=all_items, daily_stats=daily_stats)


def _parse_references(references: list[dict]) -> list[dict]:
    """Parse a list of RF references into normalized item dicts."""
    items: list[dict] = []
    for ref in references:
        fragment = ref.get("fragment", "")
        document = ref.get("document", {})

        # Determine event type
        ref_type = ref.get("type", "other")
        item_type = RF_TYPE_MAP.get(ref_type, "other")

        # Parse timestamp
        posted_at = _parse_rf_timestamp(ref, document)

        # Extract source name
        source_id = document.get("sourceId", {})
        source_name = (
            source_id.get("name", "recorded_future")
            if isinstance(source_id, dict)
            else "recorded_future"
        )

        # Extract tags from attributes
        tags = _extract_tags(ref)

        # Build content from fragment + document title
        title = document.get("title", ref_type)
        content = fragment or title

        items.append(
            {
                "source": source_name,
                "title": title,
                "content": content,
                "author": source_name,
                "posted_at": posted_at,
                "item_type": item_type,
                "tags": tags[:10],
                "rf_reference_id": ref.get("id"),
                "rf_document_url": document.get("url"),
            }
        )

    return items


def _parse_rf_timestamp(ref: dict, document: dict) -> datetime:
    """Parse timestamp from an RF reference, trying multiple fields."""
    # Try 'start' field first
    start = ref.get("start")
    if start:
        try:
            return datetime.fromisoformat(start.replace("Z", "+00:00"))
        except ValueError:
            pass

    # Try document.published
    published = document.get("published")
    if isinstance(published, str):
        try:
            return datetime.fromisoformat(published.replace("Z", "+00:00"))
        except ValueError:
            pass
    elif isinstance(published, dict):
        date_str = published.get("date") or published.get("min")
        if date_str:
            try:
                return datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except ValueError:
                pass

    return datetime.now(timezone.utc)


def _extract_tags(ref: dict) -> list[str]:
    """Extract entity tags from RF reference attributes."""
    tags: list[str] = []
    for attr in ref.get("attributes", []):
        if isinstance(attr, str):
            tags.append(attr)
        elif isinstance(attr, dict):
            entity_info = attr.get("entity", {})
            if isinstance(entity_info, dict):
                if entity_info.get("type"):
                    tags.append(entity_info["type"])
                if entity_info.get("name"):
                    tags.append(entity_info["name"])
            elif isinstance(entity_info, str):
                tags.append(entity_info)
    return tags
