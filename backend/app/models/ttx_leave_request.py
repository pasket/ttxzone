import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

from app.models.ttx_access_request import AccessRequestStatus


class TTXLeaveRequest(SQLModel, table=True):
    """A Player asking to leave an exercise. A Player can't leave on their
    own: the exercise's Planners decide (approve removes the Player's
    TTXAccess row, reject keeps it). Like TTXAccessRequest, rows are never
    deleted while the exercise lives, only transitioned -- a decided request
    stays as an audit trail."""

    __tablename__ = "ttx_leave_request"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    # Optional, the Player's own words for the Planners.
    reason: str = Field(default="", max_length=500)
    status: AccessRequestStatus = Field(default=AccessRequestStatus.PENDING)
    decided_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    decided_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
