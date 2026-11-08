"""Evidence files attached to needs-form approvals.

Files live under settings.NEEDS_EVIDENCE_UPLOAD_DIR with random names and
are never mounted as static files: they carry the form's TLP classification
and are only served through a Planner-gated endpoint, as attachments.
An upload is accepted by extension *and* by its actual leading bytes, and
its stored content type comes from the allowlist below, not the client.

Files are unlinked only after the transaction that dropped their rows
commits (the `after_commit` hook), so a rollback never leaves a row
pointing at a deleted file."""

import logging
import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import event
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import TTXNeedsFormEvidence

logger = logging.getLogger(__name__)

EVIDENCE_DIR = Path(__file__).resolve().parents[2] / settings.NEEDS_EVIDENCE_UPLOAD_DIR
_UNLINK_KEY = "needs_evidence_to_unlink"


def _is_text(head: bytes) -> bool:
    if b"\x00" in head:
        return False
    try:
        head.decode("utf-8")
    except UnicodeDecodeError as error:
        # A multi-byte character cut at the end of the sniffed window is fine.
        return error.start >= len(head) - 3
    return True


_ZIP = (b"PK\x03\x04",)
_OLE = (b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1",)

# extension -> (content type served back, accepted leading bytes or a check)
ALLOWED_EVIDENCE: dict[str, tuple[str, object]] = {
    ".pdf": ("application/pdf", (b"%PDF-",)),
    ".png": ("image/png", (b"\x89PNG\r\n\x1a\n",)),
    ".jpg": ("image/jpeg", (b"\xff\xd8\xff",)),
    ".jpeg": ("image/jpeg", (b"\xff\xd8\xff",)),
    ".webp": ("image/webp", lambda head: head[:4] == b"RIFF" and head[8:12] == b"WEBP"),
    ".docx": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        _ZIP,
    ),
    ".xlsx": ("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", _ZIP),
    ".msg": ("application/vnd.ms-outlook", _OLE),
    ".eml": ("message/rfc822", _is_text),
    ".txt": ("text/plain", _is_text),
}


def ensure_evidence_dir() -> Path:
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    return EVIDENCE_DIR


def _safe_filename(name: str | None) -> str:
    base = Path(name or "").name
    base = re.sub(r"[\x00-\x1f\x7f]", "", base).strip()
    return (base or "evidence")[:255]


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


def schedule_unlink(session: Session, stored_names: list[str]) -> None:
    session.info.setdefault(_UNLINK_KEY, []).extend(stored_names)


@event.listens_for(OrmSession, "after_commit")
def _unlink_after_commit(session: OrmSession) -> None:
    for name in session.info.pop(_UNLINK_KEY, []):
        try:
            (EVIDENCE_DIR / name).unlink()
        except FileNotFoundError:
            pass


@event.listens_for(OrmSession, "after_rollback")
def _forget_after_rollback(session: OrmSession) -> None:
    session.info.pop(_UNLINK_KEY, None)


def evidence_for_approvals(
    session: Session, approval_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[TTXNeedsFormEvidence]]:
    by_approval: dict[uuid.UUID, list[TTXNeedsFormEvidence]] = {i: [] for i in approval_ids}
    if approval_ids:
        for row in session.exec(
            select(TTXNeedsFormEvidence)
            .where(TTXNeedsFormEvidence.approval_id.in_(approval_ids))
            .order_by(TTXNeedsFormEvidence.uploaded_at)
        ):
            by_approval[row.approval_id].append(row)
    return by_approval


def delete_evidence_for_approvals(session: Session, approval_ids: list[uuid.UUID]) -> None:
    """Drop the evidence rows of these approvals (their files go once the
    caller commits). Called wherever approvals are deleted."""
    if not approval_ids:
        return
    rows = list(
        session.exec(
            select(TTXNeedsFormEvidence).where(TTXNeedsFormEvidence.approval_id.in_(approval_ids))
        )
    )
    schedule_unlink(session, [row.stored_name for row in rows])
    for row in rows:
        session.delete(row)
    session.flush()


def store_evidence(
    session: Session, approval_id: uuid.UUID, upload: UploadFile, user_id: uuid.UUID
) -> TTXNeedsFormEvidence:
    """Validate and write one file; the caller commits."""
    count = len(
        session.exec(
            select(TTXNeedsFormEvidence.id).where(TTXNeedsFormEvidence.approval_id == approval_id)
        ).all()
    )
    if count >= settings.NEEDS_EVIDENCE_MAX_FILES_PER_APPROVAL:
        raise _reject(
            "EVIDENCE_LIMIT",
            "An approval can have at most {limit} files.",
            409,
            params={"limit": settings.NEEDS_EVIDENCE_MAX_FILES_PER_APPROVAL},
        )

    filename = _safe_filename(upload.filename)
    allowed = ALLOWED_EVIDENCE.get(Path(filename).suffix.lower())
    if allowed is None:
        raise _reject(
            "EVIDENCE_FILE_TYPE",
            "Unsupported file type. Use PDF, PNG, JPEG, WEBP, DOCX, XLSX, EML, MSG or TXT.",
        )
    content_type, signature = allowed

    raw = upload.file.read(settings.NEEDS_EVIDENCE_MAX_BYTES + 1)
    if len(raw) > settings.NEEDS_EVIDENCE_MAX_BYTES:
        max_mb = settings.NEEDS_EVIDENCE_MAX_BYTES // (1024 * 1024)
        raise _reject(
            "EVIDENCE_FILE_TOO_LARGE", "The file exceeds {max_mb} MB.", 413, {"max_mb": max_mb}
        )
    if not raw:
        raise _reject("EVIDENCE_FILE_EMPTY", "The file is empty.")
    head = raw[:512]
    matches = signature(head) if callable(signature) else head.startswith(signature)
    if not matches:
        raise _reject("EVIDENCE_FILE_TYPE", "The file's contents don't match its extension.")

    ensure_evidence_dir()
    stored_name = uuid.uuid4().hex
    (EVIDENCE_DIR / stored_name).write_bytes(raw)
    evidence = TTXNeedsFormEvidence(
        approval_id=approval_id,
        stored_name=stored_name,
        original_filename=filename,
        content_type=content_type,
        size_bytes=len(raw),
        uploaded_by_id=user_id,
    )
    session.add(evidence)
    return evidence


def evidence_path(evidence: TTXNeedsFormEvidence) -> Path:
    return EVIDENCE_DIR / evidence.stored_name
