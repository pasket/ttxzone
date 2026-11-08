"""Platform -> Accounts: the instance administrator suspends an account
across the whole deployment, whatever its organizations. A suspended
account can't sign in and loses every session at once; nothing of it is
deleted (grants, exercise seats, notes, ratings stay) and its email stays
taken, so reactivating it brings everything back. Deleting an account for
good stays the person's own call (auth_service.deactivate_account)."""

import logging
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import exists, func, or_
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import Organization, OrganizationMembership, OrgRoleEnum, User, active_membership
from app.services import session_service

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class AccountOrganization:
    id: uuid.UUID
    name: str
    roles: list[str]
    # Their access there is disabled (removed while still on its exercises).
    disabled: bool
    # The organization's only active Program Manager: suspending them
    # leaves it without one until Platform names another.
    sole_program_manager: bool


def _account_not_found() -> AppException:
    return AppException(
        "ACCOUNT_NOT_FOUND", "No active account with this id.", 404, log_level=logging.WARNING
    )


def get_account(session: Session, user_id: uuid.UUID) -> User:
    """Active accounts only: a deleted one is anonymized, nothing to manage."""
    user = session.get(User, user_id)
    if user is None or not user.is_active:
        raise _account_not_found()
    return user


AccountStatus = Literal["all", "active", "suspended"]
AccountSort = Literal["created_at", "name", "last_login"]


@dataclass(frozen=True)
class AccountFilters:
    """Platform -> Accounts' filters, all combined: the account's state,
    an organization it belongs to (or none at all), a role it holds (in
    that organization when one is picked, else in any), and whether it
    administers the instance."""

    status: AccountStatus = "all"
    # An organization's id, "none" (in no organization) or None (any).
    organization: uuid.UUID | Literal["none"] | None = None
    role: OrgRoleEnum | None = None
    instance_admin: bool | None = None


def list_accounts(
    session: Session,
    q: str | None,
    limit: int,
    offset: int,
    filters: AccountFilters = AccountFilters(),
    sort_by: AccountSort = "created_at",
    sort_dir: Literal["asc", "desc"] = "desc",
) -> tuple[list[User], int]:
    """A never-signed-in account counts as the least recent login, like
    every people table. A role counts only while its grant does (not
    disabled)."""
    where_clause = [User.is_active.is_(True)]
    if q:
        pattern = f"%{q}%"
        where_clause.append(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
    if filters.status == "suspended":
        where_clause.append(User.suspended_at.is_not(None))
    elif filters.status == "active":
        where_clause.append(User.suspended_at.is_(None))
    if filters.instance_admin is not None:
        where_clause.append(User.is_instance_admin.is_(filters.instance_admin))
    if filters.organization == "none":
        where_clause.append(~exists().where(OrganizationMembership.user_id == User.id))
    membership = [OrganizationMembership.user_id == User.id]
    if isinstance(filters.organization, uuid.UUID):
        membership.append(OrganizationMembership.organization_id == filters.organization)
    if filters.role is not None:
        membership += [OrganizationMembership.role == filters.role, active_membership()]
    if len(membership) > 1:
        where_clause.append(exists().where(*membership))
    column = {"name": User.full_name, "last_login": User.last_login_at}.get(
        sort_by, User.created_at
    )
    if sort_dir == "asc":
        order = column.asc().nulls_first()
    else:
        order = column.desc().nulls_last()
    total = session.exec(select(func.count()).select_from(User).where(*where_clause)).one()
    users = list(
        session.exec(
            select(User).where(*where_clause).order_by(order, User.id).limit(limit).offset(offset)
        )
    )
    return users, total


def organizations_of(
    session: Session, user_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[AccountOrganization]]:
    """Each account's organizations, with its roles there and whether it's
    that organization's only active Program Manager."""
    if not user_ids:
        return {}
    rows = list(
        session.exec(
            select(OrganizationMembership, Organization)
            .join(Organization, Organization.id == OrganizationMembership.organization_id)
            .where(OrganizationMembership.user_id.in_(user_ids))
            .order_by(Organization.name, OrganizationMembership.created_at)
        )
    )
    # Active Program Managers per organization, counting only accounts
    # that can still sign in.
    managers: dict[uuid.UUID, set[uuid.UUID]] = {}
    for organization_id, manager_id in session.exec(
        select(OrganizationMembership.organization_id, OrganizationMembership.user_id)
        .join(User, User.id == OrganizationMembership.user_id)
        .where(
            OrganizationMembership.organization_id.in_({o.id for _, o in rows}),
            OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
            active_membership(),
            User.is_active.is_(True),
            User.suspended_at.is_(None),
        )
    ):
        managers.setdefault(organization_id, set()).add(manager_id)

    grouped: dict[tuple[uuid.UUID, uuid.UUID], list[OrganizationMembership]] = {}
    names: dict[uuid.UUID, str] = {}
    for membership, organization in rows:
        grouped.setdefault((membership.user_id, organization.id), []).append(membership)
        names[organization.id] = organization.name
    result: dict[uuid.UUID, list[AccountOrganization]] = {}
    for (user_id, organization_id), memberships in grouped.items():
        result.setdefault(user_id, []).append(
            AccountOrganization(
                id=organization_id,
                name=names[organization_id],
                roles=[m.role.value for m in memberships],
                disabled=any(m.disabled_at is not None for m in memberships),
                sole_program_manager=managers.get(organization_id, set()) == {user_id},
            )
        )
    return result


def _active_instance_admins(session: Session) -> int:
    return session.exec(
        select(func.count())
        .select_from(User)
        .where(
            User.is_instance_admin.is_(True),
            User.is_active.is_(True),
            User.suspended_at.is_(None),
        )
    ).one()


def suspend_account(session: Session, user: User, actor_id: uuid.UUID | None) -> None:
    """`actor_id` None: from the server's console (scripts.instance_admin)."""
    if user.id == actor_id:
        raise AppException(
            "CANNOT_SUSPEND_YOURSELF",
            "You can't suspend your own account.",
            409,
            log_level=logging.WARNING,
        )
    if user.suspended_at is not None:
        return
    if user.is_instance_admin and _active_instance_admins(session) <= 1:
        raise AppException(
            "LAST_INSTANCE_ADMIN",
            "This is the last instance administrator: grant another one first.",
            409,
            log_level=logging.WARNING,
        )
    user.suspended_at = datetime.now(UTC)
    # A login waiting on its second factor can't complete either.
    user.mfa_pending_jti = None
    session.add(user)
    session.commit()
    session_service.revoke_sessions(session, user)
    logger.warning("User %s suspended by %s.", user.id, actor_id or "the console")


def reactivate_account(session: Session, user: User, actor_id: uuid.UUID | None) -> None:
    if user.suspended_at is None:
        return
    user.suspended_at = None
    session.add(user)
    session.commit()
    logger.warning("User %s reactivated by %s.", user.id, actor_id or "the console")
