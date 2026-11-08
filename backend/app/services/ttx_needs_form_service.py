"""Needs & objectives form (Creator -> Needs): the first design artifact of
an exercise, and the gate in front of its scenario.

Invariant: every TTX has a `code` and a needs form. Both are created by the
`before_flush` hook below, so the invariant holds on every creation path
(create_ttx, future duplication/templates, test fixtures) instead of
depending on each caller remembering to add them.

The backend is the authority on the rules. Saving rejects only what can
never be stored (V01 limits, V02 objective without need, V04 capability
not selected); everything else is reported by `validation_report` and
enforced on status transitions, so a DRAFT can be saved incomplete.
"""

import logging
import re
import uuid
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

from fastapi import UploadFile
from sqlalchemy import delete, event, update
from sqlalchemy.orm import Session as OrmSession
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.data.regulatory_catalog import FRAMEWORK_CATALOG, FRAMEWORK_OTHER, REGULATORY_CATALOG
from app.data.risk_catalog import default_risks
from app.models import (
    TTX,
    AarRecipient,
    ApproverKind,
    ImprovementAction,
    Inject,
    InjectObjective,
    MselPhase,
    MselPhaseObjective,
    NeedPriority,
    NeedsFormStatus,
    Organization,
    Trigger,
    TTXExerciseRisk,
    TTXMsel,
    TTXNeed,
    TTXNeedsForm,
    TTXNeedsFormApproval,
    TTXNeedsFormEvidence,
    TTXObjective,
    TTXObjectiveNeed,
    User,
)
from app.schemas.ttx_needs_form import (
    ApprovalRead,
    EvidenceRead,
    NeedRead,
    NeedsFormApprovalRequest,
    NeedsFormRead,
    NeedsFormSaveRequest,
    ObjectiveRead,
    RiskRead,
    ValidationIssue,
    ValidationReport,
)
from app.services.code_renumber import (
    code_number,
    code_rewriter,
    next_number,
    out_of_order,
    planned_codes,
    rewrite_fields,
)
from app.services.objective_text import clamp_at_least, condition_lines, is_rating_level
from app.services.ttx_needs_form_evidence_service import (
    delete_evidence_for_approvals,
    evidence_for_approvals,
    evidence_path,
    schedule_unlink,
    store_evidence,
)

logger = logging.getLogger(__name__)

# The framework a catalog requirement belongs to, for the requirements whose
# framework a trigger can name (not the ISO standards).
_FRAMEWORK_IDS = {f.id for f in FRAMEWORK_CATALOG}
_REQUIREMENT_FRAMEWORK = {
    r.id: r.framework for r in REGULATORY_CATALOG if r.framework in _FRAMEWORK_IDS
}

MAX_CAPABILITIES = 4
MAX_OBJECTIVES = 5
REQUIRED_APPROVERS = (ApproverKind.SPONSOR, ApproverKind.DESIGN_LEAD)

# Words that make a success criterion unmeasurable, per supported locale.
# Matched as whole words, case-insensitively; a hit is a warning only.
VAGUE_CRITERION_WORDS: dict[str, tuple[str, ...]] = {
    "en": ("adequate", "adequately", "properly", "correctly", "well", "effective", "effectively"),
    "es": (
        "adecuado",
        "adecuada",
        "adecuadamente",
        "correctamente",
        "bien",
        "eficaz",
        "eficazmente",
    ),
}
_VAGUE_PATTERN = re.compile(
    r"\b(" + "|".join(w for words in VAGUE_CRITERION_WORDS.values() for w in words) + r")\b",
    re.IGNORECASE,
)

# -- creation: exercise code + default form -------------------------------


def _next_code_numbers(session: Session, organization_id: uuid.UUID, year: int) -> int:
    """Highest NN already used by the organization for `year`. Locks the
    organization row first, so two exercises created at once in the same
    org can't both read the same maximum (the unique constraint on
    (organization_id, code) is the backstop)."""
    session.exec(
        select(Organization.id).where(Organization.id == organization_id).with_for_update()
    ).first()
    prefix = f"TTX-{year}-"
    codes = session.exec(
        select(TTX.code).where(TTX.organization_id == organization_id, TTX.code.like(f"{prefix}%"))
    ).all()
    numbers = [int(code[len(prefix) :]) for code in codes if code[len(prefix) :].isdigit()]
    return max(numbers, default=0)


def format_exercise_code(year: int, number: int) -> str:
    return f"TTX-{year}-{number:02d}"


@event.listens_for(OrmSession, "before_flush")
def _assign_exercise_defaults(session: OrmSession, _flush_context, _instances) -> None:
    new_ttx = [obj for obj in session.new if isinstance(obj, TTX)]
    if not new_ttx:
        return
    issued: dict[tuple[uuid.UUID, int], int] = {}
    with session.no_autoflush:
        for ttx in new_ttx:
            if ttx.id is None:
                ttx.id = uuid.uuid4()
            if not ttx.code:
                year = (ttx.created_at or datetime.now(UTC)).astimezone(UTC).year
                key = (ttx.organization_id, year)
                if key not in issued:
                    issued[key] = _next_code_numbers(session, ttx.organization_id, year)
                issued[key] += 1
                ttx.code = format_exercise_code(year, issued[key])
            creator = session.get(User, ttx.created_by_id) if ttx.created_by_id else None
            session.add(
                TTXNeedsForm(
                    ttx_id=ttx.id,
                    design_lead=creator.full_name if creator else "",
                    updated_by_id=ttx.created_by_id,
                )
            )


def add_default_risks(session: Session, ttx: TTX, locale: str) -> None:
    """Preload section 8 in the creator's language. Called by create_ttx
    (the one path that knows the request locale), not by the flush hook."""
    form = get_form(session, ttx.id)
    for position, (risk, mitigation) in enumerate(default_risks(locale)):
        session.add(
            TTXExerciseRisk(form_id=form.id, position=position, risk=risk, mitigation=mitigation)
        )


# -- reads ----------------------------------------------------------------


def get_form(session: Session, ttx_id: uuid.UUID, *, lock: bool = False) -> TTXNeedsForm:
    query = select(TTXNeedsForm).where(TTXNeedsForm.ttx_id == ttx_id)
    if lock:
        query = query.with_for_update()
    form = session.exec(query).first()
    if form is None:
        raise AppException("NEEDS_FORM_NOT_FOUND", "Needs form not found.", 404)
    return form


def form_statuses(session: Session, ttx_ids: Iterable[uuid.UUID]) -> dict[uuid.UUID, TTXNeedsForm]:
    """Forms for a batch of exercises in one query (TTX lists)."""
    ids = list(ttx_ids)
    if not ids:
        return {}
    forms = session.exec(select(TTXNeedsForm).where(TTXNeedsForm.ttx_id.in_(ids))).all()
    return {form.ttx_id: form for form in forms}


def _children(session: Session, form: TTXNeedsForm):
    needs = list(
        session.exec(select(TTXNeed).where(TTXNeed.form_id == form.id).order_by(TTXNeed.position))
    )
    objectives = list(
        session.exec(
            select(TTXObjective)
            .where(TTXObjective.form_id == form.id)
            .order_by(TTXObjective.position)
        )
    )
    links: dict[uuid.UUID, list[uuid.UUID]] = {o.id: [] for o in objectives}
    if objectives:
        for link in session.exec(
            select(TTXObjectiveNeed).where(TTXObjectiveNeed.objective_id.in_(list(links)))
        ):
            links[link.objective_id].append(link.need_id)
    need_order = {need.id: need.position for need in needs}
    for need_ids in links.values():
        need_ids.sort(key=lambda need_id: need_order.get(need_id, 0))
    risks = list(
        session.exec(
            select(TTXExerciseRisk)
            .where(TTXExerciseRisk.form_id == form.id)
            .order_by(TTXExerciseRisk.position)
        )
    )
    approvals = list(
        session.exec(
            select(TTXNeedsFormApproval)
            .where(TTXNeedsFormApproval.form_id == form.id)
            .order_by(TTXNeedsFormApproval.version.desc(), TTXNeedsFormApproval.recorded_at)
        )
    )
    return needs, objectives, links, risks, approvals


def validation_report(
    form,
    needs: list,
    objectives: list,
    links: dict,
    risks: list,
    approvals: list[TTXNeedsFormApproval],
) -> ValidationReport:
    """Duck-typed on purpose: it reads the stored rows (TTXNeedsForm,
    TTXNeed, ...) for a saved form, and plain namespaces built from an
    unsaved payload for the dry run (`draft_report`), with each row's `id`
    being whatever the report should name it by."""
    ready: list[ValidationIssue] = []
    approved: list[ValidationIssue] = []
    warnings: list[ValidationIssue] = []

    def missing(section: int, field: str, item_id: str | None = None) -> None:
        ready.append(
            ValidationIssue(
                code="NEEDS_FORM_INCOMPLETE", section=section, field=field, item_id=item_id
            )
        )

    def blank(value: str) -> bool:
        return not value.strip()

    # V11 -- every required field, section by section.
    if blank(form.design_lead):
        missing(0, "design_lead")
    for field in ("sponsor_name", "sponsor_role", "sponsor_motivation"):
        if blank(getattr(form, field)):
            missing(1, field)
    if form.aar_recipient is None:
        missing(1, "aar_recipient")
    elif form.aar_recipient == AarRecipient.OTHER and blank(form.aar_recipient_other):
        missing(1, "aar_recipient_other")
    if not form.triggers:
        missing(2, "triggers")
    if Trigger.REGULATORY in form.triggers and not form.regulatory_frameworks:
        missing(2, "regulatory_frameworks")
    if (
        Trigger.REGULATORY in form.triggers
        and FRAMEWORK_OTHER in form.regulatory_frameworks
        and blank(form.regulatory_framework_other)
    ):
        missing(2, "regulatory_framework_other")
    if Trigger.OTHER in form.triggers and blank(form.trigger_other):
        missing(2, "trigger_other")
    if not needs:
        missing(3, "needs")
    for need in needs:
        if blank(need.title):
            missing(3, "title", str(need.id))
        if blank(need.finding):
            missing(3, "finding", str(need.id))
    if not form.capabilities:
        missing(4, "capabilities")
    if not objectives:
        missing(5, "objectives")
    for objective in objectives:
        if blank(objective.title):
            missing(5, "title", str(objective.id))
        if blank(objective.statement):
            missing(5, "statement", str(objective.id))
    if not form.levels:
        missing(6, "levels")
    if not form.participating_areas:
        missing(6, "participating_areas")
    if blank(form.perimeter):
        missing(6, "perimeter")
    if form.date_window_start is None:
        missing(7, "date_window_start")
    if form.date_window_end is None:
        missing(7, "date_window_end")
    if form.max_duration_hours is None:
        missing(7, "max_duration_hours")
    if blank(form.key_participants_availability):
        missing(7, "key_participants_availability")
    if blank(form.stop_exercise_keyword):
        missing(8, "stop_exercise_keyword")
    for risk in risks:
        if blank(risk.risk) or blank(risk.mitigation):
            missing(8, "risks", str(risk.id))

    # V03 -- measurable objectives.
    for objective in objectives:
        for field in ("success_criterion", "evidence"):
            if blank(getattr(objective, field)):
                ready.append(
                    ValidationIssue(
                        code="OBJECTIVE_NOT_MEASURABLE",
                        section=5,
                        field=field,
                        item_id=str(objective.id),
                    )
                )

    # V05 -- every selected capability has an objective. Reported on the
    # objectives section: adding an objective is how it gets fixed, and the
    # capability selection itself is fine.
    covered = {objective.capability for objective in objectives}
    for capability in form.capabilities:
        if capability not in covered:
            ready.append(
                ValidationIssue(
                    code="CAPABILITY_WITHOUT_OBJECTIVE",
                    section=5,
                    field="objectives",
                    item_id=capability,
                )
            )

    # V11 -- a framework an objective cites should be named in Triggers,
    # so the regulatory reason for the exercise is on record. Reported where
    # it's fixed (Triggers), once per framework.
    named = set(form.regulatory_frameworks or [])
    for framework in dict.fromkeys(
        _REQUIREMENT_FRAMEWORK[r]
        for objective in objectives
        for r in objective.regulatory_requirement_ids or []
        if r in _REQUIREMENT_FRAMEWORK
    ):
        if framework not in named:
            warnings.append(
                ValidationIssue(
                    code="OBJECTIVE_FRAMEWORK_NOT_NAMED",
                    section=2,
                    field="regulatory_frameworks",
                    item_id=framework,
                )
            )

    # V07 -- explicit out of scope.
    if blank(form.out_of_scope):
        ready.append(ValidationIssue(code="OUT_OF_SCOPE_REQUIRED", section=6, field="out_of_scope"))

    # V10 -- a regulatory trigger needs an objective that evidences a
    # requirement. When the only regulation named is OTHER the catalog has
    # nothing for it, so that's only a warning.
    if Trigger.REGULATORY in form.triggers and not any(
        objective.regulatory_requirement_ids for objective in objectives
    ):
        if form.regulatory_frameworks == [FRAMEWORK_OTHER]:
            warnings.append(
                ValidationIssue(
                    code="REGULATORY_OBJECTIVE_SUGGESTED",
                    section=5,
                    field="regulatory_requirement_ids",
                )
            )
        else:
            ready.append(
                ValidationIssue(
                    code="REGULATORY_OBJECTIVE_REQUIRED",
                    section=5,
                    field="regulatory_requirement_ids",
                )
            )

    # V08 -- commitment to close findings.
    if not form.findings_closure_commitment or blank(form.findings_owner):
        approved.append(
            ValidationIssue(
                code="FINDINGS_COMMITMENT_REQUIRED",
                section=1,
                field="findings_closure_commitment"
                if not form.findings_closure_commitment
                else "findings_owner",
            )
        )

    # V09 -- sponsor and design lead approved this version.
    recorded = {a.approver_kind for a in approvals if a.version == form.version}
    for kind in REQUIRED_APPROVERS:
        if kind not in recorded:
            approved.append(
                ValidationIssue(
                    code="APPROVALS_MISSING", section=9, field="approvals", item_id=kind.value
                )
            )

    # V06 -- warning: a HIGH need no objective answers.
    linked = {need_id for need_ids in links.values() for need_id in need_ids}
    for need in needs:
        if need.priority == NeedPriority.HIGH and need.id not in linked:
            warnings.append(
                ValidationIssue(
                    code="HIGH_NEED_WITHOUT_OBJECTIVE",
                    section=3,
                    field="needs",
                    item_id=str(need.id),
                )
            )

    # Warning: vague success criteria.
    for objective in objectives:
        if _VAGUE_PATTERN.search(objective.success_criterion):
            warnings.append(
                ValidationIssue(
                    code="VAGUE_SUCCESS_CRITERION",
                    section=5,
                    field="success_criterion",
                    item_id=str(objective.id),
                )
            )

    # Warning: a condition that says how to rate rather than what to observe
    # ("Partially achieved: ...") -- the EEG would make it a point to tick.
    for objective in objectives:
        if any(is_rating_level(line) for line in condition_lines(objective.success_criterion)):
            warnings.append(
                ValidationIssue(
                    code="CONDITION_IS_A_RATING_LEVEL",
                    section=5,
                    field="success_criterion",
                    item_id=str(objective.id),
                )
            )

    return ValidationReport(ready=ready, approved=approved, warnings=warnings)


def objectives_in_use(session: Session, objective_ids: set[uuid.UUID]) -> list[str]:
    """Codes of the MSEL injects and phases linking any of these objectives
    -- what stops the needs analysis from deleting them (OBJECTIVE_IN_USE)."""
    if not objective_ids:
        return []
    injects = session.exec(
        select(Inject.code)
        .join(InjectObjective, InjectObjective.inject_id == Inject.id)
        .where(InjectObjective.objective_id.in_(list(objective_ids)))
    ).all()
    phases = session.exec(
        select(MselPhase.code)
        .join(MselPhaseObjective, MselPhaseObjective.phase_id == MselPhase.id)
        .where(MselPhaseObjective.objective_id.in_(list(objective_ids)))
    ).all()
    return sorted(set(injects) | set(phases))


def _removed_objectives(
    session: Session, form: TTXNeedsForm, payload: NeedsFormSaveRequest
) -> set[uuid.UUID]:
    saved = set(session.exec(select(TTXObjective.id).where(TTXObjective.form_id == form.id)))
    return saved - {o.id for o in payload.objectives if o.id}


def draft_report(session: Session, ttx: TTX, payload: NeedsFormSaveRequest) -> ValidationReport:
    """The validation report the form *would* have with this payload,
    without saving anything -- the needs-form page calls it (debounced) as
    the user edits, so the summary is live while the backend stays the one
    place the rules live. Rows are named by their id when saved, by their
    payload key otherwise. The rules that would make the save itself fail
    (V01, V02, V04) are reported as issues too, instead of a 422."""
    form = get_form(session, ttx.id)
    preview = SimpleNamespace(
        **{field: getattr(payload, field) for field in SCALAR_FIELDS}, version=form.version
    )

    needs = [
        SimpleNamespace(id=n.key, title=n.title, finding=n.finding, priority=n.priority)
        for n in payload.needs
    ]
    need_keys = {n.key for n in payload.needs}
    objectives = []
    links: dict[str, list[str]] = {}
    save_blockers: list[ValidationIssue] = []
    for index, item in enumerate(payload.objectives):
        key = str(item.id) if item.id else (item.key or f"objective-{index}")
        objectives.append(
            SimpleNamespace(
                id=key,
                title=item.title,
                statement=item.statement,
                capability=item.capability,
                success_criterion=item.success_criterion,
                evidence=item.evidence,
                regulatory_requirement_ids=item.regulatory_requirement_ids,
            )
        )
        links[key] = [k for k in item.linked_need_keys if k in need_keys]
        if not links[key]:
            save_blockers.append(
                ValidationIssue(
                    code="OBJECTIVE_WITHOUT_NEED", section=5, field="linked_need_keys", item_id=key
                )
            )
        if item.capability not in payload.capabilities:
            save_blockers.append(
                ValidationIssue(
                    code="OBJECTIVE_CAPABILITY_NOT_SELECTED",
                    section=5,
                    field="capability",
                    item_id=key,
                )
            )
    if len(payload.capabilities) > MAX_CAPABILITIES:
        save_blockers.append(
            ValidationIssue(code="NEEDS_FORM_LIMIT", section=4, field="capabilities")
        )
    if len(payload.objectives) > MAX_OBJECTIVES:
        save_blockers.append(
            ValidationIssue(code="NEEDS_FORM_LIMIT", section=5, field="objectives")
        )
    risks = [
        SimpleNamespace(
            id=str(r.id) if r.id else (r.key or f"risk-{index}"),
            risk=r.risk,
            mitigation=r.mitigation,
        )
        for index, r in enumerate(payload.risks)
    ]
    for objective_id in _removed_objectives(session, form, payload):
        if objectives_in_use(session, {objective_id}):
            save_blockers.append(
                ValidationIssue(
                    code="OBJECTIVE_IN_USE",
                    section=5,
                    field="objectives",
                    item_id=str(objective_id),
                )
            )
    approvals = list(
        session.exec(select(TTXNeedsFormApproval).where(TTXNeedsFormApproval.form_id == form.id))
    )
    report = validation_report(preview, needs, objectives, links, risks, approvals)
    report.ready = save_blockers + report.ready
    return report


def form_read(session: Session, ttx: TTX, form: TTXNeedsForm) -> NeedsFormRead:
    needs, objectives, links, risks, approvals = _children(session, form)
    evidence = evidence_for_approvals(session, [a.id for a in approvals])
    people = {a.recorded_by_id for a in approvals} | {
        e.uploaded_by_id for files in evidence.values() for e in files
    }
    recorders = (
        {user.id: user.full_name for user in session.exec(select(User).where(User.id.in_(people)))}
        if people
        else {}
    )
    return NeedsFormRead(
        id=form.id,
        ttx_id=form.ttx_id,
        exercise_code=ttx.code,
        status=form.status,
        version=form.version,
        revision=form.revision,
        tlp=form.tlp,
        document_date=form.document_date,
        design_lead=form.design_lead,
        sponsor_name=form.sponsor_name,
        sponsor_role=form.sponsor_role,
        sponsor_motivation=form.sponsor_motivation,
        findings_closure_commitment=form.findings_closure_commitment,
        findings_owner=form.findings_owner,
        aar_recipient=form.aar_recipient,
        aar_recipient_other=form.aar_recipient_other,
        triggers=form.triggers,
        regulatory_frameworks=form.regulatory_frameworks,
        regulatory_framework_other=form.regulatory_framework_other,
        trigger_other=form.trigger_other,
        capabilities=form.capabilities,
        levels=form.levels,
        participating_areas=form.participating_areas,
        third_parties=form.third_parties,
        perimeter=form.perimeter,
        out_of_scope=form.out_of_scope,
        date_window_start=form.date_window_start,
        date_window_end=form.date_window_end,
        max_duration_hours=form.max_duration_hours,
        key_participants_availability=form.key_participants_availability,
        confidentiality_restrictions=form.confidentiality_restrictions,
        budget_and_external_support=form.budget_and_external_support,
        stop_exercise_keyword=form.stop_exercise_keyword,
        needs=[NeedRead.model_validate(need) for need in needs],
        objectives=[
            ObjectiveRead(
                id=o.id,
                code=o.code,
                title=o.title,
                statement=o.statement,
                capability=o.capability,
                linked_need_ids=links[o.id],
                success_criterion=o.success_criterion,
                achieve_at_least=o.achieve_at_least,
                time_box_minutes=o.time_box_minutes,
                achieved_note=o.achieved_note,
                partially_achieved=o.partially_achieved,
                not_achieved=o.not_achieved,
                evidence=o.evidence,
                regulatory_requirement_ids=o.regulatory_requirement_ids,
            )
            for o in objectives
        ],
        risks=[RiskRead.model_validate(risk) for risk in risks],
        approvals=[
            ApprovalRead(
                id=a.id,
                version=a.version,
                approver_kind=a.approver_kind,
                approver_name=a.approver_name,
                approver_role=a.approver_role,
                approved_on=a.approved_on,
                recorded_by_name=recorders.get(a.recorded_by_id, ""),
                recorded_at=a.recorded_at,
                evidence=[
                    EvidenceRead(
                        id=e.id,
                        filename=e.original_filename,
                        content_type=e.content_type,
                        size_bytes=e.size_bytes,
                        uploaded_by_name=recorders.get(e.uploaded_by_id, ""),
                        uploaded_at=e.uploaded_at,
                    )
                    for e in evidence[a.id]
                ],
            )
            for a in approvals
        ],
        updated_at=form.updated_at,
        validation=validation_report(form, needs, objectives, links, risks, approvals),
        renumberable=_renumberable(session, form, needs, objectives, links),
    )


def current_report(session: Session, form: TTXNeedsForm) -> ValidationReport:
    return validation_report(form, *_children(session, form))


# -- writes ---------------------------------------------------------------


def _reject(
    code: str, message: str, status_code: int = 422, params: dict | None = None
) -> AppException:
    return AppException(code, message, status_code, log_level=logging.WARNING, params=params)


def _withdraw_approval(session: Session, form: TTXNeedsForm) -> None:
    """Any edit of a form past DRAFT sends it back to DRAFT. Leaving
    APPROVED opens a new version (the approved one's approvals stay as
    history); leaving READY_FOR_APPROVAL drops the approvals already
    recorded for this version, since they covered content that changed."""
    if form.status == NeedsFormStatus.APPROVED:
        form.version += 1
    elif form.status == NeedsFormStatus.READY_FOR_APPROVAL:
        current = list(
            session.exec(
                select(TTXNeedsFormApproval.id).where(
                    TTXNeedsFormApproval.form_id == form.id,
                    TTXNeedsFormApproval.version == form.version,
                )
            )
        )
        delete_evidence_for_approvals(session, current)
        session.execute(delete(TTXNeedsFormApproval).where(TTXNeedsFormApproval.id.in_(current)))
    form.status = NeedsFormStatus.DRAFT


def _touch(form: TTXNeedsForm, user: User) -> None:
    form.revision += 1
    form.updated_at = datetime.now(UTC)
    form.updated_by_id = user.id


SCALAR_FIELDS = (
    "tlp", "document_date", "design_lead",
    "sponsor_name", "sponsor_role", "sponsor_motivation",
    "findings_closure_commitment", "findings_owner", "aar_recipient", "aar_recipient_other",
    "triggers", "regulatory_frameworks", "regulatory_framework_other", "trigger_other",
    "capabilities",
    "levels", "participating_areas", "third_parties", "perimeter", "out_of_scope",
    "date_window_start", "date_window_end", "max_duration_hours",
    "key_participants_availability", "confidentiality_restrictions",
    "budget_and_external_support",
    "stop_exercise_keyword",
)  # fmt: skip


def save_form(
    session: Session, ttx: TTX, payload: NeedsFormSaveRequest, user: User
) -> TTXNeedsForm:
    form = get_form(session, ttx.id, lock=True)
    if payload.revision != form.revision:
        raise _reject(
            "NEEDS_FORM_STALE",
            "Someone else saved this form since you opened it. Reload to see their changes.",
            409,
        )

    # V01
    if len(payload.capabilities) > MAX_CAPABILITIES or len(payload.objectives) > MAX_OBJECTIVES:
        raise _reject(
            "NEEDS_FORM_LIMIT",
            "A form can have at most {capabilities} capabilities and {objectives} objectives.",
            params={"capabilities": MAX_CAPABILITIES, "objectives": MAX_OBJECTIVES},
        )
    need_keys = {need.key for need in payload.needs}
    for index, objective in enumerate(payload.objectives, start=1):
        # V02
        if not objective.linked_need_keys:
            raise _reject(
                "OBJECTIVE_WITHOUT_NEED",
                "Objective {index} must be linked to at least one need.",
                params={"index": index},
            )
        if any(key not in need_keys for key in objective.linked_need_keys):
            raise _reject(
                "UNKNOWN_NEED",
                "Objective {index} is linked to a need that isn't in the form.",
                params={"index": index},
            )
        # V04
        if objective.capability not in payload.capabilities:
            raise _reject(
                "OBJECTIVE_CAPABILITY_NOT_SELECTED",
                "Objective {index} validates a capability that isn't selected.",
                params={"index": index},
            )

    existing_needs = {
        n.id: n for n in session.exec(select(TTXNeed).where(TTXNeed.form_id == form.id))
    }
    existing_objectives = {
        o.id: o for o in session.exec(select(TTXObjective).where(TTXObjective.form_id == form.id))
    }
    existing_risks = {
        r.id: r
        for r in session.exec(select(TTXExerciseRisk).where(TTXExerciseRisk.form_id == form.id))
    }
    for item_id, known in (
        *((n.id, existing_needs) for n in payload.needs if n.id),
        *((o.id, existing_objectives) for o in payload.objectives if o.id),
        *((r.id, existing_risks) for r in payload.risks if r.id),
    ):
        if item_id not in known:
            raise _reject(
                "NEEDS_FORM_ROW_NOT_FOUND", "A row in this save doesn't belong to the form."
            )

    # The MSEL links objectives by id: one it uses can't be deleted here.
    in_use = objectives_in_use(session, _removed_objectives(session, form, payload))
    if in_use:
        raise _reject(
            "OBJECTIVE_IN_USE",
            "An objective you removed is used by the MSEL ({injects}). Unlink it there first.",
            409,
            params={"injects": ", ".join(in_use)},
        )

    _withdraw_approval(session, form)
    for field in SCALAR_FIELDS:
        setattr(form, field, getattr(payload, field))

    # Links go first: every objective's links are rewritten below, and the
    # needs/objectives about to be deleted can't still be referenced.
    if existing_objectives:
        session.execute(
            delete(TTXObjectiveNeed).where(
                TTXObjectiveNeed.objective_id.in_(list(existing_objectives))
            )
        )

    need_ids_by_key: dict[str, uuid.UUID] = {}
    kept_needs: set[uuid.UUID] = set()
    for position, item in enumerate(payload.needs):
        if item.id:
            need = existing_needs[item.id]
            kept_needs.add(need.id)
        else:
            need = TTXNeed(form_id=form.id, code=f"NEED-{form.next_need_number:02d}")
            form.next_need_number += 1
        need.position = position
        need.source = item.source
        need.title = item.title
        need.finding = item.finding
        need.affected_capability = item.affected_capability
        need.priority = item.priority
        session.add(need)
        need_ids_by_key[item.key] = need.id

    kept_objectives: set[uuid.UUID] = set()
    new_links: list[TTXObjectiveNeed] = []
    for position, item in enumerate(payload.objectives):
        if item.id:
            objective = existing_objectives[item.id]
            kept_objectives.add(objective.id)
        else:
            objective = TTXObjective(form_id=form.id, code=f"OBJ-{form.next_objective_number:02d}")
            form.next_objective_number += 1
        objective.position = position
        objective.title = item.title.strip()
        objective.statement = item.statement
        objective.capability = item.capability
        objective.success_criterion = item.success_criterion
        objective.achieve_at_least = clamp_at_least(
            item.achieve_at_least, len(condition_lines(item.success_criterion))
        )
        objective.time_box_minutes = item.time_box_minutes
        objective.achieved_note = item.achieved_note.strip()
        objective.partially_achieved = item.partially_achieved.strip()
        objective.not_achieved = item.not_achieved.strip()
        objective.evidence = item.evidence
        objective.regulatory_requirement_ids = item.regulatory_requirement_ids
        session.add(objective)
        new_links.extend(
            TTXObjectiveNeed(objective_id=objective.id, need_id=need_ids_by_key[key])
            for key in item.linked_need_keys
        )

    kept_risks: set[uuid.UUID] = set()
    for position, item in enumerate(payload.risks):
        if item.id:
            risk = existing_risks[item.id]
            kept_risks.add(risk.id)
        else:
            risk = TTXExerciseRisk(form_id=form.id)
        risk.position = position
        risk.risk = item.risk
        risk.mitigation = item.mitigation
        risk.owner = item.owner
        session.add(risk)

    session.flush()
    release_retest_objectives(session, list(set(existing_objectives) - kept_objectives))
    for gone in set(existing_objectives) - kept_objectives:
        session.delete(existing_objectives[gone])
    for gone in set(existing_needs) - kept_needs:
        session.delete(existing_needs[gone])
    for gone in set(existing_risks) - kept_risks:
        session.delete(existing_risks[gone])
    session.flush()
    session.add_all(new_links)

    _touch(form, user)
    session.add(form)
    session.commit()
    session.refresh(form)
    logger.info(
        "Needs form of TTX %s saved by user %s (revision %s).", ttx.id, user.id, form.revision
    )
    return form


def transition(session: Session, ttx: TTX, to: NeedsFormStatus, user: User) -> TTXNeedsForm:
    form = get_form(session, ttx.id, lock=True)
    current = form.status

    if to == NeedsFormStatus.DRAFT:
        if current == NeedsFormStatus.DRAFT:
            return form
        _withdraw_approval(session, form)
    else:
        allowed_from = {
            NeedsFormStatus.READY_FOR_APPROVAL: NeedsFormStatus.DRAFT,
            NeedsFormStatus.APPROVED: NeedsFormStatus.READY_FOR_APPROVAL,
        }[to]
        if current != allowed_from:
            raise _reject(
                "INVALID_TRANSITION",
                "A {current} form can't move to {to}.",
                409,
                params={"current": current.value, "to": to.value},
            )
        report = current_report(session, form)
        blocking = report.ready + (report.approved if to == NeedsFormStatus.APPROVED else [])
        if blocking:
            logger.warning(
                "Needs form of TTX %s can't move to %s: %s.",
                ttx.id,
                to.value,
                ", ".join(sorted({issue.code for issue in blocking})),
            )
            raise AppException(
                "NEEDS_FORM_INVALID",
                "The form doesn't meet the rules for this step yet. Check the validation summary.",
                409,
                log_level=logging.INFO,
            )
        form.status = to

    _touch(form, user)
    session.add(form)
    session.commit()
    session.refresh(form)
    logger.info(
        "Needs form of TTX %s moved from %s to %s by user %s (version %s).",
        ttx.id,
        current.value,
        form.status.value,
        user.id,
        form.version,
    )
    return form


def _require_ready(form: TTXNeedsForm) -> None:
    if form.status != NeedsFormStatus.READY_FOR_APPROVAL:
        raise _reject(
            "NEEDS_FORM_NOT_READY",
            "Approvals can only be recorded while the form is ready for approval.",
            409,
        )


def record_approval(
    session: Session, ttx: TTX, payload: NeedsFormApprovalRequest, user: User
) -> TTXNeedsForm:
    form = get_form(session, ttx.id, lock=True)
    _require_ready(form)
    # One approval per approver kind and version: recording it again
    # corrects that record in place, keeping its evidence files.
    approval = session.exec(
        select(TTXNeedsFormApproval).where(
            TTXNeedsFormApproval.form_id == form.id,
            TTXNeedsFormApproval.version == form.version,
            TTXNeedsFormApproval.approver_kind == payload.approver_kind,
        )
    ).first() or TTXNeedsFormApproval(
        form_id=form.id, version=form.version, approver_kind=payload.approver_kind
    )
    approval.approver_name = payload.approver_name
    approval.approver_role = payload.approver_role
    approval.approved_on = payload.approved_on
    approval.recorded_by_id = user.id
    approval.recorded_at = datetime.now(UTC)
    session.add(approval)
    _touch(form, user)
    session.add(form)
    session.commit()
    session.refresh(form)
    logger.info(
        "Approval (%s) recorded on needs form of TTX %s, version %s, by user %s.",
        payload.approver_kind.value,
        ttx.id,
        form.version,
        user.id,
    )
    return form


def remove_approval(session: Session, ttx: TTX, approval_id: uuid.UUID, user: User) -> TTXNeedsForm:
    form = get_form(session, ttx.id, lock=True)
    _require_ready(form)
    approval = session.get(TTXNeedsFormApproval, approval_id)
    if approval is None or approval.form_id != form.id or approval.version != form.version:
        raise AppException("APPROVAL_NOT_FOUND", "Approval not found.", 404)
    delete_evidence_for_approvals(session, [approval.id])
    session.delete(approval)
    _touch(form, user)
    session.add(form)
    session.commit()
    session.refresh(form)
    logger.info(
        "Approval %s removed from needs form of TTX %s by user %s.", approval_id, ttx.id, user.id
    )
    return form


def _current_approval(
    session: Session, form: TTXNeedsForm, approval_id: uuid.UUID
) -> TTXNeedsFormApproval:
    approval = session.get(TTXNeedsFormApproval, approval_id)
    if approval is None or approval.form_id != form.id or approval.version != form.version:
        raise AppException("APPROVAL_NOT_FOUND", "Approval not found.", 404)
    return approval


def add_evidence(
    session: Session, ttx: TTX, approval_id: uuid.UUID, upload: UploadFile, user: User
) -> TTXNeedsForm:
    """Attach a file to an approval of the current version. Allowed while
    the form awaits approval and once it is approved -- the signed document
    often arrives after the decision. It doesn't touch the form's content,
    so the revision stays (a concurrent editor isn't made stale)."""
    form = get_form(session, ttx.id, lock=True)
    if form.status == NeedsFormStatus.DRAFT:
        raise _reject(
            "EVIDENCE_NOT_ALLOWED",
            "Evidence can only be attached while the form awaits or has approval.",
            409,
        )
    approval = _current_approval(session, form, approval_id)
    evidence = store_evidence(session, approval.id, upload, user.id)
    session.commit()
    logger.info(
        "Evidence %s (%s, %d bytes) attached to approval %s of TTX %s by user %s.",
        evidence.id,
        evidence.content_type,
        evidence.size_bytes,
        approval.id,
        ttx.id,
        user.id,
    )
    return form


def remove_evidence(
    session: Session, ttx: TTX, approval_id: uuid.UUID, evidence_id: uuid.UUID, user: User
) -> TTXNeedsForm:
    """Only before approval: once approved, the evidence is part of the
    audit trail and can't be taken away."""
    form = get_form(session, ttx.id, lock=True)
    _require_ready(form)
    approval = _current_approval(session, form, approval_id)
    evidence = session.get(TTXNeedsFormEvidence, evidence_id)
    if evidence is None or evidence.approval_id != approval.id:
        raise AppException("EVIDENCE_NOT_FOUND", "Evidence not found.", 404)
    schedule_unlink(session, [evidence.stored_name])
    session.delete(evidence)
    session.commit()
    logger.info("Evidence %s removed from TTX %s by user %s.", evidence_id, ttx.id, user.id)
    return form


def get_evidence(
    session: Session, ttx: TTX, approval_id: uuid.UUID, evidence_id: uuid.UUID
) -> tuple[TTXNeedsFormEvidence, Path]:
    """Any version's evidence (older versions are history) of this TTX's form."""
    form = get_form(session, ttx.id)
    approval = session.get(TTXNeedsFormApproval, approval_id)
    evidence = session.get(TTXNeedsFormEvidence, evidence_id)
    if (
        approval is None
        or approval.form_id != form.id
        or evidence is None
        or evidence.approval_id != approval.id
    ):
        raise AppException("EVIDENCE_NOT_FOUND", "Evidence not found.", 404)
    path = evidence_path(evidence)
    if not path.is_file():
        raise AppException("EVIDENCE_NOT_FOUND", "Evidence file is missing.", 404)
    return evidence, path


def require_approved_form(session: Session, ttx: TTX) -> None:
    """The design gate: scenario content (injects, and later storylines
    and questions) can only be written once the needs form is approved."""
    form = get_form(session, ttx.id)
    if form.status != NeedsFormStatus.APPROVED:
        raise AppException(
            "NEEDS_FORM_NOT_APPROVED",
            "Approve the exercise's needs form before writing its scenario.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )


def release_retest_objectives(session: Session, objective_ids: list[uuid.UUID]) -> None:
    """Objectives about to go: the improvement actions re-tested by them
    keep their exercise, without the objective."""
    if objective_ids:
        session.execute(
            update(ImprovementAction)
            .where(ImprovementAction.retest_objective_id.in_(objective_ids))
            .values(retest_objective_id=None)
        )


def delete_forms_for_ttx(session: Session, ttx_ids: list[uuid.UUID]) -> None:
    """Delete every needs-form row of these exercises, children first (no
    FK here cascades). Used by organization_service.delete_organization."""
    form_ids = list(session.exec(select(TTXNeedsForm.id).where(TTXNeedsForm.ttx_id.in_(ttx_ids))))
    if not form_ids:
        return
    objective_ids = list(
        session.exec(select(TTXObjective.id).where(TTXObjective.form_id.in_(form_ids)))
    )
    if objective_ids:
        session.execute(
            delete(TTXObjectiveNeed).where(TTXObjectiveNeed.objective_id.in_(objective_ids))
        )
    release_retest_objectives(session, objective_ids)
    session.execute(delete(TTXObjective).where(TTXObjective.form_id.in_(form_ids)))
    session.execute(delete(TTXNeed).where(TTXNeed.form_id.in_(form_ids)))
    session.execute(delete(TTXExerciseRisk).where(TTXExerciseRisk.form_id.in_(form_ids)))
    delete_evidence_for_approvals(
        session,
        list(
            session.exec(
                select(TTXNeedsFormApproval.id).where(TTXNeedsFormApproval.form_id.in_(form_ids))
            )
        ),
    )
    session.execute(delete(TTXNeedsFormApproval).where(TTXNeedsFormApproval.form_id.in_(form_ids)))
    session.execute(delete(TTXNeedsForm).where(TTXNeedsForm.id.in_(form_ids)))


# -- renumbering codes -----------------------------------------------------

RENUMBER_PREFIXES = {"needs": "NEED", "objectives": "OBJ"}
_COUNTERS = {"needs": "next_need_number", "objectives": "next_objective_number"}
# Where the needs analysis' free text can name a code.
_TEXT_FIELDS = (
    (
        TTXNeedsForm,
        (
            "sponsor_motivation",
            "perimeter",
            "out_of_scope",
            "key_participants_availability",
            "confidentiality_restrictions",
            "budget_and_external_support",
        ),
    ),
    (TTXNeed, ("title", "finding")),
    (
        TTXObjective,
        (
            "title",
            "statement",
            "success_criterion",
            "achieved_note",
            "partially_achieved",
            "not_achieved",
            "evidence",
        ),
    ),
    (TTXExerciseRisk, ("risk", "mitigation")),
)


def _created(row, prefix: str) -> tuple:
    """The order rows were created in: their current numbers, since codes
    come from a counter that never goes back (a code of another shape,
    last)."""
    number = code_number(row.code, prefix)
    return (number is None, number or 0, row.position)


def _renumber_order(
    kind: str, needs: list, objectives: list, links: dict[uuid.UUID, list[uuid.UUID]]
) -> list:
    """The order codes are renumbered in. Needs: the order they were
    created in, so renumbering only closes the gaps deletions left.
    Objectives: by the first need each one covers (its lowest NEED code),
    so OBJ codes follow NEED codes as the Objectives step groups them; one
    covering no need goes last; ties keep the order they were created in."""
    if kind == "needs":
        return sorted(needs, key=lambda row: _created(row, "NEED"))
    need_number = {need.id: code_number(need.code, "NEED") or float("inf") for need in needs}

    def first_need(objective) -> tuple:
        numbers = [need_number[n] for n in links.get(objective.id, []) if n in need_number]
        return (not numbers, min(numbers, default=0))

    return sorted(objectives, key=lambda row: (*first_need(row), *_created(row, "OBJ")))


def _can_renumber(session: Session, form: TTXNeedsForm) -> bool:
    """Only a first draft never approved, before any MSEL: from then on the
    MSEL, the approvals and the signed PDF hold its codes."""
    if form.status != NeedsFormStatus.DRAFT or form.version != 1:
        return False
    return session.exec(select(TTXMsel.id).where(TTXMsel.ttx_id == form.ttx_id)).first() is None


def _renumberable(
    session: Session,
    form: TTXNeedsForm,
    needs: list,
    objectives: list,
    links: dict[uuid.UUID, list[uuid.UUID]],
) -> list[str]:
    """The kinds whose codes don't follow their order yet -- and can."""
    if not _can_renumber(session, form):
        return []
    return [
        kind
        for kind, prefix in RENUMBER_PREFIXES.items()
        if out_of_order(_renumber_order(kind, needs, objectives, links), prefix)
    ]


def renumber(
    session: Session,
    ttx: TTX,
    kind: str,
    codes: dict[uuid.UUID, str] | None,
    user: User,
) -> tuple[TTXNeedsForm, dict[uuid.UUID, str]]:
    """Renumber needs in creation order or objectives in needs order (or put `codes` back, to
    undo) and rewrite the codes in the form's free text. Returns the
    previous codes."""
    form = get_form(session, ttx.id, lock=True)
    if not _can_renumber(session, form):
        raise _reject(
            "NEEDS_FORM_RENUMBER_NOT_ALLOWED",
            "Codes can only be renumbered in a first draft, before it's approved.",
            409,
        )
    needs, objectives, links, risks, _ = _children(session, form)
    rows = _renumber_order(kind, needs, objectives, links)
    prefix = RENUMBER_PREFIXES[kind]
    previous = {row.id: row.code for row in rows}
    planned = planned_codes(rows, prefix, codes, "NEEDS_FORM_RENUMBER_INVALID")
    mapping = {
        previous[row_id]: code for row_id, code in planned.items() if previous[row_id] != code
    }

    rewrite = code_rewriter(mapping)
    by_model = {
        TTXNeedsForm: [form],
        TTXNeed: needs,
        TTXObjective: objectives,
        TTXExerciseRisk: risks,
    }
    for model, fields in _TEXT_FIELDS:
        rewrite_fields(by_model[model], fields, rewrite)
    for row in rows:
        row.code = planned[row.id]
    counter = _COUNTERS[kind]
    setattr(
        form,
        counter,
        next_number(planned.values(), prefix, codes is None, getattr(form, counter)),
    )
    for group in by_model.values():
        session.add_all(group)
    _touch(form, user)
    session.commit()
    session.refresh(form)
    logger.info("Needs form %s: %s renumbered by user %s", form.id, kind, user.id)
    return form, previous
