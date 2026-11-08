import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class UserSession(SQLModel, table=True):
    """One signed-in browser. The access JWT only carries this row's id
    (`sid`), so every request checks it here: revoked, idle for longer than
    `idle_timeout_minutes` (soft timeout) or past `absolute_expires_at`
    (hard timeout) means the session is over. `authenticated_at` is the
    last time the user proved who they are on it (the login itself, or a
    step-up with TOTP/password or the single sign-on provider) -- what
    sensitive actions check for.
    """

    __tablename__ = "user_session"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    authenticated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    idle_timeout_minutes: int
    absolute_expires_at: datetime
    revoked_at: datetime | None = Field(default=None)
    user_agent: str | None = Field(default=None, max_length=255)
    ip_address: str | None = Field(default=None, max_length=45)
    # "provider": the single sign-on provider asked for a second factor at
    # sign-in (amr), which stands in for the account's own TOTP on this
    # session's mandatory-TOTP checks (security.mfa_satisfied).
    mfa_source: str | None = Field(default=None, max_length=16)
    # The face it was opened on (app.core.surface): "internal", or "public"
    # (api-public). A session works only on its own face.
    surface: str = Field(
        default="internal", max_length=16, sa_column_kwargs={"server_default": "internal"}
    )
