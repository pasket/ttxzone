import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class AssistantCall(SQLModel, table=True):
    """One call to a tool on the MCP endpoint: who, which tool, on which
    exercise, how it ended and how long it took. Never the arguments or
    the result (they hold exercise content). Counts towards the per-token
    rate limit; kept ASSISTANT_CALL_RETENTION_DAYS. Not in Platform's
    activity log, which would flood the SIEM with every call."""

    __tablename__ = "assistant_call"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    token_id: uuid.UUID = Field(foreign_key="personal_access_token.id", index=True)
    tool: str = Field(max_length=64)
    # No foreign keys on these two: the record outlives the exercise (and
    # deleting an exercise or organization needn't know about it).
    ttx_id: uuid.UUID | None = Field(default=None)
    organization_id: uuid.UUID | None = Field(default=None)
    # "ok", or the error code the call ended with.
    outcome: str = Field(max_length=64)
    duration_ms: int = Field(default=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
