"""The time since the last inject: it restarts with each release, and a
Controller resets it on every screen. Pauses are left out, like T+."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import ExerciseRun, RunEvent
from app.models.exercise_run import RunEventType
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)


def _release_first(client: TestClient, ttx_id: str) -> dict:
    control = client.get(_url(ttx_id)).json()["control"]
    first = next(i for i in control["injects"] if i["kind"] == "mandatory")
    return _post(client, ttx_id, f"/injects/{first['code']}/release").json()


def test_a_release_starts_it_and_the_controller_resets_it(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    assert _post(client, ready, "/inject-timer/reset").json()["error"]["code"] == "RUN_NOT_STARTED"
    started = _post(client, ready, "/start").json()
    assert started["inject_timer_at"] is None
    none_yet = _post(client, ready, "/inject-timer/reset")
    assert none_yet.status_code == 409
    assert none_yet.json()["error"]["code"] == "NO_INJECT_RELEASED"

    released = _release_first(client, ready)
    assert released["inject_timer_at"] is not None
    assert released["inject_timer_paused_seconds"] == 0

    run = db_session.exec(select(ExerciseRun)).one()
    run.inject_timer_at = datetime.now(UTC) - timedelta(minutes=5)
    db_session.add(run)
    db_session.commit()
    reset = _post(client, ready, "/inject-timer/reset")
    assert reset.status_code == 200, reset.text
    body = reset.json()
    assert datetime.fromisoformat(body["inject_timer_at"]) > datetime.now(UTC) - timedelta(
        minutes=1
    )
    assert body["seq"] > released["seq"]
    assert db_session.exec(
        select(RunEvent).where(RunEvent.type == RunEventType.INJECT_TIMER_RESET)
    ).one()


def test_a_reset_during_a_pause_leaves_the_pause_out(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    _release_first(client, ready)
    _post(client, ready, "/pause")
    run = db_session.exec(select(ExerciseRun)).one()
    run.paused_at = datetime.now(UTC) - timedelta(minutes=10)
    db_session.add(run)
    db_session.commit()

    body = _post(client, ready, "/inject-timer/reset").json()
    # The 10 minutes of pause so far already count as paused.
    assert 599 <= body["inject_timer_paused_seconds"] <= 601
    resumed = _post(client, ready, "/resume").json()
    assert abs(resumed["paused_seconds"] - resumed["inject_timer_paused_seconds"]) <= 1


def test_only_a_controller_resets_it(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    _release_first(client, ready)
    _as_player(client, db_session, ready)
    assert _post(client, ready, "/inject-timer/reset").status_code == 403
