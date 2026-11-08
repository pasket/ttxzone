"""The Playground's live session: started by a Controller from the READY
MSEL and session plan, injects released one by one, ended or stopped --
and what each participant sees of it."""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import TTX, ExerciseRun, RoleEnum, RunEvent, TTXAccess
from tests.test_ttx_conduct_prep import _complete, _get, _transition
from tests.test_ttx_conduct_prep import _save as _save_plan
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import _account, _login
from tests.test_ttx_needs_form import _csrf

# What the table must never learn from the session: the design behind it.
DESIGN_KEYS = {
    "expected_actions",
    "facilitator_notes",
    "trigger_condition",
    "contingent_purpose",
    "attack_techniques",
    "attack_attribution",
    "threat_actor_id",
    "objective_ids",
    "kind",
    "offset_minutes",
}


def _url(ttx_id: str, suffix: str = "") -> str:
    return f"/api/v1/ttx/{ttx_id}/run{suffix}"


def _ready_plan(client: TestClient, ttx_id: str) -> None:
    assert _save_plan(client, ttx_id, _complete(_get(client, ttx_id).json())).status_code == 200
    assert _transition(client, ttx_id, "ready").status_code == 200


def _post(client: TestClient, ttx_id: str, suffix: str, **kwargs):
    return client.post(_url(ttx_id, suffix), headers=_csrf(client), **kwargs)


def _as_player(
    client: TestClient,
    db_session: Session,
    ttx_id: str,
    email: str = "pat.player@acme.com",
    name: str = "Pat Player",
) -> None:
    player = _account(db_session, email, name)
    db_session.add(TTXAccess(user_id=player.id, ttx_id=uuid.UUID(ttx_id), role=RoleEnum.PLAYER))
    db_session.commit()
    _login(client, player.email)


@pytest.fixture
def ready(client: TestClient, exercise: dict) -> str:  # noqa: F811
    """The exercise with its plan READY too; the client is its creator, who
    plans and controls it."""
    ttx_id = exercise["ttx"]["id"]
    _ready_plan(client, ttx_id)
    return ttx_id


def test_it_starts_only_once_the_msel_and_the_plan_are_ready(
    client: TestClient,
    exercise: dict,  # noqa: F811
) -> None:
    ttx_id = exercise["ttx"]["id"]
    view = client.get(_url(ttx_id)).json()
    assert view["state"] == "not_started"
    assert view["msel_ready"] is True and view["plan_ready"] is False
    assert view["can_control"] is True

    refused = _post(client, ttx_id, "/start")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "RUN_NOT_READY"

    _ready_plan(client, ttx_id)
    started = _post(client, ttx_id, "/start")
    assert started.status_code == 200, started.text
    body = started.json()
    assert body["state"] == "live" and body["seq"] == 1
    # The first phase is under way; the rest stay nameless.
    assert [p["state"] for p in body["phases"]] == ["current", "upcoming", "upcoming", "upcoming"]
    assert body["phases"][0]["name"] == "Detection"
    assert body["phases"][1]["name"] is None and body["phases"][1]["number"] == 2
    assert body["session_time"] == "09:30:00"

    again = _post(client, ttx_id, "/start")
    assert again.json()["error"]["code"] == "RUN_ALREADY_STARTED"


def test_the_controller_releases_mandatory_injects_once(client: TestClient, ready: str) -> None:
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    mandatory = [i for i in control["injects"] if i["kind"] == "mandatory"]
    contingent = next(i for i in control["injects"] if i["kind"] == "contingent")

    released = _post(client, ready, f"/injects/{mandatory[0]['code']}/release")
    assert released.status_code == 200, released.text
    body = released.json()
    assert [i["code"] for i in body["injects"]] == [mandatory[0]["code"]]
    assert body["injects"][0]["sender"] is not None
    assert body["injects"][0]["scenario_minute"] is not None
    # No headline of its own: the track lists its injects instead.
    assert body["phases"][0]["headline"] is None
    released_row = next(i for i in body["control"]["injects"] if i["code"] == mandatory[0]["code"])
    assert released_row["state"] == "released"

    twice = _post(client, ready, f"/injects/{mandatory[0]['code']}/release")
    assert twice.json()["error"]["code"] == "INJECT_ALREADY_RELEASED"
    # A contingent inject fires only with the reason why.
    plan_b = _post(client, ready, f"/injects/{contingent['code']}/release")
    assert plan_b.status_code == 422
    assert plan_b.json()["error"]["code"] == "REASON_REQUIRED"
    unknown = _post(client, ready, "/injects/INJ-99/release")
    assert unknown.status_code == 404

    # Polling with the cursor it has: nothing new until something happens.
    seen = body["cursor"]
    assert client.get(_url(ready), params={"since": seen}).status_code == 204
    _post(client, ready, f"/injects/{mandatory[1]['code']}/release")
    assert client.get(_url(ready), params={"since": seen}).status_code == 200


def test_players_see_only_what_was_delivered(
    client: TestClient, db_session: Session, ready: str
) -> None:
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    _post(client, ready, f"/injects/{first['code']}/release")

    _as_player(client, db_session, ready)
    view = client.get(_url(ready))
    assert view.status_code == 200, view.text
    body = view.json()

    assert body["can_control"] is False and body["control"] is None
    assert [i["code"] for i in body["injects"]] == [first["code"]]
    assert DESIGN_KEYS.isdisjoint(body["injects"][0])
    assert all(p["name"] is None for p in body["phases"] if p["state"] == "upcoming")
    # The table never controls the session.
    assert _post(client, ready, "/end").status_code == 403
    assert _post(client, ready, f"/injects/{first['code']}/release").status_code == 403
    # Nor loads an image that hasn't been shown.
    assert client.get(_url(ready, f"/images/{uuid.uuid4()}")).status_code == 404


def test_a_stop_halts_the_session_for_everyone(
    client: TestClient, db_session: Session, ready: str
) -> None:
    _post(client, ready, "/start")
    assert _post(client, ready, "/stop", json={"reason": ""}).status_code == 422

    stopped = _post(client, ready, "/stop", json={"reason": "Real outage in the plant"})
    assert stopped.status_code == 200
    assert stopped.json()["state"] == "stopped"

    after = _post(client, ready, "/end")
    assert after.json()["error"]["code"] == "RUN_FINISHED"

    _as_player(client, db_session, ready)
    view = client.get(_url(ready)).json()
    assert view["state"] == "stopped"
    assert view["stop_reason"] == "Real outage in the plant"

    run = db_session.exec(select(ExerciseRun)).one()
    events = db_session.exec(select(RunEvent).where(RunEvent.run_id == run.id)).all()
    assert sorted(e.type.value for e in events) == ["start", "stop"]


def test_the_session_ends_and_goes_with_the_exercise(
    client: TestClient, db_session: Session, ready: str
) -> None:
    _post(client, ready, "/start")
    ended = _post(client, ready, "/end")
    assert ended.json()["state"] == "ended" and ended.json()["ended_at"]

    deleted = client.request(
        "DELETE",
        f"/api/v1/ttx/{ready}",
        json={"confirmation": db_session.get(TTX, uuid.UUID(ready)).name},
        headers=_csrf(client),
    )
    assert deleted.status_code == 204, deleted.text
    assert db_session.exec(select(ExerciseRun)).first() is None


def test_only_its_participants_read_the_session(
    client: TestClient, db_session: Session, ready: str
) -> None:
    outsider = _account(db_session, "nosy@acme.com", "Nosy")
    _login(client, outsider.email)
    assert client.get(_url(ready)).status_code == 403


def test_the_control_center_runs_the_storyline(client: TestClient, ready: str) -> None:
    """Pause and resume, skip, mark an expected action as not seen -- which
    suggests the contingent inject hanging from it -- and fire that one
    with its reason."""
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    assert control["msel"]["injects"], "the frozen MSEL, for the storyline map"
    contingent = next(i for i in control["injects"] if i["branch_action_code"])
    owner = next(
        i
        for i in control["injects"]
        if any(a["code"] == contingent["branch_action_code"] for a in i["expected_actions"])
    )
    skippable = next(
        i for i in control["injects"] if i["kind"] == "mandatory" and i["code"] != owner["code"]
    )

    # Paused: nothing goes out.
    assert _post(client, ready, "/pause").json()["state"] == "paused"
    held = _post(client, ready, f"/injects/{owner['code']}/release")
    assert held.json()["error"]["code"] == "RUN_PAUSED"
    resumed = _post(client, ready, "/resume").json()
    assert resumed["state"] == "live" and resumed["paused_at"] is None

    # An action can only be marked once its inject is out.
    action = contingent["branch_action_code"]
    early = client.put(
        _url(ready, f"/actions/{action}"), json={"mark": "not_observed"}, headers=_csrf(client)
    )
    assert early.json()["error"]["code"] == "INJECT_NOT_RELEASED"
    _post(client, ready, f"/injects/{owner['code']}/release")
    marked = client.put(
        _url(ready, f"/actions/{action}"),
        json={"mark": "not_observed", "note": "Nobody called the regulator"},
        headers=_csrf(client),
    ).json()
    rows = {i["code"]: i for i in marked["control"]["injects"]}
    seen = next(a for a in rows[owner["code"]]["expected_actions"] if a["code"] == action)
    assert seen["mark"] == "not_observed" and seen["note"] == "Nobody called the regulator"
    assert rows[contingent["code"]]["suggested"] is True

    fired = _post(
        client, ready, f"/injects/{contingent['code']}/release", json={"reason": "Action missed"}
    ).json()
    rows = {i["code"]: i for i in fired["control"]["injects"]}
    assert rows[contingent["code"]]["state"] == "released"
    assert rows[contingent["code"]]["reason"] == "Action missed"
    assert rows[contingent["code"]]["suggested"] is False

    assert (
        _post(client, ready, f"/injects/{skippable['code']}/skip", json={"reason": ""}).status_code
        == 422
    )
    skipped = _post(
        client, ready, f"/injects/{skippable['code']}/skip", json={"reason": "Covered already"}
    ).json()
    rows = {i["code"]: i for i in skipped["control"]["injects"]}
    assert rows[skippable["code"]]["state"] == "skipped"
    assert skippable["code"] not in [i["code"] for i in skipped["injects"]]
    again = _post(client, ready, f"/injects/{skippable['code']}/release")
    assert again.json()["error"]["code"] == "INJECT_SKIPPED"


def test_key_questions_go_to_the_table_on_the_inject_in_play(
    client: TestClient, db_session: Session, ready: str
) -> None:
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    phase = control["phases"][0]
    too_soon = _post(
        client, ready, "/questions", json={"phase_code": phase["code"], "positions": [0]}
    )
    assert too_soon.json()["error"]["code"] == "NO_INJECT_IN_PLAY"

    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    _post(client, ready, f"/injects/{first['code']}/release")
    unknown = _post(
        client, ready, "/questions", json={"phase_code": phase["code"], "positions": [9]}
    )
    assert unknown.status_code == 422
    asked = _post(
        client, ready, "/questions", json={"phase_code": phase["code"], "positions": [0]}
    ).json()
    assert asked["control"]["phases"][0]["released_questions"] == [0]
    assert asked["injects"][-1]["questions"] == [
        {"text": phase["key_questions"][0], "covered": False, "room_code": None}
    ]

    # Covered: only once asked; it can be undone.
    covered = _url(ready, "/questions/covered")
    early = client.post(
        covered, json={"phase_code": phase["code"], "position": 1, "covered": True},
        headers=_csrf(client),
    )  # fmt: skip
    assert early.json()["error"]["code"] == "QUESTION_NOT_ASKED"
    marked = client.post(
        covered, json={"phase_code": phase["code"], "position": 0, "covered": True},
        headers=_csrf(client),
    ).json()  # fmt: skip
    assert marked["control"]["phases"][0]["covered_questions"] == [0]
    assert marked["injects"][-1]["questions"][0]["covered"] is True

    _as_player(client, db_session, ready)
    seen = client.get(_url(ready)).json()["injects"][-1]
    assert seen["questions"] == [
        {"text": phase["key_questions"][0], "covered": True, "room_code": None}
    ]
    # The table doesn't mark them.
    assert (
        client.post(
            _url(ready, "/questions/covered"),
            json={"phase_code": phase["code"], "position": 0, "covered": False},
            headers=_csrf(client),
        ).status_code
        == 403
    )
    assert DESIGN_KEYS.isdisjoint(seen)
    assert (
        client.put(
            _url(ready, "/actions/INJ-01-A1"), json={"mark": "observed"}, headers=_csrf(client)
        ).status_code
        == 403
    )


def _poll(client: TestClient, ttx_id: str, role: str) -> dict:
    response = client.get(_url(ttx_id), params={"as": role})
    assert response.status_code == 200, response.text
    return response.json()


def test_the_table_sees_who_is_there(client: TestClient, db_session: Session, ready: str) -> None:
    """Polling marks someone present as the role they act as; a Player
    sees the Players by name and only how many of the team there are."""
    controller = _poll(client, ready, "controller")
    assert controller["presence"] == [{"role": "controller", "name": "Ada Manager"}]
    # Only a role they hold counts.
    assert _poll(client, ready, "player")["presence"] == controller["presence"]

    _as_player(client, db_session, ready)
    seen = _poll(client, ready, "player")["presence"]
    assert {"role": "player", "name": "Pat Player"} in seen
    assert {"role": "controller", "name": None} in seen

    # Someone arriving moves the cursor even with no event.
    before = _poll(client, ready, "player")["cursor"]
    with TestClient(client.app) as other:
        _as_player(other, db_session, ready, "sam.player@acme.com", "Sam Player")
        _poll(other, ready, "player")
    assert client.get(_url(ready), params={"since": before, "as": "player"}).status_code == 200


def test_notes_are_kept_per_inject_and_role_and_a_players_stay_private(
    client: TestClient, db_session: Session, ready: str
) -> None:
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    pending = next(i for i in control["injects"] if i["code"] != first["code"])
    _post(client, ready, f"/injects/{first['code']}/release")

    # The Controller writes for the team.
    team_note = client.put(
        _url(ready, "/notes"),
        params={"as": "controller"},
        json={"inject_code": first["code"], "text": "Table hesitated on isolation"},
        headers=_csrf(client),
    )
    assert team_note.status_code == 200, team_note.text

    notes = _url(ready, "/notes")
    with TestClient(client.app) as table:
        _as_player(table, db_session, ready)
        unseen = table.put(
            notes,
            params={"as": "player"},
            json={"inject_code": pending["code"], "text": "?"},
            headers=_csrf(table),
        )
        assert unseen.json()["error"]["code"] == "INJECT_NOT_RELEASED"
        wrong_role = table.get(notes, params={"as": "observer"})
        assert wrong_role.json()["error"]["code"] == "NOT_ACTING_AS"

        saved = table.put(
            notes,
            params={"as": "player"},
            json={"inject_code": first["code"], "text": "Call legal first"},
            headers=_csrf(table),
        ).json()["items"]
        table.put(
            notes,
            params={"as": "player"},
            json={"inject_code": "", "text": "General thought"},
            headers=_csrf(table),
        )
        mine = table.get(notes, params={"as": "player"}).json()["items"]
        assert [(n["inject_code"], n["text"]) for n in mine] == [
            ("", "General thought"),
            (first["code"], "Call legal first"),
        ]
        assert saved[0]["text"] == "Call legal first"
        # Emptied, it's gone.
        left = table.put(
            notes,
            params={"as": "player"},
            json={"inject_code": "", "text": "  "},
            headers=_csrf(table),
        ).json()["items"]
        assert [n["inject_code"] for n in left] == [first["code"]]
        # The table never reads the team's notes.
        assert table.get(_url(ready, "/notes/team")).status_code == 403

    # The team reads its own -- never a Player's.
    team = client.get(_url(ready, "/notes/team")).json()["items"]
    assert [(n["role"], n["text"]) for n in team] == [
        ("controller", "Table hesitated on isolation")
    ]


def test_the_facilitator_gets_the_script_of_the_phase(
    client: TestClient, db_session: Session, ready: str
) -> None:
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    _post(client, ready, f"/injects/{first['code']}/release")
    _post(
        client,
        ready,
        "/questions",
        json={"phase_code": control["phases"][0]["code"], "positions": [0]},
    )

    # The creator also facilitates: their access row says so.
    access = db_session.exec(select(TTXAccess).where(TTXAccess.ttx_id == uuid.UUID(ready))).first()
    access.facilitates = True
    db_session.add(access)
    db_session.commit()

    script = _poll(client, ready, "facilitator")["facilitation"]
    assert script["phase_code"] == control["phases"][0]["code"]
    assert script["key_questions"] == control["phases"][0]["key_questions"]
    assert script["released_questions"] == [0] and script["covered_questions"] == []
    # The Facilitator marks one covered, and gets their own view back.
    covered = client.post(
        _url(ready, "/questions/covered"),
        json={"phase_code": control["phases"][0]["code"], "position": 0, "covered": True},
        headers=_csrf(client),
    )
    assert covered.status_code == 200, covered.text
    assert script["inject_code"] == first["code"]
    assert "facilitator_notes" in script

    _as_player(client, db_session, ready)
    assert _poll(client, ready, "player")["facilitation"] is None


def test_evaluators_rate_their_points_during_the_session(
    client: TestClient,
    db_session: Session,
    ready: str,
    exercise: dict,  # noqa: F811
) -> None:
    from tests.test_ttx_evaluation import _as_evaluator

    evaluation = _url(ready, "/evaluation")
    assert client.get(evaluation).status_code == 403  # the Controller doesn't evaluate

    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    _post(client, ready, f"/injects/{first['code']}/release")
    action = first["expected_actions"][0]["code"]
    client.put(
        _url(ready, f"/actions/{action}"),
        json={"mark": "partial", "note": "Late"},
        headers=_csrf(client),
    )

    with TestClient(client.app) as evaluator:
        _as_evaluator(evaluator, db_session, {"evaluator": exercise["evaluator"]})
        body = evaluator.get(evaluation).json()
        assert body["rated"] == 0 and body["total"] > 0
        points = [p for o in body["objectives"] for p in o["points"]]
        seen = next(p for p in points if p["action_code"] == action)
        # What the Controller saw of the expected action, with the point.
        assert seen["action_mark"] == "partial" and seen["action_note"] == "Late"
        assert set(seen["criteria"]) == {"P", "S", "M", "U"}

        rated = evaluator.put(
            _url(ready, f"/ratings/{seen['id']}"),
            json={"level": "S", "rationale": "Decided, but after 25 minutes"},
            headers=_csrf(evaluator),
        ).json()
        assert rated["rated"] == 1
        mine = next(p for o in rated["objectives"] for p in o["points"] if p["id"] == seen["id"])
        assert mine["rating"]["level"] == "S"
        assert mine["rating"]["inject_code"] == first["code"]

        # The summary counts each Evaluator over the points they rate: every
        # one for the Lead Evaluator, never more rated than there are.
        progress = client.get(_url(ready, "/summary")).json()["ratings"][0]
        assert (progress["rated"], progress["total"]) == (1, body["total"])
        access = db_session.exec(
            select(TTXAccess).where(
                TTXAccess.ttx_id == uuid.UUID(ready), TTXAccess.role == RoleEnum.EVALUATOR
            )
        ).one()
        access.leads = True
        db_session.add(access)
        db_session.commit()
        lead_total = evaluator.get(evaluation).json()["total"]
        progress = client.get(_url(ready, "/summary")).json()["ratings"][0]
        assert (progress["rated"], progress["total"]) == (1, lead_total)
        access.leads = False
        db_session.add(access)
        db_session.commit()

        withdrawn = evaluator.put(
            _url(ready, f"/ratings/{seen['id']}"),
            json={"level": None},
            headers=_csrf(evaluator),
        ).json()
        assert withdrawn["rated"] == 0

        stranger = evaluator.put(
            _url(ready, f"/ratings/{uuid.uuid4()}"),
            json={"level": "P"},
            headers=_csrf(evaluator),
        )
        assert stranger.json()["error"]["code"] == "POINT_NOT_ASSIGNED"

    with TestClient(client.app) as table:
        _as_player(table, db_session, ready)
        assert table.get(evaluation).status_code == 403


def test_the_summary_says_how_the_session_went_and_what_comes_next(
    client: TestClient, db_session: Session, ready: str
) -> None:
    assert client.get(_url(ready, "/summary")).json()["error"]["code"] == "RUN_NOT_STARTED"
    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    mandatory = [i for i in control["injects"] if i["kind"] == "mandatory"]
    _post(client, ready, f"/injects/{mandatory[0]['code']}/release")
    _post(client, ready, f"/injects/{mandatory[1]['code']}/skip", json={"reason": "Short on time"})
    action = mandatory[0]["expected_actions"][0]["code"]
    client.put(_url(ready, f"/actions/{action}"), json={"mark": "observed"}, headers=_csrf(client))
    _post(
        client,
        ready,
        "/questions",
        json={"phase_code": control["phases"][0]["code"], "positions": [0]},
    )
    _post(client, ready, "/end")

    body = client.get(_url(ready, "/summary")).json()
    assert body["state"] == "ended" and body["played_minutes"] >= 0
    states = {i["code"]: (i["state"], i["reason"]) for i in body["injects"]}
    assert states[mandatory[0]["code"]] == ("released", "")
    assert states[mandatory[1]["code"]] == ("skipped", "Short on time")
    assert body["actions"]["observed"] == 1
    assert body["questions_asked"] == 1 and body["questions_covered"] == 0
    assert body["ratings"][0]["name"] == "Eva Luator" and body["ratings"][0]["rated"] == 0
    assert body["ratings"][0]["total"] > 0
    # The plan's calendar, from the session's day (2026-11-10).
    assert {m["key"]: m["on"] for m in body["milestones"]} == {
        "hot_wash": "2026-11-10",
        "debrief": "2026-11-10",
        "ratings_due": "2026-11-13",
        "draft_aar": "2026-11-24",
        "after_action_meeting": "2026-12-01",
    }

    with TestClient(client.app) as table:
        _as_player(table, db_session, ready)
        assert table.get(_url(ready, "/summary")).status_code == 403


def test_the_phase_track_reads_the_phase_headline_and_the_scene_date(
    client: TestClient, db_session: Session, ready: str
) -> None:
    from app.models import MselSnapshot, TTXMsel

    msel = db_session.exec(select(TTXMsel).where(TTXMsel.ttx_id == uuid.UUID(ready))).one()
    snapshot = db_session.exec(select(MselSnapshot).where(MselSnapshot.msel_id == msel.id)).one()
    payload = dict(snapshot.payload)
    payload["phases"] = [
        {**payload["phases"][0], "headline": "Supplier breach"},
        *payload["phases"][1:],
    ]
    payload["incident_date"] = "2026-05-03"
    snapshot.payload = payload
    db_session.add(snapshot)
    db_session.commit()

    started = _post(client, ready, "/start").json()
    assert started["phases"][0]["headline"] == "Supplier breach"
    assert started["incident_date"] == "2026-05-03"
    # Still hidden while the phase is ahead.
    assert started["phases"][1]["headline"] is None


def test_the_participants_answer_the_feedback_form_once_and_anonymously(
    client: TestClient, db_session: Session, ready: str
) -> None:
    from app.models import RunFeedbackResponse

    _post(client, ready, "/start")
    feedback = _url(ready, "/feedback")

    players = []
    for n in range(3):
        table = TestClient(client.app)
        table.__enter__()
        _as_player(table, db_session, ready, f"p{n}@acme.com", f"Player {n}")
        players.append(table)

    form = players[0].get(feedback).json()
    assert form["available"] is False and form["submitted"] is False
    keys = [s["key"] for s in form["statements"]]
    assert keys[:2] == ["objectives_clear", "scenario_realistic"]
    assert any(k.startswith("OBJ-") for k in keys)
    early = players[0].post(
        feedback, params={"as": "player"}, json={"scores": {}}, headers=_csrf(players[0])
    )
    assert early.json()["error"]["code"] == "RUN_NOT_OVER"

    _post(client, ready, "/end")
    # Under three answers, only the count.
    results = _url(ready, "/feedback/results")
    for n, table in enumerate(players):
        sent = table.post(
            feedback,
            params={"as": "player"},
            json={"scores": {"objectives_clear": 3 + (n % 2)}, "answers": {"strengths": f"S{n}"}},
            headers=_csrf(table),
        )
        assert sent.status_code == 204, sent.text
        if n == 1:
            hidden = client.get(results).json()
            assert hidden["responses"] == 2 and hidden["shown"] is False
            assert hidden["statements"][0]["average"] is None and hidden["answers"] == {}

    again = players[0].post(
        feedback, params={"as": "player"}, json={"scores": {}}, headers=_csrf(players[0])
    )
    assert again.json()["error"]["code"] == "FEEDBACK_ALREADY_SENT"
    assert players[0].get(feedback).json()["submitted"] is True
    unknown = players[0].post(
        feedback, params={"as": "player"}, json={"scores": {"nope": 5}}, headers=_csrf(players[0])
    )
    assert unknown.status_code in (409, 422)
    assert players[0].get(results).status_code == 403

    body = client.get(results).json()
    assert body["responses"] == 3 and body["players"] == 3 and body["shown"] is True
    first = body["statements"][0]
    assert first["n"] == 3 and first["average"] == 3.33 and first["distribution"] == [0, 0, 2, 1, 0]
    assert sorted(body["answers"]["strengths"]) == ["S0", "S1", "S2"]
    # Stored without author or time.
    row = db_session.exec(select(RunFeedbackResponse)).first()
    assert set(row.model_dump()) == {"id", "run_id", "group", "scores", "answers"}

    for table in players:
        table.__exit__(None, None, None)


def _pdf_text(content: bytes) -> str:
    import io

    from pypdf import PdfReader

    return " ".join(page.extract_text() for page in PdfReader(io.BytesIO(content)).pages)


def test_the_team_exports_the_log_and_a_draft_after_action_report(
    client: TestClient, db_session: Session, ready: str
) -> None:
    from app.models import RunEvent, TTXNeedsForm

    _post(client, ready, "/start")
    control = client.get(_url(ready)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    _post(client, ready, f"/injects/{first['code']}/release")
    action = first["expected_actions"][0]["code"]
    client.put(_url(ready, f"/actions/{action}"), json={"mark": "partial"}, headers=_csrf(client))
    client.put(
        _url(ready, "/notes"),
        params={"as": "controller"},
        json={"inject_code": first["code"], "text": "Isolation debated for 20 minutes"},
        headers=_csrf(client),
    )
    with TestClient(client.app) as table:
        _as_player(table, db_session, ready)
        table.get(_url(ready), params={"as": "player"})
        table.put(
            _url(ready, "/notes"),
            params={"as": "player"},
            json={"inject_code": "", "text": "SECRET PLAYER NOTE"},
            headers=_csrf(table),
        )
        assert table.get(_url(ready, "/export/aar.pdf")).status_code == 403
    _post(client, ready, "/end")

    log = client.get(_url(ready, "/export/log.pdf"), params={"lang": "en"})
    assert log.status_code == 200 and log.headers["content-type"] == "application/pdf"
    text = _pdf_text(log.content)
    assert "Execution log" in text and "Inject released" in text and "Partial" in text

    csv_file = client.get(_url(ready, "/export/log.csv"), params={"lang": "es"})
    lines = csv_file.content.decode("utf-8-sig").strip().splitlines()
    events = db_session.exec(select(RunEvent)).all()
    assert lines[0].startswith("T+,Hora,Evento") and len(lines) == len(events) + 1

    aar = client.get(_url(ready, "/export/aar.pdf"), params={"lang": "en"})
    assert aar.status_code == 200
    report = _pdf_text(aar.content)
    for heading in ("DRAFT", "1. Exercise and session", "2. Objectives", "7. Next steps"):
        assert heading in report
    assert "Isolation debated" in report
    assert "SECRET PLAYER NOTE" not in report and "SECRET PLAYER NOTE" not in text
    keyword = db_session.exec(select(TTXNeedsForm)).first().stop_exercise_keyword
    assert not keyword or keyword not in report
    assert client.get(_url(ready, "/export/nope.pdf")).status_code == 404
