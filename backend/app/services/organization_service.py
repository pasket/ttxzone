import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import func, or_
from sqlmodel import Session, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import (
    TTX,
    AllowedDomainTagAssignment,
    MembershipTagAssignment,
    Organization,
    OrganizationActor,
    OrganizationAllowedDomain,
    OrganizationInject,
    OrganizationMembership,
    OrganizationScenario,
    OrganizationTag,
    OrganizationThreatActor,
    OrgRoleEnum,
    RoleEnum,
    TTXAccess,
    User,
    active_membership,
)
from app.schemas.organization import OrganizationSignupRequest, OrganizationSummary
from app.services import account_email_service
from app.services.org_creation_security import validate_organization_signup
from app.services.organization_logo_service import logo_url
from app.services.organization_tag_service import validate_organization_tag_ids_belong_to_org
from app.services.security_policy_service import check_new_password, set_password
from app.services.tenancy_service import require_instance_founding, require_self_service_founding
from app.services.ttx_service import delete_exercises

logger = logging.getLogger(AUTH_LOGGER_NAME)
# Planner grant/list below are Program Manager management actions, not
# onboarding/login -- same reasoning as invitation-token create/revoke/list
# staying off auth.log (see CLAUDE.md's logging section), so they use the
# plain module logger instead of the auth_logger above.
module_logger = logging.getLogger(__name__)


def create_organization_with_program_manager(
    session: Session, payload: OrganizationSignupRequest
) -> tuple[Organization, User]:
    email = payload.admin.email.lower()

    require_self_service_founding(session)
    validate_organization_signup(session, email)

    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        raise AppException(
            "EMAIL_ALREADY_REGISTERED",
            "An account with this email already exists.",
            409,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    check_new_password(
        session, payload.admin.password, email=email, full_name=payload.admin.full_name
    )
    user = User(email=email, full_name=payload.admin.full_name)
    set_password(session, user, payload.admin.password)
    session.flush()

    organization = _found_organization(
        session, user, payload.organization.name, payload.organization.tax_id
    )
    session.commit()
    session.refresh(organization)
    session.refresh(user)

    logger.info("Organization %s created with program-manager %s.", organization.id, user.id)
    return organization, user


def _found_organization(
    session: Session, user: User, name: str, tax_id: str | None = None
) -> Organization:
    """The organization, its founder's grants and its first allowed domain
    -- shared by the anonymous signup and a signed-in account founding
    another organization. Flushes, doesn't commit."""
    organization = Organization(name=name, tax_id=tax_id, domain=user.email.rsplit("@", 1)[-1])
    session.add(organization)
    session.flush()

    # The founder runs the program and plans its first exercises: both
    # grants from day one (they become Lead Planner of what they create).
    # The Planner grant is an ordinary one -- revocable from Users and roles.
    for role in (OrgRoleEnum.PROGRAM_MANAGER, OrgRoleEnum.PLANNER):
        session.add(
            OrganizationMembership(user_id=user.id, organization_id=organization.id, role=role)
        )
    # The allowlist is default-deny (see is_email_domain_allowed), so seed
    # it with the org's own domain -- internal staff can be granted Program
    # Manager or Planner from day one; any outside domain has to be added
    # explicitly. In an "open" deployment founding rejects free email
    # domains (org_creation_security); elsewhere the operator chose the
    # founder.
    session.add(
        OrganizationAllowedDomain(
            organization_id=organization.id,
            domain=organization.domain,
            allows_program_manager=True,
            allows_planner=True,
        )
    )
    session.flush()
    return organization


def create_organization_for_user(session: Session, user: User, name: str) -> Organization:
    """Any signed-in account can found an organization of its own -- being
    a Player or a Planner elsewhere doesn't matter, roles are per
    organization. Same work-domain rule as the anonymous signup, and a cap
    on how many organizations one account founds -- within the
    deployment's tenancy rules (tenancy_service)."""
    require_self_service_founding(session)
    validate_organization_signup(session, user.email)

    founded = session.exec(
        select(func.count())
        .select_from(OrganizationMembership)
        .where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
        )
    ).one()
    if founded >= settings.MAX_ORGANIZATIONS_PER_PROGRAM_MANAGER:
        raise AppException(
            "ORG_LIMIT_REACHED",
            "You already manage the maximum number of organizations.",
            409,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    organization = _found_organization(session, user, name)
    session.commit()
    session.refresh(organization)
    logger.info("Organization %s founded by existing user %s.", organization.id, user.id)
    return organization


def _refuse_suspended(user: User) -> None:
    """A suspended account can't sign in: making it an organization's
    Program Manager would leave that organization with nobody to run it."""
    if user.suspended_at is not None:
        raise AppException(
            "ACCOUNT_SUSPENDED",
            "This account is suspended.",
            409,
            log_level=logging.WARNING,
        )


def create_organization_for_program_manager(
    session: Session, admin: User, name: str, program_manager_email: str
) -> Organization:
    """An instance administrator creating an organization from Platform
    (any tenancy mode, within its cap): an existing account founds it --
    its Program Manager and a Planner, its domain the organization's --
    without the administrator joining it."""
    require_instance_founding(session)
    founder = session.exec(select(User).where(User.email == program_manager_email.lower())).first()
    if founder is None or not founder.is_active:
        raise AppException(
            "USER_NOT_FOUND", "No account exists for this email.", 404, log_level=logging.WARNING
        )
    _refuse_suspended(founder)

    organization = _found_organization(session, founder, name)
    session.commit()
    session.refresh(organization)
    logger.info(
        "Organization %s created by instance administrator %s for %s.",
        organization.id,
        admin.id,
        founder.id,
    )
    return organization


# Org grants a Program Manager manages from Admin -> Users and roles, beyond
# Program Manager itself (Planner, Observer, Evaluator): their
# list/grant/revoke/tags share one shape.
_ROLE_LABEL = {
    OrgRoleEnum.PLANNER: "Planner",
    OrgRoleEnum.OBSERVER: "Observer",
    OrgRoleEnum.EVALUATOR: "Evaluator",
    OrgRoleEnum.PROGRAM_MANAGER: "Program Manager",
}
# Whole messages, not a label put into one: each is translated as written.
_ALREADY_HOLDS = {
    OrgRoleEnum.PLANNER: ("ALREADY_PLANNER", "This user is already a Planner."),
    OrgRoleEnum.OBSERVER: ("ALREADY_OBSERVER", "This user is already an Observer."),
    OrgRoleEnum.EVALUATOR: ("ALREADY_EVALUATOR", "This user is already an Evaluator."),
    OrgRoleEnum.PROGRAM_MANAGER: (
        "ALREADY_PROGRAM_MANAGER",
        "This user is already a Program Manager.",
    ),
}


def grant_member_role(
    session: Session, organization_id: uuid.UUID, email: str, role: OrgRoleEnum
) -> tuple[OrganizationMembership, User]:
    """An existing account only. Planner grants are domain-allowlisted;
    Observer and Evaluator grants aren't -- they are often outside
    auditors and can't change the exercise."""
    target = session.exec(select(User).where(User.email == email.lower())).first()
    if target is None:
        raise AppException(
            "USER_NOT_FOUND", "No account exists for this email.", 404, log_level=logging.WARNING
        )

    existing = session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == target.id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.role == role,
        )
    ).first()
    if existing is not None:
        code, message = _ALREADY_HOLDS[role]
        raise AppException(
            code,
            message,
            409,
            log_level=logging.WARNING,
        )

    if role == OrgRoleEnum.PLANNER:
        require_email_domain_allowed(session, organization_id, target.email, "planner")

    membership = OrganizationMembership(
        user_id=target.id, organization_id=organization_id, role=role
    )
    session.add(membership)
    session.commit()
    session.refresh(membership)

    module_logger.info(
        "User %s granted %s on organization %s.", target.id, _ROLE_LABEL[role], organization_id
    )
    return membership, target


def revoke_member_role(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, role: OrgRoleEnum
) -> None:
    """Removes the org-level grant and, in cascade, the same role on every
    exercise of the organization (see _cascade_to_exercises): the grant is
    what authorizes those assignments."""
    membership = _get_membership_or_404(session, organization_id, user_id, role)
    _cascade_to_exercises(session, organization_id, user_id, role)

    # MembershipTagAssignment has a plain FK to organization_membership.id
    # with no ondelete cascade -- clear it first or deleting the membership
    # below hits a ForeignKeyViolation, same reasoning as delete_ttx_tag's
    # own assignment cleanup.
    for row in session.exec(
        select(MembershipTagAssignment).where(
            MembershipTagAssignment.organization_membership_id == membership.id
        )
    ):
        session.delete(row)
    session.flush()

    session.delete(membership)
    session.commit()
    module_logger.info(
        "%s revoked for user %s on organization %s.", _ROLE_LABEL[role], user_id, organization_id
    )


_EXERCISE_ROLE = {
    OrgRoleEnum.PLANNER: RoleEnum.PLANNER,
    OrgRoleEnum.OBSERVER: RoleEnum.OBSERVER,
    OrgRoleEnum.EVALUATOR: RoleEnum.EVALUATOR,
}


def member_exercise_accesses(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID
) -> list[tuple[TTXAccess, TTX]]:
    """The person's grants on the organization's exercises, by exercise code."""
    return list(
        session.exec(
            select(TTXAccess, TTX)
            .join(TTX, TTX.id == TTXAccess.ttx_id)
            .where(TTX.organization_id == organization_id, TTXAccess.user_id == user_id)
            .order_by(TTX.code)
        )
    )


def _cascade_to_exercises(
    session: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    role: OrgRoleEnum,
    lead_successors: dict[uuid.UUID, uuid.UUID] | None = None,
) -> None:
    """Revoking an org grant takes the person off that role on every
    exercise of the organization (no commit). A planning and control team
    is never left without a Planner or a Controller: refused, naming the
    exercises; a lead hands over to the longest-standing other Planner --
    or, given `lead_successors` (leaving the organization), to the one
    chosen for that exercise."""
    from app.services.ttx_planning_team_service import (
        _delete_access_with_tags,
        check_lead_successor,
        depart_team,
        list_planning_team,
        team_departure,
    )

    exercise_role = _EXERCISE_ROLE.get(role)
    if exercise_role is None:
        return
    accesses = member_exercise_accesses(session, organization_id, user_id)
    rows = [(access, ttx) for access, ttx in accesses if access.role == exercise_role]
    if exercise_role != RoleEnum.PLANNER:
        from app.services.ttx_observer_evaluator_service import drop_team_assignment

        for access, _ in rows:
            _delete_access_with_tags(session, access)
        # A team member who was also this role stays on the team.
        for access, _ in accesses:
            if access.role == RoleEnum.PLANNER and exercise_role.value in access.context_roles():
                drop_team_assignment(session, access, exercise_role)
        return
    plans = []
    blocked = []
    for _, ttx in rows:
        reason, new_lead = team_departure(session, ttx, user_id)
        if reason:
            blocked.append(ttx.code)
        elif new_lead is not None and lead_successors is not None:
            new_lead = check_lead_successor(
                list_planning_team(session, ttx), user_id, lead_successors.get(ttx.id)
            )
        plans.append((ttx, new_lead))
    if blocked:
        raise AppException(
            "ONLY_PLANNER_OR_CONTROLLER",
            "This person is the only Planner or Controller of {exercises}. "
            "Add someone else there first.",
            409,
            log_level=logging.WARNING,
            params={"exercises": ", ".join(blocked)},
        )
    for ttx, new_lead in plans:
        depart_team(session, ttx, user_id, new_lead)


def delete_member(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, actor_id: uuid.UUID
) -> tuple[str, list[str]]:
    """Admin -> Users and roles -> Delete. Someone still on any of the
    organization's exercises is disabled instead (every grant gets
    `disabled_at`: no grant counts, no exercise opens) until they're taken
    off those exercises; otherwise all their grants go. Returns ("deleted" |
    "disabled", exercise codes). The last Program Manager stays."""
    memberships = list(
        session.exec(
            select(OrganizationMembership)
            .where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == user_id,
            )
            .with_for_update()
        )
    )
    if not memberships:
        raise AppException("MEMBER_NOT_FOUND", "This user holds no role here.", 404)
    if any(m.role == OrgRoleEnum.PROGRAM_MANAGER and m.disabled_at is None for m in memberships):
        others = session.exec(
            select(OrganizationMembership)
            .where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
                OrganizationMembership.user_id != user_id,
                active_membership(),
            )
            .with_for_update()
        ).first()
        if others is None:
            raise AppException(
                "LAST_PROGRAM_MANAGER",
                "An organization needs at least one Program Manager. Add another one first.",
                409,
                log_level=logging.WARNING,
            )
    codes = [ttx.code for _, ttx in member_exercise_accesses(session, organization_id, user_id)]
    if codes:
        now = datetime.now(UTC)
        for membership in memberships:
            membership.disabled_at = membership.disabled_at or now
            session.add(membership)
        session.commit()
        module_logger.info(
            "User %s disabled in organization %s by user %s (still on %s).",
            user_id,
            organization_id,
            actor_id,
            ", ".join(codes),
        )
        return "disabled", codes
    _delete_memberships(session, memberships)
    session.commit()
    module_logger.info(
        "User %s removed from organization %s by user %s.", user_id, organization_id, actor_id
    )
    return "deleted", []


def _delete_memberships(session: Session, memberships: list[OrganizationMembership]) -> None:
    """The grants and their tags (no commit)."""
    ids = [m.id for m in memberships]
    for row in session.exec(
        select(MembershipTagAssignment).where(
            MembershipTagAssignment.organization_membership_id.in_(ids)
        )
    ):
        session.delete(row)
    session.flush()
    for membership in memberships:
        session.delete(membership)


def enable_member(session: Session, organization_id: uuid.UUID, user_id: uuid.UUID) -> None:
    memberships = list(
        session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == user_id,
            )
        )
    )
    if not memberships:
        raise AppException("MEMBER_NOT_FOUND", "This user holds no role here.", 404)
    for membership in memberships:
        membership.disabled_at = None
        session.add(membership)
    session.commit()


def list_member_role(
    session: Session,
    organization_id: uuid.UUID,
    role: OrgRoleEnum,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name", "last_login"] = "created_at",
    q: str | None = None,
) -> tuple[list[tuple[OrganizationMembership, User]], int]:
    where_clause = [
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.role == role,
    ]
    if q:
        pattern = f"%{q}%"
        where_clause.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))

    total = session.exec(
        select(func.count())
        .select_from(OrganizationMembership)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(*where_clause)
    ).one()

    if sort_by == "last_login":
        # A never-logged-in account is the least recent of all: last in
        # "most recent first", first in "least recent first" -- where an
        # admin auditing dormant accounts looks.
        order = (
            User.last_login_at.desc().nulls_last()
            if sort_dir == "desc"
            else User.last_login_at.asc().nulls_first()
        )
    else:
        sort_column = User.full_name if sort_by == "name" else OrganizationMembership.created_at
        order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    # The primary sort column is not unique (full_name especially), so LIMIT/
    # OFFSET pages would otherwise have no stable order among ties -- the row
    # primary key is the tiebreaker.
    rows = session.exec(
        select(OrganizationMembership, User)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(*where_clause)
        .order_by(order, OrganizationMembership.id)
        .limit(limit)
        .offset(offset)
    )
    return list(rows), total


def list_org_members(
    session: Session,
    organization_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name", "last_login"] = "created_at",
    q: str | None = None,
    role: OrgRoleEnum | None = None,
    status: Literal["active", "disabled"] | None = None,
) -> tuple[list[tuple[User, datetime, list[OrganizationMembership]]], int, dict[OrgRoleEnum, int]]:
    """Admin -> Users and roles: everyone holding any grant in the
    organization, one row per person with all their grants (the role
    matrix). `role` narrows to holders of that grant, `status` to people
    whose access is active or disabled; `created_at` sorts by their earliest
    grant. Also returns how many hold each role (the matrix's column counts,
    unfiltered)."""
    in_org = OrganizationMembership.organization_id == organization_id
    where_clause = [in_org]
    if q:
        pattern = f"%{q}%"
        where_clause.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    if role is not None:
        where_clause.append(
            User.id.in_(
                select(OrganizationMembership.user_id).where(
                    in_org, OrganizationMembership.role == role
                )
            )
        )
    if status is not None:
        # Removal disables every grant of a person at once.
        disabled_users = select(OrganizationMembership.user_id).where(
            in_org, OrganizationMembership.disabled_at.is_not(None)
        )
        where_clause.append(
            User.id.in_(disabled_users) if status == "disabled" else User.id.not_in(disabled_users)
        )

    total = session.exec(
        select(func.count(func.distinct(User.id)))
        .select_from(OrganizationMembership)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(*where_clause)
    ).one()

    granted_at = func.min(OrganizationMembership.created_at)
    if sort_by == "last_login":
        # Never logged in counts as least recent, as in list_member_role.
        order = (
            User.last_login_at.desc().nulls_last()
            if sort_dir == "desc"
            else User.last_login_at.asc().nulls_first()
        )
    else:
        sort_column = User.full_name if sort_by == "name" else granted_at
        order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    page = list(
        session.exec(
            select(User, granted_at)
            .join(OrganizationMembership, OrganizationMembership.user_id == User.id)
            .where(*where_clause)
            .group_by(User.id)
            .order_by(order, User.id)
            .limit(limit)
            .offset(offset)
        )
    )

    memberships: dict[uuid.UUID, list[OrganizationMembership]] = {}
    if page:
        for membership in session.exec(
            select(OrganizationMembership)
            .where(in_org, OrganizationMembership.user_id.in_([user.id for user, _ in page]))
            .order_by(OrganizationMembership.created_at)
        ):
            memberships.setdefault(membership.user_id, []).append(membership)

    counts = {
        member_role: count
        for member_role, count in session.exec(
            select(OrganizationMembership.role, func.count())
            .where(in_org, active_membership())
            .group_by(OrganizationMembership.role)
        )
    }
    rows = [(user, first_grant, memberships.get(user.id, [])) for user, first_grant in page]
    return rows, total, counts


def set_member_tags(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> tuple[User, list[OrganizationTag]]:
    """Tags are per person in Users and roles: the same set on every grant
    the user holds in the organization (MembershipTagAssignment stays per
    grant underneath)."""
    memberships = list(
        session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == user_id,
            )
        )
    )
    if not memberships:
        raise AppException("MEMBER_NOT_FOUND", "This user holds no role here.", 404)
    membership_ids = [m.id for m in memberships]
    existing = session.exec(
        select(MembershipTagAssignment).where(
            MembershipTagAssignment.organization_membership_id.in_(membership_ids)
        )
    ).all()
    validate_organization_tag_ids_belong_to_org(
        session, organization_id, tag_ids, {row.organization_tag_id for row in existing}
    )
    for row in existing:
        session.delete(row)
    # Deletes before inserts -- same UniqueConstraint dodge as _set_membership_tags.
    session.flush()
    for membership_id in membership_ids:
        for tag_id in dict.fromkeys(tag_ids):
            session.add(
                MembershipTagAssignment(
                    organization_tag_id=tag_id, organization_membership_id=membership_id
                )
            )
    session.commit()
    target = session.get(User, user_id)
    tags = (
        list(session.exec(select(OrganizationTag).where(OrganizationTag.id.in_(tag_ids))))
        if tag_ids
        else []
    )
    return target, tags


def list_program_managers(
    session: Session, organization_id: uuid.UUID
) -> list[tuple[OrganizationMembership, User]]:
    """Every Program Manager of the organization, oldest grant first. Not
    paginated -- an org has a handful at most, and the UI needs the full
    count to enforce "at least one"."""
    return list(
        session.exec(
            select(OrganizationMembership, User)
            .join(User, User.id == OrganizationMembership.user_id)
            .where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
            )
            .order_by(OrganizationMembership.created_at, User.full_name)
        )
    )


def _add_program_manager(
    session: Session, organization_id: uuid.UUID, target: User
) -> OrganizationMembership:
    """The grant itself (no commit): an account that isn't suspended and
    whose email domain the org's allowlist accepts for the role."""
    _refuse_suspended(target)
    require_email_domain_allowed(session, organization_id, target.email, "program_manager")
    membership = OrganizationMembership(
        user_id=target.id, organization_id=organization_id, role=OrgRoleEnum.PROGRAM_MANAGER
    )
    session.add(membership)
    return membership


def grant_program_manager(
    session: Session, organization_id: uuid.UUID, email: str, actor_id: uuid.UUID
) -> tuple[OrganizationMembership, User]:
    """Same rules as a Planner grant (grant_member_role): an existing
    account only, and its email domain must be on the org's allowlist (default-deny). The new
    Program Manager is held at the mandatory-TOTP gate until they enroll --
    require_program_manager enforces that on every Program Manager action."""
    target = session.exec(select(User).where(User.email == email.lower())).first()
    if target is None:
        raise AppException(
            "USER_NOT_FOUND", "No account exists for this email.", 404, log_level=logging.WARNING
        )

    existing = session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == target.id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
        )
    ).first()
    if existing is not None:
        raise AppException(
            "ALREADY_PROGRAM_MANAGER",
            "This user is already a Program Manager of this organization.",
            409,
            log_level=logging.WARNING,
        )

    membership = _add_program_manager(session, organization_id, target)
    session.commit()
    session.refresh(membership)

    module_logger.info(
        "User %s granted Program Manager on organization %s by user %s.",
        target.id,
        organization_id,
        actor_id,
    )
    return membership, target


def revoke_program_manager(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, actor_id: uuid.UUID
) -> None:
    """An organization can never be left without a Program Manager. The org's
    Program Manager rows are locked (SELECT ... FOR UPDATE) before counting, so
    two concurrent revocations of the last two Program Managers serialize and
    the second one sees a single remaining row and is refused -- a plain
    count-then-delete would let both through. Revoking yourself is allowed
    while another Program Manager remains."""
    program_managers = list(
        session.exec(
            select(OrganizationMembership)
            .where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
            )
            .with_for_update()
        )
    )
    membership = next((m for m in program_managers if m.user_id == user_id), None)
    if membership is None:
        code, message = _MEMBERSHIP_NOT_FOUND[OrgRoleEnum.PROGRAM_MANAGER]
        raise AppException(code, message, 404)
    if not any(m.disabled_at is None and m.user_id != user_id for m in program_managers):
        raise AppException(
            "LAST_PROGRAM_MANAGER",
            "An organization needs at least one Program Manager. Add another one first.",
            409,
            log_level=logging.WARNING,
        )

    # Same FK cleanup as revoke_planner -- MembershipTagAssignment
    # also holds Program Manager grant tags (see _set_membership_tags).
    for row in session.exec(
        select(MembershipTagAssignment).where(
            MembershipTagAssignment.organization_membership_id == membership.id
        )
    ):
        session.delete(row)
    session.flush()

    session.delete(membership)
    session.commit()
    module_logger.info(
        "Program Manager revoked for user %s on organization %s by user %s.",
        user_id,
        organization_id,
        actor_id,
    )


def set_member_role_tags(
    session: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    role: OrgRoleEnum,
    tag_ids: list[uuid.UUID],
) -> tuple[OrganizationMembership, User, list[OrganizationTag]]:
    return _set_membership_tags(session, organization_id, user_id, role, tag_ids)


def set_program_manager_tags(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> tuple[OrganizationMembership, User, list[OrganizationTag]]:
    """Full-replace the Organization-tag set on one Program Manager grant.
    Caller (the endpoint) is already authorized via require_program_manager."""
    return _set_membership_tags(
        session, organization_id, user_id, OrgRoleEnum.PROGRAM_MANAGER, tag_ids
    )


_MEMBERSHIP_NOT_FOUND = {
    OrgRoleEnum.PLANNER: ("PLANNER_NOT_FOUND", "This user is not a Planner here."),
    OrgRoleEnum.OBSERVER: ("OBSERVER_NOT_FOUND", "This user is not an Observer here."),
    OrgRoleEnum.EVALUATOR: ("EVALUATOR_NOT_FOUND", "This user is not an Evaluator here."),
    OrgRoleEnum.PROGRAM_MANAGER: (
        "PROGRAM_MANAGER_NOT_FOUND",
        "This user is not a Program Manager here.",
    ),
}


def _get_membership_or_404(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, role: OrgRoleEnum
) -> OrganizationMembership:
    membership = session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user_id,
            OrganizationMembership.organization_id == organization_id,
            OrganizationMembership.role == role,
        )
    ).first()
    if membership is None:
        code, message = _MEMBERSHIP_NOT_FOUND[role]
        raise AppException(code, message, 404)
    return membership


def _set_membership_tags(
    session: Session,
    organization_id: uuid.UUID,
    user_id: uuid.UUID,
    role: OrgRoleEnum,
    tag_ids: list[uuid.UUID],
) -> tuple[OrganizationMembership, User, list[OrganizationTag]]:
    """Mirrors ttx_tag_service.set_ttx_tags' own delete-flush-dedupe-insert
    shape exactly. MembershipTagAssignment is keyed by
    organization_membership_id, so despite its name it holds the tags of
    any org-scoped grant, Program Manager included."""
    membership = _get_membership_or_404(session, organization_id, user_id, role)

    existing = session.exec(
        select(MembershipTagAssignment).where(
            MembershipTagAssignment.organization_membership_id == membership.id
        )
    ).all()
    validate_organization_tag_ids_belong_to_org(
        session, organization_id, tag_ids, {row.organization_tag_id for row in existing}
    )
    for row in existing:
        session.delete(row)
    # Flush the deletes before adding the new rows -- same UniqueConstraint-
    # dodge reasoning as set_ttx_tags (SQLAlchemy flushes pending inserts
    # before pending deletes by default).
    session.flush()
    for tag_id in dict.fromkeys(tag_ids):
        session.add(
            MembershipTagAssignment(
                organization_tag_id=tag_id, organization_membership_id=membership.id
            )
        )
    session.commit()

    target = session.get(User, user_id)
    tags = (
        list(session.exec(select(OrganizationTag).where(OrganizationTag.id.in_(tag_ids))))
        if tag_ids
        else []
    )
    return membership, target, tags


def list_tags_for_planner_memberships(
    session: Session, membership_ids: list[int]
) -> dict[int, list[OrganizationTag]]:
    """Batch-fetch, mirroring ttx_tag_service.list_tags_for_ttxs' own
    pattern -- one query for a whole page of planner rows, not N+1."""
    if not membership_ids:
        return {}
    rows = session.exec(
        select(MembershipTagAssignment, OrganizationTag)
        .join(
            OrganizationTag,
            OrganizationTag.id == MembershipTagAssignment.organization_tag_id,
        )
        .where(MembershipTagAssignment.organization_membership_id.in_(membership_ids))
    )
    result: dict[int, list[OrganizationTag]] = {}
    for assignment, tag in rows:
        result.setdefault(assignment.organization_membership_id, []).append(tag)
    return result


# Every organization grant, by OrgRoleEnum value.
_GRANT_FLAGS = tuple(role.value for role in OrgRoleEnum)


def list_user_organizations(session: Session, user: User) -> list[OrganizationSummary]:
    """Every organization `user` has any footing in, from their own point
    of view -- used by the org switcher and the default-organization
    preference. The org set is the union of (a) every OrganizationMembership
    org id and (b) every distinct TTX.organization_id reachable via the
    user's TTXAccess rows, since a Player-only or per-TTX-Planner-
    only org has no OrganizationMembership row at all. is_program_manager/
    is_planner come strictly from OrganizationMembership, mirroring
    core/security.py's is_program_manager/is_planner helpers exactly; so do
    is_observer/is_evaluator (what an exercise's team may assign them).
    """
    memberships = session.exec(
        select(OrganizationMembership).where(OrganizationMembership.user_id == user.id)
    ).all()
    # Removed from an org while still on its exercises: it isn't theirs.
    disabled = {m.organization_id for m in memberships if m.disabled_at is not None}
    flags: dict[uuid.UUID, dict[str, bool]] = {}
    for membership in memberships:
        if membership.organization_id in disabled:
            continue
        entry = flags.setdefault(membership.organization_id, dict.fromkeys(_GRANT_FLAGS, False))
        entry[membership.role.value] = True

    ttx_org_ids = session.exec(
        select(TTX.organization_id)
        .join(TTXAccess, TTXAccess.ttx_id == TTX.id)
        .where(TTXAccess.user_id == user.id)
        .distinct()
    ).all()
    for organization_id in ttx_org_ids:
        if organization_id in disabled:
            continue
        flags.setdefault(organization_id, dict.fromkeys(_GRANT_FLAGS, False))

    if not flags:
        return []

    organizations = session.exec(
        select(Organization).where(Organization.id.in_(flags.keys())).order_by(Organization.name)
    ).all()
    return [
        OrganizationSummary(
            organization_id=org.id,
            organization_name=org.name,
            domain=org.domain,
            alias=org.alias,
            logo_url=logo_url(org),
            is_program_manager=flags[org.id]["program_manager"],
            is_planner=flags[org.id]["planner"],
            is_observer=flags[org.id]["observer"],
            is_evaluator=flags[org.id]["evaluator"],
        )
        for org in organizations
    ]


def get_organization(session: Session, organization_id: uuid.UUID) -> Organization:
    organization = session.get(Organization, organization_id)
    if organization is None:
        raise AppException("ORGANIZATION_NOT_FOUND", "Organization not found.", 404)
    return organization


def update_organization_profile(
    session: Session,
    organization_id: uuid.UUID,
    description: str | None,
    tax_id: str | None,
    alias: str | None,
    name: str | None = None,
) -> Organization:
    organization = get_organization(session, organization_id)
    if name is not None:
        organization.name = name
    organization.description = description
    organization.tax_id = tax_id
    organization.alias = alias
    session.add(organization)
    session.commit()
    session.refresh(organization)
    module_logger.info("Profile updated for organization %s.", organization_id)
    return organization


def set_organization_domain(
    session: Session, organization_id: uuid.UUID, domain: str, actor_user_id: uuid.UUID
) -> Organization:
    """The instance administrator corrects an organization's domain (a
    Program Manager can't: it's captured at founding). The new one joins
    the allowlist for both grants if it isn't there yet, as at founding;
    the old entry stays -- the allowlist is the Program Manager's, and
    accounts on it keep their roles either way."""
    organization = get_organization(session, organization_id)
    domain = domain.lower()
    organization.domain = domain
    session.add(organization)
    listed = session.exec(
        select(OrganizationAllowedDomain).where(
            OrganizationAllowedDomain.organization_id == organization_id,
            OrganizationAllowedDomain.domain == domain,
        )
    ).first()
    if listed is None:
        session.add(
            OrganizationAllowedDomain(
                organization_id=organization_id,
                domain=domain,
                allows_program_manager=True,
                allows_planner=True,
            )
        )
    session.commit()
    session.refresh(organization)
    module_logger.info(
        "Domain of organization %s set to %s by user %s.", organization_id, domain, actor_user_id
    )
    return organization


def delete_organization(
    session: Session, organization_id: uuid.UUID, actor_user_id: uuid.UUID
) -> None:
    """Permanently delete an Organization and every row that hangs off it,
    in dependency order -- Organization has no ON DELETE CASCADE anywhere
    in its schema (every FK rooted at organization.id/ttx.id/
    invitation_token.id/ttx_tag.id is a plain, unconstrained FK), so
    deleting the row directly would hit a ForeignKeyViolation on the first
    child table. This is the single admin-facing way to remove an
    org's data completely -- irreversible, gated by a typed-name
    confirmation on the frontend (AdminOrganizationProfileSection), not a soft
    delete. `actor_user_id` is recorded in the audit log line only.

    On-disk files (TTX images, the org logo) are removed only after the
    commit succeeds -- deleting them first would leave rows pointing at
    missing files if the commit failed.
    """
    organization = get_organization(session, organization_id)
    ttx_ids = list(session.exec(select(TTX.id).where(TTX.organization_id == organization_id)))
    ttx_image_paths = delete_exercises(session, ttx_ids)

    # The organization's simulated actor library (exercises held copies,
    # already gone with their MSELs above).
    for row in session.exec(
        select(OrganizationActor).where(OrganizationActor.organization_id == organization_id)
    ):
        session.delete(row)
    # Its inject library, likewise.
    for row in session.exec(
        select(OrganizationInject).where(OrganizationInject.organization_id == organization_id)
    ):
        session.delete(row)
    # And its threat actor library.
    for row in session.exec(
        select(OrganizationThreatActor).where(
            OrganizationThreatActor.organization_id == organization_id
        )
    ):
        session.delete(row)
    # And its scenario library.
    for row in session.exec(
        select(OrganizationScenario).where(OrganizationScenario.organization_id == organization_id)
    ):
        session.delete(row)

    # MembershipTagAssignment FKs to both organization_tag.id and
    # organization_membership.id, neither with an ondelete cascade -- clear
    # it before either parent table's rows are deleted below.
    membership_ids = list(
        session.exec(
            select(OrganizationMembership.id).where(
                OrganizationMembership.organization_id == organization_id
            )
        )
    )
    if membership_ids:
        for row in session.exec(
            select(MembershipTagAssignment).where(
                MembershipTagAssignment.organization_membership_id.in_(membership_ids)
            )
        ):
            session.delete(row)
        session.flush()

    # AllowedDomainTagAssignment FKs to both organization_tag.id and
    # organization_allowed_domain.id, neither with an ondelete cascade --
    # same reasoning as the MembershipTagAssignment cleanup above.
    # Must run before the OrganizationTag deletion loop below (it FKs
    # organization_tag.id too), or the loop hits a ForeignKeyViolation.
    domain_ids = list(
        session.exec(
            select(OrganizationAllowedDomain.id).where(
                OrganizationAllowedDomain.organization_id == organization_id
            )
        )
    )
    if domain_ids:
        for row in session.exec(
            select(AllowedDomainTagAssignment).where(
                AllowedDomainTagAssignment.organization_allowed_domain_id.in_(domain_ids)
            )
        ):
            session.delete(row)
        session.flush()

    for row in session.exec(
        select(OrganizationTag).where(OrganizationTag.organization_id == organization_id)
    ):
        session.delete(row)

    for row in session.exec(
        select(OrganizationAllowedDomain).where(
            OrganizationAllowedDomain.organization_id == organization_id
        )
    ):
        session.delete(row)
    for row in session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.organization_id == organization_id
        )
    ):
        session.delete(row)
    session.flush()

    # A user's default_organization_id pointing at this org must be
    # cleared, not left dangling -- the column is nullable exactly for
    # this kind of case (see User.default_organization_id).
    for user in session.exec(select(User).where(User.default_organization_id == organization_id)):
        user.default_organization_id = None
        user.default_role = None
        user.default_ttx_id = None
        session.add(user)
    session.flush()

    logo_path = organization.logo_path
    session.delete(organization)
    session.commit()

    from app.services.organization_logo_service import _delete_logo_file
    from app.services.ttx_image_service import _delete_image_file

    for image_path in ttx_image_paths:
        _delete_image_file(image_path)
    _delete_logo_file(logo_path)

    module_logger.info("Organization %s deleted by user %s.", organization_id, actor_user_id)


# Which grant an allowlist check is for -- each maps to its own flag on
# OrganizationAllowedDomain.
DomainPurpose = Literal["program_manager", "planner"]

_PURPOSE_FLAG = {
    "program_manager": OrganizationAllowedDomain.allows_program_manager,
    "planner": OrganizationAllowedDomain.allows_planner,
}
_DOMAIN_NOT_ALLOWED = {
    "program_manager": (
        "DOMAIN_NOT_ALLOWED",
        "This user's email domain isn't allowed for Program Managers in this organization.",
    ),
    "planner": (
        "DOMAIN_NOT_ALLOWED",
        "This user's email domain isn't allowed for Planners in this organization.",
    ),
}


def list_allowed_domains(
    session: Session, organization_id: uuid.UUID, purpose: DomainPurpose | None = None
) -> list[OrganizationAllowedDomain]:
    """Every allowed domain for `organization_id` -- or only those enabled
    for `purpose` -- unpaginated: used internally for domain-match
    validation, which needs the full set, never a page of it. UI listing
    goes through `list_allowed_domains_paginated` instead."""
    query = select(OrganizationAllowedDomain).where(
        OrganizationAllowedDomain.organization_id == organization_id
    )
    if purpose is not None:
        query = query.where(_PURPOSE_FLAG[purpose].is_(True))
    return list(session.exec(query.order_by(OrganizationAllowedDomain.domain)).all())


def organizations_for_email_domain(session: Session, email: str) -> list[Organization]:
    """Organizations whose allowlist holds `email`'s domain (any purpose)
    -- where a newcomer belongs in a "single"/"managed" deployment."""
    domain = email.rsplit("@", 1)[-1].lower()
    return list(
        session.exec(
            select(Organization)
            .where(
                Organization.id.in_(
                    select(OrganizationAllowedDomain.organization_id).where(
                        OrganizationAllowedDomain.domain == domain
                    )
                )
            )
            .order_by(Organization.name)
        ).all()
    )


def domain_accounts_without_role(session: Session, organization_id: uuid.UUID) -> list[User]:
    """Admin -> Users and roles' newcomers: active accounts whose email
    domain is on the organization's allowlist and that hold no grant in it
    yet -- the Program Manager gives them their first role. An address
    still to be confirmed proves nothing about the domain, so it waits
    (account_email_service.verification_pending, as a query)."""
    domains = [d.domain for d in list_allowed_domains(session, organization_id)]
    if not domains:
        return []
    has_grant = select(OrganizationMembership.user_id).where(
        OrganizationMembership.organization_id == organization_id
    )
    domain_of_email = func.lower(func.split_part(User.email, "@", 2))
    query = select(User).where(
        User.is_active.is_(True),
        User.suspended_at.is_(None),
        domain_of_email.in_(domains),
        User.id.not_in(has_grant),
    )
    if account_email_service.available(session):
        query = query.where(
            or_(
                User.email_verification_required.is_(False),
                User.email_verified_at.is_not(None),
            )
        )
    return list(session.exec(query.order_by(User.created_at.desc()).limit(200)).all())


def is_email_domain_allowed(
    session: Session, organization_id: uuid.UUID, email: str, purpose: DomainPurpose
) -> bool:
    """Default-deny: True only if `email`'s domain is on the org's
    allowlist *for this purpose* -- a domain enabled only for Planners
    doesn't let anyone become Program Manager, and vice versa. Gates every path
    to both roles: grant_program_manager ("program_manager") and
    grant_member_role's Planner grant ("planner")."""
    allowed = {d.domain for d in list_allowed_domains(session, organization_id, purpose)}
    return email.rsplit("@", 1)[-1].lower() in allowed


def require_email_domain_allowed(
    session: Session, organization_id: uuid.UUID, email: str, purpose: DomainPurpose
) -> None:
    if not is_email_domain_allowed(session, organization_id, email, purpose):
        code, message = _DOMAIN_NOT_ALLOWED[purpose]
        raise AppException(
            code,
            message,
            403,
            log_level=logging.WARNING,
        )


def list_allowed_domains_paginated(
    session: Session,
    organization_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name"] = "created_at",
    q: str | None = None,
) -> tuple[list[OrganizationAllowedDomain], int]:
    where_clause = [OrganizationAllowedDomain.organization_id == organization_id]
    if q:
        where_clause.append(OrganizationAllowedDomain.domain.ilike(f"%{q}%"))

    total = session.exec(
        select(func.count()).select_from(OrganizationAllowedDomain).where(*where_clause)
    ).one()

    sort_column = (
        OrganizationAllowedDomain.domain
        if sort_by == "name"
        else OrganizationAllowedDomain.created_at
    )
    order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    # Stable tiebreaker among equal sort keys across paginated queries.
    items = list(
        session.exec(
            select(OrganizationAllowedDomain)
            .where(*where_clause)
            .order_by(order, OrganizationAllowedDomain.id)
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def add_allowed_domain(
    session: Session,
    organization_id: uuid.UUID,
    domain: str,
    allows_program_manager: bool = False,
    allows_planner: bool = True,
) -> OrganizationAllowedDomain:
    domain = domain.lower()
    existing = session.exec(
        select(OrganizationAllowedDomain).where(
            OrganizationAllowedDomain.organization_id == organization_id,
            OrganizationAllowedDomain.domain == domain,
        )
    ).first()
    if existing is not None:
        raise AppException(
            "DOMAIN_ALREADY_ALLOWED",
            "This domain is already on the allowed list.",
            409,
            log_level=logging.WARNING,
        )

    entry = OrganizationAllowedDomain(
        organization_id=organization_id,
        domain=domain,
        allows_program_manager=allows_program_manager,
        allows_planner=allows_planner,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    module_logger.info("Domain %s added to allowlist for organization %s.", domain, organization_id)
    return entry


def update_allowed_domain_scopes(
    session: Session,
    organization_id: uuid.UUID,
    domain_id: int,
    allows_program_manager: bool,
    allows_planner: bool,
) -> OrganizationAllowedDomain:
    """Change which grants a domain is allowlisted for. Like every
    allowlist check, it only affects future grants -- existing Program Managers
    and Planners keep their role."""
    entry = _get_allowed_domain_or_404(session, organization_id, domain_id)
    entry.allows_program_manager = allows_program_manager
    entry.allows_planner = allows_planner
    session.add(entry)
    session.commit()
    session.refresh(entry)
    module_logger.info(
        "Allowlist scopes for domain %s on organization %s set to program_manager=%s, planner=%s.",
        entry.domain,
        organization_id,
        allows_program_manager,
        allows_planner,
    )
    return entry


def _get_allowed_domain_or_404(
    session: Session, organization_id: uuid.UUID, domain_id: int
) -> OrganizationAllowedDomain:
    entry = session.exec(
        select(OrganizationAllowedDomain).where(
            OrganizationAllowedDomain.id == domain_id,
            OrganizationAllowedDomain.organization_id == organization_id,
        )
    ).first()
    if entry is None:
        raise AppException(
            "DOMAIN_NOT_FOUND",
            "This domain isn't on the allowed list.",
            404,
            log_level=logging.WARNING,
        )
    return entry


def remove_allowed_domain(session: Session, organization_id: uuid.UUID, domain_id: int) -> str:
    """Remove an allowed domain; returns the domain it was."""
    entry = _get_allowed_domain_or_404(session, organization_id, domain_id)

    # AllowedDomainTagAssignment has a plain FK to
    # organization_allowed_domain.id with no ondelete cascade -- clear it
    # first or deleting the domain below hits a ForeignKeyViolation, same
    # reasoning as revoke_planner's own assignment cleanup.
    for row in session.exec(
        select(AllowedDomainTagAssignment).where(
            AllowedDomainTagAssignment.organization_allowed_domain_id == entry.id
        )
    ):
        session.delete(row)
    session.flush()

    session.delete(entry)
    session.commit()
    module_logger.info(
        "Domain %s removed from allowlist for organization %s.", entry.domain, organization_id
    )
    return entry.domain


def set_allowed_domain_tags(
    session: Session, organization_id: uuid.UUID, domain_id: int, tag_ids: list[uuid.UUID]
) -> tuple[OrganizationAllowedDomain, list[OrganizationTag]]:
    """Full-replace the Organization-tag set on one allowed-domain row.
    Mirrors set_planner_tags' own delete-flush-dedupe-insert shape
    exactly. Caller (the endpoint) is already authorized via
    require_program_manager_of."""
    entry = _get_allowed_domain_or_404(session, organization_id, domain_id)
    existing = session.exec(
        select(AllowedDomainTagAssignment).where(
            AllowedDomainTagAssignment.organization_allowed_domain_id == entry.id
        )
    ).all()
    validate_organization_tag_ids_belong_to_org(
        session, organization_id, tag_ids, {row.organization_tag_id for row in existing}
    )
    for row in existing:
        session.delete(row)
    session.flush()
    for tag_id in dict.fromkeys(tag_ids):
        session.add(
            AllowedDomainTagAssignment(
                organization_tag_id=tag_id, organization_allowed_domain_id=entry.id
            )
        )
    session.commit()

    tags = (
        list(session.exec(select(OrganizationTag).where(OrganizationTag.id.in_(tag_ids))))
        if tag_ids
        else []
    )
    return entry, tags


def list_tags_for_allowed_domains(
    session: Session, domain_ids: list[int]
) -> dict[int, list[OrganizationTag]]:
    """Batch-fetch, mirroring list_tags_for_planner_memberships' own
    pattern -- one query for a whole page of allowed-domain rows, not
    N+1."""
    if not domain_ids:
        return {}
    rows = session.exec(
        select(AllowedDomainTagAssignment, OrganizationTag)
        .join(
            OrganizationTag,
            OrganizationTag.id == AllowedDomainTagAssignment.organization_tag_id,
        )
        .where(AllowedDomainTagAssignment.organization_allowed_domain_id.in_(domain_ids))
    )
    result: dict[int, list[OrganizationTag]] = {}
    for assignment, tag in rows:
        result.setdefault(assignment.organization_allowed_domain_id, []).append(tag)
    return result


def set_default_organization(session: Session, user: User, organization_id: uuid.UUID) -> None:
    memberships = list_user_organizations(session, user)
    if not any(o.organization_id == organization_id for o in memberships):
        raise AppException(
            "ORGANIZATION_NOT_FOUND", "You are not a member of this organization.", 404
        )

    if user.default_organization_id != organization_id:
        # A role/exercise default only means something inside its org.
        user.default_role = None
        user.default_ttx_id = None
    user.default_organization_id = organization_id
    session.add(user)
    session.commit()


ContextRole = Literal[
    "program_manager", "planner", "controller", "facilitator", "evaluator", "observer", "player"
]


def held_roles_in_organization(
    session: Session, user: User, organization_id: uuid.UUID
) -> set[str]:
    """The roles `user` can act as in one organization -- the server-side
    twin of the frontend's heldRoles (moduleAccess.ts): Program Manager and
    Planner from org-scoped grants, every exercise role (Controller and
    Facilitator from the planning and control team flags) from per-TTX
    access on that org's exercises. Observer/Evaluator org grants alone
    aren't acting roles -- only an exercise assignment is."""
    roles: set[str] = set()
    org_roles = session.exec(
        select(OrganizationMembership.role).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.organization_id == organization_id,
            active_membership(),
        )
    ).all()
    if OrgRoleEnum.PROGRAM_MANAGER in org_roles:
        roles.add("program_manager")
    if OrgRoleEnum.PLANNER in org_roles:
        roles.add("planner")
    for access in session.exec(
        select(TTXAccess)
        .join(TTX, TTX.id == TTXAccess.ttx_id)
        .where(TTXAccess.user_id == user.id, TTX.organization_id == organization_id)
    ):
        roles.update(access.context_roles())
    return roles


def set_default_context(
    session: Session,
    user: User,
    organization_id: uuid.UUID | None,
    role: ContextRole | None,
    ttx_id: uuid.UUID | None,
) -> None:
    """Save the login-time default context (Preferences -> Default
    selection). Each level is optional but needs the one above it: a role
    needs an organization, an exercise needs a role. Everything is checked
    against what the user holds *now*; if it stops being valid later
    (access revoked, exercise deleted), the client falls back to the first
    available combination rather than this being rejected at login."""

    def invalid(message: str) -> AppException:
        return AppException("INVALID_DEFAULT_CONTEXT", message, 400, log_level=logging.WARNING)

    if organization_id is None and (role is not None or ttx_id is not None):
        raise invalid("Choose an organization before a role or exercise.")
    if role is None and ttx_id is not None:
        raise invalid("Choose a role before an exercise.")

    if organization_id is not None:
        if not any(
            o.organization_id == organization_id for o in list_user_organizations(session, user)
        ):
            raise AppException(
                "ORGANIZATION_NOT_FOUND", "You are not a member of this organization.", 404
            )
        if role is not None and role not in held_roles_in_organization(
            session, user, organization_id
        ):
            raise invalid("You don't hold this role in this organization.")
        if ttx_id is not None:
            if role == "program_manager":
                raise invalid("A Program Manager default has no exercise.")
            access = session.exec(
                select(TTXAccess)
                .join(TTX, TTX.id == TTXAccess.ttx_id)
                .where(
                    TTXAccess.user_id == user.id,
                    TTXAccess.ttx_id == ttx_id,
                    TTX.organization_id == organization_id,
                )
            ).first()
            if access is None or role not in access.context_roles():
                raise AppException(
                    "TTX_NOT_FOUND", "You have no access to this exercise with this role.", 404
                )

    user.default_organization_id = organization_id
    user.default_role = role
    user.default_ttx_id = ttx_id
    session.add(user)
    session.commit()


_LEAVE_CASCADE = (OrgRoleEnum.PLANNER, OrgRoleEnum.EVALUATOR, OrgRoleEnum.OBSERVER)


@dataclass(frozen=True)
class LeaveExercise:
    """One of the organization's exercises the person sits on (not as a
    Player): what leaving does there."""

    ttx: TTX
    seats: list[str]
    # "planner" / "controller": the only one on the team -- leaving is
    # refused until someone else is added.
    blocked: Literal["planner", "controller"] | None
    # Leads the planning team with someone else to take over: they choose.
    lead_candidates: list[User]


@dataclass(frozen=True)
class LeavePreview:
    is_program_manager: bool
    is_last_program_manager: bool
    # Active members who could take the Program Manager role.
    program_manager_candidates: list[User]
    exercises: list[LeaveExercise]


def _user_memberships(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, lock: bool = False
) -> list[OrganizationMembership]:
    query = select(OrganizationMembership).where(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.user_id == user_id,
    )
    memberships = list(session.exec(query.with_for_update() if lock else query))
    if not memberships:
        raise AppException("MEMBER_NOT_FOUND", "This user holds no role here.", 404)
    return memberships


def _other_program_managers(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID, lock: bool = False
) -> list[OrganizationMembership]:
    query = select(OrganizationMembership).where(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
        OrganizationMembership.user_id != user_id,
        active_membership(),
    )
    return list(session.exec(query.with_for_update() if lock else query))


def _program_manager_candidates(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID
) -> list[User]:
    """Active members of the organization, other than the person leaving,
    who aren't Program Managers there yet, whose account is usable and
    whose email domain the allowlist accepts for the role (the same rules
    as granting it from Users and roles)."""
    managers = select(OrganizationMembership.user_id).where(
        OrganizationMembership.organization_id == organization_id,
        OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
    )
    members = select(OrganizationMembership.user_id).where(
        OrganizationMembership.organization_id == organization_id, active_membership()
    )
    allowed = {d.domain for d in list_allowed_domains(session, organization_id, "program_manager")}
    return [
        user
        for user in session.exec(
            select(User)
            .where(
                User.id.in_(members),
                User.id.not_in(managers),
                User.id != user_id,
                User.is_active.is_(True),
                User.suspended_at.is_(None),
            )
            .order_by(User.full_name)
        )
        if user.email.rsplit("@", 1)[-1].lower() in allowed
    ]


def leave_preview(session: Session, organization_id: uuid.UUID, user: User) -> LeavePreview:
    """What leaving the organization would take (read-only): the Program
    Manager hand-over and every exercise seat that goes with it."""
    from app.services.ttx_planning_team_service import lead_user_id, list_planning_team

    memberships = _user_memberships(session, organization_id, user.id)
    is_manager = any(
        m.role == OrgRoleEnum.PROGRAM_MANAGER and m.disabled_at is None for m in memberships
    )
    exercises = []
    for access, ttx in member_exercise_accesses(session, organization_id, user.id):
        if access.role == RoleEnum.PLAYER:
            continue
        blocked = None
        candidates: list[User] = []
        if access.role == RoleEnum.PLANNER:
            team = list_planning_team(session, ttx)
            others = [a for a, u in team if u.id != user.id]
            if access.plans and not any(a.plans for a in others):
                blocked = "planner"
            elif access.controls and not any(a.controls for a in others):
                blocked = "controller"
            elif lead_user_id(ttx, team) == user.id:
                candidates = [u for a, u in team if a.plans and u.id != user.id]
        exercises.append(LeaveExercise(ttx, sorted(access.context_roles()), blocked, candidates))
    return LeavePreview(
        is_program_manager=is_manager,
        is_last_program_manager=is_manager
        and not _other_program_managers(session, organization_id, user.id),
        program_manager_candidates=_program_manager_candidates(session, organization_id, user.id),
        exercises=exercises,
    )


def leave_organization(
    session: Session,
    organization_id: uuid.UUID,
    user: User,
    confirmation: str,
    program_manager_successor_id: uuid.UUID | None,
    lead_successors: dict[uuid.UUID, uuid.UUID],
) -> User | None:
    """The person leaves on their own: every grant goes, and with them
    every seat on the organization's exercises but a Player's (Players
    leave an exercise through its Planners). The last Program Manager hands
    the role to another member first; a Program Manager may hand it over
    anyway. Exercises they lead go to the Planner they chose; one where
    they're the only Planner or Controller blocks it. Returns the new
    Program Manager, if any."""
    organization = get_organization(session, organization_id)
    if confirmation.strip() != organization.name.strip():
        raise AppException(
            "CONFIRMATION_MISMATCH",
            "Type the organization's name exactly.",
            400,
            log_level=logging.WARNING,
        )
    memberships = _user_memberships(session, organization_id, user.id, lock=True)
    is_manager = any(
        m.role == OrgRoleEnum.PROGRAM_MANAGER and m.disabled_at is None for m in memberships
    )
    successor: User | None = None
    if program_manager_successor_id is not None:
        candidates = {
            c.id: c for c in _program_manager_candidates(session, organization_id, user.id)
        }
        successor = candidates.get(program_manager_successor_id)
        if not is_manager or successor is None:
            raise AppException(
                "INVALID_PROGRAM_MANAGER_SUCCESSOR",
                "The new Program Manager must be another active member of the organization.",
                400,
                log_level=logging.WARNING,
            )
    elif is_manager and not _other_program_managers(session, organization_id, user.id, lock=True):
        raise AppException(
            "PROGRAM_MANAGER_SUCCESSOR_REQUIRED",
            "You are the last Program Manager: choose who takes over first.",
            409,
            log_level=logging.WARNING,
        )
    for role in _LEAVE_CASCADE:
        _cascade_to_exercises(session, organization_id, user.id, role, lead_successors)
    if successor is not None:
        _add_program_manager(session, organization_id, successor)
    _delete_memberships(session, memberships)
    if user.default_organization_id == organization_id:
        user.default_organization_id = None
        user.default_role = None
        user.default_ttx_id = None
        session.add(user)
    session.commit()
    module_logger.info(
        "User %s left organization %s (Program Manager handed to %s).",
        user.id,
        organization_id,
        successor.id if successor else None,
    )
    return successor
