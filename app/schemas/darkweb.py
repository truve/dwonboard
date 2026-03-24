from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DarkWebItemCreate(BaseModel):
    source: str = Field(..., max_length=100)
    title: str | None = Field(None, max_length=500)
    content: str
    author: str | None = Field(None, max_length=200)
    posted_at: datetime
    item_type: str = Field(..., max_length=50)
    tags: list[str] | None = None


class DarkWebItemOut(BaseModel):
    id: str
    source: str
    title: str | None
    content: str
    author: str | None
    posted_at: datetime
    scraped_at: datetime
    item_type: str
    tags: str | None

    model_config = ConfigDict(from_attributes=True)
