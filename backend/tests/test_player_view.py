"""A Player's view at scale: the part a room's Players share is built once
per change (player_view), the presence list a Player gets is capped, a
fetch doesn't write presence every time, and someone coming or going
doesn't ring the Players (docs/deployment.md, section 10)."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.core.config import settings
from app.models import TTX, RoleEnum, RunPresence, TTXAccess, TTXRoom, User
from app.services import exercise_run_service as runs
from app.services import run_stream
from tests.test_exercise_run import _post, _url
from tests.test_run_decisions import _decide, _open, _vote
from tests.test_run_rooms import _player
from tests.test_run_rooms import rooms as rooms  # noqa: F401 (fixture)
from tests.test_ttx_conduct_prep import exercise as exercise  # noqa: F401 (fixture)
from tests.test_ttx_evaluation import _account


@pytest.fixture
def caches(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "RUN_VIEW_CACHE_SECONDS", 60.0)
    monkeypatch.setattr(settings, "RUN_PRESENCE_CACHE_SECONDS", 60.0)
    runs._shared_views.clear()
    runs._present_cache.clear()


def _run(db_session: Session, ttx_id: str):
    db_session.expire_all()
    ttx = db_session.get(TTX, uuid.UUID(ttx_id))
    return ttx, runs.find_run(db_session, ttx.id)


def _full(db_session: Session, ttx: TTX, run, user: User) -> dict:
    return runs.run_view(
        db_session, ttx, run, can_control=False, viewer_role="player", viewer=user
    ).model_dump(mode="json")


def test_the_shared_view_is_the_full_view_per_player(
    client: TestClient,
    db_session: Session,
    rooms: dict,  # noqa: F811
    caches: None,
) -> None:
    ttx_id, (blue_only, red_only, *_) = rooms["ttx_id"], rooms["codes"]
    ana, ana_client = rooms["ana"]
    for code in (blue_only, red_only):
        _post(client, ttx_id, f"/injects/{code}/release")
    bea, _ = _player(db_session, ttx_id, "bea@acme.com", "Bea Blue", rooms["blue"])
    assert _decide(ana_client, ttx_id, "player", text="Blue isolates").status_code == 200
    poll = _open(client, ttx_id, question="Pay?", options=["Yes", "No"], room_code="RM-01")
    poll_id = poll.json()["polls"][0]["id"]
    assert _vote(ana_client, ttx_id, poll_id, 0).status_code == 200

    ttx, run = _run(db_session, ttx_id)
    players = [ana, bea, rooms["rob"][0], rooms["una"][0]]
    runs._shared_views.clear()
    shared = {
        p.id: runs.player_view(db_session, ttx, run, p).model_dump(mode="json") for p in players
    }

    for player in players:
        assert shared[player.id] == _full(db_session, ttx, run, player), player.full_name
    # Built once per room: Blue (Ana and Bea), Red, no room.
    assert len(runs._shared_views) == 3
    # What is theirs stays theirs.
    assert [d["mine"] for d in shared[ana.id]["decisions"]] == [True]
    assert [d["mine"] for d in shared[bea.id]["decisions"]] == [False]
    assert shared[ana.id]["polls"][0]["my_vote"] == 0
    assert shared[bea.id]["polls"][0]["my_vote"] is None
    assert shared[bea.id]["rooms"]["me"] == {
        "room_code": "RM-01",
        "room_name": "Blue",
        "location": "room",
    }


def test_the_shared_view_follows_the_log_at_once_and_the_rest_within_its_lifetime(
    client: TestClient,
    db_session: Session,
    rooms: dict,  # noqa: F811
    caches: None,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    ttx_id, (blue_only, _, both, *_) = rooms["ttx_id"], rooms["codes"]
    ana, _ = rooms["ana"]
    _post(client, ttx_id, f"/injects/{blue_only}/release")
    ttx, run = _run(db_session, ttx_id)
    assert [i.code for i in runs.player_view(db_session, ttx, run, ana).injects] == [blue_only]

    # A new event: a new view, without waiting.
    _post(client, ttx_id, f"/injects/{both}/release")
    ttx, run = _run(db_session, ttx_id)
    assert [i.code for i in runs.player_view(db_session, ttx, run, ana).injects] == [
        blue_only,
        both,
    ]

    # A room renamed leaves no trace in the log: seen once the view expires.
    room = db_session.get(TTXRoom, rooms["blue"].id)
    room.name = "Azul"
    db_session.add(room)
    db_session.commit()
    ttx, run = _run(db_session, ttx_id)
    assert runs.player_view(db_session, ttx, run, ana).rooms.me.room_name == "Blue"
    later = runs.time.monotonic() + settings.RUN_VIEW_CACHE_SECONDS + 1
    monkeypatch.setattr(runs.time, "monotonic", lambda: later)
    assert runs.player_view(db_session, ttx, run, ana).rooms.me.room_name == "Azul"


def _present(db_session: Session, ttx_id: str, how_many: int) -> None:
    now = datetime.now(UTC)
    for n in range(how_many):
        user = _account(db_session, f"p{n:02d}@acme.com", f"Player {n:02d}")
        db_session.add(TTXAccess(user_id=user.id, ttx_id=uuid.UUID(ttx_id), role=RoleEnum.PLAYER))
        db_session.add(
            RunPresence(ttx_id=uuid.UUID(ttx_id), user_id=user.id, role="player", last_seen_at=now)
        )
    db_session.commit()


def test_a_player_gets_a_few_names_and_every_count(
    client: TestClient,
    db_session: Session,
    rooms: dict,  # noqa: F811
) -> None:
    ttx_id = rooms["ttx_id"]
    _present(db_session, ttx_id, runs.PRESENCE_NAMES_MAX + 5)
    client.get(_url(ttx_id), params={"as": "controller"})  # the Controller is here
    _, ana_client = rooms["ana"]
    table = ana_client.get(_url(ttx_id), params={"as": "player"}).json()
    team = client.get(_url(ttx_id), params={"as": "controller"}).json()

    players = runs.PRESENCE_NAMES_MAX + 6  # those present plus Ana, polling
    assert table["presence_counts"] == {"controller": 1, "player": players}
    assert team["presence_counts"] == table["presence_counts"]
    named = [p for p in table["presence"] if p["role"] == "player"]
    assert len(named) == runs.PRESENCE_NAMES_MAX and all(p["name"] for p in named)
    assert {"role": "controller", "name": None} in table["presence"]
    assert len([p for p in team["presence"] if p["role"] == "player"]) == players


def test_a_fetch_writes_presence_at_most_every_few_seconds(
    client: TestClient,
    db_session: Session,
    rooms: dict,  # noqa: F811
) -> None:
    ttx_id = rooms["ttx_id"]
    ana, ana_client = rooms["ana"]

    def seen() -> datetime:
        db_session.expire_all()
        return db_session.exec(
            select(RunPresence.last_seen_at).where(RunPresence.user_id == ana.id)
        ).one()

    ana_client.get(_url(ttx_id), params={"as": "player"})
    first = seen()
    ana_client.get(_url(ttx_id), params={"as": "player"})
    assert seen() == first

    row = db_session.exec(select(RunPresence).where(RunPresence.user_id == ana.id)).one()
    stale = datetime.now(UTC) - runs.PRESENCE_TOUCH_INTERVAL - timedelta(seconds=1)
    row.last_seen_at = stale
    db_session.add(row)
    db_session.commit()
    ana_client.get(_url(ttx_id), params={"as": "player"})
    assert seen() > stale + runs.PRESENCE_TOUCH_INTERVAL


def test_someone_coming_or_going_rings_the_team_not_the_players(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "RUN_STREAM_TICK_SECONDS", 0.01)
    values = iter(
        [("run", 1, ("a",)), ("run", 1, ("a", "b")), ("run", 2, ("a", "b"))]
        + [("run", 2, ("a", "b"))] * 1000
    )

    async def scenario() -> tuple[list, list]:
        current = [next(values)]

        def probe():
            return current[0]

        async with (
            run_stream.listen("x", probe, run_stream._session_only) as player,
            run_stream.listen("x", probe) as team,
        ):
            await asyncio.sleep(0.05)
            rung: tuple[list, list] = ([], [])
            for _ in range(2):
                current[0] = next(values)
                await asyncio.sleep(0.05)
                for queue, out in ((player, rung[0]), (team, rung[1])):
                    while not queue.empty():
                        out.append(queue.get_nowait())
            return rung

    player_rings, team_rings = asyncio.run(scenario())

    # Someone arrived (b): the team only. The log moved: both.
    assert player_rings == [("run", 2, ("a", "b"))]
    assert team_rings == [("run", 1, ("a", "b")), ("run", 2, ("a", "b"))]
