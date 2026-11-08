"""Creator -> Exercise: the exercise's people besides its Players, as one
matrix -- planning and control team, Observers, Evaluators. Planner-only
(design): reads and writes alike -- except a Program Manager joining an
exercise themselves (Admin -> Exercises). See ttx_people_service."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    require_not_archived,
    require_program_manager,
    verify_csrf,
)
from app.models import TTX, RoleEnum, User
from app.schemas.organization_tag import OrganizationTagRead
from app.schemas.ttx_people import (
    ExerciseJoinRequest,
    ExercisePeopleListResponse,
    ExercisePersonAddRequest,
    ExercisePersonCandidate,
    ExercisePersonCandidateListResponse,
    ExercisePersonRead,
    ExercisePersonRoleRequest,
    ExercisePersonTagsRequest,
)
from app.schemas.ttx_tag import TTXTagRead
from app.services import platform_audit_service
from app.services.organization_service import list_tags_for_planner_memberships
from app.services.ttx_observer_evaluator_service import add_assignee, remove_assignee
from app.services.ttx_people_service import (
    access_or_404,
    list_candidates,
    list_people,
    org_grants,
    set_role,
    set_tags,
)
from app.services.ttx_planning_team_service import (
    add_planning_team_member,
    lead_user_id,
    list_planning_team,
    list_tags_for_accesses,
    remove_planning_team_member,
)

router = APIRouter(prefix="/ttx", tags=["ttx-people"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/{ttx_id}/people", response_model=ExercisePeopleListResponse)
def list_people_endpoint(
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> ExercisePeopleListResponse:
    """Everyone on the exercise except its Players."""
    rows = list_people(session, ttx)
    lead = lead_user_id(ttx, list_planning_team(session, ttx))
    tags_by_access = list_tags_for_accesses(session, [access.id for access, _ in rows])
    grants = org_grants(session, ttx, [user.id for _, user in rows])
    org_tags_by_membership = list_tags_for_planner_memberships(
        session, [m.id for memberships in grants.values() for m in memberships]
    )
    items = []
    for access, user in rows:
        org_tags = {
            tag.id: tag
            for m in grants.get(user.id, [])
            for tag in org_tags_by_membership.get(m.id, [])
        }
        items.append(
            ExercisePersonRead(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                added_at=access.created_at,
                last_login_at=user.last_login_at,
                role=access.role.value,
                plans=access.plans,
                controls=access.controls,
                facilitates=access.facilitates,
                evaluates=access.evaluates,
                observes=access.observes,
                is_lead=user.id == lead,
                leads=access.leads,
                grants=[
                    m.role.value
                    for m in grants.get(user.id, [])
                    if m.role.value in ("planner", "observer", "evaluator")
                ],
                org_tags=[OrganizationTagRead.model_validate(t) for t in org_tags.values()],
                tags=[TTXTagRead.model_validate(t) for t in tags_by_access.get(access.id, [])],
            )
        )
    return ExercisePeopleListResponse(items=items)


@router.get("/{ttx_id}/people/candidates", response_model=ExercisePersonCandidateListResponse)
def list_people_candidates_endpoint(
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> ExercisePersonCandidateListResponse:
    """Who can be added to the exercise's team."""
    return ExercisePersonCandidateListResponse(
        items=[
            ExercisePersonCandidate(
                user_id=user.id,
                email=user.email,
                full_name=user.full_name,
                grants=[role.value for role in roles],
            )
            for user, roles in list_candidates(session, ttx)
        ]
    )


@router.post("/{ttx_id}/people", status_code=201, dependencies=[Depends(verify_csrf)])
def add_person_endpoint(
    payload: ExercisePersonAddRequest,
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """Add a person to the exercise's team."""
    if payload.role == "planner":
        _, target = add_planning_team_member(
            session,
            ttx,
            payload.email,
            user.id,
            plans=payload.plans,
            controls=payload.controls,
            facilitates=payload.facilitates,
        )
    else:
        _, target = add_assignee(session, ttx, payload.email, RoleEnum(payload.role), user.id)
    return {"user_id": str(target.id)}


@router.post(
    "/{ttx_id}/people/me",
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def join_exercise_endpoint(
    ttx_id: uuid.UUID,
    payload: ExerciseJoinRequest,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> dict:
    """A Program Manager of the exercise's organization takes a seat on it
    themselves -- its planning and control team, or its Observer or
    Evaluator -- from their organization grant of that name, under the
    same rules as anyone the team adds. Their oversight reads every
    exercise; this is how they start working on one. Guarded here, like
    DELETE /ttx/{ttx_id}: the caller has no seat yet. No step-up: the
    activity log records who took which seat."""
    ttx = session.get(TTX, ttx_id)
    if ttx is None:
        raise HTTPException(status_code=404, detail="TTX not found.")
    require_program_manager(session, user, ttx.organization_id)
    require_not_archived(ttx)
    if payload.role == "planner":
        add_planning_team_member(
            session,
            ttx,
            user.email,
            user.id,
            plans=payload.plans,
            controls=payload.controls,
            facilitates=payload.facilitates,
        )
    else:
        add_assignee(session, ttx, user.email, RoleEnum(payload.role), user.id)
    platform_audit_service.record_exercise(
        session,
        user,
        "exercise.member_joined",
        ttx,
        {
            "role": payload.role,
            **(
                {
                    "plans": payload.plans,
                    "controls": payload.controls,
                    "facilitates": payload.facilitates,
                }
                if payload.role == "planner"
                else {}
            ),
        },
    )
    return {"user_id": str(user.id)}


@router.put("/{ttx_id}/people/{user_id}/role", status_code=204, dependencies=[Depends(verify_csrf)])
def set_person_role_endpoint(
    user_id: uuid.UUID,
    payload: ExercisePersonRoleRequest,
    # Required when the Lead Planner stops planning: who takes over.
    lead_successor_id: uuid.UUID | None = Query(None),
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Set what a person does on the exercise."""
    set_role(
        session,
        ttx,
        user_id,
        RoleEnum(payload.role),
        payload.plans,
        payload.controls,
        payload.facilitates,
        user.id,
        lead_successor_id,
        evaluates=payload.evaluates,
        observes=payload.observes,
    )


@router.put(
    "/{ttx_id}/people/{user_id}/tags",
    response_model=list[TTXTagRead],
    dependencies=[Depends(verify_csrf)],
)
def set_person_tags_endpoint(
    user_id: uuid.UUID,
    payload: ExercisePersonTagsRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> list[TTXTagRead]:
    """Set a person's tags on the exercise."""
    return [TTXTagRead.model_validate(t) for t in set_tags(session, ttx, user_id, payload.tag_ids)]


@router.delete("/{ttx_id}/people/{user_id}", status_code=204, dependencies=[Depends(verify_csrf)])
def remove_person_endpoint(
    user_id: uuid.UUID,
    # Required when removing the Lead Planner: who takes over.
    lead_successor_id: uuid.UUID | None = Query(None),
    ttx: TTX = Depends(_planner),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Remove a person from the exercise's team."""
    access = access_or_404(session, ttx, user_id)
    if access.role == RoleEnum.PLANNER:
        remove_planning_team_member(session, ttx, user_id, user.id, lead_successor_id)
    else:
        remove_assignee(session, ttx, user_id, access.role, user.id)
