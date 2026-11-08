"""Proposals: changes the AI assistant suggests to an exercise's needs,
objectives, MSEL injects and after-action report, waiting on the page for
their author to accept or discard them
(docs/features/ai-assistant.md#proposals). The report's are made in
proposals_aar.py.

The server checks a proposal before keeping it -- references, the form's
own schema, and the validation report the form would have with it -- but
never applies it: accepting happens in the page's draft, and the form's
own save (with its effects: withdrawing an approval, reopening a READY
MSEL) persists it. The page then marks it applied.

Rows are referred to by id; a row another pending proposal creates, by
"proposal:<id>" (its key in a merged payload and in the page draft)."""

import copy
import json
import logging
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from sqlmodel import Session, col, delete, func, select

from app.core.exceptions import AppException
from app.data.attack_catalog import is_live_technique, load_groups
from app.data.attack_catalog import names as attack_names
from app.models import (
    TTX,
    AfterActionObjective,
    AfterActionReport,
    AssistantProposal,
    ImprovementAction,
    User,
)
from app.models.inject import AttackAttribution, DeliveryMethod, InjectFormat, InjectKind
from app.models.ttx_msel import ActorOrigin, ActorType
from app.models.ttx_need import NeedPriority, NeedSource
from app.models.ttx_needs_form import Capability, Tlp
from app.schemas.threat_actor_library import MAX_THREAT_ACTOR_TECHNIQUES
from app.schemas.ttx_msel import (
    MAX_POLL_OPTIONS,
    AttackRef,
    MeterLevel,
    MselRead,
    MselSaveRequest,
    PollOption,
    PollOutcome,
    PollQuestion,
)
from app.schemas.ttx_needs_form import (
    REGULATORY_FRAMEWORKS,
    NeedsFormRead,
    NeedsFormSaveRequest,
    ValidationReport,
)
from app.services import platform_audit_service, ttx_msel_service, ttx_needs_form_service

logger = logging.getLogger(__name__)

AAR_TARGETS = ("aar_text", "aar_objective", "aar_action")
# The MSEL's rows other than injects, which injects refer to.
MSEL_ROW_TARGETS = ("msel_phase", "msel_actor", "msel_threat")
# The needs analysis' scope: one row, the form itself.
SCOPE_TARGET = "needs_scope"
# The exercise's classification, a field of its needs analysis: one row.
TLP_TARGET = "needs_tlp"
# The exercise's presentation (name, description, content language): one
# row, the exercise itself, saved from Creator → Exercise.
EXERCISE_TARGET = "ttx_meta"
EXERCISE_FIELDS = ("name", "description", "content_language")
TARGETS = (
    "need",
    "objective",
    SCOPE_TARGET,
    TLP_TARGET,
    EXERCISE_TARGET,
    "inject",
    *MSEL_ROW_TARGETS,
    "msel_meta",
    "msel_renumber",
    "eeg_point",
    *AAR_TARGETS,
)
NEEDS_TARGETS = ("need", "objective", SCOPE_TARGET, TLP_TARGET)
# The MSEL's own settings: one row, the MSEL itself.
META_TARGET = "msel_meta"
# Resetting one kind of code to the MSEL's order: an action the page runs
# (its reset button), not a field; the patch names the kind.
RENUMBER_TARGET = "msel_renumber"
MSEL_TARGETS = ("inject", *MSEL_ROW_TARGETS, META_TARGET)
META_FIELDS = (
    "title",
    "summary",
    "exercise_start",
    "incident_start",
    "incident_date",
    "duration_minutes",
    "time_compression",
    "meters",
)
SCOPE_FIELDS = (
    "participating_areas",
    "third_parties",
    "perimeter",
    "out_of_scope",
    "regulatory_frameworks",
    "regulatory_framework_other",
    "max_duration_hours",
    "confidentiality_restrictions",
    "budget_and_external_support",
)
MAX_PENDING_PER_EXERCISE = 50
MAX_PATCH_CHARS = 20_000
PENDING_RETENTION_DAYS = 30
DECIDED_RETENTION_DAYS = 90
REF_PREFIX = "proposal:"


def ref(proposal_id: uuid.UUID | str) -> str:
    return f"{REF_PREFIX}{proposal_id}"


def _refused(code: str, message: str, params: dict | None = None) -> AppException:
    return AppException(code, message, 400, log_level=logging.WARNING, params=params)


# --- The saved documents as save payloads ----------------------------------


_NEED_FIELDS = ("source", "title", "finding", "affected_capability", "priority")
_OBJECTIVE_FIELDS = (
    "title",
    "statement",
    "capability",
    "linked_need_keys",
    "success_criterion",
    "achieve_at_least",
    "time_box_minutes",
    "achieved_note",
    "partially_achieved",
    "not_achieved",
    "evidence",
    "regulatory_requirement_ids",
)


def payload_from_form(read: NeedsFormRead) -> dict[str, Any]:
    """The PUT body that would save the needs analysis exactly as it is
    (the page's payloadFromDraft, from the server's side): rows keyed by
    their id."""
    data = read.model_dump(mode="json")
    payload = {
        name: data[name]
        for name in NeedsFormSaveRequest.model_fields
        if name not in ("needs", "objectives", "risks") and name in data
    }
    payload["needs"] = [
        {"id": n["id"], "key": n["id"], **{f: n[f] for f in _NEED_FIELDS}} for n in data["needs"]
    ]
    payload["objectives"] = [
        {
            "id": o["id"],
            "key": o["id"],
            **{f: o[f] for f in _OBJECTIVE_FIELDS if f != "linked_need_keys"},
            "linked_need_keys": o["linked_need_ids"],
        }
        for o in data["objectives"]
    ]
    payload["risks"] = [
        {
            "id": r["id"],
            "key": r["id"],
            "risk": r["risk"],
            "mitigation": r["mitigation"],
            "owner": r["owner"],
        }
        for r in data["risks"]
    ]
    return payload


def _attack_payload(refs: list[dict]) -> list[dict]:
    return [
        {"domain": r["domain"], "tactic_id": r["tactic_id"], "technique_id": r["technique_id"]}
        for r in refs
    ]


def payload_from_msel(read: MselRead) -> dict[str, Any]:
    """The PUT body that would save the MSEL exactly as it is (the page's
    payloadFromDraft, from the server's side)."""
    data = read.model_dump(mode="json")

    def inject(i: dict) -> dict:
        format = i.get("format", "inject")
        objective_ids = i["objective_ids"] if format == "inject" else []
        return {
            "id": i["id"],
            "key": i["id"],
            "phase_key": i["phase_id"] or "",
            "kind": i["kind"],
            "title": i["title"],
            "content": i["content"],
            "offset_minutes": i["offset_minutes"],
            "trigger_condition": i["trigger_condition"],
            "contingent_purpose": i["contingent_purpose"],
            "fires_at_minute": i.get("fires_at_minute") if i["kind"] == "contingent" else None,
            "format": format,
            "poll_question": i.get("poll_question", ""),
            "poll_options": i.get("poll_options", []),
            "poll_outcomes": i.get("poll_outcomes", []),
            "poll_impacts": i.get("poll_impacts", []),
            "branch_from_key": i.get("branch_from_id"),
            "branch_action_key": i.get("branch_action_id"),
            "rejoin_key": i.get("rejoin_inject_id"),
            "actor_key": i["simulated_actor_id"],
            "attack_attribution": i.get("attack_attribution"),
            "threat_actor_key": i.get("threat_actor_id"),
            "recipients": i["recipients"],
            "room_ids": i.get("room_ids", []),
            "delivery_method": i["delivery_method"],
            "attachment_notes": i["attachment_notes"],
            "attack_techniques": _attack_payload(i["attack_techniques"]),
            "facilitator_notes": i["facilitator_notes"],
            "artifact": i.get("artifact"),
            "review_status": i["review_status"],
            "validated_by": i["validated_by"],
            "validated_by_id": i.get("validated_by_id"),
            "objective_ids": objective_ids,
            "expected_actions": [
                {
                    "id": a["id"],
                    "key": a["id"],
                    "description": a["description"],
                    "responsible_role": a["responsible_role"],
                    "expected_within_minutes": a["expected_within_minutes"],
                    "objective_ids": [
                        o for o in (a.get("objective_ids") or []) if o in objective_ids
                    ],
                }
                for a in i["expected_actions"]
            ],
            "images": [{"image_id": m["id"], "caption": m["caption"]} for m in i.get("images", [])],
            "files": [
                {"file_id": f["id"], "description": f["description"]} for f in i.get("files", [])
            ],
        }

    return {
        "revision": data["revision"],
        "title": data["title"],
        "summary": data["summary"],
        "exercise_start": data["exercise_start"],
        "incident_start": data.get("incident_start"),
        "incident_date": data.get("incident_date"),
        "duration_minutes": data["duration_minutes"],
        "time_compression": data["time_compression"],
        "threat_actors": [
            {
                "id": t["id"],
                "key": t["id"],
                "name": t["name"],
                "mitre_group_id": t["mitre_group_id"],
                "aliases": t["aliases"],
                "description": t["description"],
                "techniques": [
                    {"domain": x["domain"], "technique_id": x["technique_id"]}
                    for x in t["techniques"]
                ],
                "origin": t["origin"],
                "origin_id": t["origin_id"],
                "origin_name": t["origin_name"],
            }
            for t in data.get("threat_actors", [])
        ],
        "actors": [
            {
                "id": a["id"],
                "key": a["id"],
                **{
                    f: a.get(f)
                    for f in (
                        "name",
                        "type",
                        "description",
                        "channel",
                        "origin",
                        "origin_id",
                        "origin_name",
                        "played_by",
                    )
                },
            }
            for a in data["actors"]
        ],
        "phases": [
            {
                "id": p["id"],
                "key": p["id"],
                "name": p["name"],
                "headline": p.get("headline", ""),
                "start_offset": p["start_offset"],
                "end_offset": p["end_offset"],
                "incident_jump_minutes": p.get("incident_jump_minutes", 0),
                "situation_update": p["situation_update"],
                "key_questions": p["key_questions"],
                "objective_ids": p["objective_ids"],
                "due_objective_ids": [
                    o for o in p.get("due_objective_ids", []) if o in p["objective_ids"]
                ],
            }
            for p in data["phases"]
        ],
        "injects": [inject(i) for i in data["injects"]],
        "meters": data["meters"],
    }


# --- Reports: only what a proposal adds ------------------------------------


def _issue_set(report: ValidationReport) -> set[tuple[str, str, str | None, str | None]]:
    return {
        (level, issue.code, issue.field, issue.item_id)
        for level in ("ready", "approved", "warnings")
        for issue in getattr(report, level)
    }


def _new_issues(before: ValidationReport, after: ValidationReport) -> list[dict[str, Any]]:
    added = sorted(_issue_set(after) - _issue_set(before), key=lambda x: (x[0], x[1], x[3] or ""))
    return [
        {"level": level, "code": code, "field": field, "item": item}
        for level, code, field, item in added
    ]


def _resolved_issues(before: ValidationReport, after: ValidationReport) -> list[dict[str, Any]]:
    gone = sorted(_issue_set(before) - _issue_set(after), key=lambda x: (x[0], x[1], x[3] or ""))
    return [
        {"level": level, "code": code, "field": field, "item": item}
        for level, code, field, item in gone
    ]


def _member(value: Any) -> str:
    return json.dumps(value, sort_keys=True, default=str)


def patch_row(row: dict, patch: dict, base: dict | None, operation: str) -> None:
    """A proposal's patch on a payload row, as the page does it: a list
    field on an update takes what it adds and removes against its base (two
    proposals adding recipients both land); any other field is replaced."""
    for field, value in patch.items():
        before = (base or {}).get(field, ...) if base else ...
        if (
            operation == "update"
            and isinstance(value, list)
            and (before is None or isinstance(before, list))
        ):
            was = {_member(v) for v in before or []}
            will = {_member(v) for v in value}
            removed = {_member(v) for v in before or [] if _member(v) not in will}
            added = [v for v in value if _member(v) not in was]
            kept = [v for v in row.get(field) or [] if _member(v) not in removed]
            have = {_member(v) for v in kept}
            row[field] = kept + [copy.deepcopy(v) for v in added if _member(v) not in have]
        else:
            row[field] = copy.deepcopy(value)


def _with_pending(payload: dict, pending: list, apply, validate) -> dict:
    """The payload as if the person accepted these pending proposals, in the
    order they were made; one that no longer fits is left out."""
    base = copy.deepcopy(payload)
    for proposal in pending:
        trial = copy.deepcopy(base)
        try:
            apply(trial, proposal)
            validate(trial)
        except (AppException, ValueError, KeyError, TypeError):
            continue
        base = trial
    return base


def _close(
    session: Session,
    proposals: list,
    base_payload: dict,
    apply,
    report,
    where: str,
    *,
    dry_run: bool,
) -> dict[str, Any]:
    """The report before and after these proposals, on the payload with the
    person's pending ones counted, and the answer."""
    before = report(base_payload)
    merged = copy.deepcopy(base_payload)
    for proposal in proposals:
        apply(merged, proposal)
    after = report(merged)
    return _finish(session, proposals, before, after, where, dry_run=dry_run)


def _deleting(item: Any) -> bool:
    """A deletion names its row and carries nothing else."""
    if not getattr(item, "delete", False):
        return False
    named = getattr(item, "code", None) or getattr(item, "point_id", None)
    if not named:
        raise _refused("ASSISTANT_PROPOSAL_INCOMPLETE", "Name the row to delete by its code.")
    extra = item.model_dump(
        exclude_unset=True, exclude={"code", "point_id", "summary", "delete", "evidence"}
    )
    if extra:
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "A deletion carries nothing else: propose changes separately ({fields}).",
            {"fields": ", ".join(sorted(extra))},
        )
    return True


# --- Proposal inputs (tool arguments) ----------------------------------------


class _Item(BaseModel):
    model_config = ConfigDict(extra="forbid")
    summary: str = Field(default="", max_length=500, description="Why, in one sentence.")


class _DeletableItem(_Item):
    delete: bool = Field(
        default=False,
        description="True, with the row's code (or point_id), to propose removing it.",
    )


class ScopeItem(_Item):
    """The needs analysis' scope. Lists are the whole list you want: what it
    adds and removes against today's is what the person accepts."""

    participating_areas: list[str] | None = Field(
        default=None,
        max_length=50,
        description="The areas taking part (Legal, Communications, SOC...): an inject's "
        "recipients must be among them or the third parties.",
    )
    third_parties: list[str] | None = Field(default=None, max_length=50)
    perimeter: str | None = Field(default=None, max_length=5000)
    out_of_scope: str | None = Field(default=None, max_length=5000)
    regulatory_frameworks: list[Literal[REGULATORY_FRAMEWORKS]] | None = Field(  # type: ignore[valid-type]
        default=None, max_length=20
    )
    regulatory_framework_other: str | None = Field(default=None, max_length=255)
    max_duration_hours: int | None = Field(default=None, ge=1, le=720)
    confidentiality_restrictions: str | None = Field(default=None, max_length=5000)
    budget_and_external_support: str | None = Field(default=None, max_length=5000)


class MeterItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=40)
    key: str | None = Field(
        default=None, max_length=64, description="An existing meter's key, to keep it."
    )


class MselSettingsItem(_Item):
    """The MSEL's own settings. The content language is the exercise's
    (Creator → Exercise), not proposed here."""

    title: str | None = Field(default=None, max_length=255)
    players_summary: str | None = Field(
        default=None,
        max_length=5000,
        description="What the Players read before the session (the MSEL's summary). Not to be "
        "confused with summary, why you propose it.",
    )
    exercise_start: str | None = Field(
        default=None, pattern=r"^\d{2}:\d{2}$", description="When the session starts, HH:MM."
    )
    incident_start: str | None = Field(
        default=None,
        pattern=r"^\d{2}:\d{2}$",
        description="When the incident starts in the fiction, HH:MM.",
    )
    incident_date: str | None = Field(
        default=None, pattern=r"^\d{4}-\d{2}-\d{2}$", description="The scene's date."
    )
    duration_minutes: int | None = Field(default=None, ge=1)
    time_compression: int | None = Field(
        default=None,
        ge=1,
        description="How many minutes of the incident one minute of session stands for "
        "(60: each session minute is an hour of incident).",
    )
    meters: list[MeterItem] | None = Field(
        default=None,
        max_length=6,
        description="The impact meters polls add up on: the whole list. A poll's "
        "poll_impacts name them by key (returned for new ones).",
    )
    reset_codes: list[Literal["phases", "injects", "threat_actors"]] | None = Field(
        default=None,
        max_length=3,
        description="Reset these kinds' codes to the MSEL's order (phases by session time, "
        "injects by storyline, threat actors by list), codes named in texts and expected "
        "actions updated. Only on a draft, and only kinds out of order (get_msel's "
        "codes_out_of_order). The person accepts it like any proposal.",
    )


class ExerciseItem(_Item):
    """The exercise's presentation, the first thing a sponsor and the
    approvers read, and its classification."""

    name: str | None = Field(default=None, max_length=255)
    description: str | None = Field(
        default=None,
        max_length=10000,
        description="The exercise's presentation for its sponsor and approvers (a small "
        "Markdown subset: paragraphs, lists, bold).",
    )
    content_language: Literal["en", "es"] | None = Field(
        default=None,
        description="The language its content is written in. Changing it translates nothing "
        "already written.",
    )
    tlp: Tlp | None = Field(
        default=None,
        description="Its classification (TLP), which binds how everything about it is "
        "handled: always the person's decision, accepted in the needs analysis.",
    )


class NeedItem(_DeletableItem):
    code: str | None = Field(default=None, description="An existing need's code to change it.")
    source: NeedSource | None = None
    title: str | None = Field(default=None, max_length=255)
    finding: str | None = Field(default=None, max_length=5000)
    affected_capability: Capability | None = None
    priority: NeedPriority | None = None


class ObjectiveItem(_DeletableItem):
    code: str | None = Field(default=None, description="An existing objective's code to change it.")
    title: str | None = Field(default=None, max_length=255)
    statement: str | None = Field(default=None, max_length=5000)
    capability: Capability | None = Field(
        default=None,
        description="The capability it tests (a need's is affected_capability: same values).",
    )
    linked_needs: list[str] | None = Field(
        default=None,
        max_length=20,
        description="The needs it answers: need codes (NEED-01) or ids of needs proposed "
        "earlier (propose_needs).",
    )
    success_criterion: str | None = Field(default=None, max_length=5000)
    achieve_at_least: int | None = Field(default=None, ge=1, le=50)
    time_box_minutes: int | None = Field(default=None, ge=1, le=1440)
    evidence: str | None = Field(default=None, max_length=5000)
    regulatory_requirement_ids: list[str] | None = Field(default=None, max_length=20)


class ExpectedActionItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    description: str = Field(min_length=1, max_length=5000)
    responsible_role: str = Field(default="", max_length=255)
    within_minutes: int | None = Field(default=None, ge=1)


class InjectItem(_DeletableItem):
    code: str | None = Field(default=None, description="An existing inject's code to change it.")
    phase: str | None = Field(
        default=None,
        description="The phase's code (PH-01) or the id of a phase proposed earlier.",
    )
    kind: InjectKind | None = None
    title: str | None = Field(default=None, max_length=255)
    content: str | None = Field(default=None, max_length=5000)
    minute: int | None = Field(default=None, ge=0, description="Offset from the start.")
    trigger_condition: str | None = Field(default=None, max_length=5000)
    contingent_purpose: str | None = Field(default=None, max_length=5000)
    actor: str | None = Field(
        default=None,
        description="The simulated actor's code or the id of an actor proposed earlier.",
    )
    threat_actor: str | None = Field(
        default=None,
        description=(
            "With attack_attribution threat_actor: the scenario's threat actor, by code or "
            "by the id of one proposed earlier."
        ),
    )
    delivery_method: DeliveryMethod | None = None
    recipients: list[str] | None = Field(default=None, max_length=20)
    objectives: list[str] | None = Field(default=None, max_length=20, description="OBJ codes.")
    attack_attribution: AttackAttribution | None = None
    attack_techniques: list[AttackRef] | None = Field(default=None, max_length=20)
    facilitator_notes: str | None = Field(default=None, max_length=5000)
    expected_actions: list[ExpectedActionItem] | None = Field(
        default=None,
        max_length=8,
        description="What the table should do. On a change, the whole new list: it replaces "
        "the inject's (observation points seeded from replaced actions lose their source).",
    )
    fires_at_minute: int | None = Field(
        default=None,
        ge=0,
        description="A contingent inject: when the facilitator checks whether to fire it, in "
        "minutes after its phase starts.",
    )
    branch_from: str | None = Field(
        default=None,
        description="A contingent inject: the inject it hangs from, by code or proposal id.",
    )
    branch_action: str | None = Field(
        default=None,
        description="A contingent inject: the expected action of branch_from whose absence "
        "fires it -- its code (INJ-03-A1), or its number (1, 2...) on a proposed inject.",
    )
    rejoin: str | None = Field(
        default=None,
        description="A contingent inject: the mandatory inject where the storyline resumes, "
        "by code or proposal id.",
    )
    format: InjectFormat | None = Field(
        default=None, description="`poll` for a vote of the Players; else `inject`."
    )
    poll_question: PollQuestion | None = None
    poll_options: list[PollOption] | None = Field(
        default=None, max_length=MAX_POLL_OPTIONS, description="2 to 6, as the Players read them."
    )
    poll_outcomes: list[PollOutcome] | None = Field(
        default=None,
        max_length=MAX_POLL_OPTIONS,
        description="What follows each option, by position.",
    )
    poll_impacts: list[dict[str, MeterLevel]] | None = Field(
        default=None,
        max_length=MAX_POLL_OPTIONS,
        description="By option: a meter's key (see get_msel) -> 1 low, 2 medium or 3 high.",
    )


class PhaseItem(_DeletableItem):
    code: str | None = Field(default=None, description="An existing phase's code to change it.")
    name: str | None = Field(default=None, max_length=255)
    headline: str | None = Field(
        default=None, max_length=80, description="One line the table sees as it begins."
    )
    start_minute: int | None = Field(default=None, ge=0, description="Offset from the start.")
    end_minute: int | None = Field(default=None, ge=0)
    incident_jump_minutes: int | None = Field(
        default=None, ge=0, description="Incident time that passes before it ('48 h later')."
    )
    situation_update: str | None = Field(default=None, max_length=5000)
    key_questions: list[str] | None = Field(default=None, max_length=20)
    objectives: list[str] | None = Field(default=None, max_length=20, description="OBJ codes.")


class ActorItem(_DeletableItem):
    code: str | None = Field(default=None, description="An existing actor's code to change it.")
    name: str | None = Field(default=None, max_length=255)
    type: ActorType | None = None
    description: str | None = Field(default=None, max_length=5000)
    channel: DeliveryMethod | None = None
    played_by: str | None = Field(
        default=None, max_length=255, description="Which role of the team plays it (a role)."
    )


class ThreatTechnique(BaseModel):
    model_config = ConfigDict(extra="forbid")
    domain: str = Field(description="enterprise or ics.")
    technique_id: str = Field(max_length=16)
    tactic_id: str | None = Field(
        default=None,
        max_length=16,
        description="Accepted like an inject's, and ignored: a threat actor's techniques "
        "have no tactic.",
    )


class ThreatActorItem(_DeletableItem):
    code: str | None = Field(
        default=None, description="An existing threat actor's code to change it."
    )
    mitre_group_id: str | None = Field(
        default=None,
        description=(
            "A MITRE ATT&CK group (G0034) of the MSEL's release: its name, aliases and "
            "techniques are copied unless given."
        ),
    )
    name: str | None = Field(default=None, max_length=255)
    aliases: list[str] | None = Field(default=None, max_length=50)
    description: str | None = Field(default=None, max_length=5000)
    techniques: list[ThreatTechnique] | None = Field(
        default=None, max_length=MAX_THREAT_ACTOR_TECHNIQUES
    )


# --- Making proposals ------------------------------------------------------


def _pending(session: Session, ttx_id: uuid.UUID, user_id: uuid.UUID) -> list[AssistantProposal]:
    return list(
        session.exec(
            select(AssistantProposal)
            .where(
                AssistantProposal.ttx_id == ttx_id,
                AssistantProposal.user_id == user_id,
                AssistantProposal.status == "pending",
            )
            .order_by(col(AssistantProposal.created_at))
        ).all()
    )


def _check_room(session: Session, ttx: TTX, user: User, adding: int) -> None:
    if adding == 0:
        raise _refused("ASSISTANT_PROPOSAL_EMPTY", "Propose at least one item.")
    count = session.exec(
        select(func.count())
        .select_from(AssistantProposal)
        .where(
            AssistantProposal.ttx_id == ttx.id,
            AssistantProposal.user_id == user.id,
            AssistantProposal.status == "pending",
        )
    ).one()
    if count + adding > MAX_PENDING_PER_EXERCISE:
        raise AppException(
            "ASSISTANT_PROPOSAL_LIMIT",
            "Too many proposals wait for a decision on this exercise ({limit} at most): "
            "ask the person to review them first.",
            409,
            log_level=logging.WARNING,
            params={"limit": MAX_PENDING_PER_EXERCISE},
        )


def _new(
    ttx: TTX,
    user: User,
    batch_id: uuid.UUID,
    target: str,
    item: _Item,
    patch: dict,
    *,
    target_id: uuid.UUID | None = None,
    base: dict | None = None,
    depends_on: list[str] | None = None,
    evidence: list[dict] | None = None,
    operation: str | None = None,
) -> AssistantProposal:
    if len(json.dumps(patch, default=str)) > MAX_PATCH_CHARS:
        raise _refused("ASSISTANT_PROPOSAL_TOO_LARGE", "A proposal is too large: split it.")
    return AssistantProposal(
        id=uuid.uuid4(),
        ttx_id=ttx.id,
        user_id=user.id,
        batch_id=batch_id,
        target=target,
        operation=operation or ("update" if target_id else "create"),
        target_id=target_id,
        base=base,
        patch=patch,
        depends_on=depends_on or [],
        evidence=evidence or [],
        summary=item.summary,
    )


def _update_patch(current: dict, wanted: dict, code: str) -> tuple[dict, dict]:
    """The fields that change, and what they were."""
    patch = {k: v for k, v in wanted.items() if current.get(k) != v}
    if not patch:
        raise _refused(
            "ASSISTANT_PROPOSAL_NO_CHANGE",
            "The proposal for {code} changes nothing.",
            {"code": code},
        )
    return patch, {k: current.get(k) for k in patch}


def _validate_needs(payload: dict) -> NeedsFormSaveRequest:
    try:
        return NeedsFormSaveRequest.model_validate(payload)
    except ValidationError as exc:
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "The needs analysis wouldn't accept it: {detail}",
            {"detail": _first_error(exc)},
        ) from exc


def _validate_msel(payload: dict) -> MselSaveRequest:
    try:
        return MselSaveRequest.model_validate(payload)
    except ValidationError as exc:
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "The MSEL wouldn't accept it: {detail}",
            {"detail": _first_error(exc)},
        ) from exc


def _first_error(exc: ValidationError) -> str:
    error = exc.errors()[0]
    where = ".".join(str(part) for part in error.get("loc", ()))
    return f"{where}: {error.get('msg', '')}".strip(": ")


def _apply_need(payload: dict, proposal: AssistantProposal) -> None:
    if proposal.operation == "create":
        payload["needs"].append({"id": None, "key": ref(proposal.id), **proposal.patch})
        return
    if proposal.operation == "delete":
        gone = str(proposal.target_id)
        payload["needs"] = [n for n in payload["needs"] if n["id"] != gone]
        for objective in payload["objectives"]:
            objective["linked_need_keys"] = [
                k for k in objective.get("linked_need_keys", []) if k != gone
            ]
        return
    for need in payload["needs"]:
        if need["id"] == str(proposal.target_id):
            patch_row(need, proposal.patch, proposal.base, proposal.operation)


def _apply_scope(payload: dict, proposal: AssistantProposal) -> None:
    patch_row(payload, proposal.patch, proposal.base, proposal.operation)


def apply_needs(payload: dict, proposal: AssistantProposal) -> None:
    """Any needs analysis proposal into a save payload."""
    if proposal.target == "need":
        _apply_need(payload, proposal)
    elif proposal.target == "objective":
        _apply_objective(payload, proposal)
    elif proposal.target in (SCOPE_TARGET, TLP_TARGET):
        _apply_scope(payload, proposal)


def _apply_objective(payload: dict, proposal: AssistantProposal) -> None:
    patch = dict(proposal.patch)
    for capability in patch.pop("capabilities_to_add", []):
        if capability not in payload["capabilities"]:
            payload["capabilities"].append(capability)
    if proposal.operation == "delete":
        payload["objectives"] = [
            o for o in payload["objectives"] if o["id"] != str(proposal.target_id)
        ]
        return
    if proposal.operation == "create":
        row = {
            "id": None,
            "key": ref(proposal.id),
            "title": "",
            "statement": "",
            "linked_need_keys": [],
            "success_criterion": "",
            "evidence": "",
            "regulatory_requirement_ids": [],
            **patch,
        }
        payload["objectives"].append(row)
        return
    for objective in payload["objectives"]:
        if objective["id"] == str(proposal.target_id):
            patch_row(objective, patch, proposal.base, proposal.operation)


def _needs_context(
    session: Session, ttx: TTX, user: User
) -> tuple[NeedsFormRead, dict, list[AssistantProposal]]:
    read = ttx_needs_form_service.form_read(
        session, ttx, ttx_needs_form_service.get_form(session, ttx.id)
    )
    return read, payload_from_form(read), _pending(session, ttx.id, user.id)


def _report_needs(session: Session, ttx: TTX, payload: dict) -> ValidationReport:
    return ttx_needs_form_service.draft_report(session, ttx, _validate_needs(payload))


def _finish(
    session: Session,
    proposals: list[AssistantProposal],
    before: ValidationReport | None,
    after: ValidationReport | None,
    where: str,
    *,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Keeps the batch (unless a dry run), each proposal with the new issues
    naming its row, and answers the assistant with the balance: what the
    proposals add and what they resolve."""
    issues = _new_issues(before, after) if before and after else []
    resolved = _resolved_issues(before, after) if before and after else []
    for proposal in proposals:
        own = {ref(proposal.id), str(proposal.target_id)}
        proposal.issues = [i for i in issues if i["item"] in own]
        if not dry_run:
            session.add(proposal)
    superseded = [] if dry_run else _supersede(session, proposals)
    if not dry_run:
        session.commit()
    answer: dict[str, Any] = {
        "proposals": [
            {
                **({} if dry_run else {"id": str(p.id)}),
                "target": p.target,
                "operation": p.operation,
                "summary": p.summary,
                "warnings": [
                    f"{i['code']} ({i['field']})" if i["field"] else i["code"] for i in p.issues
                ],
            }
            for p in proposals
        ],
        "impact": {
            "adds": len(issues),
            "resolves": len(resolved),
            "added": [{**i, "item": _item_label(i["item"], proposals)} for i in issues],
            "resolved": resolved,
        },
        "new_warnings": [{**i, "item": _item_label(i["item"], proposals)} for i in issues],
        "next_step": (
            "Nothing was kept: this was a dry run. Call again without dry_run to propose it."
            if dry_run
            else f"Nothing has changed yet. Ask the person to review the proposals in TTX-Zone "
            f"({where}) and accept or discard them."
        ),
    }
    if dry_run:
        answer["dry_run"] = True
    if superseded:
        answer["superseded"] = superseded
    return answer


def _supersede(session: Session, proposals: list[AssistantProposal]) -> list[str]:
    """Older pending proposals these make moot, discarded: an update covering
    every field of an older one on the same row, or a deletion of its row."""
    if not proposals:
        return []
    new_ids = {p.id for p in proposals}
    first = proposals[0]
    older = [
        p
        for p in _pending(session, first.ttx_id, first.user_id)
        if p.id not in new_ids and p.operation in ("update", "delete")
    ]
    gone: list[str] = []
    now = datetime.now(UTC)
    for new in proposals:
        if new.operation not in ("update", "delete"):
            continue
        for old in older:
            if old.target != new.target or old.target_id != new.target_id or str(old.id) in gone:
                continue
            if new.operation == "delete" or set(old.patch) <= set(new.patch):
                old.status = "discarded"
                old.decided_at = now
                session.add(old)
                gone.append(str(old.id))
    return gone


def _item_label(item: str | None, proposals: list[AssistantProposal]) -> str | None:
    for p in proposals:
        if item in (ref(p.id), str(p.target_id)):
            return f"proposal {p.id}"
    return item


def _needs_base(
    payload: dict,
    pending: list[AssistantProposal],
    used: list[AssistantProposal],
    include_pending: bool,
) -> dict:
    """What the report is measured from: the saved form with the person's
    pending proposals on it, or only the ones these depend on."""
    counted = [p for p in pending if p.target in NEEDS_TARGETS] if include_pending else used
    return _with_pending(payload, counted, apply_needs, _validate_needs)


def propose_needs(
    session: Session,
    ttx: TTX,
    user: User,
    items: list[NeedItem],
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    read, payload, pending = _needs_context(session, ttx, user)
    by_code = {n.code: n for n in read.needs}
    current_rows = {n["id"]: n for n in payload["needs"]}
    batch = uuid.uuid4()
    proposals = []
    for item in items:
        if _deleting(item):
            need = by_code.get((item.code or "").strip().upper())
            if need is None:
                raise _unknown("need", item.code or "")
            proposals.append(
                _new(ttx, user, batch, "need", item, {}, target_id=need.id, operation="delete")
            )
            continue
        wanted = item.model_dump(
            exclude_unset=True, exclude={"code", "summary", "delete"}, mode="json"
        )
        if item.code:
            need = by_code.get(item.code.strip().upper())
            if need is None:
                raise _unknown("need", item.code)
            patch, base = _update_patch(current_rows[str(need.id)], wanted, need.code)
            proposals.append(
                _new(ttx, user, batch, "need", item, patch, target_id=need.id, base=base)
            )
        else:
            missing = [f for f in ("source", "affected_capability", "priority") if f not in wanted]
            if missing or not (wanted.get("title") or wanted.get("finding")):
                raise _refused(
                    "ASSISTANT_PROPOSAL_INCOMPLETE",
                    "A new need needs a source, an affected capability, a priority and a "
                    "title or finding.",
                )
            patch = {"title": "", "finding": "", **wanted}
            proposals.append(_new(ttx, user, batch, "need", item, patch))
    return _close(
        session,
        proposals,
        _needs_base(payload, pending, [], include_pending),
        apply_needs,
        lambda p: _report_needs(session, ttx, p),
        "Creator → Needs analysis",
        dry_run=dry_run,
    )


def _exercise_current(ttx: TTX) -> dict[str, Any]:
    return {
        "name": ttx.name,
        "description": ttx.description or "",
        "content_language": ttx.content_language,
    }


def propose_exercise(
    session: Session,
    ttx: TTX,
    user: User,
    item: ExerciseItem,
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    """The exercise's name, description and language (accepted in Creator →
    Exercise) and its TLP (in the needs analysis, where it's kept)."""
    wanted = item.model_dump(exclude_unset=True, include=set(EXERCISE_FIELDS), mode="json")
    if "name" in wanted and not (wanted["name"] or "").strip():
        raise _refused("ASSISTANT_PROPOSAL_INCOMPLETE", "An exercise needs a name.")
    adding = bool(wanted) + (item.tlp is not None)
    _check_room(session, ttx, user, adding)
    batch = uuid.uuid4()
    proposals = []
    if wanted:
        patch, base = _update_patch(_exercise_current(ttx), wanted, ttx.code)
        proposals.append(
            _new(ttx, user, batch, EXERCISE_TARGET, item, patch, target_id=ttx.id, base=base)
        )
    where = "Creator → Exercise"
    if item.tlp is None:
        return _finish(session, proposals, None, None, where, dry_run=dry_run)
    read, payload, pending = _needs_context(session, ttx, user)
    patch, base = _update_patch({"tlp": payload["tlp"]}, {"tlp": item.tlp.value}, ttx.code)
    proposals.append(_new(ttx, user, batch, TLP_TARGET, item, patch, target_id=read.id, base=base))
    return _close(
        session,
        proposals,
        _needs_base(payload, pending, [], include_pending),
        lambda p, proposal: apply_needs(p, proposal) if proposal.target == TLP_TARGET else None,
        lambda p: _report_needs(session, ttx, p),
        "Creator → Exercise, and the needs analysis for the TLP",
        dry_run=dry_run,
    )


def propose_scope(
    session: Session,
    ttx: TTX,
    user: User,
    item: ScopeItem,
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    """The needs analysis' scope, as one proposal on the form."""
    _check_room(session, ttx, user, 1)
    read, payload, pending = _needs_context(session, ttx, user)
    wanted = item.model_dump(exclude_unset=True, include=set(SCOPE_FIELDS), mode="json")
    if not wanted:
        raise _refused("ASSISTANT_PROPOSAL_EMPTY", "Propose at least one item.")
    current = {f: payload.get(f) for f in SCOPE_FIELDS}
    patch, base = _update_patch(current, wanted, read.exercise_code)
    proposal = _new(
        ttx, user, uuid.uuid4(), SCOPE_TARGET, item, patch, target_id=read.id, base=base
    )
    base_payload = _needs_base(payload, pending, [], include_pending)
    merged = copy.deepcopy(base_payload)
    _apply_scope(merged, proposal)
    msel_impact = _scope_on_msel(session, ttx, base_payload, merged)
    answer = _close(
        session,
        [proposal],
        base_payload,
        apply_needs,
        lambda p: _report_needs(session, ttx, p),
        "Creator → Needs analysis → Scope",
        dry_run=dry_run,
    )
    if msel_impact is not None:
        answer["impact_on_msel"] = msel_impact
    return answer


def _scope_on_msel(session: Session, ttx: TTX, before: dict, after: dict) -> dict | None:
    """What a scope does to the MSEL's warnings (an inject's recipients must
    be in it): measured on the MSEL as it stands."""
    msel = ttx_msel_service.find_msel(session, ttx.id)
    if msel is None:
        return None
    payload = _validate_msel(payload_from_msel(ttx_msel_service.msel_read(session, ttx, msel)))
    old = _report_msel(session, ttx, payload, {f: before[f] for f in SCOPE_FIELDS})
    new = _report_msel(session, ttx, payload, {f: after[f] for f in SCOPE_FIELDS})
    added, resolved = _new_issues(old, new), _resolved_issues(old, new)
    return {
        "adds": len(added),
        "resolves": len(resolved),
        "added": added,
        "resolved": resolved,
    }


def _unknown(target: str, code: str) -> AppException:
    """One whole message per kind of row (the error catalog translates each)."""
    error, params = "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE", {"code": code}
    if target == "need":
        return _refused(error, "There is no need {code} in this exercise.", params)
    if target == "objective":
        return _refused(error, "There is no objective {code} in this exercise.", params)
    if target == "aar_objective":
        return _refused(error, "There is no objective {code} in this report.", params)
    if target == "aar_action":
        return _refused(error, "There is no improvement action {code} in this report.", params)
    if target == "phase":
        return _refused(error, "There is no phase {code} in this MSEL.", params)
    if target == "actor":
        return _refused(error, "There is no actor {code} in this MSEL.", params)
    if target == "threat_actor":
        return _refused(error, "There is no threat actor {code} in this MSEL.", params)
    return _refused(error, "There is no inject {code} in this MSEL.", params)


def propose_objectives(
    session: Session,
    ttx: TTX,
    user: User,
    items: list[ObjectiveItem],
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    read, payload, pending = _needs_context(session, ttx, user)
    need_ids = {n.code: str(n.id) for n in read.needs}
    pending_needs = {str(p.id): p for p in pending if p.target == "need"}
    by_code = {o.code: o for o in read.objectives}
    current_rows = {o["id"]: o for o in payload["objectives"]}
    capabilities = list(read.capabilities)
    batch = uuid.uuid4()
    proposals = []
    used_deps: dict[str, AssistantProposal] = {}
    for item in items:
        if _deleting(item):
            objective = by_code.get((item.code or "").strip().upper())
            if objective is None:
                raise _unknown("objective", item.code or "")
            proposals.append(
                _new(
                    ttx,
                    user,
                    batch,
                    "objective",
                    item,
                    {},
                    target_id=objective.id,
                    operation="delete",
                )  # fmt: skip
            )
            continue
        wanted = item.model_dump(
            exclude_unset=True, exclude={"code", "summary", "linked_needs", "delete"}, mode="json"
        )
        depends: list[str] = []
        if item.linked_needs is not None:
            keys = []
            for reference in item.linked_needs:
                text = reference.strip()
                if text.upper() in need_ids:
                    keys.append(need_ids[text.upper()])
                elif text.removeprefix(REF_PREFIX) in pending_needs:
                    dep = pending_needs[text.removeprefix(REF_PREFIX)]
                    if dep.operation != "create":
                        keys.append(str(dep.target_id))
                    else:
                        keys.append(ref(dep.id))
                        depends.append(str(dep.id))
                        used_deps[str(dep.id)] = dep
                else:
                    row = _decided_row(session, ttx, user, text, "need")
                    if row is None:
                        raise _unknown("need", text)
                    keys.append(row)
            wanted["linked_need_keys"] = list(dict.fromkeys(keys))
        capability = wanted.get("capability")
        if capability and capability not in capabilities:
            if len(capabilities) >= ttx_needs_form_service.MAX_CAPABILITIES:
                raise _refused(
                    "ASSISTANT_PROPOSAL_CAPABILITY_LIMIT",
                    "The exercise already has {limit} capabilities: use one of them.",
                    {"limit": ttx_needs_form_service.MAX_CAPABILITIES},
                )
            capabilities.append(capability)
        if item.code:
            objective = by_code.get(item.code.strip().upper())
            if objective is None:
                raise _unknown("objective", item.code)
            patch, base = _update_patch(current_rows[str(objective.id)], wanted, objective.code)
        else:
            if not (wanted.get("statement") and capability and wanted.get("linked_need_keys")):
                raise _refused(
                    "ASSISTANT_PROPOSAL_INCOMPLETE",
                    "A new objective needs a statement, a capability and at least one need.",
                )
            patch, base = wanted, None
        if capability and capability not in read.capabilities:
            patch["capabilities_to_add"] = [capability]
        target_id = objective.id if item.code else None
        proposals.append(
            _new(
                ttx,
                user,
                batch,
                "objective",
                item,
                patch,
                target_id=target_id,
                base=base,
                depends_on=depends,
            )
        )
    return _close(
        session,
        proposals,
        _needs_base(payload, pending, list(used_deps.values()), include_pending),
        apply_needs,
        lambda p: _report_needs(session, ttx, p),
        "Creator → Needs analysis",
        dry_run=dry_run,
    )


_INJECT_UPDATABLE = {
    "expected_actions",
    "fires_at_minute",
    "branch_from_key",
    "branch_action_key",
    "rejoin_key",
    "phase_key",
    "kind",
    "title",
    "content",
    "offset_minutes",
    "trigger_condition",
    "contingent_purpose",
    "actor_key",
    "delivery_method",
    "recipients",
    "objective_ids",
    "attack_attribution",
    "threat_actor_key",
    "attack_techniques",
    "facilitator_notes",
    "format",
    "poll_question",
    "poll_options",
    "poll_outcomes",
    "poll_impacts",
}


def _msel_context(session: Session, ttx: TTX) -> tuple[MselRead, dict]:
    msel = ttx_msel_service.find_msel(session, ttx.id)
    if msel is None:
        raise AppException(
            "ASSISTANT_MSEL_NOT_OPEN",
            "This exercise has no MSEL yet: it opens once the needs analysis is approved.",
            409,
            log_level=logging.WARNING,
        )
    read = ttx_msel_service.msel_read(session, ttx, msel)
    if not read.editable:
        raise AppException(
            "ASSISTANT_MSEL_NOT_EDITABLE",
            "The MSEL can't change until its needs analysis is approved again.",
            409,
            log_level=logging.WARNING,
        )
    return read, payload_from_msel(read)


def _report_msel(
    session: Session, ttx: TTX, payload: MselSaveRequest, scope: dict | None = None
) -> ValidationReport:
    try:
        return ttx_msel_service.draft_report(session, ttx, payload, scope)
    except (AppException, ValueError) as exc:
        message = exc.message if isinstance(exc, AppException) else str(exc)
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "The MSEL wouldn't accept it: {detail}",
            {"detail": message},
        ) from exc


def _decided_row(session: Session, ttx: TTX, user: User, text: str, target: str) -> str | None:
    """A proposal named by id that's no longer pending: the row it made or
    changed once the person accepted it (they may accept while the client is
    still proposing); None if it isn't one of the person's for that target.
    A discarded one is refused, saying so."""
    try:
        proposal_id = uuid.UUID(text.removeprefix(REF_PREFIX))
    except ValueError:
        return None
    proposal = session.get(AssistantProposal, proposal_id)
    if (
        proposal is None
        or proposal.ttx_id != ttx.id
        or proposal.user_id != user.id
        or proposal.target != target
    ):
        return None
    if proposal.status == "accepted":
        row = proposal.applied_row_id if proposal.operation == "create" else proposal.target_id
        return str(row) if row else None
    if proposal.status == "discarded":
        raise _refused(
            "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE",
            "The proposal {id} was discarded: propose it again, or name an existing row by "
            "its code.",
            {"id": text},
        )
    return None


class _Refs:
    """Names one kind of MSEL row the way a proposal may: by its code, or by
    the id of a pending proposal that creates (or changes) it. A created
    one becomes a dependency of the proposal that names it."""

    def __init__(
        self,
        codes: dict[str, str],
        pending: dict[str, AssistantProposal],
        target: str,
        kind: str,
        decided=None,
    ) -> None:
        self.codes, self.pending, self.target, self.kind = codes, pending, target, kind
        # Resolves a proposal no longer pending (accepted meanwhile).
        self.decided = decided or (lambda text, target: None)

    def key(self, text: str, depends: list[str], used: dict[str, AssistantProposal]) -> str:
        text = text.strip()
        if text.upper() in self.codes:
            return self.codes[text.upper()]
        dep = self.pending.get(text.removeprefix(REF_PREFIX))
        if dep is None or dep.target != self.target:
            row = self.decided(text, self.target)
            if row is None:
                raise _unknown(self.kind, text)
            return row
        if dep.operation != "create":
            return str(dep.target_id)
        depends.append(str(dep.id))
        used[str(dep.id)] = dep
        return ref(dep.id)


def _msel_refs(session: Session, ttx: TTX, user: User, read: MselRead) -> dict[str, _Refs]:
    pending = {str(p.id): p for p in _pending(session, ttx.id, user.id) if p.target in MSEL_TARGETS}

    def decided(text: str, target: str) -> str | None:
        return _decided_row(session, ttx, user, text, target)

    return {
        "phase": _Refs(
            {p.code: str(p.id) for p in read.phases}, pending, "msel_phase", "phase", decided
        ),
        "actor": _Refs(
            {a.code: str(a.id) for a in read.actors}, pending, "msel_actor", "actor", decided
        ),
        "threat_actor": _Refs(
            {t.code: str(t.id) for t in read.threat_actors},
            pending,
            "msel_threat",
            "threat_actor",
            decided,
        ),
    }


def _inject_patch(
    item: InjectItem,
    read: MselRead,
    refs: dict[str, _Refs],
    objectives: dict[str, str],
    depends: list[str],
    used: dict[str, AssistantProposal],
) -> dict[str, Any]:
    wanted: dict[str, Any] = {}
    data = item.model_dump(exclude_unset=True, mode="json")
    simple = (
        "kind",
        "title",
        "content",
        "trigger_condition",
        "contingent_purpose",
        "delivery_method",
        "recipients",
        "attack_attribution",
        "facilitator_notes",
        "format",
        "poll_question",
        "poll_options",
        "poll_outcomes",
        "poll_impacts",
    )
    for name in simple:
        if name in data:
            wanted[name] = data[name]
    if "minute" in data:
        wanted["offset_minutes"] = data["minute"]
    if item.phase is not None:
        wanted["phase_key"] = refs["phase"].key(item.phase, depends, used)
    if "actor" in data:
        wanted["actor_key"] = (
            None if item.actor is None else refs["actor"].key(item.actor, depends, used)
        )
    if "threat_actor" in data:
        if item.threat_actor is None:
            wanted["threat_actor_key"] = None
        else:
            wanted["threat_actor_key"] = refs["threat_actor"].key(item.threat_actor, depends, used)
            wanted.setdefault("attack_attribution", AttackAttribution.THREAT_ACTOR.value)
    if item.objectives is not None:
        ids = []
        for code in item.objectives:
            if code.strip().upper() not in objectives:
                raise _unknown("objective", code)
            ids.append(objectives[code.strip().upper()])
        wanted["objective_ids"] = list(dict.fromkeys(ids))
    if item.attack_techniques is not None:
        wanted["attack_techniques"] = [
            {
                "domain": t.domain,
                "tactic_id": t.tactic_id,
                "technique_id": t.technique_id,
                **dict(
                    zip(
                        ("tactic_name", "technique_name"),
                        attack_names(read.attack_version, t.domain, t.tactic_id, t.technique_id),
                        strict=True,
                    )
                ),
            }
            for t in item.attack_techniques
        ]
    if "fires_at_minute" in data:
        wanted["fires_at_minute"] = data["fires_at_minute"]
    injects = {i.code: str(i.id) for i in read.injects}
    actions = {a.code: str(a.id) for i in read.injects for a in i.expected_actions}
    pending_injects = {str(p.id): p for p in refs["phase"].pending.values() if p.target == "inject"}

    def inject_key(text: str) -> str:
        text = text.strip()
        if text.upper() in injects:
            return injects[text.upper()]
        dep = pending_injects.get(text.removeprefix(REF_PREFIX))
        if dep is None or dep.operation != "create":
            row = refs["phase"].decided(text, "inject")
            if row is None:
                raise _unknown("inject", text)
            return row
        depends.append(str(dep.id))
        used[str(dep.id)] = dep
        return ref(dep.id)

    if "branch_from" in data:
        wanted["branch_from_key"] = inject_key(item.branch_from) if item.branch_from else None
    if "rejoin" in data:
        wanted["rejoin_key"] = inject_key(item.rejoin) if item.rejoin else None
    if "branch_action" in data:
        action = (item.branch_action or "").strip()
        parent = wanted.get("branch_from_key") or ""
        if not action:
            wanted["branch_action_key"] = None
        elif action.upper() in actions:
            wanted["branch_action_key"] = actions[action.upper()]
        elif parent.startswith(REF_PREFIX) and action.isdigit():
            wanted["branch_action_key"] = f"{parent}:{int(action)}"
        else:
            raise _refused(
                "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE",
                "There is no expected action {code} in this MSEL.",
                {"code": action},
            )
    if item.expected_actions is not None:
        wanted["expected_actions"] = [
            {
                "description": a.description,
                "responsible_role": a.responsible_role,
                "expected_within_minutes": a.within_minutes,
            }
            for a in item.expected_actions
        ]
    return wanted


def _inject_row(proposal: AssistantProposal) -> dict[str, Any]:
    """A new inject in the save payload's shape."""
    patch = proposal.patch
    return {
        "id": None,
        "key": ref(proposal.id),
        "phase_key": patch["phase_key"],
        "kind": patch.get("kind", "mandatory"),
        "title": patch.get("title", ""),
        "content": patch.get("content", ""),
        "offset_minutes": patch.get("offset_minutes"),
        "trigger_condition": patch.get("trigger_condition", ""),
        "contingent_purpose": patch.get("contingent_purpose", ""),
        "actor_key": patch.get("actor_key"),
        "fires_at_minute": patch.get("fires_at_minute"),
        "branch_from_key": patch.get("branch_from_key"),
        "branch_action_key": patch.get("branch_action_key"),
        "rejoin_key": patch.get("rejoin_key"),
        "delivery_method": patch.get("delivery_method", "email"),
        "recipients": patch.get("recipients", []),
        "objective_ids": patch.get("objective_ids", []),
        "attack_attribution": patch.get("attack_attribution"),
        "threat_actor_key": patch.get("threat_actor_key"),
        "attack_techniques": _attack_payload(patch.get("attack_techniques", [])),
        "facilitator_notes": patch.get("facilitator_notes", ""),
        "format": patch.get("format", "inject"),
        "poll_question": patch.get("poll_question", ""),
        "poll_options": patch.get("poll_options", []),
        "poll_outcomes": patch.get("poll_outcomes", []),
        "poll_impacts": patch.get("poll_impacts", []),
        "review_status": "draft",
        "expected_actions": [
            {"key": f"{ref(proposal.id)}:{n}", **a, "objective_ids": None}
            for n, a in enumerate(patch.get("expected_actions", []), start=1)
        ],
    }


# Where each kind of MSEL row lives in the save payload, and a new row's
# fields before the proposal's own.
_MSEL_LISTS = {"msel_phase": "phases", "msel_actor": "actors", "msel_threat": "threat_actors"}
_MSEL_DEFAULTS: dict[str, dict[str, Any]] = {
    "msel_phase": {
        "name": "",
        "headline": "",
        "start_offset": 0,
        "end_offset": 0,
        "incident_jump_minutes": 0,
        "situation_update": "",
        "key_questions": [],
        "objective_ids": [],
        "due_objective_ids": [],
    },
    "msel_actor": {
        "name": "",
        "type": ActorType.OTHER.value,
        "description": "",
        "channel": None,
        "origin": ActorOrigin.EXERCISE.value,
        "origin_id": None,
        "origin_name": None,
        "played_by": "",
    },
    "msel_threat": {
        "name": "",
        "mitre_group_id": None,
        "aliases": [],
        "description": "",
        "techniques": [],
        "origin": ActorOrigin.EXERCISE.value,
        "origin_id": None,
        "origin_name": None,
    },
}


def _apply_msel(payload: dict, proposal: AssistantProposal) -> None:
    """One MSEL proposal into a save payload, as the page's merge does."""
    patch = copy.deepcopy(proposal.patch)
    gone = str(proposal.target_id)
    if proposal.target == META_TARGET:
        patch_row(payload, patch, proposal.base, proposal.operation)
        return
    if proposal.target == RENUMBER_TARGET:
        # Codes don't change what the MSEL holds or how it validates.
        return
    if proposal.target == "inject":
        if proposal.operation == "create":
            payload["injects"].append(_inject_row(proposal))
            return
        if proposal.operation == "delete":
            payload["injects"] = [i for i in payload["injects"] if i["id"] != gone]
            return
        base = copy.deepcopy(proposal.base or {})
        for side in (patch, base):
            if side.get("attack_techniques") is not None:
                side["attack_techniques"] = _attack_payload(side["attack_techniques"])
        actions = patch.pop("expected_actions", None)
        base.pop("expected_actions", None)
        for row in payload["injects"]:
            if row["id"] == gone:
                patch_row(row, patch, base, proposal.operation)
                if actions is not None:
                    # A new list replaces the inject's.
                    row["expected_actions"] = [
                        {"key": f"{ref(proposal.id)}:{n}", **a, "objective_ids": None}
                        for n, a in enumerate(actions, start=1)
                    ]
        return
    rows = payload[_MSEL_LISTS[proposal.target]]
    if proposal.operation == "create":
        defaults = copy.deepcopy(_MSEL_DEFAULTS[proposal.target])
        rows.append({"id": None, "key": ref(proposal.id), **defaults, **patch})
        return
    if proposal.operation == "delete":
        payload[_MSEL_LISTS[proposal.target]] = [r for r in rows if r["id"] != gone]
        # What named it no longer does (a phase is refused while it holds injects).
        for inject in payload["injects"]:
            if proposal.target == "msel_actor" and inject.get("actor_key") == gone:
                inject["actor_key"] = None
            if proposal.target == "msel_threat" and inject.get("threat_actor_key") == gone:
                inject["threat_actor_key"] = None
        return
    for row in rows:
        if row["id"] == gone:
            patch_row(row, patch, proposal.base, proposal.operation)
            if "objective_ids" in patch:
                row["due_objective_ids"] = [
                    o for o in row.get("due_objective_ids", []) if o in row["objective_ids"]
                ]


def _pending_scope(session: Session, ttx: TTX, pending: list[AssistantProposal]) -> dict | None:
    """The needs analysis' scope with the person's pending scope proposals
    on it, when there are any: the MSEL's recipients are measured against it."""
    counted = [p for p in pending if p.target == SCOPE_TARGET]
    if not counted:
        return None
    form = ttx_needs_form_service.get_form(session, ttx.id)
    payload = payload_from_form(ttx_needs_form_service.form_read(session, ttx, form))
    for proposal in counted:
        _apply_scope(payload, proposal)
    return {f: payload[f] for f in SCOPE_FIELDS}


def _msel_base(
    payload: dict,
    pending: list[AssistantProposal],
    used: list[AssistantProposal],
    include_pending: bool,
) -> dict:
    counted = [p for p in pending if p.target in MSEL_TARGETS] if include_pending else used
    return _with_pending(payload, counted, _apply_msel, _validate_msel)


def _phase_wanted(item: PhaseItem, read: MselRead, creating: bool) -> dict[str, Any]:
    data = item.model_dump(exclude_unset=True, mode="json")
    renamed = {"start_minute": "start_offset", "end_minute": "end_offset"}
    wanted = {
        renamed.get(name, name): value
        for name, value in data.items()
        if name
        in (
            "name",
            "headline",
            "start_minute",
            "end_minute",
            "incident_jump_minutes",
            "situation_update",
            "key_questions",
        )
    }
    if item.objectives is not None:
        objectives = {o.code: str(o.id) for o in read.needs.objectives}
        ids = []
        for code in item.objectives:
            if code.strip().upper() not in objectives:
                raise _unknown("objective", code)
            ids.append(objectives[code.strip().upper()])
        wanted["objective_ids"] = list(dict.fromkeys(ids))
    return wanted


def _actor_wanted(item: ActorItem, read: MselRead, creating: bool) -> dict[str, Any]:
    return item.model_dump(exclude_unset=True, exclude={"code", "summary"}, mode="json")


def _threat_wanted(item: ThreatActorItem, read: MselRead, creating: bool) -> dict[str, Any]:
    version = read.attack_version
    wanted = item.model_dump(
        exclude_unset=True, exclude={"code", "summary", "mitre_group_id"}, mode="json"
    )
    if item.techniques is not None:
        wanted["techniques"] = [
            {"domain": t.domain, "technique_id": t.technique_id} for t in item.techniques
        ]
        unknown = [
            t.technique_id
            for t in item.techniques
            if t.domain not in ("enterprise", "ics")
            or not is_live_technique(version, t.domain, t.technique_id)
        ]
        if unknown:
            raise _refused(
                "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE",
                "Not a technique of ATT&CK v{version}: {techniques}.",
                {"version": version, "techniques": ", ".join(unknown)},
            )
    if item.mitre_group_id is not None:
        group_id = item.mitre_group_id.strip().upper()
        group = load_groups(version).get(group_id)
        if group is None or group.deprecated:
            raise _refused(
                "ASSISTANT_PROPOSAL_UNKNOWN_REFERENCE",
                "{group} isn't a group of ATT&CK v{version}.",
                {"group": item.mitre_group_id, "version": version},
            )
        wanted["mitre_group_id"] = group.id
        if creating:
            # A copy of the group, as the library's Add makes it.
            wanted.setdefault("name", group.name)
            wanted.setdefault("aliases", list(group.aliases))
            wanted.setdefault(
                "techniques",
                [
                    {"domain": d, "technique_id": t}
                    for d, t in dict.fromkeys(group.techniques)
                    if is_live_technique(version, d, t)
                ][:MAX_THREAT_ACTOR_TECHNIQUES],
            )
            wanted.update(
                origin=ActorOrigin.SYSTEM.value, origin_id=group.id, origin_name=group.name
            )
    return wanted


def _incomplete_row(target: str) -> AppException:
    """One whole message per kind of row (the error catalog translates each)."""
    error = "ASSISTANT_PROPOSAL_INCOMPLETE"
    if target == "msel_phase":
        return _refused(error, "A new phase needs a name.")
    if target == "msel_actor":
        return _refused(error, "A new actor needs a name.")
    return _refused(error, "A new threat actor needs a name or a MITRE ATT&CK group.")


def _propose_msel_rows(
    session: Session,
    ttx: TTX,
    user: User,
    target: str,
    items: list,
    wanted_of,
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    read, payload = _msel_context(session, ttx)
    saved = {
        "msel_phase": read.phases,
        "msel_actor": read.actors,
        "msel_threat": read.threat_actors,
    }
    by_code = {row.code: row for row in saved[target]}
    current_rows = {r["id"]: r for r in payload[_MSEL_LISTS[target]]}
    kind = {"msel_phase": "phase", "msel_actor": "actor", "msel_threat": "threat_actor"}[target]
    batch = uuid.uuid4()
    proposals = []
    for item in items:
        if _deleting(item):
            row = by_code.get((item.code or "").strip().upper())
            if row is None:
                raise _unknown(kind, item.code or "")
            proposals.append(
                _new(ttx, user, batch, target, item, {}, target_id=row.id, operation="delete")
            )
            continue
        wanted = wanted_of(item, read, item.code is None)
        if item.code:
            row = by_code.get(item.code.strip().upper())
            if row is None:
                raise _unknown(kind, item.code)
            patch, base = _update_patch(current_rows[str(row.id)], wanted, row.code)
            proposals.append(
                _new(ttx, user, batch, target, item, patch, target_id=row.id, base=base)
            )
        else:
            if not wanted.get("name"):
                raise _incomplete_row(target)
            proposals.append(_new(ttx, user, batch, target, item, wanted))
    pending = _pending(session, ttx.id, user.id)
    base_payload = _msel_base(payload, pending, [], include_pending)
    scope = _pending_scope(session, ttx, pending) if include_pending else None
    if target == "msel_phase":
        _refuse_phases_with_injects(base_payload, proposals, read)
    where = "Creator → MSEL → Scenario" if target != "msel_phase" else "Creator → MSEL → Phases"
    answer = _close(
        session,
        proposals,
        base_payload,
        _apply_msel,
        lambda p: _report_msel(session, ttx, _validate_msel(p), scope),
        where,
        dry_run=dry_run,
    )
    if not dry_run:
        answer["next_step"] += (
            " Injects can name these by their proposal id before they're accepted."
        )
    return answer


def _refuse_phases_with_injects(
    payload: dict, proposals: list[AssistantProposal], read: MselRead
) -> None:
    """A phase goes only once no inject is left in it (pending deletions and
    moves count)."""
    codes = {str(i.id): i.code for i in read.injects}
    for proposal in proposals:
        if proposal.operation != "delete":
            continue
        inside = [
            codes.get(i["id"] or "", "a proposed inject")
            for i in payload["injects"]
            if i["phase_key"] == str(proposal.target_id)
        ]
        if inside:
            phase = next((p.code for p in read.phases if p.id == proposal.target_id), "")
            raise _refused(
                "ASSISTANT_PROPOSAL_INVALID",
                "{phase} still holds injects ({injects}): propose deleting or moving them first.",
                {"phase": phase, "injects": ", ".join(inside)},
            )


def propose_phases(
    session: Session, ttx: TTX, user: User, items: list[PhaseItem], **options: bool
) -> dict[str, Any]:
    return _propose_msel_rows(session, ttx, user, "msel_phase", items, _phase_wanted, **options)


def propose_actors(
    session: Session, ttx: TTX, user: User, items: list[ActorItem], **options: bool
) -> dict[str, Any]:
    return _propose_msel_rows(session, ttx, user, "msel_actor", items, _actor_wanted, **options)


def propose_threat_actors(
    session: Session, ttx: TTX, user: User, items: list[ThreatActorItem], **options: bool
) -> dict[str, Any]:
    return _propose_msel_rows(session, ttx, user, "msel_threat", items, _threat_wanted, **options)


def _meta_current(payload: dict) -> dict[str, Any]:
    """The settings as a proposal compares them: times as HH:MM."""
    current = {f: payload.get(f) for f in META_FIELDS}
    for f in ("exercise_start", "incident_start"):
        if current[f]:
            current[f] = str(current[f])[:5]
    return current


def _meter_key(name: str, taken: set[str]) -> str:
    base = "".join(c if c.isalnum() else "-" for c in name.lower()).strip("-")[:40] or "meter"
    key, n = base, 2
    while key in taken:
        key, n = f"{base}-{n}", n + 1
    taken.add(key)
    return key


def _scope_deps(session: Session, ttx: TTX, user: User) -> dict[str, list[str]]:
    """Areas the saved scope doesn't hold, by the pending scope proposals
    that add them."""
    form = ttx_needs_form_service.get_form(session, ttx.id)
    saved = set(form.participating_areas or []) | set(form.third_parties or [])
    deps: dict[str, list[str]] = {}
    for proposal in _pending(session, ttx.id, user.id):
        if proposal.target != SCOPE_TARGET:
            continue
        for field in ("participating_areas", "third_parties"):
            for area in proposal.patch.get(field) or []:
                if area not in saved:
                    deps.setdefault(area, []).append(str(proposal.id))
    return deps


def _resets(session: Session, ttx: TTX, read: MselRead, kinds: list[str], user: User) -> list[str]:
    """The kinds a reset can be proposed for: a draft's, out of order, and
    only once nothing pending would move the order again (anchoring a
    contingent inject moves it behind its parent), so it's done once."""
    kinds = list(dict.fromkeys(kinds))
    if not kinds:
        return []
    if "injects" in kinds:
        loose = [
            i.code
            for i in read.injects
            if i.kind.value == "contingent" and i.branch_from_id is None
        ]
        if loose:
            raise _refused(
                "ASSISTANT_PROPOSAL_INVALID",
                "Anchor the contingent injects first ({codes}): anchoring one moves it in the "
                "storyline, and the codes would fall out of order again.",
                {"codes": ", ".join(loose)},
            )
    moving = [
        p for p in _pending(session, ttx.id, user.id) if p.target in ("inject", *MSEL_ROW_TARGETS)
    ]
    if moving:
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "{count} proposals on the MSEL's rows are still pending: reset the codes once "
            "they're accepted or discarded.",
            {"count": len(moving)},
        )
    if read.status.value != "draft":
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "Codes can only be reset while the MSEL is a draft: ask the person to take it "
            "back to draft first.",
        )
    in_order = [k for k in kinds if k not in read.renumberable]
    if in_order:
        raise _refused(
            "ASSISTANT_PROPOSAL_NO_CHANGE",
            "These codes already follow the MSEL's order: {kinds}.",
            {"kinds": ", ".join(in_order)},
        )
    return kinds


def propose_msel_settings(
    session: Session,
    ttx: TTX,
    user: User,
    item: MselSettingsItem,
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, 1)
    read, payload = _msel_context(session, ttx)
    wanted = item.model_dump(exclude_unset=True, include=set(META_FIELDS), mode="json")
    if item.players_summary is not None:
        wanted["summary"] = item.players_summary
    resets = _resets(session, ttx, read, item.reset_codes or [], user)
    if not wanted and not resets:
        raise _refused("ASSISTANT_PROPOSAL_EMPTY", "Propose at least one item.")
    batch = uuid.uuid4()
    reset_proposals = [
        _new(ttx, user, batch, RENUMBER_TARGET, item, {"kind": kind}, target_id=read.id)
        for kind in resets
    ]
    if not wanted:
        return _finish(session, reset_proposals, None, None, "Creator → MSEL", dry_run=dry_run)
    current = _meta_current(payload)
    if item.meters is not None:
        by_name = {m["name"].strip().lower(): m["key"] for m in payload["meters"]}
        taken = {m["key"] for m in payload["meters"]}
        wanted["meters"] = [
            {
                "key": m.key or by_name.get(m.name.strip().lower()) or _meter_key(m.name, taken),
                "name": m.name,
            }
            for m in item.meters
        ]
    patch, base = _update_patch(current, wanted, read.title or "MSEL")
    proposal = _new(ttx, user, batch, META_TARGET, item, patch, target_id=read.id, base=base)
    pending = _pending(session, ttx.id, user.id)
    scope = _pending_scope(session, ttx, pending) if include_pending else None
    answer = _close(
        session,
        [proposal, *reset_proposals],
        _msel_base(payload, pending, [], include_pending),
        _apply_msel,
        lambda p: _report_msel(session, ttx, _validate_msel(p), scope),
        "Creator → MSEL → Scenario",
        dry_run=dry_run,
    )
    if "meters" in patch:
        answer["meter_keys"] = {m["name"]: m["key"] for m in patch["meters"]}
    return answer


def propose_injects(
    session: Session,
    ttx: TTX,
    user: User,
    items: list[InjectItem],
    *,
    dry_run: bool = False,
    include_pending: bool = True,
) -> dict[str, Any]:
    _check_room(session, ttx, user, len(items))
    read, payload = _msel_context(session, ttx)
    refs = _msel_refs(session, ttx, user, read)
    objectives = {o.code: str(o.id) for o in read.needs.objectives}
    by_code = {i.code: i for i in read.injects}
    current_rows = {i["id"]: i for i in payload["injects"]}
    batch = uuid.uuid4()
    proposals = []
    used: dict[str, AssistantProposal] = {}
    scope_deps = _scope_deps(session, ttx, user)
    for item in items:
        if _deleting(item):
            inject = by_code.get((item.code or "").strip().upper())
            if inject is None:
                raise _unknown("inject", item.code or "")
            proposals.append(
                _new(ttx, user, batch, "inject", item, {}, target_id=inject.id, operation="delete")
            )
            continue
        depends: list[str] = []
        wanted = _inject_patch(item, read, refs, objectives, depends, used)
        # Recipients in scope only through a pending scope proposal need it first.
        depends += [
            dep
            for area in wanted.get("recipients") or []
            for dep in scope_deps.get(area, [])
            if dep not in depends
        ]
        if item.code:
            inject = by_code.get(item.code.strip().upper())
            if inject is None:
                raise _unknown("inject", item.code)
            extra = set(wanted) - _INJECT_UPDATABLE
            if extra:
                raise _refused(
                    "ASSISTANT_PROPOSAL_NOT_UPDATABLE",
                    "These can only be proposed with a new inject: {fields}.",
                    {"fields": ", ".join(sorted(extra))},
                )
            current = dict(current_rows[str(inject.id)])
            current["expected_actions"] = [
                {k: a[k] for k in ("description", "responsible_role", "expected_within_minutes")}
                for a in current["expected_actions"]
            ]
            current["attack_techniques"] = [
                {
                    k: t[k]
                    for k in (
                        "domain",
                        "tactic_id",
                        "technique_id",
                        "tactic_name",
                        "technique_name",
                    )
                }
                for t in inject.model_dump(mode="json")["attack_techniques"]
            ]
            patch, base = _update_patch(current, wanted, inject.code)
            proposals.append(
                _new(
                    ttx,
                    user,
                    batch,
                    "inject",
                    item,
                    patch,
                    target_id=inject.id,
                    base=base,
                    depends_on=depends,
                )
            )
        else:
            if "phase_key" not in wanted or not (wanted.get("title") or wanted.get("content")):
                raise _refused(
                    "ASSISTANT_PROPOSAL_INCOMPLETE",
                    "A new inject needs a phase and a title or content.",
                )
            wanted["review_status"] = "draft"
            proposals.append(_new(ttx, user, batch, "inject", item, wanted, depends_on=depends))
    # The rows they need, proposed earlier, count as there for the report.
    pending = _pending(session, ttx.id, user.id)
    scope = _pending_scope(session, ttx, pending) if include_pending else None
    base_payload = _msel_base(
        payload, pending, sorted(used.values(), key=lambda p: p.created_at), include_pending
    )
    for dep in used.values():
        if not any(row.get("key") == ref(dep.id) for name in _MSEL_LISTS.values()
                   for row in base_payload[name]):  # fmt: skip
            _apply_msel(base_payload, dep)
    merged = copy.deepcopy(base_payload)
    for proposal in proposals:
        _apply_msel(merged, proposal)
    validated = _validate_msel(merged)
    dropped = _dropped_fields(merged, validated, proposals)
    if dropped:
        # Kept, it could never be saved as proposed: the page would accept
        # it, the save would clear the fields, and it would come back.
        lost = dropped[0]
        proposal = next(p for p in proposals if str(p.id) == lost["proposal"])
        code = next((i.code for i in read.injects if i.id == proposal.target_id), None)
        raise _refused(
            "ASSISTANT_PROPOSAL_INVALID",
            "The MSEL wouldn't keep {fields} as proposed for {item}: {reasons}",
            {
                "fields": ", ".join(lost["fields"]),
                "item": code or proposal.patch.get("title") or "a new inject",
                "reasons": " ".join(_DROP_REASONS[f] for f in lost["fields"]),
            },
        )
    answer = _close(
        session,
        proposals,
        base_payload,
        _apply_msel,
        lambda p: _report_msel(session, ttx, _validate_msel(p), scope),
        "Creator → MSEL → Injects",
        dry_run=dry_run,
    )
    replaced = {
        str(a.id)
        for p in proposals
        if p.operation == "update" and "expected_actions" in p.patch
        for i in read.injects
        if i.id == p.target_id
        for a in i.expected_actions
    }
    orphaned = _points_from_actions(session, ttx, replaced)
    if orphaned:
        answer["session_plan_note"] = (
            f"{orphaned} observation point(s) of the session plan come from expected actions "
            "these proposals replace: once accepted they lose their source, to be reviewed in "
            "Creator → Session plan."
        )
    return answer


def _points_from_actions(session: Session, ttx: TTX, action_ids: set[str]) -> int:
    if not action_ids:
        return 0
    from app.services import ttx_conduct_prep_service

    prep = ttx_conduct_prep_service.find_prep(session, ttx.id)
    if prep is None:
        return 0
    plan = ttx_conduct_prep_service.prep_read(session, ttx, prep)
    return sum(1 for o in plan.eeg for p in o.points if str(p.source_action_id or "") in action_ids)


# Why the MSEL's save would clear a proposed field: said to the assistant.
_DROP_REASONS = {
    "attack_techniques": "ATT&CK techniques need attack_attribution: threat_actor (with its "
    "threat_actor) or noise.",
    "threat_actor_key": "A threat actor goes with attack_attribution threat_actor and must be "
    "in the scenario.",
    "objective_ids": "Only an inject of format inject has objectives: a poll or a discussion "
    "doesn't.",
    "fires_at_minute": "Only a contingent inject is checked at a minute.",
    "branch_from_key": "Only a contingent inject hangs from another, never from itself.",
    "branch_action_key": "The expected action must be one of branch_from's.",
    "rejoin_key": "Only a contingent inject rejoins the storyline, at another inject.",
}


def _dropped_fields(
    sent: dict, validated: MselSaveRequest, proposals: list[AssistantProposal]
) -> list[dict[str, Any]]:
    """What the MSEL's own rules would clear from a proposed inject (e.g.
    techniques without an attribution, a threat actor that isn't in the
    scenario): such a proposal is refused, so the assistant corrects it."""
    checked = (
        "attack_techniques",
        "threat_actor_key",
        "objective_ids",
        "fires_at_minute",
        "branch_from_key",
        "branch_action_key",
        "rejoin_key",
    )
    out = []
    keys = {ref(p.id): p for p in proposals} | {str(p.target_id): p for p in proposals}
    rows = {(r["key"]): r for r in sent["injects"]}
    for inject in validated.injects:
        proposal = keys.get(inject.key or "")
        row = rows.get(inject.key or "")
        if proposal is None or row is None:
            continue
        after = inject.model_dump(mode="json")
        lost = [
            name
            for name in checked
            if row.get(name) and not after.get(name) and name in proposal.patch
        ]
        if lost:
            out.append({"proposal": str(proposal.id), "fields": lost})
    return out


# --- Deciding ----------------------------------------------------------------


def list_for_author(
    session: Session,
    ttx: TTX,
    user: User,
    status: str | None = "pending",
    target: str | None = None,
) -> list[AssistantProposal]:
    query = select(AssistantProposal).where(
        AssistantProposal.ttx_id == ttx.id, AssistantProposal.user_id == user.id
    )
    if status:
        query = query.where(AssistantProposal.status == status)
    if target:
        query = query.where(AssistantProposal.target == target)
    return list(session.exec(query.order_by(col(AssistantProposal.created_at))).all())


def aar_rows(session: Session, ttx: TTX, target: str) -> dict[str, dict[str, Any]]:
    """The saved report's rows of one kind, with what the assistant may
    change of them: never an objective's level, an action's follow-up."""
    report = session.exec(
        select(AfterActionReport).where(AfterActionReport.ttx_id == ttx.id)
    ).first()
    if report is None:
        return {}
    if target == "aar_text":
        fields = ("executive_summary", "scenario_summary", "conclusions")
        rows: list[Any] = [report]
    elif target == "aar_objective":
        fields = ("strengths", "improvements", "analysis")
        rows = list(
            session.exec(
                select(AfterActionObjective).where(AfterActionObjective.report_id == report.id)
            )
        )
    else:
        fields = ("code", "objective_code", "finding", "action", "owner", "owner_area")
        rows = list(
            session.exec(select(ImprovementAction).where(ImprovementAction.report_id == report.id))
        )
    return {
        str(row.id): {"id": str(row.id), **{name: getattr(row, name) for name in fields}}
        for row in rows
    }


def saved_rows(session: Session, ttx: TTX, target: str) -> dict[str, dict[str, Any]]:
    """The exercise's saved rows of one kind, in the page draft's shape,
    by id: what an update's `base` is compared with."""
    if target in AAR_TARGETS:
        return aar_rows(session, ttx, target)
    if target == EXERCISE_TARGET:
        return {str(ttx.id): {"id": str(ttx.id), **_exercise_current(ttx)}}
    if target == "eeg_point":
        from app.services.assistant.proposals_prep import saved_points

        return saved_points(session, ttx)
    if target in NEEDS_TARGETS:
        form = ttx_needs_form_service.get_form(session, ttx.id)
        read = ttx_needs_form_service.form_read(session, ttx, form)
        payload = payload_from_form(read)
        if target == SCOPE_TARGET:
            return {str(read.id): {"id": str(read.id), **{f: payload[f] for f in SCOPE_FIELDS}}}
        if target == TLP_TARGET:
            return {str(read.id): {"id": str(read.id), "tlp": payload["tlp"]}}
        rows = payload["needs" if target == "need" else "objectives"]
        return {r["id"]: r for r in rows}
    msel = ttx_msel_service.find_msel(session, ttx.id)
    if msel is None:
        return {}
    read = ttx_msel_service.msel_read(session, ttx, msel)
    payload = payload_from_msel(read)
    if target == META_TARGET:
        return {str(read.id): {"id": str(read.id), **_meta_current(payload)}}
    if target == RENUMBER_TARGET:
        return {str(read.id): {"id": str(read.id), "out_of_order": list(read.renumberable)}}
    if target in MSEL_ROW_TARGETS:
        return {r["id"]: r for r in payload[_MSEL_LISTS[target]]}
    techniques = {
        str(i.id): [t.model_dump(mode="json") for t in i.attack_techniques] for i in read.injects
    }
    return {r["id"]: {**r, "attack_techniques": techniques[r["id"]]} for r in payload["injects"]}


def row_codes(session: Session, ttx: TTX) -> dict[str, str]:
    """Every row a proposal can name, by id, with the code the screens show."""
    codes: dict[str, str] = {}
    form = ttx_needs_form_service.get_form(session, ttx.id)
    read = ttx_needs_form_service.form_read(session, ttx, form)
    codes[str(read.id)] = read.exercise_code
    codes |= {str(n.id): n.code for n in read.needs}
    codes |= {str(o.id): o.code for o in read.objectives}
    msel = ttx_msel_service.find_msel(session, ttx.id)
    if msel is not None:
        m = ttx_msel_service.msel_read(session, ttx, msel)
        for rows in (m.phases, m.actors, m.threat_actors, m.injects):
            codes |= {str(r.id): r.code for r in rows}
    from app.services import ttx_conduct_prep_service

    prep = ttx_conduct_prep_service.find_prep(session, ttx.id)
    if prep is not None:
        plan = ttx_conduct_prep_service.prep_read(session, ttx, prep)
        for o in plan.eeg:
            codes |= {str(p.id): f"{o.code} point {n}" for n, p in enumerate(o.points, start=1)}
    codes |= {
        row_id: str(row.get("code") or "")
        for row_id, row in aar_rows(session, ttx, "aar_action").items()
        if row.get("code")
    }
    return codes


_TARGET_NAMES = {
    "need": "need",
    "objective": "objective",
    SCOPE_TARGET: "scope",
    TLP_TARGET: "classification (TLP)",
    EXERCISE_TARGET: "exercise presentation",
    "inject": "inject",
    "msel_phase": "phase",
    "msel_actor": "actor",
    "msel_threat": "threat actor",
    "msel_meta": "MSEL settings",
    RENUMBER_TARGET: "code reset",
    "eeg_point": "observation point",
    "aar_text": "report text",
    "aar_objective": "objective assessment",
    "aar_action": "improvement action",
}


def auto_summary(proposal: AssistantProposal, codes: dict[str, str]) -> str:
    """One line when the assistant gave none: the row and what changes."""
    name = proposal.patch.get("title") or proposal.patch.get("name") or proposal.patch.get("text")
    code = codes.get(str(proposal.target_id), "") if proposal.target_id else ""
    if proposal.operation == "delete":
        return f"Delete {code}".strip()
    if proposal.target == RENUMBER_TARGET:
        return f"Reset {proposal.patch.get('kind', '')} codes to the MSEL's order"
    if proposal.operation == "create":
        return f"New {_TARGET_NAMES.get(proposal.target, proposal.target)}" + (
            f": {name}" if name else ""
        )
    return f"{code}: {', '.join(proposal.patch)}".strip(": ")


def outdated(proposal: AssistantProposal, rows: dict[str, dict[str, Any]]) -> bool:
    """An update whose row is gone or changed since in a proposed field; a
    deletion whose row is already gone."""
    if proposal.operation == "delete":
        return str(proposal.target_id) not in rows
    if proposal.target == RENUMBER_TARGET:
        return False
    if proposal.operation != "update":
        return False
    row = rows.get(str(proposal.target_id))
    if row is None:
        return True
    return any(row.get(k) != v for k, v in (proposal.base or {}).items())


def _get(session: Session, ttx: TTX, user: User, proposal_id: uuid.UUID) -> AssistantProposal:
    proposal = session.get(AssistantProposal, proposal_id)
    if proposal is None or proposal.ttx_id != ttx.id or proposal.user_id != user.id:
        raise AppException(
            "ASSISTANT_PROPOSAL_NOT_FOUND",
            "Proposal not found.",
            404,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    if proposal.status != "pending":
        raise AppException(
            "ASSISTANT_PROPOSAL_DECIDED",
            "This proposal was already accepted or discarded.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    return proposal


def mark_applied(
    session: Session, ttx: TTX, user: User, proposal_id: uuid.UUID, row_id: uuid.UUID
) -> AssistantProposal:
    """The page saved the row the proposal produced: it must be in the
    saved document (and be the proposal's own row, for an update)."""
    proposal = _get(session, ttx, user, proposal_id)
    rows = saved_rows(session, ttx, proposal.target)
    if proposal.target == RENUMBER_TARGET:
        row = rows.get(str(row_id))
        if row is None or proposal.patch["kind"] in row["out_of_order"]:
            raise AppException(
                "ASSISTANT_PROPOSAL_ROW_NOT_SAVED",
                "Those codes don't follow the MSEL's order yet.",
                409,
                ttx_id=str(ttx.id),
                log_level=logging.WARNING,
            )
    elif proposal.operation == "delete":
        if proposal.target_id != row_id or str(row_id) in rows:
            raise AppException(
                "ASSISTANT_PROPOSAL_ROW_NOT_SAVED",
                "That row is still saved in this exercise.",
                409,
                ttx_id=str(ttx.id),
                log_level=logging.WARNING,
            )
    elif str(row_id) not in rows or (
        proposal.operation == "update" and proposal.target_id != row_id
    ):
        raise AppException(
            "ASSISTANT_PROPOSAL_ROW_NOT_SAVED",
            "That row isn't saved in this exercise.",
            409,
            ttx_id=str(ttx.id),
            log_level=logging.WARNING,
        )
    proposal.status = "accepted"
    proposal.applied_row_id = row_id
    proposal.decided_at = datetime.now(UTC)
    session.add(proposal)
    _audit(session, ttx, user, [proposal], "assistant.proposal_accepted")
    session.commit()
    session.refresh(proposal)
    return proposal


def discard(session: Session, ttx: TTX, user: User, proposal_id: uuid.UUID) -> list[uuid.UUID]:
    """Discards it, and the pending proposals that depend on it (an
    objective linked to a need that won't exist). Returns every id."""
    proposal = _get(session, ttx, user, proposal_id)
    now = datetime.now(UTC)
    gone = [proposal]
    for other in _pending(session, ttx.id, user.id):
        if str(proposal.id) in other.depends_on and other.id != proposal.id:
            gone.append(other)
    for item in gone:
        item.status = "discarded"
        item.decided_at = now
        session.add(item)
    _audit(session, ttx, user, gone, "assistant.proposal_discarded")
    session.commit()
    return [item.id for item in gone]


def _audit(
    session: Session, ttx: TTX, user: User, decided: list[AssistantProposal], action
) -> None:
    """The person's decision in Platform's activity log: who, on which row of
    which exercise, never what was proposed (the person validates it)."""
    codes = row_codes(session, ttx)
    for proposal in decided:
        platform_audit_service.record(
            session,
            user,
            action,
            "exercise",
            ttx.id,
            target_label=f"{ttx.code} · {ttx.name}"[:255],
            details={
                "target": proposal.target,
                "operation": proposal.operation,
                "row": codes.get(str(proposal.target_id or proposal.applied_row_id or "")),
                "proposal_id": str(proposal.id),
            },
        )


def prune_expired(session: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    result = session.exec(
        delete(AssistantProposal).where(
            (
                (col(AssistantProposal.status) == "pending")
                & (col(AssistantProposal.created_at) < now - timedelta(days=PENDING_RETENTION_DAYS))
            )
            | (
                (col(AssistantProposal.status) != "pending")
                & (col(AssistantProposal.decided_at) < now - timedelta(days=DECIDED_RETENTION_DAYS))
            )
        )
    )
    session.commit()
    pruned = result.rowcount or 0
    if pruned:
        logger.info("AI assistant: %s proposals past their retention deleted.", pruned)
    return pruned
