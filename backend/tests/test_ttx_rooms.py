"""Rooms: an exercise played by several teams at once, each Player seated
in a room (Creator -> Exercise -> Rooms)."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import TTX, RoleEnum, TTXAccess, TTXRoom
from app.services.ttx_service import delete_exercises
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import _account
from tests.test_ttx_needs_form import _create_ttx, _csrf, _manager


def _url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/rooms{suffix}"


def _player(db_session: Session, ttx_id: str, email: str, name: str) -> uuid.UUID:
    user = _account(db_session, email, name)
    db_session.add(TTXAccess(user_id=user.id, ttx_id=uuid.UUID(ttx_id), role=RoleEnum.PLAYER))
    db_session.commit()
    return user.id


@pytest.fixture
def drill(client: TestClient, db_session: Session) -> str:
    owner = _manager(client, db_session, "founder@acme.com", "Acme")
    return _create_ttx(client, owner["organization"]["id"])["id"]


def _on(client: TestClient, ttx_id: str) -> dict:
    response = client.put(
        _url(ttx_id, "/settings"), json={"uses_rooms": True}, headers=_csrf(client)
    )
    assert response.status_code == 200, response.text
    return response.json()


def _add(client: TestClient, ttx_id: str, name: str):
    return client.post(_url(ttx_id), json={"name": name}, headers=_csrf(client))


def test_an_exercise_starts_without_rooms(client: TestClient, drill: str) -> None:
    body = client.get(_url(drill)).json()
    assert {k: v for k, v in body.items() if k != "team"} == {
        "uses_rooms": False,
        "structure_locked": False,
        "rooms": [],
        "players": [],
    }
    refused = _add(client, drill, "Blue")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "ROOMS_DISABLED"


def test_rooms_get_codes_and_unique_names(client: TestClient, drill: str) -> None:
    _on(client, drill)
    assert _add(client, drill, "  Blue   team ").status_code == 201
    body = _add(client, drill, "Red").json()
    assert [(r["code"], r["name"]) for r in body["rooms"]] == [
        ("RM-01", "Blue team"),
        ("RM-02", "Red"),
    ]
    taken = _add(client, drill, "blue TEAM")
    assert taken.status_code == 409
    assert taken.json()["error"]["code"] == "ROOM_NAME_TAKEN"
    assert _add(client, drill, "   ").status_code == 422

    red = body["rooms"][1]["id"]
    renamed = client.patch(
        _url(drill, f"/{red}"), json={"name": "Red team"}, headers=_csrf(client)
    ).json()
    assert renamed["rooms"][1]["name"] == "Red team"
    # A removed room's code is never reused.
    client.delete(_url(drill, f"/{red}"), headers=_csrf(client))
    assert _add(client, drill, "Board").json()["rooms"][1]["code"] == "RM-03"


def test_players_are_seated_in_bulk_and_unseated_when_their_room_goes(
    client: TestClient, db_session: Session, drill: str
) -> None:
    _on(client, drill)
    ana = _player(db_session, drill, "ana@acme.com", "Ana Ruiz")
    luis = _player(db_session, drill, "luis@acme.com", "Luis Gil")
    blue = _add(client, drill, "Blue").json()["rooms"][0]["id"]

    body = client.put(
        _url(drill, "/assignments"),
        json={"assignments": [{"user_id": str(ana), "room_id": blue}, {"user_id": str(luis)}]},
        headers=_csrf(client),
    ).json()
    seats = {p["full_name"]: p["room_id"] for p in body["players"]}
    assert seats == {"Ana Ruiz": blue, "Luis Gil": None}
    assert body["rooms"][0]["player_count"] == 1

    body = client.delete(_url(drill, f"/{blue}"), headers=_csrf(client)).json()
    assert body["rooms"] == [] and body["players"][0]["room_id"] is None


def test_only_players_and_the_session_team_get_a_room(
    client: TestClient, db_session: Session, drill: str
) -> None:
    _on(client, drill)
    blue = _add(client, drill, "Blue").json()["rooms"][0]["id"]
    ana = _player(db_session, drill, "ana@acme.com", "Ana Ruiz")
    planner = db_session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == uuid.UUID(drill), TTXAccess.role == RoleEnum.PLANNER
        )
    ).first()
    # Someone who only plans never follows the session: no room for them.
    planner.controls = False
    db_session.add(planner)
    db_session.commit()

    def seat(user_id, room_id=blue):
        return client.put(
            _url(drill, "/assignments"),
            json={"assignments": [{"user_id": str(user_id), "room_id": room_id}]},
            headers=_csrf(client),
        )

    assert seat(planner.user_id).json()["error"]["code"] == "ROOM_PLAYERS_ONLY"
    assert seat(uuid.uuid4()).status_code == 404
    assert seat(ana, str(uuid.uuid4())).json()["error"]["code"] == "ROOM_NOT_FOUND"
    # All or none.
    both = client.put(
        _url(drill, "/assignments"),
        json={
            "assignments": [
                {"user_id": str(ana), "room_id": blue},
                {"user_id": str(planner.user_id), "room_id": blue},
            ]
        },
        headers=_csrf(client),
    )
    assert both.status_code == 409
    db_session.expire_all()
    assert db_session.exec(select(TTXAccess).where(TTXAccess.user_id == ana)).one().room_id is None


def test_turning_rooms_off_keeps_them(client: TestClient, db_session: Session, drill: str) -> None:
    _on(client, drill)
    _add(client, drill, "Blue")
    off = client.put(_url(drill, "/settings"), json={"uses_rooms": False}, headers=_csrf(client))
    assert off.json()["uses_rooms"] is False and len(off.json()["rooms"]) == 1
    assert _on(client, drill)["rooms"][0]["name"] == "Blue"


def test_a_ready_msel_freezes_the_rooms_but_not_their_names_or_seats(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ttx.uses_rooms = True
    db_session.add(ttx)
    room = TTXRoom(ttx_id=ttx.id, code="RM-01", name="Blue")
    db_session.add(room)
    db_session.commit()
    ana = _player(db_session, ttx_id, "ana@acme.com", "Ana Ruiz")

    body = client.get(_url(ttx_id)).json()
    assert body["structure_locked"] is True
    for response in (
        _add(client, ttx_id, "Red"),
        client.delete(_url(ttx_id, f"/{room.id}"), headers=_csrf(client)),
        client.put(_url(ttx_id, "/settings"), json={"uses_rooms": False}, headers=_csrf(client)),
    ):
        assert response.status_code == 409
        assert response.json()["error"]["code"] == "ROOMS_LOCKED"
    renamed = client.patch(
        _url(ttx_id, f"/{room.id}"), json={"name": "Navy"}, headers=_csrf(client)
    )
    assert renamed.status_code == 200
    seated = client.put(
        _url(ttx_id, "/assignments"),
        json={"assignments": [{"user_id": str(ana), "room_id": str(room.id)}]},
        headers=_csrf(client),
    )
    assert seated.json()["players"][0]["room_id"] == str(room.id)


def test_deleting_the_exercise_deletes_its_rooms(
    client: TestClient, db_session: Session, drill: str
) -> None:
    _on(client, drill)
    room_id = _add(client, drill, "Blue").json()["rooms"][0]["id"]
    ana = _player(db_session, drill, "ana@acme.com", "Ana Ruiz")
    client.put(
        _url(drill, "/assignments"),
        json={"assignments": [{"user_id": str(ana), "room_id": room_id}]},
        headers=_csrf(client),
    )
    delete_exercises(db_session, [uuid.UUID(drill)])
    db_session.commit()
    assert db_session.exec(select(TTXRoom)).all() == []


def test_team_members_get_a_default_room_without_being_moved(
    client: TestClient, db_session: Session, drill: str
) -> None:
    _on(client, drill)
    blue = _add(client, drill, "Blue").json()["rooms"][0]["id"]
    observer = _account(db_session, "obs@acme.com", "Olga Observer")
    db_session.add(TTXAccess(user_id=observer.id, ttx_id=uuid.UUID(drill), role=RoleEnum.OBSERVER))
    db_session.commit()

    body = client.get(_url(drill)).json()
    team = {m["full_name"]: m for m in body["team"]}
    assert team["Olga Observer"]["roles"] == ["observer"]
    assert (
        "controller" in next(m for m in body["team"] if m["full_name"] != "Olga Observer")["roles"]
    )
    assigned = client.put(
        _url(drill, "/assignments"),
        json={"assignments": [{"user_id": str(observer.id), "room_id": blue}]},
        headers=_csrf(client),
    )
    assert assigned.status_code == 200, assigned.text
    team = {m["full_name"]: m for m in assigned.json()["team"]}
    assert team["Olga Observer"]["room_id"] == blue
    # Not a Player: the room's seat count is the Players'.
    assert assigned.json()["rooms"][0]["player_count"] == 0
