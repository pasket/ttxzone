"""Links sent by email: "forgot your password?" (the same answer whether
or not the account exists, a single-use link that expires, every session
signed out) and confirming the address an account signs up with (asked
only while the deployment sends email; until then the account reaches
only itself)."""

import json
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core import crypto
from app.core.config import settings
from app.main import app
from app.models import AccountToken, EmailOutbox, EmailSettings, PlatformAuditEvent, User
from app.services import oidc_service
from app.services.login_throttle_service import LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS
from tests.test_instance_tenancy import PASSWORD, _csrf, _register, _signup

NEW_PASSWORD = "Brandnewhorse456!"


def _email_on(db_session: Session) -> None:
    db_session.add(EmailSettings(from_address="ttx@acme.com", smtp_host="smtp.acme.com"))
    db_session.commit()


def _email_off(db_session: Session) -> None:
    row = db_session.exec(select(EmailSettings)).one()
    row.enabled = False
    db_session.add(row)
    db_session.commit()


def _outbox(db_session: Session) -> list[EmailOutbox]:
    db_session.expire_all()
    return list(db_session.exec(select(EmailOutbox).order_by(EmailOutbox.created_at)))


def _params(row: EmailOutbox) -> dict:
    return json.loads(crypto.decrypt_secret(row.payload_encrypted or ""))


def _token(row: EmailOutbox) -> str:
    link = _params(row)["link"]
    prefix, token = link.split("#token=")
    assert prefix in ("https://ttx.acme.com/reset-password", "https://ttx.acme.com/verify-email")
    return token


def _user(db_session: Session, email: str) -> User:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).one()


def _actions(db_session: Session) -> list[str]:
    db_session.expire_all()
    return [e.action for e in db_session.exec(select(PlatformAuditEvent))]


def _forgot(client: TestClient, email: str):
    return client.post("/api/v1/auth/password/forgot", json={"email": email})


def _reset(client: TestClient, token: str, password: str = NEW_PASSWORD):
    return client.post(
        "/api/v1/auth/password/reset", json={"token": token, "new_password": password}
    )


def _login(email: str, password: str) -> int:
    with TestClient(app) as other:
        return other.post(
            "/api/v1/auth/login", json={"email": email, "password": password}
        ).status_code


# --- Forgot password -------------------------------------------------------


def test_forgot_password_is_offered_only_while_the_deployment_sends_email(
    client: TestClient, db_session: Session, monkeypatch
) -> None:
    assert client.get("/api/v1/instance/policy").json()["password_reset_available"] is False
    assert _forgot(client, "pat@acme.com").json()["error"]["code"] == "ACCOUNT_EMAIL_UNAVAILABLE"

    _email_on(db_session)
    assert client.get("/api/v1/instance/policy").json()["password_reset_available"] is True
    # Links need the deployment's public address.
    monkeypatch.setattr(settings, "PUBLIC_BASE_URL", None)
    assert client.get("/api/v1/instance/policy").json()["password_reset_available"] is False


def test_a_reset_link_sets_a_new_password_once_and_signs_everyone_out(
    client: TestClient, db_session: Session
) -> None:
    _email_on(db_session)
    _register(client, "pat@acme.com")
    assert client.get("/api/v1/auth/me").status_code == 200

    unknown = _forgot(client, "nobody@acme.com")
    known = _forgot(client, "Pat@Acme.com")
    # After the confirmation link from the signup.
    templates = [m.template for m in _outbox(db_session)]
    reset_message = _outbox(db_session)[-1]

    assert (unknown.status_code, known.status_code) == (202, 202)
    assert unknown.content == known.content
    assert templates == ["email_verification", "password_reset"]
    assert reset_message.to_address == "pat@acme.com"
    assert _params(reset_message)["minutes"] == 30
    token = _token(reset_message)
    stored = db_session.exec(select(AccountToken)).all()
    assert token not in {row.token_hash for row in stored}

    assert _reset(client, token).status_code == 204
    # Whoever was signed in (this browser too) is out.
    assert client.get("/api/v1/auth/me").status_code == 401
    assert _login("pat@acme.com", PASSWORD) == 401
    assert _login("pat@acme.com", NEW_PASSWORD) == 200
    # The link reached the mailbox: the address is confirmed.
    assert _user(db_session, "pat@acme.com").email_verified_at is not None
    again = _reset(client, token, "Anotherhorse789!")
    assert (again.status_code, again.json()["error"]["code"]) == (400, "ACCOUNT_LINK_INVALID")
    actions = _actions(db_session)
    assert "auth.password_reset_request" in actions and "auth.password_reset" in actions


def test_a_reset_link_lifts_a_lock_from_failed_sign_ins(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "pat@acme.com")
    _email_on(db_session)
    client.cookies.clear()
    credentials = {"email": "pat@acme.com", "password": "wrong-password"}
    for _ in range(LOGIN_FAILURES_PER_ACCOUNT_AND_ADDRESS):
        assert client.post("/api/v1/auth/login", json=credentials).status_code == 401
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 429

    _forgot(client, "pat@acme.com")
    assert _reset(client, _token(_outbox(db_session)[-1]), NEW_PASSWORD).status_code == 204

    credentials["password"] = NEW_PASSWORD
    assert client.post("/api/v1/auth/login", json=credentials).status_code == 200


def test_a_reset_link_expires_and_a_newer_one_withdraws_it(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "pat@acme.com")
    _email_on(db_session)

    _forgot(client, "pat@acme.com")
    _forgot(client, "pat@acme.com")
    first, second = [_token(m) for m in _outbox(db_session)]

    assert _reset(client, first).status_code == 400
    row = db_session.exec(select(AccountToken)).one()
    row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    db_session.add(row)
    db_session.commit()
    assert _reset(client, second).status_code == 400
    assert _login("pat@acme.com", PASSWORD) == 200


def test_a_weak_password_is_refused_and_the_link_stays_usable(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "pat@acme.com")
    _email_on(db_session)
    _forgot(client, "pat@acme.com")
    [message] = _outbox(db_session)

    assert _reset(client, _token(message), "short").status_code == 422
    assert _reset(client, _token(message)).status_code == 204


def test_no_link_for_a_suspended_account(client: TestClient, db_session: Session) -> None:
    _register(client, "pat@acme.com")
    _email_on(db_session)
    user = _user(db_session, "pat@acme.com")
    user.suspended_at = datetime.now(UTC)
    db_session.add(user)
    db_session.commit()

    assert _forgot(client, "pat@acme.com").status_code == 202
    assert _outbox(db_session) == []


def test_an_account_without_a_password_is_pointed_to_its_provider(
    client: TestClient, db_session: Session, monkeypatch
) -> None:
    _email_on(db_session)
    db_session.add(User(email="sso@acme.com", full_name="Sam", hashed_password=None))
    db_session.commit()

    class Provider:
        display_name = "Microsoft"

    monkeypatch.setattr(oidc_service, "effective_config", lambda session: Provider())
    _forgot(client, "sso@acme.com")
    [message] = _outbox(db_session)

    assert message.template == "password_reset_sso"
    assert _params(message)["provider"] == "Microsoft"
    assert db_session.exec(select(AccountToken)).all() == []

    # Without single sign-on any more, the link lets it choose a password.
    monkeypatch.setattr(oidc_service, "effective_config", lambda session: None)
    _forgot(client, "sso@acme.com")
    assert _outbox(db_session)[-1].template == "password_reset"


# --- Email confirmation ----------------------------------------------------


def test_an_account_signed_up_while_email_is_on_confirms_its_address_first(
    client: TestClient, db_session: Session
) -> None:
    _email_on(db_session)
    _register(client, "pat@acme.com")
    [message] = _outbox(db_session)

    me = client.get("/api/v1/auth/me").json()
    blocked = client.get("/api/v1/organizations/mine")

    assert message.template == "email_verification"
    assert _params(message)["hours"] == 48
    assert me["email_verification_pending"] is True
    assert (blocked.status_code, blocked.json()["error"]["code"]) == (
        403,
        "EMAIL_VERIFICATION_REQUIRED",
    )

    # From any browser, signed in or not.
    with TestClient(app) as other:
        verified = other.post("/api/v1/auth/email/verify", json={"token": _token(message)})
    assert verified.status_code == 204
    assert client.get("/api/v1/auth/me").json()["email_verification_pending"] is False
    assert client.get("/api/v1/organizations/mine").status_code == 200
    assert "auth.email_verify" in _actions(db_session)
    again = client.post("/api/v1/auth/email/verify", json={"token": _token(message)})
    assert again.status_code == 400


def test_an_organization_signup_confirms_its_address_too(
    client: TestClient, db_session: Session
) -> None:
    _email_on(db_session)
    assert _signup(client, "owner@acme.com", "Acme").status_code == 201

    assert client.get("/api/v1/auth/me").json()["email_verification_pending"] is True
    assert [m.template for m in _outbox(db_session)] == ["email_verification"]


def test_accounts_from_while_email_was_off_are_never_asked(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "pat@acme.com")
    _email_on(db_session)

    assert client.get("/api/v1/auth/me").json()["email_verification_pending"] is False
    assert client.get("/api/v1/organizations/mine").status_code == 200
    assert _outbox(db_session) == []


def test_turning_email_off_lifts_the_wait(client: TestClient, db_session: Session) -> None:
    _email_on(db_session)
    _register(client, "pat@acme.com")
    _email_off(db_session)

    assert client.get("/api/v1/auth/me").json()["email_verification_pending"] is False
    assert client.get("/api/v1/organizations/mine").status_code == 200


def test_a_new_confirmation_link_waits_a_minute_and_withdraws_the_old_one(
    client: TestClient, db_session: Session
) -> None:
    _email_on(db_session)
    _register(client, "pat@acme.com")
    [first] = _outbox(db_session)

    too_soon = client.post("/api/v1/auth/email/verification", headers=_csrf(client))
    row = db_session.exec(select(AccountToken)).one()
    row.created_at = datetime.now(UTC) - timedelta(minutes=2)
    db_session.add(row)
    db_session.commit()
    resent = client.post("/api/v1/auth/email/verification", headers=_csrf(client))
    second = _outbox(db_session)[-1]

    assert (too_soon.status_code, too_soon.json()["error"]["code"]) == (
        429,
        "EMAIL_VERIFICATION_RATE_LIMITED",
    )
    assert resent.status_code == 202
    assert (
        client.post("/api/v1/auth/email/verify", json={"token": _token(first)}).status_code == 400
    )
    assert (
        client.post("/api/v1/auth/email/verify", json={"token": _token(second)}).status_code == 204
    )
    done = client.post("/api/v1/auth/email/verification", headers=_csrf(client))
    assert done.json()["error"]["code"] == "EMAIL_VERIFICATION_NOT_PENDING"


def test_a_link_works_only_while_the_account_keeps_that_address(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "pat@acme.com")
    _email_on(db_session)
    _forgot(client, "pat@acme.com")
    [message] = _outbox(db_session)
    user = _user(db_session, "pat@acme.com")
    user.email = "pat.smith@acme.com"
    db_session.add(user)
    db_session.commit()

    response = _reset(client, _token(message))

    assert (response.status_code, response.json()["error"]["code"]) == (
        400,
        "ACCOUNT_LINK_INVALID",
    )


def test_every_account_message_renders_in_every_language() -> None:
    from app.services import email_service

    params = {
        "password_reset": {
            "name": "Pat <b>",
            "link": "https://ttx.acme.com/r#token=x",
            "minutes": 30,
        },
        "password_reset_sso": {"name": "Pat <b>", "provider": "Microsoft"},
        "email_verification": {
            "name": "Pat <b>",
            "link": "https://ttx.acme.com/v#token=x",
            "hours": 48,
        },
    }
    for template, values in params.items():
        for locale in settings.SUPPORTED_LOCALES:
            subject, text, html = email_service.render(template, locale, values)
            assert subject and "\n" not in subject
            assert "Pat <b>" in text and "Pat &lt;b&gt;" in html
            if "link" in values:
                assert values["link"] in text and values["link"] in html
