"""Creator -> MSEL: the exercise's Master Scenario Events List. Planners of
the exercise read and edit it; a Program Manager of its organization reads
it (RequiresOrgAndTTXAccess lets them through on reads only). Players and Evaluators never
reach it: it holds the injects before they're delivered, the expected
actions and the facilitator notes. Evaluators get the expected actions only
through the EEG."""

import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    verify_csrf,
)
from app.data.attack_catalog import (
    ATTACK_VERSIONS,
    DOMAIN_NAMES,
    DOMAINS,
    LATEST_ATTACK_VERSION,
    load_domain,
)
from app.models import TTX, RoleEnum, User
from app.schemas.ttx_msel import (
    AttackDomainRead,
    AttackReleaseRead,
    AttackTacticRead,
    AttackTechniqueRead,
    AttackUpgradeRead,
    AttackVersionsRead,
    MselFilePreviewRead,
    MselFileRead,
    MselImageRead,
    MselRead,
    MselRenumberRead,
    MselRenumberRequest,
    MselSaveRequest,
    MselTransitionRequest,
)
from app.schemas.ttx_needs_form import ValidationReport
from app.services.msel_file_service import (
    PREVIEW_MAX_BYTES,
    download_headers,
    file_path,
    get_file,
    store_file,
    text_preview,
)
from app.services.msel_image_service import get_image, image_path, store_image
from app.services.msel_pdf_service import ExportKind, render_msel_pdf
from app.services.ttx_msel_service import (
    acknowledge_needs_version,
    draft_report,
    editable_msel,
    find_msel,
    msel_read,
    open_msel,
    renumber,
    save_msel,
    transition,
    upgrade_attack,
)

router = APIRouter(tags=["ttx-msel"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/ttx/{ttx_id}/msel", response_model=MselRead)
def get_msel_endpoint(
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> MselRead:
    """Created on first open -- which needs an approved needs analysis."""
    return msel_read(session, ttx, open_msel(session, ttx, user, locale))


@router.put("/ttx/{ttx_id}/msel", response_model=MselRead, dependencies=[Depends(verify_csrf)])
def save_msel_endpoint(
    payload: MselSaveRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MselRead:
    """Save the MSEL as a whole."""
    return msel_read(session, ttx, save_msel(session, ttx, payload, user))


@router.post(
    "/ttx/{ttx_id}/msel/validate",
    response_model=ValidationReport,
    dependencies=[Depends(verify_csrf)],
)
def validate_msel_endpoint(
    payload: MselSaveRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> ValidationReport:
    """Dry run: the report this payload would produce. Saves nothing."""
    return draft_report(session, ttx, payload)


@router.post(
    "/ttx/{ttx_id}/msel/transitions",
    response_model=MselRead,
    dependencies=[Depends(verify_csrf)],
)
def transition_msel_endpoint(
    payload: MselTransitionRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MselRead:
    """Moving to READY records who did it (no step-up: like validating an
    inject, it's a reviewer's sign-off, undone by going back to DRAFT)."""
    return msel_read(session, ttx, transition(session, ttx, payload.to, user))


@router.post(
    "/ttx/{ttx_id}/msel/acknowledge-needs-version",
    response_model=MselRead,
    dependencies=[Depends(verify_csrf)],
)
def acknowledge_needs_version_endpoint(
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MselRead:
    """Acknowledge that the MSEL has been reviewed against a new needs analysis."""
    return msel_read(session, ttx, acknowledge_needs_version(session, ttx, user))


@router.post(
    "/ttx/{ttx_id}/msel/renumber",
    response_model=MselRenumberRead,
    dependencies=[Depends(verify_csrf)],
)
def renumber_msel_endpoint(
    payload: MselRenumberRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MselRenumberRead:
    """Renumber phases, injects or threat actors in order while the MSEL is
    a draft (or undo it with `codes`); no step-up: reversible. A draft that
    was READY before needs `confirm_frozen`, since its frozen versions keep
    the old codes."""
    msel, previous = renumber(
        session, ttx, payload.kind, payload.codes, user, confirm_frozen=payload.confirm_frozen
    )
    return MselRenumberRead(msel=msel_read(session, ttx, msel), previous=previous)


@router.post(
    "/ttx/{ttx_id}/msel/images",
    response_model=MselImageRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def upload_msel_image_endpoint(
    file: UploadFile = File(...),
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MselImageRead:
    """An image to attach to injects (re-encoded; linked by the next save)."""
    image = store_image(session, editable_msel(session, ttx), file, user.id)
    return MselImageRead(id=image.id, width=image.width, height=image.height)


@router.get("/ttx/{ttx_id}/msel/images/{image_id}")
def get_msel_image_endpoint(
    image_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> FileResponse:
    """Shown inline (an <img> of the page), with the type the server wrote
    it as; never cached -- it carries the exercise's TLP."""
    msel = find_msel(session, ttx.id)
    if msel is None:
        raise AppException("MSEL_NOT_FOUND", "This exercise has no MSEL yet.", 404)
    image = get_image(session, msel, image_id)
    return FileResponse(
        image_path(image),
        media_type=image.content_type,
        filename=f"image{Path(image.stored_name).suffix}",
        content_disposition_type="inline",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.post(
    "/ttx/{ttx_id}/msel/files",
    response_model=MselFileRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def upload_msel_file_endpoint(
    file: UploadFile = File(...),
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MselFileRead:
    """A file to hand out with injects (any type, stored as uploaded;
    linked by the next save)."""
    stored = store_file(session, editable_msel(session, ttx), file, user.id)
    return MselFileRead(
        id=stored.id, name=stored.original_name, size_bytes=stored.size_bytes, sha256=stored.sha256
    )


@router.get("/ttx/{ttx_id}/msel/files/{file_id}")
def get_msel_file_endpoint(
    file_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> FileResponse:
    """Always an opaque download under its original name; never cached --
    it carries the exercise's TLP."""
    msel = find_msel(session, ttx.id)
    if msel is None:
        raise AppException("MSEL_NOT_FOUND", "This exercise has no MSEL yet.", 404)
    stored = get_file(session, msel, file_id)
    return FileResponse(
        file_path(stored), media_type="application/octet-stream", headers=download_headers(stored)
    )


@router.get("/ttx/{ttx_id}/msel/files/{file_id}/preview", response_model=MselFilePreviewRead)
def preview_msel_file_endpoint(
    file_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> MselFilePreviewRead:
    """The beginning of a text file (a log, a CSV export) as plain text, to
    read it without downloading; 409 MSEL_FILE_NOT_TEXT otherwise."""
    msel = find_msel(session, ttx.id)
    if msel is None:
        raise AppException("MSEL_NOT_FOUND", "This exercise has no MSEL yet.", 404)
    stored = get_file(session, msel, file_id)
    text, truncated, encoding = text_preview(stored)
    return MselFilePreviewRead(
        id=stored.id,
        name=stored.original_name,
        size_bytes=stored.size_bytes,
        text=text,
        truncated=truncated,
        encoding=encoding,
        limit_bytes=PREVIEW_MAX_BYTES,
    )


@router.get("/ttx/{ttx_id}/msel/export/{kind}.pdf")
def msel_export_endpoint(
    kind: ExportKind,
    # A plain download link can't set Accept-Language to the app's own
    # language (the browser sends its own), so the page passes it here.
    lang: str | None = Query(None, pattern="^[a-z]{2}$"),
    header_locale: str = Depends(get_locale),
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> Response:
    """The full MSEL as a PDF, TLP-labelled and marked EXERCISE on every
    page; downloaded, never cached. The session documents are exported
    from the conduct prep."""
    locale = lang if lang in settings.SUPPORTED_LOCALES else header_locale
    content, filename = render_msel_pdf(session, ttx, kind, locale)
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.post(
    "/ttx/{ttx_id}/msel/attack-upgrade",
    response_model=AttackUpgradeRead,
    dependencies=[Depends(verify_csrf)],
)
def upgrade_attack_endpoint(
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AttackUpgradeRead:
    """Move the MSEL to the latest ATT&CK release shipped with the app."""
    msel, replaced, removed = upgrade_attack(session, ttx, user)
    return AttackUpgradeRead(msel=msel_read(session, ttx, msel), replaced=replaced, removed=removed)


@router.get("/attack", response_model=AttackVersionsRead)
def attack_versions_endpoint(_user: User = Depends(get_current_user)) -> AttackVersionsRead:
    """The MITRE ATT&CK releases available."""
    return AttackVersionsRead(versions=list(ATTACK_VERSIONS), latest_version=LATEST_ATTACK_VERSION)


@router.get("/attack/{version}", response_model=AttackReleaseRead)
def attack_release_endpoint(
    version: str, _user: User = Depends(get_current_user)
) -> AttackReleaseRead:
    """One ATT&CK release, Enterprise and ICS: tactics in matrix order and
    the live techniques (deprecated ones aren't offered)."""
    if version not in ATTACK_VERSIONS:
        raise AppException(
            "UNKNOWN_ATTACK_VERSION",
            "No ATT&CK v{version} in this build.",
            404,
            log_level=logging.WARNING,
            params={"version": version},
        )
    domains = [load_domain(version, domain) for domain in DOMAINS]
    return AttackReleaseRead(
        version=version,
        released=domains[0].released,
        latest_version=LATEST_ATTACK_VERSION,
        copyright=domains[0].copyright,
        domains=[
            AttackDomainRead(
                domain=d.domain,
                name=DOMAIN_NAMES[d.domain],
                tactics=[AttackTacticRead(id=t.id, name=t.name) for t in d.tactics],
                techniques=[
                    AttackTechniqueRead(
                        id=t.id, name=t.name, tactics=list(t.tactics), parent=t.parent
                    )
                    for t in d.techniques.values()
                    if not t.deprecated
                ],
            )
            for d in domains
        ],
    )
