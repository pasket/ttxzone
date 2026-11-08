"""The AI assistant's proposals for the after-action report and improvement
plan (docs/features/ai-assistant.md#after-action-report). They go the way
of the others -- kept, never applied: the page's draft takes them and its
autosave persists them -- with two differences. A report records what
happened, so each proposal cites what of the session backs it, and the
citations are checked. And the judgment stays with people: an objective's
level and an action's follow-up can't be proposed."""

import uuid
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from sqlmodel import Session, select

from app.core.exceptions import AppException
from app.models import TTX, AfterActionObjective, AfterActionReport, ImprovementAction, User
from app.schemas.after_action import LongText, ShortText
from app.services.assistant.proposals import (
    _check_room,
    _deleting,
    _finish,
    _Item,
    _new,
    _refused,
    _unknown,
    _update_patch,
    aar_rows,
)
from app.services.assistant.session_record import evidence_index, session_record

_WHERE = "Creator → After-action report"
# Written in capitals on the screens; ids are matched as they come.
_CODED = ("inject", "action")


class EvidenceRef(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["inject", "action", "decision", "poll", "rating", "note", "feedback"]
    ref: str = Field(
        min_length=1,
        max_length=64,
        description=(
            "From get_session_record: an inject's or expected action's code, a decision's, "
            "poll's or note's id, a rating's point_id, a feedback statement's or question's key."
        ),
    )


class _Cited(_Item):
    evidence: list[EvidenceRef] = Field(
        min_length=1, max_length=20, description="What of the session backs this."
    )


class ReportTextItem(_Cited):
    section: Literal["executive_summary", "scenario_summary", "conclusions"]
    text: Annotated[str, Field(min_length=1, max_length=20000)]


class ObjectiveAssessmentItem(_Cited):
    code: str = Field(description="The objective's code, from get_after_action_report.")
    strengths: LongText | None = None
    improvements: LongText | None = None
    analysis: LongText | None = None


class ImprovementActionItem(_Cited):
    code: str | None = Field(default=None, description="An action's code (IP-01) to change it.")
    delete: bool = Field(
        default=False, description="True, with the action's code, to propose removing it."
    )
    objective_code: str | None = None
    finding: LongText | None = None
    action: LongText | None = None
    owner: ShortText | None = None
    owner_area: ShortText | None = None


def find_report_or_refuse(session: Session, ttx: TTX) -> AfterActionReport:
    report = session.exec(
        select(AfterActionReport).where(AfterActionReport.ttx_id == ttx.id)
    ).first()
    if report is None:
        raise AppException(
            "AAR_NOT_STARTED",
            "The after-action report hasn't been started: start it on its page first.",
            404,
        )
    return report


def _known(session: Session, ttx: TTX, report: AfterActionReport) -> dict[str, dict[str, str]]:
    return evidence_index(session_record(session, ttx, report, "en"))


def _cited(item: _Cited, known: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    out: dict[tuple[str, str], dict[str, str]] = {}
    for evidence in item.evidence:
        ref = evidence.ref.strip()
        if evidence.kind in _CODED:
            ref = ref.upper()
        label = known[evidence.kind].get(ref)
        if label is None:
            raise _refused(
                "ASSISTANT_PROPOSAL_UNKNOWN_EVIDENCE",
                "The report's session has no {kind} {ref} to cite.",
                {"kind": evidence.kind, "ref": ref},
            )
        out[(evidence.kind, ref)] = {"kind": evidence.kind, "ref": ref, "label": label}
    return list(out.values())


def propose_report_text(
    session: Session,
    ttx: TTX,
    user: User,
    items: list[ReportTextItem],
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    report = find_report_or_refuse(session, ttx)
    known = _known(session, ttx, report)
    current = aar_rows(session, ttx, "aar_text")[str(report.id)]
    batch = uuid.uuid4()
    proposals = []
    for item in items:
        patch, base = _update_patch(current, {item.section: item.text}, item.section)
        proposals.append(
            _new(
                ttx,
                user,
                batch,
                "aar_text",
                item,
                patch,
                target_id=report.id,
                base=base,
                evidence=_cited(item, known),
            )  # fmt: skip
        )
    return _finish(session, proposals, None, None, _WHERE, dry_run=dry_run)


def propose_objective_assessments(
    session: Session,
    ttx: TTX,
    user: User,
    items: list[ObjectiveAssessmentItem],
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    report = find_report_or_refuse(session, ttx)
    known = _known(session, ttx, report)
    rows = aar_rows(session, ttx, "aar_objective")
    objectives = {
        o.objective_code: o
        for o in session.exec(
            select(AfterActionObjective).where(AfterActionObjective.report_id == report.id)
        )
    }
    batch = uuid.uuid4()
    proposals = []
    for item in items:
        objective = objectives.get(item.code.strip().upper())
        if objective is None:
            raise _unknown("aar_objective", item.code)
        wanted = item.model_dump(exclude_none=True, exclude={"code", "summary", "evidence"})
        patch, base = _update_patch(rows[str(objective.id)], wanted, objective.objective_code)
        proposals.append(
            _new(
                ttx,
                user,
                batch,
                "aar_objective",
                item,
                patch,
                target_id=objective.id,
                base=base,
                evidence=_cited(item, known),
            )  # fmt: skip
        )
    return _finish(session, proposals, None, None, _WHERE, dry_run=dry_run)


def propose_improvement_actions(
    session: Session,
    ttx: TTX,
    user: User,
    items: list[ImprovementActionItem],
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    report = find_report_or_refuse(session, ttx)
    known = _known(session, ttx, report)
    rows = aar_rows(session, ttx, "aar_action")
    actions = {
        a.code: a
        for a in session.exec(
            select(ImprovementAction).where(ImprovementAction.report_id == report.id)
        )
    }
    objectives = set(
        session.exec(
            select(AfterActionObjective.objective_code).where(
                AfterActionObjective.report_id == report.id
            )
        )
    )
    batch = uuid.uuid4()
    proposals = []
    for item in items:
        if _deleting(item):
            action = actions.get((item.code or "").strip().upper())
            if action is None:
                raise _unknown("aar_action", item.code or "")
            proposals.append(
                _new(
                    ttx,
                    user,
                    batch,
                    "aar_action",
                    item,
                    {},
                    target_id=action.id,
                    operation="delete",
                    evidence=_cited(item, known),
                )  # fmt: skip
            )
            continue
        wanted = item.model_dump(
            exclude_none=True, exclude={"code", "summary", "evidence", "delete"}
        )
        if "objective_code" in wanted:
            wanted["objective_code"] = wanted["objective_code"].strip().upper()
            if wanted["objective_code"] not in objectives:
                raise _unknown("aar_objective", wanted["objective_code"])
        evidence = _cited(item, known)
        if item.code:
            action = actions.get(item.code.strip().upper())
            if action is None:
                raise _unknown("aar_action", item.code)
            patch, base = _update_patch(rows[str(action.id)], wanted, action.code)
            proposals.append(
                _new(
                    ttx,
                    user,
                    batch,
                    "aar_action",
                    item,
                    patch,
                    target_id=action.id,
                    base=base,
                    evidence=evidence,
                )  # fmt: skip
            )
        else:
            if not (wanted.get("finding") and wanted.get("action")):
                raise _refused(
                    "ASSISTANT_PROPOSAL_INCOMPLETE",
                    "A new improvement action needs a finding and an action.",
                )
            patch = {"objective_code": None, "owner": "", "owner_area": "", **wanted}
            proposals.append(_new(ttx, user, batch, "aar_action", item, patch, evidence=evidence))
    return _finish(session, proposals, None, None, _WHERE, dry_run=dry_run)
