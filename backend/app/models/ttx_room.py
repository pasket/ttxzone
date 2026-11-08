import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class TTXRoom(SQLModel, table=True):
    """A room of an exercise played by several teams at once (`TTX.uses_rooms`):
    its Players sit in it and get the injects aimed at it. The main room, where
    the Controller projects an inject for everyone, is implicit -- never a row.
    `code` is RM-NN, from `TTX.next_room_number` (never reused)."""

    __tablename__ = "ttx_room"
    # Names are unique per exercise ignoring case (ttx_room_service).
    __table_args__ = (UniqueConstraint("ttx_id", "code"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    code: str = Field(max_length=16)
    name: str = Field(max_length=60)
    description: str = Field(default="", max_length=500)
    position: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
