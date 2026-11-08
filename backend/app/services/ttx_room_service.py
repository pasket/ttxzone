"""Rooms (Creator -> Exercise -> Rooms): an exercise played by several teams
at once, each in its own room getting its own injects, plus the main room
where the Controller projects one for everyone. A Player sits in one room
(TTXAccess.room_id) or none yet, and then only in the main room.

The rooms' structure (turning them on or off, adding, removing) is the
MSEL's ground -- injects are aimed at rooms -- so it's frozen while the MSEL
is READY or once the session has started. Renaming a room and seating
Players stay open, the session included (a late Player gets a seat)."""

import logging
import uuid

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import (
    TTX,
    ExerciseRun,
    Inject,
    MselStatus,
    RoleEnum,
    TTXAccess,
    TTXContextRole,
    TTXMsel,
    TTXRoom,
    User,
)
from app.schemas.ttx_room import (
    RoomAssignment,
    RoomPlayerRead,
    RoomRead,
    RoomsRead,
    RoomTeamMemberRead,
)

logger = logging.getLogger(__name__)


def list_rooms(session: Session, ttx_id: uuid.UUID) -> list[TTXRoom]:
    return list(
        session.exec(
            select(TTXRoom).where(TTXRoom.ttx_id == ttx_id).order_by(TTXRoom.position, TTXRoom.code)
        )
    )


def structure_locked(session: Session, ttx: TTX) -> bool:
    ready = session.exec(
        select(TTXMsel.id).where(TTXMsel.ttx_id == ttx.id, TTXMsel.status == MselStatus.READY)
    ).first()
    started = session.exec(
        select(ExerciseRun.id).where(
            ExerciseRun.ttx_id == ttx.id, ExerciseRun.archived_at.is_(None)
        )
    ).first()
    return ready is not None or started is not None


def _require_unlocked(session: Session, ttx: TTX) -> None:
    if structure_locked(session, ttx):
        raise AppException(
            "ROOMS_LOCKED",
            "The MSEL is ready or the session has started: reopen the MSEL to change the rooms.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )


def _require_rooms(ttx: TTX) -> None:
    if not ttx.uses_rooms:
        raise AppException(
            "ROOMS_DISABLED",
            "This exercise doesn't use rooms.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )


def _room_or_404(session: Session, ttx: TTX, room_id: uuid.UUID) -> TTXRoom:
    room = session.get(TTXRoom, room_id)
    if room is None or room.ttx_id != ttx.id:
        raise AppException("ROOM_NOT_FOUND", "This room isn't on this exercise.", 404)
    return room


def _require_unique_name(
    session: Session, ttx: TTX, name: str, room_id: uuid.UUID | None = None
) -> None:
    query = select(TTXRoom.id).where(
        TTXRoom.ttx_id == ttx.id, func.lower(TTXRoom.name) == name.lower()
    )
    if room_id is not None:
        query = query.where(TTXRoom.id != room_id)
    if session.exec(query).first() is not None:
        raise AppException(
            "ROOM_NAME_TAKEN",
            "Another room of this exercise already has that name.",
            409,
            log_level=logging.WARNING,
        )


def list_player_rows(session: Session, ttx: TTX) -> list[tuple[TTXAccess, User]]:
    """The exercise's Players (TTXAccess PLAYER rows) with their account,
    by name."""
    return list(
        session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == ttx.id, TTXAccess.role == RoleEnum.PLAYER)
            .order_by(User.full_name)
        )
    )


# The roles that watch the session in the Playground or the Control
# center, and so may open it on a room of their own.
_SESSION_ROLES = {
    TTXContextRole.CONTROLLER.value,
    TTXContextRole.FACILITATOR.value,
    TTXContextRole.EVALUATOR.value,
    TTXContextRole.OBSERVER.value,
}


def follows_session(access: TTXAccess) -> bool:
    """A team row (not a Player) whose holder watches the session: a
    Controller, Facilitator, Evaluator or Observer."""
    return access.role != RoleEnum.PLAYER and bool(access.context_roles() & _SESSION_ROLES)


def list_team_rows(session: Session, ttx: TTX) -> list[tuple[TTXAccess, User]]:
    """The team members who follow the session, by name."""
    rows = session.exec(
        select(TTXAccess, User)
        .join(User, User.id == TTXAccess.user_id)
        .where(TTXAccess.ttx_id == ttx.id, TTXAccess.role != RoleEnum.PLAYER)
        .order_by(User.full_name)
    )
    return [(access, user) for access, user in rows if follows_session(access)]


def rooms_view(session: Session, ttx: TTX) -> RoomsRead:
    rooms = list_rooms(session, ttx.id)
    players = list_player_rows(session, ttx)
    counts: dict[uuid.UUID, int] = {}
    for access, _ in players:
        if access.room_id is not None:
            counts[access.room_id] = counts.get(access.room_id, 0) + 1
    return RoomsRead(
        uses_rooms=ttx.uses_rooms,
        structure_locked=structure_locked(session, ttx),
        rooms=[
            RoomRead(
                id=r.id,
                code=r.code,
                name=r.name,
                description=r.description,
                player_count=counts.get(r.id, 0),
            )
            for r in rooms
        ],
        players=[
            RoomPlayerRead(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                last_login_at=user.last_login_at,
                joined_at=access.created_at,
                room_id=access.room_id,
            )
            for access, user in players
        ],
        team=[
            RoomTeamMemberRead(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                roles=sorted(access.context_roles() & _SESSION_ROLES, key=_ROLE_ORDER.index),
                room_id=access.room_id,
            )
            for access, user in list_team_rows(session, ttx)
        ],
    )


_ROLE_ORDER = [
    TTXContextRole.CONTROLLER.value,
    TTXContextRole.FACILITATOR.value,
    TTXContextRole.EVALUATOR.value,
    TTXContextRole.OBSERVER.value,
]


def set_uses_rooms(session: Session, ttx: TTX, uses_rooms: bool) -> None:
    if ttx.uses_rooms == uses_rooms:
        return
    _require_unlocked(session, ttx)
    ttx.uses_rooms = uses_rooms
    session.add(ttx)
    session.commit()
    logger.info("Exercise %s rooms %s", ttx.id, "on" if uses_rooms else "off")


def create_room(session: Session, ttx: TTX, name: str, description: str) -> TTXRoom:
    _require_rooms(ttx)
    _require_unlocked(session, ttx)
    _require_unique_name(session, ttx, name)
    position = len(list_rooms(session, ttx.id))
    room = TTXRoom(
        ttx_id=ttx.id,
        code=f"RM-{ttx.next_room_number:02d}",
        name=name,
        description=description,
        position=position,
    )
    ttx.next_room_number += 1
    session.add(ttx)
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


def update_room(
    session: Session,
    ttx: TTX,
    room_id: uuid.UUID,
    name: str | None,
    description: str | None,
) -> TTXRoom:
    room = _room_or_404(session, ttx, room_id)
    if name is not None:
        _require_unique_name(session, ttx, name, room.id)
        room.name = name
    if description is not None:
        room.description = description
    session.add(room)
    session.commit()
    session.refresh(room)
    return room


def delete_room(session: Session, ttx: TTX, room_id: uuid.UUID) -> None:
    """Its Players are left without a room. Refused while injects are aimed
    at it."""
    room = _room_or_404(session, ttx, room_id)
    _require_unlocked(session, ttx)
    aimed = list(
        session.exec(
            select(Inject.code)
            .where(Inject.ttx_id == ttx.id, Inject.room_ids.any(room.id))
            .order_by(Inject.position)
        )
    )
    if aimed:
        # Never silently "all rooms": the Planner re-aims them first.
        raise AppException(
            "ROOM_IN_USE",
            "Injects are aimed at this room: {injects}. Aim them elsewhere first.",
            409,
            log_level=logging.WARNING,
            params={"injects": ", ".join(aimed)},
        )
    for access in session.exec(select(TTXAccess).where(TTXAccess.room_id == room.id)):
        access.room_id = None
        session.add(access)
    session.flush()
    session.delete(room)
    session.commit()


def set_assignments(
    session: Session, ttx: TTX, assignments: list[RoomAssignment], user: User
) -> None:
    """Seat these Players, or give these team members their default room,
    all or none. A Player reseated mid-session is in the log too and goes to
    their new room; a team member's room only sets where their view of the
    session opens (they still pick any room)."""
    from app.services.exercise_run_service import note_seating

    _require_rooms(ttx)
    room_ids = {r.id for r in list_rooms(session, ttx.id)}
    accesses = {
        a.user_id: a
        for a in session.exec(
            select(TTXAccess).where(
                TTXAccess.ttx_id == ttx.id,
                TTXAccess.user_id.in_([item.user_id for item in assignments]),
            )
        )
    }
    moved: list[uuid.UUID] = []
    for item in assignments:
        access = accesses.get(item.user_id)
        if access is None:
            raise AppException("NOT_ON_EXERCISE", "This person isn't on this exercise.", 404)
        if access.role != RoleEnum.PLAYER and not follows_session(access):
            raise AppException(
                "ROOM_PLAYERS_ONLY",
                "Only Players and team members who follow the session have a room.",
                409,
                log_level=logging.WARNING,
            )
        if item.room_id is not None and item.room_id not in room_ids:
            raise AppException("ROOM_NOT_FOUND", "This room isn't on this exercise.", 404)
        changed = access.room_id != item.room_id
        access.room_id = item.room_id
        session.add(access)
        # A team member's room is only where their view opens: nobody moves.
        if changed and access.role == RoleEnum.PLAYER:
            moved.append(access.user_id)
    if moved:
        note_seating(session, ttx, user, moved)
    session.commit()


def delete_rooms_for_ttx(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """After the exercises' TTXAccess rows (which point at their rooms)."""
    for room in session.exec(select(TTXRoom).where(TTXRoom.ttx_id.in_(ttx_ids))):
        session.delete(room)
