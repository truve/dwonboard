import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    org_id: Mapped[str] = mapped_column(ForeignKey("organizations.id"), index=True)
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    darkweb_item_id: Mapped[str] = mapped_column(ForeignKey("darkweb_items.id"))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text)
    severity: Mapped[str] = mapped_column(String(20))
    relevance: Mapped[str] = mapped_column(String(20))
    relevance_score: Mapped[float] = mapped_column(Float)
    matched_profile_entries: Mapped[str | None] = mapped_column(Text)
    classification: Mapped[str] = mapped_column(String(50))
    ai_reasoning: Mapped[str] = mapped_column(Text)
    ioc_enrichments: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
