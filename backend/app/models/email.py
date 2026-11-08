import uuid
from datetime import UTC, datetime

from sqlalchemy import Index
from sqlmodel import Field, SQLModel

# The one row EmailSettings ever holds.
EMAIL_SETTINGS_ID = 1


class EmailSettings(SQLModel, table=True):
    """How the deployment sends email, as an instance administrator set it
    in Platform -> Email. Ignored while the environment pins it
    (EMAIL_TRANSPORT in Settings) -- see email_service.effective_config.
    The password is stored encrypted (core/crypto.py) and never returned
    by the API."""

    __tablename__ = "email_settings"

    id: int = Field(default=EMAIL_SETTINGS_ID, primary_key=True)
    # Email sending active. Inactive keeps the configuration (password
    # included) but the instance sends no email: messages already queued
    # wait until it's active again; new ones aren't queued (email_service.queue).
    enabled: bool = Field(default=True)
    # Only "smtp" from the web today; other transports may follow.
    transport: str = Field(default="smtp", max_length=16)
    from_address: str = Field(max_length=320)
    from_name: str | None = Field(default=None, max_length=120)
    reply_to: str | None = Field(default=None, max_length=320)
    smtp_host: str = Field(max_length=253)
    smtp_port: int = Field(default=587)
    # "starttls", "tls" or "none" (the last needs EMAIL_ALLOW_INSECURE).
    smtp_security: str = Field(default="starttls", max_length=16)
    smtp_username: str | None = Field(default=None, max_length=320)
    smtp_password_encrypted: str | None = Field(default=None, max_length=2000)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")


class EmailOutbox(SQLModel, table=True):
    """A message to send (outbox): queued in the same commit as the action
    that causes it (email_service.queue), sent by a background loop, kept
    afterwards -- without its content -- for EMAIL_RETENTION_DAYS so
    Platform shows what went out. The template's parameters are stored
    encrypted, and wiped once the message is sent or given up on."""

    __tablename__ = "email_outbox"
    __table_args__ = (Index("ix_email_outbox_status_next_attempt_at", "status", "next_attempt_at"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    # One of email_service.EmailTemplate.
    template: str = Field(max_length=64)
    locale: str = Field(max_length=8)
    to_address: str = Field(max_length=320, index=True)
    payload_encrypted: str | None = Field(default=None)
    # "pending", "sent" or "failed".
    status: str = Field(default="pending", max_length=16)
    attempts: int = Field(default=0)
    next_attempt_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    last_attempt_at: datetime | None = Field(default=None)
    sent_at: datetime | None = Field(default=None)
    last_error: str | None = Field(default=None, max_length=500)
