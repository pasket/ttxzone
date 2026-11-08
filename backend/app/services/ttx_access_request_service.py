import logging
import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import (
    TTX,
    AccessRequestStatus,
    InvitationToken,
    Organization,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
    User,
)

logger = logging.getLogger(__name__)
auth_logger = logging.getLogger(AUTH_LOGGER_NAME)


def list_pending_access_requests_for_ttx(
    session: Session,
    ttx_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name"] = "created_at",
    q: str | None = None,
) -> tuple[list[tuple[TTXAccessRequest, User, InvitationToken]], int]:
    where_clause = [
        TTXAccessRequest.ttx_id == ttx_id,
        TTXAccessRequest.status == AccessRequestStatus.PENDING,
    ]
    if q:
        pattern = f"%{q}%"
        where_clause.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))

    total = session.exec(
        select(func.count())
        .select_from(TTXAccessRequest)
        .join(User, User.id == TTXAccessRequest.user_id)
        .where(*where_clause)
    ).one()

    sort_column = User.full_name if sort_by == "name" else TTXAccessRequest.created_at
    order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    # Stable tiebreaker among equal sort keys across paginated queries.
    rows = list(
        session.exec(
            select(TTXAccessRequest, User, InvitationToken)
            .join(User, User.id == TTXAccessRequest.user_id)
            .join(InvitationToken, InvitationToken.id == TTXAccessRequest.invitation_token_id)
            .where(*where_clause)
            .order_by(order, TTXAccessRequest.id)
            .limit(limit)
            .offset(offset)
        )
    )

    return rows, total


def list_own_access_requests(
    session: Session,
    user_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
) -> tuple[list[tuple[TTXAccessRequest, TTX, Organization]], int]:
    """The current user's own access requests (any status), across every
    org/TTX they've ever redeemed a token for -- used by the player
    panel to show pending/approved/rejected status without needing to
    already hold TTXAccess for that TTX.
    """
    where_clause = TTXAccessRequest.user_id == user_id

    total = session.exec(
        select(func.count()).select_from(TTXAccessRequest).where(where_clause)
    ).one()

    order = (
        TTXAccessRequest.created_at.desc()
        if sort_dir == "desc"
        else TTXAccessRequest.created_at.asc()
    )
    rows = list(
        session.exec(
            select(TTXAccessRequest, TTX, Organization)
            .join(TTX, TTX.id == TTXAccessRequest.ttx_id)
            .join(Organization, Organization.id == TTX.organization_id)
            .where(where_clause)
            .order_by(order)
            .limit(limit)
            .offset(offset)
        )
    )

    return rows, total


def _get_pending_request(
    session: Session, ttx_id: uuid.UUID, request_id: uuid.UUID
) -> TTXAccessRequest:
    request = session.get(TTXAccessRequest, request_id)
    if request is None or request.ttx_id != ttx_id:
        raise AppException("ACCESS_REQUEST_NOT_FOUND", "Access request not found.", 404)
    if request.status != AccessRequestStatus.PENDING:
        raise AppException(
            "ACCESS_REQUEST_ALREADY_DECIDED",
            "This access request has already been decided.",
            409,
            log_level=logging.WARNING,
        )
    return request


def approve_access_request(
    session: Session, ttx: TTX, admin: User, request_id: uuid.UUID
) -> TTXAccessRequest:
    request = _get_pending_request(session, ttx.id, request_id)

    # Every path onto an exercise's planning team needs the org Planner
    # grant a Program Manager gave (as add_planning_team_member does) --
    # invitation tokens are Player-only today, so this only guards a
    # PLANNER request that some future path might create. Player requests
    # are unaffected.
    if request.role == RoleEnum.PLANNER:
        from app.core.security import is_planner

        requester = session.get(User, request.user_id)
        if not is_planner(session, requester, ttx.organization_id):
            raise AppException(
                "NOT_ORG_PLANNER",
                "Only Planners of this organization can join its planning team.",
                400,
                log_level=logging.WARNING,
                logger_name=AUTH_LOGGER_NAME,
            )

    ttx_access = TTXAccess(
        user_id=request.user_id,
        ttx_id=request.ttx_id,
        role=request.role,
        plans=request.role == RoleEnum.PLANNER,
        granted_by_id=admin.id,
    )
    session.add(ttx_access)

    request.status = AccessRequestStatus.APPROVED
    request.decided_by_id = admin.id
    request.decided_at = datetime.now(UTC)
    session.add(request)
    session.commit()
    session.refresh(request)

    auth_logger.info(
        "Access request %s for TTX %s approved by user %s (role=%s).",
        request.id,
        ttx.id,
        admin.id,
        request.role,
    )
    return request


def reject_access_request(
    session: Session, ttx: TTX, admin: User, request_id: uuid.UUID
) -> TTXAccessRequest:
    request = _get_pending_request(session, ttx.id, request_id)

    request.status = AccessRequestStatus.REJECTED
    request.decided_by_id = admin.id
    request.decided_at = datetime.now(UTC)
    session.add(request)
    session.commit()
    session.refresh(request)

    auth_logger.warning(
        "Access request %s for TTX %s rejected by user %s.",
        request.id,
        ttx.id,
        admin.id,
    )
    return request
