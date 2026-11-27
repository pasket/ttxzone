"""The AI assistant's proposals to an organization (a new exercise, a
Library inject), for the pages that take them: each person sees and
decides only their own. Accepting fills the page's form; these routes
list the proposals and record the decision."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import get_current_user, verify_csrf
from app.models import Organization, User
from app.schemas.assistant import (
    AssistantOrgProposalListResponse,
    AssistantOrgProposalRead,
    AssistantProposalAppliedRequest,
    AssistantProposalDiscardRequest,
)
from app.services.actor_library_service import require_library_reader
from app.services.assistant import proposals_org
from app.services.organization_service import get_organization

router = APIRouter(
    prefix="/organizations/{organization_id}/assistant/proposals", tags=["assistant"]
)


def _organization(
    organization_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Organization:
    """Who can hold them: the organization's Program Managers and Planners."""
    require_library_reader(session, user, organization_id)
    return get_organization(session, organization_id)


@router.get("", response_model=AssistantOrgProposalListResponse)
def list_organization_proposals_endpoint(
    status: Literal["pending", "accepted", "discarded"] | None = Query("pending"),
    target: Literal["new_exercise", "library_inject"] | None = Query(None),
    organization: Organization = Depends(_organization),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantOrgProposalListResponse:
    """The AI assistant's proposals to this organization waiting for the caller."""
    items = proposals_org.list_for_author(
        session, organization.id, user, status=status, target=target
    )
    return AssistantOrgProposalListResponse(
        items=[AssistantOrgProposalRead.model_validate(p) for p in items]
    )


@router.post(
    "/{proposal_id}/applied",
    response_model=AssistantOrgProposalRead,
    dependencies=[Depends(verify_csrf)],
)
def mark_organization_proposal_applied_endpoint(
    proposal_id: uuid.UUID,
    payload: AssistantProposalAppliedRequest,
    organization: Organization = Depends(_organization),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantOrgProposalRead:
    """The form saved what the proposal became: recorded as accepted."""
    return AssistantOrgProposalRead.model_validate(
        proposals_org.mark_applied(session, organization, user, proposal_id, payload.row_id)
    )


@router.post(
    "/{proposal_id}/discard",
    response_model=AssistantOrgProposalRead,
    dependencies=[Depends(verify_csrf)],
)
def discard_organization_proposal_endpoint(
    proposal_id: uuid.UUID,
    payload: AssistantProposalDiscardRequest | None = None,
    organization: Organization = Depends(_organization),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> AssistantOrgProposalRead:
    """Discard one of the AI assistant's proposals, optionally saying why."""
    return AssistantOrgProposalRead.model_validate(
        proposals_org.discard(
            session,
            organization,
            user,
            proposal_id,
            reason=payload.reason if payload else None,
            note=payload.note if payload else "",
        )
    )
