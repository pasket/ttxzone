import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlmodel import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import TTX
from app.services.image_processing import InvalidImageError, process_square_image

logger = logging.getLogger(__name__)

# Mirrors organization_logo_service.ORG_LOGO_DIR's own anchoring -- resolved
# against this file's location, not process cwd, so it's identical under
# pytest and under the Dockerfile's uvicorn process.
TTX_IMAGE_DIR = Path(__file__).resolve().parents[2] / settings.TTX_IMAGE_UPLOAD_DIR

_STORED_EXTENSION = ".jpg"


def ensure_ttx_image_dir() -> Path:
    TTX_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    return TTX_IMAGE_DIR


def _delete_image_file(filename: str | None) -> None:
    if filename is None:
        return
    try:
        (TTX_IMAGE_DIR / filename).unlink()
    except FileNotFoundError:
        pass


def _invalid_file_type() -> AppException:
    return AppException(
        "INVALID_TTX_IMAGE_FILE_TYPE",
        "Unsupported image type. Use PNG, JPEG, or WEBP.",
        422,
        log_level=logging.WARNING,
    )


def upload_image(session: Session, ttx: TTX, file: UploadFile) -> None:
    if (file.content_type or "") not in settings.AVATAR_ALLOWED_CONTENT_TYPES:
        raise _invalid_file_type()

    raw = file.file.read(settings.AVATAR_MAX_BYTES + 1)
    if len(raw) > settings.AVATAR_MAX_BYTES:
        max_mb = settings.AVATAR_MAX_BYTES // (1024 * 1024)
        raise AppException(
            "TTX_IMAGE_FILE_TOO_LARGE",
            "Image exceeds the maximum allowed size ({max_mb} MB).",
            413,
            log_level=logging.WARNING,
            params={"max_mb": max_mb},
        )

    try:
        processed = process_square_image(raw)
    except InvalidImageError:
        raise _invalid_file_type() from None

    ensure_ttx_image_dir()
    filename = f"{uuid.uuid4()}{_STORED_EXTENSION}"
    (TTX_IMAGE_DIR / filename).write_bytes(processed)

    _delete_image_file(ttx.image_path)
    ttx.image_path = filename
    session.add(ttx)
    session.commit()
    logger.info("Image uploaded for TTX %s (%d bytes stored).", ttx.id, len(processed))


def clear_image(session: Session, ttx: TTX) -> None:
    _delete_image_file(ttx.image_path)
    ttx.image_path = None
    session.add(ttx)
    session.commit()
    logger.info("Image cleared for TTX %s.", ttx.id)


def image_url(ttx: TTX) -> str | None:
    if ttx.image_path is None:
        return None
    return f"{settings.TTX_IMAGE_URL_PREFIX}/{ttx.image_path}"
