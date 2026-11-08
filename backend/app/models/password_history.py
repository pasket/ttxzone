import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class PasswordHistory(SQLModel, table=True):
    """An account's previous password hashes, kept only while the
    deployment refuses reusing them (InstanceSettings.password_history_count)
    and pruned to that many by security_policy_service.set_password."""

    __tablename__ = "password_history"

    id: int | None = Field(default=None, primary_key=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
