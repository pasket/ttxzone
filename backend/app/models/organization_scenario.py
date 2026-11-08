import uuid
from datetime import UTC, datetime

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.ttx_msel import ActorOrigin


class OrganizationScenario(SQLModel, table=True):
    """A scenario in an organization's library: a whole exercise packaged
    for reuse (schemas/scenario.py's ScenarioDocumentV1, stored as is in
    `document`). Managed by the organization's Program Managers -- created
    from TTX-Zone's catalog, another of its scenarios, one of its exercises
    or an imported file; its Exercise Planners copy it onto an exercise,
    which overwrites that exercise's content.

    `name`/`description` are the library's own labels (editable); the
    document keeps the exercise's. `counts` caches what the document holds
    for the list. `origin`/`origin_id` say what it was made from, if
    anything (an imported file has none)."""

    __tablename__ = "organization_scenario"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    name: str = Field(max_length=255)
    description: str | None = Field(default=None)
    language: str = Field(max_length=8)
    format_version: int
    attack_version: str | None = Field(default=None, max_length=16)
    document: dict = Field(sa_column=Column(JSONB, nullable=False))
    counts: dict = Field(sa_column=Column(JSONB, nullable=False, server_default="{}"))
    origin: ActorOrigin | None = Field(default=None)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=255)
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Set when it was deleted while exercises still came from it.
    disabled_at: datetime | None = Field(default=None)
