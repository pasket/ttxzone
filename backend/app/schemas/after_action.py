"""The editable after-action report (AAR) and its improvement plan."""

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field

from app.models import AarStatus, ImprovementStatus, RatingLevel

LongText = Annotated[str, Field(max_length=20000)]
ShortText = Annotated[str, Field(max_length=255)]


class SessionRatingRead(BaseModel):
    """A rating the session gave a point of the objective, for reference."""

    point: str
    level: RatingLevel
    rationale: str
    evaluator: str
    # In rooms: where it was rated ("main", a room's code); else "".
    room_code: str = ""


class AarObjectiveRead(BaseModel):
    id: uuid.UUID
    objective_code: str
    title: str
    overall: RatingLevel | None
    strengths: str
    improvements: str
    analysis: str
    session_ratings: list[SessionRatingRead]


class RetestRead(BaseModel):
    """The later exercise that re-tests an improvement action, and which of
    its objectives (none: the exercise as a whole)."""

    ttx_id: uuid.UUID
    ttx_code: str
    ttx_name: str
    objective_id: uuid.UUID | None = None
    objective_code: str | None = None
    objective_title: str | None = None


class ImprovementActionRead(BaseModel):
    id: uuid.UUID
    code: str
    objective_code: str | None
    finding: str
    action: str
    owner: str
    owner_area: str
    due_date: date | None
    status: ImprovementStatus
    status_note: str
    overdue: bool
    updated_at: datetime
    retest: RetestRead | None = None


class AarRead(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    status: AarStatus
    version: int
    revision: int
    executive_summary: str
    scenario_summary: str
    conclusions: str
    objectives: list[AarObjectiveRead]
    actions: list[ImprovementActionRead]
    finalized_by: str
    finalized_at: datetime | None
    updated_at: datetime
    # The caller writes it (a Planner or the Lead Evaluator), or only reads.
    # Never on an archived exercise, whose plan its authors still follow
    # up (`can_follow_up`: status, note, due date).
    can_edit: bool
    can_follow_up: bool = False
    # The run it was written from, and whether the caller may read that
    # run's team notes and feedback (its authors and Controllers; not a
    # Program Manager off the team). Defaults keep frozen snapshots valid.
    run_id: uuid.UUID | None = None
    # The sessions it can be written from, the default first.
    runs: list["AarRunOption"] = []
    can_see_session: bool = False


class AarPreviewObjective(BaseModel):
    code: str
    title: str


class AarRunOption(BaseModel):
    """A session the report can be written from: the current one or an
    archived one."""

    id: uuid.UUID
    number: int
    current: bool
    status: str
    started_at: datetime


class AarPreviewRead(BaseModel):
    """What the report will hold, before it exists: whether a session it
    can start from has been held, whether the caller may start it, and the
    objectives it will cover."""

    session_started: bool
    can_edit: bool
    objectives: list[AarPreviewObjective]
    # The sessions to choose from, the default first (the current one,
    # else the latest archived).
    runs: list[AarRunOption] = []


class AarCreateRequest(BaseModel):
    # None: the default session (the current one, else the latest).
    run_id: uuid.UUID | None = None


class AarRunChangeRequest(BaseModel):
    """Write the report from another session (`revision` as in a save)."""

    run_id: uuid.UUID
    revision: int


class AarObjectiveInput(BaseModel):
    id: uuid.UUID
    overall: RatingLevel | None = None
    strengths: LongText = ""
    improvements: LongText = ""
    analysis: LongText = ""


class ImprovementActionInput(BaseModel):
    # None: a new action (it gets the next IP- code).
    id: uuid.UUID | None = None
    objective_code: Annotated[str, Field(max_length=24)] | None = None
    finding: LongText = ""
    action: LongText = ""
    owner: ShortText = ""
    owner_area: ShortText = ""
    due_date: date | None = None
    status: ImprovementStatus = ImprovementStatus.OPEN
    status_note: Annotated[str, Field(max_length=1000)] = ""


class AarSaveRequest(BaseModel):
    """The whole report in one save (autosaved). Objectives are the plan's
    -- only their text and level change; actions are full-replace keyed by
    id. `revision` is the one the client edited."""

    revision: int = Field(ge=0)
    executive_summary: LongText = ""
    scenario_summary: LongText = ""
    conclusions: LongText = ""
    objectives: list[AarObjectiveInput] = Field(default_factory=list, max_length=100)
    actions: list[ImprovementActionInput] = Field(default_factory=list, max_length=300)


class AarTransitionRequest(BaseModel):
    to: Literal["final", "draft"]


class ImprovementFollowUpRequest(BaseModel):
    """How an action is going: never reopens a FINAL report. The re-test
    link changes only when `retest_ttx_id` is sent (null clears it)."""

    status: ImprovementStatus
    status_note: Annotated[str, Field(max_length=1000)] = ""
    due_date: date | None = None
    retest_ttx_id: uuid.UUID | None = None
    retest_objective_id: uuid.UUID | None = None


class RetestRequest(BaseModel):
    """A Program Manager links an action to the exercise that re-tests it
    (both null: unlinked)."""

    retest_ttx_id: uuid.UUID | None = None
    retest_objective_id: uuid.UUID | None = None


class RetestObjectiveOption(BaseModel):
    id: uuid.UUID
    code: str
    title: str


class RetestCandidate(BaseModel):
    """A later exercise of the organization that can re-test an action:
    its code, name and objectives -- nothing else of it."""

    ttx_id: uuid.UUID
    ttx_code: str
    ttx_name: str
    archived: bool
    objectives: list[RetestObjectiveOption]


class RetestedAction(BaseModel):
    """An improvement action of an earlier exercise that this one re-tests."""

    source_ttx_id: uuid.UUID
    source_ttx_code: str
    source_ttx_name: str
    code: str
    finding: str
    action: str
    status: ImprovementStatus
    objective_id: uuid.UUID | None
    objective_code: str | None
    objective_title: str | None


class ImprovementPlanRow(BaseModel):
    id: uuid.UUID
    ttx_id: uuid.UUID
    ttx_code: str
    ttx_name: str
    report_status: AarStatus
    code: str
    objective_code: str | None
    finding: str
    action: str
    owner: str
    owner_area: str
    due_date: date | None
    status: ImprovementStatus
    overdue: bool
    retest: RetestRead | None = None


class ImprovementPlanListResponse(BaseModel):
    items: list[ImprovementPlanRow]
    total: int
    open: int
    overdue: int


AarRead.model_rebuild()
