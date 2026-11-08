"""Creator -> Invitations -> Players: the Players an exercise's Planners
have let in (an approved request), and taking one out again. A removed
Player can come back by redeeming an invitation code and being approved
once more, like one who left on their own."""

import logging
import uuid

from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import (
    TTX,
    AccessRequestStatus,
    InvitationToken,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
)
from app.schemas.ttx_player import (
    PlayerInvitationRead,
    PlayerRoomRead,
    TTXPlayerRead,
    TTXPlayersRead,
)
from app.services.email_invitation_service import accepted_player_ids
from app.services.ttx_planning_team_service import _delete_access_with_tags
from app.services.ttx_room_service import list_player_rows, list_rooms

logger = logging.getLogger(__name__)


def players_view(session: Session, ttx: TTX) -> TTXPlayersRead:
    rows = list_player_rows(session, ttx)
    rooms = {r.id: r for r in list_rooms(session, ttx.id)} if ttx.uses_rooms else {}
    # Each Player's latest approved request and its invitation, in one query.
    invitations: dict[uuid.UUID, InvitationToken] = {}
    for request, token in session.exec(
        select(TTXAccessRequest, InvitationToken)
        .join(InvitationToken, InvitationToken.id == TTXAccessRequest.invitation_token_id)
        .where(
            TTXAccessRequest.ttx_id == ttx.id,
            TTXAccessRequest.status == AccessRequestStatus.APPROVED,
        )
        .order_by(TTXAccessRequest.decided_at)
    ):
        invitations[request.user_id] = token
    by_email = accepted_player_ids(session, ttx.id)
    items = []
    for access, user in rows:
        room = rooms.get(access.room_id) if access.room_id else None
        token = invitations.get(user.id)
        items.append(
            TTXPlayerRead(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                last_login_at=user.last_login_at,
                joined_at=access.created_at,
                room=PlayerRoomRead(code=room.code, name=room.name) if room else None,
                invitation=(
                    PlayerInvitationRead(id=token.id, description=token.description)
                    if token
                    else None
                ),
                invited_by_email=user.id in by_email,
            )
        )
    return TTXPlayersRead(uses_rooms=ttx.uses_rooms, items=items)


def remove_player(session: Session, ttx: TTX, user_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    access = session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == ttx.id,
            TTXAccess.user_id == user_id,
            TTXAccess.role == RoleEnum.PLAYER,
        )
    ).first()
    if access is None:
        # A team member's row answers the same: this route never removes staff.
        raise AppException(
            "PLAYER_NOT_FOUND",
            "This person isn't a Player of this exercise.",
            404,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    from app.services.ttx_leave_request_service import close_pending_leave_requests

    _delete_access_with_tags(session, access)
    close_pending_leave_requests(session, ttx.id, user_id, actor_id)
    session.commit()
    logger.info("Player %s removed from TTX %s by user %s.", user_id, ttx.id, actor_id)
