import uuid
from datetime import UTC, datetime

from sqlalchemy import Index
from sqlmodel import Field, SQLModel

from app.models.tag_color import TagColor
from app.models.ttx_msel import ActorOrigin


class TTXTag(SQLModel, table=True):
    """A tag of one exercise -- the exercise level of the tag library
    (TTX-Zone's catalog, then the organization's OrganizationTag, then
    these). Assignable to that exercise, its invitation tokens and its
    planning team members (TTXTagAssignment, InvitationTokenTagAssignment,
    TTXAccessTagAssignment); a row here is just a definition, applying it
    is a separate step.

    Like every library level, a tag that comes from above is a copy:
    `origin`/`origin_id`/`origin_name` say of what, and editing or
    deleting the original never changes it."""

    __tablename__ = "ttx_tag"
    # Which library item it copies: what library_usage_service looks up.
    __table_args__ = (Index("ix_ttx_tag_origin", "origin", "origin_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    name: str = Field(max_length=24)
    color: TagColor
    # Only meaningful (and only ever non-None) when color == TagColor.CUSTOM
    # -- see TagColor's own docstring. "#RRGGBB", validated at the schema
    # layer (CUSTOM_HEX_PATTERN), not here.
    custom_hex: str | None = Field(default=None, max_length=7)
    origin: ActorOrigin | None = Field(default=None)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
