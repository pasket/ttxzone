import uuid
from datetime import date, datetime, time
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models import (
    ActorOrigin,
    ActorType,
    ArtifactKind,
    AttackAttribution,
    Capability,
    DeliveryMethod,
    InjectFormat,
    InjectKind,
    InjectReviewStatus,
    MselStatus,
    NeedsFormStatus,
    Tlp,
)
from app.schemas.threat_actor_library import (
    MAX_THREAT_ACTOR_TECHNIQUES,
    GroupId,
    ThreatActorTechnique,
    ThreatActorTechniqueRead,
)
from app.schemas.ttx_needs_form import ValidationReport

ShortText = Annotated[str, Field(max_length=255)]
LongText = Annotated[str, Field(max_length=5000)]
MAX_POLL_OPTIONS = 6
PollQuestion = Annotated[str, Field(max_length=300)]
PollOption = Annotated[str, Field(max_length=200)]
PollOutcome = Annotated[str, Field(max_length=1000)]
MAX_METERS = 6
MAX_METER_LEVEL = 3  # 1 low, 2 medium, 3 high
MeterLevel = Annotated[int, Field(ge=0, le=MAX_METER_LEVEL)]
ListItem = Annotated[str, Field(min_length=1, max_length=255)]
LongListItem = Annotated[str, Field(min_length=1, max_length=500)]
Key = Annotated[str, Field(min_length=1, max_length=64)]

MAX_PHASES = 8
MAX_INJECTS = 40
MAX_EXPECTED_ACTIONS = 8
MAX_ACTORS = 30
MAX_MINUTES = 24 * 60
# Longest time jump between two phases, in incident time: 30 days.
MAX_INCIDENT_JUMP_MINUTES = 30 * 24 * 60


def _dedupe(values: list) -> list:
    return list(dict.fromkeys(values))


MAX_INJECT_TECHNIQUES = 20
# Threat actors behind one scenario (a few collaborating at most).
MAX_THREAT_ACTORS = 5


class AttackRef(BaseModel):
    """An ATT&CK technique under the tactic it serves, by id. Whether it
    exists is checked against the MSEL's pinned release by the service
    (the payload doesn't carry the release)."""

    domain: Literal["enterprise", "ics"]
    tactic_id: Annotated[str, Field(pattern=r"^TA\d{4}$")]
    technique_id: Annotated[str, Field(pattern=r"^T\d{4}(\.\d{3})?$")]

    def key(self) -> tuple[str, str, str]:
        return (self.domain, self.tactic_id, self.technique_id)


class AttackRefRead(AttackRef):
    """With its names in the pinned release (English, as MITRE publishes
    them) -- kept in snapshots, so a frozen MSEL reads on its own."""

    tactic_name: str
    technique_name: str


def _unique_refs(values: list[AttackRef]) -> list[AttackRef]:
    return list({ref.key(): ref for ref in values}.values())


class ActorInput(BaseModel):
    """A simulated actor. `id` is set for a saved row; `key` is how injects
    in the same payload refer to it -- the id itself for a saved row, any
    temporary string for a new one (same scheme as the needs form)."""

    id: uuid.UUID | None = None
    key: Key
    name: ShortText = ""
    type: ActorType = ActorType.OTHER
    description: LongText = ""
    channel: DeliveryMethod | None = None
    origin: ActorOrigin = ActorOrigin.EXERCISE
    origin_id: Annotated[str, Field(max_length=64)] | None = None
    origin_name: ShortText | None = None
    played_by: ShortText = ""


class ThreatActorInput(BaseModel):
    """A threat actor of the scenario (see MselThreatActor). `key` is how
    injects in the same payload attribute to it (the id for a saved row)."""

    id: uuid.UUID | None = None
    key: Key
    name: ShortText = ""
    mitre_group_id: GroupId | None = None
    aliases: list[ShortText] = Field(default_factory=list, max_length=50)
    description: LongText = ""
    techniques: list[ThreatActorTechnique] = Field(
        default_factory=list, max_length=MAX_THREAT_ACTOR_TECHNIQUES
    )
    origin: ActorOrigin = ActorOrigin.EXERCISE
    origin_id: Annotated[str, Field(max_length=64)] | None = None
    origin_name: ShortText | None = None

    @field_validator("techniques")
    @classmethod
    def _unique_techniques(cls, values: list[ThreatActorTechnique]) -> list[ThreatActorTechnique]:
        return list({v.key(): v for v in values}.values())


class PhaseInput(BaseModel):
    id: uuid.UUID | None = None
    key: Key
    name: ShortText = ""
    headline: Annotated[str, Field(max_length=80)] = ""
    start_offset: int = Field(default=0, ge=0, le=MAX_MINUTES)
    end_offset: int = Field(default=0, ge=0, le=MAX_MINUTES)
    incident_jump_minutes: int = Field(default=0, ge=0, le=MAX_INCIDENT_JUMP_MINUTES)
    situation_update: LongText = ""
    key_questions: list[LongListItem] = Field(default_factory=list, max_length=20)
    objective_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    # The objectives due by the end of this phase (their deadline); a
    # subset of `objective_ids` -- the others are dropped.
    due_objective_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)

    @field_validator("objective_ids", "due_objective_ids")
    @classmethod
    def _unique(cls, values: list) -> list:
        return _dedupe(values)

    @model_validator(mode="after")
    def _due_subset(self) -> "PhaseInput":
        self.due_objective_ids = [o for o in self.due_objective_ids if o in self.objective_ids]
        return self


class ExpectedActionInput(BaseModel):
    id: uuid.UUID | None = None
    # How a contingent inject names this action as its trigger before it is
    # saved (a saved one is also named by its id).
    key: str | None = Field(default=None, max_length=64)
    description: LongText = ""
    responsible_role: ShortText = ""
    expected_within_minutes: int | None = Field(default=None, ge=1, le=MAX_MINUTES)
    # The inject's objectives this action evidences (the EEG of each lists
    # it); others are dropped. None: all of the inject's.
    objective_ids: list[uuid.UUID] | None = Field(default=None, max_length=20)

    @field_validator("objective_ids")
    @classmethod
    def _unique(cls, values: list | None) -> list | None:
        return None if values is None else _dedupe(values)


MAX_INJECT_IMAGES = 10
MAX_INJECT_FILES = 10


class InjectImageInput(BaseModel):
    """An uploaded image of the MSEL shown with the inject (in order)."""

    image_id: uuid.UUID
    caption: ShortText = ""


class InjectFileInput(BaseModel):
    """An uploaded file of the MSEL handed out with the inject (in order)."""

    file_id: uuid.UUID
    description: ShortText = ""


class InjectArtifact(BaseModel):
    """An inject's content rendered as a simulated artifact. The body is the
    inject's own `content`; these are the template's other fields, whose
    meaning follows `kind` (email: from, address, to, subject, date; press
    release: outlet, dateline, headline, date; social post: author, handle,
    date; chat message: sender, channel, date). All plain text: the
    Playground draws them, nothing is ever rendered as markup."""

    model_config = ConfigDict(extra="forbid")

    kind: ArtifactKind
    sender: ShortText = ""
    sender_address: ShortText = ""
    recipient: ShortText = ""
    subject: ShortText = ""
    timestamp: Annotated[str, Field(max_length=64)] = ""
    location: ShortText = ""


class InjectInput(BaseModel):
    id: uuid.UUID | None = None
    # Names an unsaved row in the dry-run report (a saved one is named by
    # its id). Ignored when saving.
    key: str | None = Field(default=None, max_length=64)
    phase_key: Key
    kind: InjectKind = InjectKind.MANDATORY
    title: ShortText = ""
    content: LongText = ""
    offset_minutes: int | None = Field(default=None, ge=0, le=MAX_MINUTES)
    trigger_condition: LongText = ""
    contingent_purpose: LongText = ""
    # Contingent only (cleared on a mandatory one): when the facilitator
    # checks whether to fire it, in minutes after its phase starts.
    fires_at_minute: int | None = Field(default=None, ge=0, le=MAX_MINUTES)
    # The storyline map's branch (contingent injects only; ignored on a
    # mandatory one): the inject it hangs from, the expected action of that
    # inject whose absence fires it, and the mandatory inject where the
    # storyline resumes -- each named by its `key` or, once saved, its id.
    branch_from_key: str | None = Field(default=None, max_length=64)
    branch_action_key: str | None = Field(default=None, max_length=64)
    rejoin_key: str | None = Field(default=None, max_length=64)
    actor_key: Key | None = None
    # Whose activity its techniques are: a threat actor of the scenario
    # (`threat_actor_key`), or noise. None: no ATT&CK, and techniques sent
    # anyway are dropped.
    attack_attribution: AttackAttribution | None = None
    threat_actor_key: Key | None = None
    recipients: list[ListItem] = Field(default_factory=list, max_length=20)
    # The exercise's rooms it's played in; empty: all of them.
    room_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    delivery_method: DeliveryMethod = DeliveryMethod.EMAIL
    attachment_notes: list[LongListItem] = Field(default_factory=list, max_length=10)
    attack_techniques: list[AttackRef] = Field(
        default_factory=list, max_length=MAX_INJECT_TECHNIQUES
    )
    facilitator_notes: LongText = ""
    # Shown to the table as a simulated email, press release... (None: text).
    artifact: InjectArtifact | None = None
    # Anything but an inject: its objectives are dropped and it stays out of
    # the EEG and the coverage. A poll's expected actions go too.
    format: InjectFormat = InjectFormat.INJECT
    # A poll's question and options (dropped on any other format). A draft
    # may hold a blank one: the report says so.
    poll_question: PollQuestion = ""
    poll_options: list[PollOption] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)
    # What follows each option, by position (optional; blank: nothing).
    poll_outcomes: list[PollOutcome] = Field(default_factory=list, max_length=MAX_POLL_OPTIONS)
    # What each option adds to the meters, by position: meter key -> level.
    poll_impacts: list[dict[str, MeterLevel]] = Field(
        default_factory=list, max_length=MAX_POLL_OPTIONS
    )
    review_status: InjectReviewStatus = InjectReviewStatus.DRAFT
    # Ignored: the server stamps who validated it (see save_msel).
    validated_by: ShortText = ""
    # Who the client believes validated it: unchanged keeps the stored
    # validation; the caller's own id asks to take it over.
    validated_by_id: uuid.UUID | None = None
    objective_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)
    expected_actions: list[ExpectedActionInput] = Field(
        default_factory=list, max_length=MAX_EXPECTED_ACTIONS
    )
    images: list[InjectImageInput] = Field(default_factory=list, max_length=MAX_INJECT_IMAGES)
    files: list[InjectFileInput] = Field(default_factory=list, max_length=MAX_INJECT_FILES)

    @field_validator("images")
    @classmethod
    def _unique_images(cls, values: list[InjectImageInput]) -> list[InjectImageInput]:
        return list({image.image_id: image for image in values}.values())

    @field_validator("files")
    @classmethod
    def _unique_files(cls, values: list[InjectFileInput]) -> list[InjectFileInput]:
        return list({file.file_id: file for file in values}.values())

    @field_validator("recipients", "objective_ids", "room_ids")
    @classmethod
    def _unique(cls, values: list) -> list:
        return _dedupe(values)

    @field_validator("attack_techniques")
    @classmethod
    def _techniques(cls, values: list[AttackRef]) -> list[AttackRef]:
        return _unique_refs(values)


def refs(row) -> set[str]:
    """How other rows of a payload may name this one: its key and, once
    saved, its id."""
    return {r for r in (row.key, str(row.id) if row.id else None) if r}


class MeterInput(BaseModel):
    """An impact meter: what the polls' decisions add up on."""

    key: str = Field(min_length=1, max_length=64)
    name: str = Field(default="", max_length=40)


class MselSaveRequest(BaseModel):
    """PUT /ttx/{ttx_id}/msel -- the whole MSEL in one save, like the needs
    form: a DRAFT may be incomplete (the validation report judges it), only
    what can never be stored is rejected (unknown references, limits), and
    collections are full-replace keyed by id. `revision` is the one the
    client edited (optimistic locking)."""

    revision: int = Field(ge=0)

    title: ShortText = ""
    summary: LongText = ""
    exercise_start: time | None = None
    incident_start: time | None = None
    incident_date: date | None = None
    duration_minutes: int | None = Field(default=None, ge=1, le=MAX_MINUTES)
    time_compression: int = Field(default=60, ge=1, le=MAX_MINUTES)

    threat_actors: list[ThreatActorInput] = Field(
        default_factory=list, max_length=MAX_THREAT_ACTORS
    )
    actors: list[ActorInput] = Field(default_factory=list, max_length=MAX_ACTORS)
    phases: list[PhaseInput] = Field(default_factory=list, max_length=MAX_PHASES)
    injects: list[InjectInput] = Field(default_factory=list, max_length=MAX_INJECTS)
    meters: list[MeterInput] = Field(default_factory=list, max_length=MAX_METERS)

    @model_validator(mode="after")
    def _references(self) -> "MselSaveRequest":
        actor_keys = [a.key for a in self.actors]
        phase_keys = [p.key for p in self.phases]
        threat_keys = {ref for t in self.threat_actors for ref in refs(t)}
        if len(actor_keys) != len(set(actor_keys)):
            raise ValueError("Each actor needs a unique key")
        if len(phase_keys) != len(set(phase_keys)):
            raise ValueError("Each phase needs a unique key")
        if len({t.key for t in self.threat_actors}) != len(self.threat_actors):
            raise ValueError("Each threat actor needs a unique key")
        meter_keys = {m.key for m in self.meters}
        if len(meter_keys) != len(self.meters):
            raise ValueError("Each meter needs a unique key")
        # Attribution, tolerantly (like branches): a threat actor that's no
        # longer in the scenario leaves its injects without one (the report
        # says so); techniques without an attribution aren't kept.
        for inject in self.injects:
            if inject.kind != InjectKind.CONTINGENT:
                inject.fires_at_minute = None
            if inject.format != InjectFormat.INJECT:
                inject.objective_ids = []
            if inject.format == InjectFormat.POLL:
                inject.expected_actions = []
                count = len(inject.poll_options)
                inject.poll_outcomes = (inject.poll_outcomes + [""] * count)[:count]
                # A meter that's gone takes its impacts with it.
                inject.poll_impacts = [
                    {key: level for key, level in row.items() if key in meter_keys and level}
                    for row in (inject.poll_impacts + [{}] * count)[:count]
                ]
            else:
                inject.poll_question = ""
                inject.poll_options = []
                inject.poll_outcomes = []
                inject.poll_impacts = []
            for action in inject.expected_actions:
                action.objective_ids = (
                    list(inject.objective_ids)
                    if action.objective_ids is None
                    else [o for o in action.objective_ids if o in inject.objective_ids]
                )
            if inject.attack_attribution is None:
                inject.attack_techniques = []
            if (
                inject.attack_attribution != AttackAttribution.THREAT_ACTOR
                or inject.threat_actor_key not in threat_keys
            ):
                inject.threat_actor_key = None
        injects_by_ref = {ref: inject for inject in self.injects for ref in refs(inject)}
        for index, inject in enumerate(self.injects, start=1):
            if inject.phase_key not in phase_keys:
                raise ValueError(f"Inject {index} refers to a phase that isn't in the MSEL")
            if inject.actor_key is not None and inject.actor_key not in actor_keys:
                raise ValueError(f"Inject {index} refers to an actor that isn't in the MSEL")
            # A branch end that no longer points inside this MSEL (its inject
            # was removed, or it's the inject itself) is dropped rather than
            # refused, so removing an inject never blocks the save; the
            # report then says the branch lost its anchor (M14/M16). Only
            # contingent injects branch.
            own = refs(inject)
            contingent = inject.kind == InjectKind.CONTINGENT

            def inside(ref: str | None, own: set[str] = own, contingent: bool = contingent):
                return ref if contingent and ref in injects_by_ref and ref not in own else None

            inject.branch_from_key = inside(inject.branch_from_key)
            inject.rejoin_key = inside(inject.rejoin_key)
            parent = injects_by_ref.get(inject.branch_from_key or "")
            actions = {r for a in (parent.expected_actions if parent else []) for r in refs(a)}
            if inject.branch_action_key not in actions:
                inject.branch_action_key = None
        return self


class MselTransitionRequest(BaseModel):
    to: MselStatus


class FrozenVersionRead(BaseModel):
    """A version of the MSEL frozen when it became READY, and the sessions
    played from it."""

    version: int
    ready_at: datetime
    ready_by: str
    sessions: int


class MselRenumberRequest(BaseModel):
    """Renumber one kind of row in order -- or, to undo, put back the
    `codes` (row id -> code) a previous renumbering returned."""

    kind: Literal["phases", "injects", "threat_actors"]
    codes: dict[uuid.UUID, str] | None = Field(default=None, max_length=1000)
    # Required when the MSEL has frozen versions (it was READY before):
    # they keep the old codes, which stop matching the draft's.
    confirm_frozen: bool = False


class ActorRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    type: ActorType
    # Defaults: snapshots frozen before these fields existed still load.
    description: str = ""
    channel: DeliveryMethod | None = None
    origin: ActorOrigin = ActorOrigin.EXERCISE
    origin_id: str | None = None
    origin_name: str | None = None
    played_by: str


class ThreatActorRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    mitre_group_id: str | None
    aliases: list[str]
    description: str
    techniques: list[ThreatActorTechniqueRead]
    origin: ActorOrigin
    origin_id: str | None
    origin_name: str | None
    # Defaulted: snapshots frozen before the field existed still load.
    modified_at: datetime | None = None


class PhaseRead(BaseModel):
    id: uuid.UUID
    code: str
    name: str
    # Defaulted: snapshots frozen before the field existed still load.
    headline: str = ""
    start_offset: int
    end_offset: int
    # Defaulted: snapshots frozen before phases had time jumps still load.
    incident_jump_minutes: int = 0
    situation_update: str
    key_questions: list[str]
    objective_ids: list[uuid.UUID]
    # Defaulted: snapshots frozen before phase deadlines existed still load.
    due_objective_ids: list[uuid.UUID] = []


class ExpectedActionRead(BaseModel):
    id: uuid.UUID
    code: str
    description: str
    responsible_role: str
    expected_within_minutes: int | None
    # None only in snapshots frozen before actions named their objectives:
    # read as all of the inject's (`action_objective_ids`).
    objective_ids: list[uuid.UUID] | None = None


def action_objective_ids(action: dict, inject: dict) -> list[str]:
    """The objectives a snapshot's expected action evidences, as strings:
    its own, kept only while still on the inject; all of the inject's when
    it was frozen before actions named them."""
    inject_ids = [str(o) for o in inject["objective_ids"]]
    own = action.get("objective_ids")
    if own is None:
        return inject_ids
    return [str(o) for o in own if str(o) in inject_ids]


class MselImageRead(BaseModel):
    """POST /ttx/{ttx_id}/msel/images: the stored image, to link from an
    inject (`InjectImageInput.image_id`)."""

    id: uuid.UUID
    width: int
    height: int


class InjectImageRead(BaseModel):
    id: uuid.UUID
    caption: str
    width: int
    height: int


class MselFilePreviewRead(BaseModel):
    """GET .../files/{file_id}/preview: the beginning of a text file as plain
    text (never rendered as markup). `truncated` when the file goes on past
    `limit_bytes`."""

    id: uuid.UUID
    name: str
    size_bytes: int
    text: str
    truncated: bool
    encoding: str
    limit_bytes: int


class MselFileRead(BaseModel):
    """POST /ttx/{ttx_id}/msel/files: the stored file, to link from an
    inject (`InjectFileInput.file_id`)."""

    id: uuid.UUID
    name: str
    size_bytes: int
    sha256: str


class InjectFileRead(MselFileRead):
    description: str


class InjectRead(BaseModel):
    @model_validator(mode="before")
    @classmethod
    def _frozen_scoring(cls, data: Any) -> Any:
        """A snapshot frozen before formats says `scored` instead."""
        if isinstance(data, dict) and "format" not in data and data.get("scored") is False:
            return {**data, "format": InjectFormat.DISCUSSION}
        return data

    id: uuid.UUID
    code: str
    phase_id: uuid.UUID | None
    kind: InjectKind
    title: str
    content: str
    offset_minutes: int | None
    trigger_condition: str
    contingent_purpose: str
    # Defaults: snapshots frozen before these fields existed still load.
    fires_at_minute: int | None = None
    format: InjectFormat = InjectFormat.INJECT
    poll_question: str = ""
    poll_options: list[str] = []
    poll_outcomes: list[str] = []
    poll_impacts: list[dict[str, int]] = []
    # The storyline map's branch. Defaults: snapshots frozen before these
    # fields existed still load.
    branch_from_id: uuid.UUID | None = None
    branch_action_id: uuid.UUID | None = None
    rejoin_inject_id: uuid.UUID | None = None
    simulated_actor_id: uuid.UUID | None
    # Defaults: snapshots frozen before attribution existed still load.
    attack_attribution: AttackAttribution | None = None
    threat_actor_id: uuid.UUID | None = None
    recipients: list[str]
    # Empty: every room. Default: snapshots frozen before rooms still load.
    room_ids: list[uuid.UUID] = []
    delivery_method: DeliveryMethod
    attachment_notes: list[str]
    attack_techniques: list[AttackRefRead]
    facilitator_notes: str
    # Default: snapshots frozen before artifacts existed still load.
    artifact: InjectArtifact | None = None
    review_status: InjectReviewStatus
    validated_by: str
    # Default: snapshots frozen before it existed still load.
    validated_by_id: uuid.UUID | None = None
    # What it was copied from (the inject library), if anything. Defaults:
    # snapshots frozen before these fields existed still load.
    origin: ActorOrigin | None = None
    origin_id: str | None = None
    origin_name: str | None = None
    objective_ids: list[uuid.UUID]
    expected_actions: list[ExpectedActionRead]
    # Default: snapshots frozen before inject images existed still load.
    images: list[InjectImageRead] = []
    # Default: snapshots frozen before inject files existed still load.
    files: list[InjectFileRead] = []


class MselRoomRead(BaseModel):
    """A room of the exercise, as the MSEL aims injects at it."""

    id: uuid.UUID
    code: str
    name: str


class NeedsObjectiveSummary(BaseModel):
    id: uuid.UUID
    code: str
    title: str = ""
    statement: str
    capability: Capability


class NeedsContext(BaseModel):
    """What the MSEL needs from the needs analysis to be edited: the
    objectives to link, the participants recipients must be (M09: the
    participating areas and, optional, the third parties), the duration
    limit and the TLP it inherits. Nothing else of the form."""

    status: NeedsFormStatus
    version: int
    tlp: Tlp
    participating_areas: list[str]
    # Default: snapshots frozen before third parties could receive injects.
    third_parties: list[str] = []
    max_duration_hours: int | None
    objectives: list[NeedsObjectiveSummary]


class MeterRead(BaseModel):
    key: str
    name: str


class MselRead(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    exercise_code: str
    status: MselStatus
    version: int
    revision: int
    needs_form_version: int
    # False while the needs analysis isn't APPROVED (someone is revising
    # it): the MSEL is then read-only.
    editable: bool
    needs: NeedsContext

    title: str
    summary: str
    attack_version: str
    # The scenario's threat actors (defaulted: older snapshots had none).
    threat_actors: list[ThreatActorRead] = Field(default_factory=list)
    # Every technique the injects use, derived (not chosen): what the
    # exercise exercises of ATT&CK.
    attack_techniques: list[AttackRefRead]
    exercise_start: time | None
    # Defaulted: snapshots frozen before the field existed still load.
    incident_start: time | None = None
    incident_date: date | None = None
    duration_minutes: int | None
    time_compression: int
    # Defaulted: snapshots frozen before the field existed still load.
    meters: list[MeterRead] = Field(default_factory=list)

    actors: list[ActorRead]
    phases: list[PhaseRead]
    injects: list[InjectRead]
    # The exercise is played in rooms: injects say which. Defaults:
    # snapshots frozen before rooms still load.
    uses_rooms: bool = False
    rooms: list[MselRoomRead] = Field(default_factory=list)

    updated_at: datetime
    # Who marked it READY and when (defaulted: older snapshots lack them).
    ready_by: str = ""
    ready_by_id: uuid.UUID | None = None
    ready_at: datetime | None = None
    # `ready` blocks DRAFT -> IN_REVIEW, `approved` additionally blocks
    # IN_REVIEW -> READY (M12, injects not validated); `warnings` never block.
    validation: ValidationReport
    # Kinds of row (phases, injects, threat_actors) whose codes don't follow
    # their order and can be renumbered (a draft).
    renumberable: list[str] = Field(default_factory=list)
    # A draft's versions frozen when it was READY before: renumbering asks
    # first, since they keep the old codes (empty when not a draft).
    frozen_versions: list["FrozenVersionRead"] = Field(default_factory=list)


class AttackTacticRead(BaseModel):
    id: str
    name: str


class AttackTechniqueRead(BaseModel):
    id: str
    name: str
    tactics: list[str]
    parent: str | None


class AttackDomainRead(BaseModel):
    domain: str
    name: str
    tactics: list[AttackTacticRead]  # matrix order
    techniques: list[AttackTechniqueRead]  # live ones only


class AttackReleaseRead(BaseModel):
    """GET /attack/{version}: one release, what the picker offers."""

    version: str
    released: str
    latest_version: str
    copyright: str
    domains: list[AttackDomainRead]


class AttackVersionsRead(BaseModel):
    versions: list[str]  # oldest first
    latest_version: str


class AttackReplacement(BaseModel):
    from_id: str
    to_id: str


class AttackConversionRead(BaseModel):
    """What moving references onto another ATT&CK release changed: MITRE's
    replacements applied (techniques and groups) and what that release
    doesn't have."""

    replaced: list[AttackReplacement] = Field(default_factory=list)
    removed: list[str] = Field(default_factory=list)


class LibraryAttackUpgradeRead(BaseModel):
    """POST /organizations/{id}/{threat-actors,injects}/attack-upgrade: how
    many of the organization's library items moved to `attack_version`,
    and what changed on the way."""

    attack_version: str
    upgraded: int
    conversion: AttackConversionRead


class ThreatActorProfileRead(BaseModel):
    """POST /attack/{version}/threat-actor: a threat actor's group and
    profile on that release, and what changed."""

    mitre_group_id: str | None
    techniques: list[ThreatActorTechniqueRead]
    conversion: AttackConversionRead


class ExerciseInjectAddedRead(BaseModel):
    """POST /ttx/{ttx_id}/msel/injects: the MSEL, and what moving the copy's
    techniques onto its ATT&CK release changed."""

    msel: "MselRead"
    conversion: AttackConversionRead


class ExerciseThreatActorAddedRead(BaseModel):
    """POST /ttx/{ttx_id}/msel/threat-actors: the scenario's new threat
    actor, and what moving it onto the MSEL's ATT&CK release changed (a
    group that release doesn't have is in `removed`: the actor stays, as an
    unknown actor)."""

    actor: ThreatActorRead
    conversion: AttackConversionRead


class AttackUpgradeRead(BaseModel):
    """POST /ttx/{ttx_id}/msel/attack-upgrade: the MSEL on the new release
    and what changed on the way."""

    msel: "MselRead"
    replaced: list[AttackReplacement]
    removed: list[str]


class MselRenumberRead(BaseModel):
    """POST /ttx/{ttx_id}/msel/renumber: the MSEL and the codes it had
    (row id -> code), which undo sends back."""

    msel: "MselRead"
    previous: dict[uuid.UUID, str]
