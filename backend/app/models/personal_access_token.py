import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class PersonalAccessToken(SQLModel, table=True):
    """A token an account creates in Preferences -> AI assistant so an AI
    client (Claude Desktop through an MCP bridge) acts as that account on
    the MCP endpoint, and nowhere else (services/assistant/tokens.py).
    Shown once; only its SHA-256 is kept. It expires, can be revoked, and
    records which version of the responsible-use notice its owner
    acknowledged when creating it."""

    __tablename__ = "personal_access_token"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    name: str = Field(max_length=80)
    # The token's first characters ("ttxz_" + a few), so the owner can tell
    # tokens apart without the secret.
    prefix: str = Field(max_length=16)
    token_hash: str = Field(unique=True, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime
    last_used_at: datetime | None = Field(default=None)
    revoked_at: datetime | None = Field(default=None)
    # Copied from the session that created it: "provider" when the single
    # sign-on provider did the second factor (UserSession.mfa_source), so
    # the token meets the same second-factor mandate that session did.
    mfa_source: str | None = Field(default=None, max_length=16)
    disclaimer_version: str = Field(max_length=16)
    acknowledged_at: datetime
