"""A Player asks to leave an exercise; its Planners approve or reject."""

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import TTXAccess
from tests.test_ttx_access_requests import _csrf_headers, _setup_owner_ttx_token
from tests.test_ttx_players import _join


def _ask(player: TestClient, ttx_id, reason: str = ""):
    return player.post(
        f"/api/v1/ttx/{ttx_id}/leave-request",
        json={"reason": reason},
        headers=_csrf_headers(player),
    )


def _still_plays(db_session: Session, ttx_id, user_id: str) -> bool:
    db_session.expire_all()
    return (
        db_session.exec(
            select(TTXAccess).where(TTXAccess.ttx_id == ttx_id, TTXAccess.user_id == user_id)
        ).first()
        is not None
    )


def test_a_player_asks_to_leave_and_the_planners_approve(
    client: TestClient, db_session: Session
) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "l1")
    with TestClient(app) as player:
        player_id = _join(client, player, ttx.id, "token-l1", "ana@external.com")

        asked = _ask(player, ttx.id, "  Moved to another team  ")
        assert asked.status_code == 201, asked.text
        assert asked.json()["reason"] == "Moved to another team"
        assert asked.json()["ttx_name"] == ttx.name
        # Twice: already asked.
        assert _ask(player, ttx.id).json()["error"]["code"] == "LEAVE_REQUEST_PENDING"
        mine = player.get("/api/v1/leave-requests/me").json()
        assert [r["ttx_id"] for r in mine] == [str(ttx.id)]

        pending = client.get(f"/api/v1/ttx/{ttx.id}/leave-requests").json()
        assert [(r["email"], r["reason"]) for r in pending] == [
            ("ana@external.com", "Moved to another team")
        ]
        approved = client.post(
            f"/api/v1/ttx/{ttx.id}/leave-requests/{pending[0]['id']}/approve",
            headers=_csrf_headers(client),
        )
        assert approved.status_code == 200, approved.text
        assert approved.json()["status"] == "approved"
        assert not _still_plays(db_session, ttx.id, player_id)
        assert client.get(f"/api/v1/ttx/{ttx.id}/leave-requests").json() == []
        assert player.get("/api/v1/leave-requests/me").json() == []
        # Decided once.
        again = client.post(
            f"/api/v1/ttx/{ttx.id}/leave-requests/{pending[0]['id']}/reject",
            headers=_csrf_headers(client),
        )
        assert again.json()["error"]["code"] == "LEAVE_REQUEST_ALREADY_DECIDED"


def test_a_rejected_request_keeps_the_player_who_may_ask_again(
    client: TestClient, db_session: Session
) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "l2")
    with TestClient(app) as player:
        player_id = _join(client, player, ttx.id, "token-l2", "bea@external.com")
        request_id = _ask(player, ttx.id).json()["id"]

        rejected = client.post(
            f"/api/v1/ttx/{ttx.id}/leave-requests/{request_id}/reject",
            headers=_csrf_headers(client),
        )
        assert rejected.status_code == 200, rejected.text
        assert rejected.json()["status"] == "rejected"
        assert _still_plays(db_session, ttx.id, player_id)
        assert _ask(player, ttx.id).status_code == 201


def test_only_a_player_of_the_exercise_asks(client: TestClient, db_session: Session) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "l3")
    # The owner plans it: a team member leaves by other means.
    response = _ask(client, ttx.id)
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "PLAYER_NOT_FOUND"


def test_removing_the_player_closes_their_request(client: TestClient, db_session: Session) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "l4")
    with TestClient(app) as player:
        player_id = _join(client, player, ttx.id, "token-l4", "cris@external.com")
        request_id = _ask(player, ttx.id).json()["id"]

        removed = client.delete(
            f"/api/v1/ttx/{ttx.id}/players/{player_id}", headers=_csrf_headers(client)
        )
        assert removed.status_code == 204
        stale = client.post(
            f"/api/v1/ttx/{ttx.id}/leave-requests/{request_id}/approve",
            headers=_csrf_headers(client),
        )
        assert stale.json()["error"]["code"] == "LEAVE_REQUEST_ALREADY_DECIDED"


def test_the_player_cannot_decide_their_own_request(
    client: TestClient, db_session: Session
) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "l5")
    with TestClient(app) as player:
        _join(client, player, ttx.id, "token-l5", "dan@external.com")
        request_id = _ask(player, ttx.id).json()["id"]
        assert player.get(f"/api/v1/ttx/{ttx.id}/leave-requests").status_code == 403
        approved = player.post(
            f"/api/v1/ttx/{ttx.id}/leave-requests/{request_id}/approve",
            headers=_csrf_headers(player),
        )
        assert approved.status_code == 403
