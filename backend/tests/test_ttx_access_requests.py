import uuid
from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.main import app
from app.models import TTX, InvitationToken, RoleEnum, TTXAccess, TTXAccessRequest, User


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
    db_session: Session, ttx_id, creator_id, plaintext: str, role: RoleEnum = RoleEnum.PLAYER
) -> InvitationToken:
    token = InvitationToken(
        token=plaintext,
        ttx_id=ttx_id,
        role=role,
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


def _redeem_as_new_account(token_plaintext: str, email: str) -> dict:
    # A separate client so the redeeming (anonymous) actor never touches
    # the owner `client` fixture's own session cookies -- the owner needs
    # to stay logged in to list/approve/reject afterward, and Program Manager
    # login can't simply be redone here since totp_enabled is forced True
    # via direct DB flip (no real secret to complete a fresh /login with).
    with TestClient(app) as redeemer:
        response = redeemer.post(
            "/api/v1/invitation-tokens/redeem",
            json={
                "token": token_plaintext,
                "account": {
                    "email": email,
                    "password": "Correcthorse123!",
                    "full_name": "Requester",
                },
            },
        )
        assert response.status_code == 200
        return response.json()


def _setup_owner_ttx_token(client: TestClient, db_session: Session, suffix: str):
    owner = _signup(client, f"owner{suffix}@acme.com", f"Acme{suffix}")
    _enable_totp(db_session, owner["user"]["id"])
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    token = _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext=f"token-{suffix}")
    return owner, ttx, token


def test_list_access_requests_shows_pending_only(client: TestClient, db_session: Session) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "1")
    _redeem_as_new_account("token-1", "req1@external.com")

    response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["user"]["email"] == "req1@external.com"
    assert body["items"][0]["status"] == "pending"
    assert body["items"][0]["role"] == "player"
    # Player requests are never domain-gated.
    assert body["items"][0]["is_allowed_domain"] is True


def test_list_access_requests_empty_when_none_pending(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "2")

    response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")

    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_list_access_requests_as_other_org_program_manager_is_denied(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "3")

    client.cookies.clear()
    _signup(client, "intruder3@other.com", "Intruder Org 3")

    response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")
    assert response.status_code == 403


def test_approve_access_request_grants_ttx_access(client: TestClient, db_session: Session) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "4")
    redeemed = _redeem_as_new_account("token-4", "req4@external.com")

    list_response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")
    request_id = list_response.json()["items"][0]["id"]

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/approve",
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "approved"

    granted = db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == uuid.UUID(redeemed["user"]["id"]))
    ).first()
    assert granted is not None
    assert granted.role == RoleEnum.PLAYER

    # no longer shows up in the pending list
    still_pending = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")
    assert still_pending.json()["total"] == 0


def test_reject_access_request_does_not_grant_access(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "5")
    redeemed = _redeem_as_new_account("token-5", "req5@external.com")

    list_response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")
    request_id = list_response.json()["items"][0]["id"]

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/reject",
        headers=_csrf_headers(client),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"

    granted = db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == uuid.UUID(redeemed["user"]["id"]))
    ).first()
    assert granted is None


def test_a_rejected_user_waits_a_day_before_asking_again(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, _ = _setup_owner_ttx_token(client, db_session, "cooldown")
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="token-cooldown-2")
    with TestClient(app) as redeemer:
        first = redeemer.post(
            "/api/v1/invitation-tokens/redeem",
            json={
                "token": "token-cooldown",
                "account": {
                    "email": "again@external.com",
                    "password": "Correcthorse123!",
                    "full_name": "Again",
                },
            },
        )
        assert first.status_code == 200
        request_id = client.get(f"/api/v1/ttx/{ttx.id}/access-requests").json()["items"][0]["id"]
        rejected = client.post(
            f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/reject",
            headers=_csrf_headers(client),
        )
        assert rejected.status_code == 200

        def redeem_again():
            return redeemer.post(
                "/api/v1/invitation-tokens/redeem",
                json={"token": "token-cooldown-2"},
                headers=_csrf_headers(redeemer),
            )

        # Another code doesn't get round it.
        refused = redeem_again()
        assert refused.status_code == 409
        assert refused.json()["error"]["code"] == "ACCESS_REQUEST_RECENTLY_REJECTED"

        request = db_session.get(TTXAccessRequest, uuid.UUID(request_id))
        request.decided_at = datetime.now(UTC) - timedelta(hours=25)
        db_session.add(request)
        db_session.commit()
        assert redeem_again().status_code == 200


def test_approve_already_decided_request_is_rejected(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "6")
    _redeem_as_new_account("token-6", "req6@external.com")

    list_response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")
    request_id = list_response.json()["items"][0]["id"]

    first = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/approve",
        headers=_csrf_headers(client),
    )
    assert first.status_code == 200

    second = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/reject",
        headers=_csrf_headers(client),
    )
    assert second.status_code == 409
    assert second.json()["error"]["code"] == "ACCESS_REQUEST_ALREADY_DECIDED"


def test_list_access_requests_flags_non_allowlisted_planner_request(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, _ = _setup_owner_ttx_token(client, db_session, "8")
    _seed_token(
        db_session, ttx.id, owner["user"]["id"], plaintext="token-8-eval", role=RoleEnum.PLANNER
    )
    _redeem_as_new_account("token-8-eval", "req8@external.com")

    response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")

    assert response.status_code == 200
    # Only acme.com (seeded at signup) is allowed.
    assert response.json()["items"][0]["is_allowed_domain"] is False


def test_approve_planner_request_needs_the_org_planner_grant(
    client: TestClient, db_session: Session
) -> None:
    # Every path onto the planning team needs the org Planner grant a
    # Program Manager gave (which is itself domain-allowlisted) -- a
    # Planner-role request is no shortcut around it.
    owner, ttx, _ = _setup_owner_ttx_token(client, db_session, "20")
    _seed_token(
        db_session, ttx.id, owner["user"]["id"], plaintext="token-20-eval", role=RoleEnum.PLANNER
    )
    redeemed = _redeem_as_new_account("token-20-eval", "req20@acme.com")
    request_id = client.get(f"/api/v1/ttx/{ttx.id}/access-requests").json()["items"][0]["id"]

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/approve",
        headers=_csrf_headers(client),
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "NOT_ORG_PLANNER"
    assert (
        db_session.exec(
            select(TTXAccess).where(TTXAccess.user_id == uuid.UUID(redeemed["user"]["id"]))
        ).first()
        is None
    )
    # Still pending -- approvable once a Program Manager grants Planner.
    pending = client.get(f"/api/v1/ttx/{ttx.id}/access-requests").json()["items"]
    assert [item["id"] for item in pending] == [request_id]

    granted = client.post(
        f"/api/v1/organizations/{owner['organization']['id']}/planners",
        json={"email": "req20@acme.com"},
        headers=_csrf_headers(client),
    )
    assert granted.status_code == 201, granted.text

    response = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{request_id}/approve",
        headers=_csrf_headers(client),
    )
    assert response.status_code == 200
    assert response.json()["role"] == "planner"


def test_list_access_requests_sort_dir(client: TestClient, db_session: Session) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "9")
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="token-9-second")
    _redeem_as_new_account("token-9", "req9a@external.com")
    _redeem_as_new_account("token-9-second", "req9b@external.com")

    default_response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests")
    default_emails = [item["user"]["email"] for item in default_response.json()["items"]]
    assert default_emails == ["req9b@external.com", "req9a@external.com"]

    asc_response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests", params={"sort_dir": "asc"})
    asc_emails = [item["user"]["email"] for item in asc_response.json()["items"]]
    assert asc_emails == ["req9a@external.com", "req9b@external.com"]


def test_approve_unknown_request_returns_404(client: TestClient, db_session: Session) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "7")

    unknown_id = "00000000-0000-0000-0000-000000000000"
    response = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{unknown_id}/approve",
        headers=_csrf_headers(client),
    )
    assert response.status_code == 404


def test_list_access_requests_search_and_alphabetical_sort(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "10")
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="token-10-b")
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="token-10-c")

    for token_plaintext, email, full_name in [
        ("token-10", "zoe@acme.com", "Zoe Requester"),
        ("token-10-b", "amy@acme.com", "Amy Requester"),
        ("token-10-c", "bob@external.com", "Bob External"),
    ]:
        redeemed = _redeem_as_new_account(token_plaintext, email)
        user = db_session.get(User, uuid.UUID(redeemed["user"]["id"]))
        user.full_name = full_name
        db_session.add(user)
        db_session.commit()

    response = client.get(
        f"/api/v1/ttx/{ttx.id}/access-requests", params={"sort_by": "name", "sort_dir": "asc"}
    )
    assert response.status_code == 200
    names = [item["user"]["full_name"] for item in response.json()["items"]]
    assert names == ["Amy Requester", "Bob External", "Zoe Requester"]

    response = client.get(f"/api/v1/ttx/{ttx.id}/access-requests", params={"q": "external"})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    assert body["items"][0]["user"]["email"] == "bob@external.com"


def test_list_access_requests_alphabetical_sort_desc(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "11")
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="token-11-b")
    _seed_token(db_session, ttx.id, owner["user"]["id"], plaintext="token-11-c")

    for token_plaintext, email, full_name in [
        ("token-11", "zoe-desc@acme.com", "Zoe Requester"),
        ("token-11-b", "amy-desc@acme.com", "Amy Requester"),
        ("token-11-c", "bob-desc@external.com", "Bob External"),
    ]:
        redeemed = _redeem_as_new_account(token_plaintext, email)
        user = db_session.get(User, uuid.UUID(redeemed["user"]["id"]))
        user.full_name = full_name
        db_session.add(user)
        db_session.commit()

    # Z to A, the exact reverse of the asc test.
    response = client.get(
        f"/api/v1/ttx/{ttx.id}/access-requests", params={"sort_by": "name", "sort_dir": "desc"}
    )
    assert response.status_code == 200
    names = [item["user"]["full_name"] for item in response.json()["items"]]
    assert names == ["Zoe Requester", "Bob External", "Amy Requester"]
