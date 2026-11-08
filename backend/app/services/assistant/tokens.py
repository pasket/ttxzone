"""Personal access tokens for the AI assistant: created in Preferences
with the session (and a recent step-up), shown once, kept as a SHA-256,
and accepted only by the MCP endpoint (get_current_user_from_pat)."""

import hashlib
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import inspect
from sqlmodel import Session, col, delete, func, select, update

from app.core.exceptions import AppException
from app.core.security import enforce_account_gates
from app.models import AssistantCall, AssistantProposal, PersonalAccessToken, User, UserSession
from app.services.assistant import switch
from app.services.auth_event_service import auth_event

logger = logging.getLogger(__name__)

# A recognisable prefix (secret scanners match it), not a secret.
TOKEN_PREFIX = "ttxz_"  # nosec B105
# How long a token lasts: the owner picks one; 90 days at most.
EXPIRY_DAYS_CHOICES = (7, 30, 90)
DEFAULT_EXPIRY_DAYS = 30
MAX_ACTIVE_TOKENS = 5
# last_used_at is written at most this often, not on every call.
_LAST_USED_RESOLUTION = timedelta(minutes=1)


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def is_active(token: PersonalAccessToken, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return token.revoked_at is None and token.expires_at > now


def list_tokens(session: Session, user: User) -> list[PersonalAccessToken]:
    """The account's tokens not revoked, newest first (expired ones too,
    until revoked, so the owner sees why a client stopped working)."""
    return list(
        session.exec(
            select(PersonalAccessToken)
            .where(
                PersonalAccessToken.user_id == user.id,
                col(PersonalAccessToken.revoked_at).is_(None),
            )
            .order_by(col(PersonalAccessToken.created_at).desc())
        ).all()
    )


def active_token_count(session: Session, user_id: uuid.UUID | None = None) -> int:
    """Active tokens of one account, or of the whole deployment."""
    query = (
        select(func.count())
        .select_from(PersonalAccessToken)
        .where(
            col(PersonalAccessToken.revoked_at).is_(None),
            PersonalAccessToken.expires_at > datetime.now(UTC),
        )
    )
    if user_id is not None:
        query = query.where(PersonalAccessToken.user_id == user_id)
    return session.exec(query).one()


def create_token(
    session: Session,
    user: User,
    user_session: UserSession,
    *,
    name: str,
    expires_in_days: int,
    acknowledge: bool,
    disclaimer_version: str,
) -> tuple[PersonalAccessToken, str]:
    """A new token for `user`; returns the row and the secret, which is
    never available again."""
    switch.require_enabled(session)
    if not acknowledge or disclaimer_version != switch.ASSISTANT_DISCLAIMER_VERSION:
        raise AppException(
            "ASSISTANT_DISCLAIMER_REQUIRED",
            "Read and acknowledge the current notice on using the AI assistant.",
            400,
            log_level=logging.WARNING,
        )
    if expires_in_days not in EXPIRY_DAYS_CHOICES:
        raise AppException(
            "ASSISTANT_TOKEN_EXPIRY_INVALID",
            "A token lasts 7, 30 or 90 days.",
            400,
            log_level=logging.WARNING,
        )
    # Serialises two creations by the same account, so the cap holds.
    session.exec(select(User.id).where(User.id == user.id).with_for_update()).one()
    if active_token_count(session, user.id) >= MAX_ACTIVE_TOKENS:
        session.rollback()
        raise AppException(
            "ASSISTANT_TOKEN_LIMIT",
            "You already have {limit} active tokens: revoke one first.",
            409,
            log_level=logging.WARNING,
            params={"limit": MAX_ACTIVE_TOKENS},
        )
    raw = TOKEN_PREFIX + secrets.token_urlsafe(32)
    now = datetime.now(UTC)
    token = PersonalAccessToken(
        user_id=user.id,
        name=name,
        prefix=raw[: len(TOKEN_PREFIX) + 4],
        token_hash=hash_token(raw),
        created_at=now,
        expires_at=now + timedelta(days=expires_in_days),
        mfa_source=user_session.mfa_source,
        disclaimer_version=disclaimer_version,
        acknowledged_at=now,
    )
    session.add(token)
    session.commit()
    session.refresh(token)
    auth_event(
        session,
        "auth.token_create",
        user,
        details={
            "token_id": str(token.id),
            "name": name,
            "expires_in_days": expires_in_days,
            "disclaimer_version": disclaimer_version,
        },
    )
    return token, raw


def revoke_token(session: Session, user: User, token_id: uuid.UUID) -> None:
    token = session.get(PersonalAccessToken, token_id)
    if token is None or token.user_id != user.id or token.revoked_at is not None:
        raise AppException(
            "ASSISTANT_TOKEN_NOT_FOUND",
            "Token not found.",
            404,
            log_level=logging.WARNING,
        )
    token.revoked_at = datetime.now(UTC)
    session.add(token)
    session.commit()
    auth_event(session, "auth.token_revoke", user, details={"token_id": str(token.id)})


def revoke_all(session: Session, user_id: uuid.UUID) -> int:
    """Every token of the account, when a credential changes or its
    sessions are ended (session_service.revoke_sessions). Doesn't commit."""
    result = session.exec(
        update(PersonalAccessToken)
        .where(
            PersonalAccessToken.user_id == user_id,
            col(PersonalAccessToken.revoked_at).is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    return result.rowcount or 0


def forget_user(session: Session, user_id: uuid.UUID) -> None:
    """The account's tokens, call records and proposals, when it's deleted
    (in the caller's transaction)."""
    session.exec(delete(AssistantCall).where(col(AssistantCall.user_id) == user_id))
    session.exec(delete(AssistantProposal).where(col(AssistantProposal.user_id) == user_id))
    session.exec(delete(PersonalAccessToken).where(col(PersonalAccessToken.user_id) == user_id))


def _invalid_token() -> AppException:
    return AppException(
        "ASSISTANT_TOKEN_INVALID",
        "Invalid, expired or revoked token: create one in Preferences, AI assistant.",
        401,
        log_level=logging.WARNING,
    )


def authenticate(
    session: Session, authorization: str | None, path: str
) -> tuple[User, PersonalAccessToken]:
    """The account behind an `Authorization: Bearer ttxz_...` header, with
    the same account gates as a cookie session (enforce_account_gates).
    The token's second factor travels on the User row like a session's
    (mfa_satisfied)."""
    scheme, _, raw = (authorization or "").partition(" ")
    raw = raw.strip()
    if scheme.lower() != "bearer" or not raw.startswith(TOKEN_PREFIX):
        raise _invalid_token()
    token = session.exec(
        select(PersonalAccessToken).where(PersonalAccessToken.token_hash == hash_token(raw))
    ).first()
    now = datetime.now(UTC)
    if token is None or not is_active(token, now):
        raise _invalid_token()
    user = session.get(User, token.user_id)
    if user is None or not user.is_active or user.suspended_at is not None:
        raise _invalid_token()
    switch.require_enabled(session)
    enforce_account_gates(session, user, path)
    if token.last_used_at is None or now - token.last_used_at >= _LAST_USED_RESOLUTION:
        token.last_used_at = now
        session.add(token)
        session.commit()
        session.refresh(user)
    inspect(user).info["mfa_source"] = token.mfa_source
    return user, token
