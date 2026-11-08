import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

SmtpSecurityField = Literal["starttls", "tls", "none"]


class EmailSettingsRead(BaseModel):
    """Platform -> Email. Never carries a secret: `has_password` says
    whether one is stored, `password_readable` whether the current key
    still decrypts it."""

    # Whether the deployment sends email right now (email_service.is_enabled).
    active: bool
    # Set in the server's configuration (EMAIL_TRANSPORT): read-only here.
    pinned_by_env: bool
    # Plain text, unverified certificates and other ports accepted.
    allow_insecure: bool
    # Whether a configuration exists (from the server or the web).
    configured: bool
    enabled: bool = False
    transport: str | None = None
    from_address: str | None = None
    from_name: str | None = None
    reply_to: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_security: SmtpSecurityField | None = None
    smtp_username: str | None = None
    has_password: bool = False
    password_readable: bool = True
    updated_at: datetime | None = None
    # The outbox.
    pending: int = 0
    failed: int = 0
    last_sent_at: datetime | None = None
    last_failed_at: datetime | None = None
    last_error: str | None = None


class EmailSettingsUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = True
    from_address: str = Field(min_length=3, max_length=320)
    from_name: str | None = Field(default=None, max_length=120)
    reply_to: str | None = Field(default=None, max_length=320)
    smtp_host: str = Field(min_length=1, max_length=253)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_security: SmtpSecurityField = "starttls"
    smtp_username: str | None = Field(default=None, max_length=320)
    # None keeps the stored password; "" removes it.
    smtp_password: str | None = Field(default=None, max_length=1000)


class EmailTestRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # None: the administrator's own address.
    to: str | None = Field(default=None, max_length=320)


class EmailTestRead(BaseModel):
    ok: bool
    to: str
    error: str | None


class EmailOutboxRead(BaseModel):
    """A queued or sent message, without its content."""

    id: uuid.UUID
    created_at: datetime
    template: str
    locale: str
    to_address: str
    status: str
    attempts: int
    next_attempt_at: datetime
    last_attempt_at: datetime | None
    sent_at: datetime | None
    last_error: str | None


class EmailOutboxListResponse(BaseModel):
    items: list[EmailOutboxRead]
    total: int
    limit: int
    offset: int
    # How long a message stays listed (email_service.EMAIL_RETENTION_DAYS).
    retention_days: int


class EmailReconfirmationRead(BaseModel):
    """Platform -> Email -> Periodic reconfirmation: after how many days
    every account confirms its address again (None: never)."""

    days: int | None
    pinned_by_env: bool
    # The grace period an account asked gets before it's held.
    grace_days: int


class EmailReconfirmationUpdateRequest(BaseModel):
    # From a month to two years; None turns it off.
    days: int | None = Field(default=None, ge=30, le=730)
