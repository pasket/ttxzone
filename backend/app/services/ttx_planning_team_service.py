"""An exercise's planning and control team (drawn from the org's Exercise
Planning Team; `/ttx/{ttx_id}/planning-team` in the API): the TTXAccess
rows with the PLANNER role. Each member plans (designs the exercise),
controls (runs it: delivers the MSEL injects, keeps the Players in scope)
or both; a Controller can also facilitate (moderates alongside the
Players, keeps the focus on the objectives). Those are the row's
`plans` / `controls` / `facilitates` flags.

A Planner adds planning team members directly, picking from the
organization's declared Planners (OrganizationMembership PLANNER
grants made by a Program Manager) -- no invitation token involved; tokens are
for Players only. Rules:

- only an org-level Planner of the exercise's organization can be
  added (their email domain was already checked when that grant was made);
- a user holds one role per exercise, so an existing Player is
  refused rather than silently promoted;
- every member plans or controls; facilitating needs controlling;
- an exercise never drops to zero Planners nor zero Controllers (row lock
  before counting, same as revoke_program_manager); removing yourself is
  allowed while another remains;
- exactly one member is the Lead Planner (TTX.lead_planner_id): the
  creator at first, reassignable to any member who plans. The role is never handed
  over silently: removing the lead (or the lead leaving, or deleting their
  account) names the successor explicitly (409 LEAD_SUCCESSOR_REQUIRED
  otherwise). `lead_planner_id` alone is never trusted on read:
  `lead_user_id` falls back to the longest-standing member, so an exercise
  created outside create_ttx still shows a lead.
"""

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
from app.services.ttx_tag_service import validate_tag_ids_belong_to_ttx

logger = logging.getLogger(__name__)


def list_planning_team(session: Session, ttx: TTX) -> list[tuple[TTXAccess, User]]:
    """Every planning and control team member of the exercise, oldest first. Unpaginated -- an
    exercise has a handful, and the UI needs the full count to enforce
    "at least one"."""
    return list(
        session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == ttx.id, TTXAccess.role == RoleEnum.PLANNER)
            .order_by(TTXAccess.created_at, User.full_name)
        )
    )


def lead_user_id(ttx: TTX, members: list[tuple[TTXAccess, User]]) -> uuid.UUID | None:
    """The Lead Planner among `members` (list_planning_team's order): the
    stored one while they're on the team and plan, else the first member
    who plans."""
    ids = [user.id for access, user in members if access.plans]
    if ttx.lead_planner_id in ids:
        return ttx.lead_planner_id
    return ids[0] if ids else None


def set_lead_planner(
    session: Session, ttx: TTX, user_id: uuid.UUID, actor_id: uuid.UUID
) -> list[tuple[TTXAccess, User]]:
    members = list_planning_team(session, ttx)
    access = next((a for a, user in members if user.id == user_id), None)
    if access is None:
        raise AppException(
            "NOT_ON_PLANNING_TEAM", "This person is not a Planner of this exercise.", 404
        )
    if not access.plans:
        raise AppException(
            "LEAD_MUST_PLAN",
            "The Lead Planner must be a Planner of the exercise.",
            400,
            log_level=logging.WARNING,
        )
    ttx.lead_planner_id = user_id
    session.add(ttx)
    session.commit()
    session.refresh(ttx)
    logger.info("User %s made Lead Planner of TTX %s by user %s.", user_id, ttx.id, actor_id)
    return members


def list_candidates(session: Session, ttx: TTX) -> list[User]:
    """The organization's Planners who aren't on this exercise yet in
    any role -- what the add form suggests."""
    on_exercise = select(TTXAccess.user_id).where(TTXAccess.ttx_id == ttx.id)
    return list(
        session.exec(
            select(User)
            .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
            .where(
                OrganizationMembership.organization_id == ttx.organization_id,
                OrganizationMembership.role == OrgRoleEnum.PLANNER,
                active_membership(),
                User.id.not_in(on_exercise),
            )
            .order_by(User.full_name)
        )
    )


def check_functions(plans: bool, controls: bool, facilitates: bool) -> None:
    if not (plans or controls):
        raise AppException(
            "NO_TEAM_FUNCTION",
            "A team member must be a Planner, a Controller or both.",
            400,
            log_level=logging.WARNING,
        )
    if facilitates and not controls:
        raise AppException(
            "FACILITATOR_NEEDS_CONTROLLER",
            "Only a Controller can also be a Facilitator.",
            400,
            log_level=logging.WARNING,
        )


def add_planning_team_member(
    session: Session,
    ttx: TTX,
    email: str,
    actor_id: uuid.UUID,
    plans: bool = True,
    controls: bool = False,
    facilitates: bool = False,
) -> tuple[TTXAccess, User]:
    check_functions(plans, controls, facilitates)
    target = session.exec(select(User).where(User.email == email.lower())).first()
    is_org_manager = (
        target is not None
        and session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.user_id == target.id,
                OrganizationMembership.organization_id == ttx.organization_id,
                OrganizationMembership.role == OrgRoleEnum.PLANNER,
                active_membership(),
            )
        ).first()
        is not None
    )
    if target is None or not is_org_manager:
        # Same answer for "no account" and "not a Planner here", so the
        # form can't be used to probe which emails have accounts.
        raise AppException(
            "NOT_ORG_PLANNER",
            "Only Planners of this organization can be added. A Program Manager "
            "grants that role in Admin -> Users and roles.",
            400,
            log_level=logging.WARNING,
        )

    existing = session.exec(
        select(TTXAccess).where(TTXAccess.user_id == target.id, TTXAccess.ttx_id == ttx.id)
    ).first()
    if existing is not None and existing.role == RoleEnum.PLANNER:
        raise AppException(
            "ALREADY_ON_PLANNING_TEAM",
            "This person is already a Planner of this exercise.",
            409,
            log_level=logging.WARNING,
        )
    if existing is not None:
        raise AppException(
            "ALREADY_PLAYER",
            "This person already takes part in this exercise as a player. "
            "Remove them from the players before adding them as a planning team member.",
            409,
            log_level=logging.WARNING,
        )

    access = TTXAccess(
        user_id=target.id,
        ttx_id=ttx.id,
        role=RoleEnum.PLANNER,
        plans=plans,
        controls=controls,
        facilitates=facilitates,
        granted_by_id=actor_id,
    )
    session.add(access)
    session.commit()
    session.refresh(access)
    logger.info(
        "User %s added to the planning and control team of TTX %s by user %s.",
        target.id,
        ttx.id,
        actor_id,
    )
    return access, target


def lead_planners(session: Session, ttx_ids: list[uuid.UUID]) -> dict[uuid.UUID, User]:
    """The Lead Planner of each exercise, batched (one query) -- for the
    exercise list and its identity band."""
    if not ttx_ids:
        return {}
    teams: dict[uuid.UUID, list[tuple[TTXAccess, User]]] = {}
    for access, user in session.exec(
        select(TTXAccess, User)
        .join(User, User.id == TTXAccess.user_id)
        .where(TTXAccess.ttx_id.in_(ttx_ids), TTXAccess.role == RoleEnum.PLANNER)
        .order_by(TTXAccess.created_at, User.full_name)
    ):
        teams.setdefault(access.ttx_id, []).append((access, user))
    ttxs = {t.id: t for t in session.exec(select(TTX).where(TTX.id.in_(list(teams))))}
    result: dict[uuid.UUID, User] = {}
    for ttx_id, team in teams.items():
        lead = lead_user_id(ttxs[ttx_id], team)
        result[ttx_id] = next(user for _, user in team if user.id == lead)
    return result


def exercises_led(session: Session, user: User) -> list[tuple[TTX, list[tuple[TTXAccess, User]]]]:
    """Exercises `user` leads that someone else could take over -- what
    deleting their account must hand over first. (A lone Planner's
    exercise has no one to hand it to.)"""
    ttx_ids = list(
        session.exec(
            select(TTXAccess.ttx_id).where(
                TTXAccess.user_id == user.id, TTXAccess.role == RoleEnum.PLANNER
            )
        )
    )
    result = []
    for ttx in session.exec(select(TTX).where(TTX.id.in_(ttx_ids)).order_by(TTX.code)):
        team = list_planning_team(session, ttx)
        if sum(access.plans for access, _ in team) > 1 and lead_user_id(ttx, team) == user.id:
            result.append((ttx, team))
    return result


def hand_over_leads(session: Session, user: User, successors: dict[uuid.UUID, uuid.UUID]) -> None:
    """Before `user`'s account goes: every exercise they lead gets the
    successor they chose (no commit -- part of the caller's transaction)."""
    for ttx, team in exercises_led(session, user):
        ttx.lead_planner_id = check_lead_successor(team, user.id, successors.get(ttx.id))
        session.add(ttx)
        logger.info("User %s is now Lead Planner of TTX %s.", ttx.lead_planner_id, ttx.id)


def check_lead_successor(
    team: list[tuple[TTXAccess, User]], leaving_id: uuid.UUID, successor_id: uuid.UUID | None
) -> uuid.UUID:
    """The member who takes over from a leaving lead: named explicitly,
    and another member of the same team who plans."""
    if successor_id is None:
        raise AppException(
            "LEAD_SUCCESSOR_REQUIRED",
            "This person is the Lead Planner: choose who takes over first.",
            409,
            log_level=logging.WARNING,
        )
    planners = {user.id for access, user in team if access.plans}
    if successor_id == leaving_id or successor_id not in planners:
        raise AppException(
            "INVALID_LEAD_SUCCESSOR",
            "The new Lead Planner must be another Planner of the exercise.",
            400,
            log_level=logging.WARNING,
        )
    return successor_id


def remove_planning_team_member(
    session: Session,
    ttx: TTX,
    user_id: uuid.UUID,
    actor_id: uuid.UUID,
    lead_successor_id: uuid.UUID | None = None,
) -> None:
    members = _lock_team(session, ttx)
    access = _member_or_404(members, user_id)
    _check_team_keeps_functions(members, access, plans=False, controls=False)
    team = list_planning_team(session, ttx)
    if lead_user_id(ttx, team) == user_id:
        ttx.lead_planner_id = check_lead_successor(team, user_id, lead_successor_id)
        session.add(ttx)
        logger.info("User %s is now Lead Planner of TTX %s.", ttx.lead_planner_id, ttx.id)
    _delete_access_with_tags(session, access)
    session.commit()
    logger.info(
        "User %s removed from the planning and control team of TTX %s by user %s.",
        user_id,
        ttx.id,
        actor_id,
    )


def set_planning_team_member_functions(
    session: Session,
    ttx: TTX,
    user_id: uuid.UUID,
    plans: bool,
    controls: bool,
    facilitates: bool,
    actor_id: uuid.UUID,
    lead_successor_id: uuid.UUID | None = None,
) -> TTXAccess:
    """What a member does on the exercise. Same invariants as removing
    them: the exercise keeps a Planner and a Controller, and the lead who
    stops planning names their successor."""
    check_functions(plans, controls, facilitates)
    members = _lock_team(session, ttx)
    access = _member_or_404(members, user_id)
    _check_team_keeps_functions(members, access, plans=plans, controls=controls)
    if access.plans and not plans:
        team = list_planning_team(session, ttx)
        if lead_user_id(ttx, team) == user_id:
            ttx.lead_planner_id = check_lead_successor(team, user_id, lead_successor_id)
            session.add(ttx)
            logger.info("User %s is now Lead Planner of TTX %s.", ttx.lead_planner_id, ttx.id)
    access.plans = plans
    access.controls = controls
    access.facilitates = facilitates
    session.add(access)
    session.commit()
    session.refresh(access)
    logger.info(
        "Team functions of user %s on TTX %s set to plans=%s controls=%s facilitates=%s "
        "by user %s.",
        user_id,
        ttx.id,
        plans,
        controls,
        facilitates,
        actor_id,
    )
    return access


def team_departure(
    session: Session, ttx: TTX, user_id: uuid.UUID
) -> tuple[str | None, uuid.UUID | None]:
    """For a removal decided elsewhere (an org role revoked): why `user_id`
    can't leave the team (None if they can), and -- when they lead it --
    who takes over (the longest-standing other member who plans). Locks
    the team rows."""
    members = _lock_team(session, ttx)
    access = _member_or_404(members, user_id)
    others = [a for a in members if a.id != access.id]
    if access.plans and not any(a.plans for a in others):
        return "planner", None
    if access.controls and not any(a.controls for a in others):
        return "controller", None
    team = list_planning_team(session, ttx)
    if lead_user_id(ttx, team) != user_id:
        return None, None
    return None, next(u.id for a, u in team if a.plans and u.id != user_id)


def depart_team(session: Session, ttx: TTX, user_id: uuid.UUID, new_lead: uuid.UUID | None) -> None:
    """Applies team_departure's answer (no commit). Someone who is also
    the exercise's Evaluator or Observer stays as that (Evaluator first: it
    keeps the lead and the evaluation plan's assignments)."""
    access = session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == ttx.id,
            TTXAccess.user_id == user_id,
            TTXAccess.role == RoleEnum.PLANNER,
        )
    ).one()
    if new_lead is not None:
        ttx.lead_planner_id = new_lead
        session.add(ttx)
        logger.info("User %s is now Lead Planner of TTX %s.", new_lead, ttx.id)
    if access.evaluates or access.observes:
        access.role = RoleEnum.EVALUATOR if access.evaluates else RoleEnum.OBSERVER
        access.plans = access.controls = access.facilitates = False
        access.evaluates = access.observes = False
        session.add(access)
        return
    _delete_access_with_tags(session, access)


def _lock_team(session: Session, ttx: TTX) -> list[TTXAccess]:
    return list(
        session.exec(
            select(TTXAccess)
            .where(TTXAccess.ttx_id == ttx.id, TTXAccess.role == RoleEnum.PLANNER)
            .with_for_update()
        )
    )


def _member_or_404(members: list[TTXAccess], user_id: uuid.UUID) -> TTXAccess:
    access = next((a for a in members if a.user_id == user_id), None)
    if access is None:
        raise AppException(
            "NOT_ON_PLANNING_TEAM", "This person is not a Planner of this exercise.", 404
        )
    return access


def _check_team_keeps_functions(
    members: list[TTXAccess], access: TTXAccess, plans: bool, controls: bool
) -> None:
    """`access` is about to plan/control as given (both False: leaving).
    The exercise keeps at least one Planner and -- once it has one -- one
    Controller."""
    others = [a for a in members if a.id != access.id]
    if access.plans and not plans and not any(a.plans for a in others):
        raise AppException(
            "LAST_PLANNER",
            "An exercise needs at least one Planner. Add another one first.",
            409,
            log_level=logging.WARNING,
        )
    if access.controls and not controls and not any(a.controls for a in others):
        raise AppException(
            "LAST_CONTROLLER",
            "An exercise needs at least one Controller. Make someone else Controller first.",
            409,
            log_level=logging.WARNING,
        )


def _delete_access_with_tags(session: Session, access: TTXAccess) -> None:
    """TTXAccessTagAssignment has a plain FK to ttx_access.id with no
    ondelete cascade -- clear it before the row itself."""
    if access.is_evaluator:
        # Imported here: the conduct prep service sits above this one.
        from app.services.ttx_conduct_prep_service import drop_evaluator

        drop_evaluator(session, access.ttx_id, access.user_id)
    for row in session.exec(
        select(TTXAccessTagAssignment).where(TTXAccessTagAssignment.ttx_access_id == access.id)
    ):
        session.delete(row)
    session.flush()
    session.delete(access)


def set_planning_team_member_tags(
    session: Session, ttx: TTX, user_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> tuple[TTXAccess, User, list[TTXTag]]:
    """Full-replace the TTX-tag set on one planning team member -- same
    delete-flush-dedupe-insert shape as ttx_tag_service.set_ttx_tags."""
    access = session.exec(
        select(TTXAccess).where(
            TTXAccess.ttx_id == ttx.id,
            TTXAccess.user_id == user_id,
            TTXAccess.role == RoleEnum.PLANNER,
        )
    ).first()
    if access is None:
        raise AppException(
            "NOT_ON_PLANNING_TEAM", "This person is not a Planner of this exercise.", 404
        )
    validate_tag_ids_belong_to_ttx(session, ttx.id, tag_ids)

    for row in session.exec(
        select(TTXAccessTagAssignment).where(TTXAccessTagAssignment.ttx_access_id == access.id)
    ):
        session.delete(row)
    session.flush()
    for tag_id in dict.fromkeys(tag_ids):
        session.add(TTXAccessTagAssignment(ttx_tag_id=tag_id, ttx_access_id=access.id))
    session.commit()

    target = session.get(User, user_id)
    tags = list(session.exec(select(TTXTag).where(TTXTag.id.in_(tag_ids)))) if tag_ids else []
    return access, target, tags


def list_tags_for_accesses(session: Session, access_ids: list[int]) -> dict[int, list[TTXTag]]:
    """Batch-fetch, one query for all planning team members (no N+1)."""
    if not access_ids:
        return {}
    rows = session.exec(
        select(TTXAccessTagAssignment, TTXTag)
        .join(TTXTag, TTXTag.id == TTXAccessTagAssignment.ttx_tag_id)
        .where(TTXAccessTagAssignment.ttx_access_id.in_(access_ids))
    )
    result: dict[int, list[TTXTag]] = {}
    for assignment, tag in rows:
        result.setdefault(assignment.ttx_access_id, []).append(tag)
    return result
