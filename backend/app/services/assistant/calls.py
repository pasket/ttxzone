"""The record of every tool call on the MCP endpoint (AssistantCall):
the per-token rate limit counts it, a line goes to app.log, and rows
older than ASSISTANT_CALL_RETENTION_DAYS are pruned by the background
loop that prunes the activity log."""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, delete, func, select

from app.core.config import settings
from app.models import TTX, AssistantCall, Organization, PersonalAccessToken, User

logger = logging.getLogger(__name__)

ASSISTANT_CALL_RETENTION_DAYS = 90


def rate_limited(session: Session, token: PersonalAccessToken) -> bool:
    since = datetime.now(UTC) - timedelta(minutes=1)
    recent = session.exec(
        select(func.count())
        .select_from(AssistantCall)
        .where(AssistantCall.token_id == token.id, AssistantCall.created_at >= since)
    ).one()
    return recent >= settings.ASSISTANT_RATE_LIMIT_PER_MINUTE


def record(
    session: Session,
    user: User,
    token: PersonalAccessToken,
    tool: str,
    outcome: str,
    duration_ms: int,
    *,
    ttx_id: uuid.UUID | None = None,
    organization_id: uuid.UUID | None = None,
) -> None:
    """Who called what, about which exercise, and how it ended -- never the
    arguments or the result. Commits."""
    session.add(
        AssistantCall(
            user_id=user.id,
            token_id=token.id,
            tool=tool[:64],
            ttx_id=ttx_id,
            organization_id=organization_id,
            outcome=outcome[:64],
            duration_ms=duration_ms,
        )
    )
    session.commit()
    logger.info(
        "assistant.call tool=%s user=%s token=%s ttx=%s outcome=%s ms=%d",
        tool,
        user.id,
        token.id,
        ttx_id or "-",
        outcome,
        duration_ms,
    )


def prune_expired(session: Session, now: datetime | None = None) -> int:
    cutoff = (now or datetime.now(UTC)) - timedelta(days=ASSISTANT_CALL_RETENTION_DAYS)
    result = session.exec(delete(AssistantCall).where(col(AssistantCall.created_at) < cutoff))
    session.commit()
    pruned = result.rowcount or 0
    if pruned:
        logger.info("AI assistant: %s call records past the retention period deleted.", pruned)
    return pruned


RECENT_CALLS_MAX = 100


def recent(
    session: Session, user_id: uuid.UUID | None = None, limit: int = RECENT_CALLS_MAX
) -> list[tuple[AssistantCall, User, PersonalAccessToken, TTX | None, Organization | None]]:
    """The latest calls, newest first, with who made them, through which
    token and about which exercise (Platform -> AI assistant -> Recent use)."""
    query = (
        select(AssistantCall, User, PersonalAccessToken, TTX, Organization)
        .join(User, User.id == AssistantCall.user_id)
        .join(PersonalAccessToken, PersonalAccessToken.id == AssistantCall.token_id)
        .outerjoin(TTX, TTX.id == AssistantCall.ttx_id)
        .outerjoin(Organization, Organization.id == AssistantCall.organization_id)
        .order_by(col(AssistantCall.created_at).desc())
        .limit(limit)
    )
    if user_id is not None:
        query = query.where(AssistantCall.user_id == user_id)
    return list(session.exec(query).all())


def callers(session: Session) -> list[User]:
    """Everyone with a call on record (the filter's choices), by name."""
    return list(
        session.exec(
            select(User)
            .where(col(User.id).in_(select(AssistantCall.user_id).distinct()))
            .order_by(User.full_name)
        ).all()
    )
