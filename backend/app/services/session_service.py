"""Server-side sessions: the soft (inactivity) and hard (absolute) timeouts,
revocation, and how recently the user proved who they are (step-up).

Kept free of app.core.security imports -- security.py builds on this.
"""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, or_, update
from sqlmodel import Session, select

from app.core import surface
from app.core.config import settings
from app.models import OrganizationMembership, OrgRoleEnum, RoleEnum, TTXAccess, User, UserSession

logger = logging.getLogger(__name__)

# Requests the client marks as running on their own (polling, a live feed)
# must not keep a session alive: an open tab would then never time out.
BACKGROUND_REQUEST_HEADER = "X-Background-Request"
# Streams can't send that header (EventSource): a path ending like this is
# background too -- a long-open stream must never keep a session alive.
BACKGROUND_PATH_SUFFIX = "/run/stream"
# last_seen_at is written at most this often, not on every request.
TOUCH_INTERVAL = timedelta(seconds=60)
# Ended sessions are kept this long (the "Active sessions" list never shows
# them), then deleted the next time the user signs in.
_RETENTION = timedelta(days=30)


def requires_mfa(session: Session, user: User) -> bool:
    """Same rule as the mandatory-TOTP gate: Program Manager or Planner of
    any organization, or Planner/Evaluator/Observer of any exercise."""
    org_role = session.exec(
        select(OrganizationMembership.id).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.role.in_(  # type: ignore[attr-defined]
                [OrgRoleEnum.PROGRAM_MANAGER, OrgRoleEnum.PLANNER]
            ),
        )
    ).first()
    if org_role is not None:
        return True
    ttx_role = session.exec(
        select(TTXAccess.id).where(
            TTXAccess.user_id == user.id,
            TTXAccess.role.in_(  # type: ignore[attr-defined]
                [RoleEnum.PLANNER, RoleEnum.EVALUATOR, RoleEnum.OBSERVER]
            ),
        )
    ).first()
    return ttx_role is not None


def idle_expires_at(user_session: UserSession) -> datetime:
    return user_session.last_seen_at + timedelta(minutes=user_session.idle_timeout_minutes)


def is_active(user_session: UserSession, now: datetime | None = None) -> bool:
    now = now or datetime.now(UTC)
    return (
        user_session.revoked_at is None
        and now < user_session.absolute_expires_at
        and now < idle_expires_at(user_session)
    )


def create_session(
    session: Session,
    user: User,
    user_agent: str | None,
    ip_address: str | None,
    mfa_source: str | None = None,
) -> UserSession:
    """A fresh session for a user who has just fully signed in. Drops their
    long-ended sessions and, past MAX_SESSIONS_PER_USER, ends the oldest."""
    now = datetime.now(UTC)
    session.exec(
        delete(UserSession).where(
            UserSession.user_id == user.id,
            or_(
                UserSession.absolute_expires_at < now - _RETENTION,
                UserSession.revoked_at < now - _RETENTION,  # type: ignore[operator]
            ),
        )
    )
    active = [s for s in _sessions_of(session, user.id) if is_active(s, now)]
    excess = len(active) - (settings.MAX_SESSIONS_PER_USER - 1)
    for oldest in active[: max(excess, 0)]:
        oldest.revoked_at = now
        session.add(oldest)
        logger.info("Session %s of user %s ended: too many sessions.", oldest.id, user.id)

    idle = (
        settings.SESSION_IDLE_MINUTES_PRIVILEGED
        if requires_mfa(session, user)
        else settings.SESSION_IDLE_MINUTES_PLAYER
    )
    user_session = UserSession(
        user_id=user.id,
        created_at=now,
        last_seen_at=now,
        authenticated_at=now,
        idle_timeout_minutes=idle,
        absolute_expires_at=now + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS),
        user_agent=(user_agent or "")[:255] or None,
        ip_address=(ip_address or "")[:45] or None,
        mfa_source=mfa_source,
        surface=surface.current(),
    )
    session.add(user_session)
    session.commit()
    session.refresh(user_session)
    return user_session


def _sessions_of(session: Session, user_id: uuid.UUID) -> list[UserSession]:
    return list(
        session.exec(
            select(UserSession)
            .where(UserSession.user_id == user_id)
            .order_by(UserSession.created_at)  # type: ignore[arg-type]
        ).all()
    )


def list_active_sessions(session: Session, user: User) -> list[UserSession]:
    now = datetime.now(UTC)
    return [s for s in reversed(_sessions_of(session, user.id)) if is_active(s, now)]


def touch(session: Session, user_session: UserSession) -> None:
    """Record activity, at most once per TOUCH_INTERVAL."""
    now = datetime.now(UTC)
    if now - user_session.last_seen_at < TOUCH_INTERVAL:
        return
    session.exec(
        update(UserSession).where(UserSession.id == user_session.id).values(last_seen_at=now)
    )
    session.commit()


def mark_authenticated(session: Session, user_session: UserSession) -> None:
    now = datetime.now(UTC)
    user_session.authenticated_at = now
    user_session.last_seen_at = now
    session.add(user_session)
    session.commit()


def is_recently_authenticated(user_session: UserSession) -> bool:
    return datetime.now(UTC) - user_session.authenticated_at <= timedelta(
        minutes=settings.STEP_UP_MINUTES
    )


def revoke(session: Session, user_session: UserSession) -> None:
    if user_session.revoked_at is None:
        user_session.revoked_at = datetime.now(UTC)
        session.add(user_session)
        session.commit()


def revoke_sessions(session: Session, user: User, keep: uuid.UUID | None = None) -> int:
    """End every session of `user` except `keep` (all of them when None).
    Called when a credential changes: the password, the second factor, or
    the account itself goes away. Returns how many were ended. The AI
    assistant's personal access tokens go too, all of them: a client
    configured before the change must not outlive it."""
    from app.services.assistant.tokens import revoke_all

    revoke_all(session, user.id)
    now = datetime.now(UTC)
    ended = 0
    for user_session in _sessions_of(session, user.id):
        if user_session.id != keep and user_session.revoked_at is None:
            user_session.revoked_at = now
            session.add(user_session)
            ended += 1
    session.commit()
    if ended:
        logger.info("Ended %d session(s) of user %s.", ended, user.id)
    return ended
