import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models import AccessRequestStatus


class PlayerRoomRead(BaseModel):
    code: str
    name: str


class PlayerInvitationRead(BaseModel):
    id: uuid.UUID
    description: str | None = None


class TTXPlayerRead(BaseModel):
    user_id: uuid.UUID
    # Output: read back as stored (a deleted account's placeholder too).
    email: str
    full_name: str
    last_login_at: datetime | None = None
    joined_at: datetime
    # Only while the exercise is played in rooms; null = no room yet.
    room: PlayerRoomRead | None = None
    # The invitation whose request was approved; null for a Player added
    # another way (a scenario, a fixture).
    invitation: PlayerInvitationRead | None = None
    # Joined through a personal invitation sent by email (no request).
    invited_by_email: bool = False


class TTXPlayersRead(BaseModel):
    """Creator -> Invitations -> Players: who has joined the exercise."""

    uses_rooms: bool
    items: list[TTXPlayerRead]


class LeaveRequestCreate(BaseModel):
    reason: str = Field(default="", max_length=500)


class TTXLeaveRequestRead(BaseModel):
    """A Planner's view of a Player asking to leave."""

    id: uuid.UUID
    ttx_id: uuid.UUID
    user_id: uuid.UUID
    # Output: read back as stored (a deleted account's placeholder too).
    email: str
    full_name: str
    reason: str
    status: AccessRequestStatus
    created_at: datetime


class MyLeaveRequestRead(BaseModel):
    """A Player's own pending request to leave an exercise."""

    id: uuid.UUID
    ttx_id: uuid.UUID
    ttx_name: str
    organization_name: str
    reason: str
    created_at: datetime
