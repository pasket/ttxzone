"""How each validation issue gets fixed, for the AI assistant: by a
proposal it can make (which tool, which field) or by the person (where in
TTX-Zone). Used by get_validation_report (a fix per issue, root causes),
plan_to_ready (ordered steps) and the validation-codes guide resource.

A code's own fix wins; otherwise the field says which proposal fixes it;
anything else is the person's, on the document's screen."""

from collections import Counter
from typing import Any, Literal

from app.services.ttx_msel_service import INJECTS, PHASES, SCENARIO, THREAT_ACTORS

Document = Literal["needs_analysis", "msel", "session_plan"]

SCREENS = {
    "needs_analysis": "Creator → Needs analysis",
    "msel": "Creator → MSEL",
    "session_plan": "Creator → Session plan",
}

# The order proposals build on each other: scope before needs, phases and
# actors before the injects in them, the MSEL before the EEG.
TOOL_ORDER = (
    "propose_scope",
    "propose_needs",
    "propose_objectives",
    "propose_msel_settings",
    "propose_phases",
    "propose_actors",
    "propose_threat_actors",
    "propose_injects",
    "propose_eeg_points",
)

_SCOPE_FIELDS = {
    "participating_areas",
    "third_parties",
    "perimeter",
    "out_of_scope",
    "regulatory_frameworks",
    "regulatory_framework_other",
    "max_duration_hours",
    "confidentiality_restrictions",
    "budget_and_external_support",
}
_NEED_FIELDS = {"needs", "source", "finding", "affected_capability", "priority"}
_OBJECTIVE_FIELDS = {
    "objectives",
    "statement",
    "success_criterion",
    "linked_need_keys",
    "capability",
    "evidence",
    "regulatory_requirement_ids",
    "achieve_at_least",
    "time_box_minutes",
}
_INJECT_FIELDS = {
    "injects",
    "title",
    "content",
    "offset_minutes",
    "recipients",
    "expected_actions",
    "objective_ids",
    "actor_key",
    "threat_actor_key",
    "branch_from_key",
    "rejoin_key",
    "fires_at_minute",
    "poll_question",
    "poll_options",
    "poll_outcomes",
}
_PHASE_FIELDS = {"phases", "name", "start_offset", "end_offset"}
_SETTINGS_FIELDS = {"duration_minutes", "summary", "meters", "time_compression"}


def _by(tool: str, field: str | None = None) -> dict[str, Any]:
    return {"by": "assistant", "tool": tool, **({"field": field} if field else {})}


def _you(where: str, what: str) -> dict[str, Any]:
    return {"by": "you", "where": where, "what": what}


# A code's own fix: what its name alone doesn't say.
_CODE_FIXES: dict[str, dict[str, Any]] = {
    # Needs analysis
    "APPROVALS_MISSING": _you(
        "Creator → Needs analysis → Approval", "the sponsor's and approvers' sign-off"
    ),
    "FINDINGS_COMMITMENT_REQUIRED": _you(
        "Creator → Needs analysis → Approval", "the commitment to act on the findings"
    ),
    "CAPABILITY_WITHOUT_OBJECTIVE": _by("propose_objectives", "capability"),
    "HIGH_NEED_WITHOUT_OBJECTIVE": _by("propose_objectives", "linked_needs"),
    "OBJECTIVE_WITHOUT_NEED": _by("propose_objectives", "linked_needs"),
    "OBJECTIVE_NOT_MEASURABLE": _by("propose_objectives", "success_criterion"),
    "VAGUE_SUCCESS_CRITERION": _by("propose_objectives", "success_criterion"),
    "CONDITION_IS_A_RATING_LEVEL": _by("propose_objectives", "success_criterion"),
    "OBJECTIVE_CAPABILITY_NOT_SELECTED": _by("propose_objectives", "capability"),
    "REGULATORY_OBJECTIVE_REQUIRED": _by("propose_objectives", "regulatory_requirement_ids"),
    "REGULATORY_OBJECTIVE_SUGGESTED": _by("propose_objectives", "regulatory_requirement_ids"),
    "OBJECTIVE_FRAMEWORK_NOT_NAMED": _by("propose_scope", "regulatory_frameworks"),
    "OUT_OF_SCOPE_REQUIRED": _by("propose_scope", "out_of_scope"),
    # MSEL
    "RECIPIENT_NOT_IN_SCOPE": _by("propose_scope", "participating_areas"),
    "RESPONSIBLE_NOT_IN_SCOPE": _by("propose_scope", "participating_areas"),
    "DURATION_EXCEEDS_LIMIT": _by("propose_msel_settings", "duration_minutes"),
    "OBJECTIVE_NOT_COVERED": _by("propose_injects", "objectives"),
    "OBJECTIVE_FEW_ACTIONS": _by("propose_injects", "expected_actions"),
    "PHASES_REQUIRED": _by("propose_phases"),
    "PHASE_WITHOUT_MANDATORY": _by("propose_injects", "phase"),
    "METER_UNUSED": _by("propose_injects", "poll_impacts"),
    "METER_INCOMPLETE": _by("propose_msel_settings", "meters"),
    "INJECT_NOT_VALIDATED": _you(
        "Creator → MSEL → Injects", "a Planner validates each inject (review status)"
    ),
    "NEEDS_VERSION_CHANGED": _you(
        "Creator → MSEL → Review", "bring the MSEL up to the approved needs analysis"
    ),
    "RECIPIENT_OVERLOAD": _by("propose_injects", "recipients"),
    "ROOMS_MISSING": _you("Creator → Exercise → Rooms", "the rooms the injects are played in"),
    "ROOM_WITHOUT_INJECTS": _by("propose_injects", "rooms"),
    # Session plan
    "EEG_POINTS_REQUIRED": _by("propose_eeg_points"),
    "EEG_POINT_INCOMPLETE": _by("propose_eeg_points", "text"),
    "EEG_POINT_VAGUE": _by("propose_eeg_points", "criteria_p"),
    "EEG_POINT_SOURCE_CHANGED": _you(
        "Creator → Session plan → Evaluation plan", "review the point against its new source"
    ),
    "EEG_OBJECTIVE_MISSING": _you(
        "Creator → Session plan", "update the EEG from the needs analysis and MSEL"
    ),
    "EEG_OBJECTIVE_ORPHANED": _you(
        "Creator → Session plan", "update the EEG from the needs analysis and MSEL"
    ),
    "EEG_SOURCE_CHANGED": _you(
        "Creator → Session plan", "update the EEG from the needs analysis and MSEL"
    ),
    "MSEL_NOT_READY": _you("Creator → MSEL → Review", "take the MSEL to READY"),
    "INJECTS_NOT_VALIDATED": _you(
        "Creator → MSEL → Injects", "a Planner validates each inject (review status)"
    ),
    "LEAD_EVALUATOR_MISSING": _you(
        "Creator → Exercise → Team", "name the exercise's Lead Evaluator"
    ),
    "OBJECTIVE_WITHOUT_EVALUATOR": _you(
        "Creator → Session plan → Evaluation plan", "assign an evaluator to each objective"
    ),
    "AREA_WITHOUT_EVALUATOR": _you(
        "Creator → Session plan → Evaluation plan", "assign an evaluator to each area"
    ),
}


def fix_for(
    document: str, code: str, field: str | None, section: int | None = None
) -> dict[str, Any]:
    if code in _CODE_FIXES:
        return _CODE_FIXES[code]
    if document == "msel" and section is not None:
        # What's missing is where it's missing: the scenario, a phase...
        if section == SCENARIO:
            return _by("propose_msel_settings", field)
        if section == THREAT_ACTORS:
            return _by("propose_threat_actors", "name" if field == "threat_actor_name" else field)
        if section == PHASES and field in _PHASE_FIELDS:
            return _by("propose_phases", field)
        if section == INJECTS and field in _INJECT_FIELDS:
            return _by("propose_injects", field)
    if document == "needs_analysis":
        if field in _SCOPE_FIELDS:
            return _by("propose_scope", field)
        if field in _NEED_FIELDS:
            return _by("propose_needs", field)
        if field in _OBJECTIVE_FIELDS:
            return _by("propose_objectives", field)
    if document == "msel":
        if field in _SETTINGS_FIELDS or field == "title" and code == "MSEL_INCOMPLETE":
            return _by("propose_msel_settings", field)
        if field == "threat_actor_name":
            return _by("propose_threat_actors", "name")
        if field in _PHASE_FIELDS:
            return _by("propose_phases", field)
        if field in _INJECT_FIELDS:
            return _by("propose_injects", field)
    if document == "session_plan" and field in {"text", "points"}:
        return _by("propose_eeg_points", field)
    return _you(SCREENS.get(document, "TTX-Zone"), "the person sets it on the screen")


def with_fixes(document: str, issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {**i, "fix": fix_for(document, i["code"], i["field"], i.get("section"))} for i in issues
    ]


def root_causes(document: str, issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Issues grouped by what they share (code and field), most first: one
    cause behind many warnings shows as one line."""
    counts = Counter((i["code"], i["field"], i.get("section")) for i in issues)
    return [
        {
            "code": code,
            "field": field,
            "count": n,
            "fix": fix_for(document, code, field, section),
        }
        for (code, field, section), n in counts.most_common()
    ]


def plan(document: str, blocking: list[dict[str, Any]], warnings: list[dict[str, Any]]):
    """Ordered steps to move the document on: proposals in the order they
    build on each other, then what only the person does."""
    causes = root_causes(document, blocking)
    by_tool: dict[str, list[dict[str, Any]]] = {}
    yours: list[dict[str, Any]] = []
    for cause in causes:
        if cause["fix"]["by"] == "assistant":
            by_tool.setdefault(cause["fix"]["tool"], []).append(cause)
        else:
            yours.append(cause)
    steps = []
    for tool in TOOL_ORDER:
        if tool in by_tool:
            group = by_tool[tool]
            steps.append(
                {
                    "by": "assistant",
                    "tool": tool,
                    "fixes": [
                        {"code": c["code"], "field": c["field"], "count": c["count"]} for c in group
                    ],
                    "count": sum(c["count"] for c in group),
                }
            )
    for cause in yours:
        steps.append(
            {
                "by": "you",
                "where": cause["fix"]["where"],
                "what": cause["fix"]["what"],
                "code": cause["code"],
                "count": cause["count"],
            }
        )
    for n, step in enumerate(steps, start=1):
        step["step"] = n
    return {
        "steps": steps,
        "then": _THEN[document],
        "warnings": root_causes(document, warnings),
    }


_THEN = {
    "needs_analysis": "Then the person sends it for approval and the approvers sign it "
    "(Creator → Needs analysis → Approval).",
    "msel": "Then the person moves it to review and READY (Creator → MSEL → Review).",
    "session_plan": "Then the person marks it READY (Creator → Session plan → Review).",
}


def glossary() -> dict[str, Any]:
    """Every fix the assistant knows by code, for the validation-codes guide."""
    return {
        "codes": _CODE_FIXES,
        "by_field": {
            "needs_analysis": {
                "scope fields": "propose_scope",
                "need fields": "propose_needs",
                "objective fields": "propose_objectives",
            },
            "msel": {
                "settings (title, summary, duration, meters)": "propose_msel_settings",
                "phase fields": "propose_phases",
                "threat actor name": "propose_threat_actors",
                "inject fields": "propose_injects",
            },
            "session_plan": {"observation points": "propose_eeg_points"},
        },
        "otherwise": "the person, on the document's screen",
    }
