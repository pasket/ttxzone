"""The exercise level of the tag library: each exercise's own tags,
assignable to the exercise, its invitation tokens and its planning team
members. A tag from TTX-Zone's catalog or the organization's library
arrives as a copy (see check_tag_origin)."""

import logging
import uuid
from typing import Literal

from sqlmodel import Session, func, select

from app.core.exceptions import AppException
from app.core.security import require_ttx_role
from app.data.tag_catalog import TAG_CATALOG_BY_ID
from app.models import (
    TTX,
    ActorOrigin,
    InvitationToken,
    InvitationTokenTagAssignment,
    RoleEnum,
    TTXAccessTagAssignment,
    TTXTag,
    TTXTagAssignment,
    User,
)
from app.schemas.tag_library import TagOriginFields

module_logger = logging.getLogger(__name__)


def check_tag_origin(fields: TagOriginFields) -> None:
    """Only a TTX-Zone origin can be checked (other levels' originals may
    be gone -- the copy keeps their name); an unknown one is refused."""
    if fields.origin == ActorOrigin.SYSTEM and fields.origin_id not in TAG_CATALOG_BY_ID:
        raise AppException(
            "UNKNOWN_SYSTEM_TAG", "That TTX-Zone tag doesn't exist.", 422, log_level=logging.WARNING
        )


def origin_values(fields: TagOriginFields) -> dict:
    """The origin columns of a new tag (none unless it names an origin)."""
    if fields.origin is None:
        return {"origin": None, "origin_id": None, "origin_name": None}
    return {
        "origin": fields.origin,
        "origin_id": fields.origin_id,
        "origin_name": fields.origin_name,
    }


def list_ttx_tags_paginated(
    session: Session,
    ttx_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name"] = "created_at",
    q: str | None = None,
) -> tuple[list[TTXTag], int]:
    where_clause = [TTXTag.ttx_id == ttx_id]
    if q:
        where_clause.append(TTXTag.name.ilike(f"%{q}%"))

    total = session.exec(select(func.count()).select_from(TTXTag).where(*where_clause)).one()

    sort_column = TTXTag.name if sort_by == "name" else TTXTag.created_at
    order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    items = list(
        session.exec(
            select(TTXTag)
            .where(*where_clause)
            .order_by(order, TTXTag.id)
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def create_ttx_tag(
    session: Session,
    ttx_id: uuid.UUID,
    name: str,
    color,
    custom_hex: str | None = None,
    origin: TagOriginFields | None = None,
) -> TTXTag:
    origin = origin or TagOriginFields()
    check_tag_origin(origin)
    tag = TTXTag(
        ttx_id=ttx_id, name=name, color=color, custom_hex=custom_hex, **origin_values(origin)
    )
    session.add(tag)
    session.commit()
    session.refresh(tag)
    module_logger.info("TTX tag %s created for exercise %s.", tag.id, ttx_id)
    return tag


def _get_ttx_tag_or_404(session: Session, ttx_id: uuid.UUID, tag_id: uuid.UUID) -> TTXTag:
    tag = session.exec(select(TTXTag).where(TTXTag.id == tag_id, TTXTag.ttx_id == ttx_id)).first()
    if tag is None:
        raise AppException(
            "TAG_NOT_FOUND", "This tag was not found.", 404, log_level=logging.WARNING
        )
    return tag


def update_ttx_tag(
    session: Session,
    ttx_id: uuid.UUID,
    tag_id: uuid.UUID,
    name: str,
    color,
    custom_hex: str | None = None,
) -> TTXTag:
    tag = _get_ttx_tag_or_404(session, ttx_id, tag_id)
    tag.name = name
    tag.color = color
    tag.custom_hex = custom_hex
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def delete_tag_assignments(session: Session, tag_ids: list[uuid.UUID]) -> None:
    """Junction rows have plain FKs with no ondelete cascade -- deleting an
    assigned tag without clearing these first violates the FK constraint
    (unhandled 500)."""
    if not tag_ids:
        return
    for model in (TTXTagAssignment, InvitationTokenTagAssignment, TTXAccessTagAssignment):
        for row in session.exec(select(model).where(model.ttx_tag_id.in_(tag_ids))):
            session.delete(row)
    session.flush()


def delete_ttx_tag(session: Session, ttx_id: uuid.UUID, tag_id: uuid.UUID) -> None:
    tag = _get_ttx_tag_or_404(session, ttx_id, tag_id)
    delete_tag_assignments(session, [tag_id])
    session.delete(tag)
    session.commit()
    module_logger.info("TTX tag %s deleted from exercise %s.", tag_id, ttx_id)


def delete_tags_for_ttx(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """Every tag of these exercises and its assignments (org cascade delete)."""
    if not ttx_ids:
        return
    tags = list(session.exec(select(TTXTag).where(TTXTag.ttx_id.in_(ttx_ids))))
    delete_tag_assignments(session, [tag.id for tag in tags])
    for tag in tags:
        session.delete(tag)
    session.flush()


def validate_tag_ids_belong_to_ttx(
    session: Session, ttx_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> None:
    """An exercise can only carry (and hand its tokens and team) its own tags."""
    if not tag_ids:
        return
    found = session.exec(
        select(TTXTag.id).where(TTXTag.id.in_(tag_ids), TTXTag.ttx_id == ttx_id)
    ).all()
    if set(found) != set(tag_ids):
        raise AppException(
            "TAG_NOT_FOUND", "One or more tags were not found.", 404, log_level=logging.WARNING
        )


def set_ttx_tags(session: Session, ttx: TTX, tag_ids: list[uuid.UUID]) -> list[TTXTag]:
    """Full-replace the tag set on one TTX (Exercise). Caller (the
    endpoint) has already authorized via RequiresOrgAndTTXAccess."""
    validate_tag_ids_belong_to_ttx(session, ttx.id, tag_ids)
    existing = session.exec(select(TTXTagAssignment).where(TTXTagAssignment.ttx_id == ttx.id)).all()
    for row in existing:
        session.delete(row)
    # Flush the deletes before adding the new rows -- SQLAlchemy's unit of
    # work flushes pending inserts before pending deletes by default, so
    # re-selecting an already-assigned tag alongside a new one would try to
    # insert a duplicate (ttx_tag_id, ttx_id) pair before the old row
    # clearing it had actually been removed, violating the UniqueConstraint
    # (reproduced live -- see test_set_tags_keeping_an_already_assigned_tag_and_adding_another).
    session.flush()
    # Dedupe (preserving order) -- a duplicate tag_id in the request body
    # would otherwise violate the UniqueConstraint on commit, surfacing as
    # an unhandled 500 instead of a clean, deduped success.
    for tag_id in dict.fromkeys(tag_ids):
        session.add(TTXTagAssignment(ttx_tag_id=tag_id, ttx_id=ttx.id))
    session.commit()
    return list(session.exec(select(TTXTag).where(TTXTag.id.in_(tag_ids))) if tag_ids else [])


def set_invitation_token_tags(
    session: Session, user: User, token_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> tuple[InvitationToken, list[TTXTag]]:
    """Mirrors revoke_invitation_token's own token_id-keyed auth shape
    exactly (backend/app/services/invitation_token_service.py) -- fetch
    the token, resolve its TTX, run the same TTXAccess-role check via
    require_ttx_role."""
    token = session.get(InvitationToken, token_id)
    if token is None:
        raise AppException("TOKEN_NOT_FOUND", "Invitation token not found.", 404)

    ttx = session.get(TTX, token.ttx_id)
    require_ttx_role(session, user, ttx, (RoleEnum.PLANNER,))
    validate_tag_ids_belong_to_ttx(session, ttx.id, tag_ids)

    existing = session.exec(
        select(InvitationTokenTagAssignment).where(
            InvitationTokenTagAssignment.invitation_token_id == token_id
        )
    ).all()
    for row in existing:
        session.delete(row)
    # Same ordering fix as set_ttx_tags above -- flush the deletes before
    # inserting the new rows.
    session.flush()
    # Dedupe (preserving order) -- same reasoning as set_ttx_tags above.
    for tag_id in dict.fromkeys(tag_ids):
        session.add(InvitationTokenTagAssignment(ttx_tag_id=tag_id, invitation_token_id=token_id))
    session.commit()
    tags = list(session.exec(select(TTXTag).where(TTXTag.id.in_(tag_ids)))) if tag_ids else []
    return token, tags


def list_tags_for_ttxs(session: Session, ttx_ids: list[uuid.UUID]) -> dict[uuid.UUID, list[TTXTag]]:
    """Batch-fetch, mirroring list_ttx_for_user's own role_map pattern
    (backend/app/services/ttx_service.py) -- one query for a whole page of
    rows, not N+1."""
    if not ttx_ids:
        return {}
    rows = session.exec(
        select(TTXTagAssignment, TTXTag)
        .join(TTXTag, TTXTag.id == TTXTagAssignment.ttx_tag_id)
        .where(TTXTagAssignment.ttx_id.in_(ttx_ids))
    )
    result: dict[uuid.UUID, list[TTXTag]] = {}
    for assignment, tag in rows:
        result.setdefault(assignment.ttx_id, []).append(tag)
    return result


def list_tags_for_invitation_tokens(
    session: Session, token_ids: list[uuid.UUID]
) -> dict[uuid.UUID, list[TTXTag]]:
    if not token_ids:
        return {}
    rows = session.exec(
        select(InvitationTokenTagAssignment, TTXTag)
        .join(TTXTag, TTXTag.id == InvitationTokenTagAssignment.ttx_tag_id)
        .where(InvitationTokenTagAssignment.invitation_token_id.in_(token_ids))
    )
    result: dict[uuid.UUID, list[TTXTag]] = {}
    for assignment, tag in rows:
        result.setdefault(assignment.invitation_token_id, []).append(tag)
    return result
