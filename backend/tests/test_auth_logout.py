import logging

from fastapi.testclient import TestClient

from app.core.config import settings


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_logout_clears_session(client: TestClient, caplog) -> None:
    _signup(client, "owner@acme.com", "Acme")

    with caplog.at_level(logging.INFO, logger="app.auth"):
        response = client.post("/api/v1/auth/logout", headers=_csrf_headers(client))

    assert response.status_code == 204
    assert any(r.message.startswith("auth.logout user=") for r in caplog.records)

    me_response = client.get("/api/v1/auth/me")
    assert me_response.status_code == 401


def test_logout_without_csrf_is_denied(client: TestClient) -> None:
    _signup(client, "owner2@acme.com", "Acme2")

    response = client.post("/api/v1/auth/logout")

    assert response.status_code == 403


def test_logout_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.post("/api/v1/auth/logout")

    assert response.status_code in (401, 403)
