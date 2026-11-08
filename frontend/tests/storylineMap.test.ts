import { describe, expect, it } from 'vitest'

import { CODE_PATTERN, codeRefText } from '../src/lib/codeRef'
import type { ActionDraft, InjectDraft, MselDraft } from '../src/lib/msel'
import {
  movePhaseBox,
  resizePhase,
  applyPhaseEdit,
  evenBands,
  objectivePhaseGroups,
  branchesFrom,
  branchForkTime,
  injectSectionIssues,
  validRejoin,
  closeSessionGaps,
  incidentMinutesAt,
  injectSectionStatus,
  deliveredAt,
  draftFromMsel,
  payloadFromDraft,
  vagueActionWords,
  issueFixes,
  issueInjectFilter,
  nextOffsetIn,
  relocateIssues,
  sessionGaps,
  phaseSnapshot,
  restoreSnapshot,
} from '../src/lib/msel'
import {
  axisTicks,
  moveBranch,
  moveStop,
  newBranchFrom,
  newStopAt,
  storylineMap,
  storylineRuns,
  uncoveredSpans,
} from '../src/lib/storylineMap'

function action(key: string, within: number | null = null): ActionDraft {
  return {
    id: null,
    key,
    code: '',
    description: `Action ${key}`,
    responsible_role: '',
    expected_within_minutes: within,
    objective_ids: [],
  }
}

function inject(key: string, patch: Partial<InjectDraft> = {}): InjectDraft {
  return {
    id: null,
    key,
    code: key.toUpperCase(),
    phase_key: 'p1',
    kind: 'mandatory',
    title: key,
    content: '',
    offset_minutes: null,
    trigger_condition: '',
    contingent_purpose: '',
    fires_at_minute: null,
    format: 'inject',
    poll_question: '',
    poll_options: [],
    branch_from_key: null,
    branch_action_key: null,
    rejoin_key: null,
    actor_key: null,
    recipients: [],
    delivery_method: 'email',
    attachment_notes: [],
    attack_techniques: [],
    facilitator_notes: '',
    review_status: 'draft',
    validated_by: '',
    validated_by_id: null,
    objective_ids: [],
    expected_actions: [],
    images: [],
    ...patch,
  }
}

const branch = (key: string, from: string | null, rejoin: string | null, extra = {}) =>
  inject(key, { kind: 'contingent', branch_from_key: from, rejoin_key: rejoin, ...extra })

function phase(key: string) {
  return {
    id: null,
    key,
    code: '',
    name: key,
    start_offset: 0,
    end_offset: 0,
    incident_jump_minutes: 0,
    situation_update: '',
    key_questions: [],
    objective_ids: [],
    due_objective_ids: [],
  }
}

function draft(injects: InjectDraft[], duration = 120): MselDraft {
  return {
    title: '',
    summary: '',
    threat_actor_profile: '',
    attack_techniques: [],
    exercise_start: '',
    duration_minutes: duration,
    time_compression: 60,
    actors: [],
    phases: [],
    injects,
  }
}

const storyline = [
  inject('m2', { offset_minutes: 60 }),
  inject('m1', { offset_minutes: 0, expected_actions: [action('a1', 15)] }),
  inject('m3', { offset_minutes: 100 }),
]

describe('storylineMap', () => {
  it('lays mandatory injects along the storyline in time order', () => {
    const map = storylineMap(draft(storyline))
    expect(map.stops.map((s) => [s.inject.key, s.time])).toEqual([
      ['m1', 0],
      ['m2', 60],
      ['m3', 100],
    ])
    expect(map.branches).toEqual([])
  })

  it("places a branch at its trigger action's deadline, else halfway back, else a bit after", () => {
    const map = storylineMap(
      draft([
        ...storyline,
        branch('c1', 'm1', 'm2', { branch_action_key: 'a1' }),
        branch('c2', 'm2', 'm3'),
        branch('c3', 'm3', null),
      ]),
    )
    const at = Object.fromEntries(map.branches.map((b) => [b.inject.key, b]))
    expect(at.c1.time).toBe(15)
    expect(at.c1.action?.key).toBe('a1')
    expect(at.c1.rejoin?.inject.key).toBe('m2')
    expect(at.c2.time).toBe(80)
    expect(at.c3.time).toBe(110)
    expect(at.c3.rejoin).toBeNull()
  })

  it('reuses a lane once its branch has come back', () => {
    const map = storylineMap(
      draft([
        ...storyline,
        branch('c1', 'm1', 'm2'),
        branch('c2', 'm1', 'm3'),
        branch('c3', 'm3', null),
      ]),
    )
    const lane = Object.fromEntries(map.branches.map((b) => [b.inject.key, b.lane]))
    // c1 and c2 overlap; c3 leaves after c1 is back.
    expect(lane.c1).not.toBe(lane.c2)
    expect(lane.c3).toBe(lane.c1)
    expect(map.lanes).toBe(2)
  })

  it('hangs a branch from another branch', () => {
    const map = storylineMap(
      draft([...storyline, branch('c1', 'm1', 'm2'), branch('c2', 'c1', 'm3')]),
    )
    const child = map.branches.find((b) => b.inject.key === 'c2')
    expect(child?.fromLane).toBe(map.branches.find((b) => b.inject.key === 'c1')?.lane)
    expect(child?.fromTime).toBe(30)
  })

  it('keeps off the map what hangs from nothing it can reach', () => {
    const map = storylineMap(
      draft([
        ...storyline,
        branch('loose', null, null),
        branch('gone', 'deleted', null),
        branch('x', 'y', null),
        branch('y', 'x', null),
      ]),
    )
    expect(map.loose.map((i) => i.key).sort()).toEqual(['gone', 'loose', 'x', 'y'])
    expect(map.branches).toEqual([])
  })

  it('draws a way back to an earlier inject as no way back', () => {
    const map = storylineMap(draft([...storyline, branch('c1', 'm2', 'm1')]))
    expect(map.branches[0].rejoin).toBeNull()
  })

  it('adds a stop at the clicked time, snapped, in the phase that holds it', () => {
    const withPhases = {
      ...draft(storyline),
      phases: [
        { ...phase('p1'), start_offset: 0, end_offset: 45 },
        { ...phase('p2'), start_offset: 45, end_offset: 120 },
      ],
    }
    const stop = newStopAt(withPhases, 47.4)
    expect(stop).toMatchObject({ kind: 'mandatory', offset_minutes: 45, phase_key: 'p2' })
    expect(newStopAt(withPhases, 500).offset_minutes).toBe(120)
  })

  it('branches off an inject, coming back at the next stop after it', () => {
    const parent = storyline[1] // m1, T+0
    const branchDraft = newBranchFrom(draft(storyline), parent)
    expect(branchDraft).toMatchObject({
      kind: 'contingent',
      branch_from_key: 'm1',
      rejoin_key: 'm2',
      phase_key: parent.phase_key,
    })
    // From the last stop there's nowhere later to come back to.
    expect(newBranchFrom(draft(storyline), storyline[2]).rejoin_key).toBeNull()
  })
})

describe('uncoveredSpans', () => {
  it('lists the session time no phase holds', () => {
    const phases = [
      { start_offset: 10, end_offset: 45 },
      { start_offset: 60, end_offset: 135 },
    ]
    expect(uncoveredSpans(phases, 180)).toEqual([
      { start: 0, end: 10 },
      { start: 45, end: 60 },
      { start: 135, end: 180 },
    ])
    expect(uncoveredSpans([{ start_offset: 0, end_offset: 200 }], 180)).toEqual([])
    expect(uncoveredSpans([], 60)).toEqual([{ start: 0, end: 60 }])
  })
})

describe('axisTicks', () => {
  it('times the edges and each inject, filling long stretches without crowding', () => {
    const ticks = axisTicks(180, [20, 25, 90], { minGap: 0.09, fillGap: 0.3 })
    expect(ticks).toEqual([
      { minutes: 0, kind: 'edge' },
      { minutes: 20, kind: 'stop' },
      // 25 is too close to 20 to label.
      { minutes: 55, kind: 'fill' },
      { minutes: 90, kind: 'stop' },
      { minutes: 135, kind: 'fill' },
      { minutes: 180, kind: 'edge' },
    ])
  })

  it('times contingent injects, then phase starts, where there is room', () => {
    const ticks = axisTicks(180, [90], {
      minGap: 0.09,
      fillGap: 1,
      branches: [100, 130.4],
      phases: [45, 135, 170],
    })
    expect(ticks).toEqual([
      { minutes: 0, kind: 'edge' },
      { minutes: 45, kind: 'phase' },
      { minutes: 90, kind: 'stop' },
      // 100 is too close to the mandatory inject at 90; 135 to the
      // contingent one at 130; 170 to the end.
      { minutes: 130, kind: 'branch' },
      { minutes: 180, kind: 'edge' },
    ])
  })

  it('keeps the start and the end even when an inject sits on them', () => {
    expect(axisTicks(60, [0, 58], { minGap: 0.1, fillGap: 1 })).toEqual([
      { minutes: 0, kind: 'edge' },
      { minutes: 60, kind: 'edge' },
    ])
  })
})

describe('closeSessionGaps', () => {
  const band = (key: string, start: number, end: number, jump = 0) => ({
    ...phase(key),
    start_offset: start,
    end_offset: end,
    incident_jump_minutes: jump,
  })

  it('turns session between phases into scenario time and keeps scenario time where it was', () => {
    const before: MselDraft = {
      ...draft(
        [
          inject('a', { phase_key: 'p1', offset_minutes: 30 }),
          inject('b', { phase_key: 'p2', offset_minutes: 95 }),
          inject('c', { phase_key: 'p3', offset_minutes: 150 }),
        ],
        180,
      ),
      phases: [band('p1', 0, 45), band('p2', 90, 120, 60), band('p3', 130, 180)],
    }
    expect(sessionGaps(before.phases)).toEqual([
      { phaseKey: 'p2', minutes: 45 },
      { phaseKey: 'p3', minutes: 10 },
    ])
    const { draft: after, closed } = closeSessionGaps(before)
    expect(closed).toHaveLength(2)
    // Consecutive in session time: no gap left, each phase as long as before.
    expect(after.phases.map((p) => [p.start_offset, p.end_offset])).toEqual([
      [0, 45],
      [45, 75],
      [75, 125],
    ])
    // The gap became a time jump (45 min × 60 = 45 h, on top of p2's own).
    expect(after.phases.map((p) => p.incident_jump_minutes)).toEqual([0, 45 * 60 + 60, 600])
    // Injects move with their phase.
    expect(after.injects.map((i) => i.offset_minutes)).toEqual([30, 50, 95])
    // The scenario doesn't move: each inject is at the same scenario time.
    for (const [index, item] of before.injects.entries()) {
      expect(incidentMinutesAt(after, after.injects[index].offset_minutes ?? 0)).toBe(
        incidentMinutesAt(before, item.offset_minutes ?? 0),
      )
    }
  })

  it('leaves contiguous or overlapping phases alone', () => {
    const contiguous: MselDraft = {
      ...draft([]),
      phases: [band('p1', 0, 45), band('p2', 40, 90)],
    }
    expect(closeSessionGaps(contiguous)).toEqual({ draft: contiguous, closed: [] })
  })
})

describe('relocateIssues', () => {
  const issue = (code: string, section: number) => ({
    code,
    section,
    field: null,
    item_id: 'x',
  })

  it('moves the warnings fixed by writing injects to Injects, with their filter', () => {
    const report = relocateIssues({
      ready: [],
      approved: [],
      warnings: [
        issue('THREAT_ACTOR_WITHOUT_INJECTS', 1),
        issue('PHASE_WITHOUT_MANDATORY', 2),
        issue('PHASE_GAP', 2),
      ],
    })
    expect(report.warnings.map((w) => w.section)).toEqual([3, 3, 2])
    expect(issueInjectFilter({ code: 'PHASE_WITHOUT_MANDATORY' })).toBe('phase')
    expect(issueInjectFilter({ code: 'THREAT_ACTOR_WITHOUT_INJECTS' })).toBe('attack')
    expect(issueInjectFilter({ code: 'PHASE_GAP' })).toBeNull()
  })
})

describe('phase timing adjustments', () => {
  const band = (key: string, start: number, end: number) => ({
    ...phase(key),
    code: key.toUpperCase(),
    start_offset: start,
    end_offset: end,
  })
  const sample = (): MselDraft => ({
    ...draft(
      [
        inject('a', { phase_key: 'p1', offset_minutes: 30 }),
        inject('b', { phase_key: 'p2', offset_minutes: 90 }),
        inject('c', { phase_key: 'p3', offset_minutes: 120 }),
      ],
      180,
    ),
    phases: [band('p1', 0, 60), band('p2', 60, 105), band('p3', 105, 160)],
  })

  it('pushes the later phases and their injects when a phase grows, or leaves them', () => {
    const grown = { ...sample().phases[0], end_offset: 80 }
    const pushed = applyPhaseEdit(sample(), grown, true)
    expect(pushed.phases.map((p) => [p.start_offset, p.end_offset])).toEqual([
      [0, 80],
      [80, 125],
      [125, 180],
    ])
    expect(pushed.injects.map((i) => i.offset_minutes)).toEqual([30, 110, 140])
    const kept = applyPhaseEdit(sample(), grown, false)
    expect(kept.phases[1].start_offset).toBe(60)
    expect(kept.injects.map((i) => i.offset_minutes)).toEqual([30, 90, 120])
  })

  it('moves a phase’s own injects when its start moves', () => {
    const moved = applyPhaseEdit(
      sample(),
      { ...sample().phases[1], start_offset: 70, end_offset: 115 },
      true,
    )
    expect(moved.injects.find((i) => i.key === 'b')?.offset_minutes).toBe(100)
    expect(moved.phases[2].start_offset).toBe(115)
  })

  it('offers fixes for an overlap and an uncovered end', () => {
    const overlapping: MselDraft = {
      ...sample(),
      phases: [band('p1', 0, 60), band('p2', 60, 105), band('p3', 85, 160)],
    }
    const issue = (code: string, item_id: string) => ({ code, section: 2, field: null, item_id })
    const [startAfter, endBefore] = issueFixes(overlapping, issue('PHASES_OVERLAP', 'p3'))
    expect(startAfter.id).toBe('startAfter')
    expect(startAfter.values).toEqual({ item: 'P3 | p3', previous: 'P2 | p2', time: 'T+01:45' })
    const after = startAfter.apply(overlapping)
    expect(after.phases[2]).toMatchObject({ start_offset: 105, end_offset: 180 })
    expect(after.injects.find((i) => i.key === 'c')?.offset_minutes).toBe(140)
    expect(endBefore.apply(overlapping).phases[1].end_offset).toBe(85)

    const fixes = issueFixes(sample(), issue('SESSION_END_UNCOVERED', 'p3'))
    expect(fixes.map((f) => f.id)).toEqual(['extendToEnd', 'shortenSession'])
    expect(fixes[0].apply(sample()).phases[2].end_offset).toBe(180)
    expect(fixes[1].apply(sample()).duration_minutes).toBe(160)
  })

  it('puts an inject back inside its phase, or in the phase that holds its time', () => {
    const outside: MselDraft = {
      ...sample(),
      injects: [inject('a', { phase_key: 'p1', offset_minutes: 70 })],
    }
    const fixes = issueFixes(outside, {
      code: 'INJECT_OUTSIDE_PHASE',
      section: 3,
      field: 'offset_minutes',
      item_id: 'a',
    })
    expect(fixes.map((f) => f.id)).toEqual(['intoPhase', 'toHoldingPhase'])
    expect(fixes[0].apply(outside).injects[0].offset_minutes).toBe(60)
    expect(fixes[1].apply(outside).injects[0].phase_key).toBe('p2')
  })
})

describe('codeRefText', () => {
  it('names a row by its code first, its title after a bar', () => {
    expect(codeRefText('PH-18', 'Recovery')).toBe('PH-18 | Recovery')
    expect(codeRefText('PH-18', '')).toBe('PH-18')
    expect(codeRefText('', 'Recovery', 'new')).toBe('new | Recovery')
    expect(
      codeRefText('OBJ-01', 'Contain the ransomware outbreak within four hours of detection'),
    ).toBe('OBJ-01 | Contain the ransomware outbreak within f…')
  })

  it('finds the codes inside a sentence', () => {
    const text =
      'OBJ-01 | Contain…, INJ-C02, INJ-03-A1, DSC-05, DSC-05-A2, PH-04, T1566.001 and TTX-2026-01; not OBJ1'
    expect(text.match(CODE_PATTERN)).toEqual([
      'OBJ-01',
      'INJ-C02',
      'INJ-03-A1',
      'DSC-05',
      'DSC-05-A2',
      'PH-04',
      'T1566.001',
      'TTX-2026-01',
    ])
  })
})

describe('injectSectionStatus', () => {
  const phases = [{ ...phase('p1'), start_offset: 0, end_offset: 60 }]
  const complete = inject('a', {
    title: 'Ransom note',
    content: 'Pay or else.',
    offset_minutes: 10,
    actor_key: 'act-1',
    recipients: ['IT'],
    objective_ids: ['obj-1'],
    expected_actions: [action('x1')],
    review_status: 'validated',
  })
  const status = (
    patch: Partial<InjectDraft>,
    section: Parameters<typeof injectSectionStatus>[2],
  ) => injectSectionStatus({ ...complete, ...patch }, { phases, injects: [] }, section)

  it('says which blocks of an inject are done, to complete or worth a look', () => {
    expect(status({}, 'what')).toBe('done')
    expect(status({ offset_minutes: 90 }, 'what')).toBe('todo')
    expect(status({ kind: 'contingent' }, 'what')).toBe('todo')
    expect(status({ recipients: [] }, 'who')).toBe('todo')
    expect(status({ expected_actions: [] }, 'evaluates')).toBe('todo')
    expect(status({}, 'attack')).toBe('optional')
    // Noise may name no technique; a threat actor's activity should.
    expect(status({ attack_attribution: 'noise' }, 'attack')).toBe('done')
    expect(
      status({ attack_attribution: 'threat_actor', threat_actor_key: 'thr-1' }, 'attack'),
    ).toBe('warn')
    expect(status({ review_status: 'draft' }, 'review')).toBe('warn')
    expect(status({}, 'review')).toBe('done')
  })
})

describe('nextOffsetIn', () => {
  const phases = [{ ...phase('p1'), start_offset: 30, end_offset: 60 }]
  const at = (minutes: number, key: string) =>
    inject(key, { phase_key: 'p1', offset_minutes: minutes })

  it('proposes a new inject’s time: as the phase opens, a little after the last, then its end', () => {
    expect(nextOffsetIn({ phases, injects: [] }, 'p1')).toBe(30)
    expect(nextOffsetIn({ phases, injects: [at(30, 'a'), at(40, 'b')] }, 'p1')).toBe(45)
    expect(nextOffsetIn({ phases, injects: [at(58, 'a')] }, 'p1')).toBe(60)
    // The inject itself doesn't count.
    expect(nextOffsetIn({ phases, injects: [at(40, 'a')] }, 'p1', 'a')).toBe(30)
  })
})

describe('branch rules', () => {
  const phases = [
    { ...phase('p1'), code: 'PH-01', name: 'p1', start_offset: 0, end_offset: 60 },
    { ...phase('p2'), code: 'PH-02', name: 'p2', start_offset: 60, end_offset: 120 },
  ]
  const m1 = inject('m1', { phase_key: 'p1', offset_minutes: 20 })
  const m2 = inject('m2', { phase_key: 'p2', offset_minutes: 90 })
  const c1 = branch('c1', 'm1', null, { phase_key: 'p1' })
  const c2 = branch('c2', 'c1', null, { phase_key: 'p1' })
  const d: MselDraft = { ...draft([m1, m2, c1, c2]), phases }

  it('times a branch from its mandatory ancestor and only lets it come back later', () => {
    expect(branchForkTime(d, c2)).toBe(20)
    expect(validRejoin(d, c1, m2)).toBe(true)
    expect(validRejoin(d, c1, m1)).toBe(false)
    expect(validRejoin(d, c1, c2)).toBe(false)
    // c2 hangs from c1: c1 can't branch off it.
    expect(branchesFrom(d, c2, c1)).toBe(true)
  })

  it('says a branch needs a point of its own phase, and moves it there in one click', () => {
    const stray = branch('c3', 'm1', null, { phase_key: 'p2' })
    const withStray = { ...d, injects: [...d.injects, stray] }
    expect(injectSectionIssues(stray, withStray, 'what').map((i) => i.key)).toContain(
      'branchOtherPhase',
    )
    const [fix] = issueFixes(withStray, {
      code: 'BRANCH_FROM_OTHER_PHASE',
      section: 3,
      field: 'branch_from_key',
      item_id: 'c3',
    })
    expect(fix.id).toBe('toParentPhase')
    expect(fix.apply(withStray).injects.find((i) => i.key === 'c3')?.phase_key).toBe('p1')
    const orphan = branch('c4', null, null, { phase_key: 'p1' })
    expect(injectSectionIssues(orphan, d, 'what').map((i) => i.key)).toContain('branchFrom')
  })
})

describe('phases suggested from the objectives', () => {
  it('groups the objectives by capability, in the order a crisis goes through', () => {
    const groups = objectivePhaseGroups([
      { id: 'o1', capability: 'regulatory_notification' },
      { id: 'o2', capability: 'detection_triage_escalation' },
      { id: 'o3', capability: 'regulatory_notification' },
      { id: 'o4', capability: 'crisis_decision_making' },
    ])
    expect(groups).toEqual([
      { capability: 'detection_triage_escalation', objective_ids: ['o2'] },
      { capability: 'crisis_decision_making', objective_ids: ['o4'] },
      { capability: 'regulatory_notification', objective_ids: ['o1', 'o3'] },
    ])
    expect(objectivePhaseGroups([])).toEqual([])
  })

  it('shares the session evenly, one band after another', () => {
    expect(evenBands(0, 180, 4)).toEqual([
      { start_offset: 0, end_offset: 45 },
      { start_offset: 45, end_offset: 90 },
      { start_offset: 90, end_offset: 135 },
      { start_offset: 135, end_offset: 180 },
    ])
    // The last takes the remainder.
    expect(evenBands(60, 100, 3).at(-1)).toEqual({ start_offset: 126, end_offset: 160 })
  })
})

describe('dragging on the storyline', () => {
  const phases = [
    { ...phase('p1'), start_offset: 0, end_offset: 60 },
    { ...phase('p2'), start_offset: 60, end_offset: 120 },
  ]
  const m1 = inject('m1', {
    phase_key: 'p1',
    offset_minutes: 10,
    expected_actions: [action('a1', 15)],
  })
  const m2 = inject('m2', { phase_key: 'p1', offset_minutes: 40 })
  const m3 = inject('m3', { phase_key: 'p2', offset_minutes: 90 })
  const c1 = branch('c1', 'm1', 'm3', { phase_key: 'p1', branch_action_key: 'a1' })
  const d: MselDraft = { ...draft([m1, m2, m3, c1], 120), phases }

  it('moves a mandatory inject in time, snapped, into the phase that holds it', () => {
    const moved = moveStop(d, 'm2', 73)
    expect(moved.injects.find((i) => i.key === 'm2')).toMatchObject({
      offset_minutes: 75,
      phase_key: 'p2',
    })
    expect(moveStop(d, 'm2', 500).injects.find((i) => i.key === 'm2')?.offset_minutes).toBe(120)
  })

  it('times a contingent inject by its trigger action, and re-parents it on its phase', () => {
    // At T+35: 25 minutes after its fork (m1 at T+10).
    const timed = moveBranch(d, 'c1', 35, 1)
    expect(timed.refused).toBeNull()
    const parent = timed.draft!.injects.find((i) => i.key === 'm1')!
    expect(parent.expected_actions[0].expected_within_minutes).toBe(25)
    // Dropped on the storyline after m2: it now branches off m2, losing m1's action.
    const moved = moveBranch(d, 'c1', 45, 0)
    expect(moved.draft!.injects.find((i) => i.key === 'c1')).toMatchObject({
      branch_from_key: 'm2',
      branch_action_key: null,
    })
    // After m3 (another phase): refused.
    expect(moveBranch(d, 'c1', 95, 0).refused).toBe('otherPhase')
  })

  it('can’t time a contingent inject with no trigger action on its own line', () => {
    const untimed = {
      ...d,
      injects: d.injects.map((i) => (i.key === 'c1' ? { ...i, branch_action_key: null } : i)),
    }
    expect(moveBranch(untimed, 'c1', 30, 1).refused).toBe('noTriggerAction')
  })
})

describe('editing phases on the map', () => {
  const phases = [
    { ...phase('p1'), start_offset: 0, end_offset: 60 },
    { ...phase('p2'), start_offset: 60, end_offset: 120 },
  ]
  const d: MselDraft = {
    ...draft([inject('a', { phase_key: 'p2', offset_minutes: 70 })], 150),
    phases,
  }

  it('stretches one edge of one phase, snapped, inside the session, at least 5 min', () => {
    const wider = resizePhase(d, 'p2', 'end', 143)
    expect(wider.phases.map((p) => [p.start_offset, p.end_offset])).toEqual([
      [0, 60],
      [60, 145],
    ])
    expect(resizePhase(d, 'p2', 'start', 200).phases[1].start_offset).toBe(115)
    expect(resizePhase(d, 'p2', 'end', 999).phases[1].end_offset).toBe(150)
  })

  it('moves a phase whole with its injects, kept inside the session', () => {
    const moved = movePhaseBox(d, 'p2', 90)
    expect(moved.phases[1]).toMatchObject({ start_offset: 90, end_offset: 150 })
    expect(moved.injects[0].offset_minutes).toBe(100)
    expect(movePhaseBox(d, 'p2', 140).phases[1].start_offset).toBe(90)
  })
})

describe('restoreSnapshot', () => {
  it('puts the phases back with the ids rows have now, new rows for ones gone', () => {
    const before = {
      ...draft([inject('i1', { expected_actions: [action('a1'), action('a2')] }), inject('i2')]),
      phases: [{ ...phase('p1'), end_offset: 60 }, phase('p2')],
    }
    const snapshot = phaseSnapshot(before)
    // Since: p1 and i1 saved (ids), p2 and i2 deleted by a save, a1 saved,
    // a2 removed, p1 resized.
    const current = {
      ...before,
      duration_minutes: 180,
      phases: [{ ...phase('p1'), id: 'ph-1', code: 'PH-01', end_offset: 90 }],
      injects: [
        inject('i1', {
          id: 'inj-1',
          code: 'INJ-01',
          expected_actions: [{ ...action('a1'), id: 'act-1', code: 'INJ-01-A1' }],
        }),
      ],
    }
    const restored = restoreSnapshot(current, snapshot)
    expect(restored.duration_minutes).toBe(120)
    expect(restored.phases.map((p) => [p.key, p.id, p.code, p.end_offset])).toEqual([
      ['p1', 'ph-1', 'PH-01', 60],
      ['p2', null, '', 0],
    ])
    expect(restored.injects.map((i) => [i.key, i.id, i.code])).toEqual([
      ['i1', 'inj-1', 'INJ-01'],
      ['i2', null, ''],
    ])
    expect(restored.injects[0].expected_actions.map((a) => [a.key, a.id])).toEqual([
      ['a1', 'act-1'],
      ['a2', null],
    ])
  })
})

describe('check minutes, phase ends and unscored injects', () => {
  const p1 = { ...phase('p1'), start_offset: 0, end_offset: 30 }
  const timed = (injects: InjectDraft[]) => ({ ...draft(injects), phases: [p1] })

  it('places a contingent inject at its check minute and drags that minute', () => {
    const d = timed([
      ...storyline,
      branch('c1', 'm1', 'm2', { branch_action_key: 'a1', fires_at_minute: 10 }),
    ])
    expect(storylineMap(d).branches[0].time).toBe(10)
    expect(deliveredAt(d.injects[3], d.phases)).toBe(10)
    // Dropped past its phase's end, it stays inside the phase.
    const moved = moveBranch(d, 'c1', 50, 1).draft!
    expect(moved.injects.find((i) => i.key === 'c1')?.fires_at_minute).toBe(30)
    // The trigger action's window is left alone.
    expect(
      moved.injects.find((i) => i.key === 'm1')?.expected_actions[0].expected_within_minutes,
    ).toBe(15)
  })

  it('shortens expected actions that run past the phase end', () => {
    const d = timed([
      inject('m1', { offset_minutes: 20, expected_actions: [action('a1', 15), action('a2', 5)] }),
    ])
    const [fix] = issueFixes(d, {
      code: 'ACTION_PAST_PHASE_END',
      section: 3,
      field: 'expected_actions',
      item_id: 'm1',
    })
    expect(fix.id).toBe('actionsToPhaseEnd')
    const windows = fix.apply(d).injects[0].expected_actions.map((a) => a.expected_within_minutes)
    expect(windows).toEqual([10, 5])
  })

  it('asks an unscored inject for no objective nor expected action', () => {
    const d = timed([inject('m1', { offset_minutes: 0, phase_key: 'p1', format: 'discussion' })])
    expect(injectSectionIssues(d.injects[0], d, 'evaluates')).toEqual([])
    const scored = { ...d.injects[0], format: 'inject' as const }
    expect(injectSectionIssues(scored, d, 'evaluates').map((i) => i.key)).toEqual([
      'objectives',
      'actions',
    ])
  })

  it('flags a contingent inject checked after its phase ends', () => {
    const c = branch('c1', 'm1', null, { phase_key: 'p1', fires_at_minute: 40 })
    const d = timed([inject('m1', { offset_minutes: 0, phase_key: 'p1' }), c])
    expect(injectSectionIssues(c, d, 'what').map((i) => i.key)).toContain('checkAfterEnd')
  })
})

describe('vague expected actions and inject images', () => {
  it('names the vague verbs an inject uses, each once', () => {
    const i = inject('m1', {
      expected_actions: [
        action('a1'),
        { ...action('a2'), description: 'Assess the impact and check insurance' },
        { ...action('a3'), description: 'Assess sanctions; reassess later' },
      ],
    })
    expect(vagueActionWords(i)).toEqual(['assess', 'check'])
  })

  it('keeps the images in order through the draft and sends only id and caption', () => {
    const msel = {
      title: '',
      summary: '',
      exercise_start: null,
      incident_start: null,
      duration_minutes: 60,
      time_compression: 1,
      threat_actors: [],
      actors: [],
      phases: [],
      injects: [
        {
          ...inject('m1'),
          id: 'i1',
          phase_id: null,
          simulated_actor_id: null,
          branch_from_id: null,
          branch_action_id: null,
          rejoin_inject_id: null,
          images: [
            { id: 'img2', caption: 'Telegram', width: 10, height: 5 },
            { id: 'img1', caption: '', width: 4, height: 4 },
          ],
        },
      ],
    } as unknown as Parameters<typeof draftFromMsel>[0]
    const d = draftFromMsel(msel)
    expect(d.injects[0].images.map((image) => image.image_id)).toEqual(['img2', 'img1'])
    expect(payloadFromDraft(d, 0).injects[0].images).toEqual([
      { image_id: 'img2', caption: 'Telegram' },
      { image_id: 'img1', caption: '' },
    ])
  })
})

describe('storylineRuns', () => {
  // INJ-03 at 30, INJ-04 at 50, INJ-05 at 70; INJ-13 branches off INJ-03
  // and rejoins at INJ-04.
  const inj = (key: string) => ({ key }) as InjectDraft
  const stops = [
    { inject: inj('i3'), time: 30 },
    { inject: inj('i4'), time: 50 },
    { inject: inj('i5'), time: 70 },
  ]
  const branch = {
    inject: inj('i13'),
    from: inj('i3'),
    action: null,
    fromTime: 30,
    fromLane: 0,
    time: 40,
    lane: 1,
    rejoin: stops[1],
  }
  const map = { duration: 120, stops, branches: [branch] }
  const only = (keys: string[]) => (inject: InjectDraft) => keys.includes(inject.key)

  it('fades the storyline past where the exercise stands', () => {
    expect(storylineRuns({ ...map, branches: [] }, only(['i3', 'i4']), 50)).toEqual([
      { start: 0, end: 50, run: true },
      { start: 50, end: 120, run: false },
    ])
  })

  it('fades what a delivered branch took the play off', () => {
    expect(storylineRuns(map, only(['i3', 'i13', 'i4']), 50)).toEqual([
      { start: 0, end: 30, run: true },
      { start: 30, end: 120, run: false },
    ])
    expect(storylineRuns(map, only(['i3', 'i13', 'i4', 'i5']), 70)).toEqual([
      { start: 0, end: 30, run: true },
      { start: 30, end: 50, run: false },
      { start: 50, end: 70, run: true },
      { start: 70, end: 120, run: false },
    ])
  })

  it('keeps the storyline when the branch did not go out, or ran alongside it', () => {
    expect(storylineRuns(map, only(['i3', 'i4', 'i5']), 70)[0]).toEqual({
      start: 0,
      end: 70,
      run: true,
    })
    const alongside = { ...map, stops: [...stops, { inject: inj('i3b'), time: 40 }] }
    expect(storylineRuns(alongside, only(['i3', 'i3b', 'i13', 'i4']), 50)[0]).toEqual({
      start: 0,
      end: 50,
      run: true,
    })
  })
})
