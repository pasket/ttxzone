"""Creator -> Invitations -> Players: who has joined the exercise, and
taking a Player out again."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import RoleEnum, TTXAccess
from tests.test_ttx_access_requests import (
    _csrf_headers,
    _seed_token,
    _setup_owner_ttx_token,
)
from tests.test_ttx_evaluation import _account


def _url(ttx_id, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/players{suffix}"


def _join(client: TestClient, redeemer: TestClient, ttx_id, token: str, email: str) -> str:
    """Redeem `token` (a new account, or the redeemer's own session once it
    has one) and have the owner approve the request; the Player's id."""
    body: dict = {"token": token}
    headers: dict = {}
    if redeemer.cookies:
        headers = _csrf_headers(redeemer)
    else:
        body["account"] = {"email": email, "password": "Correcthorse123!", "full_name": email}
    redeemed = redeemer.post("/api/v1/invitation-tokens/redeem", json=body, headers=headers)
    assert redeemed.status_code == 200, redeemed.text
    pending = client.get(f"/api/v1/ttx/{ttx_id}/access-requests").json()["items"]
    request_id = next(r["id"] for r in pending if r["user"]["email"] == email)
    approved = client.post(
        f"/api/v1/ttx/{ttx_id}/access-requests/{request_id}/approve",
        headers=_csrf_headers(client),
    )
    assert approved.status_code == 200, approved.text
    return redeemed.json()["user"]["id"]


def test_the_players_who_joined_are_listed_with_their_invitation(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "p1")
    token.description = "SOC shift"
    db_session.add(token)
    db_session.commit()
    with TestClient(app) as redeemer:
        player_id = _join(client, redeemer, ttx.id, "token-p1", "ana@external.com")
    # Added another way: no invitation.
    bea = _account(db_session, "bea@external.com", "Bea")
    db_session.add(TTXAccess(user_id=bea.id, ttx_id=ttx.id, role=RoleEnum.PLAYER))
    db_session.commit()

    response = client.get(_url(ttx.id))

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["uses_rooms"] is False
    by_email = {p["email"]: p for p in body["items"]}
    # The team (the owner's Planner seat) is never listed.
    assert set(by_email) == {"ana@external.com", "bea@external.com"}
    ana = by_email["ana@external.com"]
    assert ana["user_id"] == player_id
    assert ana["invitation"] == {"id": str(token.id), "description": "SOC shift"}
    assert ana["room"] is None
    assert by_email["bea@external.com"]["invitation"] is None


def test_a_seated_player_shows_their_room_while_rooms_are_on(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "p2")
    with TestClient(app) as redeemer:
        player_id = _join(client, redeemer, ttx.id, "token-p2", "ana@external.com")
    headers = _csrf_headers(client)
    client.put(f"/api/v1/ttx/{ttx.id}/rooms/settings", json={"uses_rooms": True}, headers=headers)
    room = client.post(f"/api/v1/ttx/{ttx.id}/rooms", json={"name": "Blue"}, headers=headers)
    room_id = room.json()["rooms"][0]["id"]
    client.put(
        f"/api/v1/ttx/{ttx.id}/rooms/assignments",
        json={"assignments": [{"user_id": player_id, "room_id": room_id}]},
        headers=headers,
    )

    player = client.get(_url(ttx.id)).json()["items"][0]
    assert player["room"] == {"code": "RM-01", "name": "Blue"}

    client.put(f"/api/v1/ttx/{ttx.id}/rooms/settings", json={"uses_rooms": False}, headers=headers)
    assert client.get(_url(ttx.id)).json()["items"][0]["room"] is None


def test_a_removed_player_is_gone_and_can_join_again(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "p3")
    _seed_token(db_session, ttx.id, uuid.UUID(owner["user"]["id"]), plaintext="token-p3-bis")
    with TestClient(app) as redeemer:
        player_id = _join(client, redeemer, ttx.id, "token-p3", "ana@external.com")

        response = client.delete(_url(ttx.id, f"/{player_id}"), headers=_csrf_headers(client))

        assert response.status_code == 204
        assert client.get(_url(ttx.id)).json()["items"] == []
        db_session.expire_all()
        assert (
            db_session.exec(
                select(TTXAccess).where(TTXAccess.user_id == uuid.UUID(player_id))
            ).first()
            is None
        )
        # Back in with another code and a fresh approval.
        _join(client, redeemer, ttx.id, "token-p3-bis", "ana@external.com")
    assert [p["user_id"] for p in client.get(_url(ttx.id)).json()["items"]] == [player_id]


def test_a_player_who_left_can_join_again(client: TestClient, db_session: Session) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "p4")
    _seed_token(db_session, ttx.id, uuid.UUID(owner["user"]["id"]), plaintext="token-p4-bis")
    with TestClient(app) as redeemer:
        _join(client, redeemer, ttx.id, "token-p4", "ana@external.com")
        asked = redeemer.post(
            f"/api/v1/ttx/{ttx.id}/leave-request", json={}, headers=_csrf_headers(redeemer)
        )
        assert asked.status_code == 201, asked.text
        left = client.post(
            f"/api/v1/ttx/{ttx.id}/leave-requests/{asked.json()['id']}/approve",
            headers=_csrf_headers(client),
        )
        assert left.status_code == 200, left.text
        again = redeemer.post(
            "/api/v1/invitation-tokens/redeem",
            json={"token": "token-p4-bis"},
            headers=_csrf_headers(redeemer),
        )
        assert again.status_code == 200, again.text


def test_only_players_are_removed_here(client: TestClient, db_session: Session) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "p5")

    for user_id in (owner["user"]["id"], str(uuid.uuid4())):
        response = client.delete(_url(ttx.id, f"/{user_id}"), headers=_csrf_headers(client))
        assert response.status_code == 404
        assert response.json()["error"]["code"] == "PLAYER_NOT_FOUND"
    db_session.expire_all()
    assert db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == uuid.UUID(owner["user"]["id"]))
    ).first()


def test_another_organization_never_sees_the_players(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, token = _setup_owner_ttx_token(client, db_session, "p6")
    client.cookies.clear()
    _setup_owner_ttx_token(client, db_session, "p6-other")

    assert client.get(_url(ttx.id)).status_code == 403
