"""The notifications an exercise expects its team to recognise, derived
from the regulatory requirements its objectives cite: every cited
requirement listed in NOTIFICATION_MILESTONES, once, with the objectives
that cite it. Nothing is stored -- unticking the requirement in the
objective removes it.

In a tabletop the clock is simulated, so this is a reference for whoever
observes: whether the team identifies each regime, its deadline, when the
clock starts and who notifies -- not whether it meets the deadline."""

from collections.abc import Iterable
from dataclasses import dataclass

from app.data.regulatory_catalog import (
    FRAMEWORK_CATALOG,
    NOTIFICATION_MILESTONES,
    REGULATORY_CATALOG,
    NotificationMilestone,
    RegulatoryRequirement,
)

_REQUIREMENTS = {r.id: r for r in REGULATORY_CATALOG}
_FRAMEWORKS = {f.id: f for f in FRAMEWORK_CATALOG}


@dataclass(frozen=True)
class ExpectedNotification:
    requirement: RegulatoryRequirement
    milestones: tuple[NotificationMilestone, ...]
    # The codes of the objectives that cite it, in objective order.
    objective_codes: tuple[str, ...]

    def framework_label(self, spanish: bool) -> str:
        framework = _FRAMEWORKS.get(self.requirement.framework)
        if framework is None:
            return self.requirement.framework
        return framework.label_es if spanish else framework.label_en


def is_notification(requirement_id: str) -> bool:
    return requirement_id in NOTIFICATION_MILESTONES


def expected_notifications(
    objectives: Iterable[tuple[str, Iterable[str]]],
) -> list[ExpectedNotification]:
    """`objectives` as (code, cited requirement ids), in objective order.
    The result follows the catalog's order."""
    cited: dict[str, list[str]] = {}
    for code, requirement_ids in objectives:
        for requirement_id in requirement_ids:
            if is_notification(requirement_id):
                codes = cited.setdefault(requirement_id, [])
                if code not in codes:
                    codes.append(code)
    return [
        ExpectedNotification(
            requirement=requirement,
            milestones=NOTIFICATION_MILESTONES[requirement.id],
            objective_codes=tuple(cited[requirement.id]),
        )
        for requirement in REGULATORY_CATALOG
        if requirement.id in cited
    ]


def notification_point_text(requirement_id: str, spanish: bool) -> str:
    """The observation point an objective gets for a notification
    requirement it cites: recognising every report, its deadline and who
    sends it."""
    requirement = _REQUIREMENTS[requirement_id]
    framework = _FRAMEWORKS.get(requirement.framework)
    label = (
        (framework.label_es if spanish else framework.label_en)
        if framework
        else requirement.framework
    )
    reports = "; ".join(
        f"{m.stage_es} ({m.deadline_es})" if spanish else f"{m.stage_en} ({m.deadline_en})"
        for m in NOTIFICATION_MILESTONES[requirement_id]
    )
    if spanish:
        return (
            f"Identifica la notificación {label} {requirement.reference}: {reports}; "
            "desde cuándo cuenta el plazo y quién notifica, por rol."
        )
    return (
        f"Identifies the {label} {requirement.reference} notification: {reports}; "
        "when the clock starts and who notifies, by role."
    )
