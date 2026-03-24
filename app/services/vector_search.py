import hashlib
import logging
import uuid

import numpy as np
from sqlalchemy.orm import Session

from app.models.embedding import EmbeddingRecord
from app.services.openai_client import create_embeddings

logger = logging.getLogger(__name__)


async def embed_texts(texts: list[str]) -> list[list[float]]:
    return await create_embeddings(texts)


def store_embeddings(
    db: Session,
    source_type: str,
    items: list[tuple[str, str, list[float]]],
    model: str = "text-embedding-3-small",
) -> None:
    """Store embeddings. items = list of (source_id, original_text, vector)."""
    for source_id, text, vector in items:
        text_hash = hashlib.sha256(text.encode()).hexdigest()

        existing = (
            db.query(EmbeddingRecord)
            .filter_by(source_type=source_type, source_id=source_id)
            .first()
        )
        if existing:
            existing.embedding = np.array(vector, dtype=np.float32).tobytes()
            existing.text_hash = text_hash
        else:
            record = EmbeddingRecord(
                id=str(uuid.uuid4()),
                source_type=source_type,
                source_id=source_id,
                embedding=np.array(vector, dtype=np.float32).tobytes(),
                text_hash=text_hash,
                model=model,
            )
            db.add(record)

    db.commit()


def find_similar(
    db: Session,
    query_embedding: list[float],
    source_type: str,
    top_k: int = 10,
    threshold: float = 0.45,
) -> list[tuple[str, float]]:
    """Brute-force cosine similarity search. Returns list of (source_id, score)."""
    records = (
        db.query(EmbeddingRecord).filter_by(source_type=source_type).all()
    )

    if not records:
        return []

    query_vec = np.array(query_embedding, dtype=np.float32)
    query_norm = np.linalg.norm(query_vec)
    if query_norm == 0:
        return []

    results: list[tuple[str, float]] = []
    for record in records:
        stored_vec = np.frombuffer(record.embedding, dtype=np.float32)
        stored_norm = np.linalg.norm(stored_vec)
        if stored_norm == 0:
            continue
        similarity = float(np.dot(query_vec, stored_vec) / (query_norm * stored_norm))
        if similarity >= threshold:
            results.append((record.source_id, similarity))

    results.sort(key=lambda x: x[1], reverse=True)
    return results[:top_k]
