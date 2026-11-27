"""A review of an exercise's design as a whole, computed from its saved
documents: the chain need -> objective -> phase -> inject -> expected action
-> observation point with the links it lacks, the pace of the session, who
the injects go to and which of the threat actors' techniques no inject
uses.

It judges nothing the documents' own validation doesn't: it lays the design
out so a Planner (Creator -> MSEL -> Review) or their AI client
(`get_design_review`) sees it in one read. Rows are named by their codes."""

from collections import Counter
from typing import Any

from sqlmodel import Session

from app.models import TTX
from app.models.inject import InjectFormat, InjectKind
from app.schemas.design_review import (
    DesignGap,
    DesignReviewRead,
    ObjectiveTrace,
    PaceRead,
    PhasePace,
    QuietStretch,
    RecipientLoad,
    ThreatCoverage,
)
from app.services.ttx_conduct_prep_service import find_prep, prep_read
from app.services.ttx_msel_service import find_msel, msel_read
from app.services.ttx_needs_form_service import form_read, get_form

# A stretch without a timed inject is quiet past this share of the session
# (and never under QUIET_FLOOR_MINUTES: a short session has short pauses).
QUIET_SHARE = 0.2
QUIET_FLOOR_MINUTES = 15
# Techniques listed per threat actor; the count says how many there are.
MAX_UNUSED_TECHNIQUES = 15


def design_review(session: Session, ttx: TTX) -> DesignReviewRead:
    form = form_read(session, ttx, get_form(session, ttx.id))
    msel_row = find_msel(session, ttx.id)
    msel = msel_read(session, ttx, msel_row) if msel_row is not None else None
    prep_row = find_prep(session, ttx.id)
    prep = prep_read(session, ttx, prep_row) if prep_row is not None else None

    need_codes = {n.id: n.code for n in form.needs}
    gaps: list[DesignGap] = []

    linked = {need_id for o in form.objectives for need_id in o.linked_need_ids}
    for need in form.needs:
        if need.id not in linked:
            gaps.append(DesignGap(kind="need_without_objective", code=need.code, title=need.title))

    phases = msel.phases if msel else []
    injects = msel.injects if msel else []
    evaluated = [i for i in injects if i.format == InjectFormat.INJECT]
    points = {o.objective_id: len(o.points) for o in prep.eeg if not o.orphaned} if prep else None

    objectives: list[ObjectiveTrace] = []
    for objective in form.objectives:
        its_injects = [i for i in evaluated if objective.id in i.objective_ids]
        actions = sum(
            1
            for i in its_injects
            for a in i.expected_actions
            # An action with no objectives of its own tests all of its inject's.
            if a.objective_ids is None or objective.id in a.objective_ids
        )
        trace = ObjectiveTrace(
            code=objective.code,
            title=objective.title or objective.statement,
            needs=[need_codes[n] for n in objective.linked_need_ids if n in need_codes],
            phases=[p.code for p in phases if objective.id in p.objective_ids],
            injects=[i.code for i in its_injects],
            expected_actions=actions,
            observation_points=points.get(objective.id, 0) if points is not None else None,
        )
        objectives.append(trace)
        if msel is None:
            continue
        missing = [
            ("objective_without_phase", not trace.phases),
            ("objective_without_inject", not trace.injects),
            ("objective_without_expected_action", bool(trace.injects) and actions == 0),
            ("objective_without_observation_point", trace.observation_points == 0),
        ]
        gaps += [
            DesignGap(kind=kind, code=objective.code, title=trace.title)
            for kind, lacking in missing
            if lacking
        ]

    for inject in evaluated:
        if not inject.objective_ids:
            gaps.append(
                DesignGap(kind="inject_without_objective", code=inject.code, title=inject.title)
            )
        if not inject.expected_actions:
            gaps.append(
                DesignGap(
                    kind="inject_without_expected_action", code=inject.code, title=inject.title
                )
            )
    for phase in phases:
        if not any(i.phase_id == phase.id for i in injects):
            gaps.append(DesignGap(kind="phase_without_inject", code=phase.code, title=phase.name))

    return DesignReviewRead(
        has_msel=msel is not None,
        has_session_plan=prep is not None,
        objectives=objectives,
        gaps=gaps,
        pace=_pace(msel) if msel else None,
        recipients=_recipients(form, injects),
        formats=dict(Counter(i.format.value for i in injects)),
        delivery_methods=dict(Counter(i.delivery_method.value for i in injects)),
        with_artifact=sum(1 for i in injects if i.artifact is not None),
        threat_actors=_threats(msel) if msel else [],
    )


def _pace(msel: Any) -> PaceRead:
    """The session's rhythm from its timed injects (a contingent one has no
    minute of its own: it fires on a condition)."""
    timed = sorted(
        (
            i
            for i in msel.injects
            if i.offset_minutes is not None and i.kind != InjectKind.CONTINGENT
        ),
        key=lambda i: i.offset_minutes,
    )
    last_phase_end = max((p.end_offset for p in msel.phases), default=0)
    duration = msel.duration_minutes or last_phase_end
    per_phase = []
    for phase in msel.phases:
        count = sum(1 for i in msel.injects if i.phase_id == phase.id)
        minutes = max(phase.end_offset - phase.start_offset, 0)
        per_phase.append(
            PhasePace(
                code=phase.code,
                name=phase.name,
                minutes=minutes,
                injects=count,
                minutes_per_inject=round(minutes / count, 1) if count and minutes else None,
            )
        )
    # Stretches between timed injects, the session's start and its end included.
    marks: list[tuple[int, str | None]] = [(0, None)]
    marks += [(i.offset_minutes, i.code) for i in timed]
    if duration:
        marks.append((duration, None))
    threshold = max(QUIET_FLOOR_MINUTES, round(duration * QUIET_SHARE)) if duration else None
    quiet = []
    for (start, after), (end, before) in zip(marks, marks[1:], strict=False):
        if threshold is not None and end - start >= threshold:
            quiet.append(QuietStretch(from_minute=start, to_minute=end, after=after, before=before))
    contingent = sum(1 for i in msel.injects if i.kind == InjectKind.CONTINGENT)
    return PaceRead(
        duration_minutes=duration or None,
        injects=len(msel.injects),
        timed_injects=len(timed),
        contingent_injects=contingent,
        phases=per_phase,
        quiet_stretches=quiet,
        quiet_threshold_minutes=threshold,
    )


def _recipients(form: Any, injects: list) -> list[RecipientLoad]:
    """How many injects each recipient gets, most first; the areas and third
    parties in scope no inject addresses, at the end with none."""
    counts = Counter(r for i in injects for r in i.recipients)
    scope = [*form.participating_areas, *form.third_parties]
    known = {name.casefold() for name in scope}
    rows = [
        RecipientLoad(name=name, injects=n, in_scope=name.casefold() in known)
        for name, n in counts.most_common()
    ]
    addressed = {name.casefold() for name in counts}
    rows += [
        RecipientLoad(name=name, injects=0, in_scope=True)
        for name in scope
        if name.casefold() not in addressed
    ]
    return rows


def _threats(msel: Any) -> list[ThreatCoverage]:
    out = []
    for actor in msel.threat_actors:
        used = {
            (t.domain, t.technique_id)
            for i in msel.injects
            if i.threat_actor_id == actor.id
            for t in i.attack_techniques
        }
        own = [(t.domain, t.technique_id) for t in actor.techniques]
        unused = [technique for _domain, technique in own if (_domain, technique) not in used]
        out.append(
            ThreatCoverage(
                code=actor.code,
                name=actor.name,
                techniques=len(own),
                used=sum(1 for t in own if t in used),
                injects=sum(1 for i in msel.injects if i.threat_actor_id == actor.id),
                unused=unused[:MAX_UNUSED_TECHNIQUES],
            )
        )
    return out
