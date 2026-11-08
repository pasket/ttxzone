import uuid
from datetime import UTC, datetime

from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel

from app.models.inject import DeliveryMethod, InjectFormat, InjectKind
from app.models.ttx_msel import ActorOrigin, ActorType


def _strings(length: int = 255) -> Column:
    return Column(ARRAY(String(length)), nullable=False, server_default="{}")


def _json(default: str) -> Column:
    return Column(JSONB, nullable=False, server_default=default)


class OrganizationInject(SQLModel, table=True):
    """An inject in an organization's library: every exercise of the
    organization can copy it into its MSEL. Managed by the organization's
    Program Managers (Exercise Planners copy it); one language, stated in
    `language` (`None`: written before the field existed). Exercises keep
    their copies when it changes or is deleted.

    A template, not an MSEL row: no phase, offset, objectives or review
    status (chosen on copy). `stage` and `capabilities` propose the phase
    and objectives; `within_minutes` in `expected_actions` is scenario
    time. The sender is described, not referenced (`actor_*`: name, type
    and -- for a TTX-Zone or library actor -- where it comes from), so a
    copy can find it in the exercise's cast or add it.

    `origin`/`origin_id`/`origin_name` say what it was duplicated from, if
    anything: a TTX-Zone inject (its INJ-<FAM>-NN code), another
    organization inject, or an exercise's."""

    __tablename__ = "organization_inject"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    organization_id: uuid.UUID = Field(foreign_key="organization.id", index=True)
    # The language its text is written in ("en" | "es"), like a scenario's.
    language: str | None = Field(default=None, max_length=8)
    title: str = Field(max_length=255)
    content: str = Field(default="")
    kind: InjectKind = Field(default=InjectKind.MANDATORY)
    # As in an MSEL inject, without the meters: those are an exercise's.
    format: InjectFormat = Field(
        default=InjectFormat.INJECT, sa_column_kwargs={"server_default": "INJECT"}
    )
    poll_question: str = Field(default="", max_length=300, sa_column_kwargs={"server_default": ""})
    poll_options: list[str] = Field(default_factory=list, sa_column=_strings(200))
    poll_outcomes: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(Text), nullable=False, server_default="{}"),
    )
    trigger_condition: str = Field(default="")
    contingent_purpose: str = Field(default="")
    actor_name: str = Field(default="", max_length=255)
    actor_type: ActorType = Field(default=ActorType.OTHER)
    actor_origin: ActorOrigin | None = Field(default=None)
    actor_origin_id: str | None = Field(default=None, max_length=64, index=True)
    delivery_method: DeliveryMethod = Field(default=DeliveryMethod.EMAIL)
    recipients: list[str] = Field(default_factory=list, sa_column=_strings())
    # [{"description", "responsible_role", "within_minutes"}]
    expected_actions: list[dict] = Field(default_factory=list, sa_column=_json("[]"))
    attachment_notes: list[str] = Field(default_factory=list, sa_column=_strings(500))
    key_question: str = Field(default="")
    facilitator_notes: str = Field(default="")
    families: list[str] = Field(default_factory=list, sa_column=_strings(32))
    stage: str = Field(default="response", max_length=16)
    audience: str = Field(default="mixed", max_length=16)
    capabilities: list[str] = Field(default_factory=list, sa_column=_strings(64))
    attack_version: str = Field(default="", max_length=16)
    # [{"domain", "tactic_id", "technique_id"}]
    attack: list[dict] = Field(default_factory=list, sa_column=_json("[]"))
    frameworks: list[str] = Field(default_factory=list, sa_column=_strings(32))
    # {variable name: default value}, scenario variables only.
    variable_defaults: dict = Field(default_factory=dict, sa_column=_json("{}"))
    origin: ActorOrigin | None = Field(default=None)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=255)
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    # Set when it was deleted while still in use: hidden from pickers and
    # can't be copied again; deleted for good once nothing uses it.
    disabled_at: datetime | None = Field(default=None)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
