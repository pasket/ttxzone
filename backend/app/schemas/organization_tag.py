import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.tag_color import TagColor, validate_custom_hex
from app.schemas.tag_library import TagOriginFields


class OrganizationTagRead(TagOriginFields):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: TagColor
    custom_hex: str | None
    applied: bool
    created_at: datetime
    # Set when deleted while still in use (see library_usage_service).
    disabled_at: datetime | None = None
    # How many uses keep it from being deleted for good (library lists only).
    usage_count: int = 0


class OrganizationTagCreateRequest(TagOriginFields):
    name: str = Field(min_length=1, max_length=24)
    color: TagColor
    custom_hex: str | None = None

    @model_validator(mode="after")
    def _validate_custom_hex(self) -> "OrganizationTagCreateRequest":
        self.custom_hex = validate_custom_hex(self.color, self.custom_hex)
        return self


class OrganizationTagUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    color: TagColor
    custom_hex: str | None = None

    @model_validator(mode="after")
    def _validate_custom_hex(self) -> "OrganizationTagUpdateRequest":
        self.custom_hex = validate_custom_hex(self.color, self.custom_hex)
        return self


class OrganizationTagListResponse(BaseModel):
    items: list[OrganizationTagRead]
    total: int
    limit: int
    offset: int


class OrganizationTagApplyRequest(BaseModel):
    """Full-replace semantics, same shape as TTXTagAssignmentRequest --
    the ids in this list are exactly the tags that should end up applied
    to the Organization; every other tag in this org's pool becomes
    unapplied."""

    tag_ids: list[uuid.UUID]
