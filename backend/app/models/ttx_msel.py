import uuid
from datetime import UTC, date, datetime, time
from enum import StrEnum

from sqlalchemy import Column, Index, String, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel

from app.data.attack_catalog import LATEST_ATTACK_VERSION


class MselStatus(StrEnum):
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    READY = "ready"


class ActorType(StrEnum):
    SOC = "soc"
    CSIRT = "csirt"
    AUTHORITY = "authority"
    MEDIA = "media"
    SUPPLIER = "supplier"
    CUSTOMER = "customer"
    THREAT_ACTOR = "threat_actor"
    INTERNAL = "internal"
    OTHER = "other"


class ActorOrigin(StrEnum):
    """Where a simulated actor comes from -- the actor library's levels.
    An exercise's cast only holds copies; the origin says of what."""

    SYSTEM = "system"  # TTX-Zone's own catalog (app/data/actor_catalog.py)
    ORGANIZATION = "organization"  # an OrganizationActor
    EXERCISE = "exercise"  # made for this exercise


def _string_array(length: int = 255) -> Column:
    # A fresh Column per field: SQLAlchemy binds a Column to one table
    # attribute, so the definition can't be shared.
    return Column(ARRAY(String(length)), nullable=False, server_default="{}")


class TTXMsel(SQLModel, table=True):
    """The exercise's Master Scenario Events List (MSEL): the scenario,
    its phases and the timed injects that drive the session -- one per TTX,
    created the first time it's opened with an approved needs form.

    Like the needs form: text defaults to "" (a DRAFT is saved incomplete;
    the validation report judges completeness), `revision` bumps on every
    save (optimistic locking) and `version` is the document version, bumped
    when a READY MSEL is edited. `needs_form_version` is the needs-form
    version the MSEL was last reconciled with (rule M02). Row codes come
    from the never-reused counters below."""

    __tablename__ = "ttx_msel"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", unique=True, index=True)
    status: MselStatus = Field(default=MselStatus.DRAFT)
    version: int = Field(default=1)
    revision: int = Field(default=0)
    needs_form_version: int = Field(default=1)

    # Scenario
    title: str = Field(default="", max_length=255)
    summary: str = Field(default="")
    # The MITRE ATT&CK release the scenario's techniques come from (see
    # app/data/attack_catalog.py); changed only by an explicit upgrade.
    attack_version: str = Field(default=LATEST_ATTACK_VERSION, max_length=16)
    exercise_start: time | None = Field(default=None)
    # When the incident starts inside the fiction (the scene's clock), as
    # opposed to `exercise_start`, when the meeting does.
    incident_start: time | None = Field(default=None)
    # The scene's date, if the fiction has one ("Sunday 3 May"): the
    # Playground's clock reads it; without one, "Day N".
    incident_date: date | None = Field(default=None)
    duration_minutes: int | None = Field(default=None)
    # The impact meters the polls move: `[{key, name}]`.
    meters: list[dict] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, server_default=text("'[]'::jsonb")),
    )
    # Scenario minutes per session minute (1 = real time, 60 = an hour a minute).
    time_compression: int = Field(default=60)

    next_phase_number: int = Field(default=1)
    next_inject_number: int = Field(default=1)
    next_threat_actor_number: int = Field(default=1, sa_column_kwargs={"server_default": "1"})

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    # Who marked the current version READY, stamped by the server like an
    # inject's "Validated by" (the name kept as it was then); cleared when
    # it goes back to DRAFT.
    ready_by: str = Field(default="", max_length=255)
    ready_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    ready_at: datetime | None = Field(default=None)


class MselPhase(SQLModel, table=True):
    """A phase of the scenario: a band of the session with its situation
    update and the key questions the facilitator asks."""

    __tablename__ = "msel_phase"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    msel_id: uuid.UUID = Field(foreign_key="ttx_msel.id", index=True)
    code: str = Field(max_length=16)
    position: int = Field(default=0)
    name: str = Field(default="", max_length=255)
    # One line the table sees once the phase begins ("100 GB stolen").
    headline: str = Field(default="", max_length=80, sa_column_kwargs={"server_default": ""})
    start_offset: int = Field(default=0)
    end_offset: int = Field(default=0)
    # Incident time that passes between the previous phase and this one
    # ("48 h later"), on top of the time compression.
    incident_jump_minutes: int = Field(default=0, sa_column_kwargs={"server_default": "0"})
    situation_update: str = Field(default="")
    key_questions: list[str] = Field(default_factory=list, sa_column=_string_array(500))


class MselPhaseObjective(SQLModel, table=True):
    """Which needs-analysis objectives a phase works on. `due`: the
    objective (or one of its decisions) must be achieved before this phase
    ends -- its deadline, shown in the EEG, in place of a time box in
    minutes."""

    __tablename__ = "msel_phase_objective"

    phase_id: uuid.UUID = Field(foreign_key="msel_phase.id", primary_key=True)
    objective_id: uuid.UUID = Field(foreign_key="ttx_objective.id", primary_key=True, index=True)
    due: bool = Field(default=False, sa_column_kwargs={"server_default": "false"})


class MselSimulatedActor(SQLModel, table=True):
    """Who "sends" an inject inside the fiction (the SOC, a journalist,
    the threat actor...): the exercise's cast. Not a platform user;
    `played_by` is free text naming who voices it during the session.

    It belongs to the exercise, not to its MSEL: Library -> Simulated
    actors manages it at any time, before the needs analysis is approved
    and the MSEL exists; the MSEL's injects then pick their sender from it.
    (The table keeps its original name.)"""

    __tablename__ = "msel_simulated_actor"
    # Which library item it copies: what library_usage_service looks up.
    __table_args__ = (Index("ix_msel_simulated_actor_origin", "origin", "origin_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    code: str = Field(max_length=16)
    position: int = Field(default=0)
    name: str = Field(default="", max_length=255)
    type: ActorType = Field(default=ActorType.OTHER)
    # Its role in the fiction, and how it usually reaches the players.
    description: str = Field(default="")
    channel: str | None = Field(default=None, max_length=32)
    # A copy of a library actor remembers which (informational: the
    # original may change or be deleted; this copy doesn't follow it).
    origin: ActorOrigin = Field(default=ActorOrigin.EXERCISE)
    origin_id: str | None = Field(default=None, max_length=64)
    # The original's name when copied: "Copied from" still reads after
    # the original is renamed or deleted.
    origin_name: str | None = Field(default=None, max_length=255)
    played_by: str = Field(default="", max_length=255)


class MselThreatActor(SQLModel, table=True):
    """A threat actor behind the scenario -- one of several, perhaps
    collaborating: a MITRE ATT&CK group (`mitre_group_id`) or an unknown
    actor, with the techniques that characterize it (its profile: (domain,
    technique id) pairs of the MSEL's pinned release, no tactic -- a
    technique may serve several). Unknown actors may have none. Always a
    copy (of Library -> Threat actors, or made here): `origin*` say of what.
    Injects attribute their techniques to one (`Inject.threat_actor_id`)."""

    __tablename__ = "msel_threat_actor"
    # Which library item it copies: what library_usage_service looks up.
    __table_args__ = (Index("ix_msel_threat_actor_origin", "origin", "origin_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    msel_id: uuid.UUID = Field(foreign_key="ttx_msel.id", index=True)
    code: str = Field(max_length=16)
    position: int = Field(default=0)
    name: str = Field(default="", max_length=255)
    mitre_group_id: str | None = Field(default=None, max_length=16)
    aliases: list[str] = Field(default_factory=list, sa_column=_string_array())
    # Its role in the scenario, how it works with the others.
    description: str = Field(default="")
    techniques: list[dict] = Field(
        default_factory=list, sa_column=Column(JSONB, nullable=False, server_default="[]")
    )
    origin: ActorOrigin = Field(default=ActorOrigin.EXERCISE)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=255)
    # When it last changed after being copied or created (null: never) --
    # what tells a copy that still matches its original from an adapted one.
    modified_at: datetime | None = Field(default=None)


class MselSnapshot(SQLModel, table=True):
    """The MSEL as it was when it became READY -- immutable. Conduct (and
    the Evaluator's EEG) work from the frozen version, not the live one."""

    __tablename__ = "msel_snapshot"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    msel_id: uuid.UUID = Field(foreign_key="ttx_msel.id", index=True)
    version: int
    payload: dict = Field(sa_column=Column(JSONB, nullable=False))
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
