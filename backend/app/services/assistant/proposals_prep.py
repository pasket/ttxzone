"""Proposals on the session plan: the observation points of its definitive
EEGs (docs/features/ai-assistant.md#session-plan). Checked like the rest
(proposals.py) against the plan's save schema and the report it would
have, never applied: the Session plan page accepts them into its draft.

What stays with people is left out of the schema: dates, the people
(evaluators, attendees, the log keeper), logistics and READY. A seeded
point's text follows its source (a criterion clause, an expected action, a
notification requirement), so only a custom point's text is proposed; any
point's P/S/M/U criteria are."""

import logging
import uuid
from typing import Any

from pydantic import Field, ValidationError
from sqlmodel import Session

from app.core.exceptions import AppException
from app.models import TTX, User
from app.models.ttx_conduct_prep import EegPointKind
from app.schemas.ttx_conduct_prep import ConductPrepRead, ConductPrepSaveRequest
from app.schemas.ttx_needs_form import ValidationReport
from app.services import ttx_conduct_prep_service
from app.services.assistant.proposals import (
    _check_room,
    _close,
    _deleting,
    _first_error,
    _Item,
    _new,
    _pending,
    _refused,
    _update_patch,
    _with_pending,
    patch_row,
    ref,
)

TARGET = "eeg_point"
POINT_FIELDS = ("text", "criteria_p", "criteria_s", "criteria_m", "criteria_u")
_LISTS = {
    "evaluators": ("id", "user_id", "areas", "briefed", "objective_ids"),
    "findings": ("id", "kind", "found_in", "description", "inject_id", "phase_id", "resolved"),
    "attendees": ("id", "user_id", "name", "role", "confirmed", "fallback", "substitute"),
}


class EegPointItem(_Item):
    delete: bool = Field(
        default=False, description="True, with point_id, to propose removing that point."
    )
    point_id: uuid.UUID | None = Field(
        default=None, description="An existing point's id (get_session_plan) to change it."
    )
    objective: str | None = Field(
        default=None, description="For a new point: the objective's code (OBJ-01) of its EEG."
    )
    text: str | None = Field(
        default=None,
        max_length=5000,
        description="What the evaluator watches for. Only on a new or a custom point.",
    )
    criteria_p: str | None = Field(default=None, max_length=5000, description="Performed.")
    criteria_s: str | None = Field(
        default=None, max_length=5000, description="Performed with some challenges."
    )
    criteria_m: str | None = Field(
        default=None, max_length=5000, description="Performed with major challenges."
    )
    criteria_u: str | None = Field(default=None, max_length=5000, description="Unable to perform.")


def payload_from_prep(read: ConductPrepRead) -> dict[str, Any]:
    """The PUT body that would save the plan exactly as it is (the page's
    payloadFromDraft, from the server's side)."""
    data = read.model_dump(mode="json")
    payload = {
        name: data[name]
        for name in ConductPrepSaveRequest.model_fields
        if name in data and name not in ("eeg", *_LISTS)
    }
    payload["eeg"] = [
        {
            "id": o["id"],
            "points": [{"id": p["id"], **{f: p[f] for f in POINT_FIELDS}} for p in o["points"]],
        }
        for o in data["eeg"]
    ]
    for name, fields in _LISTS.items():
        payload[name] = [{f: row.get(f) for f in fields} for row in data[name]]
    return payload


def prep_context(session: Session, ttx: TTX) -> tuple[ConductPrepRead, dict[str, Any]]:
    prep = ttx_conduct_prep_service.find_prep(session, ttx.id)
    if prep is None:
        raise AppException(
            "ASSISTANT_SESSION_PLAN_NOT_OPEN",
            "This exercise has no session plan yet: a Planner opens it in Creator → Session plan.",
            409,
            log_level=logging.WARNING,
        )
    read = ttx_conduct_prep_service.prep_read(session, ttx, prep)
    if not read.editable:
        raise AppException(
            "ASSISTANT_SESSION_PLAN_NOT_EDITABLE",
            "The session plan can't change until its needs analysis is approved again.",
            409,
            log_level=logging.WARNING,
        )
    return read, payload_from_prep(read)


def _validate(payload: dict) -> ConductPrepSaveRequest:
    try:
        return ConductPrepSaveRequest.model_validate(payload)
    except ValidationError as exc:
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "The session plan wouldn't accept it: {detail}",
            {"detail": _first_error(exc)},
        ) from exc


def _report(session: Session, ttx: TTX, payload: dict) -> ValidationReport:
    return ttx_conduct_prep_service.draft_report(session, ttx, _validate(payload))


def apply_point(payload: dict, proposal) -> None:
    """One point proposal into a save payload, as the page's merge does."""
    patch = dict(proposal.patch)
    if proposal.operation == "delete":
        for eeg in payload["eeg"]:
            eeg["points"] = [p for p in eeg["points"] if p["id"] != str(proposal.target_id)]
        return
    if proposal.operation == "create":
        eeg_id = patch.pop("eeg_id")
        for eeg in payload["eeg"]:
            if eeg["id"] == eeg_id:
                eeg["points"].append(
                    {
                        "id": None,
                        "key": ref(proposal.id),
                        **dict.fromkeys(POINT_FIELDS, ""),
                        **patch,
                    }
                )
        return
    for eeg in payload["eeg"]:
        for point in eeg["points"]:
            if point["id"] == str(proposal.target_id):
                patch_row(point, patch, proposal.base, proposal.operation)


def saved_points(session: Session, ttx: TTX) -> dict[str, dict[str, Any]]:
    """The saved plan's points by id, in the page draft's shape."""
    prep = ttx_conduct_prep_service.find_prep(session, ttx.id)
    if prep is None:
        return {}
    read = ttx_conduct_prep_service.prep_read(session, ttx, prep)
    return {
        str(p.id): {"id": str(p.id), **{f: getattr(p, f) for f in POINT_FIELDS}}
        for o in read.eeg
        for p in o.points
    }


def _seeded(objective: str, point) -> AppException:
    """A seeded point leaves with its source, never from the plan (the save
    keeps it): where that source is, one whole message per kind."""
    error = "ASSISTANT_PROPOSAL_NOT_UPDATABLE"
    if point.kind == EegPointKind.EXPECTED_ACTION:
        return _refused(
            error,
            "This point comes from the expected action {action} of {inject}: propose the "
            "inject's expected_actions without it (propose_injects), and update the EEG.",
            {"action": point.source_action_code or "?", "inject": point.source_inject_code or "?"},
        )
    if point.kind == EegPointKind.NOTIFICATION:
        return _refused(
            error,
            "This point comes from a notification requirement {objective} cites: propose its "
            "regulatory_requirement_ids without it (propose_objectives), and update the EEG.",
            {"objective": objective},
        )
    return _refused(
        error,
        "This point comes from a clause of {objective}'s success criterion: propose the "
        "success_criterion without it (propose_objectives), and update the EEG.",
        {"objective": objective},
    )


def propose_eeg_points(
    session: Session,
    ttx: TTX,
    user: User,
    items: list[EegPointItem],
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    read, payload = prep_context(session, ttx)
    eegs = {o.code: o for o in read.eeg if not o.orphaned}
    points = {p.id: (o, p) for o in read.eeg for p in o.points}
    batch = uuid.uuid4()
    proposals = []
    for item in items:
        if _deleting(item):
            if item.point_id not in points:
                raise _refused(
                    "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE",
                    "There is no observation point {code} in this session plan.",
                    {"code": str(item.point_id)},
                )
            eeg, point = points[item.point_id]
            if point.kind != EegPointKind.CUSTOM:
                raise _seeded(eeg.code, point)
            proposals.append(
                _new(
                    ttx,
                    user,
                    batch,
                    TARGET,
                    item,
                    {},
                    target_id=item.point_id,
                    operation="delete",
                )  # fmt: skip
            )
            continue
        wanted = item.model_dump(exclude_unset=True, include=set(POINT_FIELDS), mode="json")
        if item.point_id:
            found = points.get(item.point_id)
            if found is None:
                raise _refused(
                    "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE",
                    "There is no observation point {code} in this session plan.",
                    {"code": str(item.point_id)},
                )
            eeg, point = found
            if point.kind != EegPointKind.CUSTOM and "text" in wanted:
                raise _refused(
                    "ASSISTANT_PROPOSAL_NOT_UPDATABLE",
                    "A seeded point's text follows its source: propose its criteria, or a new "
                    "point.",
                )
            current = {f: getattr(point, f) for f in POINT_FIELDS}
            patch, base = _update_patch(current, wanted, eeg.code)
            proposals.append(
                _new(ttx, user, batch, TARGET, item, patch, target_id=point.id, base=base)
            )
            continue
        eeg = eegs.get((item.objective or "").strip().upper())
        if eeg is None:
            raise _refused(
                "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE",
                "There is no EEG for objective {code} in this session plan.",
                {"code": item.objective or ""},
            )
        if not (wanted.get("text") or "").strip():
            raise _refused(
                "ASSISTANT_PROPOSAL_INCOMPLETE",
                "A new observation point needs its objective and a text.",
            )
        proposals.append(_new(ttx, user, batch, TARGET, item, {"eeg_id": str(eeg.id), **wanted}))
    counted = (
        [p for p in _pending(session, ttx.id, user.id) if p.target == TARGET]
        if include_pending
        else []
    )
    return _close(
        session,
        proposals,
        _with_pending(payload, counted, apply_point, _validate),
        apply_point,
        lambda p: _report(session, ttx, p),
        "Creator → Session plan → Evaluation plan",
        dry_run=dry_run,
    )
