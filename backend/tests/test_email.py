"""Outgoing email: where its configuration comes from (the server's
environment pins it, otherwise Platform -> Email), the password stored
encrypted and never returned, the outbox (queued in the caller's
transaction, retried, given up on, rate-limited, pruned), the messages
themselves (one recipient, no header injection, escaped HTML) and the SMTP
transport's refusal to fall back to plain text."""

import smtplib
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from pydantic import SecretStr, ValidationError
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import Settings, settings
from app.core.exceptions import AppException
from app.main import app
from app.models import EmailOutbox, EmailSettings, PlatformAuditEvent
from app.services import email_service, email_transports
from app.services.email_transports import (
    PermanentEmailError,
    SmtpConfig,
    SmtpTransport,
    TransientEmailError,
)
from tests.test_instance_tenancy import _csrf, _make_admin, _register, _stale_sign_in

ADMIN = "ops@acme.com"
PASSWORD = "smtp-pa55word!"


class FakeTransport:
    """Stands in for the mail server: records each message, or raises."""

    def __init__(self, *errors: Exception | None) -> None:
        self.errors = list(errors)
        self.sent: list[EmailMessage] = []

    def send(self, message: EmailMessage) -> None:
        error = self.errors.pop(0) if self.errors else None
        if error is not None:
            raise error
        self.sent.append(message)


@pytest.fixture
def admin(client: TestClient, db_session: Session) -> TestClient:
    _register(client, ADMIN)
    _make_admin(db_session, ADMIN)
    return client


@pytest.fixture
def transport(monkeypatch: pytest.MonkeyPatch) -> FakeTransport:
    fake = FakeTransport()
    monkeypatch.setattr(email_service, "transport_for", lambda config: fake)
    return fake


def _body(**overrides) -> dict:
    return {
        "from_address": "ttx@acme.com",
        "from_name": "TTX Zone",
        "smtp_host": "smtp.acme.com",
        "smtp_port": 587,
        "smtp_security": "starttls",
        "smtp_username": "ttx@acme.com",
        "smtp_password": PASSWORD,
        **overrides,
    }


def _save(client: TestClient, **overrides):
    return client.put("/api/v1/instance/email", json=_body(**overrides), headers=_csrf(client))


def _configure(db_session: Session) -> None:
    """Email on, as if set from Platform."""
    db_session.add(
        EmailSettings(
            from_address="ttx@acme.com",
            smtp_host="smtp.acme.com",
            smtp_password_encrypted=crypto.encrypt_secret(PASSWORD),
        )
    )
    db_session.commit()


def _pin(monkeypatch: pytest.MonkeyPatch) -> None:
    for name, value in {
        "EMAIL_TRANSPORT": "smtp",
        "EMAIL_FROM_ADDRESS": "noreply@corp.example",
        "SMTP_HOST": "relay.corp.example",
        "SMTP_PORT": 25,
        "SMTP_USERNAME": None,
        "SMTP_PASSWORD": SecretStr("from-env"),
    }.items():
        monkeypatch.setattr(settings, name, value)


def _outbox(db_session: Session) -> list[EmailOutbox]:
    db_session.expire_all()
    return list(db_session.exec(select(EmailOutbox).order_by(EmailOutbox.created_at)))


def _due_now(db_session: Session) -> None:
    for row in _outbox(db_session):
        row.next_attempt_at = datetime.now(UTC) - timedelta(seconds=1)
        db_session.add(row)
    db_session.commit()


# --- Configuration ---------------------------------------------------------


def test_email_starts_off(admin: TestClient, db_session: Session) -> None:
    fresh = admin.get("/api/v1/instance/email").json()

    assert (fresh["configured"], fresh["active"]) == (False, False)
    assert email_service.queue(db_session, "pat@acme.com", "test", {}) is None


def test_saving_validates_needs_step_up_and_never_returns_the_password(
    admin: TestClient, db_session: Session
) -> None:
    errors = {
        "EMAIL_SMTP_HOST_INVALID": _save(admin, smtp_host="smtp://smtp.acme.com:25"),
        "EMAIL_SMTP_PORT_NOT_ALLOWED": _save(admin, smtp_port=1025),
        "EMAIL_SMTP_INSECURE_NOT_ALLOWED": _save(admin, smtp_security="none"),
        "EMAIL_FROM_INVALID": _save(admin, from_address="ttx@acme.com\r\nBcc: x@evil.com"),
        "EMAIL_FROM_NAME_INVALID": _save(admin, from_name="TTX\r\nBcc: x@evil.com"),
    }
    saved = _save(admin)

    for code, response in errors.items():
        assert response.json()["error"]["code"] == code, response.text
    assert saved.status_code == 200, saved.text
    body = saved.json()
    assert (body["configured"], body["active"], body["has_password"]) == (True, True, True)
    assert PASSWORD not in saved.text
    row = db_session.exec(select(EmailSettings)).one()
    assert PASSWORD not in (row.smtp_password_encrypted or "")
    assert crypto.decrypt_secret(row.smtp_password_encrypted or "") == PASSWORD
    [event] = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "email.settings_update")
    ).all()
    assert event.details is not None and event.details["password_changed"] is True
    assert PASSWORD not in str(event.details)

    # Left out, the password stays; empty, it goes.
    kept = _save(admin, smtp_password=None, from_name="Exercises").json()
    cleared = _save(admin, smtp_password="").json()
    assert (kept["has_password"], kept["from_name"]) == (True, "Exercises")
    assert cleared["has_password"] is False

    _stale_sign_in(db_session, ADMIN)
    assert _save(admin).json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"
    deleted = admin.delete("/api/v1/instance/email", headers=_csrf(admin))
    assert deleted.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"


def test_an_internal_relay_needs_the_insecure_opt_in(
    admin: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "EMAIL_ALLOW_INSECURE", True)

    saved = _save(admin, smtp_host="mailpit", smtp_port=1025, smtp_security="none")

    assert saved.status_code == 200, saved.text
    assert saved.json()["allow_insecure"] is True


def test_the_environment_pins_email_and_platform_only_reads_it(
    admin: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    _pin(monkeypatch)

    read = admin.get("/api/v1/instance/email")
    refused = _save(admin)
    not_deleted = admin.delete("/api/v1/instance/email", headers=_csrf(admin))

    body = read.json()
    assert (body["pinned_by_env"], body["active"], body["smtp_host"], body["has_password"]) == (
        True,
        True,
        "relay.corp.example",
        True,
    )
    assert "from-env" not in read.text
    assert refused.json()["error"]["code"] == "EMAIL_PINNED_BY_ENV"
    assert not_deleted.json()["error"]["code"] == "EMAIL_PINNED_BY_ENV"


def test_only_an_instance_administrator_reaches_email(admin: TestClient) -> None:
    with TestClient(app) as other:
        _register(other, "pat@acme.com")
        for response in (
            other.get("/api/v1/instance/email"),
            other.get("/api/v1/instance/email/outbox"),
            other.put("/api/v1/instance/email", json=_body(), headers=_csrf(other)),
        ):
            assert response.status_code == 403, response.text


def test_a_password_no_key_decrypts_turns_email_off(
    admin: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _configure(db_session)
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", SecretStr(Fernet.generate_key().decode()))

    body = admin.get("/api/v1/instance/email").json()

    assert (body["configured"], body["active"], body["password_readable"]) == (True, False, False)


def test_a_rotated_key_still_reads_with_the_previous_one(monkeypatch: pytest.MonkeyPatch) -> None:
    old = crypto.encrypt_secret("value")
    previous = settings.DATA_ENCRYPTION_KEY
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY", SecretStr(Fernet.generate_key().decode()))
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY_PREVIOUS", previous)

    rotated = crypto.reencrypt(old)
    monkeypatch.setattr(settings, "DATA_ENCRYPTION_KEY_PREVIOUS", None)

    assert crypto.decrypt_secret(rotated) == "value"
    with pytest.raises(crypto.SecretUnreadableError):
        crypto.decrypt_secret(old)


def test_a_pinned_configuration_is_checked_at_startup() -> None:
    def build(**values) -> Settings:
        return Settings(_env_file=None, **values)  # type: ignore[call-arg]

    key = Fernet.generate_key().decode()
    with pytest.raises(ValidationError, match="SMTP_HOST is required"):
        build(EMAIL_TRANSPORT="smtp", EMAIL_FROM_ADDRESS="a@b.com", DATA_ENCRYPTION_KEY=key)
    with pytest.raises(ValidationError, match="development only"):
        build(
            ENVIRONMENT="production",
            # Not the environment's: a server refuses the example's secrets.
            SECRET_KEY="k" * 64,
            POSTGRES_PASSWORD="a-real-password",
            EMAIL_TRANSPORT="console",
            EMAIL_FROM_ADDRESS="a@b.com",
            DATA_ENCRYPTION_KEY=key,
        )
    with pytest.raises(ValidationError, match="EMAIL_ALLOW_INSECURE"):
        build(
            EMAIL_TRANSPORT="smtp",
            EMAIL_FROM_ADDRESS="a@b.com",
            SMTP_HOST="h",
            SMTP_PORT=1025,
            DATA_ENCRYPTION_KEY=key,
        )
    with pytest.raises(ValidationError, match="not a Fernet key"):
        build(DATA_ENCRYPTION_KEY="short")
    assert build(SMTP_HOST="", DATA_ENCRYPTION_KEY=key).SMTP_HOST is None


def test_secrets_are_read_from_files(tmp_path) -> None:
    password = tmp_path / "smtp_password"
    password.write_text("from-a-file\n")
    key = tmp_path / "key"
    key.write_text(Fernet.generate_key().decode())

    loaded = Settings(  # type: ignore[call-arg]
        _env_file=None,
        SMTP_PASSWORD_FILE=str(password),
        DATA_ENCRYPTION_KEY=None,
        DATA_ENCRYPTION_KEY_FILE=str(key),
    )

    assert loaded.SMTP_PASSWORD is not None
    assert loaded.SMTP_PASSWORD.get_secret_value() == "from-a-file"
    assert loaded.DATA_ENCRYPTION_KEY is not None
    assert "from-a-file" not in repr(loaded)


# --- The outbox ------------------------------------------------------------


def test_a_message_is_queued_with_the_action_and_sent_after_it_commits(
    db_session: Session, transport: FakeTransport
) -> None:
    _configure(db_session)

    email_service.queue(db_session, "pat@acme.com", "test", {"requested_by": "x"})
    db_session.rollback()
    nothing = _outbox(db_session)
    email_service.queue(
        db_session,
        "Pat@Acme.com",
        "test",
        {"requested_by": "<b>ops</b>", "sent_at": "now"},
        locale="es",
    )
    db_session.commit()
    [queued] = _outbox(db_session)
    sent = email_service.deliver_pending(db_session)
    [done] = _outbox(db_session)

    assert nothing == []
    assert "<b>ops</b>" not in (queued.payload_encrypted or "")
    assert sent == 1
    assert (done.status, done.payload_encrypted, done.attempts) == ("sent", None, 1)
    [message] = transport.sent
    assert message["To"] == "Pat@acme.com"
    assert message["From"] == "ttx@acme.com"
    assert message["Auto-Submitted"] == "auto-generated"
    assert message["Message-ID"].endswith("@acme.com>")
    assert message["Subject"] == "TTX-Zone: correo de prueba"
    html = message.get_body(("html",)).get_content()  # type: ignore[union-attr]
    text = message.get_body(("plain",)).get_content()  # type: ignore[union-attr]
    assert "&lt;b&gt;ops&lt;/b&gt;" in html and "<b>ops</b>" not in html
    assert "<b>ops</b>" in text
    # The logo travels inside the message, never fetched from a server.
    [logo] = [part for part in message.walk() if part.get_content_type() == "image/png"]
    assert logo["Content-ID"] == "<logo@ttx-zone>"
    assert logo.get_content_disposition() == "inline"
    assert 'src="cid:logo@ttx-zone"' in html


def test_a_failure_that_may_pass_is_retried_then_given_up(
    db_session: Session, transport: FakeTransport, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "EMAIL_MAX_ATTEMPTS", 2)
    _configure(db_session)
    transport.errors = [TransientEmailError("SMTP 421: busy"), TransientEmailError("timeout")]
    email_service.queue(db_session, "pat@acme.com", "test", {"requested_by": "x", "sent_at": "y"})
    db_session.commit()

    email_service.deliver_pending(db_session)
    [row] = _outbox(db_session)
    waiting = (row.status, row.attempts, row.last_error, row.next_attempt_at > datetime.now(UTC))
    again_too_soon = email_service.deliver_pending(db_session)
    _due_now(db_session)
    email_service.deliver_pending(db_session)
    [failed] = _outbox(db_session)

    assert waiting == ("pending", 1, "SMTP 421: busy", True)
    assert again_too_soon == 0
    assert (failed.status, failed.attempts, failed.payload_encrypted) == ("failed", 2, None)
    assert transport.sent == []


def test_a_refused_recipient_fails_at_once_and_the_queue_moves_on(
    db_session: Session, transport: FakeTransport
) -> None:
    _configure(db_session)
    transport.errors = [PermanentEmailError("SMTP 550: no such user")]
    for to in ("gone@acme.com", "pat@acme.com"):
        email_service.queue(db_session, to, "test", {"requested_by": "x", "sent_at": "y"})
        db_session.commit()

    sent = email_service.deliver_pending(db_session)

    statuses = {row.to_address: row.status for row in _outbox(db_session)}
    assert statuses == {"gone@acme.com": "failed", "pat@acme.com": "sent"}
    assert sent == 1


def test_an_address_gets_a_few_messages_an_hour_and_the_deployment_a_few_a_minute(
    db_session: Session, transport: FakeTransport, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "EMAIL_RATE_PER_RECIPIENT_PER_HOUR", 2)
    monkeypatch.setattr(settings, "EMAIL_RATE_GLOBAL_PER_MINUTE", 2)
    _configure(db_session)
    params = {"requested_by": "x", "sent_at": "y"}

    queued = [email_service.queue(db_session, "pat@acme.com", "test", params) for _ in range(3)]
    email_service.queue(db_session, "sam@acme.com", "test", params)
    db_session.commit()
    sent = email_service.deliver_pending(db_session)

    assert [q is not None for q in queued] == [True, True, False]
    assert sent == 2
    assert [row.status for row in _outbox(db_session)] == ["sent", "sent", "pending"]


def test_old_messages_are_pruned_and_a_deleted_account_takes_its_own(
    db_session: Session,
) -> None:
    _configure(db_session)
    params = {"requested_by": "x", "sent_at": "y"}
    old = email_service.queue(db_session, "pat@acme.com", "test", params)
    email_service.queue(db_session, "sam@acme.com", "test", params)
    email_service.queue(db_session, "Kim@acme.com", "test", params)
    assert old is not None
    old.created_at = datetime.now(UTC) - timedelta(days=email_service.EMAIL_RETENTION_DAYS + 1)
    db_session.commit()

    pruned = email_service.prune_expired(db_session)
    email_service.forget_recipient(db_session, "kim@ACME.com")
    db_session.commit()

    assert pruned == 1
    assert [row.to_address for row in _outbox(db_session)] == ["sam@acme.com"]


def test_the_outbox_lists_what_went_out_without_its_content(
    admin: TestClient, db_session: Session
) -> None:
    _configure(db_session)
    email_service.queue(db_session, "pat@acme.com", "test", {"requested_by": "secret-link"})
    db_session.commit()

    listed = admin.get("/api/v1/instance/email/outbox")
    pending = admin.get("/api/v1/instance/email/outbox?status=pending").json()
    sent = admin.get("/api/v1/instance/email/outbox?status=sent").json()

    assert listed.status_code == 200, listed.text
    [item] = listed.json()["items"]
    assert item["to_address"] == "pat@acme.com" and "payload_encrypted" not in item
    assert "secret-link" not in listed.text
    assert (pending["total"], sent["total"]) == (1, 0)
    assert admin.get("/api/v1/instance/email").json()["pending"] == 1


# --- Messages and transports ----------------------------------------------


def test_no_value_can_add_a_header_or_a_recipient() -> None:
    config = email_service.EmailConfig("smtp", "ttx@acme.com", None, None, None, False)

    with pytest.raises(ValueError):
        email_service.build_message(
            config, "pat@acme.com", "Hi\r\nBcc: x@evil.com", "text", "<p>html</p>"
        )
    for address in (
        "pat@acme.com\r\nBcc: x@evil.com",
        "pat@acme.com, sam@acme.com",
        "Pat <p@a.com>",
    ):
        with pytest.raises(AppException):
            email_service.normalize_address(address)


class _FakeSmtp:
    """smtplib.SMTP without a network: what the server offers, what was done."""

    offers_starttls = True
    calls: list[str] = []

    def __init__(self, host: str, port: int, timeout: float) -> None:
        _FakeSmtp.calls = [f"connect {host}:{port}"]

    def __enter__(self) -> "_FakeSmtp":
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def ehlo(self) -> None:
        self.calls.append("ehlo")

    def has_extn(self, name: str) -> bool:
        return self.offers_starttls

    def starttls(self, context) -> None:  # type: ignore[no-untyped-def]
        assert context.check_hostname and context.minimum_version.name == "TLSv1_2"
        self.calls.append("starttls")

    def login(self, user: str, password: str) -> None:
        self.calls.append("login")

    def send_message(self, message: EmailMessage) -> None:
        self.calls.append("send")


def _smtp(**overrides) -> SmtpTransport:
    values = {
        "host": "smtp.acme.com",
        "port": 587,
        "security": "starttls",
        "username": "ttx",
        "password": PASSWORD,
        "timeout": 5,
        "allow_insecure": False,
        **overrides,
    }
    return SmtpTransport(SmtpConfig(**values))


def test_smtp_logs_in_only_after_starttls_and_never_falls_back_to_plain_text(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(email_transports.smtplib, "SMTP", _FakeSmtp)

    _smtp().send(EmailMessage())
    upgraded = list(_FakeSmtp.calls)
    monkeypatch.setattr(_FakeSmtp, "offers_starttls", False)
    with pytest.raises(TransientEmailError, match="STARTTLS"):
        _smtp().send(EmailMessage())

    assert upgraded == ["connect smtp.acme.com:587", "ehlo", "starttls", "ehlo", "login", "send"]
    assert "login" not in _FakeSmtp.calls and "send" not in _FakeSmtp.calls
    assert PASSWORD not in repr(_smtp().config)


def test_smtp_answers_are_sorted_into_retry_or_give_up(monkeypatch: pytest.MonkeyPatch) -> None:
    def refusing(error: Exception) -> type:
        class Refusing(_FakeSmtp):
            def send_message(self, message: EmailMessage) -> None:
                raise error

        return Refusing

    cases = [
        (smtplib.SMTPRecipientsRefused({"x@a.com": (550, b"no such user")}), PermanentEmailError),
        (smtplib.SMTPRecipientsRefused({"x@a.com": (451, b"try later")}), TransientEmailError),
        (smtplib.SMTPDataError(554, b"rejected"), PermanentEmailError),
        (smtplib.SMTPServerDisconnected("gone"), TransientEmailError),
        (smtplib.SMTPAuthenticationError(535, b"bad credentials"), TransientEmailError),
        (TimeoutError("timed out"), TransientEmailError),
    ]
    for error, expected in cases:
        monkeypatch.setattr(email_transports.smtplib, "SMTP", refusing(error))
        with pytest.raises(expected):
            _smtp().send(EmailMessage())


# --- Platform's test message ----------------------------------------------


def test_the_test_message_reports_the_server_answer_is_recorded_and_limited(
    admin: TestClient, db_session: Session, transport: FakeTransport
) -> None:
    not_configured = admin.post("/api/v1/instance/email/test", json={}, headers=_csrf(admin))
    assert _save(admin).status_code == 200

    ok = admin.post(
        "/api/v1/instance/email/test", json={}, headers={**_csrf(admin), "Accept-Language": "es"}
    )
    transport.errors = [TransientEmailError("SMTP 535: authentication failed")]
    failed = admin.post(
        "/api/v1/instance/email/test", json={"to": "pat@acme.com"}, headers=_csrf(admin)
    )
    for _ in range(3):
        admin.post("/api/v1/instance/email/test", json={}, headers=_csrf(admin))
    limited = admin.post("/api/v1/instance/email/test", json={}, headers=_csrf(admin))

    assert not_configured.json()["error"]["code"] == "EMAIL_NOT_CONFIGURED"
    assert ok.json() == {"ok": True, "to": ADMIN, "error": None}
    assert transport.sent[0]["Subject"] == "TTX-Zone: correo de prueba"
    assert failed.json() == {
        "ok": False,
        "to": "pat@acme.com",
        "error": "SMTP 535: authentication failed",
    }
    assert limited.status_code == 429
    assert limited.json()["error"]["code"] == "EMAIL_TEST_RATE_LIMITED"
    tests = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "email.test")
    ).all()
    assert len(tests) == email_service.TEST_SENDS_PER_MINUTE
    # Nothing goes through the queue.
    assert _outbox(db_session) == []
