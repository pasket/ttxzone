"""A one-time code by email as a second factor: turned on with a code,
asked at sign-in and step-up, single use, bound to the address, sharing
TOTP's wrong-code limits, never counting for the roles where two-factor
is mandatory, and skipped (recorded) while the deployment can't send it."""

import logging
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import AccountToken, EmailOutbox, User
from app.services import email_mfa_service
from tests.test_account_email import _actions, _email_off, _email_on, _outbox, _params, _user
from tests.test_instance_tenancy import PASSWORD, _csrf, _register, _signup
from tests.test_session_policy import _code, _enable_totp


def _last_code(db_session: Session) -> str:
    [*_, row] = [m for m in _outbox(db_session) if m.template == "mfa_code"]
    return _params(row)["code"]


def _allow_resend(db_session: Session) -> None:
    """Past the minute between codes."""
    db_session.expire_all()
    for row in db_session.exec(select(AccountToken)).all():
        row.created_at -= email_mfa_service.RESEND_COOLDOWN
        db_session.add(row)
    db_session.commit()


def _turn_on(client: TestClient, db_session: Session) -> None:
    sent = client.post("/api/v1/auth/mfa/email/enable", headers=_csrf(client))
    assert sent.status_code == 200, sent.text
    assert sent.json()["sent_to"] == "p•••@acme.com"
    confirmed = client.post(
        "/api/v1/auth/mfa/email/enable/confirm",
        json={"code": _last_code(db_session)},
        headers=_csrf(client),
    )
    assert confirmed.status_code == 204, confirmed.text
    _allow_resend(db_session)


def _player_with_email_code(client: TestClient, db_session: Session) -> None:
    _email_on(db_session)
    _register(client, "pat@acme.com")
    user = _user(db_session, "pat@acme.com")
    user.email_verification_required = False
    db_session.add(user)
    db_session.commit()
    _turn_on(client, db_session)


def _start_login(other: TestClient) -> dict:
    response = other.post(
        "/api/v1/auth/login", json={"email": "pat@acme.com", "password": PASSWORD}
    )
    assert response.status_code == 200, response.text
    return response.json()


def _verify(other: TestClient, token: str, code: str, method: str | None = "email"):
    return other.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": token, "code": code, "method": method},
    )


def test_signing_in_asks_for_a_code_sent_by_email_that_works_once(
    client: TestClient, db_session: Session
) -> None:
    _player_with_email_code(client, db_session)
    me = client.get("/api/v1/auth/me").json()
    assert (me["email_mfa_enabled"], me["mfa_methods"], me["mfa_preferred"]) == (
        True,
        ["email"],
        "email",
    )

    with TestClient(app) as other:
        challenge = _start_login(other)
        assert challenge["mfa_required"] is True
        assert (challenge["mfa_methods"], challenge["mfa_preferred"]) == (["email"], "email")
        token = challenge["mfa_pending_token"]
        listed = other.post("/api/v1/auth/login/challenge", json={"mfa_pending_token": token})
        assert listed.json() == {"mfa_methods": ["email"], "mfa_preferred": "email"}

        assert other.post(
            "/api/v1/auth/login/email-code", json={"mfa_pending_token": token}
        ).json() == {"sent_to": "p•••@acme.com"}
        # The next one waits a minute.
        again = other.post("/api/v1/auth/login/email-code", json={"mfa_pending_token": token})
        assert again.json()["error"]["code"] == "EMAIL_CODE_RATE_LIMITED"
        code = _last_code(db_session)
        [message] = [m for m in _outbox(db_session) if m.template == "mfa_code"][-1:]
        assert code not in message.to_address
        # Only the code's keyed digest is stored.
        assert all(code not in row.token_hash for row in db_session.exec(select(AccountToken)))

        assert _verify(other, token, code).status_code == 200
        assert other.get("/api/v1/auth/me").status_code == 200

    with TestClient(app) as third:
        token = _start_login(third)["mfa_pending_token"]
        # Spent: the same code doesn't open a second session.
        assert _verify(third, token, code).json()["error"]["code"] == "INVALID_TOTP_CODE"
    assert "auth.mfa_email_enable" in _actions(db_session)
    assert "auth.mfa_email_sent" in _actions(db_session)


def test_the_subject_never_carries_the_code(client: TestClient, db_session: Session) -> None:
    from app.services import email_service

    subject, text, html = email_service.render(
        "mfa_code", "es", {"name": "Pat", "code": "482913", "minutes": 10}
    )
    assert "482913" not in subject
    assert "482913" in text and "482913" in html


def test_an_expired_code_or_one_sent_to_a_previous_address_is_refused(
    client: TestClient, db_session: Session
) -> None:
    _player_with_email_code(client, db_session)
    with TestClient(app) as other:
        token = _start_login(other)["mfa_pending_token"]
        other.post("/api/v1/auth/login/email-code", json={"mfa_pending_token": token})
        row = db_session.exec(
            select(AccountToken).where(AccountToken.purpose == email_mfa_service.PURPOSE)
        ).one()
        row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db_session.add(row)
        db_session.commit()
        assert _verify(other, token, _last_code(db_session)).status_code == 400

        _allow_resend(db_session)
        other.post("/api/v1/auth/login/email-code", json={"mfa_pending_token": token})
        user = _user(db_session, "pat@acme.com")
        user.email = "pat@other.com"
        db_session.add(user)
        db_session.commit()
        assert _verify(other, token, _last_code(db_session)).status_code == 400


def test_wrong_codes_share_the_limits_of_the_authenticator(
    client: TestClient, db_session: Session
) -> None:
    _player_with_email_code(client, db_session)
    secret = _enable_totp(db_session, "pat@acme.com")
    with TestClient(app) as other:
        challenge = _start_login(other)
        assert challenge["mfa_methods"] == ["totp", "email", "backup_code"]
        token = challenge["mfa_pending_token"]
        for _ in range(4):
            assert _verify(other, token, "000000").status_code == 400
        # The fifth, by the other method, withdraws the challenge.
        assert _verify(other, token, "000000", "totp").status_code == 400
        withdrawn = _verify(other, token, _code(secret), "totp")
        assert withdrawn.json()["error"]["code"] == "MFA_CHALLENGE_EXPIRED"


def test_both_methods_open_on_the_preferred_one(client: TestClient, db_session: Session) -> None:
    _player_with_email_code(client, db_session)
    secret = _enable_totp(db_session, "pat@acme.com")
    assert client.get("/api/v1/auth/me").json()["mfa_preferred"] == "totp"

    assert (
        client.put(
            "/api/v1/auth/mfa/preferred", json={"method": "email"}, headers=_csrf(client)
        ).status_code
        == 204
    )
    with TestClient(app) as other:
        challenge = _start_login(other)
        assert challenge["mfa_preferred"] == "email"
        # Either still works.
        assert (
            _verify(other, challenge["mfa_pending_token"], _code(secret), "totp").status_code == 200
        )

    # Turning email off falls back to the authenticator.
    client.post("/api/v1/auth/step-up", json={"code": _code(secret, 1)}, headers=_csrf(client))
    assert client.delete("/api/v1/auth/mfa/email", headers=_csrf(client)).status_code == 204
    me = client.get("/api/v1/auth/me").json()
    assert (me["email_mfa_enabled"], me["mfa_preferred"]) == (False, "totp")
    refused = client.put(
        "/api/v1/auth/mfa/preferred", json={"method": "email"}, headers=_csrf(client)
    )
    assert refused.json()["error"]["code"] == "MFA_METHOD_NOT_ENROLLED"


def test_an_account_whose_only_factor_is_email_steps_up_with_a_code(
    client: TestClient, db_session: Session
) -> None:
    _player_with_email_code(client, db_session)
    # The password alone isn't enough any more.
    by_password = client.post(
        "/api/v1/auth/step-up", json={"password": PASSWORD}, headers=_csrf(client)
    )
    assert by_password.json()["error"]["code"] == "INVALID_TOTP_CODE"

    _allow_resend(db_session)
    sent = client.post("/api/v1/auth/step-up/email-code", headers=_csrf(client))
    assert sent.status_code == 200
    stepped = client.post(
        "/api/v1/auth/step-up",
        json={"code": _last_code(db_session), "method": "email"},
        headers=_csrf(client),
    )
    assert stepped.status_code == 204, stepped.text


def test_email_never_meets_the_mandate_of_a_privileged_role(
    client: TestClient, db_session: Session
) -> None:
    _email_on(db_session)
    founded = _signup(client, "pat@acme.com", "Acme")
    assert founded.status_code == 201, founded.text
    org_id = founded.json()["organization"]["id"]
    user = _user(db_session, "pat@acme.com")
    user.email_verification_required = False
    db_session.add(user)
    db_session.commit()
    _turn_on(client, db_session)

    # A Program Manager with an email code but no authenticator is still
    # held at the mandatory-TOTP gate.
    members = client.get(f"/api/v1/organizations/{org_id}/members")
    assert members.json()["error"]["code"] == "MFA_REQUIRED"


def test_while_email_is_off_an_email_only_account_signs_in_with_its_password(
    client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    _player_with_email_code(client, db_session)
    _email_off(db_session)
    with TestClient(app) as other, caplog.at_level(logging.WARNING, logger="app.auth"):
        signed_in = _start_login(other)
        assert signed_in["mfa_required"] is False
    assert "auth.mfa_skipped" in _actions(db_session)
    assert client.get("/api/v1/auth/me").json()["mfa_methods"] == []


def test_codes_never_reach_the_logs(
    client: TestClient, db_session: Session, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.DEBUG):
        _player_with_email_code(client, db_session)
        code = _last_code(db_session)
    assert code not in caplog.text


def test_resetting_two_factor_from_platform_turns_the_email_code_off(
    client: TestClient, db_session: Session
) -> None:
    from app.services import account_admin_service

    _player_with_email_code(client, db_session)
    admin = User(email="root@acme.com", full_name="Root", is_instance_admin=True)
    db_session.add(admin)
    db_session.commit()
    account_admin_service.reset_two_factor(db_session, admin, _user(db_session, "pat@acme.com"))
    user = _user(db_session, "pat@acme.com")
    assert (user.email_mfa_enabled, user.mfa_preferred) == (False, None)
    assert db_session.exec(select(EmailOutbox)).first() is not None
