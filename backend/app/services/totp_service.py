import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta

import pyotp
from sqlmodel import Session, select

from app.core import crypto
from app.core.exceptions import AppException
from app.core.logging_conf import AUTH_LOGGER_NAME
from app.core.security import hash_password, verify_password
from app.models import TotpBackupCode, User
from app.services.auth_event_service import auth_event
from app.services.security_policy_service import mfa_mandated

logger = logging.getLogger(__name__)

_ISSUER_NAME = "ttx-zone"

BACKUP_CODE_COUNT = 10

# Brute-force limits on the second factor (login challenge and step-up):
# every MFA_FAILURES_PER_CHALLENGE wrong codes withdraw the login challenge
# (back to the password), and MFA_FAILURES_BEFORE_LOCK within MFA_WINDOW
# lock the second factor for MFA_LOCK.
MFA_FAILURES_PER_CHALLENGE = 5
MFA_FAILURES_BEFORE_LOCK = 10
MFA_WINDOW = timedelta(minutes=15)
MFA_LOCK = timedelta(minutes=15)


def _matching_step(secret: str, code: str) -> int | None:
    """The 30-second time step `code` belongs to, allowing one step of
    clock drift either way (pyotp's valid_window=1), or None."""
    code = code.strip().replace(" ", "")
    totp = pyotp.totp.TOTP(secret)
    current = totp.timecode(datetime.now(UTC))
    for step in (current - 1, current, current + 1):
        if hmac.compare_digest(totp.generate_otp(step), code):
            return step
    return None


def store_secret(user: User, secret: str | None) -> None:
    """The authenticator's shared secret, kept encrypted (core/crypto.py)."""
    user.totp_secret_encrypted = None if secret is None else crypto.encrypt_secret(secret)


def stored_secret(user: User) -> str | None:
    """None when there is none or no configured key decrypts it -- the
    person then can't pass the second factor until it's reset."""
    if user.totp_secret_encrypted is None:
        return None
    try:
        return crypto.decrypt_secret(user.totp_secret_encrypted)
    except crypto.SecretUnreadableError:
        logger.error(
            "TOTP: user %s's secret can't be decrypted (DATA_ENCRYPTION_KEY changed?); "
            "an instance administrator has to reset their two-factor authentication.",
            user.id,
        )
        return None


def verify_code(session: Session, user: User, code: str) -> bool:
    """A live TOTP code for `user`, never one already used: the step it
    belongs to must be later than the last accepted one (anti-replay)."""
    secret = stored_secret(user)
    if secret is None:
        return False
    step = _matching_step(secret, code)
    if step is None or (user.totp_last_step is not None and step <= user.totp_last_step):
        return False
    user.totp_last_step = step
    session.add(user)
    session.commit()
    return True


def ensure_not_locked(user: User) -> None:
    if user.mfa_locked_until is not None and datetime.now(UTC) < user.mfa_locked_until:
        raise AppException(
            "TOO_MANY_ATTEMPTS",
            "Too many wrong codes. Try again later.",
            429,
            log_level=logging.WARNING,
            logger_name=AUTH_LOGGER_NAME,
        )


def record_failure(session: Session, user: User) -> None:
    now = datetime.now(UTC)
    if user.mfa_failed_since is None or now - user.mfa_failed_since > MFA_WINDOW:
        user.mfa_failed_attempts = 0
        user.mfa_failed_since = now
    user.mfa_failed_attempts += 1
    if user.mfa_failed_attempts % MFA_FAILURES_PER_CHALLENGE == 0:
        user.mfa_pending_jti = None
    locked = user.mfa_failed_attempts >= MFA_FAILURES_BEFORE_LOCK
    if locked:
        user.mfa_locked_until = now + MFA_LOCK
        user.mfa_failed_attempts = 0
        user.mfa_failed_since = None
    session.add(user)
    session.commit()
    if locked:
        auth_event(
            session,
            "auth.mfa_locked",
            user,
            details={"minutes": int(MFA_LOCK.total_seconds() // 60)},
            level=logging.WARNING,
        )


def record_success(session: Session, user: User) -> None:
    user.mfa_failed_attempts = 0
    user.mfa_failed_since = None
    user.mfa_locked_until = None
    user.mfa_pending_jti = None
    session.add(user)
    session.commit()


def new_login_challenge(session: Session, user: User) -> str:
    """A fresh login challenge id (the mfa_pending token's `jti`); any
    earlier one stops being answerable."""
    ensure_not_locked(user)
    user.mfa_pending_jti = secrets.token_urlsafe(16)
    session.add(user)
    session.commit()
    return user.mfa_pending_jti


def is_current_challenge(user: User, jti: str | None) -> bool:
    return (
        jti is not None
        and user.mfa_pending_jti is not None
        and hmac.compare_digest(user.mfa_pending_jti, jti)
    )


def start_enrollment(session: Session, user: User) -> str:
    secret = pyotp.random_base32()
    store_secret(user, secret)
    user.totp_last_step = None
    session.add(user)
    session.commit()

    return pyotp.totp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=_ISSUER_NAME)


def _generate_backup_codes(session: Session, user: User) -> list[str]:
    """Replaces any existing batch with BACKUP_CODE_COUNT fresh single-use
    recovery codes. Returns the plaintext codes -- the only time they're
    ever available; only their Argon2 hash is persisted."""
    for existing in session.exec(
        select(TotpBackupCode).where(TotpBackupCode.user_id == user.id)
    ).all():
        session.delete(existing)

    plaintext_codes = [
        f"{secrets.token_hex(4)}-{secrets.token_hex(4)}" for _ in range(BACKUP_CODE_COUNT)
    ]
    for code in plaintext_codes:
        session.add(TotpBackupCode(user_id=user.id, code_hash=hash_password(code)))
    session.commit()
    return plaintext_codes


def confirm_enrollment(session: Session, user: User, code: str) -> list[str]:
    secret = stored_secret(user)
    step = _matching_step(secret, code) if secret is not None else None
    if step is None:
        raise AppException(
            "INVALID_TOTP_CODE", "Invalid or expired code.", 400, log_level=logging.WARNING
        )

    user.totp_enabled = True
    user.totp_last_step = step
    session.add(user)
    session.commit()
    auth_event(session, "auth.totp_enable", user)
    return _generate_backup_codes(session, user)


def _check_password(user: User, password: str | None) -> None:
    """The account's password -- not asked of an account without one
    (single sign-on only): the route's step-up went through the provider."""
    if user.hashed_password is None:
        return
    if not verify_password(password or "", user.hashed_password):
        raise AppException(
            "INVALID_CREDENTIALS", "Invalid password.", 401, log_level=logging.WARNING
        )


def regenerate_backup_codes(session: Session, user: User, password: str | None) -> list[str]:
    _check_password(user, password)
    if not user.totp_enabled:
        raise AppException(
            "TOTP_NOT_ENABLED",
            "Two-factor authentication is not enabled.",
            409,
            log_level=logging.WARNING,
        )

    codes = _generate_backup_codes(session, user)
    auth_event(session, "auth.backup_codes_regenerate", user)
    return codes


def count_unused_backup_codes(session: Session, user: User) -> int:
    codes = session.exec(
        select(TotpBackupCode).where(
            TotpBackupCode.user_id == user.id,
            TotpBackupCode.used_at.is_(None),  # type: ignore[union-attr]
        )
    ).all()
    return len(codes)


def consume_backup_code(session: Session, user: User, code: str) -> bool:
    """Single-use: a match consumes the code and, since the compromised or
    lost authenticator app it was meant to recover from is now assumed
    unusable, immediately resets TOTP enrollment -- the mandatory-MFA gate
    (auth_service/authStore) then routes the user straight back through
    enrollment on their next request, exactly like a brand-new account.
    This is the only self-service way back in when both the authenticator
    and a valid live code are unavailable; disable() stays blocked for
    mandatory roles regardless."""
    unused = session.exec(
        select(TotpBackupCode).where(
            TotpBackupCode.user_id == user.id,
            TotpBackupCode.used_at.is_(None),  # type: ignore[union-attr]
        )
    ).all()
    for row in unused:
        if verify_password(code, row.code_hash):
            row.used_at = datetime.now(UTC)
            session.add(row)
            user.totp_secret_encrypted = None
            user.totp_enabled = False
            user.totp_last_step = None
            session.add(user)
            session.commit()
            logger.info("TOTP backup code consumed for user %s; enrollment reset.", user.id)
            return True
    return False


def disable(session: Session, user: User, password: str | None) -> None:
    # A role with a mandatory second factor (security_policy_service,
    # core/security.py's _require_mfa_for) -- "most restrictive wins" for a
    # multi-org user, so holding one *anywhere* blocks disabling entirely,
    # not just a per-org check. Enforced here (not just hidden in the
    # frontend) so a direct API call can't bypass it.
    if mfa_mandated(session, user):
        raise AppException(
            "MFA_MANDATORY_FOR_ROLE",
            "Two-factor authentication is mandatory for your role and cannot be disabled.",
            403,
            log_level=logging.WARNING,
        )

    _check_password(user, password)

    user.totp_secret_encrypted = None
    user.totp_enabled = False
    user.totp_last_step = None
    session.add(user)
    for existing in session.exec(
        select(TotpBackupCode).where(TotpBackupCode.user_id == user.id)
    ).all():
        session.delete(existing)
    session.commit()
    auth_event(session, "auth.totp_disable", user)
