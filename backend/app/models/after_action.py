import uuid
from datetime import UTC, date, datetime
from enum import StrEnum

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel

from app.models.exercise_run import RatingLevel


class AarStatus(StrEnum):
    DRAFT = "draft"
    FINAL = "final"


class ImprovementStatus(StrEnum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    DONE = "done"
    CANCELLED = "cancelled"


class AfterActionReport(SQLModel, table=True):
    """The exercise's after-action report (AAR) and improvement plan, written
    by its Planners and Lead Evaluator from the session it ran -- one per
    exercise. Like the MSEL: `revision` bumps on every save (optimistic
    locking), `version` when a FINAL report is edited again."""

    __tablename__ = "after_action_report"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", unique=True, index=True)
    run_id: uuid.UUID = Field(foreign_key="exercise_run.id")
    status: AarStatus = Field(default=AarStatus.DRAFT)
    version: int = Field(default=1)
    revision: int = Field(default=0)
    executive_summary: str = Field(default="")
    scenario_summary: str = Field(default="")
    conclusions: str = Field(default="")
    # Improvement actions are IP-01, IP-02...: never reused.
    next_action_number: int = Field(default=1)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    # Who marked the current version FINAL (the name kept as it was then).
    finalized_by: str = Field(default="", max_length=255)
    finalized_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    finalized_at: datetime | None = Field(default=None)


class AfterActionObjective(SQLModel, table=True):
    """How one objective of the session plan's EEG was met: an overall
    level the authors settle on, and the strengths, areas for improvement
    and analysis behind it."""

    __tablename__ = "after_action_objective"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    report_id: uuid.UUID = Field(foreign_key="after_action_report.id", index=True)
    position: int = Field(default=0)
    objective_code: str = Field(max_length=24)
    title: str = Field(default="", max_length=500)
    overall: RatingLevel | None = Field(default=None)
    strengths: str = Field(default="")
    improvements: str = Field(default="")
    analysis: str = Field(default="")


class ImprovementAction(SQLModel, table=True):
    """An action of the improvement plan: what will be done about an area
    for improvement, by whom (free text: owners are often people without an
    account here), by when, and how it's going. Its follow-up (status, due
    date) never reopens a FINAL report."""

    __tablename__ = "improvement_action"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    report_id: uuid.UUID = Field(foreign_key="after_action_report.id", index=True)
    code: str = Field(max_length=16)
    position: int = Field(default=0)
    objective_code: str | None = Field(default=None, max_length=24)
    finding: str = Field(default="")
    action: str = Field(default="")
    owner: str = Field(default="", max_length=255)
    owner_area: str = Field(default="", max_length=255)
    due_date: date | None = Field(default=None)
    status: ImprovementStatus = Field(default=ImprovementStatus.OPEN)
    status_note: str = Field(default="", max_length=1000)
    # A later exercise of the organization that re-tests it, and optionally
    # which of its objectives -- follow-up like the status (never reopens a
    # FINAL report). Unlinked, not deleted, when that exercise or objective
    # goes (ttx_service.delete_exercises, ttx_needs_form_service).
    retest_ttx_id: uuid.UUID | None = Field(default=None, foreign_key="ttx.id", index=True)
    retest_objective_id: uuid.UUID | None = Field(default=None, foreign_key="ttx_objective.id")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AfterActionSnapshot(SQLModel, table=True):
    """The report as it was when it became FINAL -- immutable."""

    __tablename__ = "after_action_snapshot"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    report_id: uuid.UUID = Field(foreign_key="after_action_report.id", index=True)
    version: int
    payload: dict = Field(sa_column=Column(JSONB, nullable=False))
    created_by_id: uuid.UUID = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
