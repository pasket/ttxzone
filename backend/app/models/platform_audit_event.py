import uuid
from datetime import UTC, datetime

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class PlatformAuditEvent(SQLModel, table=True):
    """One thing an instance administrator (or the server's console) did
    from Platform -- append-only, never edited or deleted. Who and what
    are kept as they read at the time (`actor_label`, `target_label`):
    deleting the organization doesn't take its history with it (no FK to
    it), and anonymizing an account (auth_service.deactivate_account)
    leaves the trail of who did what untouched."""

    __tablename__ = "platform_audit_event"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    # One of platform_audit_service.AuditAction.
    action: str = Field(max_length=48, index=True)
    # None: the server's console (scripts.instance_admin).
    actor_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    actor_label: str = Field(max_length=320)
    # "account", "organization", "instance" or "legal".
    target_kind: str = Field(max_length=16)
    target_id: uuid.UUID | None = Field(default=None)
    target_label: str | None = Field(default=None, max_length=320)
    details: dict | None = Field(default=None, sa_column=Column(JSONB, nullable=True))


# The one row PlatformAuditWebhook ever holds.
PLATFORM_AUDIT_WEBHOOK_ID = 1


class PlatformAuditWebhook(SQLModel, table=True):
    """Where Platform's activity log is forwarded as it happens -- a SIEM's
    HTTP collector. Set by an instance administrator in Platform -> Activity
    log. Each delivery is signed with the secret (HMAC-SHA256);
    `authorization` is an optional Authorization header value some
    collectors require (e.g. a token), never returned by the API. Both are
    stored encrypted (core/crypto.py)."""

    __tablename__ = "platform_audit_webhook"

    id: int = Field(default=PLATFORM_AUDIT_WEBHOOK_ID, primary_key=True)
    url: str = Field(max_length=2000)
    enabled: bool = Field(default=True)
    secret_encrypted: str = Field(max_length=500)
    authorization_encrypted: str | None = Field(default=None, max_length=2000)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    # The last delivery attempts, for Platform to show how forwarding goes.
    last_success_at: datetime | None = Field(default=None)
    last_failure_at: datetime | None = Field(default=None)
    last_status: int | None = Field(default=None)
    last_error: str | None = Field(default=None, max_length=500)


class PlatformAuditDelivery(SQLModel, table=True):
    """An event waiting to reach the webhook (outbox): queued in the same
    commit as the event while forwarding is on, deleted once the collector
    accepted it. Delivered oldest first; a failure retries the same head
    with a growing delay, so the collector receives events in order."""

    __tablename__ = "platform_audit_delivery"

    event_id: uuid.UUID = Field(foreign_key="platform_audit_event.id", primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), index=True)
    attempts: int = Field(default=0)
    next_attempt_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
