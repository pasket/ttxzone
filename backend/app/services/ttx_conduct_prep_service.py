"""Session plan (Creator -> Session plan): the evaluation plan and the
preparation of the session, once the needs analysis and the MSEL say what
is validated and how it is provoked.

Same shape as the MSEL (ttx_msel_service), on purpose:
- one plan per TTX, created lazily the first time it's opened with an
  approved needs form; its definitive EEGs are seeded then -- one per
  objective, a point per clause of the success criterion and per expected
  action of the latest READY MSEL. A seeded point's text is its source's
  (edited in the needs analysis or the MSEL, never here); the plan adds
  how each point is rated (P/S/M/U) and points of its own;
- the whole plan is saved at once (full replace keyed by id), under an
  optimistic `revision` lock;
- the backend is the authority on the rules: saving rejects only what can
  never be stored, everything else is the validation report (rules
  E01-E47 below), enforced on DRAFT -> READY and available as a dry run;
- any edit past DRAFT sends it back to DRAFT (from READY it opens version
  N+1); becoming READY freezes a snapshot, which Control and Execution
  rate with.

When the needs analysis or the READY MSEL change after seeding, the plan
says so (drift) and the re-seed merges the new sources in without losing
what was written here. Editable only while the needs analysis is APPROVED.
"""

import logging
import uuid
from datetime import UTC, date, datetime
from types import SimpleNamespace
from zoneinfo import ZoneInfo

from sqlalchemy import delete
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import (
    TTX,
    AccessRequestStatus,
    ConductPrepAttendee,
    ConductPrepEegObjective,
    ConductPrepEegPoint,
    ConductPrepEvaluator,
    ConductPrepEvaluatorObjective,
    ConductPrepFinding,
    ConductPrepSnapshot,
    ConductPrepStatus,
    EegPointKind,
    Inject,
    InjectKind,
    InjectReviewStatus,
    MselPhase,
    NeedsFormStatus,
    RoleEnum,
    SessionModality,
    TTXAccess,
    TTXAccessRequest,
    TTXConductPrep,
    TTXNeedsForm,
    TTXObjective,
    User,
    evaluator_access,
)
from app.schemas.ttx_conduct_prep import (
    AttendeeRead,
    CodedOption,
    ConductPrepContext,
    ConductPrepDrift,
    ConductPrepRead,
    ConductPrepSaveRequest,
    EegObjectiveRead,
    EegPointRead,
    EvaluatorRead,
    FindingRead,
    PersonOption,
    PlayerOption,
)
from app.schemas.ttx_msel import action_objective_ids
from app.schemas.ttx_needs_form import ValidationIssue, ValidationReport
from app.services.eeg_service import observation_points
from app.services.notification_reference import is_notification, notification_point_text
from app.services.ttx_msel_service import find_msel, latest_snapshot
from app.services.ttx_needs_form_service import _VAGUE_PATTERN, get_form

logger = logging.getLogger(__name__)

# Steps of the page -- a ValidationIssue's `section`, in the page's order.
EVALUATION, VALIDATION, SESSION, DOCUMENTS, REVIEW = 1, 2, 3, 4, 5

# The evaluation calendar, in the order its dates must keep.
CALENDAR_FIELDS = (
    "hot_wash_days",
    "debrief_days",
    "ratings_due_days",
    "draft_aar_days",
    "after_action_meeting_days",
)

# How a new plan collects data: the usual set for a discussion-based
# exercise -- notes against the EEG, the hot wash, the feedback forms.
DEFAULT_DATA_COLLECTION = ("observation_notes", "hot_wash", "feedback_forms")

# How a new plan's stop procedure starts, in the creator's language.
DEFAULT_STOP_PROCEDURE = {
    "en": (
        "Anyone may stop the exercise for a real-world incident or a safety concern by "
        "saying the stop keyword aloud. The Controller halts play, confirms the situation "
        "with the Exercise Program Manager and announces whether the exercise pauses, "
        "resumes or ends. Real-world communications always take priority over the exercise."
    ),
    "es": (
        "Cualquier persona puede detener el ejercicio ante un incidente real o un problema "
        "de seguridad diciendo en voz alta la palabra de parada. El Controlador detiene el "
        "juego, confirma la situación con el Responsable del Programa de Ejercicios y anuncia "
        "si el ejercicio se pausa, se reanuda o termina. Las comunicaciones reales siempre "
        "tienen prioridad sobre el ejercicio."
    ),
}


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


def _not_approved(ttx: TTX, message: str) -> AppException:
    return AppException(
        "NEEDS_FORM_NOT_APPROVED", message, 409, ttx_id=str(ttx.id), log_level=logging.INFO
    )


# -- reads ----------------------------------------------------------------


def find_prep(session: Session, ttx_id: uuid.UUID, *, lock: bool = False) -> TTXConductPrep | None:
    query = select(TTXConductPrep).where(TTXConductPrep.ttx_id == ttx_id)
    if lock:
        query = query.with_for_update()
    return session.exec(query).first()


def latest_prep_snapshot(session: Session, ttx_id: uuid.UUID) -> ConductPrepSnapshot | None:
    return session.exec(
        select(ConductPrepSnapshot)
        .join(TTXConductPrep, TTXConductPrep.id == ConductPrepSnapshot.prep_id)
        .where(TTXConductPrep.ttx_id == ttx_id)
        .order_by(ConductPrepSnapshot.version.desc(), ConductPrepSnapshot.created_at.desc())
    ).first()


def _objectives(session: Session, form: TTXNeedsForm) -> list[TTXObjective]:
    return list(
        session.exec(
            select(TTXObjective)
            .where(TTXObjective.form_id == form.id)
            .order_by(TTXObjective.position)
        )
    )


def _snapshot_actions(snapshot) -> dict[str, list[dict]]:
    """The READY MSEL's expected actions per objective id (each once under
    every objective it evidences, in MSEL order), with their inject."""
    by_objective: dict[str, list[dict]] = {}
    if snapshot is None:
        return by_objective
    for inject in snapshot.payload["injects"]:
        for action in inject["expected_actions"]:
            for objective_id in action_objective_ids(action, inject):
                by_objective.setdefault(objective_id, []).append(
                    {**action, "inject_code": inject["code"], "inject_title": inject["title"]}
                )
    return by_objective


class _Upstream:
    """What the definitive EEGs are built from, as it is now: the needs
    analysis' objectives and the latest READY MSEL."""

    def __init__(self, session: Session, ttx: TTX, form: TTXNeedsForm) -> None:
        self.form = form
        self.objectives = _objectives(session, form)
        self.objective_ids = {o.id for o in self.objectives}
        self.clauses = {o.id: observation_points(o.success_criterion) for o in self.objectives}
        self.notifications = {
            o.id: [r for r in (o.regulatory_requirement_ids or []) if is_notification(r)]
            for o in self.objectives
        }
        self.snapshot = latest_snapshot(session, ttx.id)
        self.snapshot_version = self.snapshot.version if self.snapshot else None
        self.actions = _snapshot_actions(self.snapshot)
        # Per objective: an action that stops evidencing an objective
        # orphans its point there, even while other EEGs still list it.
        self.action_text = {
            (objective_id, str(a["id"])): a["description"]
            for objective_id, rows in self.actions.items()
            for a in rows
        }

    def point_status(
        self,
        kind: EegPointKind,
        text: str,
        source_text: str,
        action_id,
        objective_id,
        requirement_id: str = "",
    ):
        if kind == EegPointKind.CUSTOM:
            return "custom"
        if kind == EegPointKind.NOTIFICATION:
            if requirement_id not in self.notifications.get(objective_id, []):
                return "orphaned"
        elif kind == EegPointKind.CRITERION:
            if source_text not in self.clauses.get(objective_id, []):
                return "orphaned"
        else:
            upstream = self.action_text.get((str(objective_id), str(action_id)))
            if upstream is None:
                return "orphaned"
            if upstream != source_text:
                return "changed"
        return "current"


def _criterion_point(clause: str) -> ConductPrepEegPoint:
    return ConductPrepEegPoint(kind=EegPointKind.CRITERION, text=clause, source_text=clause)


def _notification_point(requirement_id: str, spanish: bool) -> ConductPrepEegPoint:
    text = notification_point_text(requirement_id, spanish)
    return ConductPrepEegPoint(
        kind=EegPointKind.NOTIFICATION,
        text=text,
        source_text=text,
        source_requirement_id=requirement_id,
    )


def _action_point(action: dict) -> ConductPrepEegPoint:
    point = ConductPrepEegPoint(kind=EegPointKind.EXPECTED_ACTION)
    _write_action_source(point, action)
    point.text = action["description"]
    return point


def _write_action_source(point: ConductPrepEegPoint, action: dict) -> None:
    point.source_text = action["description"]
    point.source_action_id = uuid.UUID(str(action["id"]))
    point.source_action_code = action["code"]
    point.source_inject_code = action["inject_code"]
    point.source_inject_title = action["inject_title"][:255]
    point.responsible_role = action["responsible_role"]
    point.expected_within_minutes = action["expected_within_minutes"]


def _new_eeg_objective(prep: TTXConductPrep, objective: TTXObjective) -> ConductPrepEegObjective:
    return ConductPrepEegObjective(
        prep_id=prep.id,
        objective_id=objective.id,
        code=objective.code,
        title=objective.title,
        statement=objective.statement,
        capability=objective.capability.value if objective.capability else "",
    )


def _eeg_rows(session: Session, prep: TTXConductPrep):
    objectives = list(
        session.exec(
            select(ConductPrepEegObjective)
            .where(ConductPrepEegObjective.prep_id == prep.id)
            .order_by(ConductPrepEegObjective.position)
        )
    )
    points: dict[uuid.UUID, list[ConductPrepEegPoint]] = {o.id: [] for o in objectives}
    if objectives:
        for point in session.exec(
            select(ConductPrepEegPoint)
            .where(ConductPrepEegPoint.eeg_objective_id.in_(list(points)))
            .order_by(ConductPrepEegPoint.position)
        ):
            points[point.eeg_objective_id].append(point)
    return objectives, points


def _evaluator_rows(session: Session, prep: TTXConductPrep):
    evaluators = list(
        session.exec(
            select(ConductPrepEvaluator)
            .where(ConductPrepEvaluator.prep_id == prep.id)
            .order_by(ConductPrepEvaluator.position)
        )
    )
    links: dict[uuid.UUID, list[uuid.UUID]] = {e.id: [] for e in evaluators}
    if evaluators:
        for link in session.exec(
            select(ConductPrepEvaluatorObjective).where(
                ConductPrepEvaluatorObjective.evaluator_id.in_(list(links))
            )
        ):
            links[link.evaluator_id].append(link.eeg_objective_id)
    return evaluators, links


def _ordered(session: Session, model, prep: TTXConductPrep) -> list:
    return list(
        session.exec(select(model).where(model.prep_id == prep.id).order_by(model.position))
    )


def _people(
    session: Session, ttx: TTX
) -> tuple[list[PersonOption], list[PersonOption], list[PersonOption], PersonOption | None]:
    rows = session.exec(
        select(TTXAccess, User)
        .join(User, User.id == TTXAccess.user_id)
        .where(
            TTXAccess.ttx_id == ttx.id,
            TTXAccess.role.in_([RoleEnum.EVALUATOR, RoleEnum.PLANNER]),
        )
        .order_by(User.full_name)
    ).all()
    evaluators = [
        PersonOption(user_id=u.id, full_name=u.full_name) for a, u in rows if a.is_evaluator
    ]
    team = [
        PersonOption(user_id=u.id, full_name=u.full_name)
        for a, u in rows
        if a.role == RoleEnum.PLANNER
    ]
    controllers = [
        PersonOption(user_id=u.id, full_name=u.full_name)
        for a, u in rows
        if a.role == RoleEnum.PLANNER and a.controls
    ]
    lead = next(
        (PersonOption(user_id=u.id, full_name=u.full_name) for a, u in rows if a.leads), None
    )
    return evaluators, team, controllers, lead


def _players(session: Session, ttx: TTX) -> tuple[list[PlayerOption], int]:
    """The exercise's Players (who used an invitation and were let in, or
    were added another way) with when, and the requests still waiting."""
    invited: dict[uuid.UUID, datetime] = {}
    for request in session.exec(
        select(TTXAccessRequest).where(
            TTXAccessRequest.ttx_id == ttx.id,
            TTXAccessRequest.status == AccessRequestStatus.APPROVED,
        )
    ):
        if request.user_id not in invited or request.created_at > invited[request.user_id]:
            invited[request.user_id] = request.created_at
    players = [
        PlayerOption(
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            invited_at=invited.get(user.id),
            joined_at=access.created_at,
        )
        for access, user in session.exec(
            select(TTXAccess, User)
            .join(User, User.id == TTXAccess.user_id)
            .where(TTXAccess.ttx_id == ttx.id, TTXAccess.role == RoleEnum.PLAYER)
            .order_by(User.full_name)
        )
    ]
    pending = len(
        session.exec(
            select(TTXAccessRequest.id).where(
                TTXAccessRequest.ttx_id == ttx.id,
                TTXAccessRequest.status == AccessRequestStatus.PENDING,
            )
        ).all()
    )
    return players, pending


def _context(
    session: Session, ttx: TTX, form: TTXNeedsForm, upstream: _Upstream
) -> ConductPrepContext:
    msel = find_msel(session, ttx.id)
    phases: list[CodedOption] = []
    injects: list[CodedOption] = []
    mandatory = validated = 0
    if msel is not None:
        phases = [
            CodedOption(id=p.id, code=p.code, title=p.name)
            for p in session.exec(
                select(MselPhase).where(MselPhase.msel_id == msel.id).order_by(MselPhase.position)
            )
        ]
        for inject in session.exec(
            select(Inject).where(Inject.msel_id == msel.id).order_by(Inject.position)
        ):
            injects.append(CodedOption(id=inject.id, code=inject.code, title=inject.title))
            if inject.kind == InjectKind.MANDATORY:
                mandatory += 1
                validated += inject.review_status == InjectReviewStatus.VALIDATED
    evaluators, team, controllers, lead = _people(session, ttx)
    players, pending = _players(session, ttx)
    return ConductPrepContext(
        tlp=form.tlp,
        needs_form_status=form.status,
        needs_form_version=form.version,
        date_window_start=form.date_window_start,
        date_window_end=form.date_window_end,
        max_duration_hours=form.max_duration_hours,
        stop_exercise_keyword=form.stop_exercise_keyword,
        participating_areas=list(form.participating_areas),
        msel_status=msel.status if msel else None,
        msel_ready_version=upstream.snapshot_version,
        msel_exercise_start=msel.exercise_start if msel else None,
        msel_duration_minutes=msel.duration_minutes if msel else None,
        mandatory_injects=mandatory,
        mandatory_injects_validated=validated,
        lead_evaluator=lead,
        exercise_evaluators=evaluators,
        team_members=team,
        exercise_controllers=controllers,
        phases=phases,
        injects=injects,
        exercise_players=players,
        pending_access_requests=pending,
    )


def _drift(prep: TTXConductPrep, form: TTXNeedsForm, upstream: _Upstream) -> ConductPrepDrift:
    return ConductPrepDrift(
        needs_changed=form.status == NeedsFormStatus.APPROVED
        and form.version != prep.seeded_needs_form_version,
        msel_changed=upstream.snapshot_version != prep.seeded_msel_version,
    )


def session_starts_at(prep) -> datetime | None:
    if prep.session_date is None or prep.session_time is None or not prep.timezone:
        return None
    local = datetime.combine(prep.session_date, prep.session_time, ZoneInfo(prep.timezone))
    return local.astimezone(UTC)


def _attendee_read(attendee: ConductPrepAttendee, names: dict) -> AttendeeRead:
    """A Player's name is their account's, as it is now."""
    read = AttendeeRead(**attendee.model_dump(exclude={"prep_id", "position"}))
    if attendee.user_id in names:
        read.name = names[attendee.user_id]
    return read


def prep_read(session: Session, ttx: TTX, prep: TTXConductPrep) -> ConductPrepRead:
    form = get_form(session, ttx.id)
    upstream = _Upstream(session, ttx, form)
    context = _context(session, ttx, form, upstream)
    objectives, points = _eeg_rows(session, prep)
    evaluators, links = _evaluator_rows(session, prep)
    live_titles = {o.id: o.title for o in upstream.objectives}
    names = {p.user_id: p.full_name for p in context.exercise_evaluators}
    player_names = {p.user_id: p.full_name for p in context.exercise_players}
    eeg = [
        EegObjectiveRead(
            id=o.id,
            objective_id=o.objective_id,
            code=o.code,
            # The needs objective's current title: it may be named after
            # the plan was seeded (the copy is what an orphan keeps).
            title=live_titles.get(o.objective_id) or o.title,
            statement=o.statement,
            capability=o.capability,
            orphaned=o.objective_id not in upstream.objective_ids,
            points=[
                EegPointRead(
                    **p.model_dump(exclude={"eeg_objective_id", "position"}),
                    source_status=upstream.point_status(
                        p.kind,
                        p.text,
                        p.source_text,
                        p.source_action_id,
                        o.objective_id,
                        p.source_requirement_id,
                    ),
                )
                for p in points[o.id]
            ],
        )
        for o in objectives
    ]
    read = ConductPrepRead(
        id=prep.id,
        ttx_id=ttx.id,
        exercise_code=ttx.code,
        status=prep.status,
        version=prep.version,
        revision=prep.revision,
        editable=form.status == NeedsFormStatus.APPROVED and ttx.archived_at is None,
        seeded_needs_form_version=prep.seeded_needs_form_version,
        seeded_msel_version=prep.seeded_msel_version,
        drift=_drift(prep, form, upstream),
        context=context,
        eeg=eeg,
        evaluators=[
            EvaluatorRead(
                id=e.id,
                user_id=e.user_id,
                full_name=names.get(e.user_id, ""),
                areas=list(e.areas),
                briefed=e.briefed,
                objective_ids=links[e.id],
            )
            for e in evaluators
        ],
        findings=[
            FindingRead(**f.model_dump(exclude={"prep_id", "position"}))
            for f in _ordered(session, ConductPrepFinding, prep)
        ],
        attendees=[
            _attendee_read(a, player_names) for a in _ordered(session, ConductPrepAttendee, prep)
        ],
        session_starts_at=session_starts_at(prep),
        validation=ValidationReport(ready=[], approved=[], warnings=[]),
        **{field: getattr(prep, field) for field in (*SCALAR_FIELDS, *_READ_ONLY_FIELDS)},
    )
    read.validation = validation_report(read, upstream)
    return read


# -- the rules ------------------------------------------------------------


def validation_report(plan, upstream: _Upstream) -> ValidationReport:
    """`ready` blocks DRAFT -> READY; `warnings` never block. `plan` is a
    ConductPrepRead, or a dry run's view of a payload with the same shape.

    READY needs only the core -- every objective measured (its EEG, an
    evaluator on it), the design fixed (MSEL READY, mandatory injects
    validated), the session set (when, where, how) and how it stops.
    Everything else is optional: checked for consistency once filled in,
    and only a few gaps worth a look are warnings."""
    ready: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []
    context = plan.context

    def issue(target: list, code: str, section: int, field=None, item_id=None) -> None:
        target.append(
            ValidationIssue(
                code=code,
                section=section,
                field=field,
                item_id=str(item_id) if item_id is not None else None,
            )
        )

    def blank(value: str) -> bool:
        return not value.strip()

    session_day: date | None = plan.session_date

    # E01-E08 -- one definitive EEG per objective, each point written; rated
    # on the common scale unless a point adjusts a level.
    covered = {o.objective_id for o in plan.eeg}
    for objective in upstream.objectives:
        if objective.id not in covered:
            issue(ready, "EEG_OBJECTIVE_MISSING", EVALUATION, "eeg", objective.id)
    if plan.drift.needs_changed or plan.drift.msel_changed:
        issue(ready, "EEG_SOURCE_CHANGED", EVALUATION, "eeg")
    for eeg in plan.eeg:
        if eeg.orphaned:
            issue(ready, "EEG_OBJECTIVE_ORPHANED", EVALUATION, "eeg", eeg.id)
            continue
        if not eeg.points:
            issue(ready, "EEG_POINTS_REQUIRED", EVALUATION, "points", eeg.id)
        for point in eeg.points:
            if blank(point.text):
                issue(ready, "EEG_POINT_INCOMPLETE", EVALUATION, "text", point.id)
                continue
            # P/S/M/U are optional: blank means the common scale. A seeded
            # point's wording is checked at its source (needs analysis, MSEL).
            if point.kind == EegPointKind.CUSTOM and _VAGUE_PATTERN.search(point.text):
                issue(warnings, "EEG_POINT_VAGUE", EVALUATION, "text", point.id)
            if point.source_status in ("changed", "orphaned"):
                issue(warnings, "EEG_POINT_SOURCE_CHANGED", EVALUATION, "text", point.id)

    # E09-E11 -- every objective has an evaluator; one of them should lead.
    assigned = {o for e in plan.evaluators for o in e.objective_ids}
    for eeg in plan.eeg:
        if not eeg.orphaned and eeg.id not in assigned:
            issue(ready, "OBJECTIVE_WITHOUT_EVALUATOR", EVALUATION, "evaluators", eeg.id)
    if any(e.areas for e in plan.evaluators):
        watched = {a for e in plan.evaluators for a in e.areas}
        for area in context.participating_areas:
            if area not in watched:
                issue(warnings, "AREA_WITHOUT_EVALUATOR", EVALUATION, "areas", area)
    if context.lead_evaluator is None:
        issue(warnings, "LEAD_EVALUATOR_MISSING", EVALUATION, "lead_evaluator")

    # E12-E13 -- optional: how data is collected ("other" says what) and
    # who keeps the execution log (someone on the team).
    if "other" in plan.data_collection_methods and blank(plan.data_collection_other):
        issue(ready, "DATA_COLLECTION_REQUIRED", EVALUATION, "data_collection_other")
    if plan.log_keeper_id is not None and plan.log_keeper_id not in {
        p.user_id for p in context.team_members
    }:
        issue(ready, "LOG_KEEPER_NOT_ON_TEAM", EVALUATION, "log_keeper_id")

    # E14-E15 -- the controller and evaluator briefing: recommended, and
    # before the session when it has a date. Its checklist and attendance
    # are aids, never issues.
    if plan.briefing_date is None:
        issue(warnings, "BRIEFING_DATE_REQUIRED", SESSION, "briefing_date")
    elif session_day is not None and plan.briefing_date > session_day:
        issue(ready, "BRIEFING_AFTER_SESSION", SESSION, "briefing_date")

    # E16-E17 -- the evaluation calendar: days after the session, with the
    # usual deadlines by default -- never missing, never before the session.
    # Out of order (hot wash, debrief, rated EEGs, draft report, After
    # Action Meeting) is worth a look, not a block.
    previous: int | None = None
    for field in CALENDAR_FIELDS:
        value = getattr(plan, field)
        if previous is not None and value < previous:
            issue(warnings, "CALENDAR_ORDER", DOCUMENTS, field)
        previous = value

    # E30-E31 -- the MSEL is READY and its mandatory injects technically
    # validated (plausible).
    if context.msel_status != "ready":
        issue(ready, "MSEL_NOT_READY", VALIDATION, "msel")
    if context.mandatory_injects_validated < context.mandatory_injects:
        issue(ready, "INJECTS_NOT_VALIDATED", VALIDATION, "msel")

    # E32-E34 -- optional, scaled to the exercise: the Final Planning
    # Meeting closes the design (worth a look when not held -- the READY
    # MSEL already fixes it); the dry run tests it.
    if not plan.fpm_done or plan.fpm_date is None:
        issue(warnings, "FPM_NOT_DONE", VALIDATION, "fpm_done")
    elif session_day is not None and plan.fpm_date > session_day:
        issue(ready, "FPM_AFTER_SESSION", VALIDATION, "fpm_date")
    if (
        plan.fpm_done
        and plan.fpm_msel_version is not None
        and context.msel_ready_version is not None
        and context.msel_ready_version > plan.fpm_msel_version
    ):
        issue(warnings, "DESIGN_CHANGED_AFTER_FPM", VALIDATION, "fpm_done")
    if plan.dry_run_date and session_day is not None and plan.dry_run_date > session_day:
        issue(ready, "DRY_RUN_AFTER_SESSION", VALIDATION, "dry_run_date")

    # E35-E36 -- what the reviews found, once recorded, is fixed before
    # the session.
    for finding in plan.findings:
        if blank(finding.description):
            issue(ready, "FINDING_INCOMPLETE", VALIDATION, "description", finding.id)
        elif not finding.resolved:
            issue(ready, "FINDING_UNRESOLVED", VALIDATION, "resolved", finding.id)

    # E40-E44 -- the session: when, where, how; inside the needs form's
    # window.
    required = ["session_date", "session_time", "timezone", "modality"]
    if plan.modality in (SessionModality.IN_PERSON, SessionModality.HYBRID):
        required.append("venue")
    if plan.modality in (SessionModality.REMOTE, SessionModality.HYBRID):
        required.append("meeting_link")
    for field in required:
        value = getattr(plan, field)
        if value is None or (isinstance(value, str) and blank(value)):
            issue(ready, "SESSION_INCOMPLETE", SESSION, field)
    if session_day is not None and (
        (context.date_window_start and session_day < context.date_window_start)
        or (context.date_window_end and session_day > context.date_window_end)
    ):
        issue(ready, "SESSION_OUTSIDE_WINDOW", SESSION, "session_date")
    if (
        plan.session_time is not None
        and context.msel_exercise_start is not None
        and plan.session_time != context.msel_exercise_start
    ):
        issue(warnings, "SESSION_START_MISMATCH", SESSION, "session_time")
    # E45-E47 -- optional: the key decision makers (none is worth a look),
    # each named; a stand-in, when chosen, named too.
    if not plan.attendees:
        issue(warnings, "DECISION_MAKERS_REQUIRED", SESSION, "attendees")
    for attendee in plan.attendees:
        if blank(attendee.name):
            issue(ready, "ATTENDEE_INCOMPLETE", SESSION, "name", attendee.id)
            continue
        if attendee.confirmed:
            continue
        if attendee.fallback == "substitute" and blank(attendee.substitute):
            issue(ready, "DECISION_MAKER_WITHOUT_FALLBACK", SESSION, "substitute", attendee.id)
        elif attendee.fallback == "postpone":
            issue(warnings, "SESSION_POSTPONE_PENDING", SESSION, "fallback", attendee.id)

    # E20-E21 -- how the exercise stops (seeded, so rarely missing).
    if blank(plan.stop_procedure):
        issue(ready, "STOP_PROCEDURE_REQUIRED", SESSION, "stop_procedure")
    if blank(context.stop_exercise_keyword):
        issue(warnings, "STOP_KEYWORD_MISSING", SESSION, "stop_procedure")

    return ValidationReport(ready=ready, approved=[], warnings=warnings)


def draft_report(session: Session, ttx: TTX, payload: ConductPrepSaveRequest) -> ValidationReport:
    """The report this plan *would* have with this payload, saving
    nothing."""
    prep = find_prep(session, ttx.id)
    if prep is None:
        raise AppException("CONDUCT_PREP_NOT_FOUND", "Open the conduct prep first.", 404)
    stored = prep_read(session, ttx, prep)
    form = get_form(session, ttx.id)
    upstream = _Upstream(session, ttx, form)
    stored_points = {p.id: p for o in stored.eeg for p in o.points}
    stored_eeg = {o.id: o for o in stored.eeg}
    eeg = []
    for item in payload.eeg:
        base = stored_eeg.get(item.id)
        if base is None:
            continue
        points = []
        for index, point in enumerate(item.points):
            seeded = stored_points.get(point.id) if point.id else None
            kind = seeded.kind if seeded else EegPointKind.CUSTOM
            source_text = seeded.source_text if seeded else ""
            # A seeded point's text is its source's, whatever the payload says.
            fields = point.model_dump()
            if kind != EegPointKind.CUSTOM:
                fields["text"] = source_text
            points.append(
                SimpleNamespace(
                    **fields,
                    kind=kind,
                    source_status=upstream.point_status(
                        kind,
                        fields["text"],
                        source_text,
                        seeded.source_action_id if seeded else None,
                        base.objective_id,
                        seeded.source_requirement_id if seeded else "",
                    ),
                )
            )
            if points[-1].id is None:
                points[-1].id = f"new-{item.id}-{index}"
        eeg.append(
            SimpleNamespace(
                id=base.id, objective_id=base.objective_id, orphaned=base.orphaned, points=points
            )
        )
    # Objectives the payload left out keep their stored points.
    eeg += [o for o in stored.eeg if o.id not in {item.id for item in payload.eeg}]
    view = SimpleNamespace(
        **payload.model_dump(exclude={"eeg", "revision"}),
        eeg=eeg,
        context=stored.context,
        drift=stored.drift,
        fpm_msel_version=(
            stored.fpm_msel_version
            if stored.fpm_done or not payload.fpm_done
            else stored.context.msel_ready_version
        ),
    )
    view.evaluators = [SimpleNamespace(**e.model_dump()) for e in payload.evaluators]
    view.findings = [SimpleNamespace(**f.model_dump()) for f in payload.findings]
    view.attendees = [SimpleNamespace(**a.model_dump()) for a in payload.attendees]
    return validation_report(view, upstream)


# -- writes ---------------------------------------------------------------


SCALAR_FIELDS = (
    "data_collection_methods",
    "data_collection_other",
    "log_keeper_id",
    "briefing_date",
    "briefing_checklist",
    "briefing_notes",
    "briefed_controller_ids",
    "hot_wash_days",
    "debrief_days",
    "ratings_due_days",
    "draft_aar_days",
    "after_action_meeting_days",
    "fpm_date",
    "fpm_done",
    "fpm_attendees",
    "fpm_notes",
    "dry_run_date",
    "dry_run_done",
    "session_date",
    "session_time",
    "timezone",
    "modality",
    "venue",
    "room",
    "meeting_link",
    "session_notes",
    "invitation_sent_on",
    "invitation_text",
    "logistics_checklist",
    "documents_reviewed",
    "stop_procedure",
)
# Stored on the plan, never taken from a save.
_READ_ONLY_FIELDS = ("fpm_msel_version", "updated_at", "ready_by", "ready_by_id", "ready_at")


def _seed_eeg_objective(
    session: Session,
    prep: TTXConductPrep,
    objective: TTXObjective,
    upstream: _Upstream,
    position: int,
    spanish: bool,
) -> None:
    eeg = _new_eeg_objective(prep, objective)
    eeg.position = position
    session.add(eeg)
    session.flush()
    seeded = [_criterion_point(c) for c in upstream.clauses[objective.id]]
    seeded += [_action_point(a) for a in upstream.actions.get(str(objective.id), [])]
    seeded += [_notification_point(r, spanish) for r in upstream.notifications[objective.id]]
    for index, point in enumerate(seeded):
        point.eeg_objective_id = eeg.id
        point.position = index
        session.add(point)


def open_prep(session: Session, ttx: TTX, user: User, locale: str) -> TTXConductPrep:
    """The exercise's plan, created on first use -- which needs an approved
    needs analysis. The form row is locked while creating, so two first
    opens at once can't both create one."""
    prep = find_prep(session, ttx.id)
    if prep is not None:
        return prep
    form = get_form(session, ttx.id, lock=True)
    prep = find_prep(session, ttx.id)
    if prep is not None:
        return prep
    if form.status != NeedsFormStatus.APPROVED:
        raise _not_approved(
            ttx, "Approve the exercise's needs analysis before preparing its conduct."
        )
    upstream = _Upstream(session, ttx, form)
    msel = find_msel(session, ttx.id)
    prep = TTXConductPrep(
        ttx_id=ttx.id,
        updated_by_id=user.id,
        seeded_needs_form_version=form.version,
        seeded_msel_version=upstream.snapshot_version,
        session_time=msel.exercise_start if msel else None,
        stop_procedure=DEFAULT_STOP_PROCEDURE.get(locale, DEFAULT_STOP_PROCEDURE["en"]),
        data_collection_methods=list(DEFAULT_DATA_COLLECTION),
    )
    session.add(prep)
    session.flush()
    spanish = locale.startswith("es")
    for position, objective in enumerate(upstream.objectives):
        _seed_eeg_objective(session, prep, objective, upstream, position, spanish)
    session.commit()
    session.refresh(prep)
    logger.info("Conduct prep created for TTX %s by user %s.", ttx.id, user.id)
    return prep


def _reopen(prep: TTXConductPrep) -> None:
    """Any edit of a plan past DRAFT sends it back to DRAFT; leaving READY
    opens a new version (its snapshot stays as history)."""
    if prep.status == ConductPrepStatus.READY:
        prep.version += 1
    prep.status = ConductPrepStatus.DRAFT
    prep.ready_by = ""
    prep.ready_by_id = None
    prep.ready_at = None


def _touch(prep: TTXConductPrep, user: User) -> None:
    prep.revision += 1
    prep.updated_at = datetime.now(UTC)
    prep.updated_by_id = user.id


def _editable(session: Session, ttx: TTX) -> tuple[TTXConductPrep, TTXNeedsForm]:
    prep = find_prep(session, ttx.id, lock=True)
    if prep is None:
        raise AppException("CONDUCT_PREP_NOT_FOUND", "Open the conduct prep first.", 404)
    form = get_form(session, ttx.id)
    if form.status != NeedsFormStatus.APPROVED:
        raise _not_approved(
            ttx, "The conduct prep can be edited only while the needs analysis is approved."
        )
    return prep, form


def _delete_evaluators(session: Session, evaluator_ids: list[uuid.UUID]) -> None:
    if not evaluator_ids:
        return
    session.execute(
        delete(ConductPrepEvaluatorObjective).where(
            ConductPrepEvaluatorObjective.evaluator_id.in_(evaluator_ids)
        )
    )
    session.execute(delete(ConductPrepEvaluator).where(ConductPrepEvaluator.id.in_(evaluator_ids)))


def _replace_rows(
    session: Session, prep: TTXConductPrep, model, items, fields: tuple[str, ...]
) -> None:
    existing = {row.id: row for row in _ordered(session, model, prep)}
    for item in items:
        if item.id and item.id not in existing:
            raise _reject(
                "CONDUCT_PREP_ROW_NOT_FOUND", "A row in this save doesn't belong to the plan."
            )
    for position, item in enumerate(items):
        row = existing[item.id] if item.id else model(prep_id=prep.id)
        row.position = position
        for field in fields:
            setattr(row, field, getattr(item, field))
        session.add(row)
    for gone in set(existing) - {item.id for item in items if item.id}:
        session.delete(existing[gone])


def save_prep(
    session: Session, ttx: TTX, payload: ConductPrepSaveRequest, user: User
) -> TTXConductPrep:
    prep, _ = _editable(session, ttx)
    if payload.revision != prep.revision:
        raise _reject(
            "CONDUCT_PREP_STALE",
            "Someone else saved this plan since you opened it. Reload to see their changes.",
            409,
        )
    objectives, points = _eeg_rows(session, prep)
    by_id = {o.id: o for o in objectives}
    stored_points = {p.id: p for rows in points.values() for p in rows}
    for item in payload.eeg:
        if item.id not in by_id:
            raise _reject(
                "CONDUCT_PREP_ROW_NOT_FOUND", "An EEG in this save doesn't belong to the plan."
            )
        for point in item.points:
            if point.id and (
                point.id not in stored_points or stored_points[point.id].eeg_objective_id != item.id
            ):
                raise _reject(
                    "CONDUCT_PREP_ROW_NOT_FOUND", "An observation point doesn't belong to its EEG."
                )
    evaluator_ids = set(
        session.exec(
            select(TTXAccess.user_id).where(TTXAccess.ttx_id == ttx.id, evaluator_access())
        )
    )
    for evaluator in payload.evaluators:
        if evaluator.user_id not in evaluator_ids:
            raise _reject("NOT_AN_EVALUATOR", "Only the exercise's Evaluators can be assigned.")
    if len({e.user_id for e in payload.evaluators}) != len(payload.evaluators):
        raise _reject("NOT_AN_EVALUATOR", "Each Evaluator is assigned once.")

    _reopen(prep)
    if payload.fpm_done and not prep.fpm_done:
        snapshot = latest_snapshot(session, ttx.id)
        prep.fpm_msel_version = snapshot.version if snapshot else None
    elif not payload.fpm_done:
        prep.fpm_msel_version = None
    for field in SCALAR_FIELDS:
        setattr(prep, field, getattr(payload, field))

    # Definitive EEGs: points full-replace per EEG listed -- but a seeded
    # point is removed at its source (needs analysis, MSEL), never here: one
    # left out of the payload stays, after the listed ones.
    kept_points: set[uuid.UUID] = set()
    for item in payload.eeg:
        for position, entry in enumerate(item.points):
            point = (
                stored_points[entry.id]
                if entry.id
                else ConductPrepEegPoint(eeg_objective_id=item.id, kind=EegPointKind.CUSTOM)
            )
            point.position = position
            # A seeded point's text is its source's (edited in the needs
            # analysis or the MSEL): only a custom point's comes from here.
            point.text = entry.text if point.kind == EegPointKind.CUSTOM else point.source_text
            for field in (
                "criteria_p",
                "criteria_s",
                "criteria_m",
                "criteria_u",
            ):
                setattr(point, field, getattr(entry, field))
            session.add(point)
            if entry.id:
                kept_points.add(entry.id)
    listed = {item.id: len(item.points) for item in payload.eeg}
    for point in sorted(stored_points.values(), key=lambda p: p.position):
        if point.eeg_objective_id not in listed or point.id in kept_points:
            continue
        if point.kind == EegPointKind.CUSTOM:
            session.delete(point)
        else:
            point.position = listed[point.eeg_objective_id]
            listed[point.eeg_objective_id] += 1
            session.add(point)

    # Evaluators: links are rewritten, so they go first. Links to EEGs not
    # in the plan are dropped (tolerant, like the MSEL's dangling branches).
    stored_evaluators, _ = _evaluator_rows(session, prep)
    existing = {e.id: e for e in stored_evaluators}
    for item in payload.evaluators:
        if item.id and item.id not in existing:
            raise _reject(
                "CONDUCT_PREP_ROW_NOT_FOUND", "A row in this save doesn't belong to the plan."
            )
    if existing:
        session.execute(
            delete(ConductPrepEvaluatorObjective).where(
                ConductPrepEvaluatorObjective.evaluator_id.in_(list(existing))
            )
        )
    _delete_evaluators(
        session, list(set(existing) - {item.id for item in payload.evaluators if item.id})
    )
    session.flush()
    links = []
    for position, item in enumerate(payload.evaluators):
        evaluator = (
            existing[item.id]
            if item.id
            else ConductPrepEvaluator(prep_id=prep.id, user_id=item.user_id)
        )
        evaluator.position = position
        evaluator.user_id = item.user_id
        evaluator.areas = list(dict.fromkeys(item.areas))
        evaluator.briefed = item.briefed
        session.add(evaluator)
        links += [
            (evaluator, objective_id)
            for objective_id in dict.fromkeys(item.objective_ids)
            if objective_id in by_id
        ]
    session.flush()
    session.add_all(
        ConductPrepEvaluatorObjective(evaluator_id=e.id, eeg_objective_id=o) for e, o in links
    )

    _replace_rows(
        session,
        prep,
        ConductPrepFinding,
        payload.findings,
        ("kind", "found_in", "description", "inject_id", "phase_id", "resolved"),
    )
    # A decision maker linked to someone who isn't a Player of the
    # exercise (any more), or linked twice, is kept as a plain name.
    names = {p.user_id: p.full_name for p in _players(session, ttx)[0]}
    linked: set[uuid.UUID] = set()
    for attendee in payload.attendees:
        if attendee.user_id in names and attendee.user_id not in linked:
            linked.add(attendee.user_id)
            attendee.name = names[attendee.user_id]
        else:
            attendee.user_id = None
    _replace_rows(
        session,
        prep,
        ConductPrepAttendee,
        payload.attendees,
        ("user_id", "name", "role", "confirmed", "fallback", "substitute"),
    )

    _touch(prep, user)
    session.add(prep)
    session.commit()
    session.refresh(prep)
    logger.info(
        "Conduct prep of TTX %s saved by user %s (revision %s).", ttx.id, user.id, prep.revision
    )
    return prep


def reseed_eeg(session: Session, ttx: TTX, user: User, locale: str = "en") -> TTXConductPrep:
    """Bring the definitive EEGs up to the needs analysis and READY MSEL as
    they are now, keeping what was written here (ratings, custom points):
    an expected-action point takes its action's new text, new sources are
    added, and seeded points whose source is gone are dropped (they can't be
    removed here by hand). EEGs of objectives no longer in the needs
    analysis go, with their assignments; new objectives get
    one."""
    prep, form = _editable(session, ttx)
    upstream = _Upstream(session, ttx, form)
    spanish = locale.startswith("es")
    objectives, points = _eeg_rows(session, prep)
    by_objective = {o.objective_id: o for o in objectives}

    gone = [o.id for o in objectives if o.objective_id not in upstream.objective_ids]
    if gone:
        session.execute(
            delete(ConductPrepEvaluatorObjective).where(
                ConductPrepEvaluatorObjective.eeg_objective_id.in_(gone)
            )
        )
        session.execute(
            delete(ConductPrepEegPoint).where(ConductPrepEegPoint.eeg_objective_id.in_(gone))
        )
        session.execute(delete(ConductPrepEegObjective).where(ConductPrepEegObjective.id.in_(gone)))

    for position, objective in enumerate(upstream.objectives):
        eeg = by_objective.get(objective.id)
        if eeg is None:
            _seed_eeg_objective(session, prep, objective, upstream, position, spanish)
            continue
        eeg.position = position
        eeg.code = objective.code
        eeg.title = objective.title
        eeg.statement = objective.statement
        eeg.capability = objective.capability.value if objective.capability else ""
        session.add(eeg)
        rows = points[eeg.id]
        clauses = upstream.clauses[objective.id]
        actions = upstream.actions.get(str(objective.id), [])
        actions_by_id = {str(a["id"]): a for a in actions}
        have_clauses = {p.source_text for p in rows if p.kind == EegPointKind.CRITERION}
        have_actions = {
            str(p.source_action_id) for p in rows if p.kind == EegPointKind.EXPECTED_ACTION
        }
        notifications = upstream.notifications[objective.id]
        have_notifications = {
            p.source_requirement_id for p in rows if p.kind == EegPointKind.NOTIFICATION
        }
        kept = []
        for point in rows:
            action = actions_by_id.get(str(point.source_action_id))
            gone = (
                (point.kind == EegPointKind.CRITERION and point.source_text not in clauses)
                or (point.kind == EegPointKind.EXPECTED_ACTION and action is None)
                or (
                    point.kind == EegPointKind.NOTIFICATION
                    and point.source_requirement_id not in notifications
                )
            )
            if gone:
                session.delete(point)
                continue
            if point.kind == EegPointKind.EXPECTED_ACTION:
                _write_action_source(point, action)
                point.text = action["description"]
            point.position = len(kept)
            kept.append(point)
            session.add(point)
        added = [_criterion_point(c) for c in clauses if c not in have_clauses]
        added += [_action_point(a) for a in actions if str(a["id"]) not in have_actions]
        added += [
            _notification_point(r, spanish) for r in notifications if r not in have_notifications
        ]
        for index, point in enumerate(added, start=len(kept)):
            point.eeg_objective_id = eeg.id
            point.position = index
            session.add(point)

    _reopen(prep)
    prep.seeded_needs_form_version = form.version
    prep.seeded_msel_version = upstream.snapshot_version
    _touch(prep, user)
    session.add(prep)
    session.commit()
    session.refresh(prep)
    logger.info(
        "Conduct prep EEGs of TTX %s re-seeded by user %s (needs v%s, MSEL v%s).",
        ttx.id,
        user.id,
        form.version,
        upstream.snapshot_version,
    )
    return prep


def transition(session: Session, ttx: TTX, to: ConductPrepStatus, user: User) -> TTXConductPrep:
    prep, _ = _editable(session, ttx)
    current = prep.status
    if to == current:
        return prep
    if to == ConductPrepStatus.DRAFT:
        _reopen(prep)
    else:
        blocking = prep_read(session, ttx, prep).validation.ready
        if blocking:
            logger.warning(
                "Conduct prep of TTX %s can't move to ready: %s.",
                ttx.id,
                ", ".join(sorted({issue.code for issue in blocking})),
            )
            raise AppException(
                "CONDUCT_PREP_INVALID",
                "The plan doesn't meet the rules to be ready yet. Check the validation summary.",
                409,
                log_level=logging.INFO,
            )
        prep.status = ConductPrepStatus.READY
        prep.ready_by = user.full_name
        prep.ready_by_id = user.id
        prep.ready_at = datetime.now(UTC)

    _touch(prep, user)
    session.add(prep)
    if prep.status == ConductPrepStatus.READY:
        session.flush()
        snapshot = prep_read(session, ttx, prep).model_dump(mode="json", exclude={"validation"})
        session.add(
            ConductPrepSnapshot(
                prep_id=prep.id, version=prep.version, payload=snapshot, created_by_id=user.id
            )
        )
    session.commit()
    session.refresh(prep)
    logger.info(
        "Conduct prep of TTX %s moved from %s to %s by user %s (version %s).",
        ttx.id,
        current.value,
        prep.status.value,
        user.id,
        prep.version,
    )
    return prep


def drop_evaluator(session: Session, ttx_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Someone stopped being an Evaluator of the exercise: their assignment
    goes with it. The caller commits."""
    prep = find_prep(session, ttx_id)
    if prep is None:
        return
    _delete_evaluators(
        session,
        list(
            session.exec(
                select(ConductPrepEvaluator.id).where(
                    ConductPrepEvaluator.prep_id == prep.id,
                    ConductPrepEvaluator.user_id == user_id,
                )
            )
        ),
    )


def delete_conduct_preps_for_ttx(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """Delete every plan of these exercises, children first -- no FK here
    cascades."""
    if not ttx_ids:
        return
    prep_ids = list(
        session.exec(select(TTXConductPrep.id).where(TTXConductPrep.ttx_id.in_(ttx_ids)))
    )
    if not prep_ids:
        return
    _delete_evaluators(
        session,
        list(
            session.exec(
                select(ConductPrepEvaluator.id).where(ConductPrepEvaluator.prep_id.in_(prep_ids))
            )
        ),
    )
    eeg_ids = list(
        session.exec(
            select(ConductPrepEegObjective.id).where(ConductPrepEegObjective.prep_id.in_(prep_ids))
        )
    )
    if eeg_ids:
        session.execute(
            delete(ConductPrepEegPoint).where(ConductPrepEegPoint.eeg_objective_id.in_(eeg_ids))
        )
    for model in (
        ConductPrepEegObjective,
        ConductPrepFinding,
        ConductPrepAttendee,
        ConductPrepSnapshot,
    ):
        session.execute(delete(model).where(model.prep_id.in_(prep_ids)))
    session.execute(delete(TTXConductPrep).where(TTXConductPrep.id.in_(prep_ids)))
