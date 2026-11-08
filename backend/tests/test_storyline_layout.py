"""The PDF's storyline layout mirrors the app's (lib/storylineMap.ts)."""

import uuid
from types import SimpleNamespace

from app.models import InjectKind
from app.services.storyline_pdf import storyline_layout


def _inject(code: str, kind=InjectKind.MANDATORY, **extra):
    base = dict(
        id=uuid.uuid4(),
        code=code,
        title=code,
        kind=kind,
        phase_id=None,
        offset_minutes=None,
        fires_at_minute=None,
        branch_from_id=None,
        branch_action_id=None,
        rejoin_inject_id=None,
        expected_actions=[],
    )
    return SimpleNamespace(**{**base, **extra})


def _msel(phases, injects, duration=120):
    return SimpleNamespace(duration_minutes=duration, phases=phases, injects=injects)


def test_branches_sit_at_their_check_minute_else_their_trigger_window() -> None:
    phase = SimpleNamespace(id=uuid.uuid4(), start_offset=30, end_offset=60)
    action = SimpleNamespace(id=uuid.uuid4(), expected_within_minutes=15)
    m1 = _inject("INJ-01", offset_minutes=0, expected_actions=[action])
    m2 = _inject("INJ-02", offset_minutes=30, phase_id=phase.id)
    m3 = _inject("INJ-03", offset_minutes=90)
    by_window = _inject(
        "INJ-04", InjectKind.CONTINGENT, branch_from_id=m1.id, branch_action_id=action.id,
        rejoin_inject_id=m2.id,
    )  # fmt: skip
    by_check = _inject(
        "INJ-05", InjectKind.CONTINGENT, phase_id=phase.id, fires_at_minute=10,
        branch_from_id=m2.id, rejoin_inject_id=m3.id,
    )  # fmt: skip
    loose = _inject("INJ-06", InjectKind.CONTINGENT)

    layout = storyline_layout(_msel([phase], [m1, m2, m3, by_window, by_check, loose]))

    at = {b.inject.code: b for b in layout.branches}
    assert [s.inject.code for s in layout.stops] == ["INJ-01", "INJ-02", "INJ-03"]
    assert at["INJ-04"].time == 15  # its trigger action's window after T+0
    assert at["INJ-05"].time == 40  # minute 10 of a phase starting at T+30
    # The first branch is back at T+30, just as the second leaves: as in
    # the app, a lane is reused only once a branch is back *before* the fork.
    assert (at["INJ-04"].lane, at["INJ-05"].lane) == (1, 2)
    assert at["INJ-05"].rejoin.inject.code == "INJ-03"
    assert [i.code for i in layout.loose] == ["INJ-06"]


def test_a_lane_is_reused_once_its_branch_is_back() -> None:
    m1 = _inject("INJ-01", offset_minutes=0)
    m2 = _inject("INJ-02", offset_minutes=20)
    m3 = _inject("INJ-03", offset_minutes=60)
    m4 = _inject("INJ-04", offset_minutes=90)
    first = _inject("INJ-05", InjectKind.CONTINGENT, branch_from_id=m1.id, rejoin_inject_id=m2.id)
    second = _inject("INJ-06", InjectKind.CONTINGENT, branch_from_id=m3.id, rejoin_inject_id=m4.id)

    layout = storyline_layout(_msel([], [m1, m2, m3, m4, first, second]))

    assert [b.lane for b in layout.branches] == [1, 1]
    assert layout.lanes == 1
