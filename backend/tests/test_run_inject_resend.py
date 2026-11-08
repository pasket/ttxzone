"""Re-sending a delivered inject: a Controller puts it back in play (the
table missed it, or the session steps back to it)."""

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.models import ExerciseRun, RunEvent
from app.models.exercise_run import RunEventType
from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)


def _mandatory(client: TestClient, ttx_id: str) -> list[str]:
    control = client.get(_url(ttx_id)).json()["control"]
    return [i["code"] for i in control["injects"] if i["kind"] == "mandatory"]


def test_a_resent_inject_is_back_in_play(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    first, second = _mandatory(client, ready)[:2]
    _post(client, ready, f"/injects/{first}/release")
    _post(client, ready, f"/injects/{second}/release")
    run = db_session.exec(select(ExerciseRun)).one()
    run.inject_timer_at = datetime.now(UTC) - timedelta(minutes=5)
    db_session.add(run)
    db_session.commit()

    response = _post(client, ready, f"/injects/{first}/resend")
    assert response.status_code == 200, response.text
    body = response.json()
    assert [i["code"] for i in body["injects"]] == [second, first]
    assert datetime.fromisoformat(body["inject_timer_at"]) > datetime.now(UTC) - timedelta(
        minutes=1
    )
    states = {i["code"]: i["state"] for i in body["control"]["injects"]}
    assert states[first] == states[second] == "released"
    assert db_session.exec(
        select(RunEvent).where(RunEvent.type == RunEventType.INJECT_RESENT)
    ).one()


def test_only_a_delivered_one_is_resent_while_live(
    client: TestClient,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    first, second = _mandatory(client, ready)[:2]
    pending = _post(client, ready, f"/injects/{second}/resend")
    assert pending.status_code == 409
    assert pending.json()["error"]["code"] == "INJECT_NOT_RELEASED"

    _post(client, ready, f"/injects/{first}/release")
    # The one in play too: the table gets it again.
    in_play = _post(client, ready, f"/injects/{first}/resend")
    assert in_play.status_code == 200, in_play.text
    assert [i["code"] for i in in_play.json()["injects"]] == [first]

    _post(client, ready, "/pause")
    paused = _post(client, ready, f"/injects/{first}/resend")
    assert paused.json()["error"]["code"] == "RUN_PAUSED"


def test_only_a_controller_resends(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    first, second = _mandatory(client, ready)[:2]
    _post(client, ready, f"/injects/{first}/release")
    _post(client, ready, f"/injects/{second}/release")
    _as_player(client, db_session, ready)
    assert _post(client, ready, f"/injects/{first}/resend").status_code == 403
