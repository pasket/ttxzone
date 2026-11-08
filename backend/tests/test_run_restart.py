"""Restarting a session once it's over: deleting the run with everything
recorded in it, or archiving it as a previous run for a new one."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.data.scenario_catalog import scenario_catalog
from app.models import ExerciseRun, RunEvent, RunNote, UserSession
from tests.test_after_action import _aar
from tests.test_after_action import played as played  # noqa: F401 (fixture)
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_needs_form import _csrf


def _first_mandatory(client: TestClient, ttx_id: str) -> str:
    control = client.get(_url(ttx_id)).json()["control"]
    return next(i for i in control["injects"] if i["kind"] == "mandatory")["code"]


def _note(client: TestClient, ttx_id: str, code: str, text: str):
    return client.put(
        _url(ttx_id, "/notes"),
        params={"as": "controller"},
        json={"inject_code": code, "text": text},
        headers=_csrf(client),
    )


def _restart(client: TestClient, ttx_id: str, mode: str, confirmation: str = "restart"):
    return _post(client, ttx_id, "/restart", json={"mode": mode, "confirmation": confirmation})


def test_it_restarts_only_once_the_session_is_over(client: TestClient, ready: str) -> None:  # noqa: F811
    assert _restart(client, ready, "archive").json()["error"]["code"] == "RUN_NOT_STARTED"
    _post(client, ready, "/start")
    live = _restart(client, ready, "archive")
    assert live.status_code == 409
    assert live.json()["error"]["code"] == "RUN_NOT_FINISHED"
    _post(client, ready, "/pause")
    assert _restart(client, ready, "delete").json()["error"]["code"] == "RUN_NOT_FINISHED"
    bad = _restart(client, ready, "wipe")
    assert bad.status_code == 422


def test_a_new_run_archives_the_last_one_and_starts_clean(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    started = _post(client, ready, "/start").json()
    assert started["run_number"] == 1
    code = _first_mandatory(client, ready)
    _post(client, ready, f"/injects/{code}/release")
    assert _note(client, ready, code, "First run").status_code == 200
    ended = _post(client, ready, "/end").json()
    assert ended["can_delete"] is True

    restarted = _restart(client, ready, "archive")
    assert restarted.status_code == 200, restarted.text
    body = restarted.json()
    assert body["state"] == "not_started" and body["run_number"] is None
    # A poll with the old cursor gets the new state.
    assert client.get(_url(ready), params={"since": ended["cursor"]}).status_code == 200

    second = _post(client, ready, "/start").json()
    assert second["run_number"] == 2 and second["injects"] == []
    assert client.get(_url(ready, "/notes"), params={"as": "controller"}).json()["items"] == []
    assert client.get(_url(ready, "/notes/team")).json()["items"] == []

    history = client.get(_url(ready, "/history"))
    assert history.status_code == 200, history.text
    [past] = history.json()["items"]
    assert past["number"] == 1 and past["state"] == "ended" and past["has_report"] is False
    runs = db_session.exec(select(ExerciseRun).where(ExerciseRun.number == 1)).all()
    assert len(runs) == 1 and runs[0].archived_at is not None

    # The previous run's log is still downloadable; the draft report isn't.
    log = client.get(_url(ready, "/export/log.csv"), params={"run": past["id"]})
    assert log.status_code == 200
    assert "inject" in log.content.decode().lower()
    aar = client.get(_url(ready, "/export/aar.pdf"), params={"run": past["id"]})
    assert aar.status_code == 404
    other = client.get(
        _url(ready, "/export/log.csv"), params={"run": "00000000-0000-0000-0000-000000000000"}
    )
    assert other.json()["error"]["code"] == "RUN_NOT_FOUND"


def test_deleting_takes_the_run_and_all_it_recorded(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    code = _first_mandatory(client, ready)
    _post(client, ready, f"/injects/{code}/release")
    _note(client, ready, code, "Gone soon")
    _post(client, ready, "/stop", json={"reason": "Real incident"})

    deleted = _restart(client, ready, "delete")
    assert deleted.status_code == 200, deleted.text
    assert deleted.json()["state"] == "not_started"
    assert db_session.exec(select(ExerciseRun)).all() == []
    assert db_session.exec(select(RunEvent)).all() == []
    assert db_session.exec(select(RunNote)).all() == []
    assert client.get(_url(ready, "/history")).json()["items"] == []
    assert _post(client, ready, "/start").json()["run_number"] == 1


def test_a_run_with_a_report_is_kept(client: TestClient, played: dict) -> None:  # noqa: F811
    ttx_id = played["ttx_id"]
    assert client.post(_aar(ttx_id), headers=_csrf(client)).status_code in (200, 201)
    assert client.get(_url(ttx_id)).json()["can_delete"] is False

    refused = _restart(client, ttx_id, "delete")
    assert refused.status_code == 409
    assert refused.json()["error"]["code"] == "RUN_HAS_REPORT"
    assert _restart(client, ttx_id, "archive").status_code == 200
    [past] = client.get(_url(ttx_id, "/history")).json()["items"]
    assert past["has_report"] is True
    # The report keeps reading the run it was written from.
    assert client.get(_aar(ttx_id)).status_code == 200
    assert client.get(_aar(ttx_id, "/export.pdf")).status_code == 200


def test_notes_written_while_waiting_join_the_run(client: TestClient, ready: str) -> None:  # noqa: F811
    assert _note(client, ready, "", "Before the start").status_code == 200
    _post(client, ready, "/start")
    _post(client, ready, "/end")
    [note] = client.get(_url(ready, "/notes"), params={"as": "controller"}).json()["items"]
    assert note["text"] == "Before the start"
    _restart(client, ready, "archive")
    assert client.get(_url(ready, "/notes"), params={"as": "controller"}).json()["items"] == []


def test_only_a_controller_restarts_with_the_control_word(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    _post(client, ready, "/end")
    with TestClient(client.app) as table:
        _as_player(table, db_session, ready)
        assert _restart(table, ready, "archive").status_code == 403
        assert table.get(_url(ready, "/history")).status_code == 403

    wrong = _restart(client, ready, "archive", confirmation="yes")
    assert wrong.status_code == 400
    assert wrong.json()["error"]["code"] == "CONFIRMATION_MISMATCH"

    # No step-up: a sign-in an hour old restarts with the word, any case.
    for user_session in db_session.exec(select(UserSession)):
        user_session.authenticated_at = datetime.now(UTC) - timedelta(hours=1)
        db_session.add(user_session)
    db_session.commit()
    assert _restart(client, ready, "delete", confirmation=" Restart ").status_code == 200


def test_a_played_exercise_takes_no_scenario(client: TestClient, ready: str) -> None:  # noqa: F811
    url = f"/api/v1/ttx/{ready}/scenario/apply"
    assert client.get(f"/api/v1/ttx/{ready}/scenario").json()["played"] is False
    body = {"source": "system", "id": next(iter(scenario_catalog()))}

    def check() -> dict:
        return client.post(url, json=body, headers=_csrf(client)).json()

    def refused() -> bool:
        errors = check()["errors"]
        return bool(errors) and errors[0]["code"] == "SCENARIO_EXERCISE_PLAYED"

    _post(client, ready, "/start")
    assert refused()
    assert client.get(f"/api/v1/ttx/{ready}/scenario").json()["played"] is True
    _post(client, ready, "/end")
    # A run whose data was deleted leaves nothing to keep...
    assert _restart(client, ready, "delete").status_code == 200
    assert check()["ok"] is True
    # ...an archived one keeps the design it ran.
    _post(client, ready, "/start")
    _post(client, ready, "/end")
    assert _restart(client, ready, "archive").status_code == 200
    assert refused()
