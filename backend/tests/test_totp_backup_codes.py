from urllib.parse import parse_qs, urlparse

import pyotp
from fastapi.testclient import TestClient

from app.core.config import settings


def _secret_from_provisioning_uri(uri: str) -> str:
    return parse_qs(urlparse(uri).query)["secret"][0]


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _signup_and_enroll(client: TestClient, email: str, org_name: str) -> list[str]:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201

    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    secret = _secret_from_provisioning_uri(enroll_response.json()["provisioning_uri"])
    confirm_response = client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )
    return confirm_response.json()["backup_codes"]


def test_login_with_backup_code_succeeds_and_resets_enrollment(client: TestClient) -> None:
    backup_codes = _signup_and_enroll(client, "owner@acme.com", "Acme")
    client.cookies.clear()

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@acme.com", "password": "Correcthorse123!"},
    )
    mfa_pending_token = login_response.json()["mfa_pending_token"]

    response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": backup_codes[0]},
    )

    assert response.status_code == 200
    assert response.json()["mfa_required"] is False
    assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies

    me_response = client.get("/api/v1/auth/me")
    assert me_response.json()["totp_enabled"] is False
    assert me_response.json()["backup_codes_remaining"] == 0


def test_backup_code_login_then_login_again_no_longer_requires_mfa(client: TestClient) -> None:
    # Consuming a backup code resets enrollment entirely (totp_enabled ->
    # False), so a subsequent login goes through the plain, no-MFA path --
    # there is no "use the same code twice while still enrolled" case to
    # hit, by design (see consume_backup_code's docstring).
    backup_codes = _signup_and_enroll(client, "owner2@acme.com", "Acme2")
    client.cookies.clear()

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner2@acme.com", "password": "Correcthorse123!"},
    )
    mfa_pending_token = login_response.json()["mfa_pending_token"]
    client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": backup_codes[0]},
    )
    client.cookies.clear()

    second_login = client.post(
        "/api/v1/auth/login",
        json={"email": "owner2@acme.com", "password": "Correcthorse123!"},
    )
    assert second_login.json()["mfa_required"] is False


def test_re_enrollment_after_backup_code_wipes_the_old_batch(client: TestClient) -> None:
    backup_codes = _signup_and_enroll(client, "owner3@acme.com", "Acme3")
    client.cookies.clear()

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner3@acme.com", "password": "Correcthorse123!"},
    )
    mfa_pending_token = login_response.json()["mfa_pending_token"]
    client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": backup_codes[0]},
    )

    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    secret = _secret_from_provisioning_uri(enroll_response.json()["provisioning_uri"])
    client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )
    client.cookies.clear()

    login_response_2 = client.post(
        "/api/v1/auth/login",
        json={"email": "owner3@acme.com", "password": "Correcthorse123!"},
    )
    mfa_pending_token_2 = login_response_2.json()["mfa_pending_token"]

    response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token_2, "code": backup_codes[1]},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_TOTP_CODE"


def test_regenerate_backup_codes_requires_correct_password(client: TestClient) -> None:
    _signup_and_enroll(client, "owner4@acme.com", "Acme4")

    wrong = client.post(
        "/api/v1/auth/totp/backup-codes/regenerate",
        json={"password": "wrong-password"},
        headers=_csrf_headers(client),
    )
    assert wrong.status_code == 401

    response = client.post(
        "/api/v1/auth/totp/backup-codes/regenerate",
        json={"password": "Correcthorse123!"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 200
    new_codes = response.json()["backup_codes"]
    assert len(new_codes) == 10

    me_response = client.get("/api/v1/auth/me")
    assert me_response.json()["backup_codes_remaining"] == 10


def test_regenerate_invalidates_old_codes(client: TestClient) -> None:
    old_codes = _signup_and_enroll(client, "owner5@acme.com", "Acme5")

    client.post(
        "/api/v1/auth/totp/backup-codes/regenerate",
        json={"password": "Correcthorse123!"},
        headers=_csrf_headers(client),
    )
    client.cookies.clear()

    login_response = client.post(
        "/api/v1/auth/login",
        json={"email": "owner5@acme.com", "password": "Correcthorse123!"},
    )
    mfa_pending_token = login_response.json()["mfa_pending_token"]

    response = client.post(
        "/api/v1/auth/login/verify-totp",
        json={"mfa_pending_token": mfa_pending_token, "code": old_codes[0]},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_TOTP_CODE"


def test_regenerate_requires_totp_enabled(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "bare6@external.com", "password": "Correcthorse123!", "full_name": "Ada"},
    )
    assert response.status_code == 201

    regenerate_response = client.post(
        "/api/v1/auth/totp/backup-codes/regenerate",
        json={"password": "Correcthorse123!"},
        headers=_csrf_headers(client),
    )

    assert regenerate_response.status_code == 409
    assert regenerate_response.json()["error"]["code"] == "TOTP_NOT_ENABLED"


def test_disable_totp_clears_backup_codes(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": "bare7@external.com", "password": "Correcthorse123!", "full_name": "Ada"},
    )
    assert response.status_code == 201

    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    secret = _secret_from_provisioning_uri(enroll_response.json()["provisioning_uri"])
    client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )

    disable_response = client.post(
        "/api/v1/auth/totp/disable",
        json={"password": "Correcthorse123!"},
        headers=_csrf_headers(client),
    )
    assert disable_response.status_code == 204

    me_response = client.get("/api/v1/auth/me")
    assert me_response.json()["backup_codes_remaining"] == 0
