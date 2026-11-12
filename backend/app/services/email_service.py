"""Outgoing email (docs/architecture/email.md).

Where the configuration comes from: the environment (Settings.EMAIL_TRANSPORT
and the SMTP_* values) pins it; otherwise an instance administrator sets it
in Platform -> Email (EmailSettings, the password encrypted); with neither,
the deployment sends no email and `is_enabled` says so -- features that
need it hide themselves. Every configuration needs DATA_ENCRYPTION_KEY.

How a message leaves: a feature calls `queue` inside its own transaction,
so the message exists if and only if the action committed (outbox); a
background loop (`deliver_forever`) renders and sends what's due, one
message at a time, retrying with a growing delay what failed for a reason
that may pass -- at-least-once. Nothing is ever sent from inside a request
except Platform's test message. A message's content (its parameters,
which will carry one-time links) is stored encrypted and wiped once it's
sent or given up on; the row stays EMAIL_RETENTION_DAYS so Platform shows
what went out.
"""

import asyncio
import json
import logging
import re
import threading
from contextlib import suppress
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from email.headerregistry import Address
from email.message import EmailMessage
from email.policy import SMTP
from email.utils import format_datetime, make_msgid
from pathlib import Path
from typing import Any, Literal

import psycopg
from email_validator import EmailNotValidError, validate_email
from jinja2 import FileSystemLoader, StrictUndefined, TemplateError, select_autoescape
from jinja2.sandbox import SandboxedEnvironment
from sqlalchemy import delete, func, text
from sqlmodel import Session, col, select

from app.core import crypto
from app.core.config import SMTP_STANDARD_PORTS, settings
from app.core.exceptions import AppException
from app.models import EMAIL_SETTINGS_ID, EmailOutbox, EmailSettings, PlatformAuditEvent, User
from app.services import platform_audit_service
from app.services.email_transports import (
    ConsoleTransport,
    EmailDeliveryError,
    EmailTransport,
    PermanentEmailError,
    SmtpConfig,
    SmtpSecurity,
    SmtpTransport,
)

logger = logging.getLogger(__name__)

PRODUCT_NAME = "TTX-Zone"

# The messages the deployment knows how to write, each a set of files in
# app/data/email/<locale>/: <name>.subject.txt, <name>.txt, <name>.html.
EmailTemplate = Literal[
    "test",
    "password_reset",
    "password_reset_sso",
    "email_verification",
    "mfa_code",
    "email_invitation",
    "email_reconfirmation",
    "role_invitation",
]
TEMPLATES: frozenset[str] = frozenset(
    {
        "test",
        "password_reset",
        "password_reset_sso",
        "email_verification",
        "mfa_code",
        "email_invitation",
        "email_reconfirmation",
        "role_invitation",
    }
)

TransportName = Literal["smtp", "console"]
OutboxStatus = Literal["pending", "sent", "failed"]

# A sent or failed message stays listed (without its content) this long.
EMAIL_RETENTION_DAYS = 30
PRUNE_INTERVAL = timedelta(hours=1)
_MAX_RETRY_DELAY = timedelta(hours=1)
# Platform's test message, per administrator per minute.
TEST_SENDS_PER_MINUTE = 5

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "data" / "email"
# The layout's logo travels inside each message (multipart/related), so no
# client has to fetch a remote image to show it.
_LOGO_CID = "logo@ttx-zone"
_LOGO_PNG = (_TEMPLATE_DIR / "logo.png").read_bytes()
# Sandboxed: a template can't reach Python internals, so templates may one
# day be edited from the web. HTML escapes every value; plain text and the
# subject don't (they're never parsed as markup).
_templates = SandboxedEnvironment(
    loader=FileSystemLoader(_TEMPLATE_DIR),
    autoescape=select_autoescape(enabled_extensions=("html",), default_for_string=False),
    undefined=StrictUndefined,
    keep_trailing_newline=False,
)

# A host name or an IP address: no scheme, path, port or spaces.
_HOST_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.\-]{0,251}[A-Za-z0-9])?$|^[0-9A-Fa-f:.]+$")


@dataclass(frozen=True)
class EmailConfig:
    transport: TransportName
    from_address: str
    from_name: str | None
    reply_to: str | None
    smtp: SmtpConfig | None
    # Set from the deployment's environment: the web can't change it.
    pinned_by_env: bool


# --- Configuration -------------------------------------------------------


def pinned_by_env() -> bool:
    return settings.EMAIL_TRANSPORT is not None


def get_settings_row(session: Session) -> EmailSettings | None:
    return session.get(EmailSettings, EMAIL_SETTINGS_ID)


def _env_config() -> EmailConfig:
    smtp = None
    if settings.EMAIL_TRANSPORT == "smtp":
        smtp = SmtpConfig(
            host=settings.SMTP_HOST or "",
            port=settings.SMTP_PORT,
            security=settings.SMTP_SECURITY,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD.get_secret_value() if settings.SMTP_PASSWORD else None,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
            allow_insecure=settings.EMAIL_ALLOW_INSECURE,
        )
    return EmailConfig(
        transport=settings.EMAIL_TRANSPORT or "console",
        from_address=settings.EMAIL_FROM_ADDRESS or "",
        from_name=settings.EMAIL_FROM_NAME,
        reply_to=settings.EMAIL_REPLY_TO,
        smtp=smtp,
        pinned_by_env=True,
    )


def stored_password_readable(row: EmailSettings) -> bool:
    if row.smtp_password_encrypted is None:
        return True
    try:
        crypto.decrypt_secret(row.smtp_password_encrypted)
    except crypto.SecretUnreadableError:
        return False
    return True


def effective_config(session: Session) -> EmailConfig | None:
    """None: the deployment sends no email (nothing set, turned off, or a
    stored password no key decrypts)."""
    if pinned_by_env():
        return _env_config()
    row = get_settings_row(session)
    if row is None or not row.enabled:
        return None
    password = None
    if row.smtp_password_encrypted is not None:
        try:
            password = crypto.decrypt_secret(row.smtp_password_encrypted)
        except crypto.SecretUnreadableError:
            logger.error(
                "Email: the stored SMTP password can't be decrypted (DATA_ENCRYPTION_KEY "
                "changed?); no email is sent until it's entered again in Platform."
            )
            return None
    return EmailConfig(
        transport="smtp",
        from_address=row.from_address,
        from_name=row.from_name,
        reply_to=row.reply_to,
        smtp=SmtpConfig(
            host=row.smtp_host,
            port=row.smtp_port,
            security=row.smtp_security,  # type: ignore[arg-type]
            username=row.smtp_username,
            password=password,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
            allow_insecure=settings.EMAIL_ALLOW_INSECURE,
        ),
        pinned_by_env=False,
    )


def is_enabled(session: Session) -> bool:
    """Whether features that send email may offer themselves."""
    return effective_config(session) is not None


def transport_for(config: EmailConfig) -> EmailTransport:
    if config.transport == "smtp" and config.smtp is not None:
        return SmtpTransport(config.smtp)
    return ConsoleTransport()


def _invalid(code: str, message: str, params: dict[str, Any] | None = None) -> AppException:
    return AppException(code, message, 422, log_level=logging.WARNING, params=params)


def normalize_address(address: str, code: str = "EMAIL_ADDRESS_INVALID") -> str:
    """One address, syntax checked (no DNS lookup), as the server will
    receive it. Refuses display names, lists and line breaks."""
    try:
        return validate_email(address.strip(), check_deliverability=False).normalized
    except EmailNotValidError as exc:
        raise _invalid(code, "That isn't a valid email address.") from exc


def _require_web_editable() -> None:
    if pinned_by_env():
        raise AppException(
            "EMAIL_PINNED_BY_ENV",
            "Email is set in the server's configuration and can't be changed here.",
            409,
            log_level=logging.WARNING,
        )


def _validate_server(host: str, port: int, security: str) -> str:
    host = host.strip()
    if not _HOST_RE.match(host):
        raise _invalid(
            "EMAIL_SMTP_HOST_INVALID", "Enter the server's host name, without a scheme or port."
        )
    if not settings.EMAIL_ALLOW_INSECURE:
        if security == "none":
            raise _invalid(
                "EMAIL_SMTP_INSECURE_NOT_ALLOWED",
                "This deployment requires an encrypted connection to the mail server.",
            )
        if port not in SMTP_STANDARD_PORTS:
            raise _invalid(
                "EMAIL_SMTP_PORT_NOT_ALLOWED",
                "Use port 25, 465, 587 or 2525.",
            )
    return host


def save_settings(
    session: Session,
    actor: User,
    *,
    enabled: bool,
    from_address: str,
    from_name: str | None,
    reply_to: str | None,
    smtp_host: str,
    smtp_port: int,
    smtp_security: SmtpSecurity,
    smtp_username: str | None,
    smtp_password: str | None,
) -> EmailSettings:
    """Creates or updates the web configuration. `smtp_password` None keeps
    the stored one, "" removes it, anything else replaces it (encrypted).
    Recorded in the activity log without any secret."""
    _require_web_editable()
    from_address = normalize_address(from_address, "EMAIL_FROM_INVALID")
    reply_to = normalize_address(reply_to, "EMAIL_REPLY_TO_INVALID") if reply_to else None
    smtp_host = _validate_server(smtp_host, smtp_port, smtp_security)
    from_name = (from_name or "").strip() or None
    if from_name and any(c in from_name for c in "\r\n"):
        raise _invalid("EMAIL_FROM_NAME_INVALID", "The sender's name can't contain line breaks.")
    smtp_username = (smtp_username or "").strip() or None

    row = get_settings_row(session)
    created = row is None
    if row is None:
        row = EmailSettings(from_address=from_address, smtp_host=smtp_host)
    before = _audit_view(row) if not created else None
    row.enabled = enabled
    row.transport = "smtp"
    row.from_address = from_address
    row.from_name = from_name
    row.reply_to = reply_to
    row.smtp_host = smtp_host
    row.smtp_port = smtp_port
    row.smtp_security = smtp_security
    row.smtp_username = smtp_username
    password_changed = smtp_password is not None
    if smtp_password is not None:
        # "" removes the stored password.
        row.smtp_password_encrypted = (
            crypto.encrypt_secret(smtp_password) if smtp_password else None
        )
    row.updated_at = datetime.now(UTC)
    row.updated_by_user_id = actor.id
    session.add(row)
    session.commit()
    platform_audit_service.record(
        session,
        actor,
        "email.settings_update",
        "instance",
        details={
            "created": created,
            "before": before,
            "after": _audit_view(row),
            "password_changed": password_changed,
        },
    )
    return row


def _audit_view(row: EmailSettings) -> dict[str, Any]:
    """What the activity log keeps of a configuration: never the password."""
    return {
        "enabled": row.enabled,
        "from_address": row.from_address,
        "from_name": row.from_name,
        "reply_to": row.reply_to,
        "smtp_host": row.smtp_host,
        "smtp_port": row.smtp_port,
        "smtp_security": row.smtp_security,
        "smtp_username": row.smtp_username,
        "has_password": row.smtp_password_encrypted is not None,
    }


def delete_settings(session: Session, actor: User) -> None:
    """Email stops (the queue waits, see `queue`) and the stored password goes."""
    _require_web_editable()
    row = get_settings_row(session)
    if row is None:
        raise AppException(
            "EMAIL_NOT_CONFIGURED",
            "Email isn't set up.",
            404,
            log_level=logging.WARNING,
        )
    before = _audit_view(row)
    session.delete(row)
    session.commit()
    platform_audit_service.record(
        session, actor, "email.settings_delete", "instance", details={"before": before}
    )


# --- Messages ------------------------------------------------------------


def _locale(locale: str | None) -> str:
    return locale if locale in settings.SUPPORTED_LOCALES else settings.DEFAULT_LOCALE


def render(template: str, locale: str, params: dict[str, Any]) -> tuple[str, str, str]:
    """(subject, plain text, HTML) in that language."""
    if template not in TEMPLATES:
        raise ValueError(f"Unknown email template {template!r}.")
    context = {**params, "product_name": PRODUCT_NAME, "locale": locale}
    subject = _templates.get_template(f"{locale}/{template}.subject.txt").render(context).strip()
    # One line, whatever the parameters held: a header can't be split.
    subject = " ".join(subject.split())
    text = _templates.get_template(f"{locale}/{template}.txt").render(context)
    html = _templates.get_template(f"{locale}/{template}.html").render(
        {**context, "subject": subject, "logo_cid": _LOGO_CID}
    )
    return subject, text, html


def build_message(config: EmailConfig, to: str, subject: str, text: str, html: str) -> EmailMessage:
    """One recipient, no Cc/Bcc. The SMTP policy refuses a header with a
    line break, so no value can add headers of its own."""
    message = EmailMessage(policy=SMTP)
    message["From"] = Address(display_name=config.from_name or "", addr_spec=config.from_address)
    message["To"] = Address(addr_spec=to)
    if config.reply_to:
        message["Reply-To"] = Address(addr_spec=config.reply_to)
    message["Subject"] = subject
    message["Date"] = format_datetime(datetime.now(UTC))
    message["Message-ID"] = make_msgid(domain=config.from_address.rsplit("@", 1)[-1])
    # Out-of-office replies and the like shouldn't answer it.
    message["Auto-Submitted"] = "auto-generated"
    message.set_content(text)
    message.add_alternative(html, subtype="html")
    message.get_body(("html",)).add_related(  # type: ignore[union-attr]
        _LOGO_PNG,
        maintype="image",
        subtype="png",
        cid=f"<{_LOGO_CID}>",
        disposition="inline",
        filename="logo.png",
    )
    return message


def queue(
    session: Session,
    to: str,
    template: EmailTemplate,
    params: dict[str, Any],
    locale: str | None = None,
) -> EmailOutbox | None:
    """Adds a message to the outbox in the caller's transaction -- it is
    sent once (and only if) the caller commits. Returns None, without
    queueing, when the deployment sends no email or this address already
    got EMAIL_RATE_PER_RECIPIENT_PER_HOUR messages in the last hour (so a
    form can't flood a mailbox); callers answer the same either way, never
    revealing whether an account exists."""
    if template not in TEMPLATES:
        raise ValueError(f"Unknown email template {template!r}.")
    if not is_enabled(session):
        return None
    to = normalize_address(to, "EMAIL_RECIPIENT_INVALID")
    since = datetime.now(UTC) - timedelta(hours=1)
    recent = session.exec(
        select(func.count())
        .select_from(EmailOutbox)
        .where(EmailOutbox.to_address == to, EmailOutbox.created_at >= since)
    ).one()
    if recent >= settings.EMAIL_RATE_PER_RECIPIENT_PER_HOUR:
        logger.warning(
            "Email %s to @%s dropped: the address reached its hourly limit.",
            template,
            to.rsplit("@", 1)[-1],
        )
        return None
    message = EmailOutbox(
        template=template,
        locale=_locale(locale),
        to_address=to,
        payload_encrypted=crypto.encrypt_secret(json.dumps(params, default=str)),
    )
    session.add(message)
    # Wakes the sending loop in whichever process runs it (the worker), at
    # commit: Postgres delivers a notification only if the transaction
    # commits, and folds repeats within one transaction into one.
    session.connection().execute(text(f"NOTIFY {NOTIFY_CHANNEL}"))
    return message


def _sent_last_minute(session: Session, now: datetime) -> int:
    return session.exec(
        select(func.count())
        .select_from(EmailOutbox)
        .where(EmailOutbox.sent_at >= now - timedelta(minutes=1))  # type: ignore[operator]
    ).one()


def _send_one(config: EmailConfig, transport: EmailTransport, row: EmailOutbox) -> None:
    if row.payload_encrypted is None:
        raise PermanentEmailError("The message's content is gone.")
    try:
        params = json.loads(crypto.decrypt_secret(row.payload_encrypted))
        subject, text, html = render(row.template, row.locale, params)
        message = build_message(config, row.to_address, subject, text, html)
    except (crypto.SecretUnreadableError, TemplateError, ValueError) as exc:
        # Never the exception's text: it could quote the parameters.
        raise PermanentEmailError(
            f"The message couldn't be written: {type(exc).__name__}."
        ) from exc
    transport.send(message)


def deliver_pending(session: Session) -> int:
    """Sends what's due, oldest first, one message per transaction (its row
    locked SKIP LOCKED, so several backend processes never send the same
    one), at most EMAIL_RATE_GLOBAL_PER_MINUTE a minute. A failure that may
    pass is retried later with a growing delay and stops this round (the
    server is likely down); one that won't, or the last attempt, marks the
    message failed. Returns how many were sent."""
    config = effective_config(session)
    if config is None:
        return 0
    transport = transport_for(config)
    sent = 0
    while True:
        now = datetime.now(UTC)
        if _sent_last_minute(session, now) >= settings.EMAIL_RATE_GLOBAL_PER_MINUTE:
            session.commit()
            return sent
        row = session.exec(
            select(EmailOutbox)
            .where(EmailOutbox.status == "pending", EmailOutbox.next_attempt_at <= now)
            .order_by(col(EmailOutbox.next_attempt_at), col(EmailOutbox.created_at))
            .limit(1)
            .with_for_update(skip_locked=True)
        ).first()
        if row is None:
            session.commit()
            return sent
        row.attempts += 1
        row.last_attempt_at = now
        try:
            _send_one(config, transport, row)
        except EmailDeliveryError as exc:
            error = str(exc)[:500]
            row.last_error = error
            gave_up = isinstance(exc, PermanentEmailError) or (
                row.attempts >= settings.EMAIL_MAX_ATTEMPTS
            )
            if gave_up:
                row.status = "failed"
                row.payload_encrypted = None
                logger.error(
                    "Email %s (%s) to @%s failed for good after %s attempt(s): %s",
                    row.id,
                    row.template,
                    row.to_address.rsplit("@", 1)[-1],
                    row.attempts,
                    error,
                )
            else:
                row.next_attempt_at = now + min(
                    timedelta(seconds=10 * 2 ** min(row.attempts, 12)), _MAX_RETRY_DELAY
                )
                logger.warning(
                    "Email %s (%s) not sent (%s); retrying later.", row.id, row.template, error
                )
            session.add(row)
            session.commit()
            if not gave_up:
                return sent
            continue
        row.status = "sent"
        row.sent_at = datetime.now(UTC)
        row.payload_encrypted = None
        row.last_error = None
        session.add(row)
        session.commit()
        sent += 1
        logger.info(
            "Email %s (%s) sent to @%s.", row.id, row.template, row.to_address.rsplit("@", 1)[-1]
        )


def prune_expired(session: Session, now: datetime | None = None) -> int:
    """Forget the messages older than EMAIL_RETENTION_DAYS, whatever their
    state (one still pending that long would carry an expired link)."""
    cutoff = (now or datetime.now(UTC)) - timedelta(days=EMAIL_RETENTION_DAYS)
    result = session.exec(delete(EmailOutbox).where(EmailOutbox.created_at < cutoff))  # type: ignore[call-overload]
    session.commit()
    pruned = result.rowcount or 0
    if pruned:
        logger.info("Email: %s messages past the retention period deleted.", pruned)
    return pruned


def forget_recipient(session: Session, address: str) -> None:
    """A deleted account: its queued and sent messages go (caller commits)."""
    session.exec(
        delete(EmailOutbox).where(func.lower(EmailOutbox.to_address) == address.lower())  # type: ignore[call-overload]
    )


# Set while deliver_forever runs: lets a request that queued something
# urgent (a sign-in code) start a round now instead of at the next poll.
_wake: tuple[asyncio.AbstractEventLoop, asyncio.Event] | None = None

# The channel queue() notifies on commit; the sending loop listens on it.
NOTIFY_CHANNEL = "email_outbox"
_LISTEN_RETRY_SECONDS = 5.0
# How often the listener looks up to see whether it must stop (it waits on
# its socket meanwhile, no query).
_LISTEN_TICK_SECONDS = 0.25


def _listen(stop: threading.Event) -> None:
    """Wakes the sending loop when any process queues a message (a
    dedicated connection LISTENing on NOTIFY_CHANNEL), so a sign-in code
    goes out at once even when the API and the worker are separate
    processes. If the connection fails the loop still polls every
    EMAIL_POLL_SECONDS; this reconnects after a pause."""
    from app.core.db import engine

    dsn = engine.url.set(drivername="postgresql").render_as_string(hide_password=False)
    while not stop.is_set():
        try:
            with psycopg.connect(dsn, autocommit=True) as conn:
                conn.execute(f"LISTEN {NOTIFY_CHANNEL}")
                logger.info("Email loop listening for queued messages.")
                while not stop.is_set():
                    for _ in conn.notifies(timeout=_LISTEN_TICK_SECONDS, stop_after=1):
                        wake_delivery()
        except Exception:  # noqa: BLE001 -- polling covers the gap
            logger.warning("Email listener lost its connection; polling meanwhile.", exc_info=True)
            stop.wait(_LISTEN_RETRY_SECONDS)


def wake_delivery() -> None:
    """Callable from any thread, after the commit that queued the message."""
    if _wake is not None:
        loop, event = _wake
        loop.call_soon_threadsafe(event.set)


async def deliver_forever() -> None:
    """The background loop (app lifespan): every EMAIL_POLL_SECONDS, or as
    soon as wake_delivery() is called, in a worker thread (smtplib blocks),
    sends what's due; once every PRUNE_INTERVAL it also prunes the outbox."""
    global _wake
    from app.core.db import engine

    last_pruned: datetime | None = None
    event = asyncio.Event()
    _wake = (asyncio.get_running_loop(), event)
    stop_listening = threading.Event()
    listener = asyncio.ensure_future(asyncio.to_thread(_listen, stop_listening))

    def run_once() -> None:
        nonlocal last_pruned
        with Session(engine) as session:
            deliver_pending(session)
            now = datetime.now(UTC)
            if last_pruned is None or now - last_pruned >= PRUNE_INTERVAL:
                prune_expired(session, now)
                last_pruned = now

    try:
        while True:
            try:
                await asyncio.wait_for(event.wait(), timeout=settings.EMAIL_POLL_SECONDS)
            except TimeoutError:
                pass
            event.clear()
            try:
                await asyncio.to_thread(run_once)
            except Exception:  # noqa: BLE001 -- the loop must outlive any one failure
                logger.exception("Email loop failed; trying again next round.")
    finally:
        stop_listening.set()
        _wake = None
        with suppress(asyncio.CancelledError, Exception):
            await asyncio.wait_for(listener, timeout=3)


# --- Platform ------------------------------------------------------------


def send_test(
    session: Session, actor: User, to: str | None, locale: str | None
) -> tuple[bool, str | None]:
    """A test message, now, outside the queue: whether the server takes it.
    Recorded; at most TEST_SENDS_PER_MINUTE per administrator a minute."""
    config = effective_config(session)
    if config is None:
        raise AppException(
            "EMAIL_NOT_CONFIGURED",
            "Email isn't set up.",
            409,
            log_level=logging.WARNING,
        )
    since = datetime.now(UTC) - timedelta(minutes=1)
    recent = session.exec(
        select(func.count())
        .select_from(PlatformAuditEvent)
        .where(
            PlatformAuditEvent.action == "email.test",
            PlatformAuditEvent.actor_user_id == actor.id,
            PlatformAuditEvent.created_at >= since,
        )
    ).one()
    if recent >= TEST_SENDS_PER_MINUTE:
        raise AppException(
            "EMAIL_TEST_RATE_LIMITED",
            "Too many test emails. Wait a minute and try again.",
            429,
            log_level=logging.WARNING,
        )
    recipient = normalize_address(to or actor.email, "EMAIL_RECIPIENT_INVALID")
    subject, text, html = render(
        "test",
        _locale(locale),
        {
            "requested_by": actor.email,
            "sent_at": datetime.now(UTC).strftime("%Y-%m-%d %H:%M"),
        },
    )
    error: str | None = None
    try:
        message = build_message(config, recipient, subject, text, html)
        transport_for(config).send(message)
    except EmailDeliveryError as exc:
        error = str(exc)[:500]
    except ValueError:
        # A header the server's configuration made invalid (EMAIL_FROM_*).
        error = "The sender's address or name isn't valid."
    platform_audit_service.record(
        session,
        actor,
        "email.test",
        "instance",
        details={"to": recipient, "ok": error is None, "error": error},
    )
    return error is None, error


@dataclass(frozen=True)
class OutboxStats:
    pending: int
    failed: int
    last_sent_at: datetime | None
    last_failed_at: datetime | None
    last_error: str | None


def outbox_stats(session: Session) -> OutboxStats:
    def count(status: str) -> int:
        return session.exec(
            select(func.count()).select_from(EmailOutbox).where(EmailOutbox.status == status)
        ).one()

    last_failure = session.exec(
        select(EmailOutbox)
        .where(EmailOutbox.last_error.is_not(None))  # type: ignore[union-attr]
        .order_by(col(EmailOutbox.last_attempt_at).desc())
        .limit(1)
    ).first()
    return OutboxStats(
        pending=count("pending"),
        failed=count("failed"),
        last_sent_at=session.exec(select(func.max(EmailOutbox.sent_at))).one(),
        last_failed_at=last_failure.last_attempt_at if last_failure else None,
        last_error=last_failure.last_error if last_failure else None,
    )


def list_outbox(
    session: Session, status: OutboxStatus | None, limit: int, offset: int
) -> tuple[list[EmailOutbox], int]:
    query = select(EmailOutbox)
    counted = select(func.count()).select_from(EmailOutbox)
    if status is not None:
        query = query.where(EmailOutbox.status == status)
        counted = counted.where(EmailOutbox.status == status)
    rows = session.exec(
        query.order_by(col(EmailOutbox.created_at).desc(), col(EmailOutbox.id))
        .limit(limit)
        .offset(offset)
    ).all()
    return list(rows), session.exec(counted).one()
