import logging
import uuid
from datetime import UTC, datetime, timedelta

import pyotp
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import TTX, InvitationToken, RoleEnum, User
from app.services import totp_service


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _enable_totp_with_secret(db_session: Session, user_id: str, secret: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    totp_service.store_secret(user, secret)
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def test_login_success(client: TestClient, caplog) -> None:
    _signup(client, "owner@acme.com", "Acme")
    client.cookies.clear()

    with caplog.at_level(logging.INFO, logger="app.auth"):
        response = client.post(
            "/api/v1/auth/login", json={"email": "owner@acme.com", "password": "Correcthorse123!"}
        )

    assert response.status_code == 200
    body = response.json()
    assert body["mfa_required"] is False
    assert body["user"]["email"] == "owner@acme.com"
    assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies
    assert any(r.message.startswith("auth.login user=") for r in caplog.records)


def test_login_wrong_password_is_generic_401(client: TestClient, caplog) -> None:
    _signup(client, "owner2@acme.com", "Acme2")
    client.cookies.clear()

    with caplog.at_level(logging.WARNING, logger="app.auth"):
        response = client.post(
            "/api/v1/auth/login", json={"email": "owner2@acme.com", "password": "wrong-password"}
        )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"
    assert any(r.levelno == logging.WARNING for r in caplog.records)


def test_login_unknown_email_is_same_generic_401(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login", json={"email": "nobody@acme.com", "password": "whatever123"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_login_with_totp_enabled_returns_mfa_pending(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner3@acme.com", "Acme3")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)
    client.cookies.clear()

    response = client.post(
        "/api/v1/auth/login", json={"email": "owner3@acme.com", "password": "Correcthorse123!"}
    )

    assert response.status_code == 200
    resp_body = response.json()
    assert resp_body["mfa_required"] is True
    assert resp_body["mfa_pending_token"]
    assert resp_body["user"] is None
    assert settings.ACCESS_TOKEN_COOKIE_NAME not in response.cookies


def test_verify_totp_login_success(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner4@acme.com", "Acme4")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)
    client.cookies.clear()

    login_response = client.post(
        "/api/v1/auth/login", json={"email": "owner4@acme.com", "password": "Correcthorse123!"}
    )
    mfa_pending_token = login_response.json()["mfa_pending_token"]

    response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": pyotp.TOTP(secret).now()},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["mfa_required"] is False
    assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies


def test_verify_totp_login_wrong_code_is_denied(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner5@acme.com", "Acme5")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)
    client.cookies.clear()

    login_response = client.post(
        "/api/v1/auth/login", json={"email": "owner5@acme.com", "password": "Correcthorse123!"}
    )
    mfa_pending_token = login_response.json()["mfa_pending_token"]

    response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": "000000"},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_TOTP_CODE"


def test_verify_totp_login_rejects_access_token_as_pending(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner6@acme.com", "Acme6")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)
    access_token_cookie = client.cookies[settings.ACCESS_TOKEN_COOKIE_NAME]

    response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": access_token_cookie, "code": pyotp.TOTP(secret).now()},
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "TOKEN_INVALID"


def test_auth_me(client: TestClient) -> None:
    _signup(client, "owner7@acme.com", "Acme7")

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "owner7@acme.com"
    assert body["totp_enabled"] is False
    assert body["is_program_manager"] is True


def test_auth_me_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")

    assert response.status_code == 401


def test_auth_me_non_program_manager_reports_false(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner8@acme.com", "Acme8")
    ttx = TTX(
        name="Drill", organization_id=owner["organization"]["id"], created_by_id=owner["user"]["id"]
    )
    db_session.add(ttx)
    db_session.commit()
    db_session.refresh(ttx)
    token = InvitationToken(
        token="auth-me-token",
        ttx_id=ttx.id,
        role=RoleEnum.PLAYER,
        created_by_id=owner["user"]["id"],
        expires_at=datetime.now(UTC) + timedelta(days=1),
        max_uses=1,
    )
    db_session.add(token)
    db_session.commit()

    client.cookies.clear()
    redeem_response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "auth-me-token",
            "account": {
                "email": "player@external.com",
                "password": "Correcthorse123!",
                "full_name": "Player",
            },
        },
    )
    assert redeem_response.status_code == 200

    response = client.get("/api/v1/auth/me")

    assert response.status_code == 200
    assert response.json()["is_program_manager"] is False


def _last_login_at(db_session: Session, user_id: str) -> datetime | None:
    db_session.expire_all()
    return db_session.get(User, uuid.UUID(user_id)).last_login_at


def test_login_records_last_login_at(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "stamp@acme.com", "Stamp")
    user = db_session.get(User, uuid.UUID(body["user"]["id"]))
    user.last_login_at = None
    db_session.add(user)
    db_session.commit()
    client.cookies.clear()

    before = datetime.now(UTC)
    response = client.post(
        "/api/v1/auth/login", json={"email": "stamp@acme.com", "password": "Correcthorse123!"}
    )

    assert response.status_code == 200
    stamped = _last_login_at(db_session, body["user"]["id"])
    assert stamped is not None
    assert stamped >= before


def test_login_with_totp_records_last_login_only_after_second_factor(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "stamp2@acme.com", "Stamp2")
    secret = pyotp.random_base32()
    _enable_totp_with_secret(db_session, body["user"]["id"], secret)
    user = db_session.get(User, uuid.UUID(body["user"]["id"]))
    user.last_login_at = None
    db_session.add(user)
    db_session.commit()
    client.cookies.clear()

    login_response = client.post(
        "/api/v1/auth/login", json={"email": "stamp2@acme.com", "password": "Correcthorse123!"}
    )
    assert _last_login_at(db_session, body["user"]["id"]) is None

    client.post(
        "/api/v1/auth/login/verify-totp",
        json={
            "mfa_pending_token": login_response.json()["mfa_pending_token"],
            "code": pyotp.TOTP(secret).now(),
        },
    )
    assert _last_login_at(db_session, body["user"]["id"]) is not None


def test_failed_login_does_not_record_last_login(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "stamp3@acme.com", "Stamp3")
    user = db_session.get(User, uuid.UUID(body["user"]["id"]))
    user.last_login_at = None
    db_session.add(user)
    db_session.commit()
    client.cookies.clear()

    client.post("/api/v1/auth/login", json={"email": "stamp3@acme.com", "password": "wrong-pass"})

    assert _last_login_at(db_session, body["user"]["id"]) is None
