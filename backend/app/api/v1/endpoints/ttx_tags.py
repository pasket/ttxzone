"""The tag library: TTX-Zone's read-only catalog and each exercise's own
tags (the organization's live under /organizations/{id}/tags)."""

import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from app.core.db import get_session
from app.core.security import RequiresOrgAndTTXAccess, get_current_user, verify_csrf
from app.data.tag_catalog import TAG_CATALOG
from app.models import TTX, RoleEnum, User
from app.schemas.tag_library import SystemTagListResponse, SystemTagRead
from app.schemas.ttx_tag import (
    TTXTagCreateRequest,
    TTXTagListResponse,
    TTXTagRead,
    TTXTagUpdateRequest,
)
from app.services.library_usage_service import ensure_not_disabled
from app.services.ttx_tag_service import (
    create_ttx_tag,
    delete_ttx_tag,
    list_ttx_tags_paginated,
    update_ttx_tag,
)

router = APIRouter(tags=["tag-library"])

_planner = RequiresOrgAndTTXAccess(RoleEnum.PLANNER)


@router.get("/tag-catalog", response_model=SystemTagListResponse)
def tag_catalog_endpoint(_user: User = Depends(get_current_user)) -> SystemTagListResponse:
    """TTX-Zone's own tags, both languages: read-only, duplicable."""
    return SystemTagListResponse(
        items=[
            SystemTagRead(
                id=tag.id,
                group=tag.group,
                color=tag.color,
                name_en=tag.name_en,
                name_es=tag.name_es,
                description_en=tag.description_en,
                description_es=tag.description_es,
            )
            for tag in TAG_CATALOG
        ]
    )


@router.get("/ttx/{ttx_id}/tags", response_model=TTXTagListResponse)
def list_ttx_tags_endpoint(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    sort_dir: Literal["asc", "desc"] = Query("desc"),
    sort_by: Literal["created_at", "name"] = Query("created_at"),
    q: str | None = Query(None, max_length=200),
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> TTXTagListResponse:
    """The exercise's tags."""
    rows, total = list_ttx_tags_paginated(session, ttx.id, limit, offset, sort_dir, sort_by, q)
    return TTXTagListResponse(
        items=[TTXTagRead.model_validate(row) for row in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/ttx/{ttx_id}/tags",
    response_model=TTXTagRead,
    status_code=201,
    dependencies=[Depends(verify_csrf)],
)
def create_ttx_tag_endpoint(
    payload: TTXTagCreateRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> TTXTagRead:
    """Add a tag to the exercise."""
    ensure_not_disabled(session, "tag", ttx.organization_id, payload.origin, payload.origin_id)
    tag = create_ttx_tag(
        session, ttx.id, payload.name, payload.color, payload.custom_hex, origin=payload
    )
    return TTXTagRead.model_validate(tag)


@router.patch(
    "/ttx/{ttx_id}/tags/{tag_id}",
    response_model=TTXTagRead,
    dependencies=[Depends(verify_csrf)],
)
def update_ttx_tag_endpoint(
    tag_id: uuid.UUID,
    payload: TTXTagUpdateRequest,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> TTXTagRead:
    """Change one of the exercise's tags."""
    tag = update_ttx_tag(session, ttx.id, tag_id, payload.name, payload.color, payload.custom_hex)
    return TTXTagRead.model_validate(tag)


@router.delete(
    "/ttx/{ttx_id}/tags/{tag_id}",
    status_code=204,
    dependencies=[Depends(verify_csrf)],
)
def delete_ttx_tag_endpoint(
    tag_id: uuid.UUID,
    ttx: TTX = Depends(_planner),
    session: Session = Depends(get_session),
) -> None:
    """Delete one of the exercise's tags."""
    delete_ttx_tag(session, ttx.id, tag_id)
