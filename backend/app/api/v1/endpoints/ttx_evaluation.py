"""Evaluation: the EEG and who may use it, plus the exercise's Observers
and Evaluators. The EEG is readable by the exercise's Planners,
Controllers and Evaluators; only Planners assign Observers and Evaluators
(from the organization's grants). Neither reaches anything else about the
exercise -- every design endpoint is Planner-only."""

import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import RequiresOrgAndTTXAccess, get_current_user, verify_csrf
from app.models import TTX, RoleEnum, TTXContextRole, User
from app.schemas.ttx_evaluation import (
    EEGRead,
    EvaluatorGrantRequest,
    EvaluatorListResponse,
    EvaluatorRead,
    LeadEvaluatorRequest,
)
from app.schemas.ttx_planning_team import PlanningTeamCandidate, PlanningTeamCandidateListResponse
from app.services.eeg_service import build_eeg
from app.services.ttx_observer_evaluator_service import (
    add_assignee,
    clear_lead_evaluator,
    list_assignee_candidates,
    list_assignees,
    remove_assignee,
    set_lead_evaluator,
)

router = APIRouter(prefix="/ttx", tags=["ttx-evaluation"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)
_eeg_readers = RequiresOrgAndTTXAccess(
    RoleEnum.PLANNER, TTXContextRole.CONTROLLER, RoleEnum.EVALUATOR
)


def _assignee_read(access, user) -> EvaluatorRead:
    return EvaluatorRead(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        added_at=access.created_at,
        last_login_at=user.last_login_at,
        leads=access.leads,
    )


@router.get("/{ttx_id}/eeg", response_model=EEGRead)
def get_eeg_endpoint(
    ttx: TTX = Depends(_eeg_readers),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> EEGRead:
    """The exercise's Exercise Evaluation Guide."""
    return build_eeg(session, ttx, user)


# Registered before the assignee routes: `/evaluators/{user_id}` would
# otherwise catch `/evaluators/lead` and reject "lead" as a UUID.
@router.put("/{ttx_id}/evaluators/lead", status_code=204, dependencies=[Depends(verify_csrf)])
def set_lead_evaluator_endpoint(
    payload: LeadEvaluatorRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Make an Evaluator the exercise's Lead Evaluator."""
    set_lead_evaluator(session, ttx, payload.user_id, user.id)


@router.delete("/{ttx_id}/evaluators/lead", status_code=204, dependencies=[Depends(verify_csrf)])
def clear_lead_evaluator_endpoint(
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Clear the exercise's Lead Evaluator."""
    clear_lead_evaluator(session, ttx, user.id)


def _register_assignee_routes(segment: str, role: RoleEnum) -> None:
    @router.get(f"/{{ttx_id}}/{segment}", response_model=EvaluatorListResponse)
    def list_assignees_endpoint(
        ttx: TTX = Depends(_planner),
        session: Session = Depends(get_session),
    ) -> EvaluatorListResponse:
        """The people assigned to the exercise in this role."""
        return EvaluatorListResponse(
            items=[
                _assignee_read(access, user) for access, user in list_assignees(session, ttx, role)
            ]
        )

    @router.get(
        f"/{{ttx_id}}/{segment}/candidates", response_model=PlanningTeamCandidateListResponse
    )
    def list_assignee_candidates_endpoint(
        ttx: TTX = Depends(_planner),
        session: Session = Depends(get_session),
    ) -> PlanningTeamCandidateListResponse:
        """Who can be assigned to the exercise in this role."""
        return PlanningTeamCandidateListResponse(
            items=[
                PlanningTeamCandidate(user_id=u.id, email=u.email, full_name=u.full_name)
                for u in list_assignee_candidates(session, ttx, role)
            ]
        )

    @router.post(
        f"/{{ttx_id}}/{segment}",
        response_model=EvaluatorRead,
        status_code=201,
        dependencies=[Depends(verify_csrf)],
    )
    def add_assignee_endpoint(
        payload: EvaluatorGrantRequest,
        ttx: TTX = Depends(_planner),
        user: User = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> EvaluatorRead:
        """Assign a person to the exercise in this role."""
        access, target = add_assignee(session, ttx, payload.email, role, user.id)
        return _assignee_read(access, target)

    @router.delete(
        f"/{{ttx_id}}/{segment}/{{user_id}}",
        status_code=204,
        dependencies=[Depends(verify_csrf)],
    )
    def remove_assignee_endpoint(
        user_id: uuid.UUID,
        ttx: TTX = Depends(_planner),
        user: User = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> None:
        """Remove this role's assignment from a person on the exercise."""
        remove_assignee(session, ttx, user_id, role, user.id)


_register_assignee_routes("evaluators", RoleEnum.EVALUATOR)
_register_assignee_routes("observers", RoleEnum.OBSERVER)
