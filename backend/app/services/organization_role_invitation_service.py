"""Organization roles offered by invitation (docs/features/admin.md ->
Invitations to the organization).

Where any account may found an organization ("open" tenancy), whoever
founds one becomes its Program Manager. Granting a role straight to any
address would let that stranger probe which addresses hold an account,
pull their owners in without asking and read their name and last sign-in.
So there a Program Manager grants directly only to the organization's own
domain (the founder's, fixed at signup) and to people already in it;
anyone else gets an offer they accept or decline from their own account.

The offer is kept by address and answered the same whether an account
exists or not. It notifies the account (in the app, and by email while
the deployment sends it) only when there is one; the Program Manager sees
the address they typed and nothing about its owner until they accept.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.models import (
    MembershipTagAssignment,
    Organization,
    OrganizationMembership,
    OrganizationRoleInvitation,
    OrganizationTag,
    OrgRoleEnum,
    User,
    active_membership,
)
from app.services import account_email_service, email_service, platform_audit_service
from app.services.organization_service import (
    _refuse_suspended,
    get_organization,
    is_email_domain_allowed,
    require_email_domain_allowed,
)
from app.services.organization_tag_service import validate_organization_tag_ids_belong_to_org
from app.services.tenancy_service import effective_policy

logger = logging.getLogger(__name__)

INVITATION_TTL = timedelta(days=14)
# Offers one organization may make in an hour: enough for onboarding a
# team, not for sweeping a list of addresses.
MAX_PER_ORGANIZATION_PER_HOUR = 50

# Hierarchy order, the one roles are granted and shown in.
ROLE_ORDER = (
    OrgRoleEnum.PROGRAM_MANAGER,
    OrgRoleEnum.PLANNER,
    OrgRoleEnum.OBSERVER,
    OrgRoleEnum.EVALUATOR,
)
# The email's own copy (it renders outside the SPA): long names, as in any
# descriptive text.
_ROLE_NAMES = {
    "en": {
        OrgRoleEnum.PROGRAM_MANAGER: "Exercise Program Manager",
        OrgRoleEnum.PLANNER: "Exercise Planner",
        OrgRoleEnum.OBSERVER: "Observer",
        OrgRoleEnum.EVALUATOR: "Evaluator",
    },
    "es": {
        OrgRoleEnum.PROGRAM_MANAGER: "Responsable del Programa de Ejercicios",
        OrgRoleEnum.PLANNER: "Planificador de ejercicios",
        OrgRoleEnum.OBSERVER: "Observador",
        OrgRoleEnum.EVALUATOR: "Evaluador",
    },
}

InviteOutcome = Literal["invited", "granted"]


def _not_found() -> AppException:
    # The same answer whatever went wrong (unknown, someone else's,
    # expired): the person only ever sees their own offers.
    return AppException(
        "ROLE_INVITATION_NOT_FOUND",
        "This invitation doesn't exist or has expired.",
        404,
        log_level=logging.WARNING,
    )


def _ordered(roles: list[OrgRoleEnum] | list[str]) -> list[OrgRoleEnum]:
    wanted = {OrgRoleEnum(role) for role in roles}
    return [role for role in ROLE_ORDER if role in wanted]


def _domain(email: str) -> str:
    return email.rsplit("@", 1)[-1].lower()


def _active_member(session: Session, organization_id: uuid.UUID, email: str) -> User | None:
    """The account with this address, if it holds an active grant in the
    organization (the Program Manager already sees it in Users and roles)."""
    return session.exec(
        select(User)
        .join(OrganizationMembership, col(OrganizationMembership.user_id) == User.id)
        .where(
            User.email == email,
            OrganizationMembership.organization_id == organization_id,
            active_membership(),
        )
    ).first()


def requires_invitation(session: Session, organization_id: uuid.UUID, email: str) -> bool:
    """True where a role for this address must be offered, not granted:
    "open" tenancy, outside the organization's own domain, and nobody in
    it holds the address. Decided before any account is looked up."""
    if effective_policy(session).mode != "open":
        return False
    email = email.lower()
    organization = get_organization(session, organization_id)
    if organization.domain and _domain(email) == organization.domain.lower():
        return False
    return _active_member(session, organization_id, email) is None


def require_direct_grant(session: Session, organization_id: uuid.UUID, email: str) -> None:
    """Guard of the direct grant routes (Admin -> Users and roles): refuses
    the same way whether the address holds an account or not."""
    if requires_invitation(session, organization_id, email):
        raise AppException(
            "ROLE_INVITATION_REQUIRED",
            "Outside the organization's own domain, people join by accepting an invitation.",
            409,
            log_level=logging.WARNING,
        )


def _live(now: datetime):
    return OrganizationRoleInvitation.expires_at > now


def _require_domains(
    session: Session, organization_id: uuid.UUID, email: str, roles: list[OrgRoleEnum]
) -> None:
    """Program Manager and Planner stay domain-allowlisted, checked on the
    address alone (no account lookup)."""
    if OrgRoleEnum.PROGRAM_MANAGER in roles:
        require_email_domain_allowed(session, organization_id, email, "program_manager")
    if OrgRoleEnum.PLANNER in roles:
        require_email_domain_allowed(session, organization_id, email, "planner")


def _role_allowed(
    session: Session, organization_id: uuid.UUID, email: str, role: OrgRoleEnum
) -> bool:
    if role == OrgRoleEnum.PROGRAM_MANAGER:
        return is_email_domain_allowed(session, organization_id, email, "program_manager")
    if role == OrgRoleEnum.PLANNER:
        return is_email_domain_allowed(session, organization_id, email, "planner")
    return True


def _held_roles(
    session: Session, organization_id: uuid.UUID, user_id: uuid.UUID
) -> list[OrganizationMembership]:
    return list(
        session.exec(
            select(OrganizationMembership).where(
                OrganizationMembership.organization_id == organization_id,
                OrganizationMembership.user_id == user_id,
            )
        )
    )


def _grant(
    session: Session,
    organization_id: uuid.UUID,
    user: User,
    roles: list[OrgRoleEnum],
    tag_ids: list[uuid.UUID],
    replace_tags: bool,
) -> list[OrgRoleEnum]:
    """Adds the roles the person doesn't hold yet (no commit) and tags
    every grant they hold here. Returns the roles added."""
    held = _held_roles(session, organization_id, user.id)
    held_roles = {membership.role for membership in held}
    added: list[OrgRoleEnum] = []
    for role in roles:
        if role in held_roles:
            continue
        if role == OrgRoleEnum.PROGRAM_MANAGER:
            _refuse_suspended(user)
        membership = OrganizationMembership(
            user_id=user.id, organization_id=organization_id, role=role
        )
        session.add(membership)
        held.append(membership)
        added.append(role)
    session.flush()

    existing_tags = {tag.id for tag in _org_tags(session, organization_id, tag_ids)}
    wanted = [tag_id for tag_id in dict.fromkeys(tag_ids) if tag_id in existing_tags]
    if not wanted and not replace_tags:
        return added
    membership_ids = [membership.id for membership in held]
    assignments = list(
        session.exec(
            select(MembershipTagAssignment).where(
                col(MembershipTagAssignment.organization_membership_id).in_(membership_ids)
            )
        )
    )
    # Every grant carries the person's whole set (Users and roles tags a
    # person, not a grant).
    current = {row.organization_tag_id for row in assignments}
    final = wanted if replace_tags else list(dict.fromkeys([*current, *wanted]))
    for row in assignments:
        session.delete(row)
    session.flush()
    for membership_id in membership_ids:
        for tag_id in final:
            session.add(
                MembershipTagAssignment(
                    organization_tag_id=tag_id, organization_membership_id=membership_id
                )
            )
    return added


def _org_tags(
    session: Session, organization_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> list[OrganizationTag]:
    if not tag_ids:
        return []
    return list(
        session.exec(
            select(OrganizationTag).where(
                OrganizationTag.organization_id == organization_id,
                col(OrganizationTag.id).in_(tag_ids),
            )
        )
    )


def _notify(
    session: Session,
    invitation: OrganizationRoleInvitation,
    organization: Organization,
    inviter: User,
    locale: str | None,
) -> None:
    """An email to the account with this address, if there is one and the
    deployment sends email. Nothing tells the Program Manager either way."""
    if not account_email_service.available(session):
        return
    account = session.exec(
        select(User).where(
            User.email == invitation.email,
            User.is_active.is_(True),
            User.suspended_at.is_(None),
        )
    ).first()
    if account is None:
        return
    names = _ROLE_NAMES.get(locale or "", _ROLE_NAMES["en"])
    params = {
        "inviter": inviter.full_name,
        "organization": organization.name,
        "roles": ", ".join(names[OrgRoleEnum(role)] for role in invitation.roles),
        "link": f"{settings.PUBLIC_BASE_URL}/",
        "days": INVITATION_TTL.days,
    }
    email_service.queue(session, invitation.email, "role_invitation", params, locale)


def invite(
    session: Session,
    organization_id: uuid.UUID,
    inviter: User,
    email: str,
    roles: list[OrgRoleEnum],
    tag_ids: list[uuid.UUID],
    locale: str | None,
) -> InviteOutcome:
    """Offers the roles to an address and commits. Someone already in the
    organization gets them at once ("granted"); anyone else an offer
    ("invited"), the same answer whether the address holds an account."""
    email = email.lower()
    wanted = _ordered(roles)
    if not wanted:
        raise AppException(
            "ROLE_INVITATION_NO_ROLES", "Choose at least one role.", 422, log_level=logging.WARNING
        )
    validate_organization_tag_ids_belong_to_org(session, organization_id, tag_ids, set())
    _require_domains(session, organization_id, email, wanted)
    organization = get_organization(session, organization_id)

    if not requires_invitation(session, organization_id, email):
        member = session.exec(select(User).where(User.email == email)).first()
        if member is None:
            raise AppException(
                "USER_NOT_FOUND",
                "No account exists for this email.",
                404,
                log_level=logging.WARNING,
            )
        _grant(session, organization_id, member, wanted, tag_ids, replace_tags=bool(tag_ids))
        session.commit()
        logger.info(
            "User %s granted %s on organization %s by user %s.",
            member.id,
            ",".join(wanted),
            organization_id,
            inviter.id,
        )
        return "granted"

    now = datetime.now(UTC)
    recent = session.exec(
        select(func.count())
        .select_from(OrganizationRoleInvitation)
        .where(
            OrganizationRoleInvitation.organization_id == organization_id,
            OrganizationRoleInvitation.sent_at >= now - timedelta(hours=1),
        )
    ).one()
    if recent >= MAX_PER_ORGANIZATION_PER_HOUR:
        raise AppException(
            "ROLE_INVITATIONS_RATE_LIMITED",
            "Too many invitations in the last hour. Try again later.",
            429,
            log_level=logging.WARNING,
        )

    invitation = session.exec(
        select(OrganizationRoleInvitation).where(
            OrganizationRoleInvitation.organization_id == organization_id,
            OrganizationRoleInvitation.email == email,
        )
    ).first()
    if invitation is None:
        invitation = OrganizationRoleInvitation(
            organization_id=organization_id,
            email=email,
            invited_by_id=inviter.id,
            expires_at=now + INVITATION_TTL,
        )
    elif invitation.expires_at > now:
        # A renewal adds to what was still on offer.
        wanted = _ordered([*invitation.roles, *wanted])
    invitation.roles = [str(role) for role in wanted]
    invitation.tag_ids = list(dict.fromkeys(tag_ids))
    invitation.invited_by_id = inviter.id
    invitation.sent_at = now
    invitation.expires_at = now + INVITATION_TTL
    session.add(invitation)
    _notify(session, invitation, organization, inviter, locale)
    platform_audit_service.record(
        session,
        inviter,
        "organization.role_invited",
        "organization",
        organization.id,
        organization.name,
        {"email": email, "roles": invitation.roles},
    )
    session.commit()
    logger.info("Organization %s offered roles to an address.", organization_id)
    return "invited"


def list_for_organization(
    session: Session, organization_id: uuid.UUID
) -> list[tuple[OrganizationRoleInvitation, User | None]]:
    """The offers still open, newest first, with who made them."""
    now = datetime.now(UTC)
    rows = session.exec(
        select(OrganizationRoleInvitation)
        .where(OrganizationRoleInvitation.organization_id == organization_id, _live(now))
        .order_by(col(OrganizationRoleInvitation.sent_at).desc())
    ).all()
    inviters = _users(session, {row.invited_by_id for row in rows})
    return [(row, inviters.get(row.invited_by_id)) for row in rows]


def _users(session: Session, ids: set[uuid.UUID]) -> dict[uuid.UUID, User]:
    if not ids:
        return {}
    return {user.id: user for user in session.exec(select(User).where(col(User.id).in_(ids)))}


def withdraw(
    session: Session, organization_id: uuid.UUID, invitation_id: uuid.UUID, actor: User
) -> None:
    invitation = session.get(OrganizationRoleInvitation, invitation_id)
    if invitation is None or invitation.organization_id != organization_id:
        raise _not_found()
    organization = get_organization(session, organization_id)
    platform_audit_service.record(
        session,
        actor,
        "organization.role_invitation_withdrawn",
        "organization",
        organization.id,
        organization.name,
        {"email": invitation.email, "roles": invitation.roles},
    )
    session.delete(invitation)
    session.commit()


def _can_receive(session: Session, user: User) -> bool:
    """An address still to be confirmed proves nothing: its offers wait."""
    return not account_email_service.verification_pending(session, user)


def list_mine(
    session: Session, user: User
) -> list[tuple[OrganizationRoleInvitation, Organization, User | None]]:
    if not _can_receive(session, user):
        return []
    now = datetime.now(UTC)
    rows = session.exec(
        select(OrganizationRoleInvitation, Organization)
        .join(Organization, col(Organization.id) == OrganizationRoleInvitation.organization_id)
        .where(OrganizationRoleInvitation.email == user.email.lower(), _live(now))
        .order_by(col(OrganizationRoleInvitation.sent_at).desc())
    ).all()
    inviters = _users(session, {invitation.invited_by_id for invitation, _ in rows})
    return [
        (invitation, organization, inviters.get(invitation.invited_by_id))
        for invitation, organization in rows
    ]


def _mine(session: Session, user: User, invitation_id: uuid.UUID) -> OrganizationRoleInvitation:
    invitation = session.get(OrganizationRoleInvitation, invitation_id)
    if (
        invitation is None
        or invitation.email != user.email.lower()
        or invitation.expires_at <= datetime.now(UTC)
        or not _can_receive(session, user)
    ):
        raise _not_found()
    return invitation


def accept(
    session: Session, user: User, invitation_id: uuid.UUID
) -> tuple[Organization, list[OrgRoleEnum]]:
    """Grants what is still allowed (the allowlist may have changed since
    the offer) and commits. Returns the organization and the roles added."""
    invitation = _mine(session, user, invitation_id)
    organization = get_organization(session, invitation.organization_id)
    held = _held_roles(session, organization.id, user.id)
    if any(membership.disabled_at is not None for membership in held):
        raise AppException(
            "MEMBER_DISABLED",
            "You were removed from this organization. Ask its Program Manager to enable you.",
            409,
            log_level=logging.WARNING,
        )
    roles = [
        role
        for role in _ordered(invitation.roles)
        if _role_allowed(session, organization.id, user.email, role)
    ]
    added = _grant(session, organization.id, user, roles, invitation.tag_ids, replace_tags=False)
    platform_audit_service.record(
        session,
        user,
        "organization.role_invitation_accepted",
        "organization",
        organization.id,
        organization.name,
        {"roles": [str(role) for role in added]},
    )
    session.delete(invitation)
    session.commit()
    logger.info(
        "User %s accepted roles %s on organization %s.", user.id, ",".join(added), organization.id
    )
    return organization, added


def decline(session: Session, user: User, invitation_id: uuid.UUID) -> None:
    invitation = _mine(session, user, invitation_id)
    organization = get_organization(session, invitation.organization_id)
    platform_audit_service.record(
        session,
        user,
        "organization.role_invitation_declined",
        "organization",
        organization.id,
        organization.name,
        {"roles": invitation.roles},
    )
    session.delete(invitation)
    session.commit()


def forget_address(session: Session, user: User) -> None:
    """When an account is deleted (in the caller's transaction): the offers
    waiting for its address go."""
    for invitation in session.exec(
        select(OrganizationRoleInvitation).where(
            OrganizationRoleInvitation.email == user.email.lower()
        )
    ):
        session.delete(invitation)


def delete_for_organization(session: Session, organization_id: uuid.UUID) -> None:
    """Part of the organization delete (organization_service.delete_organization)."""
    for invitation in session.exec(
        select(OrganizationRoleInvitation).where(
            OrganizationRoleInvitation.organization_id == organization_id
        )
    ):
        session.delete(invitation)
