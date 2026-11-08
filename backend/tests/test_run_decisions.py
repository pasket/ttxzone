"""The table's decision log and votes: Players and the team record what the
table decided, a Facilitator or Controller puts questions to the Players'
vote; both live in the execution log."""

import uuid

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import TTXAccess
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_run_rooms import _view
from tests.test_run_rooms import rooms as rooms  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_needs_form import _csrf


def _first_mandatory(client: TestClient, ttx_id: str) -> str:
    control = client.get(_url(ttx_id)).json()["control"]
    return next(i["code"] for i in control["injects"] if i["kind"] == "mandatory")


def _decide(client: TestClient, ttx_id: str, role: str, **body):
    return client.post(
        _url(ttx_id, "/decisions"), params={"as": role}, json=body, headers=_csrf(client)
    )


def _vote(client: TestClient, ttx_id: str, poll_id: str, option: int):
    return client.put(
        _url(ttx_id, f"/polls/{poll_id}/vote"),
        params={"as": "player"},
        json={"option": option},
        headers=_csrf(client),
    )


def _open(client: TestClient, ttx_id: str, **body):
    return client.post(
        _url(ttx_id, "/polls"), params={"as": "controller"}, json=body, headers=_csrf(client)
    )


def _close(client: TestClient, ttx_id: str, poll_id: str, record_option: int | None = None):
    return client.post(
        _url(ttx_id, f"/polls/{poll_id}/close"),
        params={"as": "controller"},
        json={"record_option": record_option},
        headers=_csrf(client),
    )


def test_players_and_the_team_record_the_tables_decisions(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    early = _decide(client, ready, "controller", text="Isolate the host")
    assert early.json()["error"]["code"] == "INJECT_NOT_RELEASED"
    first = _first_mandatory(client, ready)
    _post(client, ready, f"/injects/{first}/release")

    # The Controller records one on the inject in play.
    team = _decide(client, ready, "controller", text="  Isolate the host  ")
    assert team.status_code == 200, team.text
    [decision] = team.json()["decisions"]
    assert decision["text"] == "Isolate the host" and decision["inject_code"] == first
    assert decision["role"] == "controller" and decision["mine"] and decision["room_code"] is None

    with TestClient(client.app) as table:
        _as_player(table, db_session, ready)
        mine = _decide(table, ready, "player", text="Call legal")
        assert mine.status_code == 200, mine.text
        decisions = mine.json()["decisions"]
        assert [(d["text"], d["mine"]) for d in decisions] == [
            ("Isolate the host", False),
            ("Call legal", True),
        ]
        # A Player changes only their own.
        other, own = decisions[0]["id"], decisions[1]["id"]
        refused = table.put(
            _url(ready, f"/decisions/{other}"),
            params={"as": "player"},
            json={"text": "No"},
            headers=_csrf(table),
        )
        assert refused.json()["error"]["code"] == "DECISION_NOT_YOURS"
        edited = table.put(
            _url(ready, f"/decisions/{own}"),
            params={"as": "player"},
            json={"text": "Call legal now"},
            headers=_csrf(table),
        ).json()["decisions"][1]
        assert edited["text"] == "Call legal now" and edited["edited"]
        unknown = table.delete(
            _url(ready, f"/decisions/{uuid.uuid4()}"),
            params={"as": "player"},
            headers=_csrf(table),
        )
        assert unknown.json()["error"]["code"] == "DECISION_NOT_FOUND"

    # The team takes any off the log.
    left = client.delete(
        _url(ready, f"/decisions/{own}"), params={"as": "controller"}, headers=_csrf(client)
    ).json()["decisions"]
    assert [d["text"] for d in left] == ["Isolate the host"]

    # An Observer reads them but records none.
    access = db_session.exec(select(TTXAccess).where(TTXAccess.ttx_id == uuid.UUID(ready))).first()
    access.observes = True
    db_session.add(access)
    db_session.commit()
    watcher = _decide(client, ready, "observer", text="Hmm")
    assert watcher.json()["error"]["code"] == "NOT_ACTING_AS"
    seen = client.get(_url(ready), params={"as": "observer"}).json()["decisions"]
    assert [d["text"] for d in seen] == ["Isolate the host"]

    # Once over, the log is closed.
    _post(client, ready, "/end")
    late = _decide(client, ready, "controller", text="Too late")
    assert late.json()["error"]["code"] == "RUN_FINISHED"


def test_the_players_vote_and_the_winner_becomes_a_decision(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    first = _first_mandatory(client, ready)
    _post(client, ready, f"/injects/{first}/release")

    repeated = _open(client, ready, question="Pay?", options=["Yes", " yes "])
    assert repeated.json()["error"]["code"] == "POLL_OPTIONS_REPEATED"
    assert _open(client, ready, question="Pay?", options=["Yes"]).status_code == 422
    opened = _open(client, ready, question="Pay the ransom?", options=["Pay", "Refuse", "Wait"])
    assert opened.status_code == 200, opened.text
    [poll] = opened.json()["polls"]
    assert poll["open"] and poll["inject_code"] == first and poll["voters"] == 0
    # Several votes run at once.
    second = _open(client, ready, question="Call the police?", options=["Now", "Later"])
    assert second.status_code == 200, second.text
    other = second.json()["polls"][1]
    assert [p["open"] for p in second.json()["polls"]] == [True, True]

    with TestClient(client.app) as pat, TestClient(client.app) as sam:
        _as_player(pat, db_session, ready)
        _as_player(sam, db_session, ready, "sam.player@acme.com", "Sam Player")
        assert _vote(pat, ready, poll["id"], 3).json()["error"]["code"] == "POLL_UNKNOWN_OPTION"
        _vote(pat, ready, poll["id"], 0)
        # A new vote replaces theirs.
        changed = _vote(pat, ready, poll["id"], 1).json()["polls"][0]
        assert changed["my_vote"] == 1 and changed["voters"] == 1
        tally = _vote(sam, ready, poll["id"], 1).json()["polls"][0]
        assert [o["votes"] for o in tally["options"]] == [0, 2, 0]
        # Each vote counts on its own.
        parallel = _vote(sam, ready, other["id"], 0).json()["polls"]
        assert [o["votes"] for o in parallel[1]["options"]] == [1, 0]
        assert [o["votes"] for o in parallel[0]["options"]] == [0, 2, 0]
        # Anonymous: the tally, never who.
        assert "Pat" not in str(tally) and "Sam" not in str(tally)
        # A Player can't run a vote.
        player_opens = pat.post(
            _url(ready, "/polls"),
            params={"as": "player"},
            json={"question": "Q", "options": ["A", "B"]},
            headers=_csrf(pat),
        )
        assert player_opens.status_code == 403

        # The team doesn't vote.
        team_votes = client.put(
            _url(ready, f"/polls/{poll['id']}/vote"),
            params={"as": "controller"},
            json={"option": 0},
            headers=_csrf(client),
        )
        assert team_votes.json()["error"]["code"] == "NOT_ACTING_AS"

        closed = _close(client, ready, poll["id"], record_option=1).json()
        assert not closed["polls"][0]["open"]
        [decision] = closed["decisions"]
        assert decision["text"] == "Refuse" and decision["poll_id"] == poll["id"]
        assert closed["polls"][0]["decision_id"] == decision["id"]
        assert _vote(sam, ready, poll["id"], 0).json()["error"]["code"] == "POLL_CLOSED"

    # ENDEX closes a vote still open.
    _open(client, ready, question="Notify the regulator?", options=["Now", "Later"])
    control = client.get(_url(ready)).json()["control"]
    for inject in control["injects"]:
        if inject["kind"] == "mandatory" and inject["state"] == "pending":
            _post(client, ready, f"/injects/{inject['code']}/release")
    over = _post(client, ready, "/endex", json={"title": "ENDEX", "content": "Thanks"}).json()
    assert not any(p["open"] for p in over["polls"])
    # The hot wash goes on recording -- and voting -- on ENDEX.
    hot_wash = _decide(client, ready, "controller", text="Rehearse the ransom call")
    assert hot_wash.status_code == 200, hot_wash.text
    assert hot_wash.json()["decisions"][-1]["inject_code"] == "ENDEX"
    again = _open(client, ready, question="Run it again in Q2?", options=["Yes", "No"])
    assert again.status_code == 200, again.text
    assert again.json()["polls"][-1]["inject_code"] == "ENDEX"


def test_in_rooms_each_room_decides_and_votes_on_its_own(
    client: TestClient,
    rooms: dict,  # noqa: F811
) -> None:
    ttx_id, (blue_only, red_only, *_) = rooms["ttx_id"], rooms["codes"]
    _, ana = rooms["ana"]
    _, rob = rooms["rob"]
    for code in (blue_only, red_only):
        _post(client, ttx_id, f"/injects/{code}/release")

    # A Player's decision is taken where they are, on their room's inject.
    ana_decides = _decide(ana, ttx_id, "player", text="Blue isolates")
    assert ana_decides.status_code == 200, ana_decides.text
    [blue] = ana_decides.json()["decisions"]
    assert (blue["room_code"], blue["inject_code"]) == ("RM-01", blue_only)
    # The team records in the room it looks at.
    assert _decide(client, ttx_id, "controller", text="X", room_code="RM-99").status_code == 404
    _decide(client, ttx_id, "controller", text="Red waits", room_code="RM-02")

    assert [d["text"] for d in _view(ana, ttx_id)["decisions"]] == ["Blue isolates"]
    assert [d["text"] for d in _view(rob, ttx_id)["decisions"]] == ["Red waits"]
    team = client.get(_url(ttx_id), params={"as": "controller"}).json()["decisions"]
    assert [d["text"] for d in team] == ["Blue isolates", "Red waits"]

    # A vote put to Red: Blue neither sees nor casts it.
    poll = _open(client, ttx_id, question="Pay?", options=["Yes", "No"], room_code="RM-02")
    poll_id = poll.json()["polls"][0]["id"]
    assert poll.json()["polls"][0]["inject_code"] == red_only
    assert _view(ana, ttx_id)["polls"] == []
    assert _vote(ana, ttx_id, poll_id, 0).json()["error"]["code"] == "POLL_NOT_YOUR_ROOM"
    assert _vote(rob, ttx_id, poll_id, 0).status_code == 200
    # Another room may vote at the same time.
    assert (
        _open(client, ttx_id, question="Pay?", options=["Yes", "No"], room_code="RM-01").status_code
        == 200
    )


def test_decisions_and_votes_reach_the_log_the_draft_and_the_report(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    from tests.test_exercise_run import _pdf_text

    _post(client, ready, "/start")
    first = _first_mandatory(client, ready)
    _post(client, ready, f"/injects/{first}/release")
    _decide(client, ready, "controller", text="Isolate the payroll server")
    poll_id = _open(client, ready, question="Pay the ransom?", options=["Pay", "Refuse"]).json()[
        "polls"
    ][0]["id"]
    with TestClient(client.app) as table:
        _as_player(table, db_session, ready)
        _vote(table, ready, poll_id, 1)
    _close(client, ready, poll_id, record_option=1)
    _post(client, ready, "/end")

    # The log: every step, a vote without its voter.
    csv_file = client.get(_url(ready, "/export/log.csv"), params={"lang": "en"})
    rows = csv_file.content.decode("utf-8-sig").splitlines()
    assert any("Decision recorded" in r and "Isolate the payroll server" in r for r in rows)
    [vote] = [r for r in rows if "Vote cast" in r]
    assert "Pay the ransom? → Refuse" in vote and "Pat Player" not in vote

    report = _pdf_text(client.get(_url(ready, "/export/aar.pdf"), params={"lang": "en"}).content)
    assert "4. Decisions of the table" in report
    assert "Isolate the payroll server" in report and "Pay the ransom?" in report

    # The editable report starts with them under the objectives they serve
    # (or in the conclusions).
    started = client.post(f"/api/v1/ttx/{ready}/aar", headers=_csrf(client))
    assert started.status_code == 201, started.text
    body = started.json()
    seeded = " ".join(o["analysis"] for o in body["objectives"]) + body["conclusions"]
    assert f"- Isolate the payroll server — {first}" in seeded
    assert f"- Refuse — {first}" in seeded
