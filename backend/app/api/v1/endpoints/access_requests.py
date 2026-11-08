from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import get_current_user
from app.models import User
from app.schemas.ttx_access_request import MyAccessRequestListResponse, MyAccessRequestRead
from app.services.ttx_access_request_service import list_own_access_requests

router = APIRouter(prefix="/access-requests", tags=["access-requests"])


@router.get("/me", response_model=MyAccessRequestListResponse)
def list_my_access_requests_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MyAccessRequestListResponse:
    """The caller's own requests for access to exercises."""
    rows, total = list_own_access_requests(session, user.id, limit, offset, sort_dir)
    return MyAccessRequestListResponse(
        items=[
            MyAccessRequestRead(
                id=request.id,
                ttx_id=request.ttx_id,
                ttx_name=ttx.name,
                organization_name=organization.name,
                organization_domain=organization.domain,
                role=request.role,
                status=request.status,
                created_at=request.created_at,
            )
            for request, ttx, organization in rows
        ],
        total=total,
        limit=limit,
        offset=offset,
    )
