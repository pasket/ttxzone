"""The organization level of the tag library: tags the organization
applies to itself, its Program Managers, its Exercise Planners and its
allowed domains, and the vocabulary its exercises copy from."""

import logging
import uuid
from typing import Literal

from sqlmodel import Session, func, select

from app.core.exceptions import AppException
from app.models import (
    AllowedDomainTagAssignment,
    MembershipTagAssignment,
    OrganizationTag,
    TagColor,
)
from app.schemas.tag_library import TagOriginFields
from app.services.ttx_tag_service import check_tag_origin, origin_values

module_logger = logging.getLogger(__name__)


def list_organization_tags_paginated(
    session: Session,
    organization_id: uuid.UUID,
    limit: int,
    offset: int,
    sort_dir: Literal["asc", "desc"] = "desc",
    sort_by: Literal["created_at", "name"] = "created_at",
    q: str | None = None,
) -> tuple[list[OrganizationTag], int]:
    where_clause = [OrganizationTag.organization_id == organization_id]
    if q:
        where_clause.append(OrganizationTag.name.ilike(f"%{q}%"))

    total = session.exec(
        select(func.count()).select_from(OrganizationTag).where(*where_clause)
    ).one()

    sort_column = OrganizationTag.name if sort_by == "name" else OrganizationTag.created_at
    order = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    items = list(
        session.exec(
            select(OrganizationTag)
            .where(*where_clause)
            .order_by(order, OrganizationTag.id)
            .limit(limit)
            .offset(offset)
        )
    )
    return items, total


def create_organization_tag(
    session: Session,
    organization_id: uuid.UUID,
    name: str,
    color: TagColor,
    custom_hex: str | None = None,
    origin: TagOriginFields | None = None,
) -> OrganizationTag:
    origin = origin or TagOriginFields()
    check_tag_origin(origin)
    tag = OrganizationTag(
        organization_id=organization_id,
        name=name,
        color=color,
        custom_hex=custom_hex,
        **origin_values(origin),
    )
    session.add(tag)
    session.commit()
    session.refresh(tag)
    module_logger.info("Organization tag %s created for organization %s.", tag.id, organization_id)
    return tag


def _get_organization_tag_or_404(
    session: Session, organization_id: uuid.UUID, tag_id: uuid.UUID
) -> OrganizationTag:
    tag = session.exec(
        select(OrganizationTag).where(
            OrganizationTag.id == tag_id,
            OrganizationTag.organization_id == organization_id,
        )
    ).first()
    if tag is None:
        raise AppException(
            "TAG_NOT_FOUND", "This tag was not found.", 404, log_level=logging.WARNING
        )
    return tag


def update_organization_tag(
    session: Session,
    organization_id: uuid.UUID,
    tag_id: uuid.UUID,
    name: str,
    color: TagColor,
    custom_hex: str | None = None,
) -> OrganizationTag:
    tag = _get_organization_tag_or_404(session, organization_id, tag_id)
    tag.name = name
    tag.color = color
    tag.custom_hex = custom_hex
    session.add(tag)
    session.commit()
    session.refresh(tag)
    return tag


def delete_organization_tag(
    session: Session, organization_id: uuid.UUID, tag_id: uuid.UUID
) -> None:
    """Exercises that copied it keep their copy; where it is applied in the
    organization (members, domains) it goes away."""
    tag = _get_organization_tag_or_404(session, organization_id, tag_id)
    for model in (MembershipTagAssignment, AllowedDomainTagAssignment):
        for row in session.exec(select(model).where(model.organization_tag_id == tag_id)):
            session.delete(row)
    session.flush()
    session.delete(tag)
    session.commit()
    module_logger.info("Organization tag %s deleted for organization %s.", tag_id, organization_id)


def validate_organization_tag_ids_belong_to_org(
    session: Session,
    organization_id: uuid.UUID,
    tag_ids: list[uuid.UUID],
    already_assigned: set[uuid.UUID] | None = None,
) -> None:
    """Mirrors ttx_tag_service._validate_tag_ids_belong_to_org exactly,
    adapted for OrganizationTag -- used by set_planner_tags to reject a
    tag id from a different org before assigning it. A disabled tag can
    stay where it already is (`already_assigned`), never be added."""
    if not tag_ids:
        return
    found = session.exec(
        select(OrganizationTag).where(
            OrganizationTag.id.in_(tag_ids), OrganizationTag.organization_id == organization_id
        )
    ).all()
    if {tag.id for tag in found} != set(tag_ids):
        raise AppException(
            "TAG_NOT_FOUND", "One or more tags were not found.", 404, log_level=logging.WARNING
        )
    kept = already_assigned or set()
    if any(tag.disabled_at is not None and tag.id not in kept for tag in found):
        raise AppException(
            "LIBRARY_ITEM_DISABLED",
            "That tag is disabled: enable it in the library to use it again.",
            409,
            log_level=logging.WARNING,
        )


def set_organization_tags_applied(
    session: Session, organization_id: uuid.UUID, tag_ids: list[uuid.UUID]
) -> list[OrganizationTag]:
    """Full-replace which of this org's own tags are applied to the
    Organization -- `tag_ids` becomes exactly the applied set, every other
    tag in the org's pool goes to applied=False. Returns the org's full
    tag pool (applied and unapplied alike) so the caller can refresh its
    whole local list in one response, not just the applied subset."""
    tags = list(
        session.exec(
            select(OrganizationTag).where(OrganizationTag.organization_id == organization_id)
        )
    )
    validate_organization_tag_ids_belong_to_org(
        session, organization_id, tag_ids, {tag.id for tag in tags if tag.applied}
    )
    tag_id_set = set(tag_ids)
    for tag in tags:
        tag.applied = tag.id in tag_id_set
        session.add(tag)
    session.commit()
    for tag in tags:
        session.refresh(tag)
    return tags
