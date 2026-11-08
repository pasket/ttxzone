import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.config import settings
from app.main import app
from app.models import TTX, InvitationToken, RoleEnum, TTXAccess, User


def _signup(client: TestClient, email: str, org_name: str) -> dict:
    payload = {
        "organization": {"name": org_name, "tax_id": None},
        "admin": {"email": email, "password": "Correcthorse123!", "full_name": "Ada"},
    }
    response = client.post("/api/v1/organizations", json=payload)
    assert response.status_code == 201
    return response.json()


def _seed_ttx(db_session: Session, organization_id, creator_id, name: str = "Drill") -> TTX:
    ttx = TTX(name=name, organization_id=organization_id, created_by_id=creator_id)
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


def _seed_token(db_session: Session, ttx_id, creator_id, plaintext: str) -> InvitationToken:
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


def _enable_totp(db_session: Session, user_id: str) -> None:
    user = db_session.get(User, uuid.UUID(user_id))
    user.totp_enabled = True
    db_session.add(user)
    db_session.commit()


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_my_access_requests_lists_own_pending_request(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="my-req-token")

    client.cookies.clear()
    _signup(client, "requester@external.com", "Requester Org")
    redeem = client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "my-req-token"},
        headers=_csrf_headers(client),
    )
    assert redeem.status_code == 200

    response = client.get("/api/v1/access-requests/me")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["ttx_name"] == "Drill"
    assert body["items"][0]["organization_name"] == "Acme"
    assert body["items"][0]["organization_domain"] == "acme.com"
    assert body["items"][0]["status"] == "pending"


def test_my_access_requests_reflects_approval(client: TestClient, db_session: Session) -> None:
    # `client` stays authenticated as the owner/Planner throughout (the
    # one approving); the requester redeems and later checks their own
    # status through a fully separate TestClient session, mirroring
    # test_ttx_access_requests.py's _redeem_as_new_account pattern -- this
    # avoids needing to juggle re-login (and the owner's own TOTP
    # challenge) on a single shared `client`.
    owner = _signup(client, "owner2@acme.com", "Acme2")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="approve-me-token")

    with TestClient(app) as requester_client:
        redeem = requester_client.post(
            "/api/v1/invitation-tokens/redeem",
            json={
                "token": "approve-me-token",
                "account": {
                    "email": "requester2@external.com",
                    "password": "Correcthorse123!",
                    "full_name": "Requester",
                },
            },
        )
        assert redeem.status_code == 200

        list_response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")
        request_id = list_response.json()["items"][0]["id"]
        approve = client.post(
            f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/approve",
            headers=_csrf_headers(client),
        )
        assert approve.status_code == 200

        response = requester_client.get("/api/v1/access-requests/me")
        assert response.status_code == 200
        assert response.json()["items"][0]["status"] == "approved"


def test_my_access_requests_empty_for_new_user(client: TestClient) -> None:
    _signup(client, "loner@acme.com", "Loner Org")

    response = client.get("/api/v1/access-requests/me")

    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_my_access_requests_sort_dir(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    first_ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], "First")
    last_ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"], "Last")
    _seed_token(db_session, first_ttx.id, owner["user"]["id"], plaintext="sort-token-first")
    _seed_token(db_session, last_ttx.id, owner["user"]["id"], plaintext="sort-token-last")

    client.cookies.clear()
    _signup(client, "sorter@external.com", "Sorter Org")
    client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "sort-token-first"},
        headers=_csrf_headers(client),
    )
    client.post(
        "/api/v1/invitation-tokens/redeem",
        json={"token": "sort-token-last"},
        headers=_csrf_headers(client),
    )

    default_response = client.get("/api/v1/access-requests/me")
    default_names = [item["ttx_name"] for item in default_response.json()["items"]]
    assert default_names == ["Last", "First"]

    asc_response = client.get("/api/v1/access-requests/me", params={"sort_dir": "asc"})
    asc_names = [item["ttx_name"] for item in asc_response.json()["items"]]
    assert asc_names == ["First", "Last"]


def test_my_access_requests_unauthenticated_returns_401(client: TestClient) -> None:
    response = client.get("/api/v1/access-requests/me")

    assert response.status_code == 401
