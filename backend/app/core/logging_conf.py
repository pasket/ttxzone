"""Centralized logging configuration.

Sets up a dual-sink logging pipeline (stdout console + file) on the root
logger so any module-level `logging.getLogger(__name__)` call
anywhere in `app.*` propagates through both sinks with a consistent
format. Level semantics (see CLAUDE.md): INFO for lifecycle events,
WARNING for in-scope denials/soft validation, ERROR for per-request
faults, CRITICAL for infra-level crashes.

Each file is capped by default: a RotatingFileHandler rotates it at
LOG_FILE_MAX_MB and keeps LOG_FILE_BACKUPS older copies, deleting the
oldest, so the disk never fills. With LOG_FILE_MAX_MB=0 the server rotates
instead (logrotate, docs/architecture/logging.md): a WatchedFileHandler
reopens its file once logrotate has moved it away -- the choice when
several processes write the same file, which size rotation can't share.
"""

import logging
import sys
from logging.handlers import RotatingFileHandler, WatchedFileHandler
from pathlib import Path

from app.core.config import settings

LOG_FORMAT = "[%(asctime)s] [%(levelname)s] [%(name)s:%(lineno)d] -> %(message)s"

# backend/app/core/logging_conf.py -> parents[2] == backend/
# Anchored to this file's own location (not process cwd), so it resolves
# identically under pytest (cwd = wherever pytest is invoked from) and
# under the Dockerfile's uvicorn process (cwd /app).
LOG_DIR = Path(__file__).resolve().parents[2] / "logs"

# Authentication events of every account (auth_event_service) and
# onboarding (sign-up, token redemption, access requests) route here
# instead of app.log -- also each AppException raised with this logger_name.
AUTH_LOGGER_NAME = "app.auth"

_managed_handlers: list[logging.Handler] = []


def _build_handlers(
    log_dir: Path,
    filename: str,
    max_mb: int | None = None,
    backups: int | None = None,
) -> tuple[logging.Handler, logging.Handler]:
    log_dir.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter(LOG_FORMAT)
    max_mb = settings.LOG_FILE_MAX_MB if max_mb is None else max_mb
    backups = settings.LOG_FILE_BACKUPS if backups is None else backups

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)

    file_handler: logging.FileHandler
    if max_mb > 0:
        file_handler = RotatingFileHandler(
            log_dir / filename,
            maxBytes=max_mb * 1024 * 1024,
            backupCount=backups,
            encoding="utf-8",
        )
    else:
        file_handler = WatchedFileHandler(log_dir / filename, encoding="utf-8")
    file_handler.setFormatter(formatter)

    return console_handler, file_handler


def configure_logging() -> None:
    """Attach the dual console/file handlers to the root logger, and
    separately to uvicorn's own access logger and the dedicated auth logger.

    Business/lifecycle logging (any `logging.getLogger(__name__)` call
    under `app.*`) goes to the root logger's handlers -> app.log.
    HTTP access lines (uvicorn's own `uvicorn.access` logger) are
    re-pointed at their own handlers -> access.log. Onboarding/login
    and authentication events (logged under AUTH_LOGGER_NAME) go to their
    own handlers -> auth.log. Both secondary loggers set `propagate = False` so their
    records don't also flow into app.log via root.

    Safe to call more than once (e.g. repeated app startups within the
    same test process): previously-attached handlers are removed and
    closed first, so calling it again never duplicates output lines.
    """
    root_logger = logging.getLogger()
    access_logger = logging.getLogger("uvicorn.access")
    auth_logger = logging.getLogger(AUTH_LOGGER_NAME)

    for handler in _managed_handlers:
        root_logger.removeHandler(handler)
        access_logger.removeHandler(handler)
        auth_logger.removeHandler(handler)
        handler.close()
    _managed_handlers.clear()

    console_handler, file_handler = _build_handlers(LOG_DIR, "app.log")
    root_logger.setLevel(settings.LOG_LEVEL)
    root_logger.addHandler(console_handler)
    root_logger.addHandler(file_handler)

    access_console_handler, access_file_handler = _build_handlers(LOG_DIR, "access.log")
    # Explicit level: propagate=False stops handler dispatch to root, but
    # effective-level resolution still climbs the logger hierarchy, so
    # without this a stricter root level (settings.LOG_LEVEL) would
    # silently suppress access records too.
    access_logger.setLevel(logging.INFO)
    access_logger.propagate = False
    access_logger.addHandler(access_console_handler)
    access_logger.addHandler(access_file_handler)

    auth_console_handler, auth_file_handler = _build_handlers(LOG_DIR, "auth.log")
    auth_logger.setLevel(logging.INFO)
    auth_logger.propagate = False
    auth_logger.addHandler(auth_console_handler)
    auth_logger.addHandler(auth_file_handler)

    _managed_handlers.extend(
        [
            console_handler,
            file_handler,
            access_console_handler,
            access_file_handler,
            auth_console_handler,
            auth_file_handler,
        ]
    )
