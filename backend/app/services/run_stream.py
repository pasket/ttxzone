"""Server push for the Playground: a Server-Sent Events stream that rings
a doorbell -- `event: change` -- whenever an exercise's session moves (a
new event of the log) or someone comes or goes; the page then fetches
its own view (`GET /ttx/{id}/run?since=`), so what each role sees is
still decided in one place.

One watcher per exercise with open streams (per process) checks once a
tick and fans out to every stream: a query per exercise, not per viewer.
Streams are async and hold no worker thread; their database reads run in
the thread pool with sessions of their own (the request's is gone once
streaming starts)."""

import asyncio
import uuid
from collections.abc import AsyncIterator, Callable, Hashable
from contextlib import asynccontextmanager
from datetime import UTC, datetime

from sqlmodel import Session, select
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request

from app.core.config import settings
from app.core.db import engine
from app.models import TTX, ExerciseRun, RunPresence, TTXContextRole, User, UserSession
from app.services import session_service
from app.services.exercise_run_service import PRESENCE_WINDOW, touch_presence


def _everything(value: Hashable) -> Hashable:
    return value


class _Watcher:
    """Checks `probe` every tick while anyone listens; tells each listener
    when the part of its value that listener cares about changes."""

    def __init__(self, probe: Callable[[], Hashable]):
        self.probe = probe
        # Queue -> what of the value matters to it.
        self.listeners: dict[asyncio.Queue, Callable[[Hashable], Hashable]] = {}
        self.last: Hashable = None
        self.task: asyncio.Task | None = None

    async def run(self) -> None:
        self.last = await run_in_threadpool(self.probe)
        while self.listeners:
            await asyncio.sleep(settings.RUN_STREAM_TICK_SECONDS)
            value = await run_in_threadpool(self.probe)
            if value != self.last:
                previous, self.last = self.last, value
                for queue, relevant in list(self.listeners.items()):
                    # One pending ring is enough.
                    if queue.empty() and relevant(value) != relevant(previous):
                        queue.put_nowait(value)


_watchers: dict[Hashable, _Watcher] = {}


@asynccontextmanager
async def listen(
    key: Hashable,
    probe: Callable[[], Hashable],
    relevant: Callable[[Hashable], Hashable] = _everything,
) -> AsyncIterator[asyncio.Queue]:
    """A queue that gets an item whenever `relevant` of `probe`'s value
    changes; the probe is shared with every other listener of `key`."""
    watcher = _watchers.get(key)
    if watcher is None:
        watcher = _watchers[key] = _Watcher(probe)
    queue: asyncio.Queue = asyncio.Queue(maxsize=1)
    watcher.listeners[queue] = relevant
    if watcher.task is None or watcher.task.done():
        watcher.task = asyncio.create_task(watcher.run())
    try:
        yield queue
    finally:
        watcher.listeners.pop(queue, None)
        if not watcher.listeners:
            _watchers.pop(key, None)
            if watcher.task is not None:
                watcher.task.cancel()


def exercise_fingerprint(ttx_id: uuid.UUID) -> Hashable:
    """What a stream rings for: the run, the log's position and who is
    present -- `(run id, last seq, who)`."""
    with Session(engine) as session:
        run = session.exec(
            select(ExerciseRun).where(
                ExerciseRun.ttx_id == ttx_id, ExerciseRun.archived_at.is_(None)
            )
        ).first()
        since = datetime.now(UTC) - PRESENCE_WINDOW
        present = session.exec(
            select(RunPresence.user_id, RunPresence.role).where(
                RunPresence.ttx_id == ttx_id, RunPresence.last_seen_at >= since
            )
        ).all()
        who = tuple(sorted((str(u), r) for u, r in present))
        return (run.id if run else None, run.last_seq if run else 0, who)


def _session_only(value: Hashable) -> Hashable:
    """The run and the log's position of a fingerprint, not who is here."""
    return value[:2] if isinstance(value, tuple) else value


def _keep_alive(session_id: uuid.UUID, ttx_id: uuid.UUID, user_id: uuid.UUID, role: str | None):
    """Whether the viewer's sign-in still holds -- and, while it does,
    that they're still here as `role`. The stream never counts as their
    activity: an idle session ends it like any other."""
    with Session(engine) as session:
        user_session = session.get(UserSession, session_id)
        if user_session is None or not session_service.is_active(user_session):
            return False
        if role is not None:
            touch_presence(session, session.get(TTX, ttx_id), session.get(User, user_id), role)
        return True


async def run_events(
    request: Request,
    *,
    ttx_id: uuid.UUID,
    user_id: uuid.UUID,
    session_id: uuid.UUID,
    role: str | None,
) -> AsyncIterator[str]:
    """The stream: a first ring (so the page fetches at once), a ring per
    change, a comment as keep-alive; it ends when the client goes, the
    sign-in lapses or after RUN_STREAM_MAX_SECONDS (the browser
    reconnects)."""
    loop = asyncio.get_running_loop()
    started = checked = pinged = loop.time()
    # A Player isn't rung for someone coming or going (with hundreds at the
    # table, each arrival rang everyone): their presence panel catches up
    # with the next change of the session, or the page's safety fetch.
    relevant = _session_only if role == TTXContextRole.PLAYER.value else _everything
    async with listen(ttx_id, lambda: exercise_fingerprint(ttx_id), relevant) as queue:
        yield "retry: 3000\nevent: change\ndata: {}\n\n"
        while True:
            if await request.is_disconnected():
                return
            now = loop.time()
            if now - started >= settings.RUN_STREAM_MAX_SECONDS:
                return
            if now - checked >= settings.RUN_STREAM_KEEPALIVE_SECONDS:
                checked = now
                if not await run_in_threadpool(_keep_alive, session_id, ttx_id, user_id, role):
                    return
            try:
                await asyncio.wait_for(queue.get(), timeout=settings.RUN_STREAM_TICK_SECONDS)
            except TimeoutError:
                if loop.time() - pinged >= settings.RUN_STREAM_PING_SECONDS:
                    pinged = loop.time()
                    yield ": ping\n\n"
                continue
            pinged = loop.time()
            yield "event: change\ndata: {}\n\n"
