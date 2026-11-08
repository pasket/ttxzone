"""The Exercise Evaluation Guide (EEG): per objective of the needs
analysis, what an evaluator observes and rates. Once the conduct prep is
READY its definitive EEGs are the EEG (from its snapshot); before that it
is derived here from the needs analysis and the MSEL -- for Planners
(preview, any form status) and Evaluators (approved form only)."""

import logging
from dataclasses import asdict

from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import TTX, NeedsFormStatus, RoleEnum, TTXAccess, TTXObjective, User
from app.schemas.ttx_evaluation import (
    EEGDuePhase,
    EEGExpectedAction,
    EEGObjective,
    EEGPoint,
    EEGRead,
    ExpectedNotificationRead,
)
from app.schemas.ttx_msel import action_objective_ids
from app.schemas.ttx_needs_form import NotificationMilestoneRead
from app.services.notification_reference import expected_notifications
from app.services.objective_text import condition_lines, evidence_items
from app.services.ttx_msel_service import find_msel, latest_snapshot, msel_read
from app.services.ttx_needs_form_service import get_form


def observation_points(success_criterion: str) -> list[str]:
    """One observation point per condition: a line of the criterion."""
    return condition_lines(success_criterion)


def _is_evaluator_of(session: Session, user: User, ttx: TTX) -> bool:
    access = session.exec(
        select(TTXAccess).where(TTXAccess.user_id == user.id, TTXAccess.ttx_id == ttx.id)
    ).first()
    return access is not None and access.role == RoleEnum.EVALUATOR


def _expected_actions(injects: list[dict]) -> dict[str, list[EEGExpectedAction]]:
    """Expected actions per objective id, each once under every objective
    it evidences, in MSEL order."""
    by_objective: dict[str, list[EEGExpectedAction]] = {}
    for inject in injects:
        for action in inject["expected_actions"]:
            for objective_id in action_objective_ids(action, inject):
                by_objective.setdefault(objective_id, []).append(
                    EEGExpectedAction(
                        code=action["code"],
                        inject_code=inject["code"],
                        inject_title=inject["title"],
                        description=action["description"],
                        responsible_role=action["responsible_role"],
                        expected_within_minutes=action["expected_within_minutes"],
                    )
                )
    return by_objective


def due_phases(phases: list[dict]) -> dict[str, list[EEGDuePhase]]:
    """The phases each objective is due by the end of, per objective id,
    in session order."""
    by_objective: dict[str, list[EEGDuePhase]] = {}
    for phase in sorted(phases, key=lambda p: p["start_offset"]):
        for objective_id in phase.get("due_objective_ids", []):
            by_objective.setdefault(str(objective_id), []).append(
                EEGDuePhase(code=phase["code"], name=phase["name"], end_offset=phase["end_offset"])
            )
    return by_objective


def _msel_source(
    session: Session, ttx: TTX, evaluator: bool
) -> tuple[list[dict], list[dict], int | None]:
    """The injects and phases to build the EEG from: Evaluators rate
    against the frozen READY version; Planners preview the live MSEL."""
    if evaluator:
        snapshot = latest_snapshot(session, ttx.id)
        if snapshot is None:
            return [], [], None
        return snapshot.payload["injects"], snapshot.payload["phases"], snapshot.version
    msel = find_msel(session, ttx.id)
    if msel is None:
        return [], [], None
    read = msel_read(session, ttx, msel)
    return (
        [inject.model_dump(mode="json") for inject in read.injects],
        [phase.model_dump(mode="json") for phase in read.phases],
        msel.version,
    )


def _measurement(objective: TTXObjective | None) -> dict:
    """How an objective is judged, from the needs analysis: the rule, the
    time box, the rating guidance and the evidence to collect."""
    if objective is None:
        return {"evidence": "", "evidence_items": []}
    return {
        "evidence": objective.evidence,
        "evidence_items": evidence_items(objective.evidence),
        "achieve_at_least": objective.achieve_at_least,
        "time_box_minutes": objective.time_box_minutes,
        "achieved_note": objective.achieved_note,
        "partially_achieved": objective.partially_achieved,
        "not_achieved": objective.not_achieved,
    }


def notification_reference(objectives) -> list[ExpectedNotificationRead]:
    """The observers' notification reference for these needs objectives."""
    return [
        ExpectedNotificationRead(
            requirement_id=item.requirement.id,
            framework=item.requirement.framework,
            framework_label_en=item.framework_label(spanish=False),
            framework_label_es=item.framework_label(spanish=True),
            reference=item.requirement.reference,
            description_en=item.requirement.description_en,
            description_es=item.requirement.description_es,
            objective_codes=list(item.objective_codes),
            milestones=[NotificationMilestoneRead(**asdict(m)) for m in item.milestones],
        )
        for item in expected_notifications(
            (o.code, o.regulatory_requirement_ids or []) for o in objectives
        )
    ]


def build_eeg(session: Session, ttx: TTX, user: User) -> EEGRead:
    """An Evaluator only gets the EEG of an approved needs analysis -- it's
    the basis they'll rate against. A Planner (or the org's Program Manager)
    gets it at any stage, as a preview."""
    form = get_form(session, ttx.id)
    evaluator = _is_evaluator_of(session, user, ttx)
    if form.status != NeedsFormStatus.APPROVED and evaluator:
        raise AppException(
            "NEEDS_FORM_NOT_APPROVED",
            "The EEG is available once the needs analysis is approved.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.INFO,
        )
    # Imported here: the conduct prep service builds on this module.
    from app.services.ttx_conduct_prep_service import find_prep, latest_prep_snapshot

    snapshot = latest_prep_snapshot(session, ttx.id)
    if snapshot is not None:
        live = find_prep(session, ttx.id)
        reopened = live is not None and live.version > snapshot.version
        return eeg_from_plan(session, ttx, snapshot.payload, snapshot.version, reopened)
    injects, phases, msel_version = _msel_source(session, ttx, evaluator)
    return eeg_from(session, ttx, injects, msel_version, phases)


def eeg_from_plan(
    session: Session, ttx: TTX, plan: dict, version: int, reopened: bool = False
) -> EEGRead:
    """The EEG of a frozen conduct prep (its snapshot payload): its
    definitive EEGs, their points with the rating criteria, and who
    evaluates each."""
    form = get_form(session, ttx.id)
    form_objectives = session.exec(
        select(TTXObjective).where(TTXObjective.form_id == form.id).order_by(TTXObjective.position)
    ).all()
    by_id = {str(o.id): o for o in form_objectives}
    names: dict[str, list[str]] = {}
    for evaluator in plan["evaluators"]:
        for objective_id in evaluator["objective_ids"]:
            names.setdefault(str(objective_id), []).append(evaluator["full_name"])
    lead = plan["context"].get("lead_evaluator")
    # The plan freezes the READY MSEL's version: its deadlines come from it.
    msel_snapshot = latest_snapshot(session, ttx.id)
    deadlines = due_phases(msel_snapshot.payload["phases"]) if msel_snapshot else {}
    objectives = []
    for eeg in plan["eeg"]:
        points = [
            EEGPoint(
                id=p["id"],
                kind=p["kind"],
                text=p["text"],
                criteria={level.upper(): p[f"criteria_{level}"] for level in "psmu"},
                action_code=p["source_action_code"],
                inject_code=p["source_inject_code"],
                inject_title=p["source_inject_title"],
                responsible_role=p["responsible_role"],
                expected_within_minutes=p["expected_within_minutes"],
            )
            for p in eeg["points"]
        ]
        objectives.append(
            EEGObjective(
                id=eeg["objective_id"],
                code=eeg["code"],
                title=getattr(by_id.get(str(eeg["objective_id"])), "title", "")
                or eeg.get("title", ""),
                capability=eeg["capability"],
                statement=eeg["statement"],
                observation_points=[p.text for p in points],
                **_measurement(by_id.get(str(eeg["objective_id"]))),
                due_phases=deadlines.get(str(eeg["objective_id"]), []),
                points=points,
                evaluators=names.get(str(eeg["id"]), []),
            )
        )
    return EEGRead(
        ttx_id=ttx.id,
        exercise_code=ttx.code,
        exercise_name=ttx.name,
        tlp=form.tlp,
        needs_form_status=form.status,
        needs_form_version=form.version,
        msel_version=plan["context"].get("msel_ready_version"),
        objectives=objectives,
        source="plan",
        plan_version=version,
        plan_reopened=reopened,
        notifications=notification_reference(form_objectives),
        lead_evaluator=lead["full_name"] if lead else None,
    )


def eeg_from(
    session: Session,
    ttx: TTX,
    injects: list[dict],
    msel_version: int | None,
    phases: list[dict] | None = None,
) -> EEGRead:
    """The EEG for these MSEL injects (as dicts: a snapshot's, or a read
    model dumped to JSON) -- also what the EEG PDF export prints."""
    form = get_form(session, ttx.id)
    objectives = session.exec(
        select(TTXObjective).where(TTXObjective.form_id == form.id).order_by(TTXObjective.position)
    ).all()
    actions = _expected_actions(injects)
    deadlines = due_phases(phases or [])
    return EEGRead(
        ttx_id=ttx.id,
        exercise_code=ttx.code,
        exercise_name=ttx.name,
        tlp=form.tlp,
        needs_form_status=form.status,
        needs_form_version=form.version,
        msel_version=msel_version,
        objectives=[
            EEGObjective(
                id=objective.id,
                code=objective.code,
                title=objective.title,
                capability=objective.capability,
                statement=objective.statement,
                observation_points=observation_points(objective.success_criterion),
                **_measurement(objective),
                due_phases=deadlines.get(str(objective.id), []),
                expected_actions=actions.get(str(objective.id), []),
            )
            for objective in objectives
        ],
        notifications=notification_reference(objectives),
    )
