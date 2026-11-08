import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session

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
    db_session: Session, ttx_id, creator_id, plaintext: str, max_uses: int = 5
) -> InvitationToken:
    token = InvitationToken(
        token=plaintext,
        ttx_id=ttx_id,
        role=RoleEnum.PLAYER,
        created_by_id=creator_id,
        expires_at=datetime.now(UTC) + timedelta(days=1),
        max_uses=max_uses,
    )
    db_session.add(token)
    db_session.commit()
    db_session.refresh(token)
    return token


def test_audit_shows_redemptions_and_unredeemed_tokens(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    redeemed_token = _seed_token(db_session, ttx.id, owner["user"]["id"], "redeemed-token")
    unredeemed_token = _seed_token(db_session, ttx.id, owner["user"]["id"], "unredeemed-token")

    # Redeem via a separate client/cookie jar so it doesn't clobber the
    # owner's session held by the `client` fixture (there's no login
    # endpoint to re-authenticate as the owner afterward).
    redeemer_client = TestClient(app)
    redeem_response = redeemer_client.post(
        "/api/v1/invitation-tokens/redeem",
        json={
            "token": "redeemed-token",
            "account": {
                "email": "redeemer@external.com",
                "password": "Correcthorse123!",
                "full_name": "Redeemer",
            },
        },
    )
    assert redeem_response.status_code == 200
    redeemer_user_id = redeem_response.json()["user"]["id"]

    response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2

    items_by_id = {item["id"]: item for item in body["items"]}
    redeemed_item = items_by_id[str(redeemed_token.id)]
    unredeemed_item = items_by_id[str(unredeemed_token.id)]

    assert len(redeemed_item["redemptions"]) == 1
    assert redeemed_item["redemptions"][0]["user_id"] == redeemer_user_id
    assert redeemed_item["redemptions"][0]["email"] == "redeemer@external.com"
    assert unredeemed_item["redemptions"] == []


def test_audit_revoked_token_still_visible(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], "revoke-audit-token")

    csrf = {"X-CSRF-Token": client.cookies["ttx_csrf_token"]}
    revoke_response = client.delete(f"/api/v1/invitation-tokens/{token.id}", headers=csrf)
    assert revoke_response.status_code == 200

    response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens")

    assert response.status_code == 200
    item = next(i for i in response.json()["items"] if i["id"] == str(token.id))
    assert item["revoked_at"] is not None


def test_audit_other_org_program_manager_is_denied(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    client.cookies.clear()
    _signup(client, "intruder@corp.com", "Intruder Corp")

    response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens")

    assert response.status_code == 403


def test_audit_unauthenticated_returns_401(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner4@acme.com", "Acme4")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    client.cookies.clear()

    response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens")

    assert response.status_code == 401


def test_audit_unknown_ttx_returns_404(client: TestClient) -> None:
    _signup(client, "owner5@acme.com", "Acme5")
    unknown_id = "00000000-0000-0000-0000-000000000000"

    response = client.get(f"/api/v1/ttx/{unknown_id}/invitation-tokens")

    assert response.status_code == 404


def test_audit_pagination(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner6@acme.com", "Acme6")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    for i in range(5):
        _seed_token(db_session, ttx.id, owner["user"]["id"], f"page-token-{i}")

    response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens", params={"limit": 2})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2


def test_audit_sort_dir(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner7@acme.com", "Acme7")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    first = _seed_token(db_session, ttx.id, owner["user"]["id"], "sort-token-first")
    last = _seed_token(db_session, ttx.id, owner["user"]["id"], "sort-token-last")

    default_response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens")
    default_ids = [item["id"] for item in default_response.json()["items"]]
    assert default_ids == [str(last.id), str(first.id)]

    asc_response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens", params={"sort_dir": "asc"})
    asc_ids = [item["id"] for item in asc_response.json()["items"]]
    assert asc_ids == [str(first.id), str(last.id)]


def test_list_invitation_tokens_search_and_alphabetical_sort(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner8@acme.com", "Acme8")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    csrf = {"X-CSRF-Token": client.cookies["ttx_csrf_token"]}

    for description in ["Legal team", "IT department", "Finance"]:
        response = client.post(
            f"/api/v1/ttx/{ttx.id}/invitation-tokens",
            json={
                "role": "player",
                "description": description,
                "expires_at": "2027-01-01T00:00:00",
                "max_uses": 1,
            },
            headers=csrf,
        )
        assert response.status_code == 201

    response = client.get(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens", params={"sort_by": "name", "sort_dir": "asc"}
    )
    assert response.status_code == 200
    descriptions = [item["description"] for item in response.json()["items"]]
    assert descriptions == ["Finance", "IT department", "Legal team"]

    response = client.get(f"/api/v1/ttx/{ttx.id}/invitation-tokens", params={"q": "legal"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["description"] == "Legal team"


def test_list_invitation_tokens_alphabetical_sort_desc(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner9@acme.com", "Acme9")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    csrf = {"X-CSRF-Token": client.cookies["ttx_csrf_token"]}

    for description in ["Legal team", "IT department", "Finance"]:
        response = client.post(
            f"/api/v1/ttx/{ttx.id}/invitation-tokens",
            json={
                "role": "player",
                "description": description,
                "expires_at": "2027-01-01T00:00:00",
                "max_uses": 1,
            },
            headers=csrf,
        )
        assert response.status_code == 201

    # Z to A, the exact reverse of the asc test.
    response = client.get(
        f"/api/v1/ttx/{ttx.id}/invitation-tokens", params={"sort_by": "name", "sort_dir": "desc"}
    )
    assert response.status_code == 200
    descriptions = [item["description"] for item in response.json()["items"]]
    assert descriptions == ["Legal team", "IT department", "Finance"]
