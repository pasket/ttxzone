"""Images attached to MSEL injects.

Files live under settings.MSEL_IMAGE_UPLOAD_DIR with random names and are
never mounted as static files: they carry the exercise's TLP and are only
served through the MSEL's guarded endpoint. An upload is accepted by
extension *and* by decoding it; it's then re-encoded (image_processing), so
what's stored and served is always a file the server wrote.

An image is uploaded first and linked to injects by the MSEL save. Images
no inject links any more are dropped on the next save, unless a READY
snapshot still shows them or they were uploaded in the last day (the
upload may be waiting for its save). Files go only after the transaction
that dropped their rows commits."""

import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import delete, event
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import InjectImage, MselImage, MselSnapshot, TTXMsel
from app.services.image_processing import InvalidImageError, process_attachment_image

logger = logging.getLogger(__name__)

MSEL_IMAGE_DIR = Path(__file__).resolve().parents[2] / settings.MSEL_IMAGE_UPLOAD_DIR
_UNLINK_KEY = "msel_images_to_unlink"
# An unlinked image younger than this may still be waiting for its save.
UNSAVED_GRACE = timedelta(days=1)

# extension -> accepted leading bytes (the decode is the real check)
_ALLOWED: dict[str, tuple[bytes, ...]] = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".webp": (b"RIFF",),
}
_EXTENSIONS = {"image/png": ".png", "image/jpeg": ".jpg"}


def ensure_msel_image_dir() -> Path:
    MSEL_IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    return MSEL_IMAGE_DIR


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


def _schedule_unlink(session: Session, stored_names: list[str]) -> None:
    session.info.setdefault(_UNLINK_KEY, []).extend(stored_names)


@event.listens_for(OrmSession, "after_commit")
def _unlink_after_commit(session: OrmSession) -> None:
    for name in session.info.pop(_UNLINK_KEY, []):
        try:
            (MSEL_IMAGE_DIR / name).unlink()
        except FileNotFoundError:
            pass


@event.listens_for(OrmSession, "after_rollback")
def _forget_after_rollback(session: OrmSession) -> None:
    session.info.pop(_UNLINK_KEY, None)


def image_path(image: MselImage) -> Path:
    return MSEL_IMAGE_DIR / image.stored_name


def store_image(
    session: Session, msel: TTXMsel, upload: UploadFile, user_id: uuid.UUID
) -> MselImage:
    count = session.exec(
        select(func.count()).select_from(MselImage).where(MselImage.msel_id == msel.id)
    ).one()
    if count >= settings.MSEL_IMAGE_MAX_PER_MSEL:
        raise _reject(
            "MSEL_IMAGE_LIMIT",
            "An MSEL can have at most {limit} images.",
            params={"limit": settings.MSEL_IMAGE_MAX_PER_MSEL},
        )
    signatures = _ALLOWED.get(Path(upload.filename or "").suffix.lower())
    raw = upload.file.read(settings.MSEL_IMAGE_MAX_BYTES + 1)
    if len(raw) > settings.MSEL_IMAGE_MAX_BYTES:
        max_mb = settings.MSEL_IMAGE_MAX_BYTES // (1024 * 1024)
        raise _reject(
            "MSEL_IMAGE_TOO_LARGE",
            "An image can be at most {max_mb} MB.",
            413,
            params={"max_mb": max_mb},
        )
    if signatures is None or not raw.startswith(signatures):
        raise _reject("MSEL_IMAGE_INVALID_TYPE", "Upload a PNG, JPEG or WEBP image.")
    try:
        data, content_type, width, height = process_attachment_image(raw)
    except InvalidImageError:
        raise _reject("MSEL_IMAGE_INVALID_TYPE", "Upload a PNG, JPEG or WEBP image.") from None

    image = MselImage(
        msel_id=msel.id,
        stored_name=f"{uuid.uuid4().hex}{_EXTENSIONS[content_type]}",
        content_type=content_type,
        width=width,
        height=height,
        size_bytes=len(data),
        uploaded_by_id=user_id,
    )
    ensure_msel_image_dir()
    image_path(image).write_bytes(data)
    session.add(image)
    try:
        session.commit()
    except Exception:
        image_path(image).unlink(missing_ok=True)
        raise
    session.refresh(image)
    logger.info("Image %s uploaded to the MSEL %s by user %s.", image.id, msel.id, user_id)
    return image


def stage_catalog_images(
    session: Session, msel: TTXMsel, sources: list[Path], user_id: uuid.UUID
) -> list[tuple[MselImage, bytes]]:
    """Rows for TTX-Zone's own illustrations copied with an inject,
    re-encoded like any upload, up to what the MSEL still has room for
    (the rest are left out: an illustration never blocks the copy). The
    caller writes the bytes to `image_path` and commits."""
    count = session.exec(
        select(func.count()).select_from(MselImage).where(MselImage.msel_id == msel.id)
    ).one()
    room = max(settings.MSEL_IMAGE_MAX_PER_MSEL - count, 0)
    staged: list[tuple[MselImage, bytes]] = []
    for source in sources[:room]:
        data, content_type, width, height = process_attachment_image(source.read_bytes())
        image = MselImage(
            msel_id=msel.id,
            stored_name=f"{uuid.uuid4().hex}{_EXTENSIONS[content_type]}",
            content_type=content_type,
            width=width,
            height=height,
            size_bytes=len(data),
            uploaded_by_id=user_id,
        )
        session.add(image)
        staged.append((image, data))
    if len(sources) > room:
        logger.warning("MSEL %s is full: %d catalog images left out.", msel.id, len(sources) - room)
    return staged


def get_image(session: Session, msel: TTXMsel, image_id: uuid.UUID) -> MselImage:
    image = session.get(MselImage, image_id)
    if image is None or image.msel_id != msel.id or not image_path(image).is_file():
        raise AppException("MSEL_IMAGE_NOT_FOUND", "Image not found.", 404)
    return image


def images_by_id(session: Session, msel_id: uuid.UUID) -> dict[uuid.UUID, MselImage]:
    return {
        image.id: image
        for image in session.exec(select(MselImage).where(MselImage.msel_id == msel_id))
    }


def msel_image_files(session: Session, msel_id: uuid.UUID) -> dict[uuid.UUID, Path]:
    """Every image of the MSEL whose file is there, by id: what a PDF draws."""
    return {
        image.id: image_path(image)
        for image in images_by_id(session, msel_id).values()
        if image_path(image).is_file()
    }


def _in_snapshots(session: Session, msel_id: uuid.UUID) -> set[str]:
    """Image ids a frozen version still shows (its PDFs are exported from
    the snapshot)."""
    used: set[str] = set()
    for payload in session.exec(
        select(MselSnapshot.payload).where(MselSnapshot.msel_id == msel_id)
    ):
        data = payload if isinstance(payload, dict) else json.loads(payload)
        for inject in data.get("injects", []):
            used.update(str(image["id"]) for image in inject.get("images", []))
    return used


def drop_unused_images(session: Session, msel_id: uuid.UUID) -> None:
    """Delete the images no inject links, no snapshot shows and that are
    past the grace for an upload still waiting for its save. Called by the
    MSEL save before it commits."""
    linked = set(
        session.exec(
            select(InjectImage.image_id).join(MselImage).where(MselImage.msel_id == msel_id)
        )
    )
    frozen = _in_snapshots(session, msel_id)
    cutoff = datetime.now(UTC) - UNSAVED_GRACE
    for image in images_by_id(session, msel_id).values():
        if image.id in linked or str(image.id) in frozen or image.created_at > cutoff:
            continue
        _schedule_unlink(session, [image.stored_name])
        session.delete(image)


def delete_images_for_msels(session: Session, msel_ids: list[uuid.UUID]) -> None:
    """Every image of these MSELs, rows and files (their inject links must
    be gone already). Part of the exercise cascade."""
    if not msel_ids:
        return
    names = list(session.exec(select(MselImage.stored_name).where(MselImage.msel_id.in_(msel_ids))))
    _schedule_unlink(session, names)
    session.execute(delete(MselImage).where(MselImage.msel_id.in_(msel_ids)))
