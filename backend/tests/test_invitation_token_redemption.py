import logging
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    TTX,
    AccessRequestStatus,
    InvitationToken,
    RoleEnum,
    TTXAccess,
    TTXAccessRequest,
)
from app.services.login_throttle_service import SIGNUP_TAKEN_EMAILS_PER_ADDRESS


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _seed_ttx(db_session: Session, organization_id, creator_id) -> TTX:
    ttx = TTX(name="Drill", organization_id=organization_id, created_by_id=creator_id)
    db_session.add(ttx)
    db_session.commit()
    db_session.refresh(ttx)
    return ttx


def _seed_token(
    db_session: Session,
    ttx_id,
    creator_id,
    role: RoleEnum = RoleEnum.PLAYER,
    plaintext: str = "plaintext-token-value",
    max_uses: int = 5,
    redemption_count: int = 0,
    expires_in: timedelta = timedelta(days=1),
) -> InvitationToken:
    token = InvitationToken(
        token=plaintext,
        ttx_id=ttx_id,
        role=role,
        created_by_id=creator_id,
        expires_at=datetime.now(UTC) + expires_in,
        max_uses=max_uses,
        redemption_count=redemption_count,
    )
    db_session.add(token)
    db_session.commit()
    db_session.refresh(token)
    return token


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_redeem_as_new_account_succeeds(client: TestClient, db_session: Session, caplog) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"])

    client.cookies.clear()
    with caplog.at_level(logging.INFO, logger="app.auth"):
        response = client.post(
            "/api/v1/invitation-tokens/redeem",
            json={
                "token": "plaintext-token-value",
                "account": {
                    "email": "newbie@external.com",
                    "password": "Correcthorse123!",
                    "full_name": "Newbie",
                },
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["role"] == "player"
    assert body["status"] == "pending"
    assert body["user"]["email"] == "newbie@external.com"
    assert body["organization_name"] == "Acme"
    assert body["organization_domain"] == "acme.com"
    assert settings.ACCESS_TOKEN_COOKIE_NAME in response.cookies

    db_session.refresh(token)
    assert token.redemption_count == 1
    assert any("requested access to" in r.message for r in caplog.records)

    access_request = db_session.exec(
        select(TTXAccessRequest).where(TTXAccessRequest.user_id == uuid.UUID(body["user"]["id"]))
    ).first()
    assert access_request is not None
    assert access_request.status == AccessRequestStatus.PENDING

    granted_access = db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == uuid.UUID(body["user"]["id"]))
    ).first()
    assert granted_access is None


def test_redeem_as_existing_session_succeeds(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="another-token")

    planner = _signup(client, "eval@external.com", "Planner Org")

    response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "another-token"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert body["user"]["email"] == "eval@external.com"
    # existing session unchanged, no new cookies issued beyond signup's own
    assert body["user"]["id"] == planner["user"]["id"]


def test_redeem_authenticated_without_csrf_is_denied(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="csrf-test-token")

    response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "csrf-test-token"},
    )

    assert response.status_code == 403


def test_redeem_anonymous_without_account_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="no-account-token")

    client.cookies.clear()
    response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "no-account-token"},
    )

    # As after an expired session: the client is sent to sign in again.
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "NOT_AUTHENTICATED"


def test_redeem_expired_token_returns_generic_error(
    client: TestClient, db_session: Session, caplog
) -> None:
    owner = _signup(client, "owner5@acme.com", "Acme5")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(
        db_session,
        ttx.id,
        owner["user"]["id"],
        plaintext="expired-token",
        expires_in=timedelta(days=-1),
    )

    client.cookies.clear()
    with caplog.at_level(logging.WARNING, logger="app.auth"):
        response = client.post(
            "/api/v1/invitation-tokens/redeem",
            json={
                "token": "expired-token",
                "account": {
                    "email": "late@external.com",
                    "password": "Correcthorse123!",
                    "full_name": "Late",
                },
            },
        )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_OR_EXPIRED_TOKEN"
    assert any("expired" in r.message for r in caplog.records)


def test_redeem_exhausted_token_returns_generic_error(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner6@acme.com", "Acme6")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(
        db_session,
        ttx.id,
        owner["user"]["id"],
        plaintext="exhausted-token",
        max_uses=2,
        redemption_count=2,
    )

    client.cookies.clear()
    response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "exhausted-token",
            "account": {
                "email": "toolate@external.com",
                "password": "Correcthorse123!",
                "full_name": "Too Late",
            },
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_OR_EXPIRED_TOKEN"


def test_redeem_unknown_token_returns_generic_error(client: TestClient) -> None:
    response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "does-not-exist",
            "account": {
                "email": "ghost@external.com",
                "password": "Correcthorse123!",
                "full_name": "Ghost",
            },
        },
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_OR_EXPIRED_TOKEN"


def test_redeem_duplicate_email_on_anonymous_path_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner7@acme.com", "Acme7")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="dup-email-token")

    client.cookies.clear()
    response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "dup-email-token",
            "account": {
                "email": "owner7@acme.com",
                "password": "Correcthorse123!",
                "full_name": "Impersonator",
            },
        },
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "EMAIL_ALREADY_REGISTERED"


def test_redeeming_with_taken_emails_in_bulk_locks_the_address(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner8@acme.com", "Acme8")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="bulk-email-token")
    client.cookies.clear()
    body = {
        "token": "bulk-email-token",
        "account": {
            "email": "owner8@acme.com",
            "password": "Correcthorse123!",
            "full_name": "Impersonator",
        },
    }

    for _ in range(SIGNUP_TAKEN_EMAILS_PER_ADDRESS):
        assert client.post("/api/v1/invitation-tokens/redeem", json=body).status_code == 409
    refused = client.post("/api/v1/invitation-tokens/redeem", json=body)

    assert refused.status_code == 429
    assert refused.json()["error"]["code"] == "SIGNUP_THROTTLED"


def test_redeem_when_already_has_access_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner8@acme.com", "Acme8")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(
        db_session, ttx.id, owner["user"]["id"], plaintext="already-has-access-token"
    )

    planner = _signup(client, "eval2@external.com", "Planner Org 2")
    db_session.add(
        TTXAccess(user_id=planner["user"]["id"], ttx_id=ttx.id, role=RoleEnum.PLANNER, plans=True)
    )
    db_session.commit()

    response = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "already-has-access-token"},
        headers=_csrf_headers(client),
    )

    assert response.status_code == 409
    assert response.json()["error"]["code"] == "ALREADY_HAS_TTX_ACCESS"
    assert token.role == RoleEnum.PLAYER


def test_redeem_while_request_already_pending_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner9@acme.com", "Acme9")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="pending-request-token")

    client.cookies.clear()
    first = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "pending-request-token",
            "account": {
                "email": "waiting@external.com",
                "password": "Correcthorse123!",
                "full_name": "Waiting",
            },
        },
    )
    assert first.status_code == 200

    second = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "pending-request-token"},
        headers=_csrf_headers(client),
    )

    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ACCESS_REQUEST_ALREADY_PENDING"


def test_the_database_refuses_more_redemptions_than_max_uses(
    client: TestClient, db_session: Session
) -> None:
    """The service counts under a row lock; the CHECK backs it up."""
    owner = _signup(client, "owner@acme.com", "Acme")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], max_uses=1, redemption_count=1)

    token.redemption_count = 2
    db_session.add(token)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
