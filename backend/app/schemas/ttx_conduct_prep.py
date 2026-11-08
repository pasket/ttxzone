import uuid
from datetime import date, datetime, time
from typing import Annotated, Literal
from zoneinfo import available_timezones

from pydantic import BaseModel, Field, field_validator

from app.models import (
    CALENDAR_DEFAULTS,
    AbsenceFallback,
    ConductPrepStatus,
    EegPointKind,
    FindingKind,
    FindingSource,
    MselStatus,
    NeedsFormStatus,
    SessionModality,
    Tlp,
)
from app.schemas.ttx_needs_form import ValidationReport

ShortText = Annotated[str, Field(max_length=255)]
LongText = Annotated[str, Field(max_length=5000)]
# An evaluation-calendar deadline: days after the session, up to a year.
CalendarDays = Annotated[int, Field(ge=0, le=365)]
Key = Annotated[str, Field(min_length=1, max_length=64)]

# Fixed vocabularies of the plan's checklists (the client labels them).
DATA_COLLECTION_METHODS = (
    "direct_observation",
    "decision_timeline",
    "communications_log",
    "observation_notes",
    "document_review",
    "feedback_forms",
    "interviews",
    "hot_wash",
    "other",
)
BRIEFING_ITEMS = ("objectives", "eeg", "msel", "non_intervention", "data_collection", "logistics")
LOGISTICS_ITEMS = (
    "room_booked",
    "av_equipment",
    "connectivity_tested",
    "materials_printed",
    "real_vs_simulated",
    "attendance_list",
)
# The session documents (Creator -> Session plan -> Session documents);
# also the export kinds, spelled with dashes there.
DOCUMENT_KINDS = (
    "sitman",
    "facilitator_guide",
    "inject_cards",
    "eeg",
    "evaluation_plan",
    "feedback_form",
)

MAX_POINTS = 20
MAX_EVALUATORS = 20
MAX_FINDINGS = 40
MAX_ATTENDEES = 30

RatingLevel = Literal["P", "S", "M", "U"]


def _vocabulary(values: list[str], allowed: tuple[str, ...], name: str) -> list[str]:
    unknown = set(values) - set(allowed)
    if unknown:
        raise ValueError(f"Unknown {name}: {', '.join(sorted(unknown))}")
    return list(dict.fromkeys(values))


class EegPointInput(BaseModel):
    id: uuid.UUID | None = None
    # Seeded points keep their kind and source; a new point is custom.
    text: LongText = ""
    criteria_p: LongText = ""
    criteria_s: LongText = ""
    criteria_m: LongText = ""
    criteria_u: LongText = ""


class EegObjectiveInput(BaseModel):
    """The points of one definitive EEG. EEGs themselves aren't created or
    removed by a save -- they follow the needs analysis' objectives (the
    re-seed adds and drops them)."""

    id: uuid.UUID
    points: list[EegPointInput] = Field(default_factory=list, max_length=MAX_POINTS)


class EvaluatorInput(BaseModel):
    id: uuid.UUID | None = None
    user_id: uuid.UUID
    areas: list[ShortText] = Field(default_factory=list, max_length=20)
    briefed: bool = False
    # The definitive EEGs (their ids) this evaluator covers.
    objective_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


class FindingInput(BaseModel):
    id: uuid.UUID | None = None
    kind: FindingKind = FindingKind.OTHER
    found_in: FindingSource = FindingSource.DRY_RUN
    description: LongText = ""
    inject_id: uuid.UUID | None = None
    phase_id: uuid.UUID | None = None
    resolved: bool = False


class AttendeeInput(BaseModel):
    id: uuid.UUID | None = None
    # A Player of the exercise (their name comes from the account), or None.
    user_id: uuid.UUID | None = None
    name: ShortText = ""
    role: ShortText = ""
    confirmed: bool = False
    fallback: AbsenceFallback | None = None
    substitute: ShortText = ""


class ConductPrepSaveRequest(BaseModel):
    """PUT /ttx/{ttx_id}/conduct-prep -- the whole plan in one save, like
    the MSEL: a DRAFT may be incomplete (the validation report judges it),
    collections are full-replace keyed by id, `revision` is the one the
    client edited."""

    revision: int = Field(ge=0)

    eeg: list[EegObjectiveInput] = Field(default_factory=list, max_length=40)
    evaluators: list[EvaluatorInput] = Field(default_factory=list, max_length=MAX_EVALUATORS)
    data_collection_methods: list[str] = Field(default_factory=list, max_length=20)
    data_collection_other: ShortText = ""
    log_keeper_id: uuid.UUID | None = None
    briefing_date: date | None = None
    briefing_checklist: list[str] = Field(default_factory=list, max_length=20)
    briefing_notes: LongText = ""
    briefed_controller_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    hot_wash_days: CalendarDays = CALENDAR_DEFAULTS["hot_wash_days"]
    debrief_days: CalendarDays = CALENDAR_DEFAULTS["debrief_days"]
    ratings_due_days: CalendarDays = CALENDAR_DEFAULTS["ratings_due_days"]
    draft_aar_days: CalendarDays = CALENDAR_DEFAULTS["draft_aar_days"]
    after_action_meeting_days: CalendarDays = CALENDAR_DEFAULTS["after_action_meeting_days"]

    fpm_date: date | None = None
    fpm_done: bool = False
    fpm_attendees: LongText = ""
    fpm_notes: LongText = ""
    dry_run_date: date | None = None
    dry_run_done: bool = False
    findings: list[FindingInput] = Field(default_factory=list, max_length=MAX_FINDINGS)

    session_date: date | None = None
    session_time: time | None = None
    timezone: Annotated[str, Field(max_length=64)] = ""
    modality: SessionModality | None = None
    venue: ShortText = ""
    room: ShortText = ""
    meeting_link: Annotated[str, Field(max_length=2048)] = ""
    session_notes: LongText = ""
    invitation_sent_on: date | None = None
    invitation_text: Annotated[str, Field(max_length=20000)] = ""
    logistics_checklist: list[str] = Field(default_factory=list, max_length=20)
    attendees: list[AttendeeInput] = Field(default_factory=list, max_length=MAX_ATTENDEES)

    documents_reviewed: list[str] = Field(default_factory=list, max_length=20)
    stop_procedure: LongText = ""

    @field_validator("data_collection_methods")
    @classmethod
    def _methods(cls, value: list[str]) -> list[str]:
        return _vocabulary(value, DATA_COLLECTION_METHODS, "data collection method")

    @field_validator("briefing_checklist")
    @classmethod
    def _briefing(cls, value: list[str]) -> list[str]:
        return _vocabulary(value, BRIEFING_ITEMS, "briefing item")

    @field_validator("logistics_checklist")
    @classmethod
    def _logistics(cls, value: list[str]) -> list[str]:
        return _vocabulary(value, LOGISTICS_ITEMS, "logistics item")

    @field_validator("documents_reviewed")
    @classmethod
    def _documents(cls, value: list[str]) -> list[str]:
        return _vocabulary(value, DOCUMENT_KINDS, "document")

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value: str) -> str:
        if value and value not in available_timezones():
            raise ValueError("Unknown time zone")
        return value

    @field_validator("meeting_link")
    @classmethod
    def _link(cls, value: str) -> str:
        value = value.strip()
        if value and not value.lower().startswith("https://"):
            raise ValueError("The meeting link must start with https://")
        return value


class ConductPrepTransitionRequest(BaseModel):
    to: ConductPrepStatus


# -- reads ----------------------------------------------------------------

# How an observation point stands against what it was seeded from:
# custom (written here), current (as seeded), changed (its expected action
# changed in the MSEL since), orphaned (its clause or expected action is
# gone). A seeded point's text is never rewritten here.
SourceStatus = Literal["custom", "current", "changed", "orphaned"]


class EegPointRead(BaseModel):
    id: uuid.UUID
    kind: EegPointKind
    text: str
    criteria_p: str
    criteria_s: str
    criteria_m: str
    criteria_u: str
    source_text: str
    source_action_id: uuid.UUID | None
    source_action_code: str
    source_inject_code: str
    source_inject_title: str
    responsible_role: str
    expected_within_minutes: int | None
    source_requirement_id: str = ""
    source_status: SourceStatus = "custom"


class EegObjectiveRead(BaseModel):
    id: uuid.UUID
    objective_id: uuid.UUID
    code: str
    title: str = ""
    statement: str
    capability: str
    # The objective is no longer in the needs analysis.
    orphaned: bool = False
    points: list[EegPointRead]


class EvaluatorRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    full_name: str
    areas: list[str]
    briefed: bool
    objective_ids: list[uuid.UUID]


class FindingRead(BaseModel):
    id: uuid.UUID
    kind: FindingKind
    # Defaulted: snapshots frozen before findings named their review still load.
    found_in: FindingSource = FindingSource.DRY_RUN
    description: str
    inject_id: uuid.UUID | None
    phase_id: uuid.UUID | None
    resolved: bool


class AttendeeRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID | None = None
    name: str
    role: str
    confirmed: bool
    fallback: AbsenceFallback | None
    substitute: str


class PersonOption(BaseModel):
    user_id: uuid.UUID
    full_name: str


class CodedOption(BaseModel):
    id: uuid.UUID
    code: str
    title: str


class PlayerOption(BaseModel):
    """A Player with access to the exercise: when they used the invitation
    (`invited_at`, None if they were added another way) and when access
    was granted (`joined_at`)."""

    user_id: uuid.UUID
    full_name: str
    # Output: read back as stored (a deleted account's placeholder too).
    email: str
    invited_at: datetime | None
    joined_at: datetime


class ConductPrepDrift(BaseModel):
    # The needs analysis was approved again with another version since the
    # EEG was built from it.
    needs_changed: bool = False
    # A newer READY MSEL exists than the one its expected actions came from.
    msel_changed: bool = False


class ConductPrepContext(BaseModel):
    """What the plan is checked against, read-only here."""

    tlp: Tlp
    needs_form_status: NeedsFormStatus
    needs_form_version: int
    date_window_start: date | None
    date_window_end: date | None
    max_duration_hours: int | None
    stop_exercise_keyword: str
    participating_areas: list[str]
    msel_status: MselStatus | None
    # The latest READY MSEL version (None: never READY).
    msel_ready_version: int | None
    msel_exercise_start: time | None
    msel_duration_minutes: int | None
    mandatory_injects: int
    mandatory_injects_validated: int
    lead_evaluator: PersonOption | None
    # The exercise's Evaluators (who can be assigned) and its planning and
    # control team (who can keep the execution log).
    exercise_evaluators: list[PersonOption]
    team_members: list[PersonOption]
    # The team members who control it (briefed with the Evaluators).
    exercise_controllers: list[PersonOption]
    phases: list[CodedOption]
    injects: list[CodedOption]
    # Who has access as a Player, and how many invitations wait for approval.
    exercise_players: list[PlayerOption]
    pending_access_requests: int


class ConductPrepRead(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    exercise_code: str
    status: ConductPrepStatus
    version: int
    revision: int
    # False while the needs analysis isn't APPROVED: read-only then.
    editable: bool
    seeded_needs_form_version: int
    seeded_msel_version: int | None
    drift: ConductPrepDrift
    context: ConductPrepContext

    eeg: list[EegObjectiveRead]
    evaluators: list[EvaluatorRead]
    data_collection_methods: list[str]
    data_collection_other: str
    log_keeper_id: uuid.UUID | None
    briefing_date: date | None
    briefing_checklist: list[str]
    briefing_notes: str
    briefed_controller_ids: list[uuid.UUID]
    hot_wash_days: int
    debrief_days: int
    ratings_due_days: int
    draft_aar_days: int
    after_action_meeting_days: int

    fpm_date: date | None
    fpm_done: bool
    fpm_attendees: str
    fpm_notes: str
    fpm_msel_version: int | None
    dry_run_date: date | None
    dry_run_done: bool
    findings: list[FindingRead]

    session_date: date | None
    session_time: time | None
    timezone: str
    # The session's start as a UTC instant, when date, time and zone are set.
    session_starts_at: datetime | None
    modality: SessionModality | None
    venue: str
    room: str
    meeting_link: str
    session_notes: str
    invitation_sent_on: date | None
    invitation_text: str
    logistics_checklist: list[str]
    attendees: list[AttendeeRead]

    documents_reviewed: list[str]
    stop_procedure: str

    updated_at: datetime
    ready_by: str
    ready_by_id: uuid.UUID | None
    ready_at: datetime | None
    validation: ValidationReport
