"""Authentication events of any account -- signing up, in and out, the
second factor and its failures, step-up, password and TOTP changes -- each
recorded in Platform's activity log (and so queued for the SIEM) and as a
line in auth.log."""

import logging
from datetime import UTC, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import PlatformAuditDelivery, PlatformAuditEvent, User
from tests.test_instance_tenancy import PASSWORD, _csrf, _register
from tests.test_platform_audit import _set_webhook
from tests.test_platform_audit import admin as admin  # noqa: F401 (fixture)
from tests.test_totp_backup_codes import _secret_from_provisioning_uri


def _auth_events(db_session: Session) -> list[PlatformAuditEvent]:
    db_session.expire_all()
    return list(
        db_session.exec(
            select(PlatformAuditEvent)
            .where(PlatformAuditEvent.action.like("auth.%"))
            .order_by(PlatformAuditEvent.created_at)
        )
    )


def _actions(db_session: Session) -> list[str]:
    return [event.action for event in _auth_events(db_session)]


def _login(client: TestClient, email: str, password: str = PASSWORD):
    return client.post("/api/v1/auth/login", json={"email": email, "password": password})


def _logout(client: TestClient) -> None:
    assert client.post("/api/v1/auth/logout", headers=_csrf(client)).status_code == 204


def _code(secret: str, steps_ahead: int = 0) -> str:
    totp = pyotp.TOTP(secret)
    return totp.at(datetime.now(UTC) + timedelta(seconds=30 * steps_ahead))


def _enroll(client: TestClient) -> str:
    enrolled = client.post("/api/v1/auth/totp/enroll", headers=_csrf(client))
    secret = _secret_from_provisioning_uri(enrolled.json()["provisioning_uri"])
    confirmed = client.post(
        "/api/v1/auth/totp/enroll/confirm", json={"code": _code(secret)}, headers=_csrf(client)
    )
    assert confirmed.status_code == 200, confirmed.text
    return secret


def test_a_password_account_leaves_a_trail_of_everything_it_does(
    client: TestClient, db_session: Session, caplog
) -> None:
    with caplog.at_level(logging.INFO, logger="app.auth"):
        _register(client, "pat@acme.com")
        _logout(client)
        assert _login(client, "pat@acme.com", "wrong-password").status_code == 401
        assert _login(client, "Nobody@Acme.com").status_code == 401
        assert _login(client, "pat@acme.com").status_code == 200
        wrong = client.post("/api/v1/auth/step-up", json={"password": "no"}, headers=_csrf(client))
        assert wrong.status_code == 401
        ok = client.post("/api/v1/auth/step-up", json={"password": PASSWORD}, headers=_csrf(client))
        assert ok.status_code == 204
        changed = client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": "Another-horse-42"},
            headers=_csrf(client),
        )
        assert changed.status_code == 204, changed.text
        _enroll(client)
        disabled = client.post(
            "/api/v1/auth/totp/disable",
            json={"password": "Another-horse-42"},
            headers=_csrf(client),
        )
        assert disabled.status_code == 204, disabled.text

    events = _auth_events(db_session)
    assert [event.action for event in events] == [
        "auth.register",
        "auth.logout",
        "auth.login_failed",
        "auth.login_failed",
        "auth.login",
        "auth.step_up_failed",
        "auth.step_up",
        "auth.password_change",
        "auth.totp_enable",
        "auth.totp_disable",
    ]
    pat = db_session.exec(select(User).where(User.email == "pat@acme.com")).one()
    register, _, wrong_password, unknown, login = events[:5]
    assert register.details == {"via": "account"}
    assert (wrong_password.actor_user_id, wrong_password.details) == (
        pat.id,
        {"reason": "password"},
    )
    # No such account: who tried is the email typed, never the console.
    assert (unknown.actor_user_id, unknown.actor_label, unknown.target_label) == (
        None,
        "nobody@acme.com",
        "nobody@acme.com",
    )
    assert unknown.details == {"reason": "unknown_account"}
    assert (login.target_kind, login.target_id, login.details) == (
        "account",
        pat.id,
        {"method": "password"},
    )
    # The same trail, a line each, in auth.log.
    lines = [r.message for r in caplog.records if r.name == "app.auth"]
    for action in [event.action for event in events]:
        assert any(line.startswith(f"{action} user=") for line in lines), action


def test_the_second_factor_is_recorded_with_its_failures_and_backup_codes(
    client: TestClient, db_session: Session
) -> None:
    signup = client.post(
        "/api/v1/organizations",
        json={
            "organization": {"name": "Acme", "tax_id": None},
            "admin": {"email": "ada@acme.com", "password": PASSWORD, "full_name": "Ada"},
            "accepted_legal": [],
        },
    )
    assert signup.status_code == 201, signup.text
    secret = _enroll(client)
    codes = client.post(
        "/api/v1/auth/totp/backup-codes/regenerate",
        json={"password": PASSWORD},
        headers=_csrf(client),
    ).json()["backup_codes"]
    _logout(client)

    pending = _login(client, "ada@acme.com").json()["mfa_pending_token"]
    verify = "/api/v1/auth/login/verify-totp"
    wrong = client.post(verify, json={"mfa_pending_token": pending, "code": "000000"})
    assert wrong.status_code == 400
    ok = client.post(verify, json={"mfa_pending_token": pending, "code": _code(secret, 1)})
    assert ok.status_code == 200, ok.text
    _logout(client)
    pending = _login(client, "ada@acme.com").json()["mfa_pending_token"]
    backup = client.post(verify, json={"mfa_pending_token": pending, "code": codes[0]})
    assert backup.status_code == 200, backup.text

    events = _auth_events(db_session)
    assert [event.action for event in events] == [
        "auth.register",
        "auth.totp_enable",
        "auth.backup_codes_regenerate",
        "auth.logout",
        "auth.mfa_failed",
        "auth.login",
        "auth.logout",
        "auth.backup_code_login",
    ]
    assert events[0].details == {"via": "organization"}
    assert events[5].details == {"method": "totp"}


def test_a_locked_second_factor_is_recorded(client: TestClient, db_session: Session) -> None:
    _register(client, "pat@acme.com")
    _enroll(client)
    _logout(client)
    user = db_session.exec(select(User).where(User.email == "pat@acme.com")).one()
    user.mfa_failed_attempts = 9
    user.mfa_failed_since = datetime.now(UTC)
    db_session.add(user)
    db_session.commit()

    pending = _login(client, "pat@acme.com").json()["mfa_pending_token"]
    client.post(
        "/api/v1/auth/login/verify-totp", json={"mfa_pending_token": pending, "code": "000000"}
    )

    assert _actions(db_session)[-2:] == ["auth.mfa_locked", "auth.mfa_failed"]


def test_with_a_collector_set_every_attempt_is_queued_for_it(
    admin: TestClient,  # noqa: F811
    db_session: Session,
) -> None:
    assert _set_webhook(admin).status_code == 200

    with TestClient(app) as stranger:
        assert _login(stranger, "nobody@acme.com").status_code == 401

    db_session.expire_all()
    queued = db_session.exec(
        select(PlatformAuditEvent.action)
        .join(PlatformAuditDelivery, PlatformAuditDelivery.event_id == PlatformAuditEvent.id)
        .order_by(PlatformAuditDelivery.created_at)
    ).all()
    assert queued == ["audit_webhook.update", "auth.login_failed"]
