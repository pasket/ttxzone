import uuid
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("A room needs a name.")
    return value


class RoomRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    description: str
    player_count: int


class RoomPlayerRead(BaseModel):
    user_id: uuid.UUID
    # Output: read back as stored (a deleted account's placeholder too).
    email: str
    full_name: str
    last_login_at: datetime | None = None
    joined_at: datetime
    room_id: uuid.UUID | None = None


class RoomTeamMemberRead(BaseModel):
    """A team member who follows the session, and the room their view of it
    opens on (null: the main room). They can still look at any room."""

    user_id: uuid.UUID
    email: str
    full_name: str
    # What they follow it as: controller, facilitator, evaluator, observer.
    roles: list[str]
    room_id: uuid.UUID | None = None


class RoomsRead(BaseModel):
    """Creator -> Exercise -> Rooms: whether the exercise uses rooms, its
    rooms and its Players with their seat."""

    uses_rooms: bool
    # The MSEL is READY or the session has started: rooms can't be added,
    # removed or turned off (renaming them and seating Players still can).
    structure_locked: bool
    rooms: list[RoomRead]
    players: list[RoomPlayerRead]
    team: list[RoomTeamMemberRead] = []


class RoomsSettingsRequest(BaseModel):
    uses_rooms: bool


class RoomCreateRequest(BaseModel):
    name: str = Field(max_length=60)
    description: str = Field(default="", max_length=500)

    _name = field_validator("name")(_clean_name)


class RoomUpdateRequest(BaseModel):
    name: str | None = Field(default=None, max_length=60)
    description: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def _name(cls, value: str | None) -> str | None:
        return None if value is None else _clean_name(value)


class RoomAssignment(BaseModel):
    user_id: uuid.UUID
    # Null: no room (the main room only).
    room_id: uuid.UUID | None = None


class RoomAssignmentsRequest(BaseModel):
    assignments: list[RoomAssignment] = Field(min_length=1, max_length=500)
