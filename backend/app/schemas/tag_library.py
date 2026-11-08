"""The tag library's shared shapes: TTX-Zone's catalog and what a copy
records of its original (organization and exercise tags alike)."""

from typing import Annotated

from pydantic import BaseModel, Field

from app.data.tag_catalog import SystemTagGroup
from app.models import ActorOrigin, TagColor


class SystemTagRead(BaseModel):
    id: str
    group: SystemTagGroup
    color: TagColor
    name_en: str
    name_es: str
    description_en: str
    description_es: str


class SystemTagListResponse(BaseModel):
    items: list[SystemTagRead]


class TagOriginFields(BaseModel):
    """What a tag was copied from, if anything. Set when it is created
    (a duplicate), never changed afterwards."""

    origin: ActorOrigin | None = None
    origin_id: Annotated[str, Field(max_length=64)] | None = None
    # The original's name at copy time ("Copied from", read-only).
    origin_name: Annotated[str, Field(max_length=64)] | None = None
