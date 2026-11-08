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
from app.models import TTX, AssistantProposal, TTXContextRole, User
from app.schemas.assistant import (
    AssistantProposalAppliedRequest,
    AssistantProposalDiscardResponse,
    AssistantProposalListResponse,
    AssistantProposalRead,
)
from app.services.after_action_service import can_write
from app.services.assistant import proposals

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
        "needs_scope",
        "needs_tlp",
        "ttx_meta",
        "inject",
        "msel_phase",
        "msel_actor",
        "msel_threat",
        "msel_meta",
        "msel_renumber",
        "eeg_point",
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
    ttx: TTX = Depends(_author),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantProposalDiscardResponse:
    """Discard one of the AI assistant's proposals."""
    return AssistantProposalDiscardResponse(
        discarded=proposals.discard(session, ttx, user, proposal_id)
    )
