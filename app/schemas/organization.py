from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    domain: str | None = Field(None, max_length=255)
    industry: str | None = Field(None, max_length=100)


class OrganizationOut(BaseModel):
    id: str
    name: str
    domain: str | None
    industry: str | None
    status: str
    logo_url: str | None = None
    confirmed_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DailyIngestionStats(BaseModel):
    date: str
    darkweb_total: int
    darkweb_fetched: int
    cyber_risk_total: int
    cyber_risk_fetched: int


class RecentItem(BaseModel):
    title: str | None
    source: str
    item_type: str
    posted_at: datetime
    snippet: str

    model_config = ConfigDict(from_attributes=True)


class OnboardingStatus(BaseModel):
    org_id: str
    status: str
    profile_ready: bool
    alerts_count: int
    elapsed_seconds: float | None
    logo_url: str | None = None
    ingestion_stats: list[DailyIngestionStats] | None = None
    cyber_risk_summary: str | None = None
    analysis_progress: str | None = None
    intel_card_ready: bool = False
    recent_items: list[RecentItem] | None = None
