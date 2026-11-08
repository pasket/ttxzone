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


def test_change_password_success_and_new_password_logs_in(client: TestClient) -> None:
    _signup(client, "owner@acme.com", "Acme")

    response = client.post(
        "/api/v1/auth/password",
        json={"current_password": "Correcthorse123!", "new_password": "Brand-new-password-1!"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204

    client.cookies.clear()
    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@acme.com", "password": "Brand-new-password-1!"},
    )
    assert login_response.status_code == 200
    assert login_response.json()["mfa_required"] is False


def test_change_password_wrong_current_password_is_denied(client: TestClient) -> None:
    _signup(client, "owner2@acme.com", "Acme2")

    response = client.post(
        "/api/v1/auth/password",
        json={"current_password": "wrong-password", "new_password": "Brand-new-password-1!"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_CREDENTIALS"


def test_change_password_rejects_new_password_under_8_chars(client: TestClient) -> None:
    _signup(client, "owner3@acme.com", "Acme3")

    response = client.post(
        "/api/v1/auth/password",
        # 7 chars -- otherwise satisfies every other rule (upper/lower/number/
        # symbol), isolating the length check specifically.
        json={"current_password": "Correcthorse123!", "new_password": "Shrt1x!"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422


def test_change_password_rejects_new_password_missing_symbol(client: TestClient) -> None:
    _signup(client, "owner3b@acme.com", "Acme3b")

    response = client.post(
        "/api/v1/auth/password",
        json={"current_password": "Correcthorse123!", "new_password": "Nosymbolhere123"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422


def test_change_password_requires_authentication(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/password",
        json={"current_password": "Correcthorse123!", "new_password": "Brand-new-password-1!"},
    )

    assert response.status_code in (401, 403)


def test_change_password_requires_csrf(client: TestClient) -> None:
    _signup(client, "owner4@acme.com", "Acme4")

    response = client.post(
        "/api/v1/auth/password",
        json={"current_password": "Correcthorse123!", "new_password": "Brand-new-password-1!"},
    )

    assert response.status_code == 403
