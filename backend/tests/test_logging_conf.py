import logging
from logging.handlers import RotatingFileHandler, WatchedFileHandler

from app.core.logging_conf import (
    AUTH_LOGGER_NAME,
    LOG_DIR,
    LOG_FORMAT,
    _build_handlers,
    configure_logging,
)


def test_build_handlers_creates_dir_and_caps_the_file_by_default(tmp_path) -> None:
    log_dir = tmp_path / "logs"
    console_handler, file_handler = _build_handlers(log_dir, "app.log")

    try:
        assert log_dir.is_dir()
        assert isinstance(console_handler, logging.StreamHandler)
        # 10 MB x 5 older copies unless .env says otherwise.
        assert isinstance(file_handler, RotatingFileHandler)
        assert file_handler.maxBytes == 10 * 1024 * 1024
        assert file_handler.backupCount == 5
        assert console_handler.formatter._fmt == LOG_FORMAT
        assert file_handler.formatter._fmt == LOG_FORMAT
        assert file_handler.baseFilename.endswith("app.log")
    finally:
        file_handler.close()


def test_build_handlers_uses_given_filename(tmp_path) -> None:
    log_dir = tmp_path / "logs"
    _, file_handler = _build_handlers(log_dir, "access.log")

    try:
        assert file_handler.baseFilename.endswith("access.log")
    finally:
        file_handler.close()


def test_configure_logging_is_idempotent() -> None:
    configure_logging()
    handlers_after_first_call = list(logging.getLogger().handlers)

    configure_logging()
    handlers_after_second_call = list(logging.getLogger().handlers)

    assert len(handlers_after_second_call) == len(handlers_after_first_call)


def test_access_log_is_separate_from_app_log() -> None:
    configure_logging()
    access_logger = logging.getLogger("uvicorn.access")

    assert access_logger.propagate is False
    assert access_logger.level == logging.INFO
    assert (LOG_DIR / "app.log").exists()
    assert (LOG_DIR / "access.log").exists()

    access_file_handlers = [h for h in access_logger.handlers if isinstance(h, RotatingFileHandler)]
    assert len(access_file_handlers) == 1
    assert access_file_handlers[0].baseFilename.endswith("access.log")

    root_file_handlers = [
        h for h in logging.getLogger().handlers if isinstance(h, RotatingFileHandler)
    ]
    assert len(root_file_handlers) == 1
    assert root_file_handlers[0].baseFilename.endswith("app.log")


def test_auth_log_is_separate_from_app_and_access_logs() -> None:
    configure_logging()
    auth_logger = logging.getLogger(AUTH_LOGGER_NAME)

    assert auth_logger.propagate is False
    assert auth_logger.level == logging.INFO
    assert (LOG_DIR / "auth.log").exists()

    auth_file_handlers = [h for h in auth_logger.handlers if isinstance(h, RotatingFileHandler)]
    assert len(auth_file_handlers) == 1
    assert auth_file_handlers[0].baseFilename.endswith("auth.log")


def test_size_rotation_keeps_the_backups_set_and_deletes_the_oldest(tmp_path) -> None:
    _, file_handler = _build_handlers(tmp_path, "auth.log", max_mb=1, backups=2)
    logger = logging.getLogger("tests.size_rotation")
    logger.addHandler(file_handler)
    logger.setLevel(logging.INFO)
    try:
        for _ in range(4 * 1024):
            logger.info("x" * 1000)
    finally:
        logger.removeHandler(file_handler)
        file_handler.close()

    assert sorted(p.name for p in tmp_path.iterdir()) == ["auth.log", "auth.log.1", "auth.log.2"]
    assert all(p.stat().st_size <= 1024 * 1024 for p in tmp_path.iterdir())


def test_a_file_moved_by_logrotate_is_reopened(tmp_path) -> None:
    # LOG_FILE_MAX_MB=0: the server's logrotate rotates.
    _, file_handler = _build_handlers(tmp_path, "auth.log", max_mb=0)
    assert isinstance(file_handler, WatchedFileHandler)
    logger = logging.getLogger("tests.rotation")
    logger.addHandler(file_handler)
    logger.setLevel(logging.INFO)
    try:
        logger.info("before")
        (tmp_path / "auth.log").rename(tmp_path / "auth.log.1")
        logger.info("after")
    finally:
        logger.removeHandler(file_handler)
        file_handler.close()

    assert "before" in (tmp_path / "auth.log.1").read_text()
    assert "after" in (tmp_path / "auth.log").read_text()
    assert "after" not in (tmp_path / "auth.log.1").read_text()
