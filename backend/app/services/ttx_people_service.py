"""An exercise's people besides its Players, as one matrix (Creator ->
Exercise -> Planning, control and evaluation): its planning and control
team (TTXAccess PLANNER, with plans / controls / facilitates), Observers
and Evaluators. Each person holds one of those per exercise -- a team
member can also be its Evaluator and/or Observer (`evaluates` /
`observes`) -- and only what a Program Manager granted them in the
organization (an active OrganizationMembership of the same name). The team's own rules (a
Planner, a Controller, a lead who plans) live in ttx_planning_team_service
and apply here too."""

import logging
import uuid

from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import (
    TTX,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    TTXAccessTagAssignment,
    TTXTag,
    User,
    active_membership,
)
from app.services.ttx_conduct_prep_service import drop_evaluator
from app.services.ttx_observer_evaluator_service import _observer_or_evaluator
from app.services.ttx_planning_team_service import (
    _check_team_keeps_functions,
    _lock_team,
    _member_or_404,
    check_functions,
    check_lead_successor,
    lead_user_id,
    list_planning_team,
)
from app.services.ttx_tag_service import validate_tag_ids_belong_to_ttx

logger = logging.getLogger(__name__)

PEOPLE_ROLES = (RoleEnum.PLANNER, RoleEnum.OBSERVER, RoleEnum.EVALUATOR)
_GRANT_FOR = {
    RoleEnum.PLANNER: OrgRoleEnum.PLANNER,
    RoleEnum.OBSERVER: OrgRoleEnum.OBSERVER,
    RoleEnum.EVALUATOR: OrgRoleEnum.EVALUATOR,
}


def list_people(session: Session, ttx: TTX) -> list[tuple[TTXAccess, User]]:
    return list(
        session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == ttx.id, TTXAccess.role.in_(PEOPLE_ROLES))
            .order_by(TTXAccess.created_at, User.full_name)
        )
    )


def org_grants(
    session: Session, ttx: TTX, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[OrganizationMembership]]:
    """Each person's active grants in the exercise's organization."""
    result: dict[uuid.UUID, list[OrganizationMembership]] = {}
    if not user_ids:
        return result
    for membership in session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == ttx.organization_id,
            OrganizationMembership.user_id.in_(user_ids),
            active_membership(),
        )
    ):
        result.setdefault(membership.user_id, []).append(membership)
    return result


def list_candidates(session: Session, ttx: TTX) -> list[tuple[User, list[OrgRoleEnum]]]:
    """People of the organization not on the exercise yet, with the
    exercise roles their grants allow."""
    on_exercise = select(TTXAccess.user_id).where(TTXAccess.ttx_id == ttx.id)
    grants: dict[uuid.UUID, list[OrgRoleEnum]] = {}
    users: dict[uuid.UUID, User] = {}
    for membership, user in session.exec(
        select(OrganizationMembership, User)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(
            OrganizationMembership.organization_id == ttx.organization_id,
            OrganizationMembership.role.in_(list(_GRANT_FOR.values())),
            active_membership(),
            User.is_active,
            User.id.not_in(on_exercise),
        )
        .order_by(User.full_name)
    ):
        users[user.id] = user
        grants.setdefault(user.id, []).append(membership.role)
    return [(users[user_id], roles) for user_id, roles in grants.items()]


def _require_grant(session: Session, ttx: TTX, user_id: uuid.UUID, role: RoleEnum) -> None:
    granted = session.exec(
        select(OrganizationMembership.id).where(
            OrganizationMembership.organization_id == ttx.organization_id,
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.role == _GRANT_FOR[role],
            active_membership(),
        )
    ).first()
    if granted is None:
        raise AppException(
            f"NOT_ORG_{role.name}",
            "This person isn't granted that role in the organization. A Program Manager "
            "grants it in Admin -> Users and roles.",
            400,
            log_level=logging.WARNING,
        )


def access_or_404(session: Session, ttx: TTX, user_id: uuid.UUID) -> TTXAccess:
    access = session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == ttx.id,
            TTXAccess.user_id == user_id,
            TTXAccess.role.in_(PEOPLE_ROLES),
        )
    ).first()
    if access is None:
        raise AppException("NOT_ON_EXERCISE", "This person isn't on this exercise.", 404)
    return access


def set_role(
    session: Session,
    ttx: TTX,
    user_id: uuid.UUID,
    role: RoleEnum,
    plans: bool,
    controls: bool,
    facilitates: bool,
    actor_id: uuid.UUID,
    lead_successor_id: uuid.UUID | None = None,
    evaluates: bool = False,
    observes: bool = False,
) -> TTXAccess:
    """What someone is on the exercise: a team member (with their
    functions, and maybe also Evaluator / Observer), an Observer or an
    Evaluator. Moving off the team follows its rules (never the last
    Planner or Controller; a lead names who takes over). An Evaluator who
    stays one keeps the lead and their evaluation-plan assignments. Tags
    stay with the person."""
    if role not in PEOPLE_ROLES:
        raise AppException("INVALID_ROLE", "Not a role of this matrix.", 400)
    access = access_or_404(session, ttx, user_id)
    if role == RoleEnum.PLANNER:
        check_functions(plans, controls, facilitates)
        if evaluates and observes:
            _observer_or_evaluator()
    else:
        plans = controls = facilitates = evaluates = observes = False
    if role != access.role:
        _require_grant(session, ttx, user_id, role)
    # Also Evaluator / Observer: from the org grant of that name, like the
    # role itself (only checked when newly taken on).
    held = access.context_roles()
    for flag, extra in ((evaluates, RoleEnum.EVALUATOR), (observes, RoleEnum.OBSERVER)):
        if flag and extra.value not in held:
            _require_grant(session, ttx, user_id, extra)
    stays_evaluator = role == RoleEnum.EVALUATOR or (role == RoleEnum.PLANNER and evaluates)

    if access.role == RoleEnum.PLANNER:
        members = _lock_team(session, ttx)
        member = _member_or_404(members, user_id)
        _check_team_keeps_functions(members, member, plans=plans, controls=controls)
        if member.plans and not plans:
            team = list_planning_team(session, ttx)
            if lead_user_id(ttx, team) == user_id:
                ttx.lead_planner_id = check_lead_successor(team, user_id, lead_successor_id)
                session.add(ttx)
    if access.is_evaluator and not stays_evaluator:
        drop_evaluator(session, ttx.id, user_id)
        access.leads = False
    access.role = role
    access.plans = plans
    access.controls = controls
    access.facilitates = facilitates
    access.evaluates = evaluates
    access.observes = observes
    session.add(access)
    session.commit()
    session.refresh(access)
    logger.info(
        "User %s set to %s (plans=%s controls=%s facilitates=%s evaluates=%s observes=%s) "
        "on TTX %s by user %s.",
        user_id,
        role.value,
        plans,
        controls,
        facilitates,
        evaluates,
        observes,
        ttx.id,
        actor_id,
    )
    return access


def set_tags(
    session: Session, ttx: TTX, user_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> list[TTXTag]:
    """Full-replace the exercise's tags on one person of the matrix."""
    access = access_or_404(session, ttx, user_id)
    validate_tag_ids_belong_to_ttx(session, ttx.id, tag_ids)
    for row in session.exec(
        select(TTXAccessTagAssignment).where(TTXAccessTagAssignment.ttx_access_id == access.id)
    ):
        session.delete(row)
    session.flush()
    for tag_id in dict.fromkeys(tag_ids):
        session.add(TTXAccessTagAssignment(ttx_tag_id=tag_id, ttx_access_id=access.id))
    session.commit()
    return list(session.exec(select(TTXTag).where(TTXTag.id.in_(tag_ids)))) if tag_ids else []
