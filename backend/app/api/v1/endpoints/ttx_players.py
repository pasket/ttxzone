"""Creator -> Invitations -> Players: who has joined the exercise, and
taking a Player out. Planner-only (design). See ttx_player_service.
Also a Player's request to leave (theirs to make, the Planners' to decide;
see ttx_leave_request_service)."""

import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import RequiresOrgAndTTXAccess, get_current_user, verify_csrf
from app.models import TTX, Organization, RoleEnum, User
from app.schemas.ttx_player import (
    LeaveRequestCreate,
    MyLeaveRequestRead,
    TTXLeaveRequestRead,
    TTXPlayersRead,
)
from app.services.ttx_leave_request_service import (
    approve_leave_request,
    list_own_pending_leave_requests,
    list_pending_leave_requests_for_ttx,
    reject_leave_request,
    request_leave,
)
from app.services.ttx_player_service import players_view, remove_player

router = APIRouter(prefix="/ttx", tags=["ttx-players"])
# The caller's own requests, across exercises (no exercise in the path).
me_router = APIRouter(prefix="/leave-requests", tags=["ttx-players"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/{ttx_id}/players", response_model=TTXPlayersRead)
def list_players_endpoint(
    ttx: TTX = Depends(_planner), session: Session = Depends(get_session)
) -> TTXPlayersRead:
    """The exercise's Players."""
    return players_view(session, ttx)


@router.delete("/{ttx_id}/players/{user_id}", status_code=204, dependencies=[Depends(verify_csrf)])
def remove_player_endpoint(
    user_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove a Player from the exercise."""
    remove_player(session, ttx, user_id, user.id)


def _leave_request_read(request, user: User) -> TTXLeaveRequestRead:
    return TTXLeaveRequestRead(
        id=request.id,
        ttx_id=request.ttx_id,
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        reason=request.reason,
        status=request.status,
        created_at=request.created_at,
    )


@router.post(
    "/{ttx_id}/leave-request",
    response_model=MyLeaveRequestRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def request_leave_endpoint(
    ttx_id: uuid.UUID,
    body: LeaveRequestCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MyLeaveRequestRead:
    """No role guard: the caller can only ever ask for their own Player
    row (keyed off their own user id); the service checks they hold one."""
    request = request_leave(session, user, ttx_id, body.reason)
    ttx = session.get(TTX, ttx_id)
    organization = session.get(Organization, ttx.organization_id)
    return MyLeaveRequestRead(
        id=request.id,
        ttx_id=ttx.id,
        ttx_name=ttx.name,
        organization_name=organization.name,
        reason=request.reason,
        created_at=request.created_at,
    )


@router.get("/{ttx_id}/leave-requests", response_model=list[TTXLeaveRequestRead])
def list_leave_requests_endpoint(
    ttx: TTX = Depends(_planner), session: Session = Depends(get_session)
) -> list[TTXLeaveRequestRead]:
    """The Players' pending requests to leave the exercise."""
    return [
        _leave_request_read(request, requester)
        for request, requester in list_pending_leave_requests_for_ttx(session, ttx.id)
    ]


@router.post(
    "/{ttx_id}/leave-requests/{request_id}/approve",
    response_model=TTXLeaveRequestRead,
    dependencies=[Depends(verify_csrf)],
)
def approve_leave_request_endpoint(
    request_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXLeaveRequestRead:
    """Approve a Player's request to leave."""
    request = approve_leave_request(session, ttx, user, request_id)
    return _leave_request_read(request, session.get(User, request.user_id))


@router.post(
    "/{ttx_id}/leave-requests/{request_id}/reject",
    response_model=TTXLeaveRequestRead,
    dependencies=[Depends(verify_csrf)],
)
def reject_leave_request_endpoint(
    request_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTXLeaveRequestRead:
    """Reject a Player's request to leave."""
    request = reject_leave_request(session, ttx, user, request_id)
    return _leave_request_read(request, session.get(User, request.user_id))


@me_router.get("/me", response_model=list[MyLeaveRequestRead])
def list_my_leave_requests_endpoint(
    user: User = Depends(get_current_user), session: Session = Depends(get_session)
) -> list[MyLeaveRequestRead]:
    """The caller's own requests to leave exercises."""
    return [
        MyLeaveRequestRead(
            id=request.id,
            ttx_id=ttx.id,
            ttx_name=ttx.name,
            organization_name=organization.name,
            reason=request.reason,
            created_at=request.created_at,
        )
        for request, ttx, organization in list_own_pending_leave_requests(session, user.id)
    ]
