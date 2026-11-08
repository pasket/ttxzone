from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


class LoginThrottle(SQLModel, table=True):
    """Failed password sign-ins of one key (login_throttle_service): an
    account, an address, or the two together. In the database because every
    API process has to see the same count. Keyed by a hash, whether or not
    an account has that email, so the table holds no addresses and a lock
    says nothing about who has an account."""

    __tablename__ = "login_throttle"

    key: str = Field(primary_key=True, max_length=64)
    failures: int = Field(default=0)
    window_started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    locked_until: datetime | None = Field(default=None)
