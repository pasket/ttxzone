"""The deployment's legal documents (terms of service, privacy policy): the
operator drafts and publishes them from Platform, every account accepts them
at signup and again after a substantial change. Nothing is asked while the
operator has published nothing. See docs/features/legal-documents.md."""

import csv
import io
import logging
import time
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import (
    LegalAcceptance,
    LegalDocumentDraft,
    LegalDocumentKind,
    LegalDocumentVersion,
    User,
)
from app.schemas.legal import (
    MAX_LEGAL_TEXT_LENGTH,
    LegalAcceptanceItem,
    LegalTemplateRequest,
)

auth_logger = logging.getLogger(AUTH_LOGGER_NAME)
module_logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "data" / "legal"


def languages_of(content: dict) -> list[str]:
    """Supported languages with text, in the deployment's order."""
    return [lang for lang in settings.SUPPORTED_LOCALES if (content.get(lang) or "").strip()]


def latest_versions(session: Session) -> dict[LegalDocumentKind, LegalDocumentVersion]:
    """The latest published version of each document that has one."""
    newest = (
        select(LegalDocumentVersion.kind, func.max(LegalDocumentVersion.version).label("version"))
        .group_by(LegalDocumentVersion.kind)
        .subquery()
    )
    rows = session.exec(
        select(LegalDocumentVersion).join(
            newest,
            (LegalDocumentVersion.kind == newest.c.kind)
            & (LegalDocumentVersion.version == newest.c.version),
        )
    ).all()
    return {row.kind: row for row in rows}


# (when read, required versions): read by every request (account gates),
# kept INSTANCE_CACHE_SECONDS; forgotten in this process on publishing.
_required_cache: tuple[float, dict] | None = None


def forget_cached_versions() -> None:
    global _required_cache
    _required_cache = None


def _required_versions(session: Session) -> dict[LegalDocumentKind, int]:
    """Per document, the latest version every account must have accepted:
    the newest substantial one (minor corrections don't move it)."""
    global _required_cache
    ttl = settings.INSTANCE_CACHE_SECONDS
    now = time.monotonic()
    if ttl > 0 and _required_cache is not None and now - _required_cache[0] < ttl:
        return dict(_required_cache[1])
    required = _read_required_versions(session)
    if ttl > 0:
        _required_cache = (now, required)
    return dict(required)


def _read_required_versions(session: Session) -> dict[LegalDocumentKind, int]:
    rows = session.exec(
        select(LegalDocumentVersion.kind, func.max(LegalDocumentVersion.version))
        .where(LegalDocumentVersion.requires_acceptance.is_(True))  # type: ignore[attr-defined]
        .group_by(LegalDocumentVersion.kind)
    ).all()
    return dict(rows)


def accepted_versions(session: Session, user: User) -> dict[LegalDocumentKind, int]:
    """The highest version of each document this account has accepted."""
    return dict(
        session.exec(
            select(LegalAcceptance.kind, func.max(LegalAcceptance.version))
            .where(LegalAcceptance.user_id == user.id)
            .group_by(LegalAcceptance.kind)
        ).all()
    )


def pending_acceptances(session: Session, user: User) -> list[LegalDocumentVersion]:
    """The documents this account must accept (their latest version) before
    using the deployment: none accepted yet, or a substantial change since."""
    required = _required_versions(session)
    if not required:
        return []
    accepted = accepted_versions(session, user)
    pending = [
        kind
        for kind in LegalDocumentKind
        if kind in required and accepted.get(kind, 0) < required[kind]
    ]
    if not pending:
        return []
    latest = latest_versions(session)
    return [latest[kind] for kind in pending]


def acceptance_record_csv(session: Session) -> bytes:
    """Every acceptance of the deployment, oldest first -- when (UTC), who,
    which document and version -- as UTF-8 CSV with a BOM, for an audit.
    A deleted account appears anonymized, as it is stored."""
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["accepted_at_utc", "email", "full_name", "document", "version"])
    for acceptance, user in session.exec(
        select(LegalAcceptance, User)
        .join(User, User.id == LegalAcceptance.user_id)
        .order_by(LegalAcceptance.accepted_at, LegalAcceptance.kind)  # type: ignore[arg-type]
    ):
        row = [
            acceptance.accepted_at.astimezone(UTC).isoformat(timespec="seconds"),
            user.email,
            user.full_name,
            acceptance.kind.value,
            str(acceptance.version),
        ]
        # A cell starting like a formula is kept as text.
        writer.writerow(["'" + c if c[:1] in ("=", "+", "-", "@") else c for c in row])
    return ("\ufeff" + buffer.getvalue()).encode()


def acceptances_of(session: Session, user: User) -> list[LegalAcceptance]:
    return list(
        session.exec(
            select(LegalAcceptance)
            .where(LegalAcceptance.user_id == user.id)
            .order_by(LegalAcceptance.accepted_at.desc())  # type: ignore[attr-defined]
        ).all()
    )


def _check_accepted(
    expected: dict[LegalDocumentKind, LegalDocumentVersion],
    accepted: list[LegalAcceptanceItem],
) -> None:
    given = {item.kind: item.version for item in accepted}
    for kind, version in expected.items():
        if kind not in given:
            raise AppException(
                "LEGAL_ACCEPTANCE_REQUIRED",
                "Accept the terms of service and the privacy policy to continue.",
                400,
                log_level=logging.WARNING,
            )
        if given[kind] != version.version:
            raise AppException(
                "LEGAL_VERSION_OUTDATED",
                "The terms have changed since you opened them. Read the current version.",
                409,
                log_level=logging.WARNING,
            )


def require_signup_acceptance(session: Session, accepted: list[LegalAcceptanceItem]) -> None:
    """Before an account is created: it accepts the current version of every
    published document. Checked first, so a refused signup leaves nothing."""
    _check_accepted(latest_versions(session), accepted)


def record_signup_acceptance(
    session: Session, user: User, accepted: list[LegalAcceptanceItem]
) -> None:
    """Right after the account exists. Should this never run, the account
    simply meets the acceptance screen at its next request -- never an
    account using the deployment without having accepted."""
    if accepted:
        _record(session, user, [(item.kind, item.version) for item in accepted], "at signup")


def accept_pending(session: Session, user: User, accepted: list[LegalAcceptanceItem]) -> None:
    pending = {version.kind: version for version in pending_acceptances(session, user)}
    _check_accepted(pending, accepted)
    _record(session, user, [(kind, version.version) for kind, version in pending.items()], "")


def _record(
    session: Session, user: User, versions: list[tuple[LegalDocumentKind, int]], context: str
) -> None:
    for kind, version in versions:
        session.add(LegalAcceptance(user_id=user.id, kind=kind, version=version))
    session.commit()
    auth_logger.info(
        "User %s accepted %s%s.",
        user.id,
        ", ".join(f"{kind.value} v{version}" for kind, version in versions),
        f" {context}" if context else "",
    )


def document_text(version: LegalDocumentVersion, language: str | None) -> tuple[str, bool, str]:
    """(language served, whether it's the one asked for, text)."""
    available = languages_of(version.content)
    if language in available:
        return language, True, version.content[language]
    served = available[0]
    return served, False, version.content[served]


def latest_version(session: Session, kind: LegalDocumentKind) -> LegalDocumentVersion:
    version = latest_versions(session).get(kind)
    if version is None:
        raise AppException(
            "LEGAL_DOCUMENT_NOT_FOUND",
            "This document hasn't been published.",
            404,
            log_level=logging.WARNING,
        )
    return version


# --- Platform (instance administrator) ---


def get_draft(session: Session, kind: LegalDocumentKind) -> LegalDocumentDraft | None:
    return session.get(LegalDocumentDraft, kind)


def save_draft(
    session: Session, user: User, kind: LegalDocumentKind, content: dict[str, str]
) -> LegalDocumentDraft:
    kept = {lang: content[lang] for lang in settings.SUPPORTED_LOCALES if lang in content}
    if any(len(text) > MAX_LEGAL_TEXT_LENGTH for text in kept.values()):
        raise AppException(
            "LEGAL_TEXT_TOO_LONG",
            "Each language is limited to {limit} characters.",
            422,
            log_level=logging.WARNING,
            params={"limit": MAX_LEGAL_TEXT_LENGTH},
        )
    draft = session.get(LegalDocumentDraft, kind) or LegalDocumentDraft(kind=kind)
    draft.content = kept
    draft.updated_at = datetime.now(UTC)
    draft.updated_by_user_id = user.id
    session.add(draft)
    session.commit()
    session.refresh(draft)
    return draft


def list_versions(session: Session, kind: LegalDocumentKind) -> list[LegalDocumentVersion]:
    return list(
        session.exec(
            select(LegalDocumentVersion)
            .where(LegalDocumentVersion.kind == kind)
            .order_by(LegalDocumentVersion.version.desc())  # type: ignore[attr-defined]
        ).all()
    )


def get_version(session: Session, kind: LegalDocumentKind, number: int) -> LegalDocumentVersion:
    version = session.exec(
        select(LegalDocumentVersion).where(
            LegalDocumentVersion.kind == kind, LegalDocumentVersion.version == number
        )
    ).first()
    if version is None:
        raise AppException(
            "LEGAL_DOCUMENT_NOT_FOUND",
            "This version doesn't exist.",
            404,
            log_level=logging.WARNING,
        )
    return version


def publish(
    session: Session, user: User, kind: LegalDocumentKind, requires_acceptance: bool
) -> LegalDocumentVersion:
    """The draft becomes the next version. The draft row is locked so two
    publishes can't take the same number."""
    draft = session.exec(
        select(LegalDocumentDraft).where(LegalDocumentDraft.kind == kind).with_for_update()
    ).first()
    content = {lang: draft.content[lang] for lang in languages_of(draft.content)} if draft else {}
    if not content:
        raise AppException(
            "LEGAL_DRAFT_EMPTY",
            "Write the document in at least one language before publishing it.",
            422,
            log_level=logging.WARNING,
        )
    previous = session.exec(
        select(func.max(LegalDocumentVersion.version)).where(LegalDocumentVersion.kind == kind)
    ).one()
    version = LegalDocumentVersion(
        kind=kind,
        version=(previous or 0) + 1,
        content=content,
        # Nobody has accepted anything before the first version.
        requires_acceptance=requires_acceptance or previous is None,
        published_by_user_id=user.id,
    )
    session.add(version)
    session.commit()
    forget_cached_versions()
    session.refresh(version)
    module_logger.info(
        "User %s published %s v%s%s.",
        user.id,
        kind.value,
        version.version,
        " (acceptance required)" if version.requires_acceptance else "",
    )
    return version


def has_unpublished_changes(
    draft: LegalDocumentDraft | None, latest: LegalDocumentVersion | None
) -> bool:
    content = {lang: draft.content[lang] for lang in languages_of(draft.content)} if draft else {}
    if latest is None:
        return bool(content)
    return content != latest.content


def render_templates(details: LegalTemplateRequest) -> dict[LegalDocumentKind, dict[str, str]]:
    """The shipped templates with the operator's details written in, one per
    document and language (`app/data/legal/<kind>.<lang>.md`). Without a
    postal address, the lines that would hold it are left out."""
    values = {
        "operator_name": details.operator_name.strip(),
        "contact_email": str(details.contact_email),
        "postal_address": details.postal_address.strip(),
        "jurisdiction": details.jurisdiction.strip(),
    }
    rendered: dict[LegalDocumentKind, dict[str, str]] = {}
    for kind in LegalDocumentKind:
        rendered[kind] = {}
        for lang in settings.SUPPORTED_LOCALES:
            path = TEMPLATE_DIR / f"{kind.value}.{lang}.md"
            if not path.exists():
                continue
            text = path.read_text(encoding="utf-8")
            if not values["postal_address"]:
                text = "\n".join(
                    line for line in text.split("\n") if "{{postal_address}}" not in line
                )
            for key, value in values.items():
                text = text.replace("{{" + key + "}}", value)
            rendered[kind][lang] = text
    return rendered
