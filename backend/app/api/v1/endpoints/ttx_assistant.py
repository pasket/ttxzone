"""The AI assistant's proposals on an exercise, for the pages that take
them (docs/features/ai-assistant.md#proposals): each person sees and
decides only their own. Accepting happens in the page's draft; these routes only
list the proposals and record the decision."""

import logging
import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    is_program_manager,
    verify_csrf,
)
from app.models import TTX, AssistantProposal, AssistantRequest, RoleEnum, TTXContextRole, User
from app.schemas.assistant import (
    AssistantProposalAppliedRequest,
    AssistantProposalDiscardRequest,
    AssistantProposalDiscardResponse,
    AssistantProposalListResponse,
    AssistantProposalRead,
    AssistantRequestCreate,
    AssistantRequestListResponse,
    AssistantRequestRead,
)
from app.services.after_action_service import can_write
from app.services.assistant import proposals, requests, switch

router = APIRouter(prefix="/ttx/{ttx_id}/assistant/proposals", tags=["assistant"])

_on_exercise = RequiresOrgAndTTXAccess(*TTXContextRole)


def _author(
    ttx: TTX = Depends(_on_exercise),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> TTX:
    """Who can hold proposals: a Planner, or the Lead Evaluator, who writes
    the after-action report. A Program Manager off the team reads the list,
    like the rest of the design, and gets no further than `_on_exercise`
    on a write."""
    if can_write(session, user, ttx) or is_program_manager(session, user, ttx.organization_id):
        return ttx
    raise AppException(
        "TTX_ACCESS_DENIED", "Only the exercise's Planners and Lead Evaluator hold proposals.", 403,
        ttx_id=str(ttx.id), log_level=logging.WARNING,
    )  # fmt: skip


def _read(proposal: AssistantProposal, outdated: bool = False) -> AssistantProposalRead:
    return AssistantProposalRead.model_validate({**proposal.model_dump(), "outdated": outdated})


@router.get("", response_model=AssistantProposalListResponse)
def list_proposals_endpoint(
    status: Literal["pending", "accepted", "discarded"] | None = Query("pending"),
    target: Literal[
        "need",
        "objective",
        "placeholders",
        "risk",
        "needs_scope",
        "needs_context",
        "needs_tlp",
        "ttx_meta",
        "inject",
        "msel_phase",
        "msel_actor",
        "msel_threat",
        "msel_meta",
        "msel_renumber",
        "eeg_point",
        "prep_texts",
        "aar_text",
        "aar_objective",
        "aar_action",
    ]
    | None = Query(None),
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantProposalListResponse:
    """The AI assistant's proposals waiting on this exercise."""
    items = proposals.list_for_author(session, ttx, user, status=status, target=target)
    rows = {
        kind: proposals.saved_rows(session, ttx, kind)
        for kind in {p.target for p in items if p.operation in ("update", "delete")}
    }
    return AssistantProposalListResponse(
        items=[_read(p, proposals.outdated(p, rows.get(p.target, {}))) for p in items]
    )


@router.post(
    "/{proposal_id}/applied",
    response_model=AssistantProposalRead,
    dependencies=[Depends(verify_csrf)],
)
def mark_applied_endpoint(
    proposal_id: uuid.UUID,
    payload: AssistantProposalAppliedRequest,
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantProposalRead:
    """The page saved the row it produced: recorded as accepted."""
    return _read(proposals.mark_applied(session, ttx, user, proposal_id, payload.row_id))


@router.post(
    "/{proposal_id}/discard",
    response_model=AssistantProposalDiscardResponse,
    dependencies=[Depends(verify_csrf)],
)
def discard_endpoint(
    proposal_id: uuid.UUID,
    payload: AssistantProposalDiscardRequest | None = None,
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantProposalDiscardResponse:
    """Discard one of the AI assistant's proposals, optionally saying why."""
    return AssistantProposalDiscardResponse(
        discarded=proposals.discard(
            session,
            ttx,
            user,
            proposal_id,
            reason=payload.reason if payload else None,
            note=payload.note if payload else "",
        )
    )


# --- Requests: what the person asks the assistant for from a page -------------

requests_router = APIRouter(prefix="/ttx/{ttx_id}/assistant/requests", tags=["assistant"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


def _request_read(request: AssistantRequest, codes: dict[str, str]) -> AssistantRequestRead:
    read = AssistantRequestRead.model_validate(request)
    read.row_code = codes.get(str(request.row_id)) if request.row_id else None
    return read


@requests_router.get("", response_model=AssistantRequestListResponse)
def list_requests_endpoint(
    status: Literal["open", "answered"] | None = Query("open"),
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantRequestListResponse:
    """What the caller asked the AI assistant for on this exercise."""
    items = requests.list_for_author(session, ttx, user, status=status)
    codes = proposals.row_codes(session, ttx) if any(r.row_id for r in items) else {}
    return AssistantRequestListResponse(
        items=[_request_read(r, codes) for r in items],
        enabled=switch.effective_enabled(session)
        and "planner" in switch.organization_roles(session, ttx.organization_id),
    )


@requests_router.post(
    "",
    response_model=AssistantRequestRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_request_endpoint(
    payload: AssistantRequestCreate,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantRequestRead:
    """Ask the AI assistant for something on a document or one of its rows:
    kept until the caller's own AI client reads it."""
    switch.require_enabled(session)
    switch.require_role(session, ttx.organization_id, "planner")
    request = requests.create(session, ttx, user, payload.section, payload.row_id, payload.note)
    codes = proposals.row_codes(session, ttx) if request.row_id else {}
    return _request_read(request, codes)


@requests_router.delete("/{request_id}", status_code=204, dependencies=[Depends(verify_csrf)])
def withdraw_request_endpoint(
    request_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Withdraw one of the caller's requests."""
    requests.withdraw(session, ttx, user, request_id)
