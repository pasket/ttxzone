"""Session policy: soft (inactivity) and hard (absolute) timeouts, server-side
revocation, step-up re-authentication and the second factor's limits."""

from datetime import UTC, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import User, UserSession
from app.services import totp_service

PASSWORD = "Correcthorse123!"


def _signup(client: TestClient, email: str) -> dict:
    payload = {
        "organization": {"name": email.split("@")[0], "tax_id": None},
        "admin": {"email": email, "password": PASSWORD, "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _register_player(client: TestClient, email: str) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": PASSWORD, "full_name": "Pat"},
    )
    assert response.status_code == 201


def _csrf(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _login(client: TestClient, email: str) -> None:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    assert response.json()["mfa_required"] is False


def _enable_totp(db_session: Session, email: str) -> str:
    secret = pyotp.random_base32()
    user = db_session.exec(select(User).where(User.email == email)).one()
    totp_service.store_secret(user, secret)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()
    return secret


def _code(secret: str, steps_ago: int = 0) -> str:
    totp = pyotp.TOTP(secret)
    return totp.at(datetime.now(UTC) - timedelta(seconds=30 * steps_ago))


def _pending(client: TestClient, email: str) -> str:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    return response.json()["mfa_pending_token"]


def _sessions(db_session: Session, email: str) -> list[UserSession]:
    user = db_session.exec(select(User).where(User.email == email)).one()
    db_session.expire_all()
    return list(db_session.exec(select(UserSession).where(UserSession.user_id == user.id)).all())


def _shift(db_session: Session, user_session: UserSession, **fields: datetime) -> None:
    for name, value in fields.items():
        setattr(user_session, name, value)
    db_session.add(user_session)
    db_session.commit()


def test_privileged_and_player_sessions_get_their_idle_timeout(
    client: TestClient, db_session: Session
) -> None:
    _signup(client, "pm@acme.com")
    me = client.get("/api/v1/auth/me").json()
    assert me["session"]["idle_timeout_minutes"] == settings.SESSION_IDLE_MINUTES_PRIVILEGED

    with TestClient(app) as player:
        _register_player(player, "player@acme.com")
        info = player.get("/api/v1/auth/me").json()["session"]
        assert info["idle_timeout_minutes"] == settings.SESSION_IDLE_MINUTES_PLAYER
        absolute = datetime.fromisoformat(info["absolute_expires_at"])
        expected = datetime.now(UTC) + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)
        assert abs((absolute - expected).total_seconds()) < 60


def test_an_idle_session_ends(client: TestClient, db_session: Session) -> None:
    _signup(client, "idle@acme.com")
    (user_session,) = _sessions(db_session, "idle@acme.com")
    _shift(db_session, user_session, last_seen_at=datetime.now(UTC) - timedelta(minutes=31))

    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_activity_keeps_a_session_alive_but_background_requests_do_not(
    client: TestClient, db_session: Session
) -> None:
    _signup(client, "busy@acme.com")
    (user_session,) = _sessions(db_session, "busy@acme.com")
    stale = datetime.now(UTC) - timedelta(minutes=20)
    _shift(db_session, user_session, last_seen_at=stale)

    assert client.get("/api/v1/auth/me", headers={"X-Background-Request": "1"}).status_code == 200
    (user_session,) = _sessions(db_session, "busy@acme.com")
    assert user_session.last_seen_at == stale

    assert client.get("/api/v1/auth/me").status_code == 200
    (user_session,) = _sessions(db_session, "busy@acme.com")
    assert user_session.last_seen_at > stale + timedelta(minutes=19)


def test_the_hard_timeout_ends_an_active_session(client: TestClient, db_session: Session) -> None:
    _signup(client, "long@acme.com")
    (user_session,) = _sessions(db_session, "long@acme.com")
    _shift(db_session, user_session, absolute_expires_at=datetime.now(UTC) - timedelta(seconds=1))

    assert client.get("/api/v1/auth/me").status_code == 401


def test_logout_ends_the_session_server_side(client: TestClient, db_session: Session) -> None:
    _signup(client, "out@acme.com")
    cookie = client.cookies[settings.ACCESS_TOKEN_COOKIE_NAME]
    assert client.post("/api/v1/auth/logout", headers=_csrf(client)).status_code == 204

    # The cookie replayed after logout no longer works.
    client.cookies.set(settings.ACCESS_TOKEN_COOKIE_NAME, cookie)
    assert client.get("/api/v1/auth/me").status_code == 401


def test_changing_the_password_ends_the_other_sessions(
    client: TestClient, db_session: Session
) -> None:
    _signup(client, "pw@acme.com")
    with TestClient(app) as other:
        _login(other, "pw@acme.com")
        response = client.post(
            "/api/v1/auth/password",
            json={"current_password": PASSWORD, "new_password": "Brand-new-password-1!"},
            headers=_csrf(client),
        )
        assert response.status_code == 204
        assert other.get("/api/v1/auth/me").status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 200


def test_sessions_are_listed_and_revoked(client: TestClient, db_session: Session) -> None:
    _signup(client, "list@acme.com")
    with TestClient(app) as other:
        _login(other, "list@acme.com")
        items = client.get("/api/v1/auth/sessions").json()["items"]
        assert len(items) == 2
        assert [item["current"] for item in items].count(True) == 1
        other_id = next(item["id"] for item in items if not item["current"])

        response = client.delete(f"/api/v1/auth/sessions/{other_id}", headers=_csrf(client))
        assert response.status_code == 204
        assert other.get("/api/v1/auth/me").status_code == 401

        _login(other, "list@acme.com")
        assert client.delete("/api/v1/auth/sessions", headers=_csrf(client)).status_code == 204
        assert other.get("/api/v1/auth/me").status_code == 401
        assert len(client.get("/api/v1/auth/sessions").json()["items"]) == 1


def test_someone_elses_session_cannot_be_revoked(client: TestClient, db_session: Session) -> None:
    _signup(client, "mine@acme.com")
    with TestClient(app) as other:
        _signup(other, "theirs@acme.com")
        (theirs,) = _sessions(db_session, "theirs@acme.com")
        response = client.delete(f"/api/v1/auth/sessions/{theirs.id}", headers=_csrf(client))
        assert response.status_code == 404
        assert other.get("/api/v1/auth/me").status_code == 200


def test_the_oldest_session_ends_past_the_limit(client: TestClient, db_session: Session) -> None:
    _signup(client, "many@acme.com")
    for _ in range(settings.MAX_SESSIONS_PER_USER):
        with TestClient(app) as other:
            _login(other, "many@acme.com")
    assert client.get("/api/v1/auth/me").status_code == 401
    live = [s for s in _sessions(db_session, "many@acme.com") if s.revoked_at is None]
    assert len(live) == settings.MAX_SESSIONS_PER_USER


def test_sensitive_actions_need_a_recent_authentication(
    client: TestClient, db_session: Session
) -> None:
    _signup(client, "step@acme.com")
    (user_session,) = _sessions(db_session, "step@acme.com")
    _shift(db_session, user_session, authenticated_at=datetime.now(UTC) - timedelta(minutes=16))

    body = {"current_password": PASSWORD, "new_password": "Brand-new-password-1!"}
    response = client.post("/api/v1/auth/password", json=body, headers=_csrf(client))
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "REAUTHENTICATION_REQUIRED"

    # No TOTP on this account: the password confirms it's them.
    wrong = client.post("/api/v1/auth/step-up", json={"password": "nope"}, headers=_csrf(client))
    assert wrong.status_code == 401
    ok = client.post("/api/v1/auth/step-up", json={"password": PASSWORD}, headers=_csrf(client))
    assert ok.status_code == 204
    response = client.post("/api/v1/auth/password", json=body, headers=_csrf(client))
    assert response.status_code == 204


def test_step_up_with_totp_refuses_a_replayed_code(client: TestClient, db_session: Session) -> None:
    _signup(client, "totp@acme.com")
    secret = _enable_totp(db_session, "totp@acme.com")

    assert (
        client.post(
            "/api/v1/auth/step-up", json={"password": PASSWORD}, headers=_csrf(client)
        ).status_code
        == 400
    )
    code = _code(secret)
    first = client.post("/api/v1/auth/step-up", json={"code": code}, headers=_csrf(client))
    assert first.status_code == 204
    replay = client.post("/api/v1/auth/step-up", json={"code": code}, headers=_csrf(client))
    assert replay.status_code == 400
    older = client.post(
        "/api/v1/auth/step-up", json={"code": _code(secret, 1)}, headers=_csrf(client)
    )
    assert older.status_code == 400


def test_login_code_cannot_be_replayed(client: TestClient, db_session: Session) -> None:
    _signup(client, "replay@acme.com")
    secret = _enable_totp(db_session, "replay@acme.com")
    code = _code(secret)
    with TestClient(app) as browser:
        token = _pending(browser, "replay@acme.com")
        response = browser.post(
            "/api/v1/auth/login/verify-totp", json={"mfa_pending_token": token, "code": code}
        )
        assert response.status_code == 200
    with TestClient(app) as attacker:
        token = _pending(attacker, "replay@acme.com")
        response = attacker.post(
            "/api/v1/auth/login/verify-totp", json={"mfa_pending_token": token, "code": code}
        )
        assert response.status_code == 400


def test_only_the_latest_login_challenge_can_be_answered(
    client: TestClient, db_session: Session
) -> None:
    _signup(client, "latest@acme.com")
    secret = _enable_totp(db_session, "latest@acme.com")
    with TestClient(app) as browser:
        old = _pending(browser, "latest@acme.com")
        _pending(browser, "latest@acme.com")
        response = browser.post(
            "/api/v1/auth/login/verify-totp", json={"mfa_pending_token": old, "code": _code(secret)}
        )
        assert response.status_code == 401
        assert response.json()["error"]["code"] == "MFA_CHALLENGE_EXPIRED"


def test_wrong_codes_withdraw_the_challenge_then_lock_the_second_factor(
    client: TestClient, db_session: Session
) -> None:
    _signup(client, "brute@acme.com")
    secret = _enable_totp(db_session, "brute@acme.com")
    with TestClient(app) as attacker:
        for round_ in range(2):
            token = _pending(attacker, "brute@acme.com")
            for _ in range(totp_service.MFA_FAILURES_PER_CHALLENGE):
                response = attacker.post(
                    "/api/v1/auth/login/verify-totp",
                    json={"mfa_pending_token": token, "code": "000000"},
                )
                assert response.status_code == 400
            if round_ == 0:
                response = attacker.post(
                    "/api/v1/auth/login/verify-totp",
                    json={"mfa_pending_token": token, "code": _code(secret)},
                )
                assert response.json()["error"]["code"] == "MFA_CHALLENGE_EXPIRED"

        # Ten failures: locked, even with the password and a valid code.
        response = attacker.post(
            "/api/v1/auth/login", json={"email": "brute@acme.com", "password": PASSWORD}
        )
        assert response.status_code == 429
        assert response.json()["error"]["code"] == "TOO_MANY_ATTEMPTS"

    user = db_session.exec(select(User).where(User.email == "brute@acme.com")).one()
    db_session.refresh(user)
    user.mfa_locked_until = datetime.now(UTC) - timedelta(seconds=1)
    db_session.add(user)
    db_session.commit()
    with TestClient(app) as owner:
        token = _pending(owner, "brute@acme.com")
        response = owner.post(
            "/api/v1/auth/login/verify-totp",
            json={"mfa_pending_token": token, "code": _code(secret)},
        )
        assert response.status_code == 200


def test_a_token_without_a_session_id_is_refused(client: TestClient) -> None:
    import jwt

    _signup(client, "legacy@acme.com")
    me = client.get("/api/v1/auth/me").json()
    legacy = jwt.encode(
        {
            "sub": me["id"],
            "type": "access",
            "exp": datetime.now(UTC) + timedelta(minutes=5),
        },
        settings.SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    client.cookies.set(settings.ACCESS_TOKEN_COOKIE_NAME, legacy)
    assert client.get("/api/v1/auth/me").status_code == 401
