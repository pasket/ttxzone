import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class AccountToken(SQLModel, table=True):
    """A one-time link sent by email (account_email_service): resetting a
    forgotten password, or confirming the address an account signed up
    with. Only its SHA-256 is kept -- the link itself lives in the
    recipient's mailbox and, encrypted until sent, in the outbox. One live
    link per account and purpose: a new one withdraws the previous."""

    __tablename__ = "account_token"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    # "password_reset" or "email_verification".
    purpose: str = Field(max_length=32)
    token_hash: str = Field(unique=True, max_length=64)
    # The address the link went to: it only works while the account still
    # has that address.
    email: str = Field(max_length=255)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime
    used_at: datetime | None = Field(default=None)
