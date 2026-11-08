"""Files the players download with MSEL injects (logs, packet captures,
memory dumps, exports...).

Unlike images, these are stored byte for byte as uploaded: they're the
evidence the table analyses, so any type is accepted and nothing is
re-encoded, parsed or executed. To keep that safe they live under
settings.MSEL_FILE_UPLOAD_DIR with random names (no extension), are never
mounted as static files, and are only served through guarded endpoints as
opaque downloads (`download_headers`): `application/octet-stream`,
`attachment` and `nosniff`, under the API's deny-all CSP, so a browser
never renders one. Each carries its SHA-256, shown to the players to check what they got.

Same life cycle as images (msel_image_service): uploaded first, linked to
injects by the MSEL save; files no inject links any more are dropped on
the next save unless a READY snapshot still shows them or they were
uploaded in the last day. Files go only after the transaction that dropped
their rows commits.

Text files (logs, CSV exports, JSON...) can also be *previewed*
(`text_preview`): the first PREVIEW_MAX_BYTES decoded on the server and
returned as JSON text, which the page shows as plain text -- the file is
still never served inline, so nothing in it is ever rendered or run."""

import hashlib
import json
import logging
import re
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import quote

from fastapi import UploadFile
from sqlalchemy import delete, event
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session, func, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import InjectFile, MselFile, MselSnapshot, TTXMsel

logger = logging.getLogger(__name__)

MSEL_FILE_DIR = Path(__file__).resolve().parents[2] / settings.MSEL_FILE_UPLOAD_DIR
_UNLINK_KEY = "msel_files_to_unlink"
# An unlinked file younger than this may still be waiting for its save.
UNSAVED_GRACE = timedelta(days=1)
_CHUNK = 1024 * 1024


def ensure_msel_file_dir() -> Path:
    MSEL_FILE_DIR.mkdir(parents=True, exist_ok=True)
    return MSEL_FILE_DIR


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


def safe_filename(name: str | None) -> str:
    """The name to offer the download under: no directories, no control
    characters, at most 255 characters (the extension kept)."""
    base = re.sub(r"[\x00-\x1f\x7f]", "", (name or "").replace("\\", "/"))
    base = base.rsplit("/", 1)[-1].strip().lstrip(".").strip()
    if not base:
        return "file"
    if len(base) > 255:
        suffix = Path(base).suffix[:32]
        base = base[: 255 - len(suffix)] + suffix
    return base


def download_headers(file: MselFile) -> dict[str, str]:
    """Headers for a file's download: never rendered, never cached."""
    return {
        "Content-Disposition": f"attachment; filename*=UTF-8''{quote(file.original_name)}",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }


def _schedule_unlink(session: Session, stored_names: list[str]) -> None:
    session.info.setdefault(_UNLINK_KEY, []).extend(stored_names)


@event.listens_for(OrmSession, "after_commit")
def _unlink_after_commit(session: OrmSession) -> None:
    for name in session.info.pop(_UNLINK_KEY, []):
        try:
            (MSEL_FILE_DIR / name).unlink()
        except FileNotFoundError:
            pass


@event.listens_for(OrmSession, "after_rollback")
def _forget_after_rollback(session: OrmSession) -> None:
    session.info.pop(_UNLINK_KEY, None)


def file_path(file: MselFile) -> Path:
    return MSEL_FILE_DIR / file.stored_name


def write_file(data: bytes) -> tuple[str, str]:
    """Write bytes under a fresh random name: (stored name, sha256). For
    the scenario import (the bytes are already in memory)."""
    ensure_msel_file_dir()
    stored_name = uuid.uuid4().hex
    (MSEL_FILE_DIR / stored_name).write_bytes(data)
    return stored_name, hashlib.sha256(data).hexdigest()


def store_file(session: Session, msel: TTXMsel, upload: UploadFile, user_id: uuid.UUID) -> MselFile:
    count = session.exec(
        select(func.count()).select_from(MselFile).where(MselFile.msel_id == msel.id)
    ).one()
    if count >= settings.MSEL_FILE_MAX_PER_MSEL:
        raise _reject(
            "MSEL_FILE_LIMIT",
            "An MSEL can have at most {limit} files.",
            params={"limit": settings.MSEL_FILE_MAX_PER_MSEL},
        )
    ensure_msel_file_dir()
    stored_name = uuid.uuid4().hex
    path = MSEL_FILE_DIR / stored_name
    digest = hashlib.sha256()
    size = 0
    try:
        # Streamed to disk: a capture or a dump needn't fit in memory.
        with path.open("wb") as out:
            while chunk := upload.file.read(_CHUNK):
                size += len(chunk)
                if size > settings.MSEL_FILE_MAX_BYTES:
                    max_mb = settings.MSEL_FILE_MAX_BYTES // (1024 * 1024)
                    raise _reject(
                        "MSEL_FILE_TOO_LARGE",
                        "A file can be at most {max_mb} MB.",
                        413,
                        params={"max_mb": max_mb},
                    )
                digest.update(chunk)
                out.write(chunk)
        if size == 0:
            raise _reject("MSEL_FILE_EMPTY", "The file is empty.")
        file = MselFile(
            msel_id=msel.id,
            stored_name=stored_name,
            original_name=safe_filename(upload.filename),
            size_bytes=size,
            sha256=digest.hexdigest(),
            uploaded_by_id=user_id,
        )
        session.add(file)
        session.commit()
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    session.refresh(file)
    logger.info(
        "File %s (%d bytes) uploaded to the MSEL %s by user %s.", file.id, size, msel.id, user_id
    )
    return file


def get_file(session: Session, msel: TTXMsel, file_id: uuid.UUID) -> MselFile:
    file = session.get(MselFile, file_id)
    if file is None or file.msel_id != msel.id or not file_path(file).is_file():
        raise AppException("MSEL_FILE_NOT_FOUND", "File not found.", 404)
    return file


def files_by_id(session: Session, msel_id: uuid.UUID) -> dict[uuid.UUID, MselFile]:
    return {
        file.id: file for file in session.exec(select(MselFile).where(MselFile.msel_id == msel_id))
    }


def _in_snapshots(session: Session, msel_id: uuid.UUID) -> set[str]:
    """File ids a frozen version still shows."""
    used: set[str] = set()
    for payload in session.exec(
        select(MselSnapshot.payload).where(MselSnapshot.msel_id == msel_id)
    ):
        data = payload if isinstance(payload, dict) else json.loads(payload)
        for inject in data.get("injects", []):
            used.update(str(file["id"]) for file in inject.get("files", []))
    return used


def drop_unused_files(session: Session, msel_id: uuid.UUID) -> None:
    """Delete the files no inject links, no snapshot shows and that are
    past the grace for an upload still waiting for its save. Called by the
    MSEL save before it commits."""
    linked = set(
        session.exec(select(InjectFile.file_id).join(MselFile).where(MselFile.msel_id == msel_id))
    )
    frozen = _in_snapshots(session, msel_id)
    cutoff = datetime.now(UTC) - UNSAVED_GRACE
    for file in files_by_id(session, msel_id).values():
        if file.id in linked or str(file.id) in frozen or file.created_at > cutoff:
            continue
        _schedule_unlink(session, [file.stored_name])
        session.delete(file)


def delete_files_for_msels(session: Session, msel_ids: list[uuid.UUID]) -> None:
    """Every file of these MSELs, rows and files (their inject links must
    be gone already). Part of the exercise cascade."""
    if not msel_ids:
        return
    names = list(session.exec(select(MselFile.stored_name).where(MselFile.msel_id.in_(msel_ids))))
    _schedule_unlink(session, names)
    session.execute(delete(MselFile).where(MselFile.msel_id.in_(msel_ids)))


# -- text preview -----------------------------------------------------------

PREVIEW_MAX_BYTES = 256 * 1024
_BOMS = (
    (b"\xef\xbb\xbf", "utf-8-sig"),
    (b"\xff\xfe", "utf-16"),
    (b"\xfe\xff", "utf-16"),
)
# Control characters a log has no business showing (all but tab, LF, CR).
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def _decode_text(head: bytes, cut: bool) -> tuple[str, str] | None:
    """(text, encoding) when `head` reads as text, else None. UTF-8, or
    UTF-16 with its byte-order mark (Windows exports); a NUL byte without a
    UTF-16 mark means binary. `cut`: the head stops mid-file, so a
    multi-byte character may be split at its end."""
    for bom, encoding in _BOMS:
        if head.startswith(bom):
            data = head
            if encoding == "utf-16" and cut and len(data) % 2:
                data = data[:-1]
            try:
                return data.decode(encoding, errors="strict" if not cut else "ignore"), encoding
            except UnicodeDecodeError:
                return None
    if b"\x00" in head:
        return None
    for trim in range(4 if cut else 1):
        try:
            return head[: len(head) - trim].decode("utf-8"), "utf-8"
        except UnicodeDecodeError:
            continue
    return None


def text_preview(file: MselFile) -> tuple[str, bool, str]:
    """The beginning of a text file: (text, truncated, encoding). 409
    MSEL_FILE_NOT_TEXT when it doesn't read as text (a capture, a dump, an
    archive), which only downloads."""
    with file_path(file).open("rb") as handle:
        head = handle.read(PREVIEW_MAX_BYTES + 1)
    truncated = len(head) > PREVIEW_MAX_BYTES
    head = head[:PREVIEW_MAX_BYTES]
    decoded = _decode_text(head, truncated)
    if decoded is None:
        raise AppException(
            "MSEL_FILE_NOT_TEXT",
            "This file isn't text: download it to open it.",
            409,
            log_level=logging.WARNING,
        )
    text, encoding = decoded
    text = _CONTROL.sub("\ufffd", text.replace("\r\n", "\n"))
    return text, truncated, encoding
