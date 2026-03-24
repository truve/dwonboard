import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.darkweb_item import DarkWebItem
from app.models.organization import Organization
from app.schemas.darkweb import DarkWebItemCreate, DarkWebItemOut
from app.services.darkweb_ingest import embed_darkweb_items, ingest_rf_data

router = APIRouter()


@router.post("/darkweb/ingest")
async def ingest_from_rf(
    org_name: str = Query(..., description="Organization name to query RF for"),
    org_id: str = Query(..., description="Organization ID to track stats on"),
    db: Session = Depends(get_db),
) -> dict:
    """Ingest dark web data from Recorded Future for an organization."""
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Organization not found")
    domains = [org.domain] if org.domain else []
    new_items = await ingest_rf_data(org_id, org_name, domains, db)
    embedded = await embed_darkweb_items(db)
    return {
        "ingested": len(new_items),
        "newly_embedded": embedded,
        "total_items": db.query(DarkWebItem).count(),
    }


@router.post("/darkweb/items", response_model=DarkWebItemOut, status_code=201)
def create_item(
    body: DarkWebItemCreate, db: Session = Depends(get_db)
) -> DarkWebItem:
    """Manually push a dark web item (admin/testing)."""
    item = DarkWebItem(
        source=body.source,
        title=body.title,
        content=body.content,
        author=body.author,
        posted_at=body.posted_at,
        item_type=body.item_type,
        tags=json.dumps(body.tags) if body.tags else None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/darkweb/items", response_model=list[DarkWebItemOut])
def list_items(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    item_type: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[DarkWebItem]:
    query = db.query(DarkWebItem)
    if item_type:
        query = query.filter_by(item_type=item_type)
    return query.order_by(DarkWebItem.posted_at.desc()).offset(offset).limit(limit).all()
