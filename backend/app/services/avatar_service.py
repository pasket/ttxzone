import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlmodel import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import User
from app.services.image_processing import InvalidImageError, process_square_image

logger = logging.getLogger(__name__)

# backend/app/services/avatar_service.py -> parents[2] == backend/
# Anchored to this file's own location (not process cwd), matching
# core/logging_conf.py's LOG_DIR resolution, so it resolves identically
# under pytest and under the Dockerfile's uvicorn process (cwd /app).
AVATAR_DIR = Path(__file__).resolve().parents[2] / settings.AVATAR_UPLOAD_DIR

# Every uploaded photo is re-encoded to this format server-side (see
# image_processing.process_square_image) regardless of what was uploaded,
# so the stored filename extension is always this -- not derived from the
# client's content type.
_STORED_EXTENSION = ".jpg"

# Must exactly match the keys in frontend/src/lib/avatarPresets.ts -- the
# backend never touches preset artwork (it's a bundled frontend asset), it
# only validates the key a client claims to be selecting.
PRESET_KEYS: frozenset[str] = frozenset(
    f"{role}-{tone}"
    for role in (
        "executive",
        "legal",
        "hr",
        "pr",
        "it-security",
        "finance",
        "operations",
        "audit",
        "support",
        "analyst",
    )
    for tone in (1, 2)
) | frozenset(
    f"{feature}-1"
    for feature in (
        "beard",
        "mustache",
        "glasses",
        "tie",
        "cap",
        "headscarf",
        "bun",
        "sunglasses",
        "turtleneck",
        "ponytail",
    )
)


def ensure_avatar_dir() -> Path:
    AVATAR_DIR.mkdir(parents=True, exist_ok=True)
    return AVATAR_DIR


def delete_upload_file(filename: str | None) -> None:
    if filename is None:
        return
    try:
        (AVATAR_DIR / filename).unlink()
    except FileNotFoundError:
        pass


def set_preset_avatar(session: Session, user: User, preset_key: str) -> None:
    if preset_key not in PRESET_KEYS:
        raise AppException(
            "INVALID_AVATAR_PRESET",
            "Unknown avatar preset.",
            422,
            log_level=logging.WARNING,
        )

    delete_upload_file(user.avatar_upload_path)
    user.avatar_preset = preset_key
    user.avatar_upload_path = None
    session.add(user)
    session.commit()
    logger.info("Avatar preset set to %s for user %s.", preset_key, user.id)


def _invalid_file_type() -> AppException:
    return AppException(
        "INVALID_AVATAR_FILE_TYPE",
        "Unsupported image type. Use PNG, JPEG, or WEBP.",
        422,
        log_level=logging.WARNING,
    )


def save_uploaded_avatar(session: Session, user: User, file: UploadFile) -> None:
    if (file.content_type or "") not in settings.AVATAR_ALLOWED_CONTENT_TYPES:
        raise _invalid_file_type()

    raw = file.file.read(settings.AVATAR_MAX_BYTES + 1)
    if len(raw) > settings.AVATAR_MAX_BYTES:
        max_mb = settings.AVATAR_MAX_BYTES // (1024 * 1024)
        raise AppException(
            "AVATAR_FILE_TOO_LARGE",
            "Image exceeds the maximum allowed size ({max_mb} MB).",
            413,
            log_level=logging.WARNING,
            params={"max_mb": max_mb},
        )

    try:
        processed = process_square_image(raw)
    except InvalidImageError:
        raise _invalid_file_type() from None

    ensure_avatar_dir()
    filename = f"{uuid.uuid4()}{_STORED_EXTENSION}"
    (AVATAR_DIR / filename).write_bytes(processed)

    delete_upload_file(user.avatar_upload_path)
    user.avatar_upload_path = filename
    user.avatar_preset = None
    session.add(user)
    session.commit()
    logger.info("Avatar photo uploaded for user %s (%d bytes stored).", user.id, len(processed))


def clear_avatar(session: Session, user: User) -> None:
    delete_upload_file(user.avatar_upload_path)
    user.avatar_preset = None
    user.avatar_upload_path = None
    session.add(user)
    session.commit()
    logger.info("Avatar cleared for user %s.", user.id)


def avatar_kind_and_value(user: User) -> tuple[str | None, str | None]:
    if user.avatar_preset is not None:
        return "preset", user.avatar_preset
    if user.avatar_upload_path is not None:
        return "upload", f"{settings.AVATAR_URL_PREFIX}/{user.avatar_upload_path}"
    return None, None
