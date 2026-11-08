"""A session played in rooms: each Player sees the injects of their room
and of the main room, where the Controller brings them and projects an
inject for everyone."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session, select

from app.main import app
from app.models import TTX, MselSnapshot, RoleEnum, RunEvent, TTXAccess, TTXRoom
from app.services.ttx_msel_service import latest_snapshot
from tests.test_exercise_run import _post, _ready_plan, _url
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import _account, _as_evaluator, _login
from tests.test_ttx_needs_form import _csrf


def _player(db_session: Session, ttx_id: str, email: str, name: str, room: TTXRoom | None):
    user = _account(db_session, email, name)
    db_session.add(
        TTXAccess(
            user_id=user.id,
            ttx_id=uuid.UUID(ttx_id),
            role=RoleEnum.PLAYER,
            room_id=room.id if room else None,
        )
    )
    db_session.commit()
    player = TestClient(app)
    _login(player, email)
    return user, player


@pytest.fixture
def rooms(client: TestClient, db_session: Session, exercise: dict) -> dict:  # noqa: F811
    """The READY exercise played in two rooms (frozen in its snapshot):
    its first mandatory inject in Blue only, the second in Red only, the
    rest in both. Ana sits in Blue, Rob in Red, Una in none. The session
    is started; `client` is its Controller."""
    ttx_id = exercise["ttx"]["id"]
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    ttx.uses_rooms = True
    blue = TTXRoom(ttx_id=ttx.id, code="RM-01", name="Blue", position=0)
    red = TTXRoom(ttx_id=ttx.id, code="RM-02", name="Red", position=1)
    db_session.add_all([ttx, blue, red])
    db_session.commit()
    snapshot = latest_snapshot(db_session, ttx.id)
    payload = snapshot.payload
    payload["uses_rooms"] = True
    payload["rooms"] = [{"id": str(r.id), "code": r.code, "name": r.name} for r in (blue, red)]
    mandatory = [i for i in payload["injects"] if i["kind"] == "mandatory"]
    mandatory[0]["room_ids"] = [str(blue.id)]
    mandatory[1]["room_ids"] = [str(red.id)]
    flag_modified(snapshot, "payload")
    db_session.add(snapshot)
    db_session.commit()

    _ready_plan(client, ttx_id)
    assert _post(client, ttx_id, "/start").status_code == 200
    ana, ana_client = _player(db_session, ttx_id, "ana@acme.com", "Ana Ruiz", blue)
    rob, rob_client = _player(db_session, ttx_id, "rob@acme.com", "Rob Red", red)
    una, una_client = _player(db_session, ttx_id, "una@acme.com", "Una Seat", None)
    return {
        "ttx_id": ttx_id,
        "blue": blue,
        "red": red,
        "codes": [i["code"] for i in mandatory],
        "ana": (ana, ana_client),
        "rob": (rob, rob_client),
        "una": (una, una_client),
    }


def _view(player: TestClient, ttx_id: str) -> dict:
    response = player.get(_url(ttx_id), params={"as": "player"})
    assert response.status_code == 200, response.text
    return response.json()


def _codes(view: dict) -> list[str]:
    return [i["code"] for i in view["injects"]]


def test_each_player_sees_only_the_injects_of_their_room(client: TestClient, rooms: dict) -> None:
    ttx_id, (blue_only, red_only, both, *_) = rooms["ttx_id"], rooms["codes"]
    for code in (blue_only, red_only, both):
        assert _post(client, ttx_id, f"/injects/{code}/release").status_code == 200

    ana = _view(rooms["ana"][1], ttx_id)
    assert _codes(ana) == [blue_only, both]
    assert ana["injects"][0]["room_codes"] == ["RM-01"]
    assert ana["rooms"]["me"] == {"room_code": "RM-01", "room_name": "Blue", "location": "room"}
    # A Player learns only their own room.
    assert [r["code"] for r in ana["rooms"]["rooms"]] == ["RM-01"]
    assert ana["rooms"]["players"] is None
    assert _codes(_view(rooms["rob"][1], ttx_id)) == [red_only, both]
    # Without a room: the main room only, where nothing is projected yet.
    una = _view(rooms["una"][1], ttx_id)
    assert _codes(una) == [] and una["rooms"]["me"]["location"] == "main"

    # The team sees every delivered inject and every room.
    team = client.get(_url(ttx_id), params={"as": "controller"}).json()
    assert _codes(team) == [blue_only, red_only, both]
    assert [(r["code"], r["players"]) for r in team["rooms"]["rooms"]] == [
        ("RM-01", 1),
        ("RM-02", 1),
    ]
    control = {i["code"]: i["room_codes"] for i in team["control"]["injects"]}
    assert control[blue_only] == ["RM-01"] and control[both] == []
    assert {p["name"]: p["location"] for p in team["rooms"]["players"]} == {
        "Ana Ruiz": "room",
        "Rob Red": "room",
        "Una Seat": "main",
    }


def test_what_the_main_room_projects_everyone_there_sees(client: TestClient, rooms: dict) -> None:
    ttx_id, red_only = rooms["ttx_id"], rooms["codes"][1]
    _post(client, ttx_id, f"/injects/{red_only}/release")
    refused = _post(client, ttx_id, "/main/project", json={"code": rooms["codes"][2]})
    assert refused.json()["error"]["code"] == "INJECT_NOT_RELEASED"

    body = _post(client, ttx_id, "/main/project", json={"code": red_only}).json()
    assert body["rooms"]["main_projected"] == red_only
    # Once projected, Blue's Player sees it too -- the main room's history.
    ana = _view(rooms["ana"][1], ttx_id)
    assert _codes(ana) == [red_only] and ana["rooms"]["main_history"] == [red_only]
    assert _view(rooms["una"][1], ttx_id)["rooms"]["main_projected"] == red_only

    cleared = _post(client, ttx_id, "/main/project", json={"code": None}).json()
    assert cleared["rooms"]["main_projected"] is None
    assert cleared["rooms"]["main_history"] == [red_only]


def test_the_controller_moves_players_between_their_room_and_the_main_one(
    client: TestClient, rooms: dict
) -> None:
    ttx_id = rooms["ttx_id"]
    ana, rob, una = rooms["ana"][0], rooms["rob"][0], rooms["una"][0]

    body = _post(client, ttx_id, "/players/move", json={"to": "main"}).json()
    assert body["rooms"]["in_main"] == 3
    assert _view(rooms["ana"][1], ttx_id)["rooms"]["me"]["location"] == "main"

    body = _post(client, ttx_id, "/players/move", json={"to": "room", "room_code": "RM-02"}).json()
    where = {p["name"]: p["location"] for p in body["rooms"]["players"]}
    assert where == {"Ana Ruiz": "main", "Rob Red": "room", "Una Seat": "main"}
    assert [r["in_main"] for r in body["rooms"]["rooms"]] == [1, 0]

    body = _post(
        client, ttx_id, "/players/move", json={"to": "room", "user_ids": [str(ana.id)]}
    ).json()
    assert {p["name"]: p["location"] for p in body["rooms"]["players"]}["Ana Ruiz"] == "room"
    refused = _post(client, ttx_id, "/players/move", json={"to": "room", "user_ids": [str(una.id)]})
    assert refused.json()["error"]["code"] == "PLAYER_WITHOUT_ROOM"
    assert (
        _post(
            client, ttx_id, "/players/move", json={"to": "main", "user_ids": [str(uuid.uuid4())]}
        ).status_code
        == 404
    )
    # Only the Controller moves anyone.
    denied = rooms["ana"][1].post(
        _url(ttx_id, "/players/move"), json={"to": "main"}, headers=_csrf(rooms["ana"][1])
    )
    assert denied.status_code == 403
    assert rob.id != ana.id


def test_a_player_seated_mid_session_goes_to_the_new_room(
    client: TestClient, db_session: Session, rooms: dict
) -> None:
    ttx_id, (blue_only, red_only, *_) = rooms["ttx_id"], rooms["codes"]
    una, una_client = rooms["una"]
    _post(client, ttx_id, f"/injects/{blue_only}/release")
    _post(client, ttx_id, f"/injects/{red_only}/release")

    body = client.put(
        _url(ttx_id, "/seats"),
        json={"assignments": [{"user_id": str(una.id), "room_code": "RM-02"}]},
        headers=_csrf(client),
    ).json()
    assert {p["name"]: p["room_code"] for p in body["rooms"]["players"]}["Una Seat"] == "RM-02"
    view = _view(una_client, ttx_id)
    assert view["rooms"]["me"]["location"] == "room" and _codes(view) == [red_only]
    events = db_session.exec(select(RunEvent.type).order_by(RunEvent.seq)).all()
    assert events[-1] == "players_seated"
    _post(client, ttx_id, "/main/project", json={"code": red_only})
    log = client.get(_url(ttx_id, "/export/log.csv"))
    assert log.status_code == 200, log.text
    text = log.content.decode("utf-8-sig")
    assert "Players seated" in text and "Main room screen" in text and red_only in text


def test_a_player_never_loads_an_image_of_another_room(
    client: TestClient, db_session: Session, rooms: dict
) -> None:
    from app.services.exercise_run_service import find_run, released_image_ids

    ttx_id, blue_only = rooms["ttx_id"], rooms["codes"][0]
    snapshot = db_session.exec(select(MselSnapshot)).first()
    inject = next(i for i in snapshot.payload["injects"] if i["code"] == blue_only)
    inject["images"] = [{"id": "img-1", "caption": "", "width": 1, "height": 1}]
    flag_modified(snapshot, "payload")
    db_session.add(snapshot)
    db_session.commit()
    _post(client, ttx_id, f"/injects/{blue_only}/release")

    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    run = find_run(db_session, ttx.id)
    shown = {
        name: released_image_ids(db_session, run, all_images=False, ttx=ttx, player=rooms[name][0])
        for name in ("ana", "rob")
    }
    assert shown == {"ana": {"img-1"}, "rob": set()}


def test_rooms_need_an_exercise_played_in_rooms(client: TestClient, exercise: dict) -> None:  # noqa: F811
    ttx_id = exercise["ttx"]["id"]
    _ready_plan(client, ttx_id)
    _post(client, ttx_id, "/start")
    view = client.get(_url(ttx_id), params={"as": "controller"}).json()
    assert view["rooms"] is None
    refused = _post(client, ttx_id, "/players/move", json={"to": "main"})
    assert refused.json()["error"]["code"] == "ROOMS_NOT_USED"


def test_a_team_member_opens_the_session_on_their_default_room(
    client: TestClient, db_session: Session, rooms: dict
) -> None:
    ttx_id = rooms["ttx_id"]
    team = client.get(_url(ttx_id), params={"as": "controller"}).json()
    assert team["rooms"]["default_room_code"] is None

    controller = db_session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == uuid.UUID(ttx_id), TTXAccess.role == RoleEnum.PLANNER
        )
    ).first()
    controller.room_id = rooms["red"].id
    db_session.add(controller)
    db_session.commit()

    team = client.get(_url(ttx_id), params={"as": "controller"}).json()
    assert team["rooms"]["default_room_code"] == "RM-02"
    # Nobody moved: it's only where the view opens; every room stays in view.
    assert [r["code"] for r in team["rooms"]["rooms"]] == ["RM-01", "RM-02"]
    assert "Rob Red" in {p["name"] for p in team["rooms"]["players"]}
    # A Player never gets one.
    assert _view(rooms["ana"][1], ttx_id)["rooms"]["default_room_code"] is None


def _released(client: TestClient, rooms: dict) -> tuple[str, str]:
    """The Blue-only and the Red-only inject, delivered."""
    ttx_id, (blue_only, red_only, *_) = rooms["ttx_id"], rooms["codes"]
    for code in (blue_only, red_only):
        assert _post(client, ttx_id, f"/injects/{code}/release").status_code == 200
    return blue_only, red_only


def test_each_room_gets_and_covers_its_own_key_questions(client: TestClient, rooms: dict) -> None:
    ttx_id = rooms["ttx_id"]
    blue_only, red_only = _released(client, rooms)
    phase = client.get(_url(ttx_id)).json()["control"]["phases"][0]

    def ask(room: str | None):
        return _post(
            client,
            ttx_id,
            "/questions",
            json={"phase_code": phase["code"], "positions": [0], "room_code": room},
        )

    def cover(room: str):
        return _post(
            client,
            ttx_id,
            "/questions/covered",
            json={"phase_code": phase["code"], "position": 0, "covered": True, "room_code": room},
        )

    assert ask("RM-09").status_code == 404
    # Nothing on the main room's screen: no inject in play there.
    assert ask("main").json()["error"]["code"] == "NO_INJECT_IN_PLAY"
    assert cover("RM-01").json()["error"]["code"] == "QUESTION_NOT_ASKED"

    asked = ask("RM-01").json()
    # On the inject in play in that room, though Red's went out last.
    blue = next(i for i in asked["injects"] if i["code"] == blue_only)
    assert blue["questions"][0]["room_code"] == "RM-01"
    assert [i["questions"] for i in asked["injects"] if i["code"] == red_only] == [[]]
    place = asked["control"]["phases"][0]["question_places"]
    assert place == [{"room_code": "RM-01", "released_questions": [0], "covered_questions": []}]

    # Only that room's Players read it.
    seen = _view(rooms["ana"][1], ttx_id)["injects"][0]["questions"]
    assert seen[0]["text"] == phase["key_questions"][0]
    assert all(not i["questions"] for i in _view(rooms["rob"][1], ttx_id)["injects"])

    # The same question in Red is another question: Blue covering it doesn't.
    assert cover("RM-02").json()["error"]["code"] == "QUESTION_NOT_ASKED"
    assert ask("RM-02").status_code == 200
    assert cover("RM-01").status_code == 200
    places = {
        p["room_code"]: p
        for p in client.get(_url(ttx_id)).json()["control"]["phases"][0]["question_places"]
    }
    assert places["RM-01"]["covered_questions"] == [0]
    assert places["RM-02"]["covered_questions"] == []


def test_a_team_members_note_on_an_inject_is_per_room(client: TestClient, rooms: dict) -> None:
    ttx_id = rooms["ttx_id"]
    both = rooms["codes"][2]
    assert _post(client, ttx_id, f"/injects/{both}/release").status_code == 200
    notes = _url(ttx_id, "/notes")

    def write(text: str, room: str, code: str = both) -> dict:
        response = client.put(
            notes,
            params={"as": "controller"},
            json={"inject_code": code, "text": text, "room_code": room},
            headers=_csrf(client),
        )
        assert response.status_code == 200, response.text
        return response.json()

    def read(room: str) -> dict[str, str]:
        answer = client.get(notes, params={"as": "controller", "room": room}).json()
        return {n["inject_code"]: n["text"] for n in answer["items"]}

    write("Blue hesitated", "RM-01")
    write("Red moved fast", "RM-02")
    write("Both rooms drifted", "RM-01", code="")

    assert read("RM-01") == {both: "Blue hesitated", "": "Both rooms drifted"}
    # The general note is about the whole session: every room shows it.
    assert read("RM-02") == {both: "Red moved fast", "": "Both rooms drifted"}

    team = client.get(_url(ttx_id, "/notes/team")).json()["items"]
    assert {(n["room_code"], n["text"]) for n in team} == {
        ("RM-01", "Blue hesitated"),
        ("RM-02", "Red moved fast"),
        ("", "Both rooms drifted"),
    }


def test_a_players_note_keeps_no_room(client: TestClient, rooms: dict) -> None:
    ttx_id, ana = rooms["ttx_id"], rooms["ana"][1]
    blue_only, _ = _released(client, rooms)
    saved = ana.put(
        _url(ttx_id, "/notes"),
        params={"as": "player"},
        json={"inject_code": blue_only, "text": "Mine", "room_code": "RM-02"},
        headers=_csrf(ana),
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["items"][0]["room_code"] == ""


def test_each_room_is_rated_on_its_own(
    client: TestClient,
    db_session: Session,
    rooms: dict,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = rooms["ttx_id"]
    _released(client, rooms)
    with TestClient(client.app) as evaluator:
        _as_evaluator(evaluator, db_session, {"evaluator": exercise["evaluator"]})
        evaluation = _url(ttx_id, "/evaluation")
        point = evaluator.get(evaluation, params={"room": "RM-01"}).json()["objectives"][0][
            "points"
        ][0]

        def rate(level: str | None, room: str) -> dict:
            response = evaluator.put(
                _url(ttx_id, f"/ratings/{point['id']}"),
                json={"level": level, "rationale": f"In {room}", "room_code": room},
                headers=_csrf(evaluator),
            )
            assert response.status_code == 200, response.text
            return response.json()

        def level(room: str) -> str | None:
            read = evaluator.get(evaluation, params={"room": room}).json()
            found = next(
                p for o in read["objectives"] for p in o["points"] if p["id"] == point["id"]
            )
            return found["rating"]["level"] if found["rating"] else None

        answered = rate("P", "RM-01")
        assert answered["rated"] == 1
        rate("M", "RM-02")
        assert (level("RM-01"), level("RM-02"), level("main")) == ("P", "M", None)
        # Withdrawing one leaves the other.
        rate(None, "RM-02")
        assert (level("RM-01"), level("RM-02")) == ("P", None)
        rate("M", "RM-02")
        assert evaluator.get(evaluation, params={"room": "RM-09"}).status_code == 404

    assert _post(client, ttx_id, "/end").status_code == 200
    report = client.post(f"/api/v1/ttx/{ttx_id}/aar", json={}, headers=_csrf(client)).json()
    given = [r for o in report["objectives"] for r in o["session_ratings"]]
    assert {(r["room_code"], r["level"]) for r in given} == {("RM-01", "P"), ("RM-02", "M")}
    written = " ".join(o["strengths"] + o["improvements"] for o in report["objectives"])
    assert "RM-01: " in written and "RM-02: " in written
