"""The editable after-action report (AAR) and improvement plan of an
exercise -- written by its Planners and Lead Evaluator, read by its
Controllers and the organization's Program Managers -- and the
organization-wide improvement plan for its Program Managers."""

import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, Response
from sqlmodel import Session

from app.api.v1.endpoints.organizations import require_program_manager_of
from app.core.config import settings
from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    verify_csrf,
)
from app.models import TTX, ImprovementStatus, RoleEnum, TTXContextRole, User
from app.schemas.after_action import (
    AarCreateRequest,
    AarPreviewRead,
    AarRead,
    AarRunChangeRequest,
    AarSaveRequest,
    AarTransitionRequest,
    ImprovementFollowUpRequest,
    ImprovementPlanListResponse,
    ImprovementPlanRow,
    RetestCandidate,
    RetestedAction,
    RetestRequest,
)
from app.services import platform_audit_service
from app.services.after_action_service import (
    can_write,
    candidates_for_action,
    change_run,
    create_report,
    follow_up,
    get_report,
    link_retest_as_program_manager,
    organization_action_candidates,
    organization_plan,
    preview_report,
    retested_by,
    save_report,
    transition,
)
from app.services.run_export_service import render_report_pdf

router = APIRouter(tags=["after-action"])

# Anyone on the exercise gets past the route; the service decides who
# reads (authors, Controllers, Program Managers) and who writes.
_on_exercise = RequiresOrgAndTTXAccess(*TTXContextRole)
# The improvement plan is followed up after the exercise is archived.
_on_archived_exercise = RequiresOrgAndTTXAccess(*TTXContextRole, allow_archived=True)


def _require_author(session: Session, user: User, ttx: TTX) -> TTX:
    if not can_write(session, user, ttx):
        raise AppException(
            "TTX_ACCESS_DENIED", "Only the exercise's Planners and Lead Evaluator write it.", 403,
            ttx_id=str(ttx.id), log_level=logging.WARNING,
        )  # fmt: skip
    return ttx


def _author(
    ttx: TTX = Depends(_on_exercise),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTX:
    """A Planner or the Lead Evaluator of the exercise -- checked before the
    body is, like every design route."""
    return _require_author(session, user, ttx)


def _follow_up_author(
    ttx: TTX = Depends(_on_archived_exercise),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTX:
    """An author following the improvement plan up, archived or not."""
    return _require_author(session, user, ttx)


@router.get("/ttx/{ttx_id}/aar", response_model=AarRead)
def get_report_endpoint(
    ttx: TTX = Depends(_on_exercise),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AarRead:
    """The exercise's after-action report and improvement plan."""
    return get_report(session, ttx, user)


@router.get("/ttx/{ttx_id}/aar/preview", response_model=AarPreviewRead)
def preview_report_endpoint(
    ttx: TTX = Depends(_on_exercise),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AarPreviewRead:
    """What the report will hold, for the screen shown before it exists."""
    return preview_report(session, ttx, user)


@router.post(
    "/ttx/{ttx_id}/aar",
    response_model=AarRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_report_endpoint(
    payload: AarCreateRequest | None = None,
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AarRead:
    """Start the report from a session -- the one chosen, else the current
    one, else the latest archived (409 before any has started)."""
    return create_report(session, ttx, user, payload.run_id if payload else None)


@router.put("/ttx/{ttx_id}/aar", response_model=AarRead, dependencies=[Depends(verify_csrf)])
def save_report_endpoint(
    payload: AarSaveRequest,
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AarRead:
    """Save the after-action report as a whole."""
    return save_report(session, ttx, user, payload)


@router.post("/ttx/{ttx_id}/aar/run", response_model=AarRead, dependencies=[Depends(verify_csrf)])
def change_run_endpoint(
    payload: AarRunChangeRequest,
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AarRead:
    """Write the report from another session of the exercise: what's
    written stays (409 if an objective that session's plan lacks holds
    text or actions)."""
    return change_run(session, ttx, user, payload.run_id, payload.revision)


@router.post(
    "/ttx/{ttx_id}/aar/transitions",
    response_model=AarRead,
    dependencies=[Depends(verify_csrf)],
)
def transition_endpoint(
    payload: AarTransitionRequest,
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AarRead:
    """Mark the report FINAL (a snapshot of this version) or reopen it. No
    step-up: the activity log records who did it."""
    report = transition(session, ttx, user, payload.to)
    platform_audit_service.record_exercise(
        session,
        user,
        "exercise.aar_final" if payload.to == "final" else "exercise.aar_reopened",
        ttx,
        {"version": report.version},
    )
    return report


@router.patch(
    "/ttx/{ttx_id}/aar/actions/{code}",
    response_model=AarRead,
    dependencies=[Depends(verify_csrf)],
)
def follow_up_endpoint(
    code: str,
    payload: ImprovementFollowUpRequest,
    ttx: TTX = Depends(_follow_up_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AarRead:
    """An improvement action's status, note and due date -- never reopens."""
    sent = payload.model_fields_set
    retest = (
        (payload.retest_ttx_id, payload.retest_objective_id)
        if {"retest_ttx_id", "retest_objective_id"} & sent
        else None
    )
    return follow_up(
        session, ttx, user, code, payload.status, payload.status_note, payload.due_date, retest
    )


@router.get("/ttx/{ttx_id}/aar/retest-candidates", response_model=list[RetestCandidate])
def retest_candidates_endpoint(
    ttx: TTX = Depends(_follow_up_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[RetestCandidate]:
    """The later exercises of the organization that can re-test this
    report's actions: code, name and objectives only."""
    return candidates_for_action(session, user, ttx)


@router.get("/ttx/{ttx_id}/retests", response_model=list[RetestedAction])
def retests_endpoint(
    ttx: TTX = Depends(
        RequiresOrgAndTTXAccess(
            RoleEnum.PLANNER, TTXContextRole.CONTROLLER, TTXContextRole.EVALUATOR
        )
    ),
    session: Session = Depends(get_session),
) -> list[RetestedAction]:
    """The improvement actions of earlier exercises this one re-tests."""
    return retested_by(session, ttx)


@router.get("/ttx/{ttx_id}/aar/export.pdf")
def report_pdf_endpoint(
    lang: str | None = Query(None, pattern="^[a-z]{2}$"),
    header_locale: str = Depends(get_locale),
    ttx: TTX = Depends(_on_exercise),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """The report and its improvement plan as a PDF (DRAFT until final)."""
    get_report(session, ttx, user)  # who may read it, and that it exists
    locale = lang if lang in settings.SUPPORTED_LOCALES else header_locale
    content, filename = render_report_pdf(session, ttx, locale)
    return Response(
        content,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get(
    "/organizations/{organization_id}/improvement-plan",
    response_model=ImprovementPlanListResponse,
)
def organization_plan_endpoint(
    status: ImprovementStatus | None = Query(None),
    overdue: bool = Query(False),
    q: str | None = Query(None, max_length=200),
    retest: Literal["linked", "unlinked"] | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> ImprovementPlanListResponse:
    """Every improvement action of the organization's exercises."""
    return organization_plan(
        session,
        organization_id,
        status=status,
        overdue=overdue,
        q=q,
        limit=limit,
        offset=offset,
        retest=retest,
    )


@router.get(
    "/organizations/{organization_id}/improvement-plan/{action_id}/retest-candidates",
    response_model=list[RetestCandidate],
)
def organization_retest_candidates_endpoint(
    action_id: uuid.UUID,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> list[RetestCandidate]:
    """The organization's exercises that can re-test this improvement action."""
    return organization_action_candidates(session, organization_id, action_id)


@router.put(
    "/organizations/{organization_id}/improvement-plan/{action_id}/retest",
    response_model=ImprovementPlanRow,
    dependencies=[Depends(verify_csrf)],
)
def organization_retest_endpoint(
    action_id: uuid.UUID,
    payload: RetestRequest,
    organization_id: uuid.UUID = Depends(require_program_manager_of),
    session: Session = Depends(get_session),
) -> ImprovementPlanRow:
    """Which later exercise re-tests an action of any of the organization's
    reports -- the Program Manager follows the plan up."""
    return link_retest_as_program_manager(
        session, organization_id, action_id, payload.retest_ttx_id, payload.retest_objective_id
    )
