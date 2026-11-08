"""Periodic reconfirmation of the email address: off by default; once set,
an account whose address was confirmed longer ago than the period is sent
a link at sign-in and keeps working for a grace period, then reaches only
itself until it opens the link. Never while the deployment sends no email."""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import (
    INSTANCE_SETTINGS_ID,
    EmailOutbox,
    InstanceSettings,
    PlatformAuditEvent,
    User,
)
from app.services import account_email_service
from tests.test_account_email import _email_off, _email_on, _params, _token
from tests.test_instance_tenancy import PASSWORD, _csrf, _make_admin, _register, _stale_sign_in

EMAIL = "pat@acme.com"


def _rule(db_session: Session, days: int | None) -> None:
    row = db_session.get(InstanceSettings, INSTANCE_SETTINGS_ID) or InstanceSettings(
        id=INSTANCE_SETTINGS_ID
    )
    row.email_reconfirmation_days = days
    db_session.add(row)
    db_session.commit()


def _user(db_session: Session, email: str = EMAIL) -> User:
    db_session.expire_all()
    return db_session.exec(select(User).where(User.email == email)).one()


def _confirmed_ago(db_session: Session, days: int, email: str = EMAIL) -> None:
    user = _user(db_session, email)
    user.email_verified_at = datetime.now(UTC) - timedelta(days=days)
    db_session.add(user)
    db_session.commit()


def _reconfirmations(db_session: Session) -> list[EmailOutbox]:
    db_session.expire_all()
    return list(
        db_session.exec(select(EmailOutbox).where(EmailOutbox.template == "email_reconfirmation"))
    )


def _sign_in(client: TestClient, email: str = EMAIL) -> None:
    client.cookies.clear()
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, response.text


@pytest.fixture
def account(client: TestClient, db_session: Session) -> TestClient:
    """An account created while email was off (never asked to confirm at
    signup), then email turned on."""
    _register(client, EMAIL)
    _email_on(db_session)
    return client


def test_off_by_default_nothing_is_asked(account: TestClient, db_session: Session) -> None:
    _sign_in(account)

    assert _reconfirmations(db_session) == []
    assert _user(db_session).email_reconfirm_deadline is None
    assert account.get("/api/v1/auth/me").json()["email_reconfirm_deadline"] is None


def test_a_recent_confirmation_needs_nothing(account: TestClient, db_session: Session) -> None:
    _rule(db_session, 30)
    _confirmed_ago(db_session, 10)

    _sign_in(account)

    assert _reconfirmations(db_session) == []


def test_a_stale_address_is_asked_then_held_until_confirmed(
    account: TestClient, db_session: Session
) -> None:
    _rule(db_session, 30)
    _confirmed_ago(db_session, 40)

    _sign_in(account)

    [message] = _reconfirmations(db_session)
    assert _params(message)["days"] == account_email_service.RECONFIRMATION_GRACE.days
    deadline = _user(db_session).email_reconfirm_deadline
    assert deadline is not None
    assert deadline > datetime.now(UTC) + timedelta(days=13)
    me = account.get("/api/v1/auth/me").json()
    assert me["email_reconfirm_deadline"] is not None
    assert me["email_reconfirmation_overdue"] is False
    # In the grace period the account works as usual.
    assert account.get("/api/v1/organizations/mine").status_code == 200
    # Signing in again doesn't ask twice.
    _sign_in(account)
    assert len(_reconfirmations(db_session)) == 1

    user = _user(db_session)
    user.email_reconfirm_deadline = datetime.now(UTC) - timedelta(minutes=1)
    db_session.add(user)
    db_session.commit()

    held = account.get("/api/v1/organizations/mine")
    assert held.status_code == 403
    assert held.json()["error"]["code"] == "EMAIL_RECONFIRMATION_REQUIRED"
    assert account.get("/api/v1/auth/me").json()["email_reconfirmation_overdue"] is True

    with TestClient(app) as other:
        opened = other.post("/api/v1/auth/email/verify", json={"token": _token(message)})
        assert opened.status_code == 204, opened.text

    user = _user(db_session)
    assert user.email_reconfirm_deadline is None
    assert user.email_verified_at > datetime.now(UTC) - timedelta(minutes=1)
    assert account.get("/api/v1/organizations/mine").status_code == 200


def test_a_held_account_can_ask_for_a_new_link(account: TestClient, db_session: Session) -> None:
    _rule(db_session, 30)
    _confirmed_ago(db_session, 40)
    user = _user(db_session)
    user.email_reconfirm_deadline = datetime.now(UTC) - timedelta(days=1)
    db_session.add(user)
    db_session.commit()
    _sign_in(account)

    response = account.post("/api/v1/auth/email/verification", headers=_csrf(account))

    assert response.status_code == 202, response.text
    assert len(_reconfirmations(db_session)) == 1


def test_never_held_while_the_deployment_sends_no_email(
    account: TestClient, db_session: Session
) -> None:
    _rule(db_session, 30)
    _confirmed_ago(db_session, 40)
    user = _user(db_session)
    user.email_reconfirm_deadline = datetime.now(UTC) - timedelta(days=1)
    db_session.add(user)
    db_session.commit()
    _sign_in(account)

    assert account.get("/api/v1/organizations/mine").status_code == 403

    _email_off(db_session)

    assert account.get("/api/v1/organizations/mine").status_code == 200


def test_platform_sets_the_period_with_step_up(client: TestClient, db_session: Session) -> None:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")

    assert client.get("/api/v1/instance/email/reconfirmation").json() == {
        "days": None,
        "pinned_by_env": False,
        "grace_days": 14,
    }
    too_short = client.put(
        "/api/v1/instance/email/reconfirmation", json={"days": 7}, headers=_csrf(client)
    )
    assert too_short.status_code == 422
    saved = client.put(
        "/api/v1/instance/email/reconfirmation", json={"days": 365}, headers=_csrf(client)
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["days"] == 365
    [event] = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "email.reconfirmation_update")
    ).all()
    assert event.details == {"before": None, "after": 365}

    _stale_sign_in(db_session, "ops@acme.com")
    stale = client.put(
        "/api/v1/instance/email/reconfirmation", json={"days": None}, headers=_csrf(client)
    )
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"


def test_the_environment_pins_the_period(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    monkeypatch.setattr(settings, "EMAIL_RECONFIRMATION_DAYS", 0)

    read = client.get("/api/v1/instance/email/reconfirmation").json()
    assert (read["days"], read["pinned_by_env"]) == (None, True)
    refused = client.put(
        "/api/v1/instance/email/reconfirmation", json={"days": 90}, headers=_csrf(client)
    )
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "EMAIL_RECONFIRMATION_PINNED_BY_ENV"
