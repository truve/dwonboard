import json
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator


class IocEnrichment(BaseModel):
    type: str
    value: str
    risk_score: int | None = None
    rules: str | None = None
    criticality: str | None = None


class AlertOut(BaseModel):
    id: str
    org_id: str
    darkweb_item_id: str
    title: str
    description: str
    severity: str
    relevance: str
    relevance_score: float
    classification: str
    ai_reasoning: str
    status: str
    created_at: datetime
    detected_at: datetime | None = None
    matched_profile_entries: list[str] | None = None
    ioc_enrichments: list[IocEnrichment] | None = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("matched_profile_entries", mode="before")
    @classmethod
    def parse_json_list(cls, v: str | list | None) -> list[str] | None:
        if v is None:
            return None
        if isinstance(v, str):
            return json.loads(v)
        return v

    @field_validator("ioc_enrichments", mode="before")
    @classmethod
    def parse_ioc_json(cls, v: str | list | None) -> list | None:
        if v is None:
            return None
        if isinstance(v, str):
            return json.loads(v)
        return v


class AlertList(BaseModel):
    total: int
    alerts: list[AlertOut]


class AlertUpdate(BaseModel):
    status: Literal["reviewed", "dismissed"]
