"""Creator -> Exercise -> Rooms: whether the exercise is played in several
rooms, which ones, and where each Player sits. Planner-only (design): reads
and writes alike. See ttx_room_service."""

import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import RequiresOrgAndTTXAccess, get_current_user, verify_csrf
from app.models import TTX, RoleEnum, User
from app.schemas.ttx_room import (
    RoomAssignmentsRequest,
    RoomCreateRequest,
    RoomsRead,
    RoomsSettingsRequest,
    RoomUpdateRequest,
)
from app.services.ttx_room_service import (
    create_room,
    delete_room,
    rooms_view,
    set_assignments,
    set_uses_rooms,
    update_room,
)

router = APIRouter(prefix="/ttx", tags=["ttx-rooms"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/{ttx_id}/rooms", response_model=RoomsRead)
def get_rooms_endpoint(
    ttx: TTX = Depends(_planner), session: Session = Depends(get_session)
) -> RoomsRead:
    """The exercise's rooms and who sits in each."""
    return rooms_view(session, ttx)


@router.put(
    "/{ttx_id}/rooms/settings", response_model=RoomsRead, dependencies=[Depends(verify_csrf)]
)
def set_rooms_settings_endpoint(
    payload: RoomsSettingsRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> RoomsRead:
    """Turn rooms on or off for the exercise."""
    set_uses_rooms(session, ttx, payload.uses_rooms)
    return rooms_view(session, ttx)


@router.post(
    "/{ttx_id}/rooms",
    response_model=RoomsRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_room_endpoint(
    payload: RoomCreateRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> RoomsRead:
    """Add a room."""
    create_room(session, ttx, payload.name, payload.description)
    return rooms_view(session, ttx)


@router.put(
    "/{ttx_id}/rooms/assignments", response_model=RoomsRead, dependencies=[Depends(verify_csrf)]
)
def set_room_assignments_endpoint(
    payload: RoomAssignmentsRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RoomsRead:
    """Set which room each Player sits in."""
    set_assignments(session, ttx, payload.assignments, user)
    return rooms_view(session, ttx)


@router.patch(
    "/{ttx_id}/rooms/{room_id}", response_model=RoomsRead, dependencies=[Depends(verify_csrf)]
)
def update_room_endpoint(
    room_id: uuid.UUID,
    payload: RoomUpdateRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> RoomsRead:
    """Change a room."""
    update_room(session, ttx, room_id, payload.name, payload.description)
    return rooms_view(session, ttx)


@router.delete(
    "/{ttx_id}/rooms/{room_id}", response_model=RoomsRead, dependencies=[Depends(verify_csrf)]
)
def delete_room_endpoint(
    room_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> RoomsRead:
    """Delete a room."""
    delete_room(session, ttx, room_id)
    return rooms_view(session, ttx)
