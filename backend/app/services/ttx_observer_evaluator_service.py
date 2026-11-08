"""An exercise's Observers and Evaluators: who watches it (Observer) or
rates it with the EEG (Evaluator), with no access to its design. A
Program Manager first grants the role in the organization (Admin -> Users
and roles); a Planner of the exercise then assigns it from those grants.
No domain allowlist check on either step -- they are often outside
auditors, and neither role can change anything. A user holds one row per
exercise: a member of the planning and control team is made Evaluator /
Observer through flags on their row (`evaluates`, `observes`), the usual
Controller/Evaluator of a small exercise; anyone else gets a row of that
role."""

import logging
import uuid

from sqlalchemy import or_
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import (
    TTX,
    OrganizationMembership,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    User,
    active_membership,
    evaluator_access,
    observer_access,
)
from app.services.ttx_planning_team_service import _delete_access_with_tags

logger = logging.getLogger(__name__)

# The exercise roles assigned from an org grant of the same name.
ASSIGNABLE_ROLES = {
    RoleEnum.OBSERVER: OrgRoleEnum.OBSERVER,
    RoleEnum.EVALUATOR: OrgRoleEnum.EVALUATOR,
}
_LABEL = {RoleEnum.OBSERVER: "Observer", RoleEnum.EVALUATOR: "Evaluator"}
# Whole messages, not a label put into one: each is translated as written.
_NOT_ORG_MEMBER = {
    RoleEnum.OBSERVER: (
        "NOT_ORG_OBSERVER",
        "Only Observers of this organization can be added. A Program Manager grants that "
        "role in Admin -> Users and roles.",
    ),
    RoleEnum.EVALUATOR: (
        "NOT_ORG_EVALUATOR",
        "Only Evaluators of this organization can be added. A Program Manager grants that "
        "role in Admin -> Users and roles.",
    ),
}
_NOT_ON_EXERCISE = {
    RoleEnum.OBSERVER: ("OBSERVER_NOT_FOUND", "Observer not found on this exercise."),
    RoleEnum.EVALUATOR: ("EVALUATOR_NOT_FOUND", "Evaluator not found on this exercise."),
}
# The team-member flag that makes a PLANNER row act as the role.
_FLAG = {RoleEnum.OBSERVER: "observes", RoleEnum.EVALUATOR: "evaluates"}


def acting_as(role: RoleEnum):
    """The rows that act as `role` (Evaluator / Observer) on an exercise."""
    return evaluator_access() if role == RoleEnum.EVALUATOR else observer_access()


def list_assignees(session: Session, ttx: TTX, role: RoleEnum) -> list[tuple[TTXAccess, User]]:
    return list(
        session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == ttx.id, acting_as(role))
            .order_by(TTXAccess.created_at, User.full_name)
        )
    )


def list_assignee_candidates(session: Session, ttx: TTX, role: RoleEnum) -> list[User]:
    """The organization's holders of the matching grant who can still take
    it here: not on this exercise, or on its planning and control team
    without it yet -- what the add form suggests."""
    on_exercise = select(TTXAccess.user_id).where(
        TTXAccess.ttx_id == ttx.id,
        or_(TTXAccess.role != RoleEnum.PLANNER, getattr(TTXAccess, _FLAG[role])),
    )
    return list(
        session.exec(
            select(User)
            .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
            .where(
                OrganizationMembership.organization_id == ttx.organization_id,
                OrganizationMembership.role == ASSIGNABLE_ROLES[role],
                active_membership(),
                User.is_active,
                User.id.not_in(on_exercise),
            )
            .order_by(User.full_name)
        )
    )


def add_assignee(
    session: Session, ttx: TTX, email: str, role: RoleEnum, actor_id: uuid.UUID
) -> tuple[TTXAccess, User]:
    target = session.exec(
        select(User)
        .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
        .where(
            User.email == email.lower(),
            User.is_active,
            OrganizationMembership.organization_id == ttx.organization_id,
            OrganizationMembership.role == ASSIGNABLE_ROLES[role],
            active_membership(),
        )
    ).first()
    if target is None:
        # Same answer for "no account" and "no grant here", so the form
        # can't be used to probe which emails have accounts.
        code, message = _NOT_ORG_MEMBER[role]
        raise AppException(
            code,
            message,
            400,
            log_level=logging.WARNING,
        )
    existing = session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == target.id)
    ).first()
    if existing is not None and (
        existing.role != RoleEnum.PLANNER or getattr(existing, _FLAG[role])
    ):
        raise AppException(
            "ALREADY_ON_EXERCISE",
            "This person already has a role on this exercise.",
            409,
            log_level=logging.WARNING,
        )
    if existing is not None and (existing.evaluates or existing.observes):
        _observer_or_evaluator()
    if existing is not None:
        # On the planning and control team: also this role, same row.
        setattr(existing, _FLAG[role], True)
        access = existing
    else:
        access = TTXAccess(user_id=target.id, ttx_id=ttx.id, role=role, granted_by_id=actor_id)
    session.add(access)
    session.commit()
    session.refresh(access)
    logger.info("User %s made %s of TTX %s by user %s.", target.id, _LABEL[role], ttx.id, actor_id)
    return access, target


def remove_assignee(
    session: Session, ttx: TTX, user_id: uuid.UUID, role: RoleEnum, actor_id: uuid.UUID
) -> None:
    access = session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == user_id, acting_as(role)
        )
    ).first()
    if access is None:
        code, message = _NOT_ON_EXERCISE[role]
        raise AppException(code, message, 404)
    if access.role == RoleEnum.PLANNER:
        # A team member stays on the team; only this role goes.
        drop_team_assignment(session, access, role)
    else:
        _delete_access_with_tags(session, access)
    session.commit()
    logger.info(
        "User %s removed as %s of TTX %s by user %s.", user_id, _LABEL[role], ttx.id, actor_id
    )


def set_lead_evaluator(session: Session, ttx: TTX, user_id: uuid.UUID, actor_id: uuid.UUID) -> None:
    """Make one of the exercise's Evaluators its Lead Evaluator; whoever
    led before stops. Rows are locked so two concurrent picks can't both
    clear and then both set (the partial unique index would reject the
    second anyway)."""
    rows = list(
        session.exec(
            select(TTXAccess)
            .where(TTXAccess.ttx_id == ttx.id, evaluator_access())
            .with_for_update()
        )
    )
    target = next((row for row in rows if row.user_id == user_id), None)
    if target is None:
        raise AppException("EVALUATOR_NOT_FOUND", "Evaluator not found on this exercise.", 404)
    for row in rows:
        if row.leads and row is not target:
            row.leads = False
            session.add(row)
    session.flush()
    target.leads = True
    session.add(target)
    session.commit()
    logger.info("User %s made Lead Evaluator of TTX %s by user %s.", user_id, ttx.id, actor_id)


def clear_lead_evaluator(session: Session, ttx: TTX, actor_id: uuid.UUID) -> None:
    for row in session.exec(select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.leads)):
        row.leads = False
        session.add(row)
    session.commit()
    logger.info("Lead Evaluator of TTX %s cleared by user %s.", ttx.id, actor_id)


def lead_evaluators(session: Session, ttx_ids: list[uuid.UUID]) -> dict[uuid.UUID, User]:
    """Each exercise's Lead Evaluator, for the ones that have one."""
    if not ttx_ids:
        return {}
    return {
        access.ttx_id: user
        for access, user in session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id.in_(ttx_ids), TTXAccess.leads)
        )
    }


def drop_team_assignment(session: Session, access: TTXAccess, role: RoleEnum) -> None:
    """A team member stops being the exercise's Evaluator / Observer (no
    commit): the flag goes and, for an Evaluator, the lead and their place
    in the evaluation plan with it."""
    setattr(access, _FLAG[role], False)
    if role == RoleEnum.EVALUATOR:
        access.leads = False
        # Imported here: the conduct prep service sits above this one.
        from app.services.ttx_conduct_prep_service import drop_evaluator

        drop_evaluator(session, access.ttx_id, access.user_id)
    session.add(access)


def _observer_or_evaluator() -> None:
    """One person is an exercise's Observer or its Evaluator, never both:
    one watches, the other takes notes and rates with the EEG."""
    raise AppException(
        "OBSERVER_OR_EVALUATOR",
        "Someone is an exercise's Observer or its Evaluator, not both.",
        409,
        log_level=logging.WARNING,
    )
