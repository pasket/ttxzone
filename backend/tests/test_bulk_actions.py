"""Several rows at once: requests to join decided together, Players
removed together, exercises archived together -- each row by the rules it
has on its own, and one that fails never stopping the rest."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.main import app
from app.models import TTX, AccessRequestStatus, RoleEnum, TTXAccess, TTXAccessRequest
from tests.test_ttx_access_requests import (
    _csrf_headers,
    _redeem_as_new_account,
    _seed_ttx,
    _setup_owner_ttx_token,
    _signup,
)
from tests.test_ttx_players import _join


def _post(client: TestClient, path: str, body: dict, **headers: str):
    return client.post(
        f"/api/v1/ttx{path}", json=body, headers={**_csrf_headers(client), **headers}
    )


def _pending(client: TestClient, ttx_id) -> dict[str, str]:
    items = client.get(f"/api/v1/ttx/{ttx_id}/access-requests").json()["items"]
    return {item["user"]["email"]: item["id"] for item in items}


def test_requests_are_approved_together_and_a_decided_one_is_reported(
    client: TestClient, db_session: Session
) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "b1")
    for name in ("ana", "bea", "cai"):
        _redeem_as_new_account("token-b1", f"{name}@external.com")
    pending = _pending(client, ttx.id)
    # One was already rejected on its own: it's reported, in the caller's
    # language, and the others still go through.
    rejected = client.post(
        f"/api/v1/ttx/{ttx.id}/access-requests/{pending['cai@external.com']}/reject",
        headers=_csrf_headers(client),
    )
    assert rejected.status_code == 200
    unknown = str(uuid.uuid4())

    response = _post(
        client,
        f"/{ttx.id}/access-requests/decide",
        {"request_ids": [*pending.values(), unknown], "decision": "approve"},
        **{"Accept-Language": "es"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert sorted(body["done"]) == sorted(
        [pending["ana@external.com"], pending["bea@external.com"]]
    )
    assert sorted(f["id"] for f in body["failed"]) == sorted([pending["cai@external.com"], unknown])
    assert all(f["code"] and f["message"] for f in body["failed"])
    db_session.expire_all()
    players = db_session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.role == RoleEnum.PLAYER)
    ).all()
    assert len(players) == 2
    assert _pending(client, ttx.id) == {}


def test_requests_are_rejected_together(client: TestClient, db_session: Session) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "b2")
    for name in ("ana", "bea"):
        _redeem_as_new_account("token-b2", f"{name}@external.com")
    pending = _pending(client, ttx.id)

    response = _post(
        client,
        f"/{ttx.id}/access-requests/decide",
        # The same id twice is one row.
        {"request_ids": [*pending.values(), *pending.values()], "decision": "reject"},
    )

    assert response.status_code == 200
    assert len(response.json()["done"]) == 2 and response.json()["failed"] == []
    db_session.expire_all()
    statuses = {r.status for r in db_session.exec(select(TTXAccessRequest)).all()}
    assert statuses == {AccessRequestStatus.REJECTED}
    assert (
        db_session.exec(select(TTXAccess).where(TTXAccess.role == RoleEnum.PLAYER)).first() is None
    )


def test_players_are_removed_together_and_never_the_team(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, _ = _setup_owner_ttx_token(client, db_session, "b3")
    players = []
    for name in ("ana", "bea", "cai"):
        with TestClient(app) as redeemer:
            players.append(_join(client, redeemer, ttx.id, "token-b3", f"{name}@external.com"))

    response = _post(
        client,
        f"/{ttx.id}/players/remove",
        {"user_ids": [players[0], players[1], owner["user"]["id"]]},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert sorted(body["done"]) == sorted(players[:2])
    assert [(f["id"], f["code"]) for f in body["failed"]] == [
        (owner["user"]["id"], "PLAYER_NOT_FOUND")
    ]
    left = client.get(f"/api/v1/ttx/{ttx.id}/players").json()["items"]
    assert [p["user_id"] for p in left] == [players[2]]
    db_session.expire_all()
    assert db_session.exec(
        select(TTXAccess).where(TTXAccess.user_id == uuid.UUID(owner["user"]["id"]))
    ).first()


def test_exercises_are_archived_together_only_by_who_may(
    client: TestClient, db_session: Session
) -> None:
    owner, ttx, _ = _setup_owner_ttx_token(client, db_session, "b4")
    second = _seed_ttx(db_session, owner["organization"]["id"], owner["user"]["id"])
    unknown = str(uuid.uuid4())

    response = _post(client, "/archive-many", {"ttx_ids": [str(ttx.id), str(second.id), unknown]})

    assert response.status_code == 200, response.text
    body = response.json()
    assert sorted(body["done"]) == sorted([str(ttx.id), str(second.id)])
    assert [f["id"] for f in body["failed"]] == [unknown]
    db_session.expire_all()
    assert all(db_session.get(TTX, i).archived_at is not None for i in (ttx.id, second.id))

    back = _post(client, "/archive-many", {"ttx_ids": [str(ttx.id)], "archived": False})
    assert back.json()["done"] == [str(ttx.id)]
    db_session.expire_all()
    assert db_session.get(TTX, ttx.id).archived_at is None

    # Someone from another organization archives none of them.
    with TestClient(app) as outsider:
        _signup(outsider, "owner@other.com", "Other")
        refused = _post(outsider, "/archive-many", {"ttx_ids": [str(second.id)], "archived": False})
        assert refused.status_code == 200
        assert refused.json()["done"] == [] and len(refused.json()["failed"]) == 1
    db_session.expire_all()
    assert db_session.get(TTX, second.id).archived_at is not None


def test_a_list_is_bounded_and_never_empty(client: TestClient, db_session: Session) -> None:
    _, ttx, _ = _setup_owner_ttx_token(client, db_session, "b5")
    too_many = [str(uuid.uuid4()) for _ in range(201)]
    for path, body in (
        (f"/{ttx.id}/access-requests/decide", {"request_ids": [], "decision": "approve"}),
        (f"/{ttx.id}/access-requests/decide", {"request_ids": too_many, "decision": "approve"}),
        (f"/{ttx.id}/access-requests/decide", {"request_ids": too_many[:1], "decision": "x"}),
        (f"/{ttx.id}/players/remove", {"user_ids": too_many}),
        ("/archive-many", {"ttx_ids": []}),
    ):
        assert _post(client, path, body).status_code == 422, (path, body.keys())
