"""The Playground's live session. `RunRead` is the one view every role
polls; what it carries is projected per role: Players and the rest of the
table get delivered injects only (`RunInjectRead` -- no expected actions,
facilitator notes, triggers or attribution, like the inject cards), and
only a Controller gets `control`, the MSEL to run it from and how it's
going."""

import uuid
from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models import ActionMark, ActorType, DeliveryMethod, InjectFormat, InjectKind, RatingLevel
from app.schemas.ttx_msel import InjectArtifact, InjectFileRead, InjectImageRead

RunState = Literal["not_started", "live", "paused", "ended", "stopped"]
PhaseState = Literal["done", "current", "upcoming"]
InjectRunState = Literal["pending", "released", "skipped"]
# Where a Player is in an exercise played in rooms: their own room, or the
# main room (where everyone without a room always is).
RoomLocation = Literal["main", "room"]


class RunPhaseRead(BaseModel):
    """A phase as the table sees it: its name only once it has begun."""

    code: str
    number: int
    state: PhaseState
    name: str | None
    # One line on it: its own headline, if it has one.
    headline: str | None


class RunSenderRead(BaseModel):
    name: str
    type: ActorType
    channel: DeliveryMethod | None


class RunQuestionRead(BaseModel):
    text: str
    # Marked as discussed by the Controller or a Facilitator.
    covered: bool
    # In rooms: where it was put ("main", a room's code).
    room_code: str | None = None


class RunInjectRead(BaseModel):
    """A delivered inject, safe for the Players."""

    code: str
    title: str
    content: str
    # A poll comes from no one: the stage draws no delivery details.
    format: InjectFormat = InjectFormat.INJECT
    phase_code: str | None
    delivery_method: DeliveryMethod
    sender: RunSenderRead | None
    recipients: list[str]
    attachment_notes: list[str]
    # The content drawn as a simulated email, press release... (None: text).
    artifact: InjectArtifact | None = None
    images: list[InjectImageRead]
    # Files the table downloads with it (logs, captures, dumps...).
    files: list[InjectFileRead] = []
    # Minutes into the fiction (from the incident start) it is set at.
    scenario_minute: int | None
    released_at: datetime
    # The phase's key questions the Controller put to the table on it.
    questions: list[RunQuestionRead]
    # Rooms: the rooms it's played in (empty: all of them).
    room_codes: list[str] = []


class RunActionRead(BaseModel):
    """An expected action of an inject and what the Controller saw of it."""

    code: str
    description: str
    responsible_role: str
    expected_within_minutes: int | None
    mark: ActionMark | None
    note: str
    marked_at: datetime | None


class RunControlInjectRead(BaseModel):
    code: str
    title: str
    kind: InjectKind
    format: InjectFormat = InjectFormat.INJECT
    phase_code: str | None
    offset_minutes: int | None
    # The session minute it's due (a contingent's check minute).
    due_minute: int | None
    state: InjectRunState
    # Why it was released (a contingent) or skipped.
    reason: str
    trigger_condition: str
    contingent_purpose: str
    # The expected action whose absence fires it (a contingent).
    branch_action_code: str | None
    # Its expected action was marked not observed: time to fire it.
    suggested: bool
    expected_actions: list[RunActionRead]
    # Rooms: the rooms it's played in (empty: all of them).
    room_codes: list[str] = []


class RunQuestionPlaceRead(BaseModel):
    """In rooms, each place asks and covers a phase's key questions on its
    own: the positions, like `released_questions` and `covered_questions`."""

    room_code: str
    released_questions: list[int]
    covered_questions: list[int]


class RunControlPhaseRead(BaseModel):
    code: str
    name: str
    start_offset: int
    end_offset: int
    key_questions: list[str]
    # Positions of the key questions already put to the table, and of
    # those marked as discussed.
    released_questions: list[int]
    covered_questions: list[int]
    question_places: list[RunQuestionPlaceRead] = []


class RunControlRead(BaseModel):
    phases: list[RunControlPhaseRead]
    injects: list[RunControlInjectRead]
    # The MSEL being played, as frozen (for the storyline map).
    msel: dict


class RunPresenceRead(BaseModel):
    """Someone on the Playground right now. A Player sees the other
    Players by name, and only how many of each role the team is."""

    role: str
    name: str | None


class RunFacilitationRead(BaseModel):
    """The Facilitator's script for the phase in play: its key questions
    (and which were put to the table) and the inject's facilitator notes."""

    phase_code: str
    phase_name: str
    key_questions: list[str]
    released_questions: list[int]
    covered_questions: list[int]
    question_places: list[RunQuestionPlaceRead] = []
    inject_code: str | None
    facilitator_notes: str


class RunRoomRead(BaseModel):
    code: str
    name: str
    # Players seated in it, and how many of them are in the main room now.
    players: int
    in_main: int


class RunRoomPlayerRead(BaseModel):
    """A Player and where they are (the Controller's view, to move them)."""

    user_id: uuid.UUID
    name: str
    room_code: str | None
    location: RoomLocation


class RunMeRead(BaseModel):
    """A Player's own seat and where the Controller has them now."""

    room_code: str | None
    room_name: str | None
    location: RoomLocation


class RunRoomsRead(BaseModel):
    """An exercise played in rooms. A Player gets only their own room (and
    the injects of it and of the main room); the team gets every room and
    every delivered inject; the Controller also each Player, to move them."""

    rooms: list[RunRoomRead]
    # The inject on the main room's screen, if any.
    main_projected: str | None
    # Every inject projected in the main room so far, in order.
    main_history: list[str]
    # Players in the main room now: brought there, or without a room.
    in_main: int
    me: RunMeRead | None = None
    players: list[RunRoomPlayerRead] | None = None
    # A team member's default room (Creator -> Exercise -> Rooms): where
    # their view opens until they pick another. None: the main room.
    default_room_code: str | None = None


class RunDecisionRead(BaseModel):
    """A decision of the table's log, as recorded (and maybe edited)."""

    id: str
    text: str
    # The inject it was taken on (ENDEX included), and the room it was
    # taken in ("main", a room's code; null without rooms).
    inject_code: str
    room_code: str | None
    author: str
    role: str
    at: datetime
    edited: bool
    # Recorded from a vote's result.
    poll_id: str | None = None
    # The viewer recorded it.
    mine: bool


class RunPollImpactRead(BaseModel):
    name: str
    level: int


class RunPollOptionRead(BaseModel):
    text: str
    votes: int
    # What follows it, and what it adds to the meters: the team's, to choose
    # with. Never sent to a Player.
    outcome: str | None = None
    impacts: list[RunPollImpactRead] = []


class RunPollRead(BaseModel):
    """A question put to the Players' vote: the tally, never who voted."""

    id: str
    question: str
    options: list[RunPollOptionRead]
    inject_code: str
    room_code: str | None
    open: bool
    voters: int
    # The viewer's own vote (a Player), as the option's position.
    my_vote: int | None = None
    # The decision recorded from it on closing.
    decision_id: str | None = None
    # A poll of the MSEL (False: put to a vote on the spot). Its tally stays
    # with the team until the Controller shows it: until then a Player gets
    # every option at 0 votes.
    planned: bool = False
    # The option the table's vote settled on and what follows it, once
    # closed. A Player gets them only with the result.
    outcome_option: int | None = None
    outcome: str | None = None
    results_visible: bool = True


class RunMeterRead(BaseModel):
    key: str
    name: str
    # What the decisions so far add up to, of the most they could have.
    total: int
    most: int


class RunMeterGroupRead(BaseModel):
    """The meters of one place: the table, or a room (`room_code`; null, in
    rooms: the main room)."""

    room_code: str | None
    decisions: int
    meters: list[RunMeterRead]


class RunRead(BaseModel):
    state: RunState
    seq: int
    # What the client has: send it back as `?since=` to be answered 204
    # while nothing has happened (no event, nobody came or went).
    cursor: str
    # Which run of the exercise this is (1, 2...); None before it starts.
    run_number: int | None = None
    # Whether the Controller may restart it by deleting it: over, and no
    # after-action report written from it.
    can_delete: bool = False
    started_at: datetime | None
    ended_at: datetime | None
    # Pauses the session clock (T+) leaves out: the ones over, and since
    # when the current one runs.
    paused_seconds: int
    paused_at: datetime | None
    # The current pause is for a real-world event (REAL WORLD pressed):
    # since when, and by whom.
    real_world_at: datetime | None = None
    real_world_by: str | None = None
    # The time since the last inject: when it started counting (the latest
    # release or a Controller's reset) and the pause seconds counted then.
    inject_timer_at: datetime | None = None
    inject_timer_paused_seconds: int = 0
    stop_reason: str
    # The word anyone says to halt the exercise for a real incident.
    stop_keyword: str
    scenario_title: str
    scenario_summary: str
    incident_start: time | None
    # The scene's date, if the fiction has one.
    incident_date: date | None
    time_compression: int
    # The planned start of the session, wall clock in the plan's zone.
    session_time: time | None
    phases: list[RunPhaseRead]
    current_phase_code: str | None
    # The Controller's closing message (ENDEX) went out: every phase is over.
    endex_released_at: datetime | None = None
    # Delivered injects, oldest first.
    injects: list[RunInjectRead]
    can_control: bool
    # Why it can't start yet (Controller only): the MSEL and the session
    # plan must both be READY.
    msel_ready: bool
    plan_ready: bool
    control: RunControlRead | None
    presence: list[RunPresenceRead]
    # How many are present, by role (a Player's `presence` names a few).
    presence_counts: dict[str, int] = {}
    facilitation: RunFacilitationRead | None
    # Null: played at one table.
    rooms: RunRoomsRead | None = None
    # The table's decision log, oldest first, and its votes (a Player gets
    # their room's and the main room's).
    decisions: list[RunDecisionRead] = []
    polls: list[RunPollRead] = []
    # The impact meters, per place: the team's all along, a Player's once
    # the Controller shows the summary (`meters_shown`).
    meters: list[RunMeterGroupRead] = []
    meters_shown: bool = False


class RunStopRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class RunRealWorldRequest(BaseModel):
    """REAL WORLD: the exercise's stop keyword, typed to confirm."""

    keyword: str = Field(max_length=100)


class RunReleaseRequest(BaseModel):
    """A contingent inject needs the reason it fires; a mandatory one may
    carry one (released early or late, say)."""

    reason: str = Field(default="", max_length=500)


class RunEndexRequest(BaseModel):
    """The closing message to the table, as the Controller words it."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=4000)


class RunMoveRequest(BaseModel):
    """Players to the main room or back to their own: these, a room's, or
    (neither given) everyone."""

    to: RoomLocation
    user_ids: list[uuid.UUID] | None = Field(default=None, max_length=500)
    room_code: str | None = Field(default=None, max_length=16)


class RunProjectRequest(BaseModel):
    """The delivered inject to show in the main room; null clears it."""

    code: str | None = Field(default=None, max_length=16)


class RunSeat(BaseModel):
    user_id: uuid.UUID
    # Null: no room (the main room only).
    room_code: str | None = Field(default=None, max_length=16)


class RunSeatsRequest(BaseModel):
    assignments: list[RunSeat] = Field(min_length=1, max_length=500)


class RunSkipRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class RunQuestionsRequest(BaseModel):
    """Key questions of a phase (by position) to put to the table on the
    inject in play."""

    phase_code: str = Field(max_length=16)
    positions: list[int] = Field(min_length=1, max_length=20)
    # In rooms: the place they're put to ("main", a room's code).
    room_code: str | None = Field(default=None, max_length=16)


class RunQuestionCoveredRequest(BaseModel):
    phase_code: str = Field(max_length=16)
    position: int = Field(ge=0, le=19)
    covered: bool
    room_code: str | None = Field(default=None, max_length=16)


class RunActionMarkRequest(BaseModel):
    mark: ActionMark
    note: str = Field(default="", max_length=1000)


class RunRestartRequest(BaseModel):
    # `delete` the run with all it recorded, or `archive` it for a new one.
    mode: Literal["delete", "archive"]
    # The typed control word (RESTART_CONFIRMATION_PHRASE), in place of a
    # step-up: restarting is deliberate, not a matter of identity.
    confirmation: str = Field(default="", max_length=50)


class RunPastRead(BaseModel):
    """An archived run of the exercise, for the list of previous runs."""

    id: uuid.UUID
    number: int
    state: Literal["live", "paused", "ended", "stopped"]
    started_at: datetime
    ended_at: datetime | None
    stop_reason: str
    has_report: bool


class RunPastListResponse(BaseModel):
    items: list[RunPastRead]


class RunNoteRead(BaseModel):
    id: uuid.UUID
    # "" for the general note.
    inject_code: str
    room_code: str = ""
    text: str
    updated_at: datetime


class RunDecisionWrite(BaseModel):
    """A decision of the table. `inject_code` defaults to the inject in
    play; `room_code` is the room a team member records it in (a Player's
    is where they are)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=1000)
    inject_code: str = Field(default="", max_length=16)
    room_code: str | None = Field(default=None, max_length=16)


class RunDecisionEdit(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    text: str = Field(min_length=1, max_length=1000)


class RunPollWrite(BaseModel):
    """A question for the Players' vote, on the inject in play."""

    model_config = ConfigDict(str_strip_whitespace=True)

    question: str = Field(min_length=1, max_length=300)
    options: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(
        min_length=2, max_length=6
    )
    room_code: str | None = Field(default=None, max_length=16)


class RunVoteWrite(BaseModel):
    option: int = Field(ge=0)


class RunPollResults(BaseModel):
    """Show a closed planned poll's result to the Players, or hide it."""

    shown: bool


class RunMetersShown(BaseModel):
    """Show the impact meters' summary to the Players, or hide it."""

    shown: bool


class RunPollClose(BaseModel):
    """Closing a vote; `record_option` records that option as a decision,
    `outcome_option` is the one whose consequence the table gets."""

    record_option: int | None = Field(default=None, ge=0)
    outcome_option: int | None = Field(default=None, ge=0)


class RunNoteWrite(BaseModel):
    """The note on an inject (`inject_code`) or the general one (""): its
    whole text -- empty deletes it."""

    inject_code: str = Field(default="", max_length=16)
    text: str = Field(default="", max_length=10000)
    # In rooms: the place a team member's note on an inject is about.
    room_code: str | None = Field(default=None, max_length=16)


class RunNoteListResponse(BaseModel):
    items: list[RunNoteRead]


class RunTeamNoteRead(BaseModel):
    author: str
    role: str
    inject_code: str
    room_code: str = ""
    text: str
    updated_at: datetime


class RunTeamNoteListResponse(BaseModel):
    items: list[RunTeamNoteRead]


class RunRatingRead(BaseModel):
    level: RatingLevel
    rationale: str
    inject_code: str
    updated_at: datetime


class RunPointRead(BaseModel):
    """An observation point to rate: what it means at each level (blank:
    the common scale), where it comes from, what the Controller saw of its
    expected action, and the evaluator's rating."""

    id: uuid.UUID
    kind: str
    text: str
    # Keyed "P", "S", "M", "U".
    criteria: dict[str, str]
    inject_code: str
    action_code: str
    responsible_role: str
    expected_within_minutes: int | None
    action_mark: ActionMark | None
    action_note: str
    rating: RunRatingRead | None


class RunEvalObjectiveRead(BaseModel):
    id: uuid.UUID
    code: str
    title: str
    capability: str
    statement: str
    points: list[RunPointRead]


class RunEvaluationRead(BaseModel):
    """The evaluator's EEG for the session: the objectives they rate (all
    of them for the Lead Evaluator) and how far along they are."""

    objectives: list[RunEvalObjectiveRead]
    rated: int
    total: int


class RunRatingWrite(BaseModel):
    """A level, or none to withdraw the rating."""

    level: RatingLevel | None
    rationale: str = Field(default="", max_length=5000)
    # In rooms: the place rated ("main", a room's code).
    room_code: str | None = Field(default=None, max_length=16)


class RunSummaryInjectRead(BaseModel):
    code: str
    title: str
    kind: InjectKind
    state: InjectRunState
    reason: str


class RunEvaluatorProgressRead(BaseModel):
    name: str
    rated: int
    total: int


class RunMilestoneRead(BaseModel):
    """A step after the session, dated from it by the plan's calendar."""

    key: Literal["hot_wash", "debrief", "ratings_due", "draft_aar", "after_action_meeting"]
    on: date


class RunSummaryRead(BaseModel):
    """How the session went, for its Controllers, Planners and Lead
    Evaluator: time played, injects, expected actions, key questions,
    ratings, notes -- and what comes after, dated."""

    state: RunState
    started_at: datetime
    ended_at: datetime | None
    # Session minutes played, pauses left out.
    played_minutes: int
    stop_reason: str
    injects: list[RunSummaryInjectRead]
    # Expected actions of released injects, by what the Controller marked
    # ("unmarked" for none).
    actions: dict[str, int]
    questions_asked: int
    questions_covered: int
    ratings: list[RunEvaluatorProgressRead]
    # Ratings given, by level.
    levels: dict[str, int]
    team_notes: int
    milestones: list[RunMilestoneRead]


class FeedbackItemRead(BaseModel):
    key: str
    text: str


class RunFeedbackFormRead(BaseModel):
    """The participant feedback form, in the caller's language: open once
    the session is over, answered once."""

    available: bool
    submitted: bool
    intro: str
    statements: list[FeedbackItemRead]
    open_questions: list[FeedbackItemRead]


class RunFeedbackWrite(BaseModel):
    """Statement key -> 1..5 and open question key -> text; all optional."""

    scores: dict[str, Annotated[int, Field(ge=1, le=5)]] = Field(default_factory=dict)
    answers: dict[str, Annotated[str, Field(max_length=2000)]] = Field(default_factory=dict)


class FeedbackStatementResult(BaseModel):
    key: str
    text: str
    n: int
    average: float | None
    # Answers per score, 1 to 5.
    distribution: list[int] | None


class RunFeedbackResultsRead(BaseModel):
    """What the participants answered, aggregated and unsigned. Under
    `minimum` answers only the count shows, so no one can be singled out."""

    responses: int
    players: int
    team: int
    minimum: int
    shown: bool
    statements: list[FeedbackStatementResult]
    # Open question key -> its texts, shuffled.
    answers: dict[str, list[str]]
    open_questions: list[FeedbackItemRead]
