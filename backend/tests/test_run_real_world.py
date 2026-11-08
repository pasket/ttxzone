"""REAL WORLD: anyone at the table pauses the session for a real-world
event, typing the exercise's stop keyword to confirm; only a Controller
resumes it."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import ExerciseRun, RunEvent, TTXNeedsForm
from app.models.exercise_run import RunEventType
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)


def _keyword(db_session: Session, value: str | None = None) -> str:
    form = db_session.exec(select(TTXNeedsForm)).first()
    if value is not None:
        form.stop_exercise_keyword = value
        db_session.add(form)
        db_session.commit()
    return form.stop_exercise_keyword


def _press(client: TestClient, ttx_id: str, keyword: str):
    return _post(client, ttx_id, "/real-world", json={"keyword": keyword})


def test_any_player_pauses_it_with_the_stop_keyword(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    keyword = _keyword(db_session, "Blue Sky")
    assert _press(client, ready, keyword).json()["error"]["code"] == "RUN_NOT_STARTED"
    _post(client, ready, "/start")
    _as_player(client, db_session, ready)

    wrong = _press(client, ready, "red sky")
    assert wrong.status_code == 422
    assert wrong.json()["error"]["code"] == "KEYWORD_MISMATCH"

    pressed = _press(client, ready, "  blue SKY ")
    assert pressed.status_code == 200, pressed.text
    body = pressed.json()
    assert body["state"] == "paused"
    assert body["real_world_at"] is not None and body["real_world_by"] == "Pat Player"
    [event] = db_session.exec(select(RunEvent).where(RunEvent.type == RunEventType.PAUSE)).all()
    assert event.payload == {"real_world": True}

    # Pressed again (someone else at the same time): nothing changes.
    again = _press(client, ready, "blue sky").json()
    assert again["seq"] == body["seq"]
    # A Player still can't resume it.
    assert _post(client, ready, "/resume").status_code == 403


def test_the_controller_resumes_and_the_clock_leaves_it_out(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _keyword(db_session, "")
    _post(client, ready, "/start")
    _post(client, ready, "/pause")
    run = db_session.exec(select(ExerciseRun)).one()
    paused_at = run.paused_at

    # Without a stop keyword set, REAL WORLD confirms it; a normal pause
    # already running keeps its start.
    pressed = _press(client, ready, "real world").json()
    assert pressed["state"] == "paused" and pressed["paused_at"] is not None
    db_session.refresh(run)
    assert run.paused_at == paused_at and run.real_world_by_id is not None

    run.paused_at = datetime.now(UTC) - timedelta(minutes=10)
    db_session.add(run)
    db_session.commit()
    resumed = _post(client, ready, "/resume").json()
    assert resumed["state"] == "live" and resumed["real_world_at"] is None
    assert resumed["real_world_by"] is None and resumed["paused_seconds"] >= 600

    log = client.get(_url(ready, "/export/log.csv"), params={"lang": "en"})
    assert "Real-world event" in log.content.decode("utf-8-sig")
