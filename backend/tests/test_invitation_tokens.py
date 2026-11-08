import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import TTX, Organization, RoleEnum, TTXAccess, User


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _seed_ttx(db_session: Session, organization_id, creator_id) -> TTX:
    ttx = TTX(name="Ransomware Drill", organization_id=organization_id, created_by_id=creator_id)
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


def _future_iso(days: int = 7) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def _enable_totp(db_session: Session, user_id: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def test_create_token_as_program_manager_succeeds(
    client: TestClient, db_session: Session, caplog
) -> None:
    body = _signup(client, "owner@acme.com", "Acme")
    org_id = body["organization"]["id"]
    user_id = body["user"]["id"]
    _enable_totp(db_session, user_id)
    ttx = _seed_ttx(db_session, org_id, user_id)

    with caplog.at_level(logging.INFO, logger="app.services.invitation_token_service"):
        response = client.post(
            f"/api/v1/ttx/{ttx.id}/invitation-tokens",
            json={"role": "player", "expires_at": _future_iso(), "max_uses": 10},
            headers=_csrf_headers(client),
        )

    assert response.status_code == 201
    data = response.json()
    assert data["ttx_id"] == str(ttx.id)
    assert data["role"] == "player"
    assert len(data["token"]) > 20
    assert any("Invitation token created" in r.message for r in caplog.records)


def test_create_token_without_csrf_header_is_denied(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner2@acme.com", "Acme2")
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso(), "max_uses": 10},
    )

    assert response.status_code == 403


def test_create_token_as_unauthenticated_is_denied(
    client: TestClient, db_session: Session, caplog
) -> None:
    body = _signup(client, "owner3@acme.com", "Acme3")
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])
    headers = _csrf_headers(client)
    del client.cookies[settings.ACCESS_TOKEN_COOKIE_NAME]

    with caplog.at_level(logging.WARNING, logger="app.main"):
        response = client.post(
            f"/api/v1/ttx/{ttx.id}/invitation-tokens",
            json={"role": "player", "expires_at": _future_iso(), "max_uses": 10},
            headers=headers,
        )

    assert response.status_code == 401
    assert any(r.levelno == logging.WARNING for r in caplog.records)


def test_create_token_as_other_org_program_manager_is_denied(
    client: TestClient, db_session: Session
) -> None:
    owner_body = _signup(client, "owner4@acme.com", "Acme4")
    ttx = _seed_ttx(db_session, owner_body["organization"]["id"], owner_body["user"]["id"])

    other_org = Organization(name="Other Corp")
    db_session.add(other_org)
    db_session.commit()
    db_session.refresh(other_org)

    client.cookies.clear()
    _signup(client, "intruder@other.com", "Intruder Org")

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso(), "max_uses": 10},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 403


def test_create_token_unknown_ttx_returns_404(client: TestClient, db_session: Session) -> None:
    _signup(client, "owner5@acme.com", "Acme5")
    unknown_ttx_id = "00000000-0000-0000-0000-000000000000"

    response = client.post(
        f"/api/v1/ttx/{unknown_ttx_id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso(), "max_uses": 10},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 404


def test_create_token_rejects_past_expiry(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner6@acme.com", "Acme6")
    _enable_totp(db_session, body["user"]["id"])
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso(days=-1), "max_uses": 10},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422


def test_create_token_rejects_max_uses_out_of_bounds(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner7@acme.com", "Acme7")
    _enable_totp(db_session, body["user"]["id"])
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso(), "max_uses": 5000},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422


def test_create_token_with_description_succeeds(client: TestClient, db_session: Session) -> None:
    body = _signup(client, "owner8@acme.com", "Acme8")
    _enable_totp(db_session, body["user"]["id"])
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={
            "role": "player",
            "description": "IT team, Q1 drill",
            "expires_at": _future_iso(),
            "max_uses": 10,
        },
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201
    assert response.json()["description"] == "IT team, Q1 drill"


def test_create_token_without_max_uses_is_unlimited(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner9@acme.com", "Acme9")
    _enable_totp(db_session, body["user"]["id"])
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso()},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201
    assert response.json()["max_uses"] is None


def test_create_token_accepts_expiry_within_one_year(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner10@acme.com", "Acme10")
    _enable_totp(db_session, body["user"]["id"])
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso(days=300), "max_uses": 10},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 201


def test_create_token_rejects_expiry_beyond_one_year(
    client: TestClient, db_session: Session
) -> None:
    body = _signup(client, "owner11@acme.com", "Acme11")
    _enable_totp(db_session, body["user"]["id"])
    ttx = _seed_ttx(db_session, body["organization"]["id"], body["user"]["id"])

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens",
        json={"role": "player", "expires_at": _future_iso(days=400), "max_uses": 10},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 422
