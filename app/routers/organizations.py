import json
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.alert import Alert
from app.models.darkweb_item import DarkWebItem
from app.models.organization import Organization
from app.models.profile import OrgProfile
from app.schemas.organization import OnboardingStatus, OrganizationCreate, OrganizationOut, RecentItem
from app.services.onboarding import collect_one_day, run_analysis, run_onboarding_pipeline

router = APIRouter()


@router.post("/organizations", response_model=OrganizationOut, status_code=201)
def create_organization(
    body: OrganizationCreate,
    db: Session = Depends(get_db),
) -> Organization:
    org = Organization(
        name=body.name,
        domain=body.domain,
        industry=body.industry,
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


@router.get("/organizations/{org_id}", response_model=OrganizationOut)
def get_organization(org_id: str, db: Session = Depends(get_db)) -> Organization:
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


@router.post("/organizations/{org_id}/confirm", response_model=OrganizationOut)
async def confirm_organization(
    org_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> Organization:
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    if org.status != "pending_confirmation":
        raise HTTPException(
            status_code=400,
            detail=f"Organization is in '{org.status}' state, expected 'pending_confirmation'",
        )

    org.status = "confirmed"
    org.confirmed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(org)

    background_tasks.add_task(run_onboarding_pipeline, org_id)
    return org


@router.post("/organizations/{org_id}/collect-day")
async def collect_day(
    org_id: str,
    days_back: int = Query(..., ge=0, description="Number of days back from today"),
    db: Session = Depends(get_db),
) -> dict:
    """Fetch one day of dark web + OSINT data. Called by frontend day by day."""
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    if org.status not in ("collecting", "alerting"):
        raise HTTPException(
            status_code=400,
            detail=f"Organization is in '{org.status}' state, expected 'collecting'",
        )

    result = await collect_one_day(org_id, days_back, db)
    return result


@router.post("/organizations/{org_id}/analyze")
async def analyze(
    org_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> dict:
    """Trigger alert generation + risk assessment after collection is done."""
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    org.status = "analyzing"
    db.commit()

    background_tasks.add_task(run_analysis, org_id)
    return {"status": "analyzing"}


@router.get("/organizations/{org_id}/status", response_model=OnboardingStatus)
def get_onboarding_status(
    org_id: str, db: Session = Depends(get_db)
) -> OnboardingStatus:
    org = db.query(Organization).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    profile_ready = db.query(OrgProfile).filter_by(org_id=org_id).first() is not None
    alerts_count = db.query(Alert).filter_by(org_id=org_id).count()

    elapsed = None
    if org.confirmed_at:
        confirmed = org.confirmed_at.replace(tzinfo=timezone.utc) if org.confirmed_at.tzinfo is None else org.confirmed_at
        elapsed = (datetime.now(timezone.utc) - confirmed).total_seconds()

    # Parse ingestion stats — extract 'days' list from the stored JSON
    ingestion_stats = None
    if org.ingestion_stats:
        try:
            raw = json.loads(org.ingestion_stats)
            if isinstance(raw, dict):
                ingestion_stats = raw.get("days", [])
            elif isinstance(raw, list):
                ingestion_stats = raw
        except (json.JSONDecodeError, TypeError):
            pass

    return OnboardingStatus(
        org_id=org.id,
        status=org.status,
        profile_ready=profile_ready,
        alerts_count=alerts_count,
        elapsed_seconds=elapsed,
        logo_url=org.logo_url,
        ingestion_stats=ingestion_stats,
        cyber_risk_summary=org.cyber_risk_summary,
        recent_items=None,  # No longer used — samples come from collect-day response
    )
