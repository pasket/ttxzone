"""The Playground's live session. Everyone on the exercise polls the same
view (`GET /ttx/{ttx_id}/run`, projected per role); only its Controllers
run it: start, pause, release or skip injects, put key questions to the
table, mark expected actions, end or stop it, and restart it once over."""

import uuid
from collections.abc import Callable
from pathlib import Path

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi import Path as PathParam
from fastapi.responses import FileResponse, StreamingResponse
from sqlmodel import Session, select

from app.core import surface
from app.core.config import settings
from app.core.db import get_session
from app.core.exceptions import AppException
from app.core.i18n import get_locale
from app.core.security import (
    RequiresOrgAndTTXAccess,
    get_current_user,
    ttx_access_of,
    verify_csrf,
)
from app.models import TTX, MselFile, RoleEnum, TTXAccess, TTXContextRole, User
from app.schemas.exercise_run import (
    RunActionMarkRequest,
    RunDecisionEdit,
    RunDecisionWrite,
    RunEndexRequest,
    RunEvaluationRead,
    RunFeedbackFormRead,
    RunFeedbackResultsRead,
    RunFeedbackWrite,
    RunMeterGroupRead,
    RunMetersShown,
    RunMoveRequest,
    RunNoteListResponse,
    RunNoteWrite,
    RunPastListResponse,
    RunPollClose,
    RunPollResults,
    RunPollWrite,
    RunProjectRequest,
    RunQuestionCoveredRequest,
    RunQuestionsRequest,
    RunRatingWrite,
    RunRead,
    RunRealWorldRequest,
    RunReleaseRequest,
    RunRestartRequest,
    RunSeatsRequest,
    RunSkipRequest,
    RunStopRequest,
    RunSummaryRead,
    RunTeamNoteListResponse,
    RunVoteWrite,
)
from app.schemas.ttx_msel import MselFilePreviewRead
from app.services.exercise_run_service import (
    MODERATORS,
    acting_role,
    cast_vote,
    close_poll,
    cover_question,
    delete_decision,
    edit_decision,
    end_run,
    evaluation,
    feedback_form,
    feedback_results,
    find_run,
    mark_action,
    move_players,
    my_notes,
    open_poll,
    past_runs,
    pause_run,
    player_view,
    project_inject,
    rate_point,
    real_world_pause,
    record_decision,
    release_endex,
    release_inject,
    release_questions,
    released_file_ids,
    released_image_ids,
    resend_inject,
    reset_inject_timer,
    restart_run,
    resume_run,
    run_meters,
    run_view,
    save_note,
    seat_players,
    show_meters,
    show_poll_results,
    skip_inject,
    start_run,
    stop_run,
    submit_feedback,
    summary,
    team_notes,
    touch_presence,
    view_cursor,
)
from app.services.msel_file_service import (
    PREVIEW_MAX_BYTES,
    download_headers,
    file_path,
    get_file,
    text_preview,
)
from app.services.msel_image_service import get_image, image_path
from app.services.run_export_service import render_aar_pdf, render_log_csv, render_log_pdf
from app.services.run_stream import run_events
from app.services.ttx_msel_service import find_msel

router = APIRouter(prefix="/ttx", tags=["ttx-run"])

# Everyone at the table and behind it reads the session.
_participant = RequiresOrgAndTTXAccess(*TTXContextRole)
_controller = RequiresOrgAndTTXAccess(TTXContextRole.CONTROLLER)
_evaluator = RequiresOrgAndTTXAccess(TTXContextRole.EVALUATOR)
# Who moderates the discussion: marks key questions as covered.
_moderator = RequiresOrgAndTTXAccess(TTXContextRole.CONTROLLER, TTXContextRole.FACILITATOR)
# The team's notes: its Controllers and Planners -- and its Lead Evaluator,
# checked in the endpoint (`leads` isn't a role).
_team_note_readers = RequiresOrgAndTTXAccess(
    TTXContextRole.CONTROLLER, TTXContextRole.PLANNER, TTXContextRole.EVALUATOR
)


def _reads_team_notes(session: Session, user: User, ttx: TTX) -> bool:
    access = ttx_access_of(session, user.id, ttx.id)
    if access is None:
        return False
    roles = access.context_roles()
    return bool({TTXContextRole.CONTROLLER.value, TTXContextRole.PLANNER.value} & roles) or (
        access.is_evaluator and access.leads
    )


def _controls(session: Session, user: User, ttx: TTX) -> bool:
    # Never on the public face: whoever reaches it is there as a Player.
    if surface.is_public():
        return False
    access = ttx_access_of(session, user.id, ttx.id)
    return access is not None and TTXContextRole.CONTROLLER.value in access.context_roles()


def _view(session: Session, ttx: TTX, user: User) -> RunRead:
    """After a Controller's action: their view, as the Controller -- on the
    public face (REAL WORLD from a Player), the Player's view."""
    role = TTXContextRole.PLAYER if surface.is_public() else TTXContextRole.CONTROLLER
    return run_view(
        session,
        ttx,
        find_run(session, ttx.id),
        can_control=_controls(session, user, ttx),
        viewer_role=role.value,
        viewer=user,
    )


def _role(
    as_: str | None = Query(None, alias="as", max_length=16),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> str:
    """The role the caller writes notes as: one they take part as here."""
    role = acting_role(session, user, ttx, as_)
    if role is None:
        raise AppException(
            "NOT_ACTING_AS", "You don't take part in this session as that role.", 403
        )
    return role


@router.get("/{ttx_id}/run", response_model=RunRead, responses={204: {"description": "No change"}})
def get_run_endpoint(
    since: str | None = Query(None, max_length=64),
    as_: str | None = Query(None, alias="as", max_length=16),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Polled by the Playground as the role the caller acts as (`as`: it
    marks them present) with the `cursor` it has: 204 while nothing has
    happened and nobody came or went."""
    role = acting_role(session, user, ttx, as_)
    if role is not None:
        touch_presence(session, ttx, user, role)
    run = find_run(session, ttx.id)
    if run is not None and since == view_cursor(session, ttx, run, role):
        return Response(status_code=204)
    if role == TTXContextRole.PLAYER.value:
        return player_view(session, ttx, run, user)
    return run_view(
        session,
        ttx,
        run,
        can_control=_controls(session, user, ttx),
        viewer_role=role,
        viewer=user,
    )


@router.get("/{ttx_id}/run/notes", response_model=RunNoteListResponse)
def list_my_notes_endpoint(
    room: str | None = Query(None, max_length=16),
    role: str = Depends(_role),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunNoteListResponse:
    """The caller's own notes as `as`."""
    return RunNoteListResponse(items=my_notes(session, ttx, user, role, room))


@router.put(
    "/{ttx_id}/run/notes", response_model=RunNoteListResponse, dependencies=[Depends(verify_csrf)]
)
def save_note_endpoint(
    payload: RunNoteWrite,
    role: str = Depends(_role),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunNoteListResponse:
    """Write the note on an inject (or the general one); empty deletes it.
    Answers all the caller's notes as `as`."""
    return RunNoteListResponse(
        items=save_note(
            session, ttx, user, role, payload.inject_code, payload.text, payload.room_code
        )
    )


@router.get("/{ttx_id}/run/notes/team", response_model=RunTeamNoteListResponse)
def list_team_notes_endpoint(
    run: uuid.UUID | None = Query(None),
    ttx: TTX = Depends(_team_note_readers),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunTeamNoteListResponse:
    """What the Facilitators, Observers, Evaluators and Controllers wrote
    (never a Player's notes): for the exercise's Controllers and Planners,
    and its Lead Evaluator. `run` names a previous run (the one a report
    was written from)."""
    if not _reads_team_notes(session, user, ttx):
        raise AppException("TTX_ACCESS_DENIED", "You can't read the team's notes.", 403)
    return RunTeamNoteListResponse(items=team_notes(session, ttx, run))


def _as_view(session: Session, ttx: TTX, user: User, role: str) -> RunRead:
    """After a table action: the caller's view, as the role they act as."""
    if role == TTXContextRole.PLAYER.value:
        return player_view(session, ttx, find_run(session, ttx.id), user)
    return run_view(
        session,
        ttx,
        find_run(session, ttx.id),
        can_control=_controls(session, user, ttx),
        viewer_role=role,
        viewer=user,
    )


@router.post("/{ttx_id}/run/decisions", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def record_decision_endpoint(
    payload: RunDecisionWrite,
    role: str = Depends(_role),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """A decision of the table, as a Player, Facilitator or Controller."""
    record_decision(session, ttx, user, role, payload.text, payload.inject_code, payload.room_code)
    return _as_view(session, ttx, user, role)


@router.put(
    "/{ttx_id}/run/decisions/{decision_id}",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def edit_decision_endpoint(
    payload: RunDecisionEdit,
    decision_id: str = PathParam(max_length=36),
    role: str = Depends(_role),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Reword a decision: its author, a Facilitator or a Controller."""
    edit_decision(session, ttx, user, role, decision_id, payload.text)
    return _as_view(session, ttx, user, role)


@router.delete(
    "/{ttx_id}/run/decisions/{decision_id}",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def delete_decision_endpoint(
    decision_id: str = PathParam(max_length=36),
    role: str = Depends(_role),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Take a decision off the log: its author, a Facilitator or a Controller."""
    delete_decision(session, ttx, user, role, decision_id)
    return _as_view(session, ttx, user, role)


def _moderating(role: str = Depends(_role)) -> str:
    if role not in MODERATORS:
        raise AppException("NOT_ACTING_AS", "Only a Facilitator or Controller runs a vote.", 403)
    return role


@router.post("/{ttx_id}/run/polls", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def open_poll_endpoint(
    payload: RunPollWrite,
    role: str = Depends(_moderating),
    ttx: TTX = Depends(_moderator),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Put a question to the Players' vote, on the inject in play."""
    open_poll(session, ttx, user, payload.question, payload.options, payload.room_code)
    return _as_view(session, ttx, user, role)


@router.post(
    "/{ttx_id}/run/polls/{poll_id}/results",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def show_poll_results_endpoint(
    payload: RunPollResults,
    poll_id: str = PathParam(max_length=36),
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Show a closed poll's result to the Players, or hide it again."""
    show_poll_results(session, ttx, user, poll_id, payload.shown)
    return _as_view(session, ttx, user, TTXContextRole.CONTROLLER.value)


@router.post("/{ttx_id}/run/meters", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def show_meters_endpoint(
    payload: RunMetersShown,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Show the impact meters' summary to the Players, or hide it again."""
    show_meters(session, ttx, user, payload.shown)
    return _as_view(session, ttx, user, TTXContextRole.CONTROLLER.value)


@router.get("/{ttx_id}/run/meters", response_model=list[RunMeterGroupRead])
def get_run_meters_endpoint(
    run: uuid.UUID | None = Query(None),
    ttx: TTX = Depends(_team_note_readers),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> list[RunMeterGroupRead]:
    """What the decisions added up to, for the after-action report: for the
    Controllers and Lead Evaluator. `run` names a previous run."""
    if not _reads_team_notes(session, user, ttx):
        raise AppException("TTX_ACCESS_DENIED", "You can't read the session summary.", 403)
    return run_meters(session, ttx, run)


@router.post(
    "/{ttx_id}/run/polls/{poll_id}/close",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def close_poll_endpoint(
    payload: RunPollClose,
    poll_id: str = PathParam(max_length=36),
    role: str = Depends(_moderating),
    ttx: TTX = Depends(_moderator),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Close a vote, recording an option as the table's decision if asked."""
    close_poll(session, ttx, user, role, poll_id, payload.record_option, payload.outcome_option)
    return _as_view(session, ttx, user, role)


@router.put(
    "/{ttx_id}/run/polls/{poll_id}/vote",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def cast_vote_endpoint(
    payload: RunVoteWrite,
    poll_id: str = PathParam(max_length=36),
    role: str = Depends(_role),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """A Player's vote (a new one replaces theirs while it's open)."""
    if role != TTXContextRole.PLAYER.value:
        raise AppException("NOT_ACTING_AS", "Only Players vote.", 403)
    cast_vote(session, ttx, user, poll_id, payload.option)
    return _as_view(session, ttx, user, role)


@router.get("/{ttx_id}/run/stream")
def run_stream_endpoint(
    request: Request,
    as_: str | None = Query(None, alias="as", max_length=16),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> StreamingResponse:
    """Server push for the Playground (Server-Sent Events): `event: change`
    whenever the session moves or someone comes or goes -- then fetch
    `GET /run?since=`. Keeps the caller present as `as` while open; never
    counts as their activity."""
    events = run_events(
        request,
        ttx_id=ttx.id,
        user_id=user.id,
        session_id=request.state.user_session.id,
        role=acting_role(session, user, ttx, as_),
    )
    # The request's database session would otherwise hold a pooled
    # connection for the stream's whole life (a yield dependency closes
    # after the response): with a few dozen viewers the pool runs dry and
    # every request waits. The stream reads with sessions of its own.
    session.close()
    return StreamingResponse(
        events,
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store", "X-Accel-Buffering": "no"},
    )


@router.post("/{ttx_id}/run/start", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def start_run_endpoint(
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Start the session; the MSEL and session plan must be ready."""
    start_run(session, ttx, user)
    return _view(session, ttx, user)


def _session_action(path: str, action: Callable[[Session, TTX, User], None], doc: str) -> None:
    """A body-less Controller action on the session, answered with the new
    view."""

    def endpoint(
        ttx: TTX = Depends(_controller),
        user: User = Depends(get_current_user),
        session: Session = Depends(get_session),
    ) -> RunRead:
        action(session, ttx, user)
        return _view(session, ttx, user)

    endpoint.__doc__ = doc
    router.add_api_route(
        f"/{{ttx_id}}/run/{path}",
        endpoint,
        methods=["POST"],
        response_model=RunRead,
        dependencies=[Depends(verify_csrf)],
        name=f"{path}_run",
    )


_session_action("pause", pause_run, "Hold the session: nothing goes out, the clock stops.")
_session_action("resume", resume_run, "Carry on after a pause.")
_session_action("end", end_run, "The exercise is over (EndEx).")


@router.post(
    "/{ttx_id}/run/injects/{code}/release",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def release_inject_endpoint(
    code: str,
    payload: RunReleaseRequest | None = None,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Release an inject to the table."""
    release_inject(session, ttx, user, code, payload.reason if payload else "")
    return _view(session, ttx, user)


@router.post("/{ttx_id}/run/endex", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def release_endex_endpoint(
    payload: RunEndexRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """The closing message to the table once every mandatory inject is out."""
    release_endex(session, ttx, user, payload.title, payload.content)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/injects/{code}/resend",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def resend_inject_endpoint(
    code: str,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Put an inject already delivered back in play."""
    resend_inject(session, ttx, user, code)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/injects/{code}/skip",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def skip_inject_endpoint(
    code: str,
    payload: RunSkipRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Skip an inject, with its reason."""
    skip_inject(session, ttx, user, code, payload.reason)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/inject-timer/reset",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def reset_inject_timer_endpoint(
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Restart the time since the last inject, on every screen."""
    reset_inject_timer(session, ttx, user)
    return _view(session, ttx, user)


@router.post("/{ttx_id}/run/questions", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def release_questions_endpoint(
    payload: RunQuestionsRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Put the inject's key questions to the table."""
    release_questions(session, ttx, user, payload.phase_code, payload.positions, payload.room_code)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/questions/covered",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def cover_question_endpoint(
    payload: RunQuestionCoveredRequest,
    ttx: TTX = Depends(_moderator),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """A key question put to the table, marked as discussed (or not) -- by
    a Controller or a Facilitator, answered with their own view."""
    cover_question(
        session, ttx, user, payload.phase_code, payload.position, payload.covered, payload.room_code
    )
    controls = _controls(session, user, ttx)
    return run_view(
        session,
        ttx,
        find_run(session, ttx.id),
        can_control=controls,
        viewer_role=(TTXContextRole.CONTROLLER if controls else TTXContextRole.FACILITATOR).value,
        viewer=user,
    )


@router.put(
    "/{ttx_id}/run/actions/{code}",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def mark_action_endpoint(
    code: str,
    payload: RunActionMarkRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Mark what happened with an expected action."""
    mark_action(session, ttx, user, code, payload.mark, payload.note)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/players/move", response_model=RunRead, dependencies=[Depends(verify_csrf)]
)
def move_players_endpoint(
    payload: RunMoveRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Rooms: Players to the main room or back to their own."""
    move_players(session, ttx, user, payload.to, payload.user_ids, payload.room_code)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/main/project", response_model=RunRead, dependencies=[Depends(verify_csrf)]
)
def project_inject_endpoint(
    payload: RunProjectRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Rooms: a delivered inject on the main room's screen, or none."""
    project_inject(session, ttx, user, payload.code)
    return _view(session, ttx, user)


@router.put("/{ttx_id}/run/seats", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def seat_players_endpoint(
    payload: RunSeatsRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Rooms: seat Players mid-session (a late one, say) by room code."""
    seat_players(session, ttx, user, [(a.user_id, a.room_code) for a in payload.assignments])
    return _view(session, ttx, user)


@router.post("/{ttx_id}/run/stop", response_model=RunRead, dependencies=[Depends(verify_csrf)])
def stop_run_endpoint(
    payload: RunStopRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Stop the session at once, before its planned end."""
    stop_run(session, ttx, user, payload.reason)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/real-world", response_model=RunRead, dependencies=[Depends(verify_csrf)]
)
def real_world_pause_endpoint(
    payload: RunRealWorldRequest,
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """REAL WORLD: anyone at the table pauses the session for a real-world
    event (no step-up: nothing may delay it); only a Controller resumes."""
    real_world_pause(session, ttx, user, payload.keyword)
    return _view(session, ttx, user)


@router.post(
    "/{ttx_id}/run/restart",
    response_model=RunRead,
    dependencies=[Depends(verify_csrf)],
)
def restart_run_endpoint(
    payload: RunRestartRequest,
    ttx: TTX = Depends(_controller),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunRead:
    """Back to Not started once the session is over: delete the run with
    all it recorded (409 `RUN_HAS_REPORT` if a report rests on it), or
    archive it as a previous run. A typed control word confirms it, not a
    step-up."""
    restart_run(session, ttx, user, payload.mode, payload.confirmation)
    return _view(session, ttx, user)


@router.get("/{ttx_id}/run/history", response_model=RunPastListResponse)
def list_past_runs_endpoint(
    ttx: TTX = Depends(_team_note_readers),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunPastListResponse:
    """The exercise's previous (archived) runs, latest first, for the ones
    who read the session summary."""
    if not _reads_team_notes(session, user, ttx):
        raise AppException("TTX_ACCESS_DENIED", "You can't read the previous sessions.", 403)
    return RunPastListResponse(items=past_runs(session, ttx))


@router.get("/{ttx_id}/run/feedback", response_model=RunFeedbackFormRead)
def get_feedback_form_endpoint(
    locale: str = Depends(get_locale),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunFeedbackFormRead:
    """The participant feedback form, and whether the caller answered it."""
    return feedback_form(session, ttx, user, locale)


@router.post("/{ttx_id}/run/feedback", status_code=204, dependencies=[Depends(verify_csrf)])
def submit_feedback_endpoint(
    payload: RunFeedbackWrite,
    role: str = Depends(_role),
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> None:
    """Answer the form, anonymously, once the session is over."""
    submit_feedback(session, ttx, user, role, payload.scores, payload.answers)


@router.get("/{ttx_id}/run/feedback/results", response_model=RunFeedbackResultsRead)
def get_feedback_results_endpoint(
    run: uuid.UUID | None = Query(None),
    locale: str = Depends(get_locale),
    ttx: TTX = Depends(_team_note_readers),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunFeedbackResultsRead:
    """The answers, aggregated and unsigned: for the Controllers, Planners
    and Lead Evaluator. `run` names a previous run."""
    if not _reads_team_notes(session, user, ttx):
        raise AppException("TTX_ACCESS_DENIED", "You can't read the feedback.", 403)
    return feedback_results(session, ttx, locale, run)


# The ones a previous run (`?run=`) can be downloaded as.
_RUN_EXPORTS = {"log.pdf", "log.csv"}
_EXPORTS = {
    "log.pdf": (render_log_pdf, "application/pdf"),
    "log.csv": (render_log_csv, "text/csv; charset=utf-8"),
    "aar.pdf": (render_aar_pdf, "application/pdf"),
}


@router.get("/{ttx_id}/run/export/{name}")
def run_export_endpoint(
    name: str,
    # A plain download link can't set Accept-Language to the app's own
    # language (the browser sends its own), so the page passes it here.
    lang: str | None = Query(None, pattern="^[a-z]{2}$"),
    run: uuid.UUID | None = Query(None),
    header_locale: str = Depends(get_locale),
    ttx: TTX = Depends(_team_note_readers),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> Response:
    """The execution log (log.pdf, log.csv) or the draft after-action
    report (aar.pdf), for the Controllers, Planners and Lead Evaluator;
    downloaded, never cached. `run` names a previous run (logs only)."""
    if not _reads_team_notes(session, user, ttx):
        raise AppException("TTX_ACCESS_DENIED", "You can't export this session.", 403)
    if name not in _EXPORTS or (run is not None and name not in _RUN_EXPORTS):
        raise AppException("EXPORT_NOT_FOUND", "No such export.", 404)
    render, media_type = _EXPORTS[name]
    locale = lang if lang in settings.SUPPORTED_LOCALES else header_locale
    content, filename = render(session, ttx, locale, run) if run else render(session, ttx, locale)
    return Response(
        content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/{ttx_id}/run/summary", response_model=RunSummaryRead)
def get_summary_endpoint(
    ttx: TTX = Depends(_team_note_readers),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunSummaryRead:
    """How the session went, for its Controllers, Planners and Lead
    Evaluator (the ones who run the hot wash and write the report)."""
    if not _reads_team_notes(session, user, ttx):
        raise AppException("TTX_ACCESS_DENIED", "You can't read the session summary.", 403)
    return summary(session, ttx)


@router.get("/{ttx_id}/run/evaluation", response_model=RunEvaluationRead)
def get_evaluation_endpoint(
    room: str | None = Query(None, max_length=16),
    ttx: TTX = Depends(_evaluator),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunEvaluationRead:
    """The Evaluator's EEG for the session, with their ratings."""
    return evaluation(session, ttx, user, room)


@router.put(
    "/{ttx_id}/run/ratings/{point_id}",
    response_model=RunEvaluationRead,
    dependencies=[Depends(verify_csrf)],
)
def rate_point_endpoint(
    point_id: uuid.UUID,
    payload: RunRatingWrite,
    ttx: TTX = Depends(_evaluator),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> RunEvaluationRead:
    """Rate an observation point P/S/M/U with why (no level withdraws it)."""
    return rate_point(
        session, ttx, user, point_id, payload.level, payload.rationale, payload.room_code
    )


@router.get("/{ttx_id}/run/images/{image_id}")
def get_run_image_endpoint(
    image_id: uuid.UUID,
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileResponse:
    """An image of a delivered inject (any image of the MSEL for its
    Controllers) -- never one the table hasn't been shown yet."""
    access = session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == user.id)
    ).first()
    allowed = released_image_ids(
        session,
        find_run(session, ttx.id),
        all_images=_controls(session, user, ttx),
        ttx=ttx,
        # In rooms a Player loads only what their room and the main room saw.
        player=user if access is not None and access.role == RoleEnum.PLAYER else None,
    )
    msel = find_msel(session, ttx.id)
    if msel is None or str(image_id) not in allowed:
        raise AppException("MSEL_IMAGE_NOT_FOUND", "Image not found.", 404)
    image = get_image(session, msel, image_id)
    return FileResponse(
        image_path(image),
        media_type=image.content_type,
        filename=f"image{Path(image.stored_name).suffix}",
        content_disposition_type="inline",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


def _released_file(session: Session, ttx: TTX, user: User, file_id: uuid.UUID) -> MselFile:
    """A file of a delivered inject (any file of the MSEL for its
    Controllers) -- never one the table hasn't been handed yet."""
    access = session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == user.id)
    ).first()
    allowed = released_file_ids(
        session,
        find_run(session, ttx.id),
        all_files=_controls(session, user, ttx),
        ttx=ttx,
        player=user if access is not None and access.role == RoleEnum.PLAYER else None,
    )
    msel = find_msel(session, ttx.id)
    if msel is None or str(file_id) not in allowed:
        raise AppException("MSEL_FILE_NOT_FOUND", "File not found.", 404)
    return get_file(session, msel, file_id)


@router.get("/{ttx_id}/run/files/{file_id}")
def get_run_file_endpoint(
    file_id: uuid.UUID,
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> FileResponse:
    """A file of a delivered inject, always as an opaque download."""
    file = _released_file(session, ttx, user, file_id)
    return FileResponse(
        file_path(file), media_type="application/octet-stream", headers=download_headers(file)
    )


@router.get("/{ttx_id}/run/files/{file_id}/preview", response_model=MselFilePreviewRead)
def preview_run_file_endpoint(
    file_id: uuid.UUID,
    ttx: TTX = Depends(_participant),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
) -> MselFilePreviewRead:
    """The beginning of a delivered text file as plain text (same access as
    its download); 409 MSEL_FILE_NOT_TEXT for anything else."""
    file = _released_file(session, ttx, user, file_id)
    text, truncated, encoding = text_preview(file)
    return MselFilePreviewRead(
        id=file.id,
        name=file.original_name,
        size_bytes=file.size_bytes,
        text=text,
        truncated=truncated,
        encoding=encoding,
        limit_bytes=PREVIEW_MAX_BYTES,
    )
