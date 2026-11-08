import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, ForeignKey, Index, String, Text, UniqueConstraint, Uuid, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel

from app.models.ttx_msel import ActorOrigin


class AttackAttribution(StrEnum):
    """Whose activity an inject's ATT&CK techniques are: a threat actor of
    the scenario's, or noise -- unrelated activity (other attackers,
    commodity malware, coincidences, false positives) that tests the
    players' triage. None (the column null): no ATT&CK at all."""

    THREAT_ACTOR = "threat_actor"
    NOISE = "noise"


class InjectKind(StrEnum):
    MANDATORY = "mandatory"
    CONTINGENT = "contingent"


class InjectFormat(StrEnum):
    """What an inject is, and so what it asks of the table: an inject that
    evaluates objectives (INJ), a discussion slide -- a debrief or reflection
    prompt, no objective, not in the EEG nor the coverage (DSC) --, or a poll
    the Players vote on, outside the evaluation too (POL)."""

    INJECT = "inject"
    DISCUSSION = "discussion"
    POLL = "poll"


class DeliveryMethod(StrEnum):
    EMAIL = "email"
    PHONE = "phone"
    CHAT = "chat"
    # An incident or service ticket (ITSM): how a SOC usually escalates.
    TICKET = "ticket"
    # An alert or finding in a security tool (SIEM, EDR, a console).
    SECURITY_TOOL = "security_tool"
    IN_PERSON = "in_person"
    BRIEFING = "briefing"
    MEDIA = "media"
    DOCUMENT = "document"


class ArtifactKind(StrEnum):
    """How the Playground renders an inject's content as a simulated
    artifact (a template drawn by the app, never uploaded markup)."""

    EMAIL = "email"
    PRESS_RELEASE = "press_release"
    SOCIAL_POST = "social_post"
    CHAT_MESSAGE = "chat_message"


class InjectReviewStatus(StrEnum):
    DRAFT = "draft"
    VALIDATED = "validated"


def _string_array(length: int = 255) -> Column:
    return Column(ARRAY(String(length)), nullable=False, server_default="{}")


class Inject(SQLModel, table=True):
    """One event of the MSEL: what a simulated actor delivers to whom, and
    when. Mandatory injects sit at an offset from T+0; contingent ones fire
    on a condition (`trigger_condition`) for a purpose (`contingent_purpose`).
    Every inject of the inject format evaluates at least one objective (InjectObjective)
    through its expected actions (InjectExpectedAction) -- the EEG's
    observation points. Written only through the MSEL save (ttx_msel_service).

    The MSEL columns are nullable in the database so the table could evolve
    in place; the request schemas are what make them required."""

    __tablename__ = "inject"
    # Which library item it copies: what library_usage_service looks up.
    __table_args__ = (Index("ix_inject_origin", "origin", "origin_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    msel_id: uuid.UUID | None = Field(default=None, foreign_key="ttx_msel.id", index=True)
    phase_id: uuid.UUID | None = Field(default=None, foreign_key="msel_phase.id", index=True)
    code: str = Field(default="", max_length=16)
    position: int = Field(default=0)
    kind: InjectKind = Field(default=InjectKind.MANDATORY)
    title: str = Field(max_length=255)
    content: str
    offset_minutes: int | None = Field(default=None)
    trigger_condition: str = Field(default="")
    contingent_purpose: str = Field(default="")
    # Where a contingent inject sits in the storyline (the storyline map's
    # branches): the inject it hangs from, optionally the expected action of
    # that inject whose absence fires it, and the mandatory inject where the
    # storyline resumes. Null on mandatory injects; a contingent one without
    # them is reported, never refused (MSEL rules M14-M17: not anchored, a
    # loop, no way back, a way back that isn't a later mandatory inject).
    branch_from_id: uuid.UUID | None = Field(default=None, foreign_key="inject.id", index=True)
    # A cycle with inject_expected_action (which points back at inject):
    # named and created with ALTER, so metadata create/drop can order it.
    branch_action_id: uuid.UUID | None = Field(
        default=None,
        sa_column=Column(
            Uuid,
            ForeignKey(
                "inject_expected_action.id", use_alter=True, name="fk_inject_branch_action_id"
            ),
            nullable=True,
        ),
    )
    rejoin_inject_id: uuid.UUID | None = Field(default=None, foreign_key="inject.id", index=True)
    # When the facilitator checks whether to fire a contingent inject, in
    # minutes after its phase starts. Null: the trigger action's "expected
    # within" (the storyline map places the branch there). Mandatory: null.
    fires_at_minute: int | None = Field(default=None)
    simulated_actor_id: uuid.UUID | None = Field(
        default=None, foreign_key="msel_simulated_actor.id", index=True
    )
    # Whose activity its techniques are; the threat actor when it's one.
    attack_attribution: AttackAttribution | None = Field(default=None)
    threat_actor_id: uuid.UUID | None = Field(
        default=None, foreign_key="msel_threat_actor.id", index=True
    )
    recipients: list[str] = Field(default_factory=list, sa_column=_string_array())
    # The rooms (TTXRoom) it's played in when the exercise uses rooms; empty:
    # all of them. Ignored without rooms.
    room_ids: list[uuid.UUID] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(Uuid), nullable=False, server_default="{}"),
    )
    delivery_method: DeliveryMethod = Field(default=DeliveryMethod.EMAIL)
    attachment_notes: list[str] = Field(default_factory=list, sa_column=_string_array(500))
    facilitator_notes: str = Field(default="")
    # Rendered simulated artifact (schemas.ttx_msel.InjectArtifact as a
    # dict): the content shown as a fake email, press release, social post
    # or chat message. None: shown as plain text.
    artifact: dict | None = Field(default=None, sa_column=Column(JSONB, nullable=True))
    # A discussion inject's expected actions are only discussion points; a
    # poll has none, and the question and options below instead.
    format: InjectFormat = Field(
        default=InjectFormat.INJECT, sa_column_kwargs={"server_default": "INJECT"}
    )
    poll_question: str = Field(default="", max_length=300, sa_column_kwargs={"server_default": ""})
    poll_options: list[str] = Field(default_factory=list, sa_column=_string_array(200))
    # What follows each option, by position; blank: nothing is said.
    poll_outcomes: list[str] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(Text), nullable=False, server_default="{}"),
    )
    # What each option adds to the MSEL's meters, by position: meter key ->
    # level (1 low, 2 medium, 3 high; left out: none).
    poll_impacts: list[dict] = Field(
        default_factory=list,
        sa_column=Column(JSONB, nullable=False, server_default=text("'[]'::jsonb")),
    )
    review_status: InjectReviewStatus = Field(default=InjectReviewStatus.DRAFT)
    # Who validated it: stamped by the server with the user who marks it
    # validated (or overrides someone else's validation), never taken from
    # the client; the name is kept as it was then.
    validated_by: str = Field(default="", max_length=255)
    validated_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    # What it was copied from (the inject library's levels share the actor
    # library's ActorOrigin), if anything: SYSTEM + an INJ-<FAM>-NN code,
    # or ORGANIZATION + an OrganizationInject id. Null for an inject
    # written in the MSEL.
    origin: ActorOrigin | None = Field(default=None)
    origin_id: str | None = Field(default=None, max_length=64)
    origin_name: str | None = Field(default=None, max_length=255)
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class InjectObjective(SQLModel, table=True):
    """Which needs-analysis objectives an inject evaluates (at least one)."""

    __tablename__ = "inject_objective"

    inject_id: uuid.UUID = Field(foreign_key="inject.id", primary_key=True)
    objective_id: uuid.UUID = Field(foreign_key="ttx_objective.id", primary_key=True, index=True)


class InjectAttackTechnique(SQLModel, table=True):
    """An ATT&CK technique an inject illustrates, under the tactic it
    serves there -- ids of the MSEL's pinned release. Attributed to the
    inject's threat actor, or noise (`Inject.attack_attribution`)."""

    __tablename__ = "inject_attack_technique"
    __table_args__ = (UniqueConstraint("inject_id", "tactic_id", "technique_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    inject_id: uuid.UUID = Field(foreign_key="inject.id", index=True)
    position: int = Field(default=0)
    domain: str = Field(max_length=16)
    tactic_id: str = Field(max_length=16)
    technique_id: str = Field(max_length=16)


class InjectExpectedAction(SQLModel, table=True):
    """An observable action the inject should provoke. Its description is
    the observation point the EEG lists under each objective it evidences
    (`objective_ids`, a subset of the inject's)."""

    __tablename__ = "inject_expected_action"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    inject_id: uuid.UUID = Field(foreign_key="inject.id", index=True)
    code: str = Field(max_length=24)
    position: int = Field(default=0)
    description: str = Field(default="")
    responsible_role: str = Field(default="", max_length=255)
    expected_within_minutes: int | None = Field(default=None)
    # The inject's objectives this action evidences (no FK, like the
    # conduct prep's: readers keep only those still on the inject). Empty:
    # it evidences none, and no EEG lists it.
    objective_ids: list[uuid.UUID] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(Uuid()), nullable=False, server_default="{}"),
    )
