"""A Player asks to leave an exercise; its Planners approve (the Player is
taken out, as Creator -> Players' remove does) or reject. A Player never
leaves on their own (`ttx_service.unenroll_from_ttx` refuses them)."""

import logging
import uuid
from datetime import UTC, datetime

from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.core.security import require_not_archived
from app.models import (
    TTX,
    AccessRequestStatus,
    Organization,
    RoleEnum,
    TTXAccess,
    TTXLeaveRequest,
    User,
)
from app.services.ttx_planning_team_service import _delete_access_with_tags

logger = logging.getLogger(__name__)


def _player_access(session: Session, ttx_id: uuid.UUID, user_id: uuid.UUID) -> TTXAccess | None:
    return session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == ttx_id,
            TTXAccess.user_id == user_id,
            TTXAccess.role == RoleEnum.PLAYER,
        )
    ).first()


def _pending_for(session: Session, ttx_id: uuid.UUID, user_id: uuid.UUID) -> TTXLeaveRequest | None:
    return session.exec(
        select(TTXLeaveRequest).where(
            TTXLeaveRequest.ttx_id == ttx_id,
            TTXLeaveRequest.user_id == user_id,
            TTXLeaveRequest.status == AccessRequestStatus.PENDING,
        )
    ).first()


def request_leave(session: Session, user: User, ttx_id: uuid.UUID, reason: str) -> TTXLeaveRequest:
    ttx = session.get(TTX, ttx_id)
    if ttx is not None:
        # Nobody could decide it: the team can't change an archived exercise.
        require_not_archived(ttx)
    if _player_access(session, ttx_id, user.id) is None:
        raise AppException(
            "PLAYER_NOT_FOUND",
            "You aren't a Player of this exercise.",
            404,
            ttx_id=str(ttx_id),
            log_level=logging.WARNING,
        )
    if _pending_for(session, ttx_id, user.id) is not None:
        raise AppException(
            "LEAVE_REQUEST_PENDING",
            "You have already asked to leave this exercise.",
            409,
            ttx_id=str(ttx_id),
            log_level=logging.WARNING,
        )
    request = TTXLeaveRequest(ttx_id=ttx_id, user_id=user.id, reason=reason.strip())
    session.add(request)
    session.commit()
    session.refresh(request)
    logger.info("Player %s asked to leave TTX %s.", user.id, ttx_id)
    return request


def list_own_pending_leave_requests(
    session: Session, user_id: uuid.UUID
) -> list[tuple[TTXLeaveRequest, TTX, Organization]]:
    """The caller's pending leave requests, on exercises they still play."""
    return list(
        session.exec(
            select(TTXLeaveRequest, TTX, Organization)
            .join(TTX, TTX.id == TTXLeaveRequest.ttx_id)
            .join(Organization, Organization.id == TTX.organization_id)
            .join(
                TTXAccess,
                (TTXAccess.ttx_id == TTXLeaveRequest.ttx_id)
                & (TTXAccess.user_id == TTXLeaveRequest.user_id)
                & (TTXAccess.role == RoleEnum.PLAYER),
            )
            .where(
                TTXLeaveRequest.user_id == user_id,
                TTXLeaveRequest.status == AccessRequestStatus.PENDING,
            )
            .order_by(TTXLeaveRequest.created_at.desc())
        )
    )


def list_pending_leave_requests_for_ttx(
    session: Session, ttx_id: uuid.UUID
) -> list[tuple[TTXLeaveRequest, User]]:
    """Pending requests of people still Players here (one taken out
    meanwhile by other means has nothing left to decide)."""
    return list(
        session.exec(
            select(TTXLeaveRequest, User)
            .join(User, User.id == TTXLeaveRequest.user_id)
            .join(
                TTXAccess,
                (TTXAccess.ttx_id == TTXLeaveRequest.ttx_id)
                & (TTXAccess.user_id == TTXLeaveRequest.user_id)
                & (TTXAccess.role == RoleEnum.PLAYER),
            )
            .where(
                TTXLeaveRequest.ttx_id == ttx_id,
                TTXLeaveRequest.status == AccessRequestStatus.PENDING,
            )
            .order_by(TTXLeaveRequest.created_at.desc(), TTXLeaveRequest.id)
        )
    )


def _get_pending(session: Session, ttx_id: uuid.UUID, request_id: uuid.UUID) -> TTXLeaveRequest:
    request = session.get(TTXLeaveRequest, request_id)
    if request is None or request.ttx_id != ttx_id:
        raise AppException(
            "LEAVE_REQUEST_NOT_FOUND",
            "Leave request not found.",
            404,
            ttx_id=str(ttx_id),
            log_level=logging.WARNING,
        )
    if request.status != AccessRequestStatus.PENDING:
        raise AppException(
            "LEAVE_REQUEST_ALREADY_DECIDED",
            "This leave request has already been decided.",
            409,
            ttx_id=str(ttx_id),
            log_level=logging.WARNING,
        )
    return request


def _decide(
    session: Session, request: TTXLeaveRequest, actor: User, status: AccessRequestStatus
) -> None:
    request.status = status
    request.decided_by_id = actor.id
    request.decided_at = datetime.now(UTC)
    session.add(request)


def approve_leave_request(
    session: Session, ttx: TTX, actor: User, request_id: uuid.UUID
) -> TTXLeaveRequest:
    request = _get_pending(session, ttx.id, request_id)
    access = _player_access(session, ttx.id, request.user_id)
    if access is not None:
        _delete_access_with_tags(session, access)
    _decide(session, request, actor, AccessRequestStatus.APPROVED)
    session.commit()
    session.refresh(request)
    logger.info("Leave request %s for TTX %s approved by user %s.", request.id, ttx.id, actor.id)
    return request


def reject_leave_request(
    session: Session, ttx: TTX, actor: User, request_id: uuid.UUID
) -> TTXLeaveRequest:
    request = _get_pending(session, ttx.id, request_id)
    _decide(session, request, actor, AccessRequestStatus.REJECTED)
    session.commit()
    session.refresh(request)
    logger.info("Leave request %s for TTX %s rejected by user %s.", request.id, ttx.id, actor.id)
    return request


def close_pending_leave_requests(
    session: Session, ttx_id: uuid.UUID, user_id: uuid.UUID, actor_id: uuid.UUID
) -> None:
    """A Player taken out by a Planner: their pending request is granted
    with it. No commit."""
    request = _pending_for(session, ttx_id, user_id)
    if request is not None:
        request.status = AccessRequestStatus.APPROVED
        request.decided_by_id = actor_id
        request.decided_at = datetime.now(UTC)
        session.add(request)
