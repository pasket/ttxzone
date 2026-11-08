"""The AI assistant's switch (Platform) and personal access tokens
(Preferences): created with step-up and the notice acknowledged, shown
once, and accepted by the MCP endpoint only."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    PersonalAccessToken,
    PlatformAuditEvent,
    User,
)
from app.services.assistant.switch import ASSISTANT_DISCLAIMER_VERSION
from tests.assistant_helpers import TOKENS, create_token, enable_assistant, mcp
from tests.test_instance_tenancy import _make_admin, _register, _stale_sign_in
from tests.test_ttx_needs_form import _csrf

# --- Platform switch ----------------------------------------------------------


def test_platform_turns_the_assistant_on_with_step_up(
    client: TestClient, db_session: Session
) -> None:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")

    read = client.get("/api/v1/instance/assistant").json()
    assert read == {
        "enabled": False,
        "pinned_by_env": False,
        "disclaimer_version": ASSISTANT_DISCLAIMER_VERSION,
        "active_tokens": 0,
    }
    assert client.get("/api/v1/instance/policy").json()["assistant_enabled"] is False

    saved = client.put("/api/v1/instance/assistant", json={"enabled": True}, headers=_csrf(client))
    assert saved.status_code == 200, saved.text
    assert saved.json()["enabled"] is True
    assert client.get("/api/v1/instance/policy").json()["assistant_enabled"] is True
    [event] = db_session.exec(
        select(PlatformAuditEvent).where(PlatformAuditEvent.action == "assistant.settings_update")
    ).all()
    assert event.details == {"before": False, "after": True}

    _stale_sign_in(db_session, "ops@acme.com")
    stale = client.put("/api/v1/instance/assistant", json={"enabled": False}, headers=_csrf(client))
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"


def test_the_environment_pins_the_switch(
    client: TestClient, db_session: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    monkeypatch.setattr(settings, "ASSISTANT_ENABLED", True)

    read = client.get("/api/v1/instance/assistant").json()
    refused = client.put(
        "/api/v1/instance/assistant", json={"enabled": False}, headers=_csrf(client)
    )

    assert read["enabled"] is True and read["pinned_by_env"] is True
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "ASSISTANT_PINNED_BY_ENV"


def test_only_an_instance_administrator_reaches_the_switch(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    assert client.get("/api/v1/instance/assistant").status_code == 403


# --- Tokens -------------------------------------------------------------------


def test_a_token_is_shown_once_and_stored_as_a_hash(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    created = create_token(client)

    assert created["token"].startswith("ttxz_")
    assert created["prefix"] == created["token"][:9]
    listed = client.get(TOKENS).json()
    assert listed["enabled"] is True
    assert [t["id"] for t in listed["items"]] == [created["id"]]
    assert "token" not in listed["items"][0]
    row = db_session.exec(select(PersonalAccessToken)).one()
    assert created["token"] not in (row.token_hash, row.prefix)
    assert row.disclaimer_version == ASSISTANT_DISCLAIMER_VERSION
    assert row.expires_at - row.created_at == timedelta(days=30)
    actions = db_session.exec(
        select(PlatformAuditEvent.action).where(PlatformAuditEvent.action.like("auth.token%"))
    ).all()
    assert actions == ["auth.token_create"]


def test_creating_a_token_needs_the_notice_step_up_and_the_switch(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    base = {"name": "Claude", "expires_in_days": 30}

    unacknowledged = client.post(
        TOKENS,
        json={**base, "acknowledge": False, "disclaimer_version": ASSISTANT_DISCLAIMER_VERSION},
        headers=_csrf(client),
    )
    outdated = client.post(
        TOKENS,
        json={**base, "acknowledge": True, "disclaimer_version": "0"},
        headers=_csrf(client),
    )
    too_long = client.post(
        TOKENS,
        json={**base, "expires_in_days": 365, "acknowledge": True, "disclaimer_version": "1"},
        headers=_csrf(client),
    )
    assert unacknowledged.json()["error"]["code"] == "ASSISTANT_DISCLAIMER_REQUIRED"
    assert outdated.json()["error"]["code"] == "ASSISTANT_DISCLAIMER_REQUIRED"
    assert too_long.status_code == 422

    enable_assistant(db_session, False)
    disabled = client.post(
        TOKENS,
        json={**base, "acknowledge": True, "disclaimer_version": ASSISTANT_DISCLAIMER_VERSION},
        headers=_csrf(client),
    )
    assert disabled.status_code == 409
    assert disabled.json()["error"]["code"] == "ASSISTANT_DISABLED"

    enable_assistant(db_session)
    _stale_sign_in(db_session, "planner@acme.com")
    stale = client.post(
        TOKENS,
        json={**base, "acknowledge": True, "disclaimer_version": ASSISTANT_DISCLAIMER_VERSION},
        headers=_csrf(client),
    )
    assert stale.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"


def test_at_most_five_active_tokens(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    for n in range(5):
        create_token(client, f"client {n}")

    sixth = client.post(
        TOKENS,
        json={
            "name": "one more",
            "expires_in_days": 7,
            "acknowledge": True,
            "disclaimer_version": ASSISTANT_DISCLAIMER_VERSION,
        },
        headers=_csrf(client),
    )

    assert sixth.status_code == 409
    assert sixth.json()["error"]["code"] == "ASSISTANT_TOKEN_LIMIT"


def test_a_revoked_or_expired_token_is_refused(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    revoked = create_token(client, "old laptop")
    expired = create_token(client, "expired")
    row = db_session.get(PersonalAccessToken, uuid.UUID(expired["id"]))
    row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    db_session.add(row)
    db_session.commit()

    assert client.delete(f"{TOKENS}/{revoked['id']}", headers=_csrf(client)).status_code == 204
    again = client.delete(f"{TOKENS}/{revoked['id']}", headers=_csrf(client))

    assert again.status_code == 404
    for secret in (revoked["token"], expired["token"], "ttxz_made-up"):
        refused = mcp(client, secret, "ping")
        assert refused.status_code == 401
        assert refused.headers["WWW-Authenticate"].startswith("Bearer")
        assert "Preferences" in refused.json()["error"]["message"]
    assert [t["expired"] for t in client.get(TOKENS).json()["items"]] == [True]


def test_a_suspended_account_or_the_switch_turned_off_stops_its_tokens(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]
    assert mcp(client, token, "ping").status_code == 200

    enable_assistant(db_session, False)
    off = mcp(client, token, "ping")
    enable_assistant(db_session)
    user = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()
    user.suspended_at = datetime.now(UTC)
    db_session.add(user)
    db_session.commit()
    suspended = mcp(client, token, "ping")

    assert off.status_code == 403
    assert off.json()["error"]["data"]["code"] == "ASSISTANT_DISABLED"
    assert suspended.status_code == 401


def test_ending_the_sessions_revokes_the_tokens(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]

    assert client.delete("/api/v1/auth/sessions", headers=_csrf(client)).status_code == 204

    assert mcp(client, token, "ping").status_code == 401
    assert client.get(TOKENS).json()["items"] == []


def test_a_token_authenticates_only_the_mcp_endpoint_and_a_cookie_never_does(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]

    # Signed in with the cookie, but no token: refused.
    assert mcp(client, None, "ping").status_code == 401
    client.cookies.clear()
    elsewhere = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    exercises = client.get("/api/v1/ttx", headers={"Authorization": f"Bearer {token}"})

    assert elsewhere.status_code == 401
    assert exercises.status_code == 401
    assert mcp(client, token, "ping").status_code == 200


def test_a_token_meets_the_account_gates(
    client: TestClient, db_session: Session, assistant_planner: dict
) -> None:
    token = create_token(client)["token"]
    user = db_session.exec(select(User).where(User.email == "planner@acme.com")).one()
    user.password_change_required = True
    db_session.add(user)
    db_session.commit()

    held = mcp(client, token, "ping")

    assert held.status_code == 403
    assert held.json()["error"]["data"]["code"] == "PASSWORD_CHANGE_REQUIRED"


def test_deleting_an_account_deletes_its_tokens_and_call_records(
    client: TestClient, db_session: Session
) -> None:
    from app.models import AssistantCall
    from tests.test_account_admin import _another, _delete

    _register(client, "ops@acme.com")
    _make_admin(db_session, "ops@acme.com")
    pat = _another(db_session)
    now = datetime.now(UTC)
    token = PersonalAccessToken(
        user_id=pat.id,
        name="laptop",
        prefix="ttxz_abcd",
        token_hash="0" * 64,
        expires_at=now + timedelta(days=7),
        disclaimer_version=ASSISTANT_DISCLAIMER_VERSION,
        acknowledged_at=now,
    )
    db_session.add(token)
    db_session.commit()
    db_session.add(
        AssistantCall(user_id=pat.id, token_id=token.id, tool="list_exercises", outcome="ok")
    )
    db_session.commit()

    assert _delete(client, pat).status_code == 204

    db_session.expire_all()
    assert db_session.exec(select(PersonalAccessToken)).all() == []
    assert db_session.exec(select(AssistantCall)).all() == []
