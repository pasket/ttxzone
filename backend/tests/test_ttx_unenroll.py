import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import TTX, RoleEnum, TTXAccess, User


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


def _csrf_headers(client: TestClient) -> dict:
    return {settings.CSRF_HEADER_NAME: client.cookies[settings.CSRF_COOKIE_NAME]}


def test_a_player_cannot_leave_on_their_own(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner@acme.com", "Acme")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    client.cookies.clear()
    player = _signup(client, "player@external.com", "Player Org")
    db_session.add(
        TTXAccess(user_id=uuid.UUID(player["user"]["id"]), ttx_id=ttx.id, role=RoleEnum.PLAYER)
    )
    db_session.commit()

    response = client.delete(f"/api/v1/ttx/{ttx.id}/access", headers=_csrf_headers(client))

    # A Player asks to leave instead (test_ttx_leave_requests).
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "LEAVE_NEEDS_APPROVAL"
    remaining = db_session.exec(
        select(TTXAccess).where(
            TTXAccess.user_id == uuid.UUID(player["user"]["id"]), TTXAccess.ttx_id == ttx.id
        )
    ).first()
    assert remaining is not None


def test_leave_a_ttx_never_had_access_to_returns_404(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner2@acme.com", "Acme2")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    client.cookies.clear()
    _signup(client, "stranger@external.com", "Stranger Org")

    response = client.delete(f"/api/v1/ttx/{ttx.id}/access", headers=_csrf_headers(client))

    assert response.status_code == 404


def test_leave_ttx_only_removes_own_access_not_another_users(
    client: TestClient, db_session: Session
) -> None:
    owner = _signup(client, "owner3@acme.com", "Acme3")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    other_user = User(
        email="other-player@external.com", hashed_password="unused", full_name="Other"
    )
    db_session.add(other_user)
    db_session.commit()
    db_session.refresh(other_user)
    db_session.add(TTXAccess(user_id=other_user.id, ttx_id=ttx.id, role=RoleEnum.PLAYER))
    db_session.commit()

    client.cookies.clear()
    # An Observer still leaves on their own; a Player asks (test above).
    player = _signup(client, "player4@external.com", "Player Org 4")
    db_session.add(
        TTXAccess(user_id=uuid.UUID(player["user"]["id"]), ttx_id=ttx.id, role=RoleEnum.OBSERVER)
    )
    db_session.commit()

    response = client.delete(f"/api/v1/ttx/{ttx.id}/access", headers=_csrf_headers(client))
    assert response.status_code == 204

    other_still_has_access = db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == other_user.id, TTXAccess.ttx_id == ttx.id)
    ).first()
    assert other_still_has_access is not None


def test_leave_ttx_unauthenticated_returns_401(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner5@acme.com", "Acme5")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    headers = _csrf_headers(client)
    del client.cookies[settings.ACCESS_TOKEN_COOKIE_NAME]

    response = client.delete(f"/api/v1/ttx/{ttx.id}/access", headers=headers)

    assert response.status_code == 401


def test_leave_ttx_without_csrf_is_denied(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner6@acme.com", "Acme6")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    response = client.delete(f"/api/v1/ttx/{ttx.id}/access")

    assert response.status_code == 403


def test_rejoin_after_leaving_succeeds(client: TestClient, db_session: Session) -> None:
    owner = _signup(client, "owner7@acme.com", "Acme7")
    ttx = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])

    client.cookies.clear()
    player = _signup(client, "player7@external.com", "Player Org 7")
    db_session.add(
        TTXAccess(user_id=uuid.UUID(player["user"]["id"]), ttx_id=ttx.id, role=RoleEnum.OBSERVER)
    )
    db_session.commit()

    leave_response = client.delete(f"/api/v1/ttx/{ttx.id}/access", headers=_csrf_headers(client))
    assert leave_response.status_code == 204

    # The unique(user_id, ttx_id) constraint must allow a fresh grant after
    # a hard-delete leave -- simulate a re-grant the same way approval does.
    db_session.add(
        TTXAccess(user_id=uuid.UUID(player["user"]["id"]), ttx_id=ttx.id, role=RoleEnum.OBSERVER)
    )
    db_session.commit()

    rejoined = db_session.exec(
        select(TTXAccess).where(
            TTXAccess.user_id == uuid.UUID(player["user"]["id"]), TTXAccess.ttx_id == ttx.id
        )
    ).first()
    assert rejoined is not None
