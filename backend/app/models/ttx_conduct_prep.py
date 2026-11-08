import uuid
from datetime import UTC, date, datetime, time
from enum import StrEnum

from sqlalchemy import Column, String, Uuid
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlmodel import Field, SQLModel


class ConductPrepStatus(StrEnum):
    DRAFT = "draft"
    READY = "ready"


class SessionModality(StrEnum):
    IN_PERSON = "in_person"
    REMOTE = "remote"
    HYBRID = "hybrid"


# The evaluation calendar's milestones, in order, as days after the session
# and their usual deadlines: hot wash and debrief the same day, rated EEGs
# three days later, the draft after-action report and improvement plan in
# two weeks, the After Action Meeting a week after that.
CALENDAR_DEFAULTS: dict[str, int] = {
    "hot_wash_days": 0,
    "debrief_days": 0,
    "ratings_due_days": 3,
    "draft_aar_days": 14,
    "after_action_meeting_days": 21,
}


class EegPointKind(StrEnum):
    """Where an observation point came from: a clause of the objective's
    success criterion, an expected action of the READY MSEL, a notification
    requirement the objective cites, or written here."""

    CRITERION = "criterion"
    EXPECTED_ACTION = "expected_action"
    NOTIFICATION = "notification"
    CUSTOM = "custom"


class FindingKind(StrEnum):
    """What a review found wrong with the design."""

    AMBIGUOUS_INJECT = "ambiguous_inject"
    OVERLOADED_PHASE = "overloaded_phase"
    UNREALISTIC_TIMING = "unrealistic_timing"
    OTHER = "other"


class FindingSource(StrEnum):
    """Which review of the design found it: the sponsor's or another
    stakeholder's review of the drafts, the Final Planning Meeting or the
    dry run."""

    DESIGN_REVIEW = "design_review"
    PLANNING_MEETING = "planning_meeting"
    DRY_RUN = "dry_run"


class AbsenceFallback(StrEnum):
    """What happens if a key decision maker can't attend."""

    SUBSTITUTE = "substitute"
    POSTPONE = "postpone"
    PROCEED = "proceed"


def _string_array(length: int = 64) -> Column:
    # A fresh Column per field: SQLAlchemy binds a Column to one table
    # attribute, so the definition can't be shared.
    return Column(ARRAY(String(length)), nullable=False, server_default="{}")


class TTXConductPrep(SQLModel, table=True):
    """Creator -> Session plan: how the exercise is measured (evaluation
    plan) and how its session is secured (documents, design validation,
    logistics) -- one per TTX, created the first time it's opened with an
    approved needs form.

    Same conventions as the MSEL: text defaults to "" (a DRAFT is saved
    incomplete; the validation report judges it), `revision` bumps on every
    save, `version` when a READY plan is edited. `seeded_*` are the needs
    form and READY MSEL versions its EEG was last built from (drift)."""

    __tablename__ = "ttx_conduct_prep"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", unique=True, index=True)
    status: ConductPrepStatus = Field(default=ConductPrepStatus.DRAFT)
    version: int = Field(default=1)
    revision: int = Field(default=0)
    seeded_needs_form_version: int = Field(default=1)
    # None: there was no READY MSEL to take expected actions from.
    seeded_msel_version: int | None = Field(default=None)

    # 1. Evaluation plan
    data_collection_methods: list[str] = Field(default_factory=list, sa_column=_string_array())
    data_collection_other: str = Field(default="", max_length=255)
    # Who keeps the execution log during the session (a team member).
    log_keeper_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    briefing_date: date | None = Field(default=None)
    briefing_checklist: list[str] = Field(default_factory=list, sa_column=_string_array())
    briefing_notes: str = Field(default="")
    # The Controllers (planning and control team members who control) who
    # attended the controller and evaluator briefing; Evaluators carry
    # their own `briefed`.
    briefed_controller_ids: list[uuid.UUID] = Field(
        default_factory=list,
        sa_column=Column(ARRAY(Uuid), nullable=False, server_default="{}"),
    )
    # The evaluation calendar: days after the session, with the usual
    # deadlines by default (a date can rarely be fixed this early).
    hot_wash_days: int = Field(default=CALENDAR_DEFAULTS["hot_wash_days"])
    debrief_days: int = Field(default=CALENDAR_DEFAULTS["debrief_days"])
    ratings_due_days: int = Field(default=CALENDAR_DEFAULTS["ratings_due_days"])
    draft_aar_days: int = Field(default=CALENDAR_DEFAULTS["draft_aar_days"])
    after_action_meeting_days: int = Field(default=CALENDAR_DEFAULTS["after_action_meeting_days"])

    # 2. Design validation
    fpm_date: date | None = Field(default=None)
    fpm_done: bool = Field(default=False)
    fpm_attendees: str = Field(default="")
    fpm_notes: str = Field(default="")
    # The READY MSEL version reviewed at the Final Planning Meeting, stamped
    # by the server when it's marked done (design changes after it warn).
    fpm_msel_version: int | None = Field(default=None)
    dry_run_date: date | None = Field(default=None)
    dry_run_done: bool = Field(default=False)

    # 3. Logistics. The session is a wall-clock date and time in an IANA
    # zone -- the meeting's real identity, right across DST changes; reads
    # derive the UTC instant.
    session_date: date | None = Field(default=None)
    session_time: time | None = Field(default=None)
    timezone: str = Field(default="", max_length=64)
    modality: SessionModality | None = Field(default=None)
    venue: str = Field(default="", max_length=255)
    room: str = Field(default="", max_length=255)
    meeting_link: str = Field(default="", max_length=2048)
    # Anything else about the session, whatever the modality (parking,
    # access badges, a dial-in fallback...).
    session_notes: str = Field(default="")
    logistics_checklist: list[str] = Field(default_factory=list, sa_column=_string_array())

    # 4. Convocation: when the formal invitation went out and its text (to
    # keep what was sent); the key decision makers are its rows.
    invitation_sent_on: date | None = Field(default=None)
    invitation_text: str = Field(default="")

    # 5. Session documents
    documents_reviewed: list[str] = Field(default_factory=list, sa_column=_string_array())
    stop_procedure: str = Field(default="")

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    ready_by: str = Field(default="", max_length=255)
    ready_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    ready_at: datetime | None = Field(default=None)


class ConductPrepEegObjective(SQLModel, table=True):
    """The definitive EEG of one objective of the needs analysis. The
    objective's code, statement and capability are copied (what was
    evaluated stays readable); `objective_id` has no FK, since a needs-form
    save deletes objectives -- a missing one is reported, not cascaded."""

    __tablename__ = "conduct_prep_eeg_objective"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    prep_id: uuid.UUID = Field(foreign_key="ttx_conduct_prep.id", index=True)
    objective_id: uuid.UUID
    position: int = Field(default=0)
    code: str = Field(default="", max_length=16)
    title: str = Field(default="", max_length=255)
    statement: str = Field(default="")
    capability: str = Field(default="", max_length=64)


class ConductPrepEegPoint(SQLModel, table=True):
    """One observation point of a definitive EEG, with what each level of
    the rating scale means for it (so two evaluators rate alike).
    `source_*` keep what it was seeded from: the clause or the expected
    action (by id, no FK: an MSEL save deletes actions) -- how drift and
    edits are told apart."""

    __tablename__ = "conduct_prep_eeg_point"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    eeg_objective_id: uuid.UUID = Field(foreign_key="conduct_prep_eeg_objective.id", index=True)
    position: int = Field(default=0)
    kind: EegPointKind = Field(default=EegPointKind.CUSTOM)
    text: str = Field(default="")
    criteria_p: str = Field(default="")
    criteria_s: str = Field(default="")
    criteria_m: str = Field(default="")
    criteria_u: str = Field(default="")
    source_text: str = Field(default="")
    source_action_id: uuid.UUID | None = Field(default=None)
    source_action_code: str = Field(default="", max_length=32)
    source_inject_code: str = Field(default="", max_length=16)
    source_inject_title: str = Field(default="", max_length=255)
    responsible_role: str = Field(default="", max_length=255)
    expected_within_minutes: int | None = Field(default=None)
    # A notification point's regulatory requirement (the catalog's id).
    source_requirement_id: str = Field(default="", max_length=32)


class ConductPrepEvaluator(SQLModel, table=True):
    """An Evaluator of the exercise (TTXAccess EVALUATOR) as the plan
    assigns them: what they know and what they cover."""

    __tablename__ = "conduct_prep_evaluator"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    prep_id: uuid.UUID = Field(foreign_key="ttx_conduct_prep.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    position: int = Field(default=0)
    # Participating areas (needs form) whose players they watch.
    areas: list[str] = Field(default_factory=list, sa_column=_string_array(255))
    briefed: bool = Field(default=False)


class ConductPrepEvaluatorObjective(SQLModel, table=True):
    __tablename__ = "conduct_prep_evaluator_objective"

    evaluator_id: uuid.UUID = Field(foreign_key="conduct_prep_evaluator.id", primary_key=True)
    eeg_objective_id: uuid.UUID = Field(
        foreign_key="conduct_prep_eeg_objective.id", primary_key=True
    )


class ConductPrepFinding(SQLModel, table=True):
    """Something a review of the design found to fix before the session
    (`found_in`). The inject or phase it's about is named by id with no FK
    (an MSEL save deletes rows)."""

    __tablename__ = "conduct_prep_finding"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    prep_id: uuid.UUID = Field(foreign_key="ttx_conduct_prep.id", index=True)
    position: int = Field(default=0)
    kind: FindingKind = Field(default=FindingKind.OTHER)
    found_in: FindingSource = Field(
        default=FindingSource.DRY_RUN, sa_column_kwargs={"server_default": "DRY_RUN"}
    )
    description: str = Field(default="")
    inject_id: uuid.UUID | None = Field(default=None)
    phase_id: uuid.UUID | None = Field(default=None)
    resolved: bool = Field(default=False)


class ConductPrepAttendee(SQLModel, table=True):
    """A key decision maker whose attendance is confirmed before the
    session, and what happens if they can't come."""

    __tablename__ = "conduct_prep_attendee"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    prep_id: uuid.UUID = Field(foreign_key="ttx_conduct_prep.id", index=True)
    position: int = Field(default=0)
    # A Player of the exercise (who joined through an invitation), or None
    # for someone added by hand -- no FK, an account can go; `name` keeps
    # their name then.
    user_id: uuid.UUID | None = Field(default=None)
    name: str = Field(default="", max_length=255)
    role: str = Field(default="", max_length=255)
    confirmed: bool = Field(default=False)
    fallback: AbsenceFallback | None = Field(default=None)
    substitute: str = Field(default="", max_length=255)


class ConductPrepSnapshot(SQLModel, table=True):
    """The plan as it was when it became READY -- immutable. Control and
    Execution rate with this version's EEG."""

    __tablename__ = "conduct_prep_snapshot"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    prep_id: uuid.UUID = Field(foreign_key="ttx_conduct_prep.id", index=True)
    version: int
    payload: dict = Field(sa_column=Column(JSONB, nullable=False))
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
