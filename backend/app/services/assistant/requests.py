"""What a person asks the AI assistant for from a design page
(docs/features/ai-assistant.md#requests): kept here until their AI client
reads it (`list_requests`) and answers with proposals that name it. Each
person sees and withdraws only their own."""

import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlmodel import Session, col, delete, func, select

from app.core.exceptions import AppException
from app.models import TTX, AssistantProposal, AssistantRequest, User
from app.services.assistant import proposals

logger = logging.getLogger(__name__)

SECTIONS = ("needs", "msel", "conduct-prep")
MAX_OPEN_PER_EXERCISE = 20
OPEN_RETENTION_DAYS = 30
ANSWERED_RETENTION_DAYS = 90


def list_for_author(
    session: Session, ttx: TTX, user: User, status: str | None = "open"
) -> list[AssistantRequest]:
    query = select(AssistantRequest).where(
        AssistantRequest.ttx_id == ttx.id, AssistantRequest.user_id == user.id
    )
    if status:
        query = query.where(AssistantRequest.status == status)
    return list(session.exec(query.order_by(col(AssistantRequest.created_at))).all())


def create(
    session: Session, ttx: TTX, user: User, section: str, row_id: uuid.UUID | None, note: str
) -> AssistantRequest:
    if row_id is not None and str(row_id) not in proposals.row_codes(session, ttx):
        raise AppException(
            "ASSISTANT_REQUEST_ROW_NOT_FOUND",
            "That row isn't saved in this exercise.",
            404,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    count = session.exec(
        select(func.count())
        .select_from(AssistantRequest)
        .where(
            AssistantRequest.ttx_id == ttx.id,
            AssistantRequest.user_id == user.id,
            AssistantRequest.status == "open",
        )
    ).one()
    if count >= MAX_OPEN_PER_EXERCISE:
        raise AppException(
            "ASSISTANT_REQUEST_LIMIT",
            "Too many requests wait for the assistant on this exercise ({limit} at most): "
            "withdraw some first.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
            params={"limit": MAX_OPEN_PER_EXERCISE},
        )
    request = AssistantRequest(
        ttx_id=ttx.id, user_id=user.id, section=section, row_id=row_id, note=note
    )
    session.add(request)
    session.commit()
    session.refresh(request)
    return request


def _own(session: Session, ttx: TTX, user: User, request_id: uuid.UUID) -> AssistantRequest:
    request = session.get(AssistantRequest, request_id)
    if request is None or request.ttx_id != ttx.id or request.user_id != user.id:
        raise AppException(
            "ASSISTANT_REQUEST_NOT_FOUND",
            "Request not found.",
            404,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    return request


def withdraw(session: Session, ttx: TTX, user: User, request_id: uuid.UUID) -> None:
    session.delete(_own(session, ttx, user, request_id))
    session.commit()


def answer(
    session: Session, ttx: TTX, user: User, request_id: uuid.UUID, proposal_ids: list[uuid.UUID]
) -> None:
    """These proposals answer the request: they carry its id, and it stops
    waiting. A request already answered takes more proposals."""
    request = _own(session, ttx, user, request_id)
    for row in session.exec(
        select(AssistantProposal).where(col(AssistantProposal.id).in_(proposal_ids))
    ):
        row.request_id = request.id
        session.add(row)
    if request.status == "open":
        request.status = "answered"
        request.answered_at = datetime.now(UTC)
        session.add(request)
    session.commit()


def check(session: Session, ttx: TTX, user: User, request_id: uuid.UUID) -> None:
    """Refuses a request id that isn't the person's on this exercise, before
    anything is proposed for it."""
    _own(session, ttx, user, request_id)


def prune_expired(session: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    result = session.exec(
        delete(AssistantRequest).where(
            (
                (col(AssistantRequest.status) == "open")
                & (col(AssistantRequest.created_at) < now - timedelta(days=OPEN_RETENTION_DAYS))
            )
            | (
                (col(AssistantRequest.status) != "open")
                & (
                    col(AssistantRequest.answered_at)
                    < now - timedelta(days=ANSWERED_RETENTION_DAYS)
                )
            )
        )
    )
    session.commit()
    pruned = result.rowcount or 0
    if pruned:
        logger.info("AI assistant: %s requests past their retention deleted.", pruned)
    return pruned
