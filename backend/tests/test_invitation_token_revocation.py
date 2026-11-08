import logging
import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.models import TTX, InvitationToken, RoleEnum, TTXAccess, User


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _enable_totp(db_session: Session, user_id: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


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


def _seed_token(
    db_session: Session, ttx_id, creator_id, plaintext: str = "revoke-me-token"
) -> InvitationToken:
    token = InvitationToken(
        token=plaintext,
        ttx_id=ttx_id,
        role=RoleEnum.PLAYER,
        created_by_id=creator_id,
        expires_at=datetime.now(UTC) + timedelta(days=1),
        max_uses=5,
    )
    db_session.add(token)
    db_session.commit()
    db_session.refresh(token)
    return token


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_program_manager_revokes_own_org_token(
    client: TestClient, db_session: Session, caplog
) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"])

    with caplog.at_level(logging.INFO, logger="app.services.invitation_token_service"):
        response = client.delete(
            f"/api/v1/invitation-tokens/{token.id}", headers=_csrf_headers(client)
        )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == str(token.id)
    assert body["revoked_at"] is not None
    assert any("revoked by user" in r.message for r in caplog.records)


def test_revoke_is_idempotent(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="idempotent-token")
    headers = _csrf_headers(client)

    first = client.delete(f"/api/v1/invitation-tokens/{token.id}", headers=headers)
    second = client.delete(f"/api/v1/invitation-tokens/{token.id}", headers=headers)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["revoked_at"] == second.json()["revoked_at"]


def test_revoke_by_other_org_program_manager_is_denied(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="other-org-token")

    client.cookies.clear()
    _signup(client, "intruder@corp.com", "Intruder Corp")

    response = client.delete(f"/api/v1/invitation-tokens/{token.id}", headers=_csrf_headers(client))

    assert response.status_code == 403


def test_revoke_unauthenticated_returns_401(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="unauth-token")
    headers = _csrf_headers(client)
    del client.cookies[settings.ACCESS_TOKEN_COOKIE_NAME]

    response = client.delete(f"/api/v1/invitation-tokens/{token.id}", headers=headers)

    assert response.status_code == 401


def test_revoke_without_csrf_is_denied(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner5@acme.com", "Acme5")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="no-csrf-token")

    response = client.delete(f"/api/v1/invitation-tokens/{token.id}")

    assert response.status_code == 403


def test_revoke_unknown_token_returns_404(client: TestClient) -> None:
    _signup(client, "owner6@acme.com", "Acme6")
    unknown_id = "00000000-0000-0000-0000-000000000000"

    response = client.delete(
        f"/api/v1/invitation-tokens/{unknown_id}", headers=_csrf_headers(client)
    )

    assert response.status_code == 404


def test_revoked_token_can_no_longer_be_redeemed(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner7@acme.com", "Acme7")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="dead-token")

    revoke_response = client.delete(
        f"/api/v1/invitation-tokens/{token.id}", headers=_csrf_headers(client)
    )
    assert revoke_response.status_code == 200

    client.cookies.clear()
    redeem_response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "dead-token",
            "account": {
                "email": "toolate@external.com",
                "password": "Correcthorse123!",
                "full_name": "Too Late",
            },
        },
    )

    assert redeem_response.status_code == 400
    assert redeem_response.json()["error"]["code"] == "INVALID_OR_EXPIRED_TOKEN"
