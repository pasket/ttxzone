"""ENDEX: once every mandatory inject is out, the Controller sends the table
a closing message; every phase is over, and the session stays live for the
hot wash."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from tests.test_exercise_run import _as_player, _post, _url
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_run_real_world import _keyword, _press
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_needs_form import _csrf

ENDEX = {"title": "ENDEX — End of exercise", "content": "Thank you for taking part."}


def _mandatory(client: TestClient, ttx_id: str) -> list[str]:
    control = client.get(_url(ttx_id)).json()["control"]
    return [i["code"] for i in control["injects"] if i["kind"] == "mandatory"]


def test_endex_closes_every_phase_once_the_storyline_is_out(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    first, *rest = _mandatory(client, ready)
    _post(client, ready, f"/injects/{first}/release")
    early = _post(client, ready, "/endex", json=ENDEX)
    assert early.status_code == 409
    assert early.json()["error"]["code"] == "INJECTS_PENDING"

    # Released or skipped, each one is out.
    for code in rest[:-1]:
        _post(client, ready, f"/injects/{code}/release")
    if rest:
        _post(client, ready, f"/injects/{rest[-1]}/skip", json={"reason": "Time ran short"})

    response = _post(client, ready, "/endex", json={**ENDEX, "title": "  ENDEX  "})
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["state"] == "live"
    assert body["endex_released_at"] is not None
    assert body["current_phase_code"] is None
    assert {p["state"] for p in body["phases"]} == {"done"}
    assert body["injects"][-1]["code"] == "ENDEX"
    assert body["injects"][-1]["title"] == "ENDEX"

    # Once: the play is over, nothing else goes out.
    again = _post(client, ready, "/endex", json=ENDEX)
    assert again.json()["error"]["code"] == "ENDEX_RELEASED"
    resend = _post(client, ready, f"/injects/{first}/resend")
    assert resend.json()["error"]["code"] == "ENDEX_RELEASED"
    # No play left to pause, for the Controller or for REAL WORLD.
    assert _post(client, ready, "/pause").json()["error"]["code"] == "ENDEX_RELEASED"
    keyword = _keyword(db_session, "Blue Sky")
    assert _press(client, ready, keyword).json()["error"]["code"] == "ENDEX_RELEASED"

    # The table reads it last.
    _as_player(client, db_session, ready)
    player = client.get(_url(ready)).json()
    assert player["injects"][-1]["content"] == ENDEX["content"]
    assert {p["state"] for p in player["phases"]} == {"done"}
    note = client.put(
        _url(ready, "/notes"),
        headers=_csrf(client),
        params={"as": "player"},
        json={"inject_code": "ENDEX", "text": "Thanks!"},
    )
    assert note.status_code == 200, note.text


def test_only_a_controller_sends_endex_with_its_text(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    for code in _mandatory(client, ready):
        _post(client, ready, f"/injects/{code}/release")
    blank = _post(client, ready, "/endex", json={"title": " ", "content": "Thanks"})
    assert blank.status_code == 422
    _as_player(client, db_session, ready)
    assert _post(client, ready, "/endex", json=ENDEX).status_code == 403


def test_the_session_ends_after_endex(
    client: TestClient,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    for code in _mandatory(client, ready):
        _post(client, ready, f"/injects/{code}/release")
    _post(client, ready, "/endex", json=ENDEX)
    ended = _post(client, ready, "/end")
    assert ended.status_code == 200, ended.text
    assert ended.json()["state"] == "ended"
