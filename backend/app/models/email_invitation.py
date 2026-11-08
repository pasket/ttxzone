import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class EmailInvitation(SQLModel, table=True):
    """A personal invitation to be a Player of one exercise, sent by email
    to one address (email_invitation_service). Unlike an InvitationToken
    (a shared join code whose redemptions wait for a Planner's approval),
    the link proves its holder reads that mailbox, so accepting it grants
    the access at once -- to the account with that address only.

    Only the link's SHA-256 is kept. One live invitation per exercise and
    address: sending again replaces the link and its expiry."""

    __tablename__ = "email_invitation"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    # Lower-case; the account that accepts must have exactly this address.
    email: str = Field(max_length=255, index=True)
    token_hash: str = Field(unique=True, max_length=64)
    invited_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # The latest send (the first, or a resend with a new link).
    sent_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime
    accepted_at: datetime | None = Field(default=None)
    accepted_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    revoked_at: datetime | None = Field(default=None)
