import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.tag_color import TagColor, validate_custom_hex
from app.schemas.tag_library import TagOriginFields


class TTXTagRead(TagOriginFields):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    color: TagColor
    custom_hex: str | None
    created_at: datetime


class TTXTagCreateRequest(TagOriginFields):
    name: str = Field(min_length=1, max_length=24)
    color: TagColor
    custom_hex: str | None = None

    @model_validator(mode="after")
    def _validate_custom_hex(self) -> "TTXTagCreateRequest":
        self.custom_hex = validate_custom_hex(self.color, self.custom_hex)
        return self


class TTXTagUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=24)
    color: TagColor
    custom_hex: str | None = None

    @model_validator(mode="after")
    def _validate_custom_hex(self) -> "TTXTagUpdateRequest":
        self.custom_hex = validate_custom_hex(self.color, self.custom_hex)
        return self


class TTXTagListResponse(BaseModel):
    items: list[TTXTagRead]
    total: int
    limit: int
    offset: int


class TTXTagAssignmentRequest(BaseModel):
    """Full-replace semantics -- the caller sends the complete set of tag
    ids that should end up on the item, not an incremental add/remove.
    Matches how a checkbox-list tag picker naturally works: the user
    toggles some boxes, then saves the resulting set once."""

    tag_ids: list[uuid.UUID]
