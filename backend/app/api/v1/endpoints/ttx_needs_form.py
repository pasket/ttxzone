"""Creator -> Needs: the exercise's needs & objectives form. Planners
of the exercise read and edit it, a Program Manager of its organization
reads it (RequiresOrgAndTTXAccess, reads only); Players never
see it -- it describes the organization's risks and gaps."""

import uuid
from dataclasses import asdict

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import Session

from app.core.config import settings
from app.core.db import get_session
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    verify_csrf,
)
from app.data.objective_catalog import OBJECTIVE_CATALOG
from app.data.regulatory_catalog import (
    FRAMEWORK_CATALOG,
    NOTIFICATION_MILESTONES,
    REGULATORY_CATALOG,
)
from app.data.risk_catalog import RISK_CATALOG
from app.models import TTX, NeedsFormStatus, RoleEnum, User
from app.schemas.ttx_needs_form import (
    NeedsFormApprovalRequest,
    NeedsFormRead,
    NeedsFormRenumberRead,
    NeedsFormRenumberRequest,
    NeedsFormSaveRequest,
    NeedsFormTransitionRequest,
    NotificationMilestoneRead,
    ObjectiveCatalogResponse,
    ObjectiveTemplateRead,
    RegulatoryCatalogResponse,
    RegulatoryFrameworkRead,
    RegulatoryRequirementRead,
    RiskCatalogResponse,
    RiskTemplateRead,
    ValidationReport,
)
from app.services import platform_audit_service
from app.services.needs_markdown_service import render_needs_markdown
from app.services.needs_pdf_service import render_needs_pdf
from app.services.ttx_needs_form_service import (
    add_evidence,
    draft_report,
    form_read,
    get_evidence,
    get_form,
    record_approval,
    remove_approval,
    remove_evidence,
    renumber,
    save_form,
    transition,
)

router = APIRouter(tags=["ttx-needs-form"])

_manager = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/ttx/{ttx_id}/needs-form", response_model=NeedsFormRead)
def get_needs_form_endpoint(
    ttx: TTX = Depends(_manager),
    session: Session = Depends(get_session),
) -> NeedsFormRead:
    """The exercise's needs analysis, with its validation report."""
    return form_read(session, ttx, get_form(session, ttx.id))


@router.put(
    "/ttx/{ttx_id}/needs-form",
    response_model=NeedsFormRead,
    dependencies=[Depends(verify_csrf)],
)
def save_needs_form_endpoint(
    payload: NeedsFormSaveRequest,
    ttx: TTX = Depends(_manager),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NeedsFormRead:
    """Save the needs analysis as a whole."""
    return form_read(session, ttx, save_form(session, ttx, payload, user))


@router.post(
    "/ttx/{ttx_id}/needs-form/validate",
    response_model=ValidationReport,
    dependencies=[Depends(verify_csrf)],
)
def validate_needs_form_endpoint(
    payload: NeedsFormSaveRequest,
    ttx: TTX = Depends(_manager),
    session: Session = Depends(get_session),
) -> ValidationReport:
    """Dry run: the report this payload would produce. Saves nothing."""
    return draft_report(session, ttx, payload)


@router.post(
    "/ttx/{ttx_id}/needs-form/renumber",
    response_model=NeedsFormRenumberRead,
    dependencies=[Depends(verify_csrf)],
)
def renumber_needs_form_endpoint(
    payload: NeedsFormRenumberRequest,
    ttx: TTX = Depends(_manager),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NeedsFormRenumberRead:
    """Renumber needs (creation order) or objectives (needs order) while the form is a first
    draft (or undo it with `codes`); no step-up: reversible."""
    form, previous = renumber(session, ttx, payload.kind, payload.codes, user)
    return NeedsFormRenumberRead(form=form_read(session, ttx, form), previous=previous)


@router.post(
    "/ttx/{ttx_id}/needs-form/transitions",
    response_model=NeedsFormRead,
    dependencies=[Depends(verify_csrf)],
)
def transition_needs_form_endpoint(
    payload: NeedsFormTransitionRequest,
    ttx: TTX = Depends(_manager),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NeedsFormRead:
    """Move the needs analysis to another status. Approving it needs no
    step-up: the signed-in session and the activity log are the control."""
    form = transition(session, ttx, payload.to, user)
    if payload.to == NeedsFormStatus.APPROVED:
        platform_audit_service.record_exercise(session, user, "exercise.needs_approved", ttx)
    return form_read(session, ttx, form)


@router.post(
    "/ttx/{ttx_id}/needs-form/approvals",
    response_model=NeedsFormRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def record_approval_endpoint(
    payload: NeedsFormApprovalRequest,
    ttx: TTX = Depends(_manager),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NeedsFormRead:
    """Record an approval of the needs analysis (no step-up; audited)."""
    form = record_approval(session, ttx, payload, user)
    platform_audit_service.record_exercise(
        session,
        user,
        "exercise.needs_approval_recorded",
        ttx,
        {"approver_kind": payload.approver_kind, "approved_on": payload.approved_on.isoformat()},
    )
    return form_read(session, ttx, form)


@router.delete(
    "/ttx/{ttx_id}/needs-form/approvals/{approval_id}",
    response_model=NeedsFormRead,
    dependencies=[Depends(verify_csrf)],
)
def remove_approval_endpoint(
    approval_id: uuid.UUID,
    ttx: TTX = Depends(_manager),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NeedsFormRead:
    """Remove a recorded approval of the needs analysis."""
    return form_read(session, ttx, remove_approval(session, ttx, approval_id, user))


@router.post(
    "/ttx/{ttx_id}/needs-form/approvals/{approval_id}/evidence",
    response_model=NeedsFormRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def add_evidence_endpoint(
    approval_id: uuid.UUID,
    file: UploadFile = File(...),
    ttx: TTX = Depends(_manager),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NeedsFormRead:
    """Attach a file of evidence to an approval."""
    return form_read(session, ttx, add_evidence(session, ttx, approval_id, file, user))


@router.get("/ttx/{ttx_id}/needs-form/approvals/{approval_id}/evidence/{evidence_id}")
def download_evidence_endpoint(
    approval_id: uuid.UUID,
    evidence_id: uuid.UUID,
    ttx: TTX = Depends(_manager),
    session: Session = Depends(get_session),
) -> FileResponse:
    """Always as an attachment, with the allowlisted content type: the
    browser saves it rather than rendering it in the app's origin."""
    evidence, path = get_evidence(session, ttx, approval_id, evidence_id)
    return FileResponse(
        path,
        media_type=evidence.content_type,
        filename=evidence.original_filename,
        content_disposition_type="attachment",
        headers={"Cache-Control": "private, no-store"},
    )


@router.delete(
    "/ttx/{ttx_id}/needs-form/approvals/{approval_id}/evidence/{evidence_id}",
    response_model=NeedsFormRead,
    dependencies=[Depends(verify_csrf)],
)
def remove_evidence_endpoint(
    approval_id: uuid.UUID,
    evidence_id: uuid.UUID,
    ttx: TTX = Depends(_manager),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> NeedsFormRead:
    """Remove a file of evidence from an approval."""
    return form_read(session, ttx, remove_evidence(session, ttx, approval_id, evidence_id, user))


@router.get("/ttx/{ttx_id}/needs-form/pdf")
def needs_form_pdf_endpoint(
    # A plain download link can't set Accept-Language to the app's own
    # language (the browser sends its own), so the page passes it here.
    lang: str | None = Query(None, pattern="^[a-z]{2}$"),
    header_locale: str = Depends(get_locale),
    ttx: TTX = Depends(_manager),
    session: Session = Depends(get_session),
) -> Response:
    """The needs analysis as a PDF with signature blocks, in the caller's
    language, TLP-labelled on every page; downloaded, never cached."""
    locale = lang if lang in settings.SUPPORTED_LOCALES else header_locale
    content, filename = render_needs_pdf(session, ttx, locale)
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/ttx/{ttx_id}/needs-form/export.md")
def export_needs_form_markdown(
    lang: str | None = Query(None, pattern="^[a-z]{2}$"),
    header_locale: str = Depends(get_locale),
    ttx: TTX = Depends(_manager),
    session: Session = Depends(get_session),
) -> Response:
    """The needs analysis as Markdown, same sections and copy as the PDF;
    downloaded, never cached (it carries the form's TLP)."""
    locale = lang if lang in settings.SUPPORTED_LOCALES else header_locale
    content, filename = render_needs_markdown(session, ttx, locale)
    return Response(
        content,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


@router.get("/regulatory-requirements", response_model=RegulatoryCatalogResponse)
def regulatory_catalog_endpoint(
    _user: User = Depends(get_current_user),
) -> RegulatoryCatalogResponse:
    """The regulatory frameworks and requirements catalog."""
    return RegulatoryCatalogResponse(
        items=[
            RegulatoryRequirementRead(
                id=r.id,
                framework=r.framework,
                reference=r.reference,
                description_en=r.description_en,
                description_es=r.description_es,
                notifications=[
                    NotificationMilestoneRead(**asdict(m))
                    for m in NOTIFICATION_MILESTONES.get(r.id, ())
                ],
            )
            for r in REGULATORY_CATALOG
        ],
        frameworks=[
            RegulatoryFrameworkRead(
                id=f.id,
                label_en=f.label_en,
                label_es=f.label_es,
                jurisdiction=f.jurisdiction.value,
                name_en=f.name_en,
                name_es=f.name_es,
                scope_en=f.scope_en,
                scope_es=f.scope_es,
                requires_exercises=f.requires_exercises,
                binding=f.binding,
                rationale_en=f.rationale_en,
                rationale_es=f.rationale_es,
                rationale_reference=f.rationale_reference,
            )
            for f in FRAMEWORK_CATALOG
        ],
    )


@router.get("/objective-catalog", response_model=ObjectiveCatalogResponse)
def objective_catalog_endpoint(
    _user: User = Depends(get_current_user),
) -> ObjectiveCatalogResponse:
    """TTX-Zone's SMART objective templates by capability (product content,
    the same for everyone, like the regulatory catalog)."""
    return ObjectiveCatalogResponse(
        items=[
            ObjectiveTemplateRead(
                id=o.id,
                capability=o.capability,
                title_en=o.title_en,
                title_es=o.title_es,
                statement_en=o.statement_en,
                statement_es=o.statement_es,
                criterion_en=list(o.criterion_en),
                criterion_es=list(o.criterion_es),
                evidence_en=list(o.evidence_en),
                evidence_es=list(o.evidence_es),
                regulatory_requirement_ids=list(o.regulatory_requirement_ids),
                time_box_minutes=o.time_box_minutes,
            )
            for o in OBJECTIVE_CATALOG
        ]
    )


@router.get("/risk-catalog", response_model=RiskCatalogResponse)
def risk_catalog_endpoint(
    _user: User = Depends(get_current_user),
) -> RiskCatalogResponse:
    """TTX-Zone's library of risks to an exercise and their usual mitigations."""
    return RiskCatalogResponse(
        items=[
            RiskTemplateRead(
                id=r.id,
                category=r.category.value,
                risk_en=r.risk_en,
                risk_es=r.risk_es,
                mitigation_en=r.mitigation_en,
                mitigation_es=r.mitigation_es,
                default=r.default,
            )
            for r in RISK_CATALOG
        ]
    )
