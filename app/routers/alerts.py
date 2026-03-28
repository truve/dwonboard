from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from fastapi import HTTPException as _HTTPException
from app.database import get_db
from app.models.alert import Alert
from app.models.darkweb_item import DarkWebItem
from app.models.organization import Organization
from app.schemas.alert import AlertList, AlertOut, AlertUpdate


def _get_session_id(org_id: str, db: Session) -> str:
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise _HTTPException(status_code=404, detail="Organization not found")
    return org.session_id

router = APIRouter()


def _alert_with_detected_at(alert: Alert, db: Session) -> AlertOut:
    """Build AlertOut with detected_at from the linked dark web item."""
    out = AlertOut.model_validate(alert)
    item = db.query(DarkWebItem).filter_by(id=alert.darkweb_item_id).first()
    if item:
        out.detected_at = item.posted_at
    return out


@router.get("/organizations/{org_id}/alerts", response_model=AlertList)
def list_alerts(
    org_id: str,
    severity: str | None = Query(None),
    relevance: str | None = Query(None),
    classification: str | None = Query(None),
    status: str | None = Query(None),
    sort_by: str = Query("relevance_score"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
) -> AlertList:
    session_id = _get_session_id(org_id, db)
    query = db.query(Alert).filter_by(org_id=org_id, session_id=session_id)

    if severity:
        query = query.filter_by(severity=severity)
    if relevance:
        query = query.filter_by(relevance=relevance)
    if classification:
        query = query.filter_by(classification=classification)
    if status:
        query = query.filter_by(status=status)

    total = query.count()

    if sort_by == "relevance_score":
        query = query.order_by(Alert.relevance_score.desc())
    elif sort_by == "severity":
        query = query.order_by(Alert.severity)
    elif sort_by == "created_at":
        query = query.order_by(Alert.created_at.desc())

    alerts = query.offset(offset).limit(limit).all()

    return AlertList(
        total=total,
        alerts=[_alert_with_detected_at(a, db) for a in alerts],
    )


@router.get("/organizations/{org_id}/alerts/{alert_id}", response_model=AlertOut)
def get_alert(
    org_id: str, alert_id: str, db: Session = Depends(get_db)
) -> AlertOut:
    alert = (
        db.query(Alert).filter_by(id=alert_id, org_id=org_id).first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _alert_with_detected_at(alert, db)


@router.patch("/organizations/{org_id}/alerts/{alert_id}", response_model=AlertOut)
def update_alert(
    org_id: str,
    alert_id: str,
    body: AlertUpdate,
    db: Session = Depends(get_db),
) -> AlertOut:
    alert = (
        db.query(Alert).filter_by(id=alert_id, org_id=org_id).first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = body.status
    db.commit()
    db.refresh(alert)
    return _alert_with_detected_at(alert, db)
