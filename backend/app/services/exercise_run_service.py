"""The Playground's live session: start it from the READY MSEL and session
plan, then run it -- release, skip and fire contingent injects, put the
phase's key questions to the table, mark expected actions, pause, end or
stop -- every step an event of the execution log; restart it (deleting
the run, or archiving it for a new one); and the per-role view every
participant polls."""

import hashlib
import logging
import random
import time
import uuid
from collections import Counter, OrderedDict
from dataclasses import dataclass, field
from datetime import UTC, date, datetime, timedelta

from sqlmodel import Session, func, select

from app.core import surface
from app.core.config import settings
from app.core.exceptions import AppException
from app.data.feedback_form import INTRO, OBJECTIVE_STATEMENT, OPEN_QUESTIONS, STATEMENTS
from app.data.feedback_form import text as feedback_text
from app.models import (
    TTX,
    AfterActionReport,
    ConductPrepSnapshot,
    ConductPrepStatus,
    DeliveryMethod,
    ExerciseRun,
    InjectFormat,
    InjectKind,
    MselSnapshot,
    MselStatus,
    RoleEnum,
    RunEvent,
    RunEventType,
    RunFeedbackResponse,
    RunFeedbackSubmission,
    RunNote,
    RunPresence,
    RunRating,
    RunStatus,
    TTXAccess,
    TTXConductPrep,
    TTXContextRole,
    TTXMsel,
    TTXRoom,
    User,
)
from app.models.exercise_run import ActionMark, RatingLevel
from app.schemas.exercise_run import (
    FeedbackItemRead,
    FeedbackStatementResult,
    RunActionRead,
    RunControlInjectRead,
    RunControlPhaseRead,
    RunControlRead,
    RunDecisionRead,
    RunEvalObjectiveRead,
    RunEvaluationRead,
    RunEvaluatorProgressRead,
    RunFacilitationRead,
    RunFeedbackFormRead,
    RunFeedbackResultsRead,
    RunInjectRead,
    RunMeRead,
    RunMeterGroupRead,
    RunMeterRead,
    RunMilestoneRead,
    RunNoteRead,
    RunPastRead,
    RunPhaseRead,
    RunPointRead,
    RunPollImpactRead,
    RunPollOptionRead,
    RunPollRead,
    RunPresenceRead,
    RunQuestionPlaceRead,
    RunQuestionRead,
    RunRatingRead,
    RunRead,
    RunRoomPlayerRead,
    RunRoomRead,
    RunRoomsRead,
    RunSenderRead,
    RunSummaryInjectRead,
    RunSummaryRead,
    RunTeamNoteRead,
)
from app.schemas.ttx_msel import InjectFileRead, InjectImageRead
from app.services.ttx_conduct_prep_service import latest_prep_snapshot
from app.services.ttx_msel_service import latest_snapshot
from app.services.ttx_needs_form_service import get_form

logger = logging.getLogger(__name__)

# The roles someone takes part in the session as (the Planner designs it,
# the Program Manager oversees it: neither is "at" it).
ACTING_ROLES = (
    TTXContextRole.CONTROLLER.value,
    TTXContextRole.FACILITATOR.value,
    TTXContextRole.EVALUATOR.value,
    TTXContextRole.OBSERVER.value,
    TTXContextRole.PLAYER.value,
)
# Present: seen by a poll this recently (polls run every 3 s while the
# Playground is open and visible).
PRESENCE_WINDOW = timedelta(seconds=15)
# A Player's view names at most this many Players present; the rest count
# (RunRead.presence_counts). With hundreds at the table, the full list made
# every view grow with the table (docs/deployment.md, section 10).
PRESENCE_NAMES_MAX = 30
# touch_presence writes at most this often per person and role: the stream
# keeps them present every RUN_STREAM_KEEPALIVE_SECONDS anyway.
PRESENCE_TOUCH_INTERVAL = timedelta(seconds=5)


def find_run(session: Session, ttx_id: uuid.UUID, *, lock: bool = False) -> ExerciseRun | None:
    """The exercise's current run (archived ones are history)."""
    query = select(ExerciseRun).where(
        ExerciseRun.ttx_id == ttx_id, ExerciseRun.archived_at.is_(None)
    )
    if lock:
        query = query.with_for_update()
    return session.exec(query).first()


def _ready_snapshots(
    session: Session, ttx_id: uuid.UUID
) -> tuple[MselSnapshot | None, ConductPrepSnapshot | None]:
    """The snapshots a session plays -- only while their document is READY
    (one being revised isn't run from its older version)."""
    msel = session.exec(select(TTXMsel).where(TTXMsel.ttx_id == ttx_id)).first()
    prep = session.exec(select(TTXConductPrep).where(TTXConductPrep.ttx_id == ttx_id)).first()
    msel_snapshot = (
        latest_snapshot(session, ttx_id) if msel and msel.status == MselStatus.READY else None
    )
    plan_snapshot = (
        latest_prep_snapshot(session, ttx_id)
        if prep and prep.status == ConductPrepStatus.READY
        else None
    )
    return msel_snapshot, plan_snapshot


@dataclass
class _Decision:
    """A decision of the table's log, as it stands (edits applied)."""

    id: str
    text: str
    inject_code: str
    room_code: str | None
    role: str
    author_id: uuid.UUID
    at: datetime
    edited: bool = False
    poll_id: str | None = None


@dataclass
class _Poll:
    """A question put to the Players' vote: each Player's latest vote."""

    id: str
    question: str
    options: list[str]
    inject_code: str
    room_code: str | None
    open: bool = True
    # Player id -> the option's position.
    votes: dict[str, int] = field(default_factory=dict)
    decision_id: str | None = None
    # A poll of the MSEL, opened with its inject: the Players see its tally
    # only once the Controller shows it.
    planned: bool = False
    results_shown: bool = False
    # What follows each option, and the option the table settled on.
    outcomes: list[str] = field(default_factory=list)
    outcome_option: int | None = None
    # What each option adds to the meters: meter key -> level.
    impacts: list[dict] = field(default_factory=list)


@dataclass
class _Log:
    """The execution log folded into what's true now."""

    # Inject code -> (when, reason), in release order.
    released: dict[str, tuple[datetime, str]] = field(default_factory=dict)
    skipped: dict[str, str] = field(default_factory=dict)
    # Inject code -> the questions put on it, in order, as (phase code,
    # position, text, room).
    questions: dict[str, list[tuple[str, int, str, str | None]]] = field(default_factory=dict)
    # (Phase code, room) -> positions of its key questions already asked,
    # and of those marked as discussed. In rooms each place has its own;
    # without them the room is None.
    asked: dict[tuple[str, str | None], set[int]] = field(default_factory=dict)
    covered: dict[tuple[str, str | None], set[int]] = field(default_factory=dict)
    # Action code -> (mark, note, when); the latest mark counts.
    marks: dict[str, tuple[ActionMark, str, datetime]] = field(default_factory=dict)
    # Rooms: Player id -> where the Controller last sent them (absent: where
    # their seat puts them -- their room, or the main room without one).
    location: dict[str, str] = field(default_factory=dict)
    # The inject on the main room's screen, and every one shown there.
    projected: str | None = None
    projected_history: list[str] = field(default_factory=list)
    # The Controller's closing message: (when, title, content).
    endex: tuple[datetime, str, str] | None = None
    # The table's decisions and votes, by id, in the order they came.
    decisions: dict[str, _Decision] = field(default_factory=dict)
    polls: dict[str, _Poll] = field(default_factory=dict)
    # The Controller showed the Players the impact meters' summary.
    meters_shown: bool = False


def _log(session: Session, run: ExerciseRun | None) -> _Log:
    log = _Log()
    if run is None:
        return log
    for event in session.exec(
        select(RunEvent).where(RunEvent.run_id == run.id).order_by(RunEvent.seq)
    ):
        p = event.payload
        if event.type == RunEventType.INJECT_RELEASED:
            log.released[p["inject_code"]] = (event.at, p.get("reason", ""))
        elif event.type == RunEventType.INJECT_RESENT:
            # Back in play: last in release order, delivered now, same reason.
            _, reason = log.released.pop(p["inject_code"])
            log.released[p["inject_code"]] = (event.at, reason)
        elif event.type == RunEventType.INJECT_SKIPPED:
            log.skipped[p["inject_code"]] = p.get("reason", "")
        elif event.type == RunEventType.QUESTIONS_RELEASED:
            place = p.get("room_code")
            log.questions.setdefault(p["inject_code"], []).extend(
                (p["phase_code"], position, text, place)
                for position, text in zip(p["positions"], p["questions"], strict=False)
            )
            log.asked.setdefault((p["phase_code"], place), set()).update(p["positions"])
        elif event.type == RunEventType.QUESTION_COVERED:
            covered = log.covered.setdefault((p["phase_code"], p.get("room_code")), set())
            if p["covered"]:
                covered.add(p["position"])
            else:
                covered.discard(p["position"])
        elif event.type == RunEventType.ACTION_MARKED:
            log.marks[p["action_code"]] = (ActionMark(p["mark"]), p.get("note", ""), event.at)
        elif event.type == RunEventType.PLAYERS_MOVED:
            for user_id in p["user_ids"]:
                log.location[user_id] = p["to"]
        elif event.type == RunEventType.PLAYERS_SEATED:
            # A new seat: off to it (the main room without one).
            for seat in p["assignments"]:
                log.location.pop(seat["user_id"], None)
        elif event.type == RunEventType.MAIN_PROJECTED:
            log.projected = p.get("inject_code")
            if log.projected and log.projected not in log.projected_history:
                log.projected_history.append(log.projected)
        elif event.type == RunEventType.ENDEX:
            log.endex = (event.at, p["title"], p["content"])
        elif event.type == RunEventType.DECISION_RECORDED:
            log.decisions[p["decision_id"]] = _Decision(
                id=p["decision_id"],
                text=p["text"],
                inject_code=p["inject_code"],
                room_code=p.get("room_code"),
                role=p["role"],
                author_id=event.actor_id,
                at=event.at,
                poll_id=p.get("poll_id"),
            )
            if p.get("poll_id") in log.polls:
                log.polls[p["poll_id"]].decision_id = p["decision_id"]
        elif event.type == RunEventType.DECISION_EDITED:
            if decision := log.decisions.get(p["decision_id"]):
                decision.text = p["text"]
                decision.edited = True
        elif event.type == RunEventType.DECISION_DELETED:
            gone = log.decisions.pop(p["decision_id"], None)
            if gone and gone.poll_id in log.polls:
                log.polls[gone.poll_id].decision_id = None
        elif event.type == RunEventType.POLL_OPENED:
            log.polls[p["poll_id"]] = _Poll(
                id=p["poll_id"],
                question=p["question"],
                options=p["options"],
                inject_code=p["inject_code"],
                room_code=p.get("room_code"),
                planned=p.get("planned", False),
                outcomes=p.get("outcomes", []),
                impacts=p.get("impacts", []),
            )
        elif event.type == RunEventType.VOTE_CAST:
            if poll := log.polls.get(p["poll_id"]):
                poll.votes[str(event.actor_id)] = p["option"]
        elif event.type == RunEventType.POLL_CLOSED:
            if poll := log.polls.get(p["poll_id"]):
                poll.open = False
                poll.outcome_option = p.get("outcome_option")
        elif event.type == RunEventType.POLL_RESULTS_SHOWN:
            if poll := log.polls.get(p["poll_id"]):
                poll.results_shown = p["shown"]
        elif event.type == RunEventType.METERS_SHOWN:
            log.meters_shown = p["shown"]
    return log


def _append(session: Session, run: ExerciseRun, type: RunEventType, user: User, **payload) -> None:
    """One more event of the log; the caller holds the run row locked."""
    run.last_seq += 1
    session.add(run)
    session.add(
        RunEvent(run_id=run.id, seq=run.last_seq, type=type, payload=payload, actor_id=user.id)
    )


def _refuse(code: str, message: str, status: int = 409, params: dict | None = None) -> AppException:
    return AppException(code, message, status, log_level=logging.WARNING, params=params)


def _open_run(session: Session, ttx: TTX, *allowed: RunStatus) -> ExerciseRun:
    """The run, locked, in one of `allowed` states (LIVE by default)."""
    run = find_run(session, ttx.id, lock=True)
    if run is None:
        raise _refuse("RUN_NOT_STARTED", "The session hasn't started.")
    if run.status not in (allowed or (RunStatus.LIVE,)):
        if run.status in (RunStatus.ENDED, RunStatus.STOPPED):
            raise _refuse("RUN_FINISHED", "The session is over.")
        if run.status == RunStatus.PAUSED:
            raise _refuse("RUN_PAUSED", "The session is paused.")
        raise _refuse("RUN_NOT_PAUSED", "The session isn't paused.")
    return run


def _payload(session: Session, run: ExerciseRun) -> dict:
    return session.get(MselSnapshot, run.msel_snapshot_id).payload


def _inject(msel: dict, code: str) -> dict:
    inject = next((i for i in msel["injects"] if i["code"] == code), None)
    if inject is None:
        raise AppException("INJECT_NOT_FOUND", "No such inject in this MSEL.", 404)
    return inject


def start_run(session: Session, ttx: TTX, user: User) -> ExerciseRun:
    if find_run(session, ttx.id) is not None:
        raise _refuse("RUN_ALREADY_STARTED", "This exercise's session has already started.")
    msel_snapshot, plan_snapshot = _ready_snapshots(session, ttx.id)
    if msel_snapshot is None or plan_snapshot is None:
        raise _refuse(
            "RUN_NOT_READY",
            "The MSEL and the session plan must both be ready to start the session.",
        )
    last = session.exec(
        select(func.max(ExerciseRun.number)).where(ExerciseRun.ttx_id == ttx.id)
    ).one()
    run = ExerciseRun(
        ttx_id=ttx.id,
        number=(last or 0) + 1,
        msel_snapshot_id=msel_snapshot.id,
        plan_snapshot_id=plan_snapshot.id,
        started_by_id=user.id,
    )
    session.add(run)
    session.flush()
    # The general notes written while waiting are this run's.
    for note in session.exec(
        select(RunNote).where(RunNote.ttx_id == ttx.id, RunNote.run_id.is_(None))
    ):
        note.run_id = run.id
        session.add(note)
    _append(session, run, RunEventType.START, user)
    session.commit()
    logger.info("Session of TTX %s started by user %s.", ttx.id, user.id)
    return run


def release_inject(session: Session, ttx: TTX, user: User, code: str, reason: str = "") -> None:
    """Deliver an inject to the table. A contingent one needs the reason it
    fires (its expected action wasn't seen, say)."""
    run = _open_run(session, ttx)
    inject = _inject(_payload(session, run), code)
    reason = reason.strip()
    if inject["kind"] == InjectKind.CONTINGENT.value and not reason:
        raise _refuse("REASON_REQUIRED", "Say why this contingent inject fires.", 422)
    log = _log(session, run)
    _refuse_after_endex(log)
    if code in log.released:
        raise _refuse("INJECT_ALREADY_RELEASED", "This inject has already been released.")
    if code in log.skipped:
        raise _refuse("INJECT_SKIPPED", "This inject was skipped.")
    _append(session, run, RunEventType.INJECT_RELEASED, user, inject_code=code, reason=reason)
    if _format(inject) == InjectFormat.POLL.value:
        rooms = _rooms(session, ttx, _payload(session, run))
        if rooms is None:
            _open_planned_poll(session, run, user, inject, None)
        else:
            for room in rooms.rooms:
                if _played_in(inject, room):
                    _open_planned_poll(session, run, user, inject, room["code"])
    _restart_inject_timer(run)
    session.commit()


def resend_inject(session: Session, ttx: TTX, user: User, code: str) -> None:
    """Deliver an inject already delivered once more (the table missed it,
    or the Controller steps back to it): it's back in play, and the time
    since the last inject restarts."""
    run = _open_run(session, ttx)
    _inject(_payload(session, run), code)
    log = _log(session, run)
    _refuse_after_endex(log)
    if code not in log.released:
        raise _refuse("INJECT_NOT_RELEASED", "This inject hasn't been released.")
    _append(session, run, RunEventType.INJECT_RESENT, user, inject_code=code)
    _restart_inject_timer(run)
    session.commit()


ENDEX_CODE = "ENDEX"


def _refuse_after_endex(log: _Log) -> None:
    if log.endex is not None:
        raise _refuse("ENDEX_RELEASED", "ENDEX is out: the play is over.")


def release_endex(session: Session, ttx: TTX, user: User, title: str, content: str) -> None:
    """The Controller's closing message to the table (ENDEX), once every
    mandatory inject is out (released or skipped): every phase is over. The
    session stays live for the hot wash; ending it is still its own step."""
    run = _open_run(session, ttx)
    log = _log(session, run)
    _refuse_after_endex(log)
    pending = [
        i["code"]
        for i in _payload(session, run)["injects"]
        if i["kind"] == InjectKind.MANDATORY.value
        and i["code"] not in log.released
        and i["code"] not in log.skipped
    ]
    if pending:
        raise _refuse("INJECTS_PENDING", "Release or skip every mandatory inject first.")
    # The play is over: so is any vote still open.
    for poll in log.polls.values():
        if poll.open:
            _append(session, run, RunEventType.POLL_CLOSED, user, poll_id=poll.id)
    _append(session, run, RunEventType.ENDEX, user, title=title.strip(), content=content.strip())
    _restart_inject_timer(run)
    session.commit()
    logger.info("ENDEX of TTX %s released by user %s.", ttx.id, user.id)


def _restart_inject_timer(run: ExerciseRun) -> None:
    """Start the time since the last inject now. A pause in progress counts
    as already paused, so a reset made during it reads right after resume."""
    now = datetime.now(UTC)
    in_pause = int((now - run.paused_at).total_seconds()) if run.paused_at else 0
    run.inject_timer_at = now
    run.inject_timer_paused_seconds = run.paused_seconds + in_pause


def reset_inject_timer(session: Session, ttx: TTX, user: User) -> None:
    """The Controller restarts the time since the last inject (it's on
    every screen): once one has been released, live or paused."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    if run.inject_timer_at is None:
        raise _refuse("NO_INJECT_RELEASED", "No inject has been released yet.")
    _restart_inject_timer(run)
    _append(session, run, RunEventType.INJECT_TIMER_RESET, user)
    session.commit()


def skip_inject(session: Session, ttx: TTX, user: User, code: str, reason: str) -> None:
    """Leave an inject out of the session (the table already got there, or
    time ran short), with why."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    _inject(_payload(session, run), code)
    log = _log(session, run)
    _refuse_after_endex(log)
    if code in log.released:
        raise _refuse("INJECT_ALREADY_RELEASED", "This inject has already been released.")
    if code in log.skipped:
        raise _refuse("INJECT_SKIPPED", "This inject was skipped.")
    _append(
        session, run, RunEventType.INJECT_SKIPPED, user, inject_code=code, reason=reason.strip()
    )
    session.commit()


def release_questions(
    session: Session,
    ttx: TTX,
    user: User,
    phase_code: str,
    positions: list[int],
    room_code: str | None = None,
) -> None:
    """Put key questions of a phase to the table, on the inject in play --
    in rooms, to one place, on the inject in play there."""
    run = _open_run(session, ttx)
    msel = _payload(session, run)
    phase = next((p for p in msel["phases"] if p["code"] == phase_code), None)
    if phase is None:
        raise AppException("PHASE_NOT_FOUND", "No such phase in this MSEL.", 404)
    positions = sorted(set(positions))
    if any(not 0 <= index < len(phase["key_questions"]) for index in positions):
        raise _refuse("QUESTION_NOT_FOUND", "No such key question in this phase.", 422)
    log = _log(session, run)
    rooms, where = _place(session, ttx, run, log, user, TTXContextRole.CONTROLLER.value, room_code)
    in_play = next(reversed(log.released), None)
    if rooms is not None:
        in_play = _in_play(session, run, log, rooms, where)
    if in_play is None or (rooms is not None and in_play == ENDEX_CODE):
        raise _refuse("NO_INJECT_IN_PLAY", "Release an inject before asking its questions.")
    _append(
        session,
        run,
        RunEventType.QUESTIONS_RELEASED,
        user,
        inject_code=in_play,
        phase_code=phase_code,
        positions=positions,
        questions=[phase["key_questions"][index] for index in positions],
        room_code=where,
    )
    session.commit()


def cover_question(
    session: Session,
    ttx: TTX,
    user: User,
    phase_code: str,
    position: int,
    covered: bool,
    room_code: str | None = None,
) -> None:
    """Mark a key question put to the table as discussed -- or undo it. In
    rooms, in one place."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    log = _log(session, run)
    _, where = _place(session, ttx, run, log, user, TTXContextRole.CONTROLLER.value, room_code)
    if position not in log.asked.get((phase_code, where), set()):
        raise _refuse("QUESTION_NOT_ASKED", "That question hasn't been put to the table.")
    _append(
        session,
        run,
        RunEventType.QUESTION_COVERED,
        user,
        phase_code=phase_code,
        position=position,
        covered=covered,
        room_code=where,
    )
    session.commit()


def mark_action(
    session: Session, ttx: TTX, user: User, code: str, mark: ActionMark, note: str
) -> None:
    """What the table did about an expected action of a released inject."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    msel = _payload(session, run)
    owner = next(
        (i for i in msel["injects"] for a in i["expected_actions"] if a["code"] == code), None
    )
    if owner is None:
        raise AppException("ACTION_NOT_FOUND", "No such expected action in this MSEL.", 404)
    if owner["code"] not in _log(session, run).released:
        raise _refuse("INJECT_NOT_RELEASED", "Its inject hasn't been released.")
    _append(
        session,
        run,
        RunEventType.ACTION_MARKED,
        user,
        action_code=code,
        inject_code=owner["code"],
        mark=mark.value,
        note=note.strip(),
    )
    session.commit()


def pause_run(session: Session, ttx: TTX, user: User) -> None:
    run = _open_run(session, ttx)
    # Once ENDEX is out there's no play left to hold.
    _refuse_after_endex(_log(session, run))
    run.status = RunStatus.PAUSED
    run.paused_at = datetime.now(UTC)
    _append(session, run, RunEventType.PAUSE, user)
    session.commit()


# What to type to press REAL WORLD when the needs analysis set no stop keyword.
DEFAULT_STOP_KEYWORD = "REAL WORLD"


def real_world_pause(session: Session, ttx: TTX, user: User, keyword: str) -> None:
    """Pause it for a real-world event: anyone at the table may, typing the
    exercise's stop keyword (any case) to confirm; every screen says why,
    and only a Controller resumes. Pressed twice, nothing changes."""
    expected = get_form(session, ttx.id).stop_exercise_keyword.strip() or DEFAULT_STOP_KEYWORD
    if keyword.strip().casefold() != expected.casefold():
        raise _refuse("KEYWORD_MISMATCH", "That isn't the stop keyword.", 422)
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    _refuse_after_endex(_log(session, run))
    if run.real_world_at is not None:
        return
    now = datetime.now(UTC)
    if run.status == RunStatus.LIVE:
        run.status = RunStatus.PAUSED
        run.paused_at = now
    run.real_world_at = now
    run.real_world_by_id = user.id
    _append(session, run, RunEventType.PAUSE, user, real_world=True)
    session.commit()
    logger.warning("Session of TTX %s paused for a real-world event by user %s.", ttx.id, user.id)


def resume_run(session: Session, ttx: TTX, user: User) -> None:
    run = _open_run(session, ttx, RunStatus.PAUSED)
    _close_pause(run)
    run.real_world_at = None
    run.real_world_by_id = None
    run.status = RunStatus.LIVE
    _append(session, run, RunEventType.RESUME, user)
    session.commit()


def _close_pause(run: ExerciseRun) -> None:
    if run.paused_at is not None:
        run.paused_seconds += int((datetime.now(UTC) - run.paused_at).total_seconds())
        run.paused_at = None


def end_run(session: Session, ttx: TTX, user: User) -> None:
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    _close_pause(run)
    run.status = RunStatus.ENDED
    run.ended_at = datetime.now(UTC)
    _append(session, run, RunEventType.END, user)
    session.commit()
    logger.info("Session of TTX %s ended by user %s.", ttx.id, user.id)


def stop_run(session: Session, ttx: TTX, user: User, reason: str) -> None:
    """Halt it for a real-world incident: every screen shows why."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    _close_pause(run)
    run.status = RunStatus.STOPPED
    run.ended_at = datetime.now(UTC)
    run.stop_reason = reason.strip()
    _append(session, run, RunEventType.STOP, user, reason=run.stop_reason)
    session.commit()
    logger.warning("Session of TTX %s STOPPED by user %s.", ttx.id, user.id)


def has_report(session: Session, run: ExerciseRun) -> bool:
    """Whether an after-action report was written from this run."""
    return (
        session.exec(select(AfterActionReport.id).where(AfterActionReport.run_id == run.id)).first()
        is not None
    )


RESTART_CONFIRMATION_PHRASE = "restart"


def restart_run(session: Session, ttx: TTX, user: User, mode: str, confirmation: str) -> None:
    """Back to Not started once the session is over: `delete` takes the
    run with everything recorded in it (refused while a report rests on
    it), `archive` keeps it as a previous run beside the next one. The
    Controller types the control word (any case) to confirm."""
    if confirmation.strip().lower() != RESTART_CONFIRMATION_PHRASE:
        raise AppException(
            "CONFIRMATION_MISMATCH",
            'Type "{phrase}" to restart the exercise.',
            400,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
            params={"phrase": RESTART_CONFIRMATION_PHRASE},
        )
    run = find_run(session, ttx.id, lock=True)
    if run is None:
        raise _refuse("RUN_NOT_STARTED", "The session hasn't started.")
    if run.status not in (RunStatus.ENDED, RunStatus.STOPPED):
        raise _refuse("RUN_NOT_FINISHED", "End the session before restarting it.")
    if mode == "delete":
        if has_report(session, run):
            raise _refuse(
                "RUN_HAS_REPORT",
                "An after-action report was written from this session: start a new run instead.",
            )
        _delete_runs(session, [run.id])
    else:
        run.archived_at = datetime.now(UTC)
        session.add(run)
    session.commit()
    logger.warning(
        "Session %s of TTX %s restarted by user %s (%s).", run.number, ttx.id, user.id, mode
    )


def past_runs(session: Session, ttx: TTX) -> list[RunPastRead]:
    """The exercise's archived runs, latest first."""
    runs = session.exec(
        select(ExerciseRun)
        .where(ExerciseRun.ttx_id == ttx.id, ExerciseRun.archived_at.is_not(None))
        .order_by(ExerciseRun.number.desc())
    ).all()
    reported = set(
        session.exec(
            select(AfterActionReport.run_id).where(
                AfterActionReport.run_id.in_([r.id for r in runs])
            )
        )
    )
    return [
        RunPastRead(
            id=run.id,
            number=run.number,
            state=run.status.value,
            started_at=run.started_at,
            ended_at=run.ended_at,
            stop_reason=run.stop_reason,
            has_report=run.id in reported,
        )
        for run in runs
    ]


def _scenario_minute(session_minute: int | None, phases: list[dict], compression: int):
    """Minutes into the fiction at a session minute: the time compression
    plus the jumps of the phases already begun (lib/msel.ts incidentMinutesAt)."""
    if session_minute is None:
        return None
    jumps = sum(
        p.get("incident_jump_minutes", 0) for p in phases if 0 < p["start_offset"] <= session_minute
    )
    return session_minute * compression + jumps


def _session_minute(inject: dict, phase_by_id: dict[str, dict]) -> int | None:
    if inject["kind"] == InjectKind.MANDATORY.value:
        return inject["offset_minutes"]
    phase = phase_by_id.get(inject["phase_id"])
    if phase is None or inject.get("fires_at_minute") is None:
        return None
    return phase["start_offset"] + inject["fires_at_minute"]


def _format(inject: dict) -> str:
    """A frozen inject's format (a snapshot from before formats says
    `scored`)."""
    if "format" in inject:
        return inject["format"]
    return "inject" if inject.get("scored", True) else "discussion"


def _question_places(log: _Log, phase_code: str) -> list[RunQuestionPlaceRead]:
    """Where a phase's key questions stand in each place, in rooms."""
    return [
        RunQuestionPlaceRead(
            room_code=place,
            released_questions=sorted(asked),
            covered_questions=sorted(log.covered.get((phase_code, place), set())),
        )
        for (code, place), asked in log.asked.items()
        if code == phase_code and place is not None
    ]


def _control(msel: dict, log: _Log) -> RunControlRead:
    room_codes = {str(r["id"]): r["code"] for r in msel.get("rooms", [])}
    phases = msel["phases"]
    phase_by_id = {p["id"]: p for p in phases}
    action_code = {a["id"]: a["code"] for i in msel["injects"] for a in i["expected_actions"]}

    def phase_code(inject: dict) -> str | None:
        phase = phase_by_id.get(inject["phase_id"])
        return phase["code"] if phase else None

    def state(code: str) -> str:
        if code in log.released:
            return "released"
        return "skipped" if code in log.skipped else "pending"

    def actions(inject: dict) -> list[RunActionRead]:
        rows = []
        for a in inject["expected_actions"]:
            mark, note, at = log.marks.get(a["code"], (None, "", None))
            rows.append(
                RunActionRead(
                    code=a["code"],
                    description=a["description"],
                    responsible_role=a["responsible_role"],
                    expected_within_minutes=a["expected_within_minutes"],
                    mark=mark,
                    note=note,
                    marked_at=at,
                )
            )
        return rows

    injects = []
    for i in msel["injects"]:
        branch_action = action_code.get(i.get("branch_action_id"))
        branch_mark = log.marks.get(branch_action) if branch_action else None
        released = log.released.get(i["code"])
        injects.append(
            RunControlInjectRead(
                code=i["code"],
                title=i["title"],
                kind=i["kind"],
                format=_format(i),
                phase_code=phase_code(i),
                offset_minutes=i["offset_minutes"],
                due_minute=_session_minute(i, phase_by_id),
                state=state(i["code"]),
                reason=released[1] if released else log.skipped.get(i["code"], ""),
                trigger_condition=i["trigger_condition"],
                contingent_purpose=i["contingent_purpose"],
                branch_action_code=branch_action,
                suggested=state(i["code"]) == "pending"
                and branch_mark is not None
                and branch_mark[0] == ActionMark.NOT_OBSERVED,
                expected_actions=actions(i),
                room_codes=[
                    room_codes[str(r)] for r in i.get("room_ids", []) if str(r) in room_codes
                ],
            )
        )
    return RunControlRead(
        phases=[
            RunControlPhaseRead(
                code=p["code"],
                name=p["name"],
                start_offset=p["start_offset"],
                end_offset=p["end_offset"],
                key_questions=p["key_questions"],
                released_questions=sorted(log.asked.get((p["code"], None), set())),
                covered_questions=sorted(log.covered.get((p["code"], None), set())),
                question_places=_question_places(log, p["code"]),
            )
            for p in phases
        ],
        injects=injects,
        msel=msel,
    )


def run_view(
    session: Session,
    ttx: TTX,
    run: ExerciseRun | None,
    *,
    can_control: bool,
    viewer_role: str | None = None,
    viewer: User | None = None,
) -> RunRead:
    """What a participant sees (see _build_view). A Player's goes through
    player_view, which builds the part a room's Players share once."""
    view, _, _ = _build_view(
        session, ttx, run, can_control=can_control, viewer_role=viewer_role, viewer=viewer
    )
    return view


def _build_view(
    session: Session,
    ttx: TTX,
    run: ExerciseRun | None,
    *,
    can_control: bool,
    viewer_role: str | None = None,
    viewer: User | None = None,
    seat_room_id: str | None = None,
) -> tuple[RunRead, "_Log", "_Rooms | None"]:
    """What a participant sees; `can_control` adds the Controller's MSEL,
    `viewer_role` (the role they act as) decides who they see by name and
    gives a Facilitator their script. In rooms, a Player (`viewer`) gets only
    the injects of their room and of the main room. Without a `viewer`, a
    Player's view is the one every Player seated in `seat_room_id` shares
    (nothing marked as theirs); returned with the log and rooms it was
    built from, to personalize it."""
    if run is not None:
        msel_snapshot = session.get(MselSnapshot, run.msel_snapshot_id)
        plan_snapshot = session.get(ConductPrepSnapshot, run.plan_snapshot_id)
        msel_ready = plan_ready = True
    else:
        msel_snapshot, plan_snapshot = _ready_snapshots(session, ttx.id)
        msel_ready, plan_ready = msel_snapshot is not None, plan_snapshot is not None
    msel = msel_snapshot.payload if msel_snapshot else {}
    plan = plan_snapshot.payload if plan_snapshot else {}
    msel_meters = msel.get("meters", [])
    phases: list[dict] = msel.get("phases", [])
    injects: list[dict] = msel.get("injects", [])
    actors = {a["id"]: a for a in msel.get("actors", [])}
    phase_by_id = {p["id"]: p for p in phases}
    compression = msel.get("time_compression", 60)

    log = _log(session, run)
    by_code = {i["code"]: i for i in injects}
    delivered = [by_code[code] for code in log.released if code in by_code]

    current_index: int | None = None
    if run is not None and phases:
        current_index = 0
        if delivered and delivered[-1]["phase_id"] in phase_by_id:
            current_index = phases.index(phase_by_id[delivered[-1]["phase_id"]])
    # ENDEX is out: every phase is over.
    over = log.endex is not None

    def phase_state(index: int) -> str:
        if over:
            return "done"
        if current_index is None or index > current_index:
            return "upcoming"
        return "current" if index == current_index else "done"

    run_phases = [
        RunPhaseRead(
            code=p["code"],
            number=index + 1,
            state=phase_state(index),
            name=p["name"] if phase_state(index) != "upcoming" else None,
            # Its own headline (its delivered injects are listed under it).
            headline=(p.get("headline") or None) if phase_state(index) != "upcoming" else None,
        )
        for index, p in enumerate(phases)
    ]

    def sender(inject: dict) -> RunSenderRead | None:
        actor = actors.get(inject.get("simulated_actor_id"))
        if actor is None:
            return None
        return RunSenderRead(name=actor["name"], type=actor["type"], channel=actor.get("channel"))

    rooms = _rooms(session, ttx, msel)
    player = viewer_role == TTXContextRole.PLAYER.value
    seen = delivered
    # A Player in rooms sees their room's decisions and votes, and the main
    # room's; everyone else, all of them.
    places: set[str | None] | None = None
    if rooms is not None and player:
        if viewer is not None:
            seat = next((s for s in rooms.seats if s.user_id == viewer.id), None)
        else:
            room = next((r for r in rooms.rooms if r["id"] == seat_room_id), None)
            seat = _Seat(user_id=uuid.UUID(int=0), name="", room=room) if room else None
        seen = _player_feed(rooms, seat, log, delivered)
        places = {None, MAIN_ROOM} | ({seat.room["code"]} if seat and seat.room else set())
    room_codes = {r["id"]: r["code"] for r in rooms.rooms} if rooms else {}

    run_injects = [
        RunInjectRead(
            code=i["code"],
            title=i["title"],
            content=i["content"],
            format=_format(i),
            phase_code=phase_by_id[i["phase_id"]]["code"] if i["phase_id"] in phase_by_id else None,
            delivery_method=i["delivery_method"],
            sender=sender(i),
            recipients=i["recipients"],
            attachment_notes=i["attachment_notes"],
            artifact=i.get("artifact"),
            images=[InjectImageRead.model_validate(image) for image in i.get("images", [])],
            files=[InjectFileRead.model_validate(file) for file in i.get("files", [])],
            scenario_minute=_scenario_minute(_session_minute(i, phase_by_id), phases, compression),
            released_at=log.released[i["code"]][0],
            questions=[
                RunQuestionRead(
                    text=text,
                    covered=position in log.covered.get((phase_code, place), set()),
                    room_code=place,
                )
                for phase_code, position, text, place in log.questions.get(i["code"], [])
                if places is None or place in places
            ],
            room_codes=[room_codes[str(r)] for r in i.get("room_ids", []) if str(r) in room_codes],
        )
        for i in seen
    ]
    if log.endex is not None:
        # The closing message reaches every Player, in every room.
        at, title, content = log.endex
        run_injects.append(
            RunInjectRead(
                code=ENDEX_CODE,
                title=title,
                content=content,
                phase_code=None,
                delivery_method=DeliveryMethod.BRIEFING,
                sender=None,
                recipients=[],
                attachment_notes=[],
                images=[],
                scenario_minute=None,
                released_at=at,
                questions=[],
            )
        )

    present = presence(session, ttx, viewer_role)
    counts = presence_counts(session, ttx)
    seq = run.last_seq if run else 0
    view = RunRead(
        state=run.status.value if run else "not_started",
        seq=seq,
        cursor=cursor(run, present, counts),
        run_number=run.number if run else None,
        can_delete=(
            can_control
            and run is not None
            and run.status in (RunStatus.ENDED, RunStatus.STOPPED)
            and not has_report(session, run)
        ),
        started_at=run.started_at if run else None,
        ended_at=run.ended_at if run else None,
        paused_seconds=run.paused_seconds if run else 0,
        paused_at=run.paused_at if run else None,
        real_world_at=run.real_world_at if run else None,
        inject_timer_at=run.inject_timer_at if run else None,
        inject_timer_paused_seconds=run.inject_timer_paused_seconds if run else 0,
        real_world_by=(
            by.full_name
            if run and run.real_world_by_id and (by := session.get(User, run.real_world_by_id))
            else None
        ),
        stop_reason=run.stop_reason if run else "",
        stop_keyword=get_form(session, ttx.id).stop_exercise_keyword,
        scenario_title=msel.get("title", ""),
        scenario_summary=msel.get("summary", ""),
        incident_start=msel.get("incident_start"),
        incident_date=msel.get("incident_date"),
        time_compression=compression,
        session_time=plan.get("session_time") or msel.get("exercise_start"),
        phases=run_phases,
        current_phase_code=(
            phases[current_index]["code"] if current_index is not None and not over else None
        ),
        endex_released_at=log.endex[0] if log.endex else None,
        injects=run_injects,
        can_control=can_control,
        msel_ready=msel_ready,
        plan_ready=plan_ready,
        control=_control(msel, log) if can_control and msel else None,
        presence=present,
        presence_counts=counts,
        facilitation=(
            _facilitation(phases, delivered, current_index, log)
            if viewer_role == TTXContextRole.FACILITATOR.value
            and current_index is not None
            and not over
            else None
        ),
        rooms=_rooms_read(
            rooms,
            log,
            viewer,
            player=player,
            control=can_control,
            default_room=None if player else _team_default_room(session, ttx, rooms, viewer),
        )
        if rooms is not None
        else None,
        decisions=_decisions_read(session, log, viewer, places),
        polls=_polls_read(
            log, viewer if player else None, places, hide_results=player, meters=msel_meters
        ),
        meters=[] if player and not log.meters_shown else meters_read(log, msel_meters, places),
        meters_shown=log.meters_shown,
    )
    return view, log, rooms


# -- a Player's view, shared ------------------------------------------------
#
# Every ring sends every Player for their view; with hundreds at the table,
# building each one whole made a change cost the table squared
# (docs/deployment.md, section 10). A Player's view is the same for every
# Player seated in the same room except what is theirs -- the decisions
# they took, their own vote, where they are -- so a process builds the
# shared part once per change and room, and marks what is the viewer's.


@dataclass
class _SharedPlayerView:
    view: RunRead
    log: _Log
    rooms: "_Rooms | None"
    seats: dict = field(default_factory=dict)
    where: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.rooms is not None:
            self.seats = {seat.user_id: seat for seat in self.rooms.seats}
            self.where = {
                seat.user_id: self.rooms.location(seat, self.log) for seat in self.rooms.seats
            }


# Key -> (when built, the shared view); the oldest go first.
_shared_views: "OrderedDict[tuple, tuple[float, _SharedPlayerView]]" = OrderedDict()
_SHARED_VIEWS_MAX = 256


def player_view(session: Session, ttx: TTX, run: ExerciseRun | None, viewer: User) -> RunRead:
    """`viewer`'s view as a Player: the part their room's Players share,
    built at most once per change per process (cached for
    RUN_VIEW_CACHE_SECONDS, the most a change that leaves no trace in the
    log -- a room renamed, a Player seated mid-session -- waits), then
    marked with what is theirs."""
    from app.core.security import ttx_access_of

    access = ttx_access_of(session, viewer.id, ttx.id)
    room = str(access.room_id) if access is not None and access.room_id else None
    key = (
        ttx.id,
        run.id if run else None,
        run.last_seq if run else 0,
        run.status if run else None,
        run.paused_at if run else None,
        run.inject_timer_at if run else None,
        run.real_world_at if run else None,
        room,
        view_cursor(session, ttx, run, TTXContextRole.PLAYER.value),
    )
    ttl = settings.RUN_VIEW_CACHE_SECONDS
    now = time.monotonic()
    hit = _shared_views.get(key)
    if ttl > 0 and hit is not None and now - hit[0] < ttl:
        shared = hit[1]
    else:
        view, log, rooms = _build_view(
            session,
            ttx,
            run,
            can_control=False,
            viewer_role=TTXContextRole.PLAYER.value,
            seat_room_id=room,
        )
        shared = _SharedPlayerView(view=view, log=log, rooms=rooms)
        if ttl > 0:
            _shared_views[key] = (now, shared)
            _shared_views.move_to_end(key)
            while len(_shared_views) > _SHARED_VIEWS_MAX:
                _shared_views.popitem(last=False)
    return _personalize(shared, viewer)


def _personalize(shared: _SharedPlayerView, viewer: User) -> RunRead:
    """The shared view with what is `viewer`'s: their decisions, their
    vote, their room and where they are."""
    view = shared.view
    update: dict = {
        "decisions": [
            decision.model_copy(
                update={"mine": shared.log.decisions[decision.id].author_id == viewer.id}
            )
            for decision in view.decisions
        ],
        "polls": [
            poll.model_copy(update={"my_vote": shared.log.polls[poll.id].votes.get(str(viewer.id))})
            for poll in view.polls
        ],
    }
    if view.rooms is not None:
        seat = shared.seats.get(viewer.id)
        room = seat.room if seat else None
        update["rooms"] = view.rooms.model_copy(
            update={
                "me": RunMeRead(
                    room_code=room["code"] if room else None,
                    room_name=room["name"] if room else None,
                    location=shared.where.get(viewer.id, "main"),
                ),
                "rooms": [r for r in view.rooms.rooms if room and r.code == room["code"]],
            }
        )
    return view.model_copy(update=update)


# -- the table's decisions and votes ---------------------------------------
#
# Both live in the execution log, so every screen picks them up with the
# rest of the session. A decision is taken on an inject (the one in play
# by default) and, in rooms, in a room: a Player's is where they are, a
# team member's the room they look at. Votes are put by a Facilitator or a
# Controller and stay anonymous: the view gives the tally, never who.

MAIN_ROOM = "main"
RECORDERS = (
    TTXContextRole.PLAYER.value,
    TTXContextRole.FACILITATOR.value,
    TTXContextRole.CONTROLLER.value,
)
MODERATORS = (TTXContextRole.FACILITATOR.value, TTXContextRole.CONTROLLER.value)


def _place(
    session: Session, ttx: TTX, run: ExerciseRun, log: _Log, user: User, role: str, room_code
) -> tuple["_Rooms | None", str | None]:
    """The rooms (None without) and the room something is taken in."""
    rooms = _rooms(session, ttx, _payload(session, run))
    if rooms is None:
        return None, None
    if role == TTXContextRole.PLAYER.value:
        seat = next((s for s in rooms.seats if s.user_id == user.id), None)
        if seat is None or seat.room is None or rooms.location(seat, log) == MAIN_ROOM:
            return rooms, MAIN_ROOM
        return rooms, seat.room["code"]
    if not room_code or room_code == MAIN_ROOM:
        return rooms, MAIN_ROOM
    if room_code not in rooms.by_code:
        raise AppException("ROOM_NOT_FOUND", "No such room in this exercise.", 404)
    return rooms, room_code


def _in_play(session: Session, run: ExerciseRun, log: _Log, rooms, where: str | None):
    """The inject in play where it's taken: the latest released (in a
    team room, the latest played there; in the main room, the one on its
    screen, else the last shown). After ENDEX, ENDEX: the hot wash."""
    if log.endex is not None:
        return ENDEX_CODE
    released = list(log.released)
    if rooms is None:
        return released[-1] if released else None
    if where == MAIN_ROOM:
        return log.projected or (log.projected_history[-1] if log.projected_history else None)
    by_code = {i["code"]: i for i in _payload(session, run)["injects"]}
    room = rooms.by_code[where]
    played = [c for c in released if c in by_code and _played_in(by_code[c], room)]
    return played[-1] if played else None


def _seen(log: _Log) -> set[str]:
    """The injects the table has seen, ENDEX included once it's out."""
    return set(log.released) | ({ENDEX_CODE} if log.endex else set())


def record_decision(
    session: Session,
    ttx: TTX,
    user: User,
    role: str,
    text: str,
    inject_code: str = "",
    room_code: str | None = None,
) -> None:
    """A decision of the table, on an inject it has seen (the one in play
    unless named), until the session ends -- the hot wash's too, on ENDEX."""
    if role not in RECORDERS:
        raise AppException("NOT_ACTING_AS", "Only Players and the team record decisions.", 403)
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    log = _log(session, run)
    rooms, where = _place(session, ttx, run, log, user, role, room_code)
    code = inject_code or _in_play(session, run, log, rooms, where)
    if not code or code not in _seen(log):
        raise _refuse("INJECT_NOT_RELEASED", "Decisions go on an inject the table has seen.")
    _append(
        session,
        run,
        RunEventType.DECISION_RECORDED,
        user,
        decision_id=str(uuid.uuid4()),
        text=text.strip(),
        inject_code=code,
        room_code=where,
        role=role,
    )
    session.commit()


def _own_decision(session: Session, ttx: TTX, user: User, role: str, decision_id: str):
    if role not in RECORDERS:
        raise AppException("NOT_ACTING_AS", "Only Players and the team record decisions.", 403)
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    log = _log(session, run)
    decision = log.decisions.get(decision_id)
    if decision is None:
        raise AppException("DECISION_NOT_FOUND", "No such decision.", 404)
    if decision.author_id != user.id and role not in MODERATORS:
        raise AppException("DECISION_NOT_YOURS", "Only its author or the team change it.", 403)
    return run


def edit_decision(
    session: Session, ttx: TTX, user: User, role: str, decision_id: str, text: str
) -> None:
    run = _own_decision(session, ttx, user, role, decision_id)
    _append(
        session, run, RunEventType.DECISION_EDITED, user, decision_id=decision_id, text=text.strip()
    )
    session.commit()


def delete_decision(session: Session, ttx: TTX, user: User, role: str, decision_id: str) -> None:
    run = _own_decision(session, ttx, user, role, decision_id)
    _append(session, run, RunEventType.DECISION_DELETED, user, decision_id=decision_id)
    session.commit()


def open_poll(
    session: Session,
    ttx: TTX,
    user: User,
    question: str,
    options: list[str],
    room_code: str | None = None,
) -> None:
    """A question put to the Players' vote, on the inject in play (ENDEX
    during the hot wash); several may be open at once."""
    run = _open_run(session, ttx)
    log = _log(session, run)
    options = [o.strip() for o in options]
    if len({o.casefold() for o in options}) < len(options):
        raise _refuse("POLL_OPTIONS_REPEATED", "Each option must be different.", 422)
    rooms, where = _place(session, ttx, run, log, user, TTXContextRole.CONTROLLER.value, room_code)
    code = _in_play(session, run, log, rooms, where)
    if not code:
        raise _refuse("INJECT_NOT_RELEASED", "Votes go on an inject the table has seen.")
    _append(
        session,
        run,
        RunEventType.POLL_OPENED,
        user,
        poll_id=str(uuid.uuid4()),
        question=question.strip(),
        options=options,
        inject_code=code,
        room_code=where,
    )
    session.commit()


def _open_planned_poll(
    session: Session, run: ExerciseRun, user: User, inject: dict, room_code: str | None
) -> None:
    """A poll of the MSEL opens with its inject, one per room it's played
    in: each room decides on its own."""
    _append(
        session,
        run,
        RunEventType.POLL_OPENED,
        user,
        poll_id=str(uuid.uuid4()),
        question=inject["poll_question"],
        options=inject["poll_options"],
        outcomes=inject.get("poll_outcomes", []),
        impacts=inject.get("poll_impacts", []),
        inject_code=inject["code"],
        room_code=room_code,
        planned=True,
    )


def _any_poll(log: _Log, poll_id: str) -> _Poll:
    poll = log.polls.get(poll_id)
    if poll is None:
        raise AppException("POLL_NOT_FOUND", "No such vote.", 404)
    return poll


def _poll(log: _Log, poll_id: str) -> _Poll:
    poll = _any_poll(log, poll_id)
    if not poll.open:
        raise _refuse("POLL_CLOSED", "This vote is closed.")
    return poll


def _option(poll: _Poll, option: int) -> None:
    if option >= len(poll.options):
        raise _refuse("POLL_UNKNOWN_OPTION", "No such option.", 422)


def cast_vote(session: Session, ttx: TTX, user: User, poll_id: str, option: int) -> None:
    """A Player's vote; a new one replaces theirs while the vote is open.
    In rooms, only the room it was put to votes."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    log = _log(session, run)
    poll = _poll(log, poll_id)
    _option(poll, option)
    _, where = _place(session, ttx, run, log, user, TTXContextRole.PLAYER.value, None)
    if where != poll.room_code:
        raise AppException("POLL_NOT_YOUR_ROOM", "This vote is for another room.", 403)
    _append(session, run, RunEventType.VOTE_CAST, user, poll_id=poll_id, option=option)
    session.commit()


def close_poll(
    session: Session,
    ttx: TTX,
    user: User,
    role: str,
    poll_id: str,
    record_option: int | None,
    outcome_option: int | None = None,
) -> None:
    """Close a vote; `record_option` records that option as the table's
    decision, on the vote's inject and room, and `outcome_option` is the one
    whose consequence the table gets."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    log = _log(session, run)
    poll = _poll(log, poll_id)
    if record_option is not None:
        _option(poll, record_option)
    if outcome_option is not None:
        _option(poll, outcome_option)
    _append(
        session,
        run,
        RunEventType.POLL_CLOSED,
        user,
        poll_id=poll_id,
        outcome_option=outcome_option,
    )
    if record_option is not None:
        _append(
            session,
            run,
            RunEventType.DECISION_RECORDED,
            user,
            decision_id=str(uuid.uuid4()),
            text=poll.options[record_option],
            inject_code=poll.inject_code,
            room_code=poll.room_code,
            role=role,
            poll_id=poll_id,
        )
    session.commit()


def show_meters(session: Session, ttx: TTX, user: User, shown: bool) -> None:
    """The Controller's choice: show the impact meters' summary to the
    Players, or hide it again."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED, RunStatus.ENDED)
    if _log(session, run).meters_shown != shown:
        _append(session, run, RunEventType.METERS_SHOWN, user, shown=shown)
        session.commit()


def run_log(session: Session, run: ExerciseRun) -> _Log:
    """A run's log folded into what happened, for readers of a whole
    session (the AI assistant's session record)."""
    return _log(session, run)


def run_meters(session: Session, ttx: TTX, run_id: uuid.UUID | None) -> list[RunMeterGroupRead]:
    """The meters of a run, for the after-action report: the current one,
    or a previous one by id."""
    run = run_of(session, ttx, run_id) if run_id is not None else started_run(session, ttx)
    snapshot = session.get(MselSnapshot, run.msel_snapshot_id)
    return meters_read(_log(session, run), snapshot.payload.get("meters", []), None)


def show_poll_results(session: Session, ttx: TTX, user: User, poll_id: str, shown: bool) -> None:
    """The Controller's choice: show a closed poll's result to the Players,
    or hide it again. Never while it's open, so it can't sway the vote."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED, RunStatus.ENDED)
    poll = _any_poll(_log(session, run), poll_id)
    if not poll.planned:
        raise _refuse("POLL_NOT_PLANNED", "This vote's tally is always visible.")
    if poll.open:
        raise _refuse("POLL_STILL_OPEN", "Close the poll before showing its result.")
    if poll.results_shown != shown:
        _append(session, run, RunEventType.POLL_RESULTS_SHOWN, user, poll_id=poll_id, shown=shown)
        session.commit()


def decision_log(session: Session, run: ExerciseRun) -> tuple[list[_Decision], list[_Poll]]:
    """The run's decisions as they stand and its votes, in order (for the
    exports and the after-action report)."""
    log = _log(session, run)
    return list(log.decisions.values()), list(log.polls.values())


def _decisions_read(
    session: Session, log: _Log, viewer: User | None, places: set | None
) -> list[RunDecisionRead]:
    shown = [d for d in log.decisions.values() if places is None or d.room_code in places]
    names = (
        {
            u.id: u.full_name
            for u in session.exec(select(User).where(User.id.in_({d.author_id for d in shown})))
        }
        if shown
        else {}
    )
    return [
        RunDecisionRead(
            id=d.id,
            text=d.text,
            inject_code=d.inject_code,
            room_code=d.room_code,
            author=names.get(d.author_id, ""),
            role=d.role,
            at=d.at,
            edited=d.edited,
            poll_id=d.poll_id,
            mine=viewer is not None and d.author_id == viewer.id,
        )
        for d in shown
    ]


def _polls_read(
    log: _Log, player: User | None, places: set | None, hide_results: bool, meters: list[dict]
) -> list[RunPollRead]:
    """Every vote, with its tally; `player` gets their own vote back.
    `hide_results` (a Player's view): a planned poll's tally doesn't leave
    the server until the Controller shows it."""
    result = []
    for poll in log.polls.values():
        if places is not None and poll.room_code not in places:
            continue
        visible = not poll.planned or poll.results_shown
        tally = Counter(poll.votes.values()) if visible or not hide_results else Counter()
        settled = None if poll.open or (hide_results and not visible) else poll.outcome_option
        outcome = _outcome_text(poll, settled)
        result.append(
            RunPollRead(
                id=poll.id,
                question=poll.question,
                options=[
                    RunPollOptionRead(
                        text=text,
                        votes=tally[index],
                        outcome=None if hide_results else _outcome_text(poll, index),
                        impacts=[] if hide_results else _impacts_read(poll, index, meters),
                    )
                    for index, text in enumerate(poll.options)
                ],
                inject_code=poll.inject_code,
                room_code=poll.room_code,
                open=poll.open,
                voters=len(poll.votes),
                my_vote=poll.votes.get(str(player.id)) if player else None,
                decision_id=poll.decision_id,
                planned=poll.planned,
                results_visible=visible,
                outcome_option=settled if outcome else None,
                outcome=outcome,
            )
        )
    return result


def _impacts_read(poll: _Poll, option: int, meters: list[dict]) -> list[RunPollImpactRead]:
    impacts = poll.impacts[option] if option < len(poll.impacts) else {}
    return [
        RunPollImpactRead(name=meter["name"], level=impacts[meter["key"]])
        for meter in meters
        if impacts.get(meter["key"])
    ]


def meters_read(log: _Log, meters: list[dict], places: set | None) -> list[RunMeterGroupRead]:
    """What the decisions add up to on each meter, per place. Each poll the
    table settled counts, with the most it could have added: the options
    are what was on the table, and a poll never reached isn't held against
    anyone."""
    if not meters:
        return []
    settled: dict[str | None, list[_Poll]] = {}
    for poll in log.polls.values():
        if places is not None and poll.room_code not in places:
            continue
        if poll.planned and poll.impacts and poll.outcome_option is not None:
            settled.setdefault(poll.room_code, []).append(poll)
    return [
        RunMeterGroupRead(
            room_code=place,
            decisions=len(polls),
            meters=[
                RunMeterRead(
                    key=meter["key"],
                    name=meter["name"],
                    total=sum(
                        p.impacts[p.outcome_option].get(meter["key"], 0)
                        for p in polls
                        if p.outcome_option < len(p.impacts)
                    ),
                    most=sum(max(row.get(meter["key"], 0) for row in p.impacts) for p in polls),
                )
                for meter in meters
            ],
        )
        for place, polls in settled.items()
    ]


def _outcome_text(poll: _Poll, option: int | None) -> str | None:
    """What follows an option, if anything does."""
    if option is None or option >= len(poll.outcomes):
        return None
    return poll.outcomes[option].strip() or None


# -- rooms ----------------------------------------------------------------
#
# An exercise played in rooms (frozen in the MSEL snapshot: `uses_rooms`,
# `rooms`, each inject's `room_ids`) plays each inject in its rooms only.
# Seats are read live (TTXAccess.room_id) so a late Player can be seated
# mid-session; room names too (a room may be renamed). The Controller moves
# Players between their room and the main room and projects any delivered
# inject there.


@dataclass
class _Seat:
    user_id: uuid.UUID
    name: str
    room: dict | None  # the snapshot's room ({id, code, name}), or none


@dataclass
class _Rooms:
    rooms: list[dict]
    by_code: dict[str, dict]
    seats: list[_Seat]

    def location(self, seat: _Seat, log: _Log) -> str:
        if seat.room is None:
            return "main"
        return log.location.get(str(seat.user_id), "room")


def _rooms(session: Session, ttx: TTX, msel: dict) -> _Rooms | None:
    if not msel.get("uses_rooms"):
        return None
    live = {
        str(r.id): r.name for r in session.exec(select(TTXRoom).where(TTXRoom.ttx_id == ttx.id))
    }
    rooms = [
        {**r, "id": str(r["id"]), "name": live.get(str(r["id"]), r["name"])}
        for r in msel.get("rooms", [])
    ]
    by_id = {r["id"]: r for r in rooms}
    seats = [
        _Seat(user_id=user.id, name=user.full_name, room=by_id.get(str(access.room_id)))
        for access, user in session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == ttx.id, TTXAccess.role == RoleEnum.PLAYER)
            .order_by(User.full_name)
        )
    ]
    return _Rooms(rooms=rooms, by_code={r["code"]: r for r in rooms}, seats=seats)


def _played_in(inject: dict, room: dict) -> bool:
    aimed = [str(r) for r in inject.get("room_ids", [])]
    return not aimed or room["id"] in aimed


def _player_feed(rooms: _Rooms, seat: _Seat | None, log: _Log, delivered: list[dict]) -> list[dict]:
    """What a Player sees: the delivered injects of their room, and every
    one projected in the main room."""
    shown = set(log.projected_history)
    return [
        i
        for i in delivered
        if i["code"] in shown or (seat and seat.room and _played_in(i, seat.room))
    ]


def _team_default_room(
    session: Session, ttx: TTX, rooms: _Rooms | None, viewer: User | None
) -> str | None:
    """The code of the room a team member's view opens on (Creator ->
    Exercise -> Rooms), if they have one in this session's rooms."""
    if rooms is None or viewer is None:
        return None
    access = session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == viewer.id)
    ).first()
    if access is None or access.room_id is None or access.role == RoleEnum.PLAYER:
        return None
    room = next((r for r in rooms.rooms if r["id"] == str(access.room_id)), None)
    return room["code"] if room else None


def _rooms_read(
    rooms: _Rooms,
    log: _Log,
    viewer: User | None,
    *,
    player: bool,
    control: bool,
    default_room: str | None = None,
) -> RunRoomsRead:
    where = {seat.user_id: rooms.location(seat, log) for seat in rooms.seats}
    room_reads = [
        RunRoomRead(
            code=r["code"],
            name=r["name"],
            players=sum(1 for s in rooms.seats if s.room is r),
            in_main=sum(1 for s in rooms.seats if s.room is r and where[s.user_id] == "main"),
        )
        for r in rooms.rooms
    ]
    me = None
    if player and viewer is not None:
        seat = next((s for s in rooms.seats if s.user_id == viewer.id), None)
        room = seat.room if seat else None
        me = RunMeRead(
            room_code=room["code"] if room else None,
            room_name=room["name"] if room else None,
            location=where.get(viewer.id, "main"),
        )
        room_reads = [r for r in room_reads if room and r.code == room["code"]]
    return RunRoomsRead(
        rooms=room_reads,
        main_projected=log.projected,
        main_history=log.projected_history,
        in_main=sum(1 for location in where.values() if location == "main"),
        me=me,
        default_room_code=default_room,
        players=[
            RunRoomPlayerRead(
                user_id=s.user_id,
                name=s.name,
                room_code=s.room["code"] if s.room else None,
                location=where[s.user_id],
            )
            for s in rooms.seats
        ]
        if control
        else None,
    )


def _rooms_or_refuse(session: Session, ttx: TTX, run: ExerciseRun) -> _Rooms:
    rooms = _rooms(session, ttx, _payload(session, run))
    if rooms is None:
        raise _refuse("ROOMS_NOT_USED", "This exercise is played at one table.")
    return rooms


def move_players(
    session: Session,
    ttx: TTX,
    user: User,
    to: str,
    user_ids: list[uuid.UUID] | None,
    room_code: str | None,
) -> None:
    """Players to the main room or back to their room: these, a room's or
    everyone. A Player without a room is always in the main room."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    rooms = _rooms_or_refuse(session, ttx, run)
    seats = rooms.seats
    if user_ids is not None:
        by_id = {s.user_id: s for s in seats}
        if any(u not in by_id for u in user_ids):
            raise AppException("NOT_ON_EXERCISE", "This person isn't a Player here.", 404)
        seats = [by_id[u] for u in user_ids]
        if to == "room" and any(s.room is None for s in seats):
            raise _refuse("PLAYER_WITHOUT_ROOM", "This Player has no room yet: seat them first.")
    elif room_code is not None:
        room = rooms.by_code.get(room_code)
        if room is None:
            raise AppException("ROOM_NOT_FOUND", "No such room in this exercise.", 404)
        seats = [s for s in seats if s.room is room]
    seated = [str(s.user_id) for s in seats if s.room is not None]
    if not seated:
        return
    _append(session, run, RunEventType.PLAYERS_MOVED, user, user_ids=seated, to=to)
    session.commit()


def project_inject(session: Session, ttx: TTX, user: User, code: str | None) -> None:
    """Show a delivered inject in the main room, or nothing."""
    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    _rooms_or_refuse(session, ttx, run)
    log = _log(session, run)
    inject = None
    if code is not None:
        inject = _inject(_payload(session, run), code)
        if code not in log.released:
            raise _refuse("INJECT_NOT_RELEASED", "Only a delivered inject can be projected.")
    _append(session, run, RunEventType.MAIN_PROJECTED, user, inject_code=code)
    # A poll on the main room's screen is put to the Players there too.
    if (
        inject is not None
        and _format(inject) == InjectFormat.POLL.value
        and log.endex is None
        and not any(
            p.inject_code == code and p.room_code == MAIN_ROOM and p.planned
            for p in log.polls.values()
        )
    ):
        _open_planned_poll(session, run, user, inject, MAIN_ROOM)
    session.commit()


def seat_players(
    session: Session, ttx: TTX, user: User, assignments: list[tuple[uuid.UUID, str | None]]
) -> None:
    """Seat Players from the Control center, by room code (the session's
    rooms); see note_seating."""
    from app.schemas.ttx_room import RoomAssignment
    from app.services.ttx_room_service import set_assignments

    run = _open_run(session, ttx, RunStatus.LIVE, RunStatus.PAUSED)
    rooms = _rooms_or_refuse(session, ttx, run)
    resolved = []
    for user_id, code in assignments:
        if code is not None and code not in rooms.by_code:
            raise AppException("ROOM_NOT_FOUND", "No such room in this exercise.", 404)
        resolved.append(
            RoomAssignment(
                user_id=user_id, room_id=uuid.UUID(rooms.by_code[code]["id"]) if code else None
            )
        )
    set_assignments(session, ttx, resolved, user)


def note_seating(session: Session, ttx: TTX, user: User, user_ids: list[uuid.UUID]) -> None:
    """Seats changed while the session runs: in the log (everyone's view
    follows), each Player off to their new room. No commit."""
    run = find_run(session, ttx.id, lock=True)
    if run is None or run.status not in (RunStatus.LIVE, RunStatus.PAUSED):
        return
    _append(
        session,
        run,
        RunEventType.PLAYERS_SEATED,
        user,
        assignments=[{"user_id": str(u)} for u in user_ids],
    )


def _facilitation(
    phases: list[dict], delivered: list[dict], current_index: int, log: _Log
) -> RunFacilitationRead:
    phase = phases[current_index]
    in_play = delivered[-1] if delivered else None
    return RunFacilitationRead(
        phase_code=phase["code"],
        phase_name=phase["name"],
        key_questions=phase["key_questions"],
        released_questions=sorted(log.asked.get((phase["code"], None), set())),
        covered_questions=sorted(log.covered.get((phase["code"], None), set())),
        question_places=_question_places(log, phase["code"]),
        inject_code=in_play["code"] if in_play else None,
        facilitator_notes=in_play["facilitator_notes"] if in_play else "",
    )


def acting_role(session: Session, user: User, ttx: TTX, requested: str | None) -> str | None:
    """`requested` if the user takes part in this exercise's session as it.
    On the public face only ever the Player (app.core.surface)."""
    if requested not in ACTING_ROLES:
        return None
    if surface.is_public() and requested != TTXContextRole.PLAYER.value:
        return None
    from app.core.security import ttx_access_of

    access = ttx_access_of(session, user.id, ttx.id)
    return requested if access is not None and requested in access.context_roles() else None


def touch_presence(session: Session, ttx: TTX, user: User, role: str) -> None:
    row = session.exec(
        select(RunPresence).where(
            RunPresence.ttx_id == ttx.id, RunPresence.user_id == user.id, RunPresence.role == role
        )
    ).first()
    now = datetime.now(UTC)
    if row is None:
        row = RunPresence(ttx_id=ttx.id, user_id=user.id, role=role)
    elif row.last_seen_at > now - PRESENCE_TOUCH_INTERVAL:
        return  # still fresh: no write on every fetch
    row.last_seen_at = now
    session.add(row)
    session.commit()


# Exercise id -> (when read, [(role, name)]): who is present, read once per
# RUN_PRESENCE_CACHE_SECONDS per process rather than by every fetch.
_present_cache: dict[uuid.UUID, tuple[float, list[tuple[str, str]]]] = {}


def _present(session: Session, ttx: TTX) -> list[tuple[str, str]]:
    # Once per request whatever the process cache says (a fetch asks for it
    # for the cursor, the cache key and the view).
    from app.core.security import request_memo

    memo = request_memo(session).setdefault("present", {})
    if ttx.id in memo:
        return memo[ttx.id]
    ttl = settings.RUN_PRESENCE_CACHE_SECONDS
    now = time.monotonic()
    hit = _present_cache.get(ttx.id)
    if ttl > 0 and hit is not None and now - hit[0] < ttl:
        memo[ttx.id] = hit[1]
        return hit[1]
    since = datetime.now(UTC) - PRESENCE_WINDOW
    rows = [
        (row.role, user.full_name)
        for row, user in session.exec(
            select(RunPresence, User)
            .join(User, User.id == RunPresence.user_id)
            .where(RunPresence.ttx_id == ttx.id, RunPresence.last_seen_at >= since)
            .order_by(RunPresence.role, User.full_name)
        ).all()
    ]
    if ttl > 0:
        if len(_present_cache) > 1000:
            _present_cache.clear()
        _present_cache[ttx.id] = (now, rows)
    memo[ttx.id] = rows
    return rows


def presence(session: Session, ttx: TTX, viewer_role: str | None) -> list[RunPresenceRead]:
    """Who is on the Playground now, by role. A Player sees the Players'
    names -- at most PRESENCE_NAMES_MAX -- and the team only as roles; how
    many of each role there are is presence_counts."""
    player = viewer_role == TTXContextRole.PLAYER.value
    present: list[RunPresenceRead] = []
    named = 0
    for role, name in _present(session, ttx):
        if not player:
            present.append(RunPresenceRead(role=role, name=name))
        elif role != TTXContextRole.PLAYER.value:
            present.append(RunPresenceRead(role=role, name=None))
        elif named < PRESENCE_NAMES_MAX:
            named += 1
            present.append(RunPresenceRead(role=role, name=name))
    return present


def presence_counts(session: Session, ttx: TTX) -> dict[str, int]:
    """How many are present, by role."""
    return dict(Counter(role for role, _ in _present(session, ttx)))


def cursor(
    run: ExerciseRun | None, present: list[RunPresenceRead], counts: dict[str, int] | None = None
) -> str:
    """The log's position plus which run and who is here: changes when any
    does (a new run starts its log again from 1)."""
    who = f"{run.id if run else ''}|" + "|".join(f"{p.role}:{p.name}" for p in present)
    who += "|" + ",".join(f"{role}={n}" for role, n in sorted((counts or {}).items()))
    seq = run.last_seq if run else 0
    return f"{seq}.{hashlib.sha256(who.encode()).hexdigest()[:12]}"


def view_cursor(
    session: Session, ttx: TTX, run: ExerciseRun | None, viewer_role: str | None
) -> str:
    """The cursor the viewer's view would carry, without building it."""
    return cursor(run, presence(session, ttx, viewer_role), presence_counts(session, ttx))


def _note_read(note: RunNote) -> RunNoteRead:
    return RunNoteRead(
        id=note.id,
        inject_code=note.inject_code,
        room_code=note.room_code,
        text=note.text,
        updated_at=note.updated_at,
    )


def _this_run(session: Session, ttx: TTX):
    """The notes of the current run, or the ones written while waiting
    for the first start (or a restart)."""
    run = find_run(session, ttx.id)
    return (RunNote.ttx_id == ttx.id) & (
        RunNote.run_id == run.id if run is not None else RunNote.run_id.is_(None)
    )


def _note_place(
    session: Session, ttx: TTX, user: User, role: str, inject_code: str, room_code: str | None
) -> str:
    """The room a note is about: in rooms, a team member's on an inject.
    The general note is about the whole session, and a Player's are theirs
    alone, wherever they were."""
    run = find_run(session, ttx.id)
    if run is None or not inject_code or role == TTXContextRole.PLAYER.value:
        return ""
    _, where = _place(session, ttx, run, _log(session, run), user, role, room_code)
    return where or ""


def my_notes(
    session: Session, ttx: TTX, user: User, role: str, room_code: str | None = None
) -> list[RunNoteRead]:
    """The caller's notes as `role`: in rooms, a team member's on one place,
    with their general note."""
    place = _note_place(session, ttx, user, role, "any", room_code)
    return [
        _note_read(note)
        for note in session.exec(
            select(RunNote)
            .where(
                _this_run(session, ttx),
                RunNote.author_id == user.id,
                RunNote.role == role,
                (RunNote.room_code == place) | (RunNote.inject_code == ""),
            )
            .order_by(RunNote.inject_code)
        )
    ]


def save_note(
    session: Session,
    ttx: TTX,
    user: User,
    role: str,
    inject_code: str,
    text: str,
    room_code: str | None = None,
) -> list[RunNoteRead]:
    """Write (or, empty, delete) the user's note as `role` on an inject the
    table has seen, or their general note (`inject_code` "")."""
    run = find_run(session, ttx.id)
    log = _log(session, run)
    seen = set(log.released) | ({ENDEX_CODE} if log.endex else set())
    if inject_code and (run is None or inject_code not in seen):
        raise _refuse("INJECT_NOT_RELEASED", "Notes go on an inject the table has seen.")
    place = _note_place(session, ttx, user, role, inject_code, room_code)
    note = session.exec(
        select(RunNote).where(
            _this_run(session, ttx),
            RunNote.author_id == user.id,
            RunNote.role == role,
            RunNote.inject_code == inject_code,
            RunNote.room_code == place,
        )
    ).first()
    if not text.strip():
        if note is not None:
            session.delete(note)
    else:
        if note is None:
            note = RunNote(
                ttx_id=ttx.id,
                run_id=run.id if run else None,
                author_id=user.id,
                role=role,
                inject_code=inject_code,
                room_code=place,
            )
        note.text = text
        note.updated_at = datetime.now(UTC)
        session.add(note)
    session.commit()
    return my_notes(session, ttx, user, role)


def team_notes(
    session: Session, ttx: TTX, run_id: uuid.UUID | None = None
) -> list[RunTeamNoteRead]:
    """Every note but the Players' own: what the team saw, for the hot
    wash and the report. `run_id` names one of the exercise's runs
    (a previous one, for a report written from it); else the current."""
    scope = (
        (RunNote.ttx_id == ttx.id) & (RunNote.run_id == run_of(session, ttx, run_id).id)
        if run_id is not None
        else _this_run(session, ttx)
    )
    return [
        RunTeamNoteRead(
            author=author.full_name,
            role=note.role,
            inject_code=note.inject_code,
            room_code=note.room_code,
            text=note.text,
            updated_at=note.updated_at,
        )
        for note, author in session.exec(
            select(RunNote, User)
            .join(User, User.id == RunNote.author_id)
            .where(scope, RunNote.role != TTXContextRole.PLAYER.value)
            .order_by(RunNote.inject_code, RunNote.updated_at)
        )
    ]


def forget_participant(session: Session, user: User) -> None:
    """A closing account takes its private notes (a Player's) and its
    presence with it; what it wrote for the team stays, unsigned."""
    for note in session.exec(
        select(RunNote).where(
            RunNote.author_id == user.id, RunNote.role == TTXContextRole.PLAYER.value
        )
    ):
        session.delete(note)
    for row in session.exec(select(RunPresence).where(RunPresence.user_id == user.id)):
        session.delete(row)
    # Who answered the feedback form goes; the anonymous answer stays.
    for row in session.exec(
        select(RunFeedbackSubmission).where(RunFeedbackSubmission.user_id == user.id)
    ):
        session.delete(row)


def _released_injects(
    session: Session,
    run: ExerciseRun | None,
    *,
    everything: bool,
    ttx: TTX | None = None,
    player: User | None = None,
) -> list[dict]:
    """The injects of the MSEL being played whose media a participant may
    load: those delivered -- or, for a Controller (`everything`), all of
    them. In rooms, a Player (`player`, with `ttx`) only those they were
    shown."""
    if run is None:
        return []
    log = _log(session, run)
    msel = _payload(session, run)
    if everything:
        return list(msel["injects"])
    shown = set(log.released)
    rooms = _rooms(session, ttx, msel) if ttx is not None and player is not None else None
    if rooms is not None:
        seat = next((s for s in rooms.seats if s.user_id == player.id), None)
        delivered = [i for i in msel["injects"] if i["code"] in log.released]
        shown = {i["code"] for i in _player_feed(rooms, seat, log, delivered)}
    return [inject for inject in msel["injects"] if inject["code"] in shown]


def released_image_ids(
    session: Session,
    run: ExerciseRun | None,
    *,
    all_images: bool,
    ttx: TTX | None = None,
    player: User | None = None,
) -> set[str]:
    """Images a participant may load (see `_released_injects`)."""
    injects = _released_injects(session, run, everything=all_images, ttx=ttx, player=player)
    return {image["id"] for inject in injects for image in inject.get("images", [])}


def released_file_ids(
    session: Session,
    run: ExerciseRun | None,
    *,
    all_files: bool,
    ttx: TTX | None = None,
    player: User | None = None,
) -> set[str]:
    """Inject files a participant may download (see `_released_injects`)."""
    injects = _released_injects(session, run, everything=all_files, ttx=ttx, player=player)
    return {file["id"] for inject in injects for file in inject.get("files", [])}


def _evaluator_access(session: Session, ttx: TTX, user: User) -> TTXAccess:
    access = session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == user.id)
    ).first()
    if access is None or not access.is_evaluator:
        raise AppException("TTX_ACCESS_DENIED", "Only the exercise's Evaluators rate it.", 403)
    return access


def _rated_objectives(plan: dict, user: User, lead: bool) -> list[dict]:
    """The EEGs an Evaluator rates: those assigned to them in the plan --
    every one, for the Lead Evaluator."""
    if lead:
        return plan["eeg"]
    assigned = {
        str(objective_id)
        for evaluator in plan["evaluators"]
        if str(evaluator["user_id"]) == str(user.id)
        for objective_id in evaluator["objective_ids"]
    }
    return [eeg for eeg in plan["eeg"] if str(eeg["id"]) in assigned]


def run_of(session: Session, ttx: TTX, run_id: uuid.UUID) -> ExerciseRun:
    """One of the exercise's runs, current or previous."""
    run = session.get(ExerciseRun, run_id)
    if run is None or run.ttx_id != ttx.id:
        raise AppException("RUN_NOT_FOUND", "No such session for this exercise.", 404)
    return run


def started_run(session: Session, ttx: TTX) -> ExerciseRun:
    run = find_run(session, ttx.id)
    if run is None:
        raise _refuse("RUN_NOT_STARTED", "The session hasn't started.")
    return run


def _rating_place(
    session: Session, ttx: TTX, run: ExerciseRun, log: _Log, user: User, room_code: str | None
) -> tuple["_Rooms | None", str]:
    """The rooms and the place a rating is about ("" without rooms)."""
    rooms, where = _place(session, ttx, run, log, user, "evaluator", room_code)
    return rooms, where or ""


def evaluation(
    session: Session, ttx: TTX, user: User, room_code: str | None = None
) -> RunEvaluationRead:
    """The Evaluator's EEG for the session (the plan it plays), with what
    the Controller saw of each expected action and their own ratings -- in
    rooms, of one place."""
    access = _evaluator_access(session, ttx, user)
    run = started_run(session, ttx)
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    log = _log(session, run)
    _, place = _rating_place(session, ttx, run, log, user, room_code)
    ratings = {
        str(r.point_id): r
        for r in session.exec(
            select(RunRating).where(
                RunRating.run_id == run.id,
                RunRating.evaluator_id == user.id,
                RunRating.room_code == place,
            )
        )
    }

    def point(p: dict) -> RunPointRead:
        mark, note, _ = log.marks.get(p["source_action_code"], (None, "", None))
        rating = ratings.get(str(p["id"]))
        return RunPointRead(
            id=p["id"],
            kind=p["kind"],
            text=p["text"],
            criteria={level.upper(): p[f"criteria_{level}"] for level in "psmu"},
            inject_code=p["source_inject_code"],
            action_code=p["source_action_code"],
            responsible_role=p["responsible_role"],
            expected_within_minutes=p["expected_within_minutes"],
            action_mark=mark,
            action_note=note,
            rating=RunRatingRead(
                level=rating.level,
                rationale=rating.rationale,
                inject_code=rating.inject_code,
                updated_at=rating.updated_at,
            )
            if rating
            else None,
        )

    objectives = [
        RunEvalObjectiveRead(
            id=eeg["id"],
            code=eeg["code"],
            title=eeg.get("title", ""),
            capability=eeg["capability"],
            statement=eeg["statement"],
            points=[point(p) for p in eeg["points"]],
        )
        for eeg in _rated_objectives(plan, user, access.leads)
    ]
    points = [p for o in objectives for p in o.points]
    return RunEvaluationRead(
        objectives=objectives,
        rated=sum(1 for p in points if p.rating),
        total=len(points),
    )


def rate_point(
    session: Session,
    ttx: TTX,
    user: User,
    point_id: uuid.UUID,
    level: RatingLevel | None,
    rationale: str,
    room_code: str | None = None,
) -> RunEvaluationRead:
    """Rate (or, with no level, un-rate) a point the Evaluator rates --
    during the session or after it, while the ratings are being written. In
    rooms, each place on its own."""
    access = _evaluator_access(session, ttx, user)
    run = started_run(session, ttx)
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    rated = {
        str(p["id"]) for eeg in _rated_objectives(plan, user, access.leads) for p in eeg["points"]
    }
    if str(point_id) not in rated:
        raise AppException("POINT_NOT_ASSIGNED", "You don't rate this observation point.", 403)
    log = _log(session, run)
    rooms, place = _rating_place(session, ttx, run, log, user, room_code)
    rating = session.exec(
        select(RunRating).where(
            RunRating.run_id == run.id,
            RunRating.evaluator_id == user.id,
            RunRating.point_id == point_id,
            RunRating.room_code == place,
        )
    ).first()
    if level is None:
        if rating is not None:
            session.delete(rating)
    else:
        if rating is None:
            rating = RunRating(
                run_id=run.id,
                evaluator_id=user.id,
                point_id=point_id,
                level=level,
                room_code=place,
            )
        rating.level = level
        rating.rationale = rationale.strip()
        rating.inject_code = (
            _in_play(session, run, log, rooms, place) or ""
            if rooms is not None
            else next(reversed(log.released), "")
        )
        rating.updated_at = datetime.now(UTC)
        session.add(rating)
    session.commit()
    return evaluation(session, ttx, user, room_code)


# The plan's calendar: what follows the session, in order, as days after it.
MILESTONES = ("hot_wash", "debrief", "ratings_due", "draft_aar", "after_action_meeting")


def played_minutes(run: ExerciseRun) -> int:
    """Session minutes played so far, pauses left out."""
    end = run.ended_at or run.paused_at or datetime.now(UTC)
    paused = run.paused_seconds
    return max(0, int((end - run.started_at).total_seconds() - paused) // 60)


def summary(session: Session, ttx: TTX) -> RunSummaryRead:
    """How the session went and what comes after it, dated by the plan's
    calendar from the session's day."""
    run = started_run(session, ttx)
    msel = _payload(session, run)
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    log = _log(session, run)
    control = _control(msel, log)

    actions = {mark.value: 0 for mark in ActionMark} | {"unmarked": 0}
    for inject in control.injects:
        if inject.state != "released":
            continue
        for action in inject.expected_actions:
            actions[action.mark.value if action.mark else "unmarked"] += 1

    ratings = list(session.exec(select(RunRating).where(RunRating.run_id == run.id)))
    rated_by: dict[str, set[str]] = {}
    for rating in ratings:
        rated_by.setdefault(str(rating.evaluator_id), set()).add(str(rating.point_id))
    # Each Evaluator's progress is over the points they rate -- every one
    # for the Lead Evaluator, as `rate_point` allows -- so it never runs
    # past its total.
    lead_id = session.exec(
        select(TTXAccess.user_id).where(TTXAccess.ttx_id == ttx.id, TTXAccess.leads)
    ).first()
    points_of = {str(eeg["id"]): {str(p["id"]) for p in eeg["points"]} for eeg in plan["eeg"]}
    progress = []
    for evaluator in plan["evaluators"]:
        user_id = str(evaluator["user_id"])
        objective_ids = (
            points_of if user_id == str(lead_id) else map(str, evaluator["objective_ids"])
        )
        points = set().union(*(points_of.get(o, set()) for o in objective_ids))
        progress.append(
            RunEvaluatorProgressRead(
                name=evaluator["full_name"],
                rated=len(rated_by.get(user_id, set()) & points),
                total=len(points),
            )
        )

    day = (
        date.fromisoformat(plan["session_date"])
        if plan.get("session_date")
        else run.started_at.date()
    )
    milestones = [
        RunMilestoneRead(key=key, on=day + timedelta(days=plan[f"{key}_days"]))
        for key in MILESTONES
        if plan.get(f"{key}_days") is not None
    ]

    team = session.exec(
        select(RunNote).where(RunNote.run_id == run.id, RunNote.role != TTXContextRole.PLAYER.value)
    ).all()
    return RunSummaryRead(
        state=run.status.value,
        started_at=run.started_at,
        ended_at=run.ended_at,
        played_minutes=played_minutes(run),
        stop_reason=run.stop_reason,
        injects=[
            RunSummaryInjectRead(
                code=i.code, title=i.title, kind=i.kind, state=i.state, reason=i.reason
            )
            for i in sorted(
                control.injects, key=lambda i: (i.due_minute is None, i.due_minute or 0)
            )
        ],
        actions=actions,
        questions_asked=sum(len(asked) for asked in log.asked.values()),
        questions_covered=sum(len(covered) for covered in log.covered.values()),
        ratings=progress,
        levels={level.value: sum(1 for r in ratings if r.level == level) for level in RatingLevel},
        team_notes=len(team),
        milestones=milestones,
    )


# Under this many answers, the feedback results show only the count.
FEEDBACK_MINIMUM = 3
# The roles that answer the participant feedback form.
FEEDBACK_ROLES = (
    TTXContextRole.PLAYER.value,
    TTXContextRole.FACILITATOR.value,
    TTXContextRole.OBSERVER.value,
    TTXContextRole.EVALUATOR.value,
)


def _feedback_statements(plan: dict, locale: str) -> list[FeedbackItemRead]:
    """The form's statements: the common ones, then one per objective."""
    common = [FeedbackItemRead(key=key, text=feedback_text(t, locale)) for key, t in STATEMENTS]
    objectives = [
        FeedbackItemRead(
            key=eeg["code"],
            text=feedback_text(OBJECTIVE_STATEMENT, locale).format(
                objective=f"{eeg['code']} | {eeg.get('title') or eeg['statement']}"
            ),
        )
        for eeg in plan["eeg"]
        if not eeg.get("orphaned")
    ]
    return common + objectives


def _open_questions(locale: str) -> list[FeedbackItemRead]:
    return [FeedbackItemRead(key=key, text=feedback_text(t, locale)) for key, t in OPEN_QUESTIONS]


def _submitted(session: Session, run: ExerciseRun, user: User) -> bool:
    return (
        session.exec(
            select(RunFeedbackSubmission).where(
                RunFeedbackSubmission.run_id == run.id, RunFeedbackSubmission.user_id == user.id
            )
        ).first()
        is not None
    )


def feedback_form(session: Session, ttx: TTX, user: User, locale: str) -> RunFeedbackFormRead:
    run = started_run(session, ttx)
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    return RunFeedbackFormRead(
        available=run.status in (RunStatus.ENDED, RunStatus.STOPPED),
        submitted=_submitted(session, run, user),
        intro=feedback_text(INTRO, locale),
        statements=_feedback_statements(plan, locale),
        open_questions=_open_questions(locale),
    )


def submit_feedback(
    session: Session,
    ttx: TTX,
    user: User,
    role: str,
    scores: dict[str, int],
    answers: dict[str, str],
) -> None:
    """Answer the form once the session is over -- once. Who answered and
    what they answered are stored apart and never linked."""
    run = started_run(session, ttx)
    if run.status not in (RunStatus.ENDED, RunStatus.STOPPED):
        raise _refuse("RUN_NOT_OVER", "The feedback form opens once the session is over.")
    if role not in FEEDBACK_ROLES:
        raise AppException("NOT_ACTING_AS", "The participants answer this form.", 403)
    if _submitted(session, run, user):
        raise _refuse("FEEDBACK_ALREADY_SENT", "You've already answered this form.")
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    known = {item.key for item in _feedback_statements(plan, "en")}
    open_keys = {key for key, _ in OPEN_QUESTIONS}
    if not set(scores) <= known or not set(answers) <= open_keys:
        raise _refuse("FEEDBACK_UNKNOWN_ITEM", "That isn't a question of this form.", 422)
    session.add(RunFeedbackSubmission(run_id=run.id, user_id=user.id))
    session.add(
        RunFeedbackResponse(
            run_id=run.id,
            group="player" if role == TTXContextRole.PLAYER.value else "team",
            scores=scores,
            answers={key: value.strip() for key, value in answers.items() if value.strip()},
        )
    )
    session.commit()


def feedback_results(
    session: Session, ttx: TTX, locale: str, run_id: uuid.UUID | None = None
) -> RunFeedbackResultsRead:
    """The answers aggregated -- per statement the average and how many
    gave each score, the open answers shuffled -- or, under
    FEEDBACK_MINIMUM answers, just how many there are. `run_id` names one
    of the exercise's runs; else the current one."""
    run = run_of(session, ttx, run_id) if run_id is not None else started_run(session, ttx)
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    responses = list(
        session.exec(select(RunFeedbackResponse).where(RunFeedbackResponse.run_id == run.id))
    )
    shown = len(responses) >= FEEDBACK_MINIMUM
    statements = []
    for item in _feedback_statements(plan, locale):
        given = [r.scores[item.key] for r in responses if item.key in r.scores]
        statements.append(
            FeedbackStatementResult(
                key=item.key,
                text=item.text,
                n=len(given),
                average=round(sum(given) / len(given), 2) if shown and given else None,
                distribution=[given.count(score) for score in range(1, 6)] if shown else None,
            )
        )
    answers: dict[str, list[str]] = {}
    if shown:
        for key, _ in OPEN_QUESTIONS:
            texts = [r.answers[key] for r in responses if r.answers.get(key)]
            # Order only (so no one is read in submission order): not security.
            random.shuffle(texts)  # nosec B311
            answers[key] = texts
    return RunFeedbackResultsRead(
        responses=len(responses),
        players=sum(1 for r in responses if r.group == "player"),
        team=sum(1 for r in responses if r.group == "team"),
        minimum=FEEDBACK_MINIMUM,
        shown=shown,
        statements=statements,
        answers=answers,
        open_questions=_open_questions(locale),
    )


def delete_runs_for_ttx(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """Every run of these exercises and its log -- before the snapshots they
    point at go."""
    if not ttx_ids:
        return
    for row in session.exec(select(RunNote).where(RunNote.ttx_id.in_(ttx_ids))):
        session.delete(row)
    for row in session.exec(select(RunPresence).where(RunPresence.ttx_id.in_(ttx_ids))):
        session.delete(row)
    session.flush()
    _delete_runs(
        session, list(session.exec(select(ExerciseRun.id).where(ExerciseRun.ttx_id.in_(ttx_ids))))
    )


def _delete_runs(session: Session, run_ids: list[uuid.UUID]) -> None:
    """These runs and everything recorded in them."""
    if not run_ids:
        return
    for row in session.exec(select(RunNote).where(RunNote.run_id.in_(run_ids))):
        session.delete(row)
    for event in session.exec(select(RunEvent).where(RunEvent.run_id.in_(run_ids))):
        session.delete(event)
    for rating in session.exec(select(RunRating).where(RunRating.run_id.in_(run_ids))):
        session.delete(rating)
    for model in (RunFeedbackSubmission, RunFeedbackResponse):
        for row in session.exec(select(model).where(model.run_id.in_(run_ids))):
            session.delete(row)
    session.flush()
    for run in session.exec(select(ExerciseRun).where(ExerciseRun.id.in_(run_ids))):
        session.delete(run)
    session.flush()
