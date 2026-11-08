"""A scenario: a whole exercise as a reusable, shareable package -- its
definition, needs analysis, MSEL and the exercise's own library (cast,
threat actors, injects, tags), without people, approvals or dates.

`ScenarioDocumentV1` is the data block of a `.ttx.md` file (see
services/scenario_document.py) and what an organization scenario stores.
Rows refer to each other by their human codes (NEED-01, OBJ-01, PH-01,
INJ-01, INJ-01-A1, ACT-01, THR-01), never by database ids, so a document
reads on its own and lands in any exercise. Every model forbids unknown
fields: a file from a newer TTX-Zone fails loudly instead of losing data.
Its JSON Schema is published (GET /scenario-format/1/schema.json)."""

import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.core.config import settings
from app.data.regulatory_catalog import REGULATORY_FRAMEWORKS, REGULATORY_REQUIREMENT_IDS
from app.models import (
    ActorOrigin,
    ActorType,
    AttackAttribution,
    Capability,
    DeliveryMethod,
    ExerciseLevel,
    InjectFormat,
    InjectKind,
    NeedPriority,
    NeedSource,
    Tlp,
    Trigger,
)
from app.models.tag_color import TagColor, validate_custom_hex
from app.schemas.threat_actor_library import (
    MAX_THREAT_ACTOR_TECHNIQUES,
    GroupId,
    ThreatActorTechnique,
)
from app.schemas.ttx_msel import (
    MAX_ACTORS,
    MAX_EXPECTED_ACTIONS,
    MAX_INCIDENT_JUMP_MINUTES,
    MAX_INJECT_FILES,
    MAX_INJECT_IMAGES,
    MAX_INJECT_TECHNIQUES,
    MAX_INJECTS,
    MAX_METERS,
    MAX_MINUTES,
    MAX_PHASES,
    MAX_POLL_OPTIONS,
    MAX_THREAT_ACTORS,
    AttackRef,
    InjectArtifact,
    MeterLevel,
    PollOption,
    PollOutcome,
    PollQuestion,
)

SCENARIO_FORMAT = "ttx-zone.scenario"
SCENARIO_FORMAT_VERSION = 8

ShortText = Annotated[str, Field(max_length=255)]
LongText = Annotated[str, Field(max_length=5000)]
ListItem = Annotated[str, Field(min_length=1, max_length=255)]
LongListItem = Annotated[str, Field(min_length=1, max_length=500)]
Code = Annotated[str, Field(min_length=1, max_length=24, pattern=r"^[A-Z0-9][A-Z0-9-]*$")]
OriginId = Annotated[str, Field(max_length=64)]
Counter = Annotated[int, Field(ge=1, le=10_000)]

MAX_TAGS = 100
MAX_IMAGES = 60


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class _Origin(_Strict):
    """What a library copy was copied from (informational)."""

    origin: ActorOrigin | None = None
    origin_id: OriginId | None = None
    origin_name: ShortText | None = None


# -- needs analysis ---------------------------------------------------------


class ScenarioNeed(_Strict):
    code: Code
    source: NeedSource
    title: ShortText = ""
    finding: LongText = ""
    affected_capability: Capability
    priority: NeedPriority


class ScenarioObjective(_Strict):
    code: Code
    title: ShortText = ""
    statement: LongText = ""
    capability: Capability
    need_codes: list[Code] = Field(default_factory=list, max_length=50)
    success_criterion: LongText = ""
    achieve_at_least: int | None = Field(default=None, ge=1, le=50)
    time_box_minutes: int | None = Field(default=None, ge=1, le=1440)
    achieved_note: LongText = ""
    partially_achieved: LongText = ""
    not_achieved: LongText = ""
    evidence: LongText = ""
    regulatory_requirement_ids: list[OriginId] = Field(default_factory=list, max_length=20)

    @field_validator("regulatory_requirement_ids")
    @classmethod
    def _known_requirements(cls, values: list[str]) -> list[str]:
        unknown = [v for v in values if v not in REGULATORY_REQUIREMENT_IDS]
        if unknown:
            raise ValueError(f"Unknown regulatory requirement: {', '.join(unknown)}")
        return list(dict.fromkeys(values))


class ScenarioRisk(_Strict):
    """A risk to the exercise and its mitigation (its owner is a person:
    left out)."""

    risk: LongText = ""
    mitigation: LongText = ""


class ScenarioNeeds(_Strict):
    """The needs analysis' content. Left out (filled again after import):
    document date, design lead, sponsor, findings owner and commitment,
    report recipients, date window, participants' availability and every
    approval."""

    tlp: Tlp = Tlp.AMBER
    triggers: list[Trigger] = Field(default_factory=list, max_length=len(Trigger))
    trigger_other: ShortText = ""
    regulatory_frameworks: list[Literal[REGULATORY_FRAMEWORKS]] = Field(  # type: ignore[valid-type]
        default_factory=list, max_length=len(REGULATORY_FRAMEWORKS)
    )
    regulatory_framework_other: ShortText = ""
    capabilities: list[Capability] = Field(default_factory=list, max_length=len(Capability))
    levels: list[ExerciseLevel] = Field(default_factory=list, max_length=len(ExerciseLevel))
    participating_areas: list[ListItem] = Field(default_factory=list, max_length=50)
    third_parties: list[ListItem] = Field(default_factory=list, max_length=50)
    perimeter: LongText = ""
    out_of_scope: LongText = ""
    max_duration_hours: int | None = Field(default=None, ge=1, le=720)
    confidentiality_restrictions: LongText = ""
    budget_and_external_support: LongText = ""
    stop_exercise_keyword: Annotated[str, Field(max_length=64)] = ""
    needs: list[ScenarioNeed] = Field(default_factory=list, max_length=50)
    objectives: list[ScenarioObjective] = Field(default_factory=list, max_length=20)
    risks: list[ScenarioRisk] = Field(default_factory=list, max_length=30)
    next_need_number: Counter = 1
    next_objective_number: Counter = 1


# -- MSEL ---------------------------------------------------------------------


class ScenarioPhaseObjective(_Strict):
    code: Code
    # Due by the end of this phase (its deadline).
    due: bool = False


class ScenarioPhase(_Strict):
    code: Code
    name: ShortText = ""
    start_offset: int = Field(default=0, ge=0, le=MAX_MINUTES)
    end_offset: int = Field(default=0, ge=0, le=MAX_MINUTES)
    incident_jump_minutes: int = Field(default=0, ge=0, le=MAX_INCIDENT_JUMP_MINUTES)
    situation_update: LongText = ""
    key_questions: list[LongListItem] = Field(default_factory=list, max_length=20)
    objectives: list[ScenarioPhaseObjective] = Field(default_factory=list, max_length=20)


class ScenarioThreatActor(_Origin):
    code: Code
    name: ShortText = ""
    mitre_group_id: GroupId | None = None
    aliases: list[ShortText] = Field(default_factory=list, max_length=50)
    description: LongText = ""
    techniques: list[ThreatActorTechnique] = Field(
        default_factory=list, max_length=MAX_THREAT_ACTOR_TECHNIQUES
    )


class ScenarioExpectedAction(_Strict):
    code: Code
    description: LongText = ""
    responsible_role: ShortText = ""
    expected_within_minutes: int | None = Field(default=None, ge=1, le=MAX_MINUTES)
    objective_codes: list[Code] = Field(default_factory=list, max_length=20)


class ScenarioInjectImage(_Strict):
    image: Annotated[str, Field(min_length=1, max_length=64)]
    caption: ShortText = ""


class ScenarioInject(_Origin):
    """An inject; its review status and validator are left out (a copy
    starts as a draft)."""

    code: Code
    phase_code: Code | None = None
    kind: InjectKind = InjectKind.MANDATORY
    title: ShortText = ""
    content: LongText = ""
    offset_minutes: int | None = Field(default=None, ge=0, le=MAX_MINUTES)
    trigger_condition: LongText = ""
    contingent_purpose: LongText = ""
    fires_at_minute: int | None = Field(default=None, ge=0, le=MAX_MINUTES)
    branch_from_code: Code | None = None
    branch_action_code: Code | None = None
    rejoin_code: Code | None = None
    sender_code: Code | None = None
    attack_attribution: AttackAttribution | None = None
    threat_actor_code: Code | None = None
    recipients: list[ListItem] = Field(default_factory=list, max_length=20)
    delivery_method: DeliveryMethod = DeliveryMethod.EMAIL
    attachment_notes: list[LongListItem] = Field(default_factory=list, max_length=10)
    attack_techniques: list[AttackRef] = Field(
        default_factory=list, max_length=MAX_INJECT_TECHNIQUES
    )
    facilitator_notes: LongText = ""
    scored: bool = True
    objective_codes: list[Code] = Field(default_factory=list, max_length=20)
    expected_actions: list[ScenarioExpectedAction] = Field(
        default_factory=list, max_length=MAX_EXPECTED_ACTIONS
    )
    images: list[ScenarioInjectImage] = Field(default_factory=list, max_length=MAX_INJECT_IMAGES)


class ScenarioMsel(_Strict):
    """The MSEL's content. Left out: start times (the session's and the
    incident's clock), status, version and who marked it ready."""

    title: ShortText = ""
    summary: LongText = ""
    attack_version: Annotated[str, Field(min_length=1, max_length=16)]
    duration_minutes: int | None = Field(default=None, ge=1, le=MAX_MINUTES)
    time_compression: int = Field(default=60, ge=1, le=MAX_MINUTES)
    phases: list[ScenarioPhase] = Field(default_factory=list, max_length=MAX_PHASES)
    threat_actors: list[ScenarioThreatActor] = Field(
        default_factory=list, max_length=MAX_THREAT_ACTORS
    )
    injects: list[ScenarioInject] = Field(default_factory=list, max_length=MAX_INJECTS)
    next_phase_number: Counter = 1
    next_inject_number: Counter = 1
    next_threat_actor_number: Counter = 1


# -- the exercise's own library -------------------------------------------------


class ScenarioActor(_Origin):
    """A simulated actor of the cast (who plays it is left out)."""

    code: Code
    name: ShortText = ""
    type: ActorType = ActorType.OTHER
    description: LongText = ""
    channel: DeliveryMethod | None = None


class ScenarioTag(_Origin):
    name: Annotated[str, Field(min_length=1, max_length=24)]
    color: TagColor
    custom_hex: str | None = None
    # Applied to the exercise itself (assignments to people and invitations
    # are left out).
    applied: bool = False

    @model_validator(mode="after")
    def _validate_custom_hex(self) -> "ScenarioTag":
        self.custom_hex = validate_custom_hex(self.color, self.custom_hex)
        return self


class ScenarioImage(_Strict):
    """An inject image, embedded (base64). Re-encoded on import like any
    upload."""

    key: Annotated[str, Field(min_length=1, max_length=64)]
    content_type: Literal["image/png", "image/jpeg"]
    data: Annotated[str, Field(min_length=1, max_length=8 * 1024 * 1024)]


class ScenarioExercise(_Strict):
    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: Annotated[str, Field(max_length=5000)] | None = None


class ScenarioDocumentV1(_Strict):
    format: Literal["ttx-zone.scenario"] = SCENARIO_FORMAT
    format_version: Literal[1] = 1
    # The language its text is written in.
    language: Literal["en", "es"]
    exported_at: datetime | None = None
    exercise: ScenarioExercise
    needs: ScenarioNeeds
    # None: the exercise had no MSEL yet.
    msel: ScenarioMsel | None = None
    cast: list[ScenarioActor] = Field(default_factory=list, max_length=MAX_ACTORS)
    next_actor_number: Counter = 1
    tags: list[ScenarioTag] = Field(default_factory=list, max_length=MAX_TAGS)
    images: list[ScenarioImage] = Field(default_factory=list, max_length=MAX_IMAGES)


# -- format version 2: a phase's headline -----------------------------------------


class ScenarioPhaseV2(ScenarioPhase):
    # One line the table sees once the phase begins.
    headline: Annotated[str, Field(max_length=80)] = ""


class ScenarioMselV2(ScenarioMsel):
    phases: list[ScenarioPhaseV2] = Field(default_factory=list, max_length=MAX_PHASES)


class ScenarioDocumentV2(ScenarioDocumentV1):
    format_version: Literal[2] = 2
    msel: ScenarioMselV2 | None = None


# -- format version 3: rooms ------------------------------------------------------


class ScenarioRoom(_Strict):
    """A room of an exercise played in several at once (its Players' seats
    are left out: they belong to the exercise)."""

    code: Code
    name: Annotated[str, Field(min_length=1, max_length=60)]
    description: Annotated[str, Field(max_length=500)] = ""


class ScenarioInjectV3(ScenarioInject):
    # The rooms it's played in; empty: all of them.
    room_codes: list[Code] = Field(default_factory=list, max_length=50)


class ScenarioMselV3(ScenarioMselV2):
    injects: list[ScenarioInjectV3] = Field(default_factory=list, max_length=MAX_INJECTS)


class ScenarioDocumentV3(ScenarioDocumentV2):
    format_version: Literal[3] = 3
    msel: ScenarioMselV3 | None = None
    uses_rooms: bool = False
    rooms: list[ScenarioRoom] = Field(default_factory=list, max_length=50)
    next_room_number: Counter = 1


# -- format version 4: inject files ----------------------------------------------

MAX_FILES = 60
# A file's base64 can be a third larger than the file.
_MAX_FILE_DATA = (settings.MSEL_FILE_MAX_BYTES * 4) // 3 + 4


class ScenarioInjectFile(_Strict):
    file: Annotated[str, Field(min_length=1, max_length=64)]
    description: ShortText = ""


class ScenarioInjectV4(ScenarioInjectV3):
    # Files the players download with it (logs, captures, dumps...).
    files: list[ScenarioInjectFile] = Field(default_factory=list, max_length=MAX_INJECT_FILES)


class ScenarioMselV4(ScenarioMselV3):
    injects: list[ScenarioInjectV4] = Field(default_factory=list, max_length=MAX_INJECTS)


class ScenarioFile(_Strict):
    """An inject file, embedded (base64) byte for byte, with its SHA-256
    (checked on import)."""

    key: Annotated[str, Field(min_length=1, max_length=64)]
    name: Annotated[str, Field(min_length=1, max_length=255)]
    sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    data: Annotated[str, Field(min_length=1, max_length=_MAX_FILE_DATA)]


class ScenarioDocumentV4(ScenarioDocumentV3):
    format_version: Literal[4] = 4
    msel: ScenarioMselV4 | None = None
    files: list[ScenarioFile] = Field(default_factory=list, max_length=MAX_FILES)


# -- format version 5: rendered simulated artifacts ---------------------------------


class ScenarioInjectV5(ScenarioInjectV4):
    # The content drawn as a simulated email, press release, social post or
    # chat message; None: plain text.
    artifact: InjectArtifact | None = None


class ScenarioMselV5(ScenarioMselV4):
    injects: list[ScenarioInjectV5] = Field(default_factory=list, max_length=MAX_INJECTS)


class ScenarioDocumentV5(ScenarioDocumentV4):
    format_version: Literal[5] = 5
    msel: ScenarioMselV5 | None = None


# -- format version 6: inject formats and polls ---------------------------------


class ScenarioInjectV6(ScenarioInjectV5):
    # In place of `scored` (see scenario_document._upgrade_5_to_6).
    format: InjectFormat = InjectFormat.INJECT
    poll_question: PollQuestion = ""
    poll_options: list[PollOption] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)


# Earlier versions keep `scored` in their published schema; this one doesn't.
ScenarioInjectV6.__pydantic_fields__.pop("scored")
ScenarioInjectV6.model_rebuild(force=True)


class ScenarioMselV6(ScenarioMselV5):
    injects: list[ScenarioInjectV6] = Field(default_factory=list, max_length=MAX_INJECTS)


class ScenarioDocumentV6(ScenarioDocumentV5):
    format_version: Literal[6] = 6
    msel: ScenarioMselV6 | None = None


# The current format: what TTX-Zone writes and reads (older files are
# upgraded first; see scenario_document.UPGRADERS).
class ScenarioInjectV7(ScenarioInjectV6):
    poll_outcomes: list[PollOutcome] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)


# A subclass collects its bases' annotations again: see ScenarioInjectV6.
ScenarioInjectV7.__pydantic_fields__.pop("scored")
ScenarioInjectV7.model_rebuild(force=True)


class ScenarioMselV7(ScenarioMselV6):
    injects: list[ScenarioInjectV7] = Field(default_factory=list, max_length=MAX_INJECTS)


class ScenarioDocumentV7(ScenarioDocumentV6):
    format_version: Literal[7] = 7
    msel: ScenarioMselV7 | None = None


# -- format version 8: impact meters -----------------------------------------


class ScenarioMeter(_Strict):
    key: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=40)


class ScenarioInjectV8(ScenarioInjectV7):
    poll_impacts: list[dict[str, MeterLevel]] = Field(
        default_factory=list, max_length=MAX_POLL_OPTIONS
    )


# A subclass collects its bases' annotations again: see ScenarioInjectV6.
ScenarioInjectV8.__pydantic_fields__.pop("scored")
ScenarioInjectV8.model_rebuild(force=True)


class ScenarioMselV8(ScenarioMselV7):
    meters: list[ScenarioMeter] = Field(default_factory=list, max_length=MAX_METERS)
    injects: list[ScenarioInjectV8] = Field(default_factory=list, max_length=MAX_INJECTS)


class ScenarioDocumentV8(ScenarioDocumentV7):
    format_version: Literal[8] = 8
    msel: ScenarioMselV8 | None = None


ScenarioDocument = ScenarioDocumentV8


# -- what the API returns ---------------------------------------------------------


class ScenarioCounts(BaseModel):
    needs: int = 0
    objectives: int = 0
    phases: int = 0
    injects: int = 0
    actors: int = 0
    threat_actors: int = 0
    tags: int = 0
    images: int = 0
    files: int = 0


class ScenarioVariable(BaseModel):
    """A `{placeholder}` the scenario's text uses, and how often."""

    name: str
    count: int


VariableName = Annotated[str, Field(pattern=r"^\w{1,64}$")]
VariableValue = Annotated[str, Field(max_length=255)]
ScenarioVariables = Annotated[dict[VariableName, VariableValue], Field(max_length=100)]


class ScenarioIssue(BaseModel):
    """One problem found before anything is written: `path` names where in
    the document (e.g. `msel.injects[3].phase_code`)."""

    path: str
    code: str
    # English, with `{placeholders}` for `params` until the endpoint puts it
    # in the client's language (scenario_service.localize_check).
    message: str
    params: dict[str, str | int] | None = Field(default=None, exclude=True)


class ScenarioCheck(BaseModel):
    """The outcome of checking a document against a target, with nothing
    written (a dry run) -- or of the import itself. `ok` false: errors were
    found and nothing changed. `replaces`: what the target holds today and
    an apply would overwrite."""

    ok: bool
    errors: list[ScenarioIssue] = Field(default_factory=list)
    warnings: list[ScenarioIssue] = Field(default_factory=list)
    name: str | None = None
    language: str | None = None
    format_version: int | None = None
    counts: ScenarioCounts | None = None
    replaces: ScenarioCounts | None = None
    # The {placeholders} the scenario uses (before any value is filled in).
    variables: list[ScenarioVariable] = Field(default_factory=list)
    # The exercise made from the scenario, once it exists.
    ttx_id: uuid.UUID | None = None


class ExerciseScenarioRead(ScenarioCounts):
    """What an exercise holds today, and whether a scenario may replace it
    (a played exercise keeps the design its sessions ran)."""

    played: bool


class ScenarioSummary(BaseModel):
    """A scenario as a library lists it (any level)."""

    id: str
    name: str
    description: str | None = None
    # The language of this text (a TTX-Zone scenario's follows the reader)...
    language: str
    # ...and those the scenario exists in, whoever reads it.
    languages: list[str]
    format_version: int
    attack_version: str | None = None
    counts: ScenarioCounts
    origin: ActorOrigin | None = None
    origin_id: str | None = None
    origin_name: str | None = None
    disabled_at: datetime | None = None
    usage_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ScenarioListResponse(BaseModel):
    items: list[ScenarioSummary]


class ScenarioRead(ScenarioSummary):
    document: ScenarioDocument


class OrganizationScenarioCreateRequest(BaseModel):
    """Add a scenario to the organization's library, from exactly one
    source: a TTX-Zone scenario, another of the organization's (a
    duplicate), or one of its exercises."""

    model_config = ConfigDict(extra="forbid")

    system_id: Annotated[str, Field(max_length=64)] | None = None
    organization_scenario_id: uuid.UUID | None = None
    ttx_id: uuid.UUID | None = None
    name: Annotated[str, Field(min_length=1, max_length=255)] | None = None
    # Which of a TTX-Zone scenario's languages to copy (left out: the
    # reader's). Any other source has only the one it was written in.
    language: Literal["en", "es"] | None = None

    @model_validator(mode="after")
    def _one_source(self) -> "OrganizationScenarioCreateRequest":
        sources = [self.system_id, self.organization_scenario_id, self.ttx_id]
        if sum(source is not None for source in sources) != 1:
            raise ValueError("Name exactly one source.")
        if self.language is not None and self.system_id is None:
            raise ValueError("Only a TTX-Zone scenario comes in several languages.")
        return self


class OrganizationScenarioUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Annotated[str, Field(min_length=1, max_length=255)]
    description: Annotated[str, Field(max_length=5000)] | None = None


class ScenarioApplyRequest(BaseModel):
    """Overwrite the exercise with a library scenario."""

    model_config = ConfigDict(extra="forbid")

    source: Literal["system", "organization"]
    id: Annotated[str, Field(min_length=1, max_length=64)]
    # Which of a TTX-Zone scenario's languages to copy (left out: the
    # exercise's content language, else the reader's).
    language: Literal["en", "es"] | None = None
    # Values for the scenario's {placeholders}; blank ones stay as they are.
    variables: ScenarioVariables = Field(default_factory=dict)
