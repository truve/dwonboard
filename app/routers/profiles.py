from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.profile import OrgProfile, ProfileEntry
from app.schemas.profile import ProfileEntryOut, ProfileOut

router = APIRouter()


@router.get("/organizations/{org_id}/profile", response_model=ProfileOut)
def get_profile(org_id: str, db: Session = Depends(get_db)) -> ProfileOut:
    profile = db.query(OrgProfile).filter_by(org_id=org_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    entries = db.query(ProfileEntry).filter_by(profile_id=profile.id).all()

    return ProfileOut(
        id=profile.id,
        org_id=profile.org_id,
        summary=profile.summary,
        generated_at=profile.generated_at,
        entries=[ProfileEntryOut.model_validate(e) for e in entries],
    )


@router.get(
    "/organizations/{org_id}/profile/entries",
    response_model=list[ProfileEntryOut],
)
def get_profile_entries(
    org_id: str,
    category: str | None = Query(None),
    db: Session = Depends(get_db),
) -> list[ProfileEntryOut]:
    profile = db.query(OrgProfile).filter_by(org_id=org_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    query = db.query(ProfileEntry).filter_by(profile_id=profile.id)
    if category:
        query = query.filter_by(category=category)

    entries = query.all()
    return [ProfileEntryOut.model_validate(e) for e in entries]
