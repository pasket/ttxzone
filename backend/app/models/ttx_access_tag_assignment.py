import uuid
from datetime import UTC, datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class TTXAccessTagAssignment(SQLModel, table=True):
    """One TTXTag applied to one exercise planning team member (a TTXAccess row with
    the Planner/Planner role) -- same shape as TTXTagAssignment.
    ttx_access.id is an int PK, so ttx_access_id is int to match its FK."""

    __tablename__ = "ttx_access_tag_assignment"
    __table_args__ = (UniqueConstraint("ttx_tag_id", "ttx_access_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_tag_id: uuid.UUID = Field(foreign_key="ttx_tag.id", index=True)
    ttx_access_id: int = Field(foreign_key="ttx_access.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
