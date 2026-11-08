import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlmodel import Field, SQLModel

from app.models.ttx_access import RoleEnum


class AccessRequestStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class TTXAccessRequest(SQLModel, table=True):
    """Pending join request created when a user redeems an InvitationToken.
    Redemption doesn't grant TTXAccess directly -- the TTX's Planner
    must approve it first (approve creates the real TTXAccess row; reject
    does not). Rows are never deleted, only transitioned: a decided request
    stays as an audit trail, same soft-state pattern as
    InvitationToken.revoked_at.
    """

    __tablename__ = "ttx_access_request"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    role: RoleEnum
    invitation_token_id: uuid.UUID = Field(foreign_key="invitation_token.id")
    status: AccessRequestStatus = Field(default=AccessRequestStatus.PENDING)
    decided_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    decided_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
