from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlparse

import pyotp
import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import TTX, RoleEnum, TTXAccess, User
from app.services import totp_service


def _secret_from_provisioning_uri(uri: str) -> str:
    return parse_qs(urlparse(uri).query)["secret"][0]


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _register_bare(client: TestClient, email: str) -> dict:
    response = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    )
    assert response.status_code == 201
    return response.json()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _seed_ttx(db_session: Session, organization_id, creator_id) -> TTX:
    ttx = TTX(name="Drill", organization_id=organization_id, created_by_id=creator_id)
    db_session.add(ttx)
    db_session.flush()
    # The creator's seat, as create_ttx gives it.
    db_session.add(
        TTXAccess(
            user_id=creator_id, ttx_id=ttx.id, role=RoleEnum.PLANNER, plans=True, controls=True
        )
    )
    db_session.commit()
    db_session.refresh(ttx)
    return ttx


def test_enroll_then_confirm_enables_totp(client: TestClient) -> None:
    _signup(client, "owner@acme.com", "Acme")

    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    assert enroll_response.status_code == 200
    provisioning_uri = enroll_response.json()["provisioning_uri"]
    secret = _secret_from_provisioning_uri(provisioning_uri)

    confirm_response = client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )
    assert confirm_response.status_code == 200
    backup_codes = confirm_response.json()["backup_codes"]
    assert len(backup_codes) == 10
    assert len(set(backup_codes)) == 10

    me_response = client.get("/api/v1/auth/me")
    assert me_response.json()["totp_enabled"] is True
    assert me_response.json()["backup_codes_remaining"] == 10


def test_the_secret_is_stored_encrypted(client: TestClient, db_session: Session) -> None:
    _signup(client, "owner9@acme.com", "Acme9")
    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    secret = _secret_from_provisioning_uri(enroll_response.json()["provisioning_uri"])

    user = db_session.exec(select(User).where(User.email == "owner9@acme.com")).one()
    assert user.totp_secret_encrypted is not None
    assert secret not in user.totp_secret_encrypted
    assert totp_service.stored_secret(user) == secret


def test_a_secret_no_key_decrypts_fails_the_code(client: TestClient, db_session: Session) -> None:
    _signup(client, "owner10@acme.com", "Acme10")
    client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    user = db_session.exec(select(User).where(User.email == "owner10@acme.com")).one()
    secret = pyotp.random_base32()
    # Encrypted with a key the server doesn't have (rotated without the old one).
    user.totp_secret_encrypted = Fernet(Fernet.generate_key()).encrypt(secret.encode()).decode()
    db_session.add(user)
    db_session.commit()

    response = client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )

    assert response.json()["error"]["code"] == "INVALID_TOTP_CODE"


def test_the_backend_needs_the_encryption_key() -> None:
    from pydantic import ValidationError

    from app.core.config import Settings

    with pytest.raises(ValidationError, match="DATA_ENCRYPTION_KEY .* is required"):
        Settings(  # type: ignore[call-arg]
            _env_file=None,
            POSTGRES_USER="u",
            POSTGRES_PASSWORD="p",
            POSTGRES_DB="d",
            SECRET_KEY="k",
            DATA_ENCRYPTION_KEY=None,
        )


def test_confirm_with_wrong_code_is_denied(client: TestClient) -> None:
    _signup(client, "owner2@acme.com", "Acme2")
    client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))

    response = client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": "000000"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_TOTP_CODE"
    assert client.get("/api/v1/auth/me").json()["totp_enabled"] is False


def test_enroll_without_csrf_is_denied(client: TestClient) -> None:
    _signup(client, "owner3@acme.com", "Acme3")

    response = client.post("/api/v1/auth/totp/enroll")

    assert response.status_code == 403


def test_disable_requires_correct_password(client: TestClient) -> None:
    # A plain no-role account -- TOTP is opt-in for Player, so this
    # is the one persona that can actually disable it once enabled. A
    # Program Manager/Planner can't reach this far (see
    # test_disable_denied_for_mandatory_role below).
    _register_bare(client, "bare4@external.com")
    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    provisioning_uri = enroll_response.json()["provisioning_uri"]
    secret = _secret_from_provisioning_uri(provisioning_uri)
    client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )

    wrong_password_response = client.post(
        "/api/v1/auth/totp/disable",
        json={"password": "wrong-password"},
        headers=_csrf_headers(client),
    )
    assert wrong_password_response.status_code == 401

    response = client.post(
        "/api/v1/auth/totp/disable",
        json={"password": "Correcthorse123!"},
        headers=_csrf_headers(client),
    )
    assert response.status_code == 204
    assert client.get("/api/v1/auth/me").json()["totp_enabled"] is False


def test_disable_denied_for_mandatory_role(client: TestClient) -> None:
    _signup(client, "owner4b@acme.com", "Acme4b")
    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    secret = _secret_from_provisioning_uri(enroll_response.json()["provisioning_uri"])
    client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )

    response = client.post(
        "/api/v1/auth/totp/disable",
        json={"password": "Correcthorse123!"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MFA_MANDATORY_FOR_ROLE"
    assert client.get("/api/v1/auth/me").json()["totp_enabled"] is True


def test_program_manager_without_totp_is_denied_on_guarded_endpoint(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner5@acme.com", "Acme5")
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={
            "role": "player",
            "expires_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
            "max_uses": 10,
        },
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403
    assert response.json()["error"]["code"] == "MFA_REQUIRED"


def test_program_manager_with_totp_enabled_passes_guarded_endpoint(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner6@acme.com", "Acme6")
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])
    enroll_response = client.post("/api/v1/auth/totp/enroll", headers=_csrf_headers(client))
    provisioning_uri = enroll_response.json()["provisioning_uri"]
    secret = _secret_from_provisioning_uri(provisioning_uri)
    client.post(
        "/api/v1/auth/totp/enroll/confirm",
        json={"code": pyotp.TOTP(secret).now()},
        headers=_csrf_headers(client),
    )

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={
            "role": "player",
            "expires_at": (datetime.now(UTC) + timedelta(days=7)).isoformat(),
            "max_uses": 10,
        },
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201
