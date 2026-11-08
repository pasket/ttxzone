"""One-time links sent by email: "forgot your password?" and confirming
the address an account signed up with (docs/architecture/email.md ->
Account links).

Both need the deployment to send email and to know its public address
(PUBLIC_BASE_URL, the start of every link); without either they aren't
offered (`available`) and nothing is asked of anyone. A link carries a
random token in its fragment (never sent to a server, nor in a Referer);
the database keeps only its SHA-256. Opening one spends it.
"""

import hashlib
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import delete
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import INSTANCE_SETTINGS_ID, AccountToken, InstanceSettings, User
from app.services import (
    email_service,
    login_throttle_service,
    oidc_service,
    platform_audit_service,
    session_service,
)
from app.services.auth_event_service import auth_event
from app.services.security_policy_service import check_new_password, set_password

logger = logging.getLogger(__name__)

Purpose = Literal["password_reset", "email_verification"]

PASSWORD_RESET_TTL = timedelta(minutes=30)
EMAIL_VERIFICATION_TTL = timedelta(hours=48)
# A new confirmation link, at most this often per account.
RESEND_COOLDOWN = timedelta(seconds=60)
# Periodic reconfirmation: how long an account asked to confirm its address
# again keeps working (and its link stays valid) before it's held.
RECONFIRMATION_GRACE = timedelta(days=14)

# The SPA's pages that open each link (frontend/src/App.tsx).
_PAGES: dict[Purpose, str] = {
    "password_reset": "/reset-password",  # nosec B105 -- a page path, not a secret
    "email_verification": "/verify-email",
}


def available(session: Session) -> bool:
    """Whether the deployment can send these links at all."""
    return bool(settings.PUBLIC_BASE_URL) and email_service.is_enabled(session)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _link(purpose: Purpose, token: str) -> str:
    return f"{settings.PUBLIC_BASE_URL}{_PAGES[purpose]}#token={token}"


def _send_link(
    session: Session,
    user: User,
    purpose: Purpose,
    ttl: timedelta,
    template: email_service.EmailTemplate,
    locale: str | None,
) -> bool:
    """Queues the message with a new link, in the caller's transaction.
    False when the outbox dropped it (the address's hourly limit): the
    link already sent stays the live one."""
    token = secrets.token_urlsafe(32)
    params = {"name": user.full_name, "link": _link(purpose, token)}
    if purpose == "password_reset":
        params["minutes"] = int(ttl.total_seconds() // 60)
    else:
        params["hours"] = int(ttl.total_seconds() // 3600)
        params["days"] = ttl.days
    if email_service.queue(session, user.email, template, params, locale) is None:
        return False
    # One live link per purpose: the new one withdraws the previous.
    session.exec(
        delete(AccountToken).where(
            col(AccountToken.user_id) == user.id,
            col(AccountToken.purpose) == purpose,
            col(AccountToken.used_at).is_(None),
        )
    )
    now = datetime.now(UTC)
    session.add(
        AccountToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=_hash(token),
            email=user.email,
            created_at=now,
            expires_at=now + ttl,
        )
    )
    return True


def _invalid_link() -> AppException:
    return AppException(
        "ACCOUNT_LINK_INVALID",
        "This link is invalid or has expired.",
        400,
        log_level=logging.WARNING,
        logger_name=AUTH_LOGGER_NAME,
    )


def _spend(session: Session, token: str, purpose: Purpose) -> tuple[AccountToken, User]:
    """The link's row and account, the row marked used (locked, so the same
    link can't be spent twice at once). Refused when unknown, used,
    expired, or the account changed address, was deleted or suspended."""
    row = session.exec(
        select(AccountToken)
        .where(AccountToken.token_hash == _hash(token), AccountToken.purpose == purpose)
        .with_for_update()
    ).first()
    now = datetime.now(UTC)
    if row is None or row.used_at is not None or row.expires_at <= now:
        raise _invalid_link()
    user = session.get(User, row.user_id)
    if (
        user is None
        or not user.is_active
        or user.suspended_at is not None
        or user.email != row.email
    ):
        raise _invalid_link()
    row.used_at = now
    session.add(row)
    return row, user


def forget_user(session: Session, user_id) -> None:
    """The account's links, when it's deleted (in the caller's transaction)."""
    session.exec(delete(AccountToken).where(col(AccountToken.user_id) == user_id))


# --- Forgot password -----------------------------------------------------


def _unavailable() -> AppException:
    return AppException(
        "ACCOUNT_EMAIL_UNAVAILABLE",
        "This deployment doesn't send email.",
        409,
        log_level=logging.WARNING,
    )


def request_password_reset(session: Session, email: str, locale: str | None) -> None:
    """Emails a link to choose a new password -- or, to an account that
    signs in only through single sign-on, a pointer to its provider. The
    caller answers the same whether or not an account has that address."""
    if not available(session):
        raise _unavailable()
    user = session.exec(select(User).where(User.email == email.strip().lower())).first()
    if user is None or not user.is_active:
        # A deleted account's email is anonymized: it reads as unknown too.
        auth_event(
            session,
            "auth.password_reset_request",
            email=email,
            details={"sent": False, "reason": "unknown_account"},
            level=logging.WARNING,
        )
        return
    if user.suspended_at is not None:
        auth_event(
            session,
            "auth.password_reset_request",
            user,
            details={"sent": False, "reason": "suspended"},
            level=logging.WARNING,
        )
        return
    sso = oidc_service.effective_config(session) if user.hashed_password is None else None
    if sso is not None:
        # No password to reset: the way in is the provider. (Without single
        # sign-on any more, the link lets the account choose one.)
        sent = (
            email_service.queue(
                session,
                user.email,
                "password_reset_sso",
                {"name": user.full_name, "provider": sso.display_name},
                locale,
            )
            is not None
        )
    else:
        sent = _send_link(
            session, user, "password_reset", PASSWORD_RESET_TTL, "password_reset", locale
        )
    session.commit()
    auth_event(session, "auth.password_reset_request", user, details={"sent": sent})


def reset_password(session: Session, token: str, new_password: str, address: str | None) -> None:
    """Spends a reset link: the new password, every session signed out
    (whoever else may be in loses it), and the address confirmed -- the
    link reached it. The second factor is untouched: signing in still asks
    for it. Failed sign-ins are forgiven, or the person who got here after
    too many of them couldn't use the new password yet."""
    _row, user = _spend(session, token, "password_reset")
    check_new_password(session, new_password, email=user.email, full_name=user.full_name, user=user)
    set_password(session, user, new_password)
    _confirmed(user)
    session.add(user)
    session.commit()
    session_service.revoke_sessions(session, user)
    login_throttle_service.clear(session, user.email, address)
    auth_event(session, "auth.password_reset", user)


# --- Email confirmation --------------------------------------------------


def verification_pending(session: Session, user: User) -> bool:
    """The account must confirm its address before anything but itself.
    Never while the deployment can't send the link."""
    return (
        user.email_verification_required and user.email_verified_at is None and available(session)
    )


def start_verification(session: Session, user: User, locale: str | None) -> None:
    """At signup, in the caller's transaction (its commit sends it): while
    the deployment sends email the new account has to confirm its address.
    Accounts created while it doesn't are never asked."""
    if not available(session):
        return
    user.email_verification_required = True
    session.add(user)
    _send_link(
        session,
        user,
        "email_verification",
        EMAIL_VERIFICATION_TTL,
        "email_verification",
        locale,
    )


def resend_verification(session: Session, user: User, locale: str | None) -> None:
    reconfirming = not verification_pending(session, user) and reconfirmation_asked(session, user)
    if not verification_pending(session, user) and not reconfirming:
        raise AppException(
            "EMAIL_VERIFICATION_NOT_PENDING",
            "Your email address doesn't need confirming.",
            409,
            log_level=logging.WARNING,
        )
    last = session.exec(
        select(AccountToken.created_at)
        .where(
            AccountToken.user_id == user.id,
            AccountToken.purpose == "email_verification",
        )
        .order_by(col(AccountToken.created_at).desc())
    ).first()
    if last is not None and datetime.now(UTC) - last < RESEND_COOLDOWN:
        raise AppException(
            "EMAIL_VERIFICATION_RATE_LIMITED",
            "A link was just sent. Wait a minute before asking for another.",
            429,
            log_level=logging.WARNING,
        )
    sent = _send_link(
        session,
        user,
        "email_verification",
        RECONFIRMATION_GRACE if reconfirming else EMAIL_VERIFICATION_TTL,
        "email_reconfirmation" if reconfirming else "email_verification",
        locale,
    )
    session.commit()
    if not sent:
        raise AppException(
            "EMAIL_VERIFICATION_RATE_LIMITED",
            "Too many messages to this address. Try again later.",
            429,
            log_level=logging.WARNING,
        )


def verify_email(session: Session, token: str) -> User:
    """Spends a confirmation link. It works from any browser, signed in or
    not: the link itself proves the address."""
    _row, user = _spend(session, token, "email_verification")
    _confirmed(user)
    session.add(user)
    session.commit()
    auth_event(session, "auth.email_verify", user)
    return user


def _confirmed(user: User) -> None:
    """A link reached the mailbox: the address is confirmed as of now, and
    any reconfirmation asked of it is done."""
    user.email_verified_at = datetime.now(UTC)
    user.email_reconfirm_deadline = None


# --- Periodic reconfirmation ---------------------------------------------


def reconfirmation_pinned_by_env() -> bool:
    return settings.EMAIL_RECONFIRMATION_DAYS is not None


def reconfirmation_days(session: Session) -> int | None:
    """After how many days an account confirms its address again; None:
    never. The environment's pin wins over Platform's setting."""
    if settings.EMAIL_RECONFIRMATION_DAYS is not None:
        return settings.EMAIL_RECONFIRMATION_DAYS or None
    row = session.get(InstanceSettings, INSTANCE_SETTINGS_ID)
    return row.email_reconfirmation_days if row is not None else None


def save_reconfirmation_days(session: Session, actor: User, days: int | None) -> None:
    if reconfirmation_pinned_by_env():
        raise AppException(
            "EMAIL_RECONFIRMATION_PINNED_BY_ENV",
            "The server's configuration sets the reconfirmation period.",
            409,
            log_level=logging.WARNING,
        )
    row = session.get(InstanceSettings, INSTANCE_SETTINGS_ID)
    if row is None:
        row = InstanceSettings(id=INSTANCE_SETTINGS_ID)
    before = row.email_reconfirmation_days
    row.email_reconfirmation_days = days
    session.add(row)
    session.commit()
    platform_audit_service.record(
        session,
        actor,
        "email.reconfirmation_update",
        "instance",
        details={"before": before, "after": days},
    )


def _due(session: Session, user: User) -> bool:
    """The rule is on, the deployment can send the link, and the address
    was last confirmed longer ago than the period (or never). An account
    still confirming its signup address is held by that instead."""
    days = reconfirmation_days(session)
    if days is None or not available(session) or verification_pending(session, user):
        return False
    confirmed = user.email_verified_at
    return confirmed is None or confirmed <= datetime.now(UTC) - timedelta(days=days)


def reconfirmation_asked(session: Session, user: User) -> bool:
    """Asked to confirm again and not done yet (in the grace period or
    past it)."""
    return user.email_reconfirm_deadline is not None and _due(session, user)


def reconfirmation_overdue(session: Session, user: User) -> bool:
    """Past the grace period without confirming: the account reaches only
    /auth/... until it opens the link. Cheap for everyone else (the
    deadline is checked first)."""
    deadline = user.email_reconfirm_deadline
    return deadline is not None and deadline <= datetime.now(UTC) and _due(session, user)


def ask_reconfirmation(session: Session, user: User, locale: str | None) -> None:
    """At sign-in: an account due and not asked yet gets the link and the
    grace period (RECONFIRMATION_GRACE). Commits."""
    if user.email_reconfirm_deadline is not None or not _due(session, user):
        return
    if not _send_link(
        session,
        user,
        "email_verification",
        RECONFIRMATION_GRACE,
        "email_reconfirmation",
        locale,
    ):
        # The address's hourly limit: asked at the next sign-in.
        return
    user.email_reconfirm_deadline = datetime.now(UTC) + RECONFIRMATION_GRACE
    session.add(user)
    session.commit()
    logger.info("Account %s asked to confirm its email address again.", user.id)
