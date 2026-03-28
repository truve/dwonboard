import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DarkWebItem(Base):
    __tablename__ = "darkweb_items"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(String(36), index=True)
    source: Mapped[str] = mapped_column(String(100))
    title: Mapped[str | None] = mapped_column(String(500))
    content: Mapped[str] = mapped_column(Text)
    author: Mapped[str | None] = mapped_column(String(200))
    posted_at: Mapped[datetime] = mapped_column(DateTime)
    scraped_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    item_type: Mapped[str] = mapped_column(String(50))
    tags: Mapped[str | None] = mapped_column(Text)
