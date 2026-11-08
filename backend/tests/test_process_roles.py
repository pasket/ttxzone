"""Process roles (APP_ROLE): which process runs the background loops, the
worker's heartbeat, the email wake-up across processes, and the single
SIEM forwarder."""

import os
import threading
import time
from contextlib import asynccontextmanager
from pathlib import Path

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, func, select

from app import main, worker
from app.core.db import engine
from app.services import email_service, platform_audit_service
from tests.test_email import _configure


def _dsn() -> str:
    return engine.url.set(drivername="postgresql").render_as_string(hide_password=False)


@pytest.mark.parametrize(
    ("role", "loops"), [("all", True), ("api-internal", False)], ids=["all", "api-internal"]
)
def test_only_the_all_role_runs_the_loops_inside_the_api(
    monkeypatch: pytest.MonkeyPatch, role: str, loops: bool
) -> None:
    started: list[str] = []

    @asynccontextmanager
    async def fake_loops():
        started.append(role)
        yield

    monkeypatch.setattr(main, "background_loops", fake_loops)

    with TestClient(main.create_app(role)) as client:
        assert client.get("/api/v1/health").status_code == 200

    assert started == ([role] if loops else [])


def test_the_worker_has_no_http_app() -> None:
    with pytest.raises(ValueError, match="app.worker"):
        main.create_app("worker")


def test_the_worker_heartbeat(tmp_path: Path) -> None:
    beat = tmp_path / "heartbeat"

    assert worker.check(beat) is False
    worker._beat(beat)
    assert worker.check(beat) is True
    stale = time.time() + worker.HEARTBEAT_STALE_SECONDS + 1
    assert worker.check(beat, now=stale) is False


def test_queueing_a_message_notifies_on_commit(db_session: Session) -> None:
    _configure(db_session)
    with psycopg.connect(_dsn(), autocommit=True) as listener:
        listener.execute(f"LISTEN {email_service.NOTIFY_CHANNEL}")

        email_service.queue(db_session, "pat@acme.com", "password_reset", {"link": "x"})
        before_commit = list(listener.notifies(timeout=0.5, stop_after=1))
        db_session.commit()
        after_commit = list(listener.notifies(timeout=5, stop_after=1))

    assert before_commit == []
    assert [n.channel for n in after_commit] == [email_service.NOTIFY_CHANNEL]


def test_the_listener_wakes_the_sending_loop(monkeypatch: pytest.MonkeyPatch) -> None:
    woken = threading.Event()
    monkeypatch.setattr(email_service, "wake_delivery", woken.set)
    stop = threading.Event()
    thread = threading.Thread(target=email_service._listen, args=(stop,), daemon=True)
    thread.start()
    try:
        with psycopg.connect(_dsn(), autocommit=True) as other_process:
            # Until the listener is in place, a notification would be lost.
            deadline = time.monotonic() + 10
            while not woken.is_set() and time.monotonic() < deadline:
                other_process.execute(f"NOTIFY {email_service.NOTIFY_CHANNEL}")
                woken.wait(0.5)
        assert woken.is_set()
    finally:
        stop.set()
        thread.join(timeout=5)
    assert not thread.is_alive()


def test_only_one_process_forwards_at_a_time() -> None:
    ran: list[str] = []
    key = platform_audit_service.FORWARDER_LOCK_KEY
    with psycopg.connect(_dsn(), autocommit=True) as other_worker:
        other_worker.execute("SELECT pg_advisory_lock(%s)", (key,))

        held = platform_audit_service.run_exclusively(engine, lambda: ran.append("held"))

        other_worker.execute("SELECT pg_advisory_unlock(%s)", (key,))

    free = platform_audit_service.run_exclusively(engine, lambda: ran.append("free"))

    assert (held, free) == (False, True)
    assert ran == ["free"]
    # The lock is released after a round, even one that fails.
    with pytest.raises(RuntimeError):
        platform_audit_service.run_exclusively(engine, _fail)
    assert platform_audit_service.run_exclusively(engine, lambda: ran.append("again"))


def _fail() -> None:
    raise RuntimeError("round failed")


def test_the_health_check_follows_the_role(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    from app import healthcheck
    from app.core.config import settings

    beat = tmp_path / "beat"
    monkeypatch.setattr(settings, "APP_ROLE", "worker")
    monkeypatch.setattr(settings, "WORKER_HEARTBEAT_FILE", str(beat))

    assert healthcheck.main() == 1
    worker._beat(beat)
    assert healthcheck.main() == 0


def test_start_script_dispatches_on_the_role() -> None:
    script = (Path(__file__).resolve().parents[1] / "start.sh").read_text()

    assert "exec python -m app.worker" in script
    assert "RUN_MIGRATIONS" in script
    assert os.access(Path(__file__).resolve().parents[1] / "start.sh", os.R_OK)


def test_the_queue_still_counts_messages(db_session: Session) -> None:
    """NOTIFY rides in the caller's transaction without changing it."""
    _configure(db_session)
    email_service.queue(db_session, "pat@acme.com", "password_reset", {"link": "x"})
    db_session.rollback()
    from app.models import EmailOutbox

    assert db_session.exec(select(func.count()).select_from(EmailOutbox)).one() == 0
