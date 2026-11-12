"""Platform -> Accounts -> one account: what an instance administrator
does for a person -- correct their name or email, reset a forgotten
password (a temporary one, shown once, to be replaced at the next sign-in)
or a lost second factor, end their sessions -- and the summary of where
they work. An account that left no trace can be deleted for good; any
trace (an organization, an exercise, anything written or signed) keeps it,
and suspending is the alternative. Every change lands in Platform's
activity log. Never on your own account: that's Preferences."""

import logging
import secrets
import uuid
from dataclasses import dataclass
from typing import Literal

from sqlalchemy import delete, func, select, update
from sqlmodel import Session, SQLModel
from sqlmodel import select as sqlmodel_select

from app.core.exceptions import AppException
from app.core.password_policy import validate_password_strength
from app.models import (
    TTX,
    LegalAcceptance,
    Organization,
    PasswordHistory,
    PlatformAuditEvent,
    TotpBackupCode,
    TTXAccess,
    User,
    UserSession,
)
from app.services import (
    account_email_service,
    email_invitation_service,
    oidc_service,
    organization_role_invitation_service,
    platform_audit_service,
    session_service,
)
from app.services.account_suspension_service import AccountOrganization, organizations_of
from app.services.assistant import tokens as assistant_tokens
from app.services.avatar_service import delete_upload_file
from app.services.email_service import forget_recipient
from app.services.security_policy_service import effective_password_policy, set_password
from app.services.totp_service import count_unused_backup_codes

logger = logging.getLogger(__name__)

# Rows that go with the account when it's deleted (they describe the
# account itself, not work done in an organization).
_DELETED_WITH_ACCOUNT = {
    ("user_session", "user_id"),
    ("totp_backup_code", "user_id"),
    ("legal_acceptance", "user_id"),
    ("external_identity", "user_id"),
    ("oidc_login_state", "user_id"),
    ("account_token", "user_id"),
    # The AI assistant's tokens and their call records (assistant_tokens.forget_user).
    ("personal_access_token", "user_id"),
    ("assistant_call", "user_id"),
    ("assistant_proposal", "user_id"),
}
# Platform's activity log keeps the email (actor_label); only the link goes.
_DETACHED_ON_DELETE = {("platform_audit_event", "actor_user_id")}

# What each table referencing an account means to the person deleting it.
# A table missing here counts as "other" -- and blocks deletion: better to
# keep an account than to leave rows pointing nowhere
# (tests/test_account_admin.py fails when a new reference isn't listed).
DEPENDENCY_CATEGORIES: dict[str, str] = {
    "organization_membership": "organizations",
    "ttx_access": "exercises",
    "ttx_access_request": "exercise_requests",
    "ttx_leave_request": "exercise_requests",
    # Table names, not secrets (Bandit reads "token" as a password).
    "invitation_token": "invitations",  # nosec B105
    "invitation_token_redemption": "invitations",  # nosec B105
    "email_invitation": "invitations",
    "organization_role_invitation": "invitations",
    "organization_actor": "library",
    "organization_inject": "library",
    "organization_scenario": "library",
    "organization_threat_actor": "library",
    "legal_document_draft": "instance",
    "legal_document_version": "instance",
    "instance_settings": "instance",
    "platform_audit_webhook": "instance",
    "email_settings": "instance",
    "oidc_settings": "instance",
}
for _table in (
    "ttx",
    "ttx_conduct_prep",
    "conduct_prep_evaluator",
    "conduct_prep_snapshot",
    "ttx_msel",
    "msel_snapshot",
    "msel_image",
    "msel_file",
    "inject",
    "ttx_needs_form",
    "ttx_needs_form_approval",
    "ttx_needs_form_evidence",
    "exercise_run",
    "run_event",
    "run_feedback_submission",
    "run_note",
    "run_presence",
    "run_rating",
    "after_action_report",
    "after_action_snapshot",
):
    DEPENDENCY_CATEGORIES[_table] = "exercise_content"


def user_references() -> list[tuple[str, str]]:
    """Every (table, column) with a foreign key to an account."""
    return [
        (table.name, column.name)
        for table in SQLModel.metadata.sorted_tables
        for column in table.columns
        if any(fk.column.table.name == "user" for fk in column.foreign_keys)
    ]


def dependencies(session: Session, user: User) -> dict[str, int]:
    """What keeps the account from being deleted: rows per category."""
    counts: dict[str, int] = {}
    for table_name, column_name in user_references():
        if (table_name, column_name) in _DELETED_WITH_ACCOUNT | _DETACHED_ON_DELETE:
            continue
        table = SQLModel.metadata.tables[table_name]
        found = session.execute(
            select(func.count()).select_from(table).where(table.c[column_name] == user.id)
        ).scalar_one()
        if found:
            category = DEPENDENCY_CATEGORIES.get(table_name, "other")
            counts[category] = counts.get(category, 0) + found
    return counts


@dataclass(frozen=True)
class AccountExercise:
    id: uuid.UUID
    code: str
    name: str
    organization_id: uuid.UUID
    organization_name: str
    # TTXContextRole values (planner, controller, ..., player).
    roles: list[str]
    lead_evaluator: bool
    lead_planner: bool


@dataclass(frozen=True)
class AccountDetail:
    user: User
    organizations: list[AccountOrganization]
    exercises: list[AccountExercise]
    active_sessions: int
    backup_codes_remaining: int
    dependencies: dict[str, int]


_ROLE_ORDER = ["planner", "controller", "facilitator", "evaluator", "observer", "player"]


def account_detail(session: Session, user: User) -> AccountDetail:
    rows = session.exec(
        sqlmodel_select(TTXAccess, TTX, Organization)
        .join(TTX, TTX.id == TTXAccess.ttx_id)
        .join(Organization, Organization.id == TTX.organization_id)
        .where(TTXAccess.user_id == user.id)
        .order_by(Organization.name, TTX.code)
    ).all()
    exercises = [
        AccountExercise(
            id=ttx.id,
            code=ttx.code,
            name=ttx.name,
            organization_id=organization.id,
            organization_name=organization.name,
            roles=sorted(access.context_roles(), key=_ROLE_ORDER.index),
            lead_evaluator=access.leads,
            lead_planner=ttx.lead_planner_id == user.id,
        )
        for access, ttx, organization in rows
    ]
    return AccountDetail(
        user=user,
        organizations=organizations_of(session, [user.id]).get(user.id, []),
        exercises=exercises,
        active_sessions=len(session_service.list_active_sessions(session, user)),
        backup_codes_remaining=count_unused_backup_codes(session, user) if user.totp_enabled else 0,
        dependencies=dependencies(session, user),
    )


def require_not_self(user: User, actor: User) -> None:
    if user.id == actor.id:
        raise AppException(
            "CANNOT_MANAGE_YOURSELF",
            "Manage your own account from Preferences.",
            409,
            log_level=logging.WARNING,
        )


def update_profile(
    session: Session, actor: User, user: User, full_name: str | None, email: str | None
) -> None:
    require_not_self(user, actor)
    before = {"full_name": user.full_name, "email": user.email}
    if full_name is not None:
        name = full_name.strip()
        if not name:
            raise AppException(
                "NAME_REQUIRED", "The name can't be empty.", 422, log_level=logging.WARNING
            )
        user.full_name = name
    if email is not None:
        address = email.strip().lower()
        if address != user.email:
            taken = session.exec(sqlmodel_select(User.id).where(User.email == address)).first()
            if taken is not None:
                raise AppException(
                    "EMAIL_ALREADY_REGISTERED",
                    "Another account already uses this email.",
                    409,
                    log_level=logging.WARNING,
                )
            user.email = address
    after = {"full_name": user.full_name, "email": user.email}
    if after == before:
        return
    session.add(user)
    session.commit()
    platform_audit_service.record(
        session,
        actor,
        "account.update",
        "account",
        user.id,
        user.email,
        {
            key: {"before": before[key], "after": after[key]}
            for key in before
            if before[key] != after[key]
        },
    )


# Easy to read out and type: no 0/O, 1/l/I look-alikes.
_LOWER = "abcdefghijkmnopqrstuvwxyz"
_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_DIGITS = "23456789"
_SYMBOLS = "!#%+-=?@"


def temporary_password(length: int = 16) -> str:
    """Random, with one of each class StrongPassword asks for (the person
    may type it again): ~90 bits from secrets.choice, then shuffled."""
    alphabet = _LOWER + _UPPER + _DIGITS + _SYMBOLS
    chars = [secrets.choice(group) for group in (_LOWER, _UPPER, _DIGITS, _SYMBOLS)]
    chars += [secrets.choice(alphabet) for _ in range(length - len(chars))]
    secrets.SystemRandom().shuffle(chars)
    password = "".join(chars)
    validate_password_strength(password)
    return password


def _temporary_for_policy(session: Session) -> str:
    """Long enough for the deployment's minimum, so the person may keep it
    once a policy is raised later (they must change it anyway)."""
    return temporary_password(max(16, effective_password_policy(session).min_length))


def create_account(session: Session, actor: User, email: str, full_name: str) -> tuple[User, str]:
    """An account made by the operator, with no organization (a Program
    Manager or a Planner grants it a role later, like any account waiting
    for one) and a temporary password returned once: the first sign-in
    only reaches the password change. The address isn't asked to be
    confirmed -- the operator vouches for it, like for the accounts that
    predate confirmation."""
    address = email.strip().lower()
    name = full_name.strip()
    if not name:
        raise AppException(
            "NAME_REQUIRED", "The name can't be empty.", 422, log_level=logging.WARNING
        )
    taken = session.exec(sqlmodel_select(User.id).where(User.email == address)).first()
    if taken is not None:
        raise AppException(
            "EMAIL_ALREADY_REGISTERED",
            "Another account already uses this email.",
            409,
            log_level=logging.WARNING,
        )
    temporary = _temporary_for_policy(session)
    user = User(email=address, full_name=name)
    set_password(session, user, temporary, temporary=True)
    session.commit()
    session.refresh(user)
    platform_audit_service.record(session, actor, "account.create", "account", user.id, user.email)
    return user, temporary


def reset_password(session: Session, actor: User, user: User) -> str:
    """A new random password, returned once: every session ends, a login
    waiting on its second factor can't finish, and the next sign-in only
    reaches the password change (User.password_change_required). The
    second factor, if any, is still asked."""
    require_not_self(user, actor)
    temporary = _temporary_for_policy(session)
    set_password(session, user, temporary, temporary=True)
    user.mfa_pending_jti = None
    session.add(user)
    session.commit()
    session_service.revoke_sessions(session, user)
    platform_audit_service.record(
        session, actor, "account.password_reset", "account", user.id, user.email
    )
    return temporary


def reset_two_factor(session: Session, actor: User, user: User) -> None:
    """For a lost authenticator or mailbox: the secret, the backup codes
    and the email code factor go and every session ends. Where the
    account's roles make two-factor mandatory, it has to enroll again
    before anything else (the mandatory-TOTP gate)."""
    require_not_self(user, actor)
    user.totp_secret_encrypted = None
    user.totp_enabled = False
    user.totp_last_step = None
    user.email_mfa_enabled = False
    user.mfa_preferred = None
    user.mfa_pending_jti = None
    user.mfa_failed_attempts = 0
    user.mfa_failed_since = None
    user.mfa_locked_until = None
    session.add(user)
    session.exec(delete(TotpBackupCode).where(TotpBackupCode.user_id == user.id))
    session.commit()
    session_service.revoke_sessions(session, user)
    platform_audit_service.record(
        session, actor, "account.totp_reset", "account", user.id, user.email
    )


def end_sessions(session: Session, actor: User, user: User) -> int:
    require_not_self(user, actor)
    ended = session_service.revoke_sessions(session, user)
    platform_audit_service.record(
        session,
        actor,
        "account.sessions_end",
        "account",
        user.id,
        user.email,
        {"sessions": ended},
    )
    return ended


def delete_account(session: Session, actor: User, user: User) -> None:
    """For good, only when it left no trace (dependencies() empty); its
    sessions, backup codes, legal acceptances and single sign-on links go
    with it, the activity
    log keeps its email. Never an instance administrator: revoke the role
    first, so the "never the last one" rule holds."""
    require_not_self(user, actor)
    if user.is_instance_admin:
        raise AppException(
            "REVOKE_INSTANCE_ADMIN_FIRST",
            "Revoke instance administrator from this account first.",
            409,
            log_level=logging.WARNING,
        )
    # Lock the account so nothing joins it between the check and the delete.
    session.exec(sqlmodel_select(User).where(User.id == user.id).with_for_update()).one()
    found = dependencies(session, user)
    if found:
        session.rollback()
        raise AppException(
            "ACCOUNT_HAS_DEPENDENCIES",
            "This account still has organizations, exercises or content: suspend it instead.",
            409,
            log_level=logging.WARNING,
        )
    email, user_id, avatar = user.email, user.id, user.avatar_upload_path
    session.exec(delete(UserSession).where(UserSession.user_id == user_id))
    session.exec(delete(TotpBackupCode).where(TotpBackupCode.user_id == user_id))
    session.exec(delete(PasswordHistory).where(PasswordHistory.user_id == user_id))
    session.exec(delete(LegalAcceptance).where(LegalAcceptance.user_id == user_id))
    oidc_service.forget_user(session, user_id)
    account_email_service.forget_user(session, user_id)
    assistant_tokens.forget_user(session, user_id)
    email_invitation_service.forget_address(session, user)
    organization_role_invitation_service.forget_address(session, user)
    forget_recipient(session, email)
    session.exec(
        update(PlatformAuditEvent)
        .where(PlatformAuditEvent.actor_user_id == user_id)
        .values(actor_user_id=None)
    )
    session.delete(user)
    session.commit()
    # The uploaded picture goes once the row is gone (a failed delete keeps both).
    delete_upload_file(avatar)
    logger.warning("Account %s deleted for good by %s.", user_id, actor.id)
    platform_audit_service.record(session, actor, "account.delete", "account", user_id, email)


BulkAction = Literal["suspend", "reactivate", "end_sessions", "delete"]

# The actions that need the number of accounts typed to confirm (they
# lock people out, or for good).
BULK_TYPED_CONFIRMATION: set[str] = {"suspend", "delete"}
BULK_MAX = 100


@dataclass(frozen=True)
class BulkOutcome:
    user_id: uuid.UUID
    email: str | None
    # None: done; else the refusal's code (ACCOUNT_HAS_DEPENDENCIES, ...).
    code: str | None
    message: str | None


def bulk_action(
    session: Session, actor: User, action: BulkAction, user_ids: list[uuid.UUID]
) -> list[BulkOutcome]:
    """The same action on several accounts (Platform -> Accounts, selected
    rows), each on its own: one refused (your own account, the last
    administrator, an account with dependencies) doesn't stop the rest,
    and each done one is recorded as if done alone."""
    from app.services.account_suspension_service import (
        get_account,
        reactivate_account,
        suspend_account,
    )

    outcomes: list[BulkOutcome] = []
    for user_id in dict.fromkeys(user_ids):
        email: str | None = None
        try:
            user = get_account(session, user_id)
            email = user.email
            require_not_self(user, actor)
            if action == "suspend":
                already = user.suspended_at is not None
                suspend_account(session, user, actor.id)
                if not already:
                    platform_audit_service.record(
                        session, actor, "account.suspend", "account", user.id, user.email
                    )
            elif action == "reactivate":
                was = user.suspended_at is not None
                reactivate_account(session, user, actor.id)
                if was:
                    platform_audit_service.record(
                        session, actor, "account.reactivate", "account", user.id, user.email
                    )
            elif action == "end_sessions":
                end_sessions(session, actor, user)
            else:
                delete_account(session, actor, user)
        except AppException as exc:
            session.rollback()
            outcomes.append(BulkOutcome(user_id, email, exc.code, exc.message))
            continue
        outcomes.append(BulkOutcome(user_id, email, None, None))
    return outcomes
