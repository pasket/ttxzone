"""Creator -> Session plan: the evaluation plan and the preparation of the
session. Planner-only (design), like the MSEL it builds on: it holds the
expected actions, the evaluation criteria and the stop procedure. Control
and Execution read its frozen EEG through GET /ttx/{ttx_id}/eeg."""

from fastapi import APIRouter, Depends, Query, Response
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import RequiresOrgAndTTXAccess, get_current_user, verify_csrf
from app.models import TTX, RoleEnum, User
from app.schemas.ttx_conduct_prep import (
    ConductPrepRead,
    ConductPrepSaveRequest,
    ConductPrepTransitionRequest,
)
from app.schemas.ttx_needs_form import ValidationReport
from app.services.conduct_prep_pdf_service import ExportKind, render_conduct_prep_pdf
from app.services.ttx_conduct_prep_service import (
    draft_report,
    open_prep,
    prep_read,
    reseed_eeg,
    save_prep,
    transition,
)

router = APIRouter(tags=["ttx-conduct-prep"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/ttx/{ttx_id}/conduct-prep", response_model=ConductPrepRead)
def get_conduct_prep_endpoint(
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ConductPrepRead:
    """Created on first open -- which needs an approved needs analysis."""
    return prep_read(session, ttx, open_prep(session, ttx, user, locale))


@router.put(
    "/ttx/{ttx_id}/conduct-prep",
    response_model=ConductPrepRead,
    dependencies=[Depends(verify_csrf)],
)
def save_conduct_prep_endpoint(
    payload: ConductPrepSaveRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConductPrepRead:
    """Save the session plan as a whole."""
    return prep_read(session, ttx, save_prep(session, ttx, payload, user))


@router.post(
    "/ttx/{ttx_id}/conduct-prep/validate",
    response_model=ValidationReport,
    dependencies=[Depends(verify_csrf)],
)
def validate_conduct_prep_endpoint(
    payload: ConductPrepSaveRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> ValidationReport:
    """Dry run: the report this payload would produce. Saves nothing."""
    return draft_report(session, ttx, payload)


@router.post(
    "/ttx/{ttx_id}/conduct-prep/transitions",
    response_model=ConductPrepRead,
    dependencies=[Depends(verify_csrf)],
)
def transition_conduct_prep_endpoint(
    payload: ConductPrepTransitionRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> ConductPrepRead:
    """Moving to READY records who did it (no step-up: a reviewer's
    sign-off, undone by going back to DRAFT, like the MSEL's)."""
    return prep_read(session, ttx, transition(session, ttx, payload.to, user))


@router.post(
    "/ttx/{ttx_id}/conduct-prep/eeg/reseed",
    response_model=ConductPrepRead,
    dependencies=[Depends(verify_csrf)],
)
def reseed_conduct_prep_eeg_endpoint(
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    locale: str = Depends(get_locale),
    session: Session = Depends(get_session),
) -> ConductPrepRead:
    """Merge the current needs analysis and READY MSEL into the definitive
    EEGs; keeps every edit (no step-up: nothing written here is lost)."""
    return prep_read(session, ttx, reseed_eeg(session, ttx, user, locale))


@router.get("/ttx/{ttx_id}/conduct-prep/export/{kind}.pdf")
def conduct_prep_export_endpoint(
    kind: ExportKind,
    # A plain download link can't set Accept-Language to the app's own
    # language (the browser sends its own), so the page passes it here.
    lang: str | None = Query(None, pattern="^[a-z]{2}$"),
    header_locale: str = Depends(get_locale),
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> Response:
    """One of the session documents as a PDF (SitMan, Facilitator and
    Controller guide, inject cards, EEG, evaluation plan, participant
    feedback form), TLP-labelled and marked EXERCISE on every page;
    downloaded, never cached."""
    locale = lang if lang in settings.SUPPORTED_LOCALES else header_locale
    content, filename = render_conduct_prep_pdf(session, ttx, kind, locale)
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )
