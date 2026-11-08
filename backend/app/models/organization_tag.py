import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

from app.models.tag_color import TagColor
from app.models.ttx_msel import ActorOrigin


class OrganizationTag(SQLModel, table=True):
    """A label an Admin has defined for their organization.
    `organization_id` is the tag's owning namespace (which org's Tagging
    screen created it, mirroring TTXTag's own organization_id) -- it is
    NOT, by itself, whether the tag is currently applied to that
    Organization. Creating a tag leaves it unapplied (`applied=False`);
    applying/un-applying it to the Organization singleton is a separate,
    explicit, full-replace step (`PUT /organizations/{organization_id}/
    tags/apply`), the same "define once, apply as its own step" shape
    TTXTag already uses for Exercises/Invitations, so a freshly created
    tag is never applied by surprise.

    It is the organization level of the tag library (TTX-Zone's catalog
    above it, each exercise's tags below): `origin`/`origin_id`/
    `origin_name` say what it was duplicated from, if anything. Exercises
    never point at it -- they hold copies (TTXTag)."""

    __tablename__ = "organization_tag"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    name: str = Field(max_length=24)
    color: TagColor
    # Only meaningful (and only ever non-None) when color == TagColor.CUSTOM
    # -- see TagColor's own docstring. "#RRGGBB", validated at the schema
    # layer (CUSTOM_HEX_PATTERN), not here.
    custom_hex: str | None = Field(default=None, max_length=7)
    applied: bool = Field(default=False)
    origin: ActorOrigin | None = Field(default=None)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=64)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Set when it was deleted while still in use: hidden from pickers and
    # can't be copied again; deleted for good once nothing uses it.
    disabled_at: datetime | None = Field(default=None)
