"""The editable after-action report (AAR) and improvement plan: created
from the session the exercise ran -- seeded with what the Evaluators rated
and the Controller saw -- then written by the exercise's Planners and Lead
Evaluator; read by its Controllers and the organization's Program
Managers, who also follow every improvement plan of the organization."""

import logging
import uuid
from collections import Counter
from datetime import UTC, date, datetime

from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.core.exceptions import AppException
from app.core.security import is_program_manager
from app.models import (
    TTX,
    AarStatus,
    AfterActionObjective,
    AfterActionReport,
    AfterActionSnapshot,
    AssistantProposal,
    ConductPrepSnapshot,
    ExerciseRun,
    ImprovementAction,
    ImprovementStatus,
    MselSnapshot,
    RatingLevel,
    RunEvent,
    RunEventType,
    RunRating,
    TTXAccess,
    TTXContextRole,
    TTXNeedsForm,
    TTXObjective,
    User,
)
from app.schemas.after_action import (
    AarObjectiveRead,
    AarPreviewObjective,
    AarPreviewRead,
    AarRead,
    AarRunOption,
    AarSaveRequest,
    ImprovementActionRead,
    ImprovementPlanListResponse,
    ImprovementPlanRow,
    RetestCandidate,
    RetestedAction,
    RetestObjectiveOption,
    RetestRead,
    SessionRatingRead,
)
from app.services.exercise_run_service import decision_log
from app.services.ttx_conduct_prep_service import latest_prep_snapshot

logger = logging.getLogger(__name__)

# Levels that count as achieved (strengths) and as not (areas for improvement).
_STRONG = {RatingLevel.P, RatingLevel.S}
_WEAK = {RatingLevel.M, RatingLevel.U}
_CLOSED = (ImprovementStatus.DONE, ImprovementStatus.CANCELLED)


def _refuse(code: str, message: str, status: int = 409, params: dict | None = None) -> AppException:
    return AppException(code, message, status, log_level=logging.WARNING, params=params)


def _access(session: Session, user: User, ttx: TTX) -> TTXAccess | None:
    return session.exec(
        select(TTXAccess).where(TTXAccess.ttx_id == ttx.id, TTXAccess.user_id == user.id)
    ).first()


def can_write(session: Session, user: User, ttx: TTX) -> bool:
    """The exercise's Planners and its Lead Evaluator write the report."""
    access = _access(session, user, ttx)
    if access is None:
        return False
    return TTXContextRole.PLANNER.value in access.context_roles() or (
        access.is_evaluator and access.leads
    )


def can_read(session: Session, user: User, ttx: TTX) -> bool:
    """Its authors, its Controllers and the organization's Program
    Managers read it."""
    if can_write(session, user, ttx) or is_program_manager(session, user, ttx.organization_id):
        return True
    access = _access(session, user, ttx)
    return access is not None and TTXContextRole.CONTROLLER.value in access.context_roles()


def _require(allowed: bool) -> None:
    if not allowed:
        raise AppException(
            "TTX_ACCESS_DENIED", "You don't have access to the after-action report.", 403,
            log_level=logging.WARNING,
        )  # fmt: skip


def find_report(session: Session, ttx_id: uuid.UUID) -> AfterActionReport | None:
    return session.exec(select(AfterActionReport).where(AfterActionReport.ttx_id == ttx_id)).first()


def _ratings_by_objective(session: Session, report: AfterActionReport) -> dict:
    """Objective code -> the session's ratings of its points, with who."""
    run = session.get(ExerciseRun, report.run_id)
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    ratings = session.exec(select(RunRating).where(RunRating.run_id == run.id)).all()
    names = {
        u.id: u.full_name
        for u in session.exec(select(User).where(User.id.in_({r.evaluator_id for r in ratings})))
    }
    by_point = {}
    for rating in ratings:
        by_point.setdefault(str(rating.point_id), []).append(rating)
    out: dict[str, list[SessionRatingRead]] = {}
    for eeg in plan["eeg"]:
        rows = out.setdefault(eeg["code"], [])
        for point in eeg["points"]:
            for rating in by_point.get(str(point["id"]), []):
                rows.append(
                    SessionRatingRead(
                        point=point["text"],
                        level=rating.level,
                        rationale=rating.rationale,
                        evaluator=names.get(rating.evaluator_id, ""),
                        room_code=rating.room_code,
                    )
                )
    return out


def _overdue(action: ImprovementAction, today: date) -> bool:
    return action.due_date is not None and action.due_date < today and action.status not in _CLOSED


def _retests(session: Session, actions) -> dict[uuid.UUID, RetestRead]:
    """Each linked action's re-test, by action id, in two queries."""
    linked = [a for a in actions if a.retest_ttx_id is not None]
    if not linked:
        return {}
    exercises = {
        t.id: t
        for t in session.exec(select(TTX).where(TTX.id.in_({a.retest_ttx_id for a in linked})))
    }
    objective_ids = {a.retest_objective_id for a in linked if a.retest_objective_id}
    objectives = (
        {
            o.id: o
            for o in session.exec(select(TTXObjective).where(TTXObjective.id.in_(objective_ids)))
        }
        if objective_ids
        else {}
    )
    result: dict[uuid.UUID, RetestRead] = {}
    for action in linked:
        ttx = exercises.get(action.retest_ttx_id)
        if ttx is None:
            continue
        objective = objectives.get(action.retest_objective_id)
        result[action.id] = RetestRead(
            ttx_id=ttx.id,
            ttx_code=ttx.code,
            ttx_name=ttx.name,
            objective_id=objective.id if objective else None,
            objective_code=objective.code if objective else None,
            objective_title=objective.title if objective else None,
        )
    return result


def _action_read(
    action: ImprovementAction, today: date, retest: RetestRead | None = None
) -> ImprovementActionRead:
    return ImprovementActionRead(
        retest=retest,
        id=action.id,
        code=action.code,
        objective_code=action.objective_code,
        finding=action.finding,
        action=action.action,
        owner=action.owner,
        owner_area=action.owner_area,
        due_date=action.due_date,
        status=action.status,
        status_note=action.status_note,
        overdue=_overdue(action, today),
        updated_at=action.updated_at,
    )


def report_read(
    session: Session,
    report: AfterActionReport,
    *,
    can_edit: bool,
    can_see_session: bool | None = None,
) -> AarRead:
    today = datetime.now(UTC).date()
    objectives = session.exec(
        select(AfterActionObjective)
        .where(AfterActionObjective.report_id == report.id)
        .order_by(AfterActionObjective.position)
    ).all()
    actions = session.exec(
        select(ImprovementAction)
        .where(ImprovementAction.report_id == report.id)
        .order_by(ImprovementAction.position)
    ).all()
    ratings = _ratings_by_objective(session, report)
    retests = _retests(session, actions)
    archived = session.get(TTX, report.ttx_id).archived_at is not None
    return AarRead(
        id=report.id,
        ttx_id=report.ttx_id,
        status=report.status,
        version=report.version,
        revision=report.revision,
        executive_summary=report.executive_summary,
        scenario_summary=report.scenario_summary,
        conclusions=report.conclusions,
        objectives=[
            AarObjectiveRead(
                id=o.id,
                objective_code=o.objective_code,
                title=o.title,
                overall=o.overall,
                strengths=o.strengths,
                improvements=o.improvements,
                analysis=o.analysis,
                session_ratings=ratings.get(o.objective_code, []),
            )
            for o in objectives
        ],
        actions=[_action_read(a, today, retests.get(a.id)) for a in actions],
        finalized_by=report.finalized_by,
        finalized_at=report.finalized_at,
        updated_at=report.updated_at,
        can_edit=can_edit and not archived,
        can_follow_up=can_edit,
        run_id=report.run_id,
        runs=_run_options(_runs(session, report.ttx_id)),
        can_see_session=can_edit if can_see_session is None else can_see_session,
    )


def get_report(session: Session, ttx: TTX, user: User) -> AarRead:
    _require(can_read(session, user, ttx))
    report = find_report(session, ttx.id)
    if report is None:
        raise AppException("AAR_NOT_STARTED", "The after-action report hasn't been started.", 404)
    writes = can_write(session, user, ttx)
    access = _access(session, user, ttx)
    controls = access is not None and TTXContextRole.CONTROLLER.value in access.context_roles()
    return report_read(session, report, can_edit=writes, can_see_session=writes or controls)


def _runs(session: Session, ttx_id: uuid.UUID) -> list[ExerciseRun]:
    """The sessions a report can be written from, the default first: the
    current one, then the archived ones, latest first."""
    return list(
        session.exec(
            select(ExerciseRun)
            .where(ExerciseRun.ttx_id == ttx_id)
            .order_by(ExerciseRun.archived_at.is_not(None), ExerciseRun.number.desc())
        )
    )


def _run_options(runs: list[ExerciseRun]) -> list[AarRunOption]:
    return [
        AarRunOption(
            id=r.id,
            number=r.number,
            current=r.archived_at is None,
            status=r.status.value,
            started_at=r.started_at,
        )
        for r in runs
    ]


def _report_run(session: Session, ttx: TTX, run_id: uuid.UUID | None) -> ExerciseRun:
    runs = _runs(session, ttx.id)
    if not runs:
        raise _refuse("RUN_NOT_STARTED", "The session hasn't started.")
    if run_id is None:
        return runs[0]
    for run in runs:
        if run.id == run_id:
            return run
    raise _refuse("RUN_NOT_FOUND", "That session isn't one of this exercise's.", 404)


def preview_report(session: Session, ttx: TTX, user: User) -> AarPreviewRead:
    """The report before it exists: the objectives it will cover -- the
    default session's plan once one has run, else the latest Session plan,
    else the needs analysis -- and the sessions it can start from (an
    archived one too: a restart doesn't take the chance of a report)."""
    _require(can_read(session, user, ttx))
    runs = _runs(session, ttx.id)
    run = runs[0] if runs else None
    snapshot = (
        session.get(ConductPrepSnapshot, run.plan_snapshot_id)
        if run is not None
        else latest_prep_snapshot(session, ttx.id)
    )
    if snapshot is not None:
        objectives = [
            AarPreviewObjective(code=e["code"], title=e.get("title") or e["statement"])
            for e in snapshot.payload.get("eeg", [])
            if not e.get("orphaned")
        ]
    else:
        objectives = [
            AarPreviewObjective(code=o.code, title=o.title or o.statement)
            for o in session.exec(
                select(TTXObjective)
                .join(TTXNeedsForm, TTXNeedsForm.id == TTXObjective.form_id)
                .where(TTXNeedsForm.ttx_id == ttx.id)
                .order_by(TTXObjective.position)
            )
        ]
    return AarPreviewRead(
        session_started=run is not None,
        can_edit=can_write(session, user, ttx) and ttx.archived_at is None,
        objectives=objectives,
        runs=_run_options(runs),
    )


def _lines(rows: list[tuple[str, str, str]]) -> str:
    """ "- point — why (who)" lines for the authors to edit."""
    return "\n".join(
        f"- {point}" + (f" — {why}" if why else "") + (f" ({who})" if who else "")
        for point, why, who in rows
    )


def _seed(session: Session, run: ExerciseRun) -> tuple[list[AfterActionObjective], str]:
    """What a session says per objective of its plan, unsaved and in plan
    order: the most frequent level rated, what went well (points rated P or
    S) and what to improve (points rated M or U, expected actions missed or
    partial), the table's decisions in the analysis of the objectives their
    inject serves -- and those of an inject serving none, for the
    conclusions."""
    msel = session.get(MselSnapshot, run.msel_snapshot_id).payload
    plan = session.get(ConductPrepSnapshot, run.plan_snapshot_id).payload
    ratings = session.exec(select(RunRating).where(RunRating.run_id == run.id)).all()
    names = {
        u.id: u.full_name
        for u in session.exec(select(User).where(User.id.in_({r.evaluator_id for r in ratings})))
    }
    by_point: dict[str, list[RunRating]] = {}
    for rating in ratings:
        by_point.setdefault(str(rating.point_id), []).append(rating)
    marks: dict[str, str] = {}
    for event in session.exec(
        select(RunEvent)
        .where(RunEvent.run_id == run.id, RunEvent.type == RunEventType.ACTION_MARKED)
        .order_by(RunEvent.seq)
    ):
        marks[event.payload["action_code"]] = event.payload["mark"]

    inject_objectives = {
        i["code"]: {str(o) for o in i.get("objective_ids", [])} for i in msel["injects"]
    }
    decisions, _ = decision_log(session, run)
    placed: set[str] = set()
    objectives: list[AfterActionObjective] = []
    for position, eeg in enumerate(e for e in plan["eeg"] if not e.get("orphaned")):
        decided = [
            d
            for d in decisions
            if str(eeg.get("objective_id")) in inject_objectives.get(d.inject_code, set())
        ]
        placed.update(d.id for d in decided)
        strong, weak, levels = [], [], Counter()
        for point in eeg["points"]:
            for rating in by_point.get(str(point["id"]), []):
                levels[rating.level] += 1
                # A room by its code; the plenary needs no mark.
                room = rating.room_code if rating.room_code not in ("", "main") else ""
                text = f"{room}: {point['text']}" if room else point["text"]
                row = (text, rating.rationale, names.get(rating.evaluator_id, ""))
                (strong if rating.level in _STRONG else weak).append(row)
            mark = marks.get(point.get("source_action_code") or "")
            if mark in ("partial", "not_observed"):
                weak.append((point["text"], mark.replace("_", " "), ""))
        objectives.append(
            AfterActionObjective(
                position=position,
                objective_code=eeg["code"],
                title=eeg.get("title") or eeg["statement"],
                overall=levels.most_common(1)[0][0] if levels else None,
                strengths=_lines(strong),
                improvements=_lines(weak),
                analysis=_lines([(d.text, d.inject_code, "") for d in decided]),
            )
        )
    unplaced = [d for d in decisions if d.id not in placed]
    return objectives, _lines([(d.text, d.inject_code, "") for d in unplaced])


def create_report(
    session: Session, ttx: TTX, user: User, run_id: uuid.UUID | None = None
) -> AarRead:
    """Start the report from a session -- `run_id`, else the current one,
    else the latest archived one -- seeded with what it says (`_seed`)."""
    _require(can_write(session, user, ttx))
    if find_report(session, ttx.id) is not None:
        raise _refuse("AAR_EXISTS", "This exercise already has an after-action report.")
    run = _report_run(session, ttx, run_id)
    msel = session.get(MselSnapshot, run.msel_snapshot_id).payload
    objectives, conclusions = _seed(session, run)
    report = AfterActionReport(
        ttx_id=ttx.id,
        run_id=run.id,
        executive_summary=msel.get("title", ""),
        scenario_summary=msel.get("summary", ""),
        conclusions=conclusions,
        updated_by_id=user.id,
    )
    session.add(report)
    session.flush()
    for objective in objectives:
        objective.report_id = report.id
        session.add(objective)
    session.commit()
    logger.info("After-action report of TTX %s started by user %s.", ttx.id, user.id)
    return report_read(session, report, can_edit=True)


def _written(objective: AfterActionObjective) -> bool:
    return objective.overall is not None or any(
        text.strip() for text in (objective.strengths, objective.improvements, objective.analysis)
    )


def change_run(session: Session, ttx: TTX, user: User, run_id: uuid.UUID, revision: int) -> AarRead:
    """Write the report from another session: what's written stays, the
    session's ratings, feedback and notes beside it become that session's,
    and its objectives follow that session's plan -- the ones it adds come
    seeded from it, the ones it drops go if nothing was written in them
    (refused otherwise)."""
    _require(can_write(session, user, ttx))
    report = find_report(session, ttx.id)
    if report is None:
        raise AppException("AAR_NOT_STARTED", "The after-action report hasn't been started.", 404)
    if revision != report.revision:
        raise _refuse(
            "AAR_STALE",
            "Someone else saved this report since you opened it. Reload to see their changes.",
        )
    run = _report_run(session, ttx, run_id)
    if run.id == report.run_id:
        return report_read(session, report, can_edit=True)

    seeded, _ = _seed(session, run)
    codes = {o.objective_code for o in seeded}
    current = {
        o.objective_code: o
        for o in session.exec(
            select(AfterActionObjective).where(AfterActionObjective.report_id == report.id)
        )
    }
    cited = set(
        session.exec(
            select(ImprovementAction.objective_code).where(ImprovementAction.report_id == report.id)
        )
    )
    in_use = sorted(
        code for code, o in current.items() if code not in codes and (code in cited or _written(o))
    )
    if in_use:
        raise _refuse(
            "AAR_OBJECTIVES_IN_USE",
            "These objectives aren't in that session's plan and already hold text or actions: "
            "{codes}.",
            params={"codes": ", ".join(in_use)},
        )
    for code, objective in current.items():
        if code not in codes:
            session.delete(objective)
    for fresh in seeded:
        kept = current.get(fresh.objective_code)
        if kept is None:
            fresh.report_id = report.id
            session.add(fresh)
        else:
            kept.title, kept.position = fresh.title, fresh.position
            session.add(kept)

    report.run_id = run.id
    _reopen(report)
    _touch(report, user)
    session.add(report)
    _discard_proposals(session, ttx)
    session.commit()
    logger.info(
        "After-action report of TTX %s moved to run %s by user %s.", ttx.id, run.id, user.id
    )
    return report_read(session, report, can_edit=True)


def _discard_proposals(session: Session, ttx: TTX) -> None:
    """The AI assistant's pending proposals for the report cite the session
    it was written from: they go when it moves to another."""
    for proposal in session.exec(
        select(AssistantProposal).where(
            AssistantProposal.ttx_id == ttx.id,
            AssistantProposal.status == "pending",
            col(AssistantProposal.target).startswith("aar_"),
        )
    ):
        proposal.status = "discarded"
        proposal.decided_at = datetime.now(UTC)
        session.add(proposal)


def _reopen(report: AfterActionReport) -> None:
    """An edit to a FINAL report opens the next version."""
    if report.status == AarStatus.FINAL:
        report.status = AarStatus.DRAFT
        report.version += 1
        report.finalized_by = ""
        report.finalized_by_id = None
        report.finalized_at = None


def _touch(report: AfterActionReport, user: User) -> None:
    report.revision += 1
    report.updated_at = datetime.now(UTC)
    report.updated_by_id = user.id


def save_report(session: Session, ttx: TTX, user: User, payload: AarSaveRequest) -> AarRead:
    _require(can_write(session, user, ttx))
    report = find_report(session, ttx.id)
    if report is None:
        raise AppException("AAR_NOT_STARTED", "The after-action report hasn't been started.", 404)
    if payload.revision != report.revision:
        raise _refuse(
            "AAR_STALE",
            "Someone else saved this report since you opened it. Reload to see their changes.",
        )
    report.executive_summary = payload.executive_summary
    report.scenario_summary = payload.scenario_summary
    report.conclusions = payload.conclusions

    objectives = {
        o.id: o
        for o in session.exec(
            select(AfterActionObjective).where(AfterActionObjective.report_id == report.id)
        )
    }
    for item in payload.objectives:
        objective = objectives.get(item.id)
        if objective is None:
            raise _refuse("AAR_UNKNOWN_OBJECTIVE", "That objective isn't in this report.", 422)
        objective.overall = item.overall
        objective.strengths = item.strengths
        objective.improvements = item.improvements
        objective.analysis = item.analysis
        session.add(objective)

    codes = {o.objective_code for o in objectives.values()}
    existing = {
        a.id: a
        for a in session.exec(
            select(ImprovementAction).where(ImprovementAction.report_id == report.id)
        )
    }
    kept: set[uuid.UUID] = set()
    for position, item in enumerate(payload.actions):
        if item.objective_code is not None and item.objective_code not in codes:
            raise _refuse("AAR_UNKNOWN_OBJECTIVE", "That objective isn't in this report.", 422)
        if item.id is not None:
            action = existing.get(item.id)
            if action is None:
                raise _refuse("AAR_UNKNOWN_ACTION", "That action isn't in this report.", 422)
        else:
            action = ImprovementAction(
                report_id=report.id, code=f"IP-{report.next_action_number:02d}"
            )
            report.next_action_number += 1
        action.position = position
        for field in (
            "objective_code", "finding", "action", "owner", "owner_area", "due_date", "status",
            "status_note",
        ):  # fmt: skip
            setattr(action, field, getattr(item, field))
        action.updated_at = datetime.now(UTC)
        session.add(action)
        session.flush()
        kept.add(action.id)
    for action_id, action in existing.items():
        if action_id not in kept:
            session.delete(action)

    _reopen(report)
    _touch(report, user)
    session.add(report)
    session.commit()
    return report_read(session, report, can_edit=True)


def transition(session: Session, ttx: TTX, user: User, to: str) -> AarRead:
    """FINAL freezes this version (a snapshot); back to DRAFT opens the next."""
    _require(can_write(session, user, ttx))
    report = find_report(session, ttx.id)
    if report is None:
        raise AppException("AAR_NOT_STARTED", "The after-action report hasn't been started.", 404)
    if to == "final":
        if report.status == AarStatus.FINAL:
            raise _refuse("AAR_ALREADY_FINAL", "This version is already final.")
        report.status = AarStatus.FINAL
        report.finalized_by = user.full_name
        report.finalized_by_id = user.id
        report.finalized_at = datetime.now(UTC)
        _touch(report, user)
        session.add(report)
        session.flush()
        frozen = report_read(session, report, can_edit=False).model_dump(
            mode="json", exclude={"can_edit", "can_see_session", "runs"}
        )
        session.add(
            AfterActionSnapshot(
                report_id=report.id, version=report.version, payload=frozen, created_by_id=user.id
            )
        )
    else:
        if report.status == AarStatus.DRAFT:
            raise _refuse("AAR_ALREADY_DRAFT", "This report is already a draft.")
        _reopen(report)
        _touch(report, user)
        session.add(report)
    session.commit()
    return report_read(session, report, can_edit=True)


def follow_up(
    session: Session,
    ttx: TTX,
    user: User,
    code: str,
    status: ImprovementStatus,
    status_note: str,
    due_date: date | None,
    retest: tuple[uuid.UUID | None, uuid.UUID | None] | None = None,
) -> AarRead:
    """How an action is going -- in a FINAL report too: following the plan
    up isn't editing the report. `retest` (exercise, objective) relinks it
    when given."""
    _require(can_write(session, user, ttx))
    report = find_report(session, ttx.id)
    if report is None:
        raise AppException("AAR_NOT_STARTED", "The after-action report hasn't been started.", 404)
    action = session.exec(
        select(ImprovementAction).where(
            ImprovementAction.report_id == report.id, ImprovementAction.code == code
        )
    ).first()
    if action is None:
        raise AppException("AAR_UNKNOWN_ACTION", "That action isn't in this report.", 404)
    action.status = status
    action.status_note = status_note.strip()
    action.due_date = due_date
    if retest is not None:
        _link_retest(session, ttx, action, *retest)
    action.updated_at = datetime.now(UTC)
    session.add(action)
    _touch(report, user)
    session.add(report)
    session.commit()
    return report_read(session, report, can_edit=True)


def _later_exercises(session: Session, source: TTX) -> list[TTX]:
    """The organization's exercises created after `source`: those that can
    re-test its improvement actions."""
    return list(
        session.exec(
            select(TTX)
            .where(
                TTX.organization_id == source.organization_id,
                TTX.id != source.id,
                TTX.created_at > source.created_at,
            )
            .order_by(TTX.created_at, TTX.code)
        )
    )


def _link_retest(
    session: Session,
    source: TTX,
    action: ImprovementAction,
    ttx_id: uuid.UUID | None,
    objective_id: uuid.UUID | None,
) -> None:
    if ttx_id is None:
        if objective_id is not None:
            raise _refuse(
                "RETEST_INVALID_OBJECTIVE", "That objective isn't one of that exercise's.", 422
            )
        action.retest_ttx_id = action.retest_objective_id = None
        return
    target = session.get(TTX, ttx_id)
    if (
        target is None
        or target.organization_id != source.organization_id
        or target.id == source.id
        or target.created_at <= source.created_at
    ):
        raise _refuse(
            "RETEST_INVALID_EXERCISE",
            "An action is re-tested by a later exercise of the same organization.",
            422,
        )
    if objective_id is not None:
        in_target = session.exec(
            select(TTXObjective.id)
            .join(TTXNeedsForm, TTXNeedsForm.id == TTXObjective.form_id)
            .where(TTXObjective.id == objective_id, TTXNeedsForm.ttx_id == target.id)
        ).first()
        if in_target is None:
            raise _refuse(
                "RETEST_INVALID_OBJECTIVE", "That objective isn't one of that exercise's.", 422
            )
    action.retest_ttx_id, action.retest_objective_id = target.id, objective_id


def retest_candidates(session: Session, source: TTX) -> list[RetestCandidate]:
    """What an action of `source` can be linked to: each later exercise's
    code, name and objectives -- deliberately nothing else, since whoever
    links it may hold no seat on that exercise."""
    exercises = _later_exercises(session, source)
    objectives: dict[uuid.UUID, list[RetestObjectiveOption]] = {}
    if exercises:
        for objective, form in session.exec(
            select(TTXObjective, TTXNeedsForm)
            .join(TTXNeedsForm, TTXNeedsForm.id == TTXObjective.form_id)
            .where(TTXNeedsForm.ttx_id.in_([t.id for t in exercises]))
            .order_by(TTXObjective.position)
        ):
            objectives.setdefault(form.ttx_id, []).append(
                RetestObjectiveOption(id=objective.id, code=objective.code, title=objective.title)
            )
    return [
        RetestCandidate(
            ttx_id=t.id,
            ttx_code=t.code,
            ttx_name=t.name,
            archived=t.archived_at is not None,
            objectives=objectives.get(t.id, []),
        )
        for t in exercises
    ]


def candidates_for_action(session: Session, user: User, ttx: TTX) -> list[RetestCandidate]:
    """The report's authors pick where its actions are re-tested."""
    _require(can_write(session, user, ttx))
    return retest_candidates(session, ttx)


def _organization_action(
    session: Session, organization_id: uuid.UUID, action_id: uuid.UUID
) -> tuple[ImprovementAction, TTX]:
    row = session.exec(
        select(ImprovementAction, TTX)
        .join(AfterActionReport, AfterActionReport.id == ImprovementAction.report_id)
        .join(TTX, TTX.id == AfterActionReport.ttx_id)
        .where(ImprovementAction.id == action_id, TTX.organization_id == organization_id)
    ).first()
    if row is None:
        raise AppException("AAR_UNKNOWN_ACTION", "That action isn't in this report.", 404)
    return row


def organization_action_candidates(
    session: Session, organization_id: uuid.UUID, action_id: uuid.UUID
) -> list[RetestCandidate]:
    _, source = _organization_action(session, organization_id, action_id)
    return retest_candidates(session, source)


def link_retest_as_program_manager(
    session: Session,
    organization_id: uuid.UUID,
    action_id: uuid.UUID,
    ttx_id: uuid.UUID | None,
    objective_id: uuid.UUID | None,
) -> ImprovementPlanRow:
    """A Program Manager links an action of any of the organization's
    reports (oversight of the plan; never reopens the report)."""
    action, source = _organization_action(session, organization_id, action_id)
    _link_retest(session, source, action, ttx_id, objective_id)
    action.updated_at = datetime.now(UTC)
    session.add(action)
    session.commit()
    report = session.get(AfterActionReport, action.report_id)
    return _plan_row(session, action, report, source, datetime.now(UTC).date())


def retested_by(session: Session, ttx: TTX) -> list[RetestedAction]:
    """The improvement actions of earlier exercises this one re-tests."""
    rows = session.exec(
        select(ImprovementAction, TTX)
        .join(AfterActionReport, AfterActionReport.id == ImprovementAction.report_id)
        .join(TTX, TTX.id == AfterActionReport.ttx_id)
        .where(ImprovementAction.retest_ttx_id == ttx.id)
        .order_by(TTX.created_at, ImprovementAction.position)
    ).all()
    retests = _retests(session, [action for action, _ in rows])
    result = []
    for action, source in rows:
        retest = retests.get(action.id)
        result.append(
            RetestedAction(
                source_ttx_id=source.id,
                source_ttx_code=source.code,
                source_ttx_name=source.name,
                code=action.code,
                finding=action.finding,
                action=action.action,
                status=action.status,
                objective_id=retest.objective_id if retest else None,
                objective_code=retest.objective_code if retest else None,
                objective_title=retest.objective_title if retest else None,
            )
        )
    return result


def _plan_row(
    session: Session,
    action: ImprovementAction,
    report: AfterActionReport,
    ttx: TTX,
    today: date,
    retest: RetestRead | None = None,
) -> ImprovementPlanRow:
    if retest is None and action.retest_ttx_id is not None:
        retest = _retests(session, [action]).get(action.id)
    return ImprovementPlanRow(
        id=action.id,
        ttx_id=ttx.id,
        ttx_code=ttx.code,
        ttx_name=ttx.name,
        report_status=report.status,
        code=action.code,
        objective_code=action.objective_code,
        finding=action.finding,
        action=action.action,
        owner=action.owner,
        owner_area=action.owner_area,
        due_date=action.due_date,
        status=action.status,
        overdue=_overdue(action, today),
        retest=retest,
    )


def organization_plan(
    session: Session,
    organization_id: uuid.UUID,
    *,
    status: ImprovementStatus | None,
    overdue: bool,
    q: str | None,
    limit: int,
    offset: int,
    retest: str | None = None,
) -> ImprovementPlanListResponse:
    """Every improvement action of the organization's exercises, soonest
    due first (undated last), for its Program Managers."""
    today = datetime.now(UTC).date()
    base = (
        select(ImprovementAction, AfterActionReport, TTX)
        .join(AfterActionReport, AfterActionReport.id == ImprovementAction.report_id)
        .join(TTX, TTX.id == AfterActionReport.ttx_id)
        .where(TTX.organization_id == organization_id)
    )
    open_filter = ImprovementAction.status.not_in(_CLOSED)
    overdue_filter = (ImprovementAction.due_date < today) & open_filter
    query = base
    if status is not None:
        query = query.where(ImprovementAction.status == status)
    if overdue:
        query = query.where(overdue_filter)
    if retest == "linked":
        query = query.where(ImprovementAction.retest_ttx_id.is_not(None))
    elif retest == "unlinked":
        query = query.where(ImprovementAction.retest_ttx_id.is_(None))
    if q:
        like = f"%{q.strip()}%"
        query = query.where(
            or_(
                ImprovementAction.action.ilike(like),
                ImprovementAction.finding.ilike(like),
                ImprovementAction.owner.ilike(like),
                ImprovementAction.owner_area.ilike(like),
                TTX.name.ilike(like),
                TTX.code.ilike(like),
            )
        )
    total = session.exec(select(func.count()).select_from(query.subquery())).one()
    rows = session.exec(
        query.order_by(
            ImprovementAction.due_date.is_(None),
            ImprovementAction.due_date,
            TTX.code,
            ImprovementAction.position,
        )
        .limit(limit)
        .offset(offset)
    ).all()

    def count(where) -> int:
        return session.exec(select(func.count()).select_from(base.where(where).subquery())).one()

    retests = _retests(session, [action for action, _, _ in rows])
    return ImprovementPlanListResponse(
        items=[
            _plan_row(session, action, report, ttx, today, retests.get(action.id))
            for action, report, ttx in rows
        ],
        total=total,
        open=count(open_filter),
        overdue=count(overdue_filter),
    )


def delete_reports_for_ttx(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """Every report of these exercises with its rows -- before their runs."""
    if not ttx_ids:
        return
    report_ids = list(
        session.exec(select(AfterActionReport.id).where(AfterActionReport.ttx_id.in_(ttx_ids)))
    )
    if not report_ids:
        return
    for model in (AfterActionObjective, ImprovementAction, AfterActionSnapshot):
        for row in session.exec(select(model).where(model.report_id.in_(report_ids))):
            session.delete(row)
    session.flush()
    for report in session.exec(
        select(AfterActionReport).where(AfterActionReport.id.in_(report_ids))
    ):
        session.delete(report)
    session.flush()
