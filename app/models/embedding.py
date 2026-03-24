import uuid
from datetime import datetime

from sqlalchemy import DateTime, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EmbeddingRecord(Base):
    __tablename__ = "embeddings"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    source_type: Mapped[str] = mapped_column(String(20))
    source_id: Mapped[str] = mapped_column(String(36), index=True)
    embedding: Mapped[bytes] = mapped_column(LargeBinary)
    text_hash: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
