"""Platform's activity log: what instance administrators (and the server's
console) did to the deployment -- its rule, organizations, accounts,
administrators, legal documents and this log's own forwarding -- and the
authentication events of every account (auth_event_service). Append-only:
nothing here edits an event; the ones older than RETENTION_DAYS (fixed,
not configurable) are deleted once forwarded (`prune_expired`), so the log
stays fast to read. The SIEM and the server's log files (auth.log, rotated
by the host's logrotate) follow their own retention.

Each event is recorded right after the action it describes succeeded
(the services commit on their own), so a crash between the two can leave
an action unrecorded -- never a recorded action that didn't happen.

Read in Platform, downloaded (`export_csv` / `export_jsonl`) or forwarded
as it happens to a SIEM's HTTP collector (PlatformAuditWebhook): each
event is queued in the same commit (PlatformAuditDelivery) and a
background loop (`forward_forever`) POSTs the queue oldest first, signed
with HMAC-SHA256, retrying the head with a growing delay until the
collector accepts it -- at-least-once, in order."""

import asyncio
import csv
import hashlib
import hmac
import io
import json
import logging
import secrets
import time
import urllib.error
import urllib.request
import uuid
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from typing import Any, Literal
from urllib.parse import urlsplit

from sqlalchemy import Engine, delete, exists, func, or_
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import settings
from app.core.exceptions import AppException
from app.models import (
    PLATFORM_AUDIT_WEBHOOK_ID,
    PlatformAuditDelivery,
    PlatformAuditEvent,
    PlatformAuditWebhook,
    User,
)

logger = logging.getLogger(__name__)

AuditAction = Literal[
    "tenancy.update",
    "security_policy.update",
    "free_email_domain.add",
    "free_email_domain.remove",
    "free_email_domain.enable",
    "free_email_domain.disable",
    "organization.create",
    "organization.domain",
    "organization.delete",
    "program_manager.grant",
    "program_manager.revoke",
    "account.create",
    "account.suspend",
    "account.reactivate",
    "account.update",
    "account.password_reset",
    "account.totp_reset",
    "account.sessions_end",
    "account.delete",
    "instance_admin.grant",
    "instance_admin.revoke",
    "legal.publish",
    "legal.acceptances_export",
    "audit.export",
    "audit_webhook.update",
    "audit_webhook.rotate_secret",
    "audit_webhook.delete",
    "email.settings_update",
    "email.settings_delete",
    "email.test",
    "email.reconfirmation_update",
    "sso.settings_update",
    "sso.settings_delete",
    "sso.test",
    "assistant.settings_update",
    # A person deciding an AI assistant's proposal (who, which row, never the content).
    "assistant.proposal_accepted",
    "assistant.proposal_discarded",
    # Organization and exercise work done without a step-up: the signed-in
    # session and this trail are the control (who, what, never the content).
    "organization.leave",
    "organization.allowed_domain",
    "library.item_delete",
    "exercise.delete",
    "exercise.member_joined",
    "exercise.needs_approved",
    "exercise.needs_approval_recorded",
    "exercise.scenario_applied",
    "exercise.aar_final",
    "exercise.aar_reopened",
    # Authentication, of any account (auth_event_service).
    "auth.login",
    "auth.login_failed",
    "auth.login_locked",
    "auth.signup_locked",
    "auth.mfa_failed",
    "auth.mfa_locked",
    "auth.backup_code_login",
    "auth.logout",
    "auth.register",
    "auth.password_change",
    "auth.password_reset_request",
    "auth.password_reset",
    "auth.email_verify",
    "auth.totp_enable",
    "auth.totp_disable",
    "auth.backup_codes_regenerate",
    "auth.mfa_email_sent",
    "auth.mfa_email_enable",
    "auth.mfa_email_disable",
    "auth.mfa_preferred",
    "auth.mfa_skipped",
    "auth.step_up",
    "auth.step_up_failed",
    "auth.sso_link",
    "auth.sso_unlink",
    "auth.token_create",
    "auth.token_revoke",
]

TargetKind = Literal["account", "organization", "instance", "legal", "exercise"]

# Who acted, when it wasn't anyone signed in.
CONSOLE_LABEL = "console"


def record(
    session: Session,
    actor: User | None,
    action: AuditAction,
    target_kind: TargetKind,
    target_id: uuid.UUID | None = None,
    target_label: str | None = None,
    details: dict[str, Any] | None = None,
    actor_label: str | None = None,
) -> PlatformAuditEvent:
    """`actor` None: the server's console (scripts.instance_admin), unless
    `actor_label` names who it was (a sign-in attempt with no account)."""
    event = PlatformAuditEvent(
        action=action,
        actor_user_id=actor.id if actor else None,
        actor_label=(actor.email if actor else actor_label or CONSOLE_LABEL)[:320],
        target_kind=target_kind,
        target_id=target_id,
        target_label=target_label,
        details=details,
    )
    session.add(event)
    webhook = session.get(PlatformAuditWebhook, PLATFORM_AUDIT_WEBHOOK_ID)
    if webhook is not None and webhook.enabled:
        # Flush first: the queue row points at the event.
        session.flush()
        session.add(PlatformAuditDelivery(event_id=event.id, created_at=event.created_at))
    session.commit()
    return event


def record_exercise(
    session: Session,
    actor: User,
    action: AuditAction,
    ttx: Any,
    details: dict[str, Any] | None = None,
) -> PlatformAuditEvent:
    """An exercise event, named by its code and name as they read now (the
    trail outlives a deleted exercise)."""
    return record(
        session,
        actor,
        action,
        "exercise",
        ttx.id,
        f"{ttx.code} {ttx.name}"[:320],
        {"organization_id": str(ttx.organization_id), **(details or {})},
    )


SortDir = Literal["asc", "desc"]


def _filters(action: str | None, q: str | None) -> list:
    where_clause = []
    if action:
        where_clause.append(PlatformAuditEvent.action == action)
    if q:
        pattern = f"%{q}%"
        where_clause.append(
            or_(
                PlatformAuditEvent.actor_label.ilike(pattern),
                PlatformAuditEvent.target_label.ilike(pattern),
            )
        )
    return where_clause


def _ordered(sort_dir: SortDir):
    if sort_dir == "asc":
        return (PlatformAuditEvent.created_at.asc(), PlatformAuditEvent.id)
    return (PlatformAuditEvent.created_at.desc(), PlatformAuditEvent.id)


def list_events(
    session: Session,
    limit: int,
    offset: int,
    action: str | None = None,
    q: str | None = None,
    sort_dir: SortDir = "desc",
) -> tuple[list[PlatformAuditEvent], int]:
    """Newest first by default; `q` matches who acted or what was acted on."""
    where_clause = _filters(action, q)
    total = session.exec(
        select(func.count()).select_from(PlatformAuditEvent).where(*where_clause)
    ).one()
    events = list(
        session.exec(
            select(PlatformAuditEvent)
            .where(*where_clause)
            .order_by(*_ordered(sort_dir))
            .limit(limit)
            .offset(offset)
        )
    )
    return events, total


def event_payload(event: PlatformAuditEvent) -> dict[str, Any]:
    """One event as exported and forwarded: flat, ISO 8601 UTC time."""
    return {
        "id": str(event.id),
        "time": event.created_at.isoformat(),
        "action": event.action,
        "actor_id": str(event.actor_user_id) if event.actor_user_id else None,
        "actor": event.actor_label,
        "target_kind": event.target_kind,
        "target_id": str(event.target_id) if event.target_id else None,
        "target": event.target_label,
        "details": event.details,
    }


def _all_events(session: Session, action: str | None, q: str | None):
    """Oldest first, the order a log file and a SIEM expect."""
    return session.exec(
        select(PlatformAuditEvent).where(*_filters(action, q)).order_by(*_ordered("asc"))
    )


def export_jsonl(session: Session, action: str | None = None, q: str | None = None) -> str:
    """JSON Lines: one event per line, what log shippers ingest as is."""
    return "".join(
        json.dumps(event_payload(event), ensure_ascii=False) + "\n"
        for event in _all_events(session, action, q)
    )


_CSV_COLUMNS = ["time", "action", "actor", "actor_id", "target_kind", "target", "target_id"]


def export_csv(session: Session, action: str | None = None, q: str | None = None) -> str:
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([*_CSV_COLUMNS, "details"])
    for event in _all_events(session, action, q):
        payload = event_payload(event)
        writer.writerow(
            [
                *(_csv_safe(payload[column]) for column in _CSV_COLUMNS),
                _csv_safe(json.dumps(payload["details"], ensure_ascii=False))
                if payload["details"]
                else "",
            ]
        )
    return buffer.getvalue()


def _csv_safe(value: Any) -> str:
    """No formula injection when the file is opened in a spreadsheet: a
    cell starting with = + - @ is read as text (an email or a name can)."""
    text = "" if value is None else str(value)
    return f"'{text}" if text[:1] in ("=", "+", "-", "@", "\t", "\r") else text


# --- Forwarding to a SIEM -------------------------------------------------

DELIVERY_BATCH = 100
DELIVERY_TIMEOUT_SECONDS = 10
_MAX_RETRY_DELAY = timedelta(hours=1)
USER_AGENT = "TTX-Zone-Audit/1"


def get_webhook(session: Session) -> PlatformAuditWebhook | None:
    return session.get(PlatformAuditWebhook, PLATFORM_AUDIT_WEBHOOK_ID)


def pending_count(session: Session) -> int:
    return session.exec(select(func.count()).select_from(PlatformAuditDelivery)).one()


def validate_webhook_url(url: str) -> str:
    """http(s) only, a host, no credentials in the URL (they'd show in
    Platform and in logs: use the Authorization header instead). Plain
    http only where the deployment allows it (AUDIT_WEBHOOK_ALLOW_HTTP)."""
    url = url.strip()
    parts = urlsplit(url)
    allowed = {"https", "http"} if settings.AUDIT_WEBHOOK_ALLOW_HTTP else {"https"}
    if parts.scheme not in allowed or not parts.hostname or parts.username or parts.password:
        raise AppException(
            "AUDIT_WEBHOOK_URL_INVALID",
            "Use an https:// URL with a host and no credentials in it."
            if not settings.AUDIT_WEBHOOK_ALLOW_HTTP
            else "Use an http(s):// URL with a host and no credentials in it.",
            422,
            log_level=logging.WARNING,
        )
    return url


def save_webhook(
    session: Session,
    actor: User,
    url: str,
    enabled: bool,
    authorization: str | None,
    clear_authorization: bool,
) -> PlatformAuditWebhook:
    """Creates it (with a new secret) or updates it. `authorization` None
    keeps the stored header, unless `clear_authorization`. Turning
    forwarding off stops queueing; what is already queued waits for it to
    be turned on again."""
    url = validate_webhook_url(url)
    webhook = get_webhook(session)
    created = webhook is None
    if webhook is None:
        webhook = PlatformAuditWebhook(
            url=url, secret_encrypted=crypto.encrypt_secret(secrets.token_urlsafe(32))
        )
    webhook.url = url
    webhook.enabled = enabled
    if clear_authorization:
        webhook.authorization_encrypted = None
    elif authorization:
        webhook.authorization_encrypted = crypto.encrypt_secret(authorization.strip())
    webhook.updated_at = datetime.now(UTC)
    webhook.updated_by_user_id = actor.id
    session.add(webhook)
    session.commit()
    record(
        session,
        actor,
        "audit_webhook.update",
        "instance",
        details={"url": url, "enabled": enabled, "created": created},
    )
    return webhook


def rotate_webhook_secret(session: Session, actor: User) -> PlatformAuditWebhook:
    webhook = _require_webhook(session)
    webhook.secret_encrypted = crypto.encrypt_secret(secrets.token_urlsafe(32))
    webhook.updated_at = datetime.now(UTC)
    webhook.updated_by_user_id = actor.id
    session.add(webhook)
    session.commit()
    record(session, actor, "audit_webhook.rotate_secret", "instance")
    return webhook


def delete_webhook(session: Session, actor: User) -> None:
    """Forwarding stops and the queue is dropped (the log itself stays)."""
    webhook = _require_webhook(session)
    url = webhook.url
    session.exec(delete(PlatformAuditDelivery))
    session.delete(webhook)
    session.commit()
    record(session, actor, "audit_webhook.delete", "instance", details={"url": url})


def _require_webhook(session: Session) -> PlatformAuditWebhook:
    webhook = get_webhook(session)
    if webhook is None:
        raise AppException(
            "AUDIT_WEBHOOK_NOT_CONFIGURED",
            "No webhook is set up.",
            404,
            log_level=logging.WARNING,
        )
    return webhook


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A collector answers itself: a redirect could point the events (and
    the Authorization header) anywhere."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # type: ignore[no-untyped-def]
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def sign(secret: str, timestamp: str, body: bytes) -> str:
    """What the collector recomputes to trust a delivery: HMAC-SHA256 of
    "<timestamp>.<body>" with the shared secret, hex."""
    return hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256).hexdigest()


def readable_secret(webhook: PlatformAuditWebhook) -> str | None:
    """The signing secret, or None when no configured key decrypts it."""
    try:
        return crypto.decrypt_secret(webhook.secret_encrypted)
    except crypto.SecretUnreadableError:
        return None


def post_events(webhook: PlatformAuditWebhook, events: list[dict[str, Any]]) -> int:
    """POST one batch; returns the HTTP status (raises on network errors,
    and SecretUnreadableError when a stored secret can't be decrypted).
    The body is {"source": "ttx-zone", "events": [...]}."""
    secret = crypto.decrypt_secret(webhook.secret_encrypted)
    body = json.dumps({"source": "ttx-zone", "events": events}, ensure_ascii=False).encode()
    timestamp = str(int(time.time()))
    headers = {
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-TTX-Zone-Timestamp": timestamp,
        "X-TTX-Zone-Signature": f"sha256={sign(secret, timestamp, body)}",
    }
    if webhook.authorization_encrypted:
        headers["Authorization"] = crypto.decrypt_secret(webhook.authorization_encrypted)
    request = urllib.request.Request(webhook.url, data=body, headers=headers, method="POST")
    # The scheme is checked when the URL is saved (validate_webhook_url):
    # http(s) only, never file:// or the like.
    try:
        with _opener.open(request, timeout=DELIVERY_TIMEOUT_SECONDS) as response:  # nosec B310
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code


def _outcome(webhook: PlatformAuditWebhook, status: int | None, error: str | None) -> None:
    now = datetime.now(UTC)
    webhook.last_status = status
    if error is None:
        webhook.last_success_at = now
        webhook.last_error = None
    else:
        webhook.last_failure_at = now
        webhook.last_error = error[:500]


def send_test(session: Session, actor: User) -> tuple[int | None, str | None]:
    """One synthetic event, now, outside the queue (not logged): whether
    the collector takes it."""
    webhook = _require_webhook(session)
    event = {
        "id": str(uuid.uuid4()),
        "time": datetime.now(UTC).isoformat(),
        "action": "audit_webhook.test",
        "actor_id": str(actor.id),
        "actor": actor.email,
        "target_kind": "instance",
        "target_id": None,
        "target": None,
        "details": None,
    }
    status, error = _deliver(webhook, [event])
    _outcome(webhook, status, error)
    session.add(webhook)
    session.commit()
    return status, error


def _deliver(
    webhook: PlatformAuditWebhook, events: list[dict[str, Any]]
) -> tuple[int | None, str | None]:
    try:
        status = post_events(webhook, events)
    except crypto.SecretUnreadableError:
        return None, (
            "The signing secret or Authorization header can't be decrypted "
            "(DATA_ENCRYPTION_KEY changed?): generate a new secret and enter the header again."
        )
    except (OSError, ValueError) as exc:
        return None, f"{type(exc).__name__}: {exc}"
    if 200 <= status < 300:
        return status, None
    return status, f"HTTP {status}"


def deliver_pending(session: Session) -> int:
    """Sends what's due, oldest first, in batches; stops at the first
    failure (the head is retried later, so order holds). Several backend
    processes can run it at once: the queue rows are locked SKIP LOCKED.
    Returns how many events were delivered."""
    webhook = get_webhook(session)
    if webhook is None or not webhook.enabled:
        return 0
    delivered = 0
    while True:
        now = datetime.now(UTC)
        rows = list(
            session.exec(
                select(PlatformAuditDelivery, PlatformAuditEvent)
                .join(PlatformAuditEvent, PlatformAuditEvent.id == PlatformAuditDelivery.event_id)
                .order_by(PlatformAuditDelivery.created_at, PlatformAuditDelivery.event_id)
                .limit(DELIVERY_BATCH)
                .with_for_update(skip_locked=True, of=PlatformAuditDelivery)
            )
        )
        if not rows:
            session.commit()
            return delivered
        head = rows[0][0]
        if head.next_attempt_at > now:
            session.commit()
            return delivered
        status, error = _deliver(webhook, [event_payload(event) for _, event in rows])
        _outcome(webhook, status, error)
        session.add(webhook)
        if error is not None:
            head.attempts += 1
            head.next_attempt_at = now + min(
                timedelta(seconds=10 * 2 ** min(head.attempts, 12)), _MAX_RETRY_DELAY
            )
            session.add(head)
            session.commit()
            logger.warning("Audit webhook delivery failed (%s); retrying later.", error)
            return delivered
        session.exec(
            delete(PlatformAuditDelivery).where(
                PlatformAuditDelivery.event_id.in_([row.event_id for row, _ in rows])
            )
        )
        session.commit()
        delivered += len(rows)


# How long the log keeps its events, in days. Fixed: no setting changes it.
RETENTION_DAYS = 90
PRUNE_BATCH = 5000
PRUNE_INTERVAL = timedelta(hours=1)


def prune_expired(session: Session, now: datetime | None = None) -> int:
    """Delete the events older than the retention period, except any still
    queued for the SIEM (it gets every event). In batches, so no statement
    holds the table for long. Returns how many went."""
    cutoff = (now or datetime.now(UTC)) - timedelta(days=RETENTION_DAYS)
    queued = exists().where(PlatformAuditDelivery.event_id == PlatformAuditEvent.id)
    pruned = 0
    while True:
        ids = list(
            session.exec(
                select(PlatformAuditEvent.id)
                .where(PlatformAuditEvent.created_at < cutoff, ~queued)
                .limit(PRUNE_BATCH)
            )
        )
        if not ids:
            break
        session.exec(delete(PlatformAuditEvent).where(PlatformAuditEvent.id.in_(ids)))
        session.commit()
        pruned += len(ids)
    if pruned:
        logger.info("Activity log: %s events past the retention period deleted.", pruned)
    return pruned


# The Postgres advisory lock a forwarding round holds: one process at a
# time forwards (events go out in order) and prunes, however many workers
# a deployment runs. An arbitrary constant, unique in this application.
FORWARDER_LOCK_KEY = 7_420_017_301


def run_exclusively(engine: Engine, round_: Callable[[], None]) -> bool:
    """Runs `round_` while holding FORWARDER_LOCK_KEY, on a connection of
    its own; returns False, running nothing, when another process holds
    it."""
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as lock:
        if not lock.execute(select(func.pg_try_advisory_lock(FORWARDER_LOCK_KEY))).scalar():
            return False
        try:
            round_()
        finally:
            lock.execute(select(func.pg_advisory_unlock(FORWARDER_LOCK_KEY)))
    return True


async def forward_forever() -> None:
    """The background loop (app lifespan): every AUDIT_WEBHOOK_POLL_SECONDS,
    in a worker thread (urllib blocks), forwards what's queued; once every
    PRUNE_INTERVAL it also prunes the log, webhook or not."""
    from app.core.db import engine

    last_pruned: datetime | None = None

    def run_once() -> None:
        run_exclusively(engine, forward_and_prune)

    def forward_and_prune() -> None:
        nonlocal last_pruned
        with Session(engine) as session:
            deliver_pending(session)
            now = datetime.now(UTC)
            if last_pruned is None or now - last_pruned >= PRUNE_INTERVAL:
                prune_expired(session, now)
                from app.services.assistant import calls as assistant_calls

                assistant_calls.prune_expired(session, now)
                from app.services.assistant import proposals as assistant_proposals

                assistant_proposals.prune_expired(session, now)
                from app.services import login_throttle_service

                login_throttle_service.prune_expired(session, now)
                last_pruned = now

    while True:
        await asyncio.sleep(settings.AUDIT_WEBHOOK_POLL_SECONDS)
        try:
            await asyncio.to_thread(run_once)
        except Exception:  # noqa: BLE001 -- the loop must outlive any one failure
            logger.exception("Activity log loop failed; trying again next round.")
