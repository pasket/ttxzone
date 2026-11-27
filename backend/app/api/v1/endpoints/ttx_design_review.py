"""The exercise's design reviewed as a whole (Creator → MSEL → Review):
its Planners, and a Program Manager of its organization, who reads the
design like the rest of it."""

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import RequiresOrgAndTTXAccess
from app.models import TTX, RoleEnum
from app.schemas.design_review import DesignReviewRead
from app.services.design_review_service import design_review

router = APIRouter(prefix="/ttx/{ttx_id}/design-review", tags=["ttx-msel"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("", response_model=DesignReviewRead)
def design_review_endpoint(
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> DesignReviewRead:
    """The chain need → objective → phase → inject → expected action →
    observation point with the links it lacks, the session's pace, who the
    injects go to and the threat actors' techniques no inject uses."""
    return design_review(session, ttx)
