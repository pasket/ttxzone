import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import Column, Index, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Field, SQLModel


class RunStatus(StrEnum):
    """A live session's state. Not started is the absence of a run."""

    LIVE = "live"
    # Held by the Controller: no inject goes out, the session clock stops.
    PAUSED = "paused"
    ENDED = "ended"
    # Halted for a real-world incident (the stop keyword), not finished.
    STOPPED = "stopped"


class RunEventType(StrEnum):
    START = "start"
    INJECT_RELEASED = "inject_released"
    END = "end"
    STOP = "stop"
    PAUSE = "pause"
    RESUME = "resume"
    INJECT_SKIPPED = "inject_skipped"
    # Key questions of the phase put to the table on the inject in play.
    QUESTIONS_RELEASED = "questions_released"
    # An expected action seen (or not) at the table; the latest mark counts.
    ACTION_MARKED = "action_marked"
    # A key question put to the table marked as discussed (or no longer).
    QUESTION_COVERED = "question_covered"
    # Rooms: Players brought to the main room or sent back to theirs.
    PLAYERS_MOVED = "players_moved"
    # Rooms: the inject on the main room's screen (or none any more).
    MAIN_PROJECTED = "main_projected"
    # Rooms: Players seated in another room mid-session (they go to it).
    PLAYERS_SEATED = "players_seated"
    # The Controller restarted the time since the last inject (it restarts
    # on its own with each release).
    INJECT_TIMER_RESET = "inject_timer_reset"
    # A delivered inject delivered again: it's back in play.
    INJECT_RESENT = "inject_resent"
    # The Controller's closing message once every mandatory inject is out:
    # every phase is over (the session stays live for the hot wash).
    ENDEX = "endex"
    # The table's decision log: a Player, Facilitator or Controller records
    # what the table decided (on an inject, in a room); edited or deleted
    # by its author, a Facilitator or a Controller.
    DECISION_RECORDED = "decision_recorded"
    DECISION_EDITED = "decision_edited"
    DECISION_DELETED = "decision_deleted"
    # A question put to the Players' vote by a Facilitator or Controller;
    # each Player's latest vote counts until it closes.
    POLL_OPENED = "poll_opened"
    VOTE_CAST = "vote_cast"
    POLL_CLOSED = "poll_closed"
    # The Controller shows a planned poll's result to the Players, or hides it.
    POLL_RESULTS_SHOWN = "poll_results_shown"
    # The Controller shows the impact meters' summary to the Players, or hides it.
    METERS_SHOWN = "meters_shown"


class ActionMark(StrEnum):
    OBSERVED = "observed"
    PARTIAL = "partial"
    NOT_OBSERVED = "not_observed"


class ExerciseRun(SQLModel, table=True):
    """A live session of the exercise (the Playground). It plays the frozen
    READY MSEL and rates with the READY session plan, the snapshots it
    started from -- edits made since never reach it. An exercise has one
    current run (`archived_at` None); restarting it as a new run archives
    the current one, kept with its log, ratings, notes and feedback."""

    __tablename__ = "exercise_run"
    __table_args__ = (
        Index(
            "uq_exercise_run_current",
            "ttx_id",
            unique=True,
            postgresql_where=text("archived_at IS NULL"),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    # 1, 2... per exercise, in the order they started.
    number: int = Field(default=1, sa_column_kwargs={"server_default": "1"})
    # When it was set aside for a new run; None for the current one.
    archived_at: datetime | None = Field(default=None)
    status: RunStatus = Field(default=RunStatus.LIVE)
    msel_snapshot_id: uuid.UUID = Field(foreign_key="msel_snapshot.id")
    plan_snapshot_id: uuid.UUID = Field(foreign_key="conduct_prep_snapshot.id")
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_by_id: uuid.UUID = Field(foreign_key="user.id")
    ended_at: datetime | None = Field(default=None)
    stop_reason: str = Field(default="", max_length=500)
    # Since when it's paused (None while it runs), and the pauses before:
    # what the session clock (T+) leaves out.
    paused_at: datetime | None = Field(default=None)
    paused_seconds: int = Field(default=0, sa_column_kwargs={"server_default": "0"})
    # The current pause is for a real-world event: since when, and who
    # pressed REAL WORLD (any participant). Cleared on resume.
    real_world_at: datetime | None = Field(default=None)
    real_world_by_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    # The time since the last inject: when it started counting (the latest
    # release, or a Controller's reset) and the pause seconds already
    # counted then, so it leaves pauses out like T+. None before any inject.
    inject_timer_at: datetime | None = Field(default=None)
    inject_timer_paused_seconds: int = Field(default=0, sa_column_kwargs={"server_default": "0"})
    # The last event's `seq`: what a client already has (GET ...?since=).
    last_seq: int = Field(default=0)


class RunEvent(SQLModel, table=True):
    """The execution log: what happened in the session, append-only and in
    order. Payloads name rows of the MSEL snapshot by their stable codes."""

    __tablename__ = "run_event"
    __table_args__ = (UniqueConstraint("run_id", "seq"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    run_id: uuid.UUID = Field(foreign_key="exercise_run.id", index=True)
    seq: int
    type: RunEventType
    payload: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
    actor_id: uuid.UUID = Field(foreign_key="user.id")
    at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RunPresence(SQLModel, table=True):
    """Who is on the Playground, and as which role: refreshed by each poll,
    present while seen in the last few seconds. Kept per exercise, so the
    table shows before the session starts too."""

    __tablename__ = "run_presence"
    __table_args__ = (UniqueConstraint("ttx_id", "user_id", "role"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    role: str = Field(max_length=16)
    last_seen_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RunNote(SQLModel, table=True):
    """A participant's note during the session, as the role they act as:
    one per inject they write about, plus one general (`inject_code` "").
    In rooms a team member's note on an inject is per room (`room_code`, or
    "main"); the general one, and a Player's, have none. A Player's are
    theirs alone; the others' feed the hot wash and the
    report (the Controllers, Planners and Lead Evaluator read them)."""

    __tablename__ = "run_note"
    __table_args__ = (
        UniqueConstraint(
            "ttx_id",
            "run_id",
            "author_id",
            "role",
            "inject_code",
            "room_code",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    ttx_id: uuid.UUID = Field(foreign_key="ttx.id", index=True)
    # The run it was written in, so a new run starts with no notes. None
    # before the session starts (a general note): the run adopts it.
    run_id: uuid.UUID | None = Field(default=None, foreign_key="exercise_run.id", index=True)
    author_id: uuid.UUID = Field(foreign_key="user.id")
    role: str = Field(max_length=16)
    inject_code: str = Field(default="", max_length=16)
    room_code: str = Field(default="", max_length=16, sa_column_kwargs={"server_default": ""})
    text: str = Field(default="")
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RatingLevel(StrEnum):
    """The common rating scale: performed without challenges (P), with
    some (S), with major ones (M), or unable to be performed (U)."""

    P = "P"
    S = "S"
    M = "M"
    U = "U"


class RunRating(SQLModel, table=True):
    """An Evaluator's rating of an observation point of the session's EEG
    (the READY plan it plays), with why -- the latest counts. Points are
    named by their id in the plan snapshot. In rooms each place is rated
    on its own (`room_code`, or "main"); "" without rooms."""

    __tablename__ = "run_rating"
    __table_args__ = (UniqueConstraint("run_id", "evaluator_id", "point_id", "room_code"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    run_id: uuid.UUID = Field(foreign_key="exercise_run.id", index=True)
    evaluator_id: uuid.UUID = Field(foreign_key="user.id")
    point_id: uuid.UUID
    level: RatingLevel
    rationale: str = Field(default="")
    # The inject in play when it was rated.
    inject_code: str = Field(default="", max_length=16)
    room_code: str = Field(default="", max_length=16, sa_column_kwargs={"server_default": ""})
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RunFeedbackSubmission(SQLModel, table=True):
    """Who has answered the participant feedback form -- so nobody answers
    twice. Never linked to what they answered (RunFeedbackResponse)."""

    __tablename__ = "run_feedback_submission"
    __table_args__ = (UniqueConstraint("run_id", "user_id"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    run_id: uuid.UUID = Field(foreign_key="exercise_run.id", index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    submitted_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class RunFeedbackResponse(SQLModel, table=True):
    """An anonymous answer to the participant feedback form: no author and
    no time, so it can't be tied back to a submission. `group` keeps only
    whether it came from a Player or from the team."""

    __tablename__ = "run_feedback_response"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    run_id: uuid.UUID = Field(foreign_key="exercise_run.id", index=True)
    group: str = Field(max_length=8)
    # Statement key -> 1..5.
    scores: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
    # Open question key -> text.
    answers: dict = Field(default_factory=dict, sa_column=Column(JSONB, nullable=False))
