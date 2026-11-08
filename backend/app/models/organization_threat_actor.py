import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, String
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel

from app.models.ttx_msel import ActorOrigin


class OrganizationThreatActor(SQLModel, table=True):
    """A threat actor in an organization's library: a MITRE ATT&CK group
    copied (and perhaps narrowed) for the organization, or a profile of its
    own -- an actor with no MITRE id, with or without techniques. Every
    exercise of the organization can copy it into its scenario. Managed by
    the organization's Program Managers (Exercise Planners copy it); exercises
    keep their copies when it changes or is deleted.

    `techniques` are (domain, technique id) pairs of release
    `attack_version`, as MITRE attributes them to a group (no tactic: a
    technique may serve several). `mitre_group_id` names the MITRE group it
    is, if any. `origin`/`origin_id`/`origin_name` say what it was
    duplicated from: a TTX-Zone group (its G id), another organization
    threat actor, or an exercise's."""

    __tablename__ = "organization_threat_actor"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    name: str = Field(max_length=255)
    mitre_group_id: str | None = Field(default=None, max_length=16)
    aliases: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(String(255)), nullable=False, server_default="{}"),
    )
    description: str = Field(default="")
    attack_version: str = Field(max_length=16)
    techniques: list[dict] = Field(
        default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]")
    )
    origin: ActorOrigin | None = Field(default=None)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=255)
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Set when it was deleted while still in use: hidden from pickers and
    # can't be copied again; deleted for good once nothing uses it.
    disabled_at: datetime | None = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
