"""Platform -> Security: password rules on top of the fixed floor and the
second-factor mandate per role, set by an instance administrator."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from starlette.requests import Request

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.security import RequiresOrgAndTTXAccess
from app.main import app
from app.models import (
    INSTANCE_SETTINGS_ID,
    TTX,
    InstanceSettings,
    Organization,
    PasswordHistory,
    PlatformAuditEvent,
    RoleEnum,
    TTXAccess,
    User,
    UserSession,
)

PASSWORD = "Correcthorse123!"

DEFAULT_PASSWORD = {
    "min_length": 8,
    "reject_personal": False,
    "max_age_days": None,
    "history_count": 0,
}
DEFAULT_MFA = {
    "program_manager": True,
    "planner": True,
    "evaluator": True,
    "observer": True,
    "player": False,
}


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _register(client: TestClient, email: str, full_name: str = "Pat Smith", password=PASSWORD):
    return client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password, "full_name": full_name},
    )


def _store(db_session: Session, **fields) -> None:
    stored = db_session.get(InstanceSettings, INSTANCE_SETTINGS_ID) or InstanceSettings(
        id=INSTANCE_SETTINGS_ID
    )
    for name, value in fields.items():
        setattr(stored, name, value)
    db_session.add(stored)
    db_session.commit()


def _change(client: TestClient, current: str, new: str):
    return client.post(
        "/api/v1/auth/password",
        json={"current_password": current, "new_password": new},
        headers=_csrf(client),
    )


def _admin(client: TestClient, db_session: Session) -> User:
    assert _register(client, "ops@acme.com").status_code == 201
    user = db_session.exec(select(User).where(User.email == "ops@acme.com")).one()
    user.is_instance_admin = True
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return user


def test_defaults_keep_todays_rules(client: TestClient, db_session: Session) -> None:
    _admin(client, db_session)
    body = client.get("/api/v1/instance/security-policy").json()
    assert body["password"] == DEFAULT_PASSWORD
    assert body["mfa"] == DEFAULT_MFA
    policy = client.get("/api/v1/instance/policy").json()
    assert policy["password_min_length"] == 8
    assert policy["password_reject_personal"] is False


def test_update_needs_an_instance_admin_and_step_up_and_is_audited(
    client: TestClient, db_session: Session
) -> None:
    payload = {
        "password": {**DEFAULT_PASSWORD, "min_length": 12},
        "mfa": {**DEFAULT_MFA, "player": True},
    }
    with TestClient(app) as other:
        assert _register(other, "nobody@acme.com").status_code == 201
        refused = other.put("/api/v1/instance/security-policy", json=payload, headers=_csrf(other))
        assert refused.status_code == 403

    admin = _admin(client, db_session)
    for row in db_session.exec(select(UserSession).where(UserSession.user_id == admin.id)):
        row.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(row)
    db_session.commit()
    stale = client.put("/api/v1/instance/security-policy", json=payload, headers=_csrf(client))
    assert stale.status_code == 403
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"

    for row in db_session.exec(select(UserSession).where(UserSession.user_id == admin.id)):
        row.authenticated_at = datetime.now(UTC)
        db_session.add(row)
    db_session.commit()
    saved = client.put("/api/v1/instance/security-policy", json=payload, headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    assert saved.json()["password"]["min_length"] == 12
    assert saved.json()["mfa"]["player"] is True
    event = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "security_policy.update")
    ).one()
    assert event.details["before"]["password"]["min_length"] == 8
    assert event.details["after"]["mfa"]["player"] is True


@pytest.mark.parametrize("min_length", [7, 65])
def test_min_length_bounds(client: TestClient, db_session: Session, min_length: int) -> None:
    _admin(client, db_session)
    response = client.put(
        "/api/v1/instance/security-policy",
        json={"password": {**DEFAULT_PASSWORD, "min_length": min_length}, "mfa": DEFAULT_MFA},
        headers=_csrf(client),
    )
    assert response.status_code == 422


def test_min_length_applies_to_new_passwords(client: TestClient, db_session: Session) -> None:
    _store(db_session, password_min_length=20)
    short = _register(client, "pat@acme.com")
    assert short.status_code == 422
    assert short.json()["error"]["code"] == "PASSWORD_POLICY"
    assert "20" in short.json()["error"]["message"]
    assert _register(client, "pat@acme.com", password="Correcthorse123!-long-x").status_code == 201
    refused = _change(client, "Correcthorse123!-long-x", "Shorter-pass-1!")
    assert refused.status_code == 422
    assert refused.json()["error"]["code"] == "PASSWORD_POLICY"


def test_personal_data_refused_when_on(client: TestClient, db_session: Session) -> None:
    _store(db_session, password_reject_personal=True)
    by_name = _register(client, "pat@acme.com", "Pat Gonzalez", password="Gonzalez-2026!")
    assert by_name.status_code == 422
    by_email = _register(client, "jsmith@acme.com", "Jo", password="Jsmith-2026-x!")
    assert by_email.status_code == 422
    assert _register(client, "pat@acme.com", "Pat Gonzalez").status_code == 201


def test_reuse_of_the_last_passwords_refused(client: TestClient, db_session: Session) -> None:
    _store(db_session, password_history_count=3)
    assert _register(client, "pat@acme.com").status_code == 201
    assert _change(client, PASSWORD, "Second-pass-22!").status_code == 204
    assert _change(client, "Second-pass-22!", "Third-pass-333!").status_code == 204
    for old in (PASSWORD, "Second-pass-22!", "Third-pass-333!"):
        refused = _change(client, "Third-pass-333!", old)
        assert refused.status_code == 422, old
        assert refused.json()["error"]["code"] == "PASSWORD_POLICY"
    assert _change(client, "Third-pass-333!", "Fourth-pass-4444!").status_code == 204
    # The first one fell out of the last three.
    assert _change(client, "Fourth-pass-4444!", PASSWORD).status_code == 204
    user = db_session.exec(select(User).where(User.email == "pat@acme.com")).one()
    kept = db_session.exec(select(PasswordHistory).where(PasswordHistory.user_id == user.id)).all()
    assert len(kept) == 2


def test_expired_password_must_be_changed(client: TestClient, db_session: Session) -> None:
    assert _register(client, "pat@acme.com").status_code == 201
    _store(db_session, password_max_age_days=30)
    user = db_session.exec(select(User).where(User.email == "pat@acme.com")).one()
    user.password_changed_at = datetime.now(UTC) - timedelta(days=31)
    db_session.add(user)
    db_session.commit()

    me = client.get("/api/v1/auth/me").json()
    assert me["password_change_required"] is True
    assert me["password_change_reason"] == "expired"
    blocked = client.get("/api/v1/organizations/mine")
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "PASSWORD_CHANGE_REQUIRED"

    assert _change(client, PASSWORD, "Fresh-password-9!").status_code == 204
    me = client.get("/api/v1/auth/me").json()
    assert me["password_change_required"] is False
    assert me["password_change_reason"] is None
    assert client.get("/api/v1/organizations/mine").status_code == 200


def _player_on_exercise(db_session: Session) -> tuple[User, TTX]:
    org = Organization(name="Acme")
    owner = User(email="owner@acme.com", hashed_password="unused", full_name="Owner")
    player = User(email="player@acme.com", hashed_password="unused", full_name="Player")
    db_session.add_all([org, owner, player])
    db_session.commit()
    ttx = TTX(name="Drill", organization_id=org.id, created_by_id=owner.id)
    db_session.add(ttx)
    db_session.commit()
    db_session.add(TTXAccess(user_id=player.id, ttx_id=ttx.id, role=RoleEnum.PLAYER))
    db_session.commit()
    db_session.refresh(player)
    db_session.refresh(ttx)
    return player, ttx


def _request(ttx_id: uuid.UUID) -> Request:
    return Request(scope={"type": "http", "method": "GET", "path_params": {"ttx_id": str(ttx_id)}})


def test_player_mandate_follows_the_policy(db_session: Session) -> None:
    player, ttx = _player_on_exercise(db_session)
    guard = RequiresOrgAndTTXAccess(RoleEnum.PLAYER)
    assert guard(_request(ttx.id), player, db_session).id == ttx.id

    _store(db_session, mfa_required_player=True)
    with pytest.raises(AppException) as raised:
        guard(_request(ttx.id), player, db_session)
    assert raised.value.code == "MFA_REQUIRED"


def test_observer_mandate_can_be_turned_off(db_session: Session) -> None:
    player, ttx = _player_on_exercise(db_session)
    access = db_session.exec(select(TTXAccess).where(TTXAccess.user_id == player.id)).one()
    access.role = RoleEnum.OBSERVER
    db_session.add(access)
    db_session.commit()
    guard = RequiresOrgAndTTXAccess(RoleEnum.OBSERVER)
    with pytest.raises(AppException):
        guard(_request(ttx.id), player, db_session)
    _store(db_session, mfa_required_observer=False)
    assert guard(_request(ttx.id), player, db_session).id == ttx.id


def test_me_reports_the_mandate_and_counts(client: TestClient, db_session: Session) -> None:
    assert _register(client, "pat@acme.com").status_code == 201
    assert client.get("/api/v1/auth/me").json()["mfa_mandated"] is False
    with TestClient(app) as admin_client:
        _admin(admin_client, db_session)
        assert admin_client.get("/api/v1/auth/me").json()["mfa_mandated"] is True
        player, _ = _player_on_exercise(db_session)
        counts = admin_client.get("/api/v1/instance/security-policy").json()
        assert counts["accounts_without_totp"]["player"] == 1
        assert counts["accounts_without_totp"]["program_manager"] == 0
