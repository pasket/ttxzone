import logging
import uuid
from datetime import UTC, datetime
from typing import Literal

from sqlalchemy import update
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.core.security import verify_password
from app.models import (
    Inject,
    OrganizationMembership,
    OrgRoleEnum,
    PasswordHistory,
    TTXMsel,
    User,
    active_membership,
)
from app.schemas.organization import BareRegisterRequest
from app.services import login_throttle_service
from app.services.auth_event_service import auth_event
from app.services.security_policy_service import check_new_password, set_password

DELETE_ACCOUNT_CONFIRMATION_PHRASE = "delete my account"

logger = logging.getLogger(__name__)


def _invalid_credentials() -> AppException:
    return AppException(
        "INVALID_CREDENTIALS",
        "Invalid email or password.",
        401,
        log_level=logging.WARNING,
        logger_name=AUTH_LOGGER_NAME,
    )


def ensure_not_suspended(user: User) -> None:
    """Said only once the password (or the pending second factor) proves
    the account: nobody learns from it whether an email is suspended."""
    if user.suspended_at is not None:
        raise AppException(
            "ACCOUNT_SUSPENDED",
            "This account is suspended. Contact the platform's administrator.",
            403,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )


def authenticate_user(session: Session, email: str, password: str, address: str | None) -> User:
    """The account behind a right password; a session is issued later
    (record_login), after the second factor when it has one. Unknown
    accounts cost the same as known ones, in time and in failures counted,
    so neither says who has an account."""
    login_throttle_service.ensure_allowed(session, email, address)
    found = session.exec(select(User).where(User.email == email.lower())).first()
    user = found if found is not None and found.is_active else None
    matched = verify_password(password, user.hashed_password if user is not None else None)
    if user is None:
        # A deleted account's email is anonymized: it reads as unknown too.
        auth_event(
            session,
            "auth.login_failed",
            email=email,
            details={"reason": "unknown_account"},
            level=logging.WARNING,
        )
    elif not matched:
        # An account without a password (single sign-on only) answers like
        # a wrong one: the sign-in page doesn't tell who uses which.
        auth_event(
            session,
            "auth.login_failed",
            user,
            details={"reason": "password" if user.hashed_password else "no_password"},
            level=logging.WARNING,
        )
    if user is None or not matched:
        login_throttle_service.record_failure(session, email, address)
        raise _invalid_credentials()
    login_throttle_service.clear(session, email, address)
    if user.suspended_at is not None:
        auth_event(
            session,
            "auth.login_failed",
            user,
            details={"reason": "suspended"},
            level=logging.WARNING,
        )
    ensure_not_suspended(user)
    return user


LoginMethod = Literal["password", "totp", "email_code", "backup_code", "sso"]
SignupVia = Literal["account", "organization", "invitation", "sso"]


def _stamp_login(session: Session, user: User) -> None:
    user.last_login_at = datetime.now(UTC)
    session.add(user)
    session.commit()
    session.refresh(user)


def record_login(
    session: Session, user: User, method: LoginMethod, details: dict | None = None
) -> None:
    """Stamp the moment a session is issued -- shown as "Last login" in the
    Admin and Creator people tables -- and record the sign-in. Called only
    once the user is fully authenticated (after the second factor when TOTP
    is enabled). A backup code is its own event: it means the authenticator
    is lost."""
    _stamp_login(session, user)
    if method == "backup_code":
        auth_event(session, "auth.backup_code_login", user, level=logging.WARNING)
    else:
        auth_event(session, "auth.login", user, details={"method": method, **(details or {})})


def record_signup(session: Session, user: User, via: SignupVia) -> None:
    """An account just created and signed in: `via` a bare signup, an
    organization's signup, an invitation token or single sign-on."""
    _stamp_login(session, user)
    auth_event(session, "auth.register", user, details={"via": via})


def log_logout(session: Session, user: User) -> None:
    auth_event(session, "auth.logout", user)


def change_password(
    session: Session, user: User, current_password: str | None, new_password: str
) -> None:
    """A new password; the current one is asked unless the account has none
    yet (single sign-on only: the route's step-up went through the provider)."""
    first = user.hashed_password is None
    if not first and not verify_password(current_password or "", user.hashed_password):
        raise AppException(
            "INVALID_CREDENTIALS", "Invalid password.", 401, log_level=logging.WARNING
        )

    if user.password_change_required and new_password == current_password:
        raise AppException(
            "PASSWORD_REUSED",
            "Choose a password different from the temporary one.",
            422,
            log_level=logging.WARNING,
        )
    check_new_password(session, new_password, email=user.email, full_name=user.full_name, user=user)
    # The temporary password from a reset is gone: the account is back.
    set_password(session, user, new_password)
    session.commit()
    auth_event(session, "auth.password_change", user, details={"first": True} if first else None)


def user_is_org_program_manager(session: Session, user: User) -> bool:
    """True iff the user holds a Program Manager OrganizationMembership for any
    org -- used to gate the mandatory TOTP-enrollment screen right after
    signup, before any TTX exists for GET /ttx to reveal the role from.
    """
    membership = session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.role == OrgRoleEnum.PROGRAM_MANAGER,
            active_membership(),
        )
    ).first()
    return membership is not None


def user_is_org_planner(session: Session, user: User) -> bool:
    """True iff the user holds a Planner OrganizationMembership for any
    org -- same purpose as user_is_org_program_manager, since TOTP is
    mandatory for that role too.
    """
    membership = session.exec(
        select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.role == OrgRoleEnum.PLANNER,
            active_membership(),
        )
    ).first()
    return membership is not None


def register_bare_account(session: Session, payload: BareRegisterRequest) -> User:
    """A brand-new account with no organization and no invitation token --
    pending role assignment. Mirrors create_organization_with_program_manager's
    duplicate-email check exactly.
    """
    email = payload.email.lower()
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing is not None:
        raise AppException(
            "EMAIL_ALREADY_REGISTERED",
            "An account with this email already exists.",
            409,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )

    check_new_password(session, payload.password, email=email, full_name=payload.full_name)
    user = User(email=email, full_name=payload.full_name)
    set_password(session, user, payload.password)
    session.commit()
    session.refresh(user)
    return user


def deactivate_account(
    session: Session,
    user: User,
    confirmation: str,
    lead_successors: dict[uuid.UUID, uuid.UUID] | None = None,
) -> None:
    """Soft-delete: the user has FK references from TTX/tokens/decisions
    they created that must survive, so this deactivates + anonymizes
    rather than deleting the row. `is_active=False` is already enforced by
    both authenticate_user (login) and get_current_user_optional (every
    authenticated request), so this takes effect immediately with no
    further changes needed elsewhere.
    """
    if confirmation.strip() != DELETE_ACCOUNT_CONFIRMATION_PHRASE:
        raise AppException(
            "CONFIRMATION_MISMATCH",
            'You must type "{phrase}" exactly.',
            400,
            log_level=logging.WARNING,
            params={"phrase": DELETE_ACCOUNT_CONFIRMATION_PHRASE},
        )

    # The Lead Planner role is never handed over silently: every exercise
    # they lead (with someone to take over) needs a chosen successor.
    from app.services.ttx_planning_team_service import hand_over_leads

    hand_over_leads(session, user, lead_successors or {})

    from app.services.exercise_run_service import forget_participant

    forget_participant(session, user)
    from app.services.email_service import forget_recipient

    # Messages queued or sent to the account (the outbox keeps the address).
    forget_recipient(session, user.email)
    from app.services.account_email_service import forget_user as forget_links

    forget_links(session, user.id)
    from app.services.email_invitation_service import forget_address

    # Invitations waiting for the address, and the address on accepted ones.
    forget_address(session, user)
    from app.services.organization_role_invitation_service import (
        forget_address as forget_role_offers,
    )

    # Offers of organization roles waiting for the address.
    forget_role_offers(session, user)
    from app.services.assistant.tokens import forget_user as forget_tokens

    # Its AI assistant tokens and their call records.
    forget_tokens(session, user.id)
    from app.services.oidc_service import forget_user

    # Its single sign-on links: the person at the provider is free again.
    forget_user(session, user.id)
    user.is_active = False
    user.email = f"deleted-{user.id}@deleted.ttx-zone.invalid"
    user.full_name = "Deleted user"
    # A deleted account runs nothing: Platform needs a new grant.
    user.is_instance_admin = False
    # Platform's activity log is left as it is: it keeps who did what with
    # the email of the time (PlatformAuditEvent), an exception the privacy
    # policy states.
    session.add(user)
    # Previous password hashes go with the account.
    for row in session.exec(select(PasswordHistory).where(PasswordHistory.user_id == user.id)):
        session.delete(row)
    # Injects and MSELs keep who validated / marked them ready as a name:
    # it goes with the account.
    session.exec(
        update(Inject).where(Inject.validated_by_id == user.id).values(validated_by=user.full_name)
    )
    session.exec(
        update(TTXMsel).where(TTXMsel.ready_by_id == user.id).values(ready_by=user.full_name)
    )
    session.commit()
    from app.services.session_service import revoke_sessions

    revoke_sessions(session, user)
    logger.info("User %s deactivated their own account.", user.id)
