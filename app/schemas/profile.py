from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ProfileEntryOut(BaseModel):
    id: str
    category: str
    key: str
    value: str
    citation_url: str | None
    citation_text: str | None

    model_config = ConfigDict(from_attributes=True)


class ProfileOut(BaseModel):
    id: str
    org_id: str
    summary: str
    generated_at: datetime | None
    entries: list[ProfileEntryOut]

    model_config = ConfigDict(from_attributes=True)
