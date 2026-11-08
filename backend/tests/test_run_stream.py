"""Server push for the Playground: the stream rings on every change --
shared per exercise -- keeps the viewer present, and never keeps a
session alive."""

import asyncio
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import RunPresence, UserSession
from app.services import run_stream
from tests.test_exercise_run import _post, _ready_plan, _url
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import _account, _login


@pytest.fixture
def quick(monkeypatch: pytest.MonkeyPatch) -> None:
    """A short-lived, fast-ticking stream the test can read to its end."""
    monkeypatch.setattr(settings, "RUN_STREAM_TICK_SECONDS", 0.05)
    monkeypatch.setattr(settings, "RUN_STREAM_KEEPALIVE_SECONDS", 0.1)
    monkeypatch.setattr(settings, "RUN_STREAM_PING_SECONDS", 0.2)
    monkeypatch.setattr(settings, "RUN_STREAM_MAX_SECONDS", 0.6)


def test_one_watcher_rings_every_listener_of_an_exercise(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "RUN_STREAM_TICK_SECONDS", 0.01)
    value = {"n": 0}
    calls = {"n": 0}

    def probe():
        calls["n"] += 1
        return value["n"]

    async def scenario():
        async with (
            run_stream.listen("ttx", probe) as first,
            run_stream.listen("ttx", probe) as second,
        ):
            assert len(run_stream._watchers) == 1
            await asyncio.sleep(0.05)
            assert first.empty() and second.empty()
            value["n"] = 1
            await asyncio.wait_for(first.get(), 1)
            await asyncio.wait_for(second.get(), 1)
        # Nobody listens: the watcher is gone.
        assert run_stream._watchers == {}

    asyncio.run(scenario())
    assert calls["n"] > 1


def test_the_stream_rings_pings_and_keeps_the_viewer_present(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
    quick: None,
) -> None:
    ttx_id = exercise["ttx"]["id"]
    _ready_plan(client, ttx_id)
    _post(client, ttx_id, "/start")
    session_row = db_session.exec(select(UserSession)).all()[-1]
    seen_before = session_row.last_seen_at

    response = client.get(_url(ttx_id, "/stream"), params={"as": "controller"})

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text.startswith("retry: 3000\nevent: change\ndata: {}\n\n")
    assert ": ping" in response.text
    present = db_session.exec(
        select(RunPresence).where(RunPresence.ttx_id == uuid.UUID(ttx_id))
    ).all()
    assert [p.role for p in present] == ["controller"]
    # An open stream isn't activity.
    db_session.refresh(session_row)
    assert session_row.last_seen_at == seen_before


def test_only_its_participants_listen(
    client: TestClient,
    db_session: Session,
    exercise: dict,  # noqa: F811
) -> None:
    outsider = _account(db_session, "nosy@acme.com", "Nosy")
    _login(client, outsider.email)
    assert client.get(_url(exercise["ttx"]["id"], "/stream")).status_code == 403
