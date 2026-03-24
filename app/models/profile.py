import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class OrgProfile(Base):
    __tablename__ = "org_profiles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    org_id: Mapped[str] = mapped_column(
        ForeignKey("organizations.id"), unique=True, index=True
    )
    summary: Mapped[str] = mapped_column(Text, default="")
    raw_json: Mapped[str] = mapped_column(Text, default="{}")
    generated_at: Mapped[datetime | None] = mapped_column(DateTime)

    entries: Mapped[list["ProfileEntry"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class ProfileEntry(Base):
    __tablename__ = "profile_entries"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    profile_id: Mapped[str] = mapped_column(
        ForeignKey("org_profiles.id"), index=True
    )
    category: Mapped[str] = mapped_column(String(50))
    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(Text)
    citation_url: Mapped[str | None] = mapped_column(Text)
    citation_text: Mapped[str | None] = mapped_column(Text)

    profile: Mapped["OrgProfile"] = relationship(back_populates="entries")
