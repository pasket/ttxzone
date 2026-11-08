"""Polls of the MSEL in a live session: one opens with its inject, the
Players vote, and its result stays with the team until the Controller
shows it."""

import uuid

from fastapi.testclient import TestClient
from sqlalchemy.orm.attributes import flag_modified
from sqlmodel import Session

from app.models import TTX
from app.services.ttx_msel_service import latest_snapshot
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_run_decisions import _close, _first_mandatory, _open, _vote
from tests.test_run_rooms import _view
from tests.test_run_rooms import rooms as rooms  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_needs_form import _csrf

OPTIONS = ["Pay", "Refuse", "Wait"]
OUTCOMES = ["They come back for more.", "The data goes public.", ""]
METERS = [{"key": "m1", "name": "Stress"}, {"key": "m2", "name": "Budget"}]
IMPACTS = [{"m1": 1, "m2": 3}, {"m1": 3}, {}]


def _make_poll(
    db_session: Session,
    ttx_id: str,
    code: str,
    outcomes: list[str] = [],  # noqa: B006
    impacts: list[dict] = [],  # noqa: B006
) -> None:
    """Freeze `code` as a poll in the snapshot the session plays."""
    db_session.expire_all()
    snapshot = latest_snapshot(db_session, db_session.get(TTX, uuid.UUID(ttx_id)).id)
    inject = next(i for i in snapshot.payload["injects"] if i["code"] == code)
    inject.update(
        format="poll",
        poll_question="Pay the ransom?",
        poll_options=OPTIONS,
        poll_outcomes=outcomes,
        poll_impacts=impacts,
        expected_actions=[],
    )
    if impacts:
        snapshot.payload["meters"] = METERS
    flag_modified(snapshot, "payload")
    db_session.add(snapshot)
    db_session.commit()


def _show(client: TestClient, ttx_id: str, poll_id: str, shown: bool = True, role="controller"):
    return client.post(
        _url(ttx_id, f"/polls/{poll_id}/results"),
        params={"as": role},
        json={"shown": shown},
        headers=_csrf(client),
    )


def test_a_poll_opens_with_its_inject_and_its_result_waits_for_the_controller(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    first = _first_mandatory(client, ready)
    _make_poll(db_session, ready, first)
    _post(client, ready, "/start")

    released = _post(client, ready, f"/injects/{first}/release")
    assert released.status_code == 200, released.text
    [poll] = released.json()["polls"]
    assert poll["planned"] and poll["open"] and not poll["results_visible"]
    assert poll["question"] == "Pay the ransom?"
    assert [o["text"] for o in poll["options"]] == OPTIONS
    assert released.json()["control"]["injects"][0]["format"] == "poll"

    with TestClient(client.app) as pat, TestClient(client.app) as sam:
        _as_player(pat, db_session, ready)
        _as_player(sam, db_session, ready, "sam.player@acme.com", "Sam Player")
        _vote(pat, ready, poll["id"], 1)
        voted = _vote(sam, ready, poll["id"], 1).json()["polls"][0]

        # The Players know how many voted and what they chose, not the tally.
        assert voted["voters"] == 2 and voted["my_vote"] == 1
        assert [o["votes"] for o in voted["options"]] == [0, 0, 0]
        # The team sees it all along.
        team = client.get(_url(ready)).json()["polls"][0]
        assert [o["votes"] for o in team["options"]] == [0, 2, 0]

        # Showing it never comes before closing: it could sway the vote.
        early = _show(client, ready, poll["id"])
        assert early.json()["error"]["code"] == "POLL_STILL_OPEN"

        _close(client, ready, poll["id"])
        hidden = _view(pat, ready)["polls"][0]
        assert not hidden["open"] and [o["votes"] for o in hidden["options"]] == [0, 0, 0]

        assert _show(client, ready, poll["id"]).status_code == 200
        shown = _view(pat, ready)["polls"][0]
        assert shown["results_visible"] and [o["votes"] for o in shown["options"]] == [0, 2, 0]

        assert _show(client, ready, poll["id"], shown=False).status_code == 200
        again = _view(sam, ready)["polls"][0]
        assert not again["results_visible"]
        assert [o["votes"] for o in again["options"]] == [0, 0, 0]

    # The log says so, in both languages; the report keeps the tally.
    for lang, label in (("en", "Poll result shown or hidden"), ("es", "Resultado de encuesta")):
        log = client.get(_url(ready, "/export/log.csv"), params={"lang": lang})
        assert log.status_code == 200 and label in log.text
    assert client.get(_url(ready, "/export/aar.pdf"), params={"lang": "en"}).status_code == 200


def test_only_the_controller_shows_a_result_and_only_of_a_planned_poll(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    first = _first_mandatory(client, ready)
    _post(client, ready, f"/injects/{first}/release")
    # A vote put on the spot keeps its visible tally.
    poll = _open(client, ready, question="Now?", options=["Yes", "No"]).json()["polls"][0]
    assert not poll["planned"] and poll["results_visible"]
    _close(client, ready, poll["id"])
    assert _show(client, ready, poll["id"]).json()["error"]["code"] == "POLL_NOT_PLANNED"

    with TestClient(client.app) as pat:
        _as_player(pat, db_session, ready)
        assert _show(pat, ready, poll["id"], role="player").status_code == 403


def test_in_rooms_each_room_votes_on_its_own_and_the_main_room_when_projected(
    client: TestClient,
    db_session: Session,
    rooms: dict,  # noqa: F811
) -> None:
    ttx_id, both = rooms["ttx_id"], rooms["codes"][2]
    _make_poll(db_session, ttx_id, both)
    released = _post(client, ttx_id, f"/injects/{both}/release").json()
    blue, red = released["polls"]
    assert (blue["room_code"], red["room_code"]) == ("RM-01", "RM-02")

    ana, rob = rooms["ana"][1], rooms["rob"][1]
    assert [p["id"] for p in _view(ana, ttx_id)["polls"]] == [blue["id"]]
    assert _vote(ana, ttx_id, red["id"], 0).json()["error"]["code"] == "POLL_NOT_YOUR_ROOM"
    assert _vote(rob, ttx_id, red["id"], 0).status_code == 200

    for _ in range(2):  # Projecting it again opens nothing new.
        body = _post(client, ttx_id, "/main/project", json={"code": both}).json()
    assert [p["room_code"] for p in body["polls"]] == ["RM-01", "RM-02", "main"]
    una = _view(rooms["una"][1], ttx_id)
    assert [p["room_code"] for p in una["polls"]] == ["main"]


def test_a_plain_inject_opens_no_poll(
    client: TestClient,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    first = _first_mandatory(client, ready)
    assert _post(client, ready, f"/injects/{first}/release").json()["polls"] == []


def _poll_with_outcomes(client: TestClient, db_session: Session, ttx_id: str) -> str:
    first = _first_mandatory(client, ttx_id)
    _make_poll(db_session, ttx_id, first, OUTCOMES)
    _post(client, ttx_id, "/start")
    [poll] = _post(client, ttx_id, f"/injects/{first}/release").json()["polls"]
    return poll["id"]


def _close_on(client: TestClient, ttx_id: str, poll_id: str, option: int | None):
    return client.post(
        _url(ttx_id, f"/polls/{poll_id}/close"),
        params={"as": "controller"},
        json={"record_option": None, "outcome_option": option},
        headers=_csrf(client),
    )


def test_the_team_chooses_with_the_outcomes_and_the_table_gets_one_with_the_result(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    poll_id = _poll_with_outcomes(client, db_session, ready)
    [poll] = client.get(_url(ready)).json()["polls"]
    assert [o["outcome"] for o in poll["options"]] == [OUTCOMES[0], OUTCOMES[1], None]
    assert poll["outcome"] is None

    closed = _close_on(client, ready, poll_id, 1)
    assert closed.status_code == 200, closed.text
    [poll] = closed.json()["polls"]
    assert poll["outcome_option"] == 1 and poll["outcome"] == OUTCOMES[1]

    with TestClient(client.app) as pat:
        _as_player(pat, db_session, ready)
        [hidden] = _view(pat, ready)["polls"]
        assert hidden["outcome"] is None and hidden["outcome_option"] is None
        assert all(o["outcome"] is None for o in hidden["options"])

        assert _show(client, ready, poll_id).status_code == 200
        [shown] = _view(pat, ready)["polls"]
        assert shown["outcome"] == OUTCOMES[1] and shown["outcome_option"] == 1
        # The options not taken stay with the team.
        assert all(o["outcome"] is None for o in shown["options"])


def test_a_poll_can_close_without_a_consequence_and_refuses_an_unknown_option(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    poll_id = _poll_with_outcomes(client, db_session, ready)
    assert _close_on(client, ready, poll_id, 9).status_code == 422

    [poll] = _close_on(client, ready, poll_id, None).json()["polls"]
    assert poll["outcome"] is None and not poll["open"]


def test_an_option_without_a_consequence_gives_none(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    poll_id = _poll_with_outcomes(client, db_session, ready)
    [poll] = _close_on(client, ready, poll_id, 2).json()["polls"]
    assert poll["outcome"] is None and poll["outcome_option"] is None


def _meters_poll(client: TestClient, db_session: Session, ttx_id: str) -> str:
    first = _first_mandatory(client, ttx_id)
    _make_poll(db_session, ttx_id, first, OUTCOMES, IMPACTS)
    _post(client, ttx_id, "/start")
    [poll] = _post(client, ttx_id, f"/injects/{first}/release").json()["polls"]
    return poll["id"]


def _show_meters(client: TestClient, ttx_id: str, shown: bool = True):
    return client.post(_url(ttx_id, "/meters"), json={"shown": shown}, headers=_csrf(client))


def test_the_meters_add_up_the_decisions_and_reach_the_table_when_shown(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    poll_id = _meters_poll(client, db_session, ready)
    # Nothing settled yet, and the team reads what each option adds.
    view = client.get(_url(ready)).json()
    assert view["meters"] == []
    assert view["polls"][0]["options"][0]["impacts"] == [
        {"name": "Stress", "level": 1},
        {"name": "Budget", "level": 3},
    ]

    [group] = _close_on(client, ready, poll_id, 1).json()["meters"]
    assert group["decisions"] == 1
    # Each out of the most that poll could add.
    assert [(m["name"], m["total"], m["most"]) for m in group["meters"]] == [
        ("Stress", 3, 3),
        ("Budget", 0, 3),
    ]

    with TestClient(client.app) as pat:
        _as_player(pat, db_session, ready)
        hidden = _view(pat, ready)
        assert hidden["meters"] == [] and not hidden["meters_shown"]
        assert all(o["impacts"] == [] for o in hidden["polls"][0]["options"])

        assert _show_meters(client, ready).status_code == 200
        shown = _view(pat, ready)
        assert shown["meters_shown"] and shown["meters"][0]["decisions"] == 1

        _show_meters(client, ready, False)
        assert _view(pat, ready)["meters"] == []


def test_a_poll_closed_without_a_consequence_adds_nothing_to_the_meters(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    poll_id = _meters_poll(client, db_session, ready)
    assert _close_on(client, ready, poll_id, None).json()["meters"] == []


def test_only_a_controller_shows_the_meters_and_the_report_team_reads_them(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    poll_id = _meters_poll(client, db_session, ready)
    _close_on(client, ready, poll_id, 0)
    [group] = client.get(_url(ready, "/meters")).json()
    assert group["meters"][1]["total"] == 3

    with TestClient(client.app) as pat:
        _as_player(pat, db_session, ready)
        assert pat.get(_url(ready, "/meters")).status_code == 403
        assert _show_meters(pat, ready).status_code == 403


def test_each_room_adds_up_its_own_decisions(
    client: TestClient,
    db_session: Session,
    rooms: dict,  # noqa: F811
) -> None:
    ttx_id, both = rooms["ttx_id"], rooms["codes"][2]
    _make_poll(db_session, ttx_id, both, OUTCOMES, IMPACTS)
    blue, red = _post(client, ttx_id, f"/injects/{both}/release").json()["polls"]
    _close_on(client, ttx_id, blue["id"], 0)
    closed = _close_on(client, ttx_id, red["id"], 1).json()
    totals = {g["room_code"]: [m["total"] for m in g["meters"]] for g in closed["meters"]}
    assert totals == {"RM-01": [1, 3], "RM-02": [3, 0]}

    # A Player reads their room's.
    _show_meters(client, ttx_id)
    assert [g["room_code"] for g in _view(rooms["ana"][1], ttx_id)["meters"]] == ["RM-01"]
