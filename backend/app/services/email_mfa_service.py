"""A one-time code by email as a second factor, besides the authenticator
app (TOTP).

It counts as the account's second factor only where two-factor is opt-in
(a Player, an account with no role): whoever controls the mailbox can
already reset the password, so for the roles where it's mandatory it is
an alternative way to answer a challenge while TOTP stays enrolled --
core/security.mfa_satisfied never looks at it.

A code is 6 digits, lives EMAIL_CODE_TTL, works once, and only while the
account keeps the address it went to. One live code per account (a new
one withdraws the previous); the database keeps its HMAC only. Wrong
codes count against the same limits as TOTP's (totp_service)."""

import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Literal

from sqlalchemy import delete
from sqlmodel import Session, col, select

from app.core.config import settings
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.models import AccountToken, User
from app.services import email_service
from app.services.auth_event_service import auth_event

MfaMethod = Literal["totp", "email", "backup_code"]
EmailCodeContext = Literal["login", "step_up", "enable"]

PURPOSE = "mfa_email_code"
EMAIL_CODE_TTL = timedelta(minutes=10)
# A new code, at most this often per account.
RESEND_COOLDOWN = timedelta(seconds=60)


def usable(session: Session) -> bool:
    """The deployment sends email, so a code can reach the mailbox."""
    return email_service.is_enabled(session)


def methods(session: Session, user: User) -> list[MfaMethod]:
    """How this account can answer a second-factor challenge right now.
    Backup codes exist only alongside TOTP (they recover a lost app)."""
    found: list[MfaMethod] = []
    if user.totp_enabled:
        found.append("totp")
    if user.email_mfa_enabled and usable(session):
        found.append("email")
    if user.totp_enabled:
        found.append("backup_code")
    return found


def preferred(session: Session, user: User) -> MfaMethod | None:
    """The method a challenge opens on: the account's choice while it's
    still available, else the first one it has."""
    available = [m for m in methods(session, user) if m != "backup_code"]
    if user.mfa_preferred in available:
        return user.mfa_preferred  # type: ignore[return-value]
    return available[0] if available else None


def needs_challenge(session: Session, user: User) -> bool:
    """Signing in with the password asks for a second factor. An account
    whose only factor is email, on a deployment that can't send it, signs
    in with the password alone (recorded): like email confirmation, the
    factor isn't asked while it can't be delivered."""
    if user.totp_enabled:
        return True
    if user.email_mfa_enabled:
        if usable(session):
            return True
        auth_event(
            session,
            "auth.mfa_skipped",
            user,
            details={"reason": "email_unavailable"},
            level=logging.WARNING,
        )
    return False


def masked_address(email: str) -> str:
    """ "p•••@acme.com": enough to recognize the mailbox, not to read it."""
    local, _, domain = email.partition("@")
    return f"{local[:1]}•••@{domain}"


def _digest(user: User, code: str) -> str:
    # Keyed and bound to the account: 6 digits alone are trivially reversed
    # from a plain hash, and would collide across accounts.
    return hmac.new(
        settings.SECRET_KEY.encode(), f"{user.id}:{code}".encode(), hashlib.sha256
    ).hexdigest()


def _not_available() -> AppException:
    return AppException(
        "EMAIL_MFA_UNAVAILABLE",
        "Codes by email aren't available.",
        409,
        log_level=logging.WARNING,
        logger_name=AUTH_LOGGER_NAME,
    )


def send_code(session: Session, user: User, context: EmailCodeContext, locale: str | None) -> str:
    """Emails a fresh code and returns the masked address it went to. For a
    sign-in or a step-up the account must have the factor; for `enable`
    it's the proof that turns it on."""
    if not usable(session) or (context != "enable" and not user.email_mfa_enabled):
        raise _not_available()
    last = session.exec(
        select(AccountToken.created_at)
        .where(AccountToken.user_id == user.id, AccountToken.purpose == PURPOSE)
        .order_by(col(AccountToken.created_at).desc())
    ).first()
    now = datetime.now(UTC)
    if last is not None and now - last < RESEND_COOLDOWN:
        raise AppException(
            "EMAIL_CODE_RATE_LIMITED",
            "A code was just sent. Wait a minute before asking for another.",
            429,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )
    code = f"{secrets.randbelow(10**6):06d}"
    params = {
        "name": user.full_name,
        "code": code,
        "minutes": int(EMAIL_CODE_TTL.total_seconds() // 60),
    }
    if email_service.queue(session, user.email, "mfa_code", params, locale) is None:
        session.rollback()
        raise AppException(
            "EMAIL_CODE_RATE_LIMITED",
            "Too many messages to this address. Try again later.",
            429,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )
    # One code per account, used or not: the digest is unique, and the same
    # 6 digits may well come up again for this account.
    session.exec(
        delete(AccountToken).where(
            col(AccountToken.user_id) == user.id, col(AccountToken.purpose) == PURPOSE
        )
    )
    session.add(
        AccountToken(
            user_id=user.id,
            purpose=PURPOSE,
            token_hash=_digest(user, code),
            email=user.email,
            created_at=now,
            expires_at=now + EMAIL_CODE_TTL,
        )
    )
    session.commit()
    email_service.wake_delivery()
    auth_event(session, "auth.mfa_email_sent", user, details={"context": context})
    return masked_address(user.email)


def verify_code(session: Session, user: User, code: str) -> bool:
    """The live code for `user`, spent on a match. Refused once used,
    expired, or when the account no longer has the address it went to."""
    row = session.exec(
        select(AccountToken)
        .where(
            AccountToken.user_id == user.id,
            AccountToken.purpose == PURPOSE,
            col(AccountToken.used_at).is_(None),
        )
        .with_for_update()
    ).first()
    code = code.strip().replace(" ", "")
    if (
        row is None
        or row.expires_at <= datetime.now(UTC)
        or row.email != user.email
        or not hmac.compare_digest(row.token_hash, _digest(user, code))
    ):
        session.rollback()
        return False
    row.used_at = datetime.now(UTC)
    session.add(row)
    session.commit()
    return True


def forget_codes(session: Session, user: User) -> None:
    """The account's codes (caller commits)."""
    session.exec(
        delete(AccountToken).where(
            col(AccountToken.user_id) == user.id, col(AccountToken.purpose) == PURPOSE
        )
    )


def enable(session: Session, user: User, code: str) -> None:
    """Turns the factor on with a code sent for `enable`; the code reaching
    the mailbox also confirms the address."""
    if not usable(session):
        raise _not_available()
    if not verify_code(session, user, code):
        raise AppException(
            "INVALID_TOTP_CODE",
            "Invalid or expired code.",
            400,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )
    user.email_mfa_enabled = True
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
    session.add(user)
    session.commit()
    auth_event(session, "auth.mfa_email_enable", user)


def disable(session: Session, user: User) -> None:
    user.email_mfa_enabled = False
    if user.mfa_preferred == "email":
        user.mfa_preferred = None
    session.add(user)
    forget_codes(session, user)
    session.commit()
    auth_event(session, "auth.mfa_email_disable", user)


def set_preferred(session: Session, user: User, method: Literal["totp", "email"]) -> None:
    enrolled = (method == "totp" and user.totp_enabled) or (
        method == "email" and user.email_mfa_enabled
    )
    if not enrolled:
        raise AppException(
            "MFA_METHOD_NOT_ENROLLED",
            "That verification method isn't set up on your account.",
            409,
            log_level=logging.WARNING,
        )
    user.mfa_preferred = method
    session.add(user)
    session.commit()
    auth_event(session, "auth.mfa_preferred", user, details={"method": method})
