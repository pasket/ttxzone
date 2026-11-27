"""GET /ttx/{ttx_id}/design-review: the exercise's design laid out as one
chain, with the links it lacks (`design_review_service`)."""

from typing import Literal

from pydantic import BaseModel

GapKind = Literal[
    "need_without_objective",
    "objective_without_phase",
    "objective_without_inject",
    "objective_without_expected_action",
    "objective_without_observation_point",
    "inject_without_objective",
    "inject_without_expected_action",
    "phase_without_inject",
]


class DesignGap(BaseModel):
    kind: GapKind
    # The row it's about, as the screens name it.
    code: str
    title: str = ""


class ObjectiveTrace(BaseModel):
    """One objective and what hangs from it, by code."""

    code: str
    title: str
    needs: list[str]
    phases: list[str]
    injects: list[str]
    expected_actions: int
    # None while the exercise has no session plan.
    observation_points: int | None = None


class PhasePace(BaseModel):
    code: str
    name: str
    minutes: int
    injects: int
    minutes_per_inject: float | None = None


class QuietStretch(BaseModel):
    """Session minutes with no timed inject; `after`/`before` are the injects
    around it (None: the session's start or end)."""

    from_minute: int
    to_minute: int
    after: str | None = None
    before: str | None = None


class PaceRead(BaseModel):
    duration_minutes: int | None
    injects: int
    timed_injects: int
    contingent_injects: int
    phases: list[PhasePace]
    quiet_stretches: list[QuietStretch]
    # What counts as quiet for this session's length.
    quiet_threshold_minutes: int | None


class RecipientLoad(BaseModel):
    name: str
    injects: int
    in_scope: bool


class ThreatCoverage(BaseModel):
    code: str
    name: str
    techniques: int
    used: int
    injects: int
    # Technique ids of the actor no inject attributed to it uses (the first ones).
    unused: list[str]


class DesignReviewRead(BaseModel):
    has_msel: bool
    has_session_plan: bool
    objectives: list[ObjectiveTrace]
    gaps: list[DesignGap]
    pace: PaceRead | None
    recipients: list[RecipientLoad]
    formats: dict[str, int]
    delivery_methods: dict[str, int]
    with_artifact: int
    threat_actors: list[ThreatCoverage]
