import uuid
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel

from app.models.ttx_msel import ActorOrigin, ActorType


class OrganizationActor(SQLModel, table=True):
    """A simulated actor in an organization's library: every exercise of
    the organization can copy it into its cast. Managed by the
    organization's Program Managers (Exercise Planners copy it). Exercises keep
    their copies when it changes or is deleted.

    `origin`/`origin_id` say what it was duplicated from, if anything (a
    TTX-Zone actor, another organization actor, or an exercise's)."""

    __tablename__ = "organization_actor"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    name: str = Field(max_length=255)
    type: ActorType = Field(default=ActorType.OTHER)
    description: str = Field(default="")
    channel: str | None = Field(default=None, max_length=32)
    origin: ActorOrigin | None = Field(default=None)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=255)
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Set when it was deleted while still in use: hidden from pickers and
    # can't be copied again; deleted for good once nothing uses it.
    disabled_at: datetime | None = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
