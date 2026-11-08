"""An open Playground stream must not hold a database connection: with a
pooled connection per stream, a few dozen viewers drain the pool and
every other request waits (found by the load test)."""

import uuid
from types import SimpleNamespace

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.api.v1.endpoints.ttx_run import run_stream_endpoint
from app.core.db import engine
from app.models import TTX, TTXAccess, User, UserSession
from tests.test_exercise_run import _as_player, _post
from tests.test_exercise_run import ready as ready  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)


def test_the_stream_gives_the_requests_connection_back_before_streaming(
    client: TestClient,
    db_session: Session,
    ready: str,  # noqa: F811
) -> None:
    _post(client, ready, "/start")
    _as_player(client, db_session, ready)
    player_id = db_session.exec(
        select(TTXAccess.user_id).where(TTXAccess.ttx_id == uuid.UUID(ready))
    ).all()[-1]
    sign_in = db_session.exec(select(UserSession).where(UserSession.user_id == player_id)).first()
    db_session.close()
    baseline = engine.pool.checkedout()

    # What the route gets from its dependencies: a session that has read.
    session = Session(engine)
    ttx = session.get(TTX, uuid.UUID(ready))
    user = session.get(User, player_id)
    assert engine.pool.checkedout() == baseline + 1
    request = SimpleNamespace(state=SimpleNamespace(user_session=sign_in))

    try:
        response = run_stream_endpoint(request, as_="player", ttx=ttx, user=user, session=session)

        assert response.media_type == "text/event-stream"
        assert engine.pool.checkedout() == baseline
    finally:
        session.close()
