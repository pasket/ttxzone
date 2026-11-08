import logging
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlmodel import Session

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import Organization
from app.services.image_processing import InvalidImageError, process_square_image

logger = logging.getLogger(__name__)

# Mirrors avatar_service.AVATAR_DIR's own anchoring -- resolved against
# this file's location, not process cwd, so it's identical under pytest
# and under the Dockerfile's uvicorn process.
ORG_LOGO_DIR = Path(__file__).resolve().parents[2] / settings.ORG_LOGO_UPLOAD_DIR

_STORED_EXTENSION = ".jpg"


def ensure_org_logo_dir() -> Path:
    ORG_LOGO_DIR.mkdir(parents=True, exist_ok=True)
    return ORG_LOGO_DIR


def _delete_logo_file(filename: str | None) -> None:
    if filename is None:
        return
    try:
        (ORG_LOGO_DIR / filename).unlink()
    except FileNotFoundError:
        pass


def _invalid_file_type() -> AppException:
    return AppException(
        "INVALID_LOGO_FILE_TYPE",
        "Unsupported image type. Use PNG, JPEG, or WEBP.",
        422,
        log_level=logging.WARNING,
    )


def upload_logo(session: Session, organization: Organization, file: UploadFile) -> None:
    if (file.content_type or "") not in settings.AVATAR_ALLOWED_CONTENT_TYPES:
        raise _invalid_file_type()

    raw = file.file.read(settings.AVATAR_MAX_BYTES + 1)
    if len(raw) > settings.AVATAR_MAX_BYTES:
        max_mb = settings.AVATAR_MAX_BYTES // (1024 * 1024)
        raise AppException(
            "LOGO_FILE_TOO_LARGE",
            "Image exceeds the maximum allowed size ({max_mb} MB).",
            413,
            log_level=logging.WARNING,
            params={"max_mb": max_mb},
        )

    try:
        processed = process_square_image(raw)
    except InvalidImageError:
        raise _invalid_file_type() from None

    ensure_org_logo_dir()
    filename = f"{uuid.uuid4()}{_STORED_EXTENSION}"
    (ORG_LOGO_DIR / filename).write_bytes(processed)

    _delete_logo_file(organization.logo_path)
    organization.logo_path = filename
    session.add(organization)
    session.commit()
    logger.info(
        "Logo uploaded for organization %s (%d bytes stored).", organization.id, len(processed)
    )


def clear_logo(session: Session, organization: Organization) -> None:
    _delete_logo_file(organization.logo_path)
    organization.logo_path = None
    session.add(organization)
    session.commit()
    logger.info("Logo cleared for organization %s.", organization.id)


def logo_url(organization: Organization) -> str | None:
    if organization.logo_path is None:
        return None
    return f"{settings.ORG_LOGO_URL_PREFIX}/{organization.logo_path}"
