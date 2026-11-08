"""The worker role (APP_ROLE=worker): the background loops without an HTTP
server -- outgoing email and Platform's activity log (forwarding to the
SIEM, retention), which an API process runs too only with APP_ROLE=all.

    python -m app.worker           # run (what the image starts for this role)
    python -m app.worker --check   # health: the heartbeat is recent

Nothing listens on a port: its health is a heartbeat file it touches every
HEARTBEAT_SECONDS, which --check reads (the image's HEALTHCHECK). It stops
cleanly on SIGTERM (docker stop) and SIGINT."""

import argparse
import asyncio
import logging
import signal
import sys
import time
from pathlib import Path

from app.background import background_loops
from app.core.config import settings
from app.core.logging_conf import configure_logging

logger = logging.getLogger("app.worker")

HEARTBEAT_SECONDS = 15
# --check fails once the heartbeat is older than this.
HEARTBEAT_STALE_SECONDS = 60


def _beat(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(f"{time.time():.0f}\n", encoding="utf-8")


async def _heartbeat(path: Path) -> None:
    while True:
        try:
            _beat(path)
        except OSError:
            logger.warning("Worker heartbeat %s can't be written.", path, exc_info=True)
        await asyncio.sleep(HEARTBEAT_SECONDS)


async def run() -> None:
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for signum in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(signum, stop.set)
    heartbeat = asyncio.create_task(_heartbeat(Path(settings.WORKER_HEARTBEAT_FILE)))
    logger.info("Worker started: outgoing email and the activity log's forwarding.")
    try:
        async with background_loops():
            await stop.wait()
    finally:
        heartbeat.cancel()
        logger.info("Worker stopped.")


def check(path: Path | None = None, now: float | None = None) -> bool:
    """The heartbeat exists and is recent."""
    path = path or Path(settings.WORKER_HEARTBEAT_FILE)
    try:
        age = (now or time.time()) - path.stat().st_mtime
    except OSError:
        return False
    return age <= HEARTBEAT_STALE_SECONDS


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.worker")
    parser.add_argument("--check", action="store_true", help="exit 0 if the worker is alive")
    args = parser.parse_args()
    if args.check:
        sys.exit(0 if check() else 1)
    configure_logging()
    asyncio.run(run())


if __name__ == "__main__":
    main()
