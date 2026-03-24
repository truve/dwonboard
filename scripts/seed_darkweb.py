#!/usr/bin/env python3
"""Seed mock dark web data and compute embeddings."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, SessionLocal, engine
from app.services.darkweb_ingest import embed_darkweb_items, seed_mock_darkweb_data


async def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        items = seed_mock_darkweb_data(db)
        print(f"Seeded {len(items)} dark web items")
        embedded = await embed_darkweb_items(db)
        print(f"Embedded {embedded} new items")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
