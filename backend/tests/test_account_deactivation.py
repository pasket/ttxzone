from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import User


def _register_bare(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    )
    assert response.status_code == 201
    return response.json()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_delete_account_requires_exact_confirmation_phrase(client: TestClient) -> None:
    _register_bare(client, "picky@external.com")

    response = client.request(
        "DELETE",
        "/api/v1/auth/me",
        json={"confirmation": "delete my accnt"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "CONFIRMATION_MISMATCH"


def test_delete_account_deactivates_and_blocks_login(
    client: TestClient, db_session: Session
) -> None:
    body = _register_bare(client, "leaving@external.com")
    user_id = body["user"]["id"]

    response = client.request(
        "DELETE",
        "/api/v1/auth/me",
        json={"confirmation": "delete my account"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204

    me_response = client.get("/api/v1/auth/me")
    assert me_response.status_code == 401

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "leaving@external.com", "password": "Correcthorse123!"},
    )
    assert login_response.status_code == 401

    user = db_session.get(User, user_id)
    assert user is not None
    assert user.is_active is False
    assert user.email != "leaving@external.com"


def test_delete_account_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.request(
        "DELETE", "/api/v1/auth/me", json={"confirmation": "delete my account"}
    )

    # No cookies at all means both auth and CSRF are technically missing --
    # whichever check runs first wins; either rejection is fine.
    assert response.status_code in (401, 403)


def test_delete_account_without_csrf_is_denied(client: TestClient) -> None:
    _register_bare(client, "nocsrf@external.com")

    response = client.request(
        "DELETE", "/api/v1/auth/me", json={"confirmation": "delete my account"}
    )

    assert response.status_code == 403
