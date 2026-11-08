import { describe, expect, it } from 'vitest'

import type { ConductPrepDraft } from '../src/lib/conductPrep'
import { keepPointKeys } from '../src/lib/conductPrep'
import type { MselDraft } from '../src/lib/msel'
import type { NeedsFormDraft } from '../src/lib/needsForm'
import type { AarRead } from '../src/lib/types'
import {
  aarRows,
  acceptedState,
  heldBySaved,
  mergeAarProposals,
  mergeConductPrepProposals,
  mergeMselProposals,
  mselMetaRow,
  mergeNeedsProposals,
  scopeRow,
  tlpRow,
  withDependencies,
  type Proposal,
} from '../src/lib/proposals'

function proposal(over: Partial<Proposal>): Proposal {
  return {
    id: 'p1',
    batch_id: 'b1',
    target: 'need',
    operation: 'create',
    target_id: null,
    base: null,
    patch: {},
    depends_on: [],
    summary: '',
    issues: [],
    status: 'pending',
    applied_row_id: null,
    created_at: '2026-11-01T10:00:00Z',
    decided_at: null,
    outdated: false,
    ...over,
  }
}

const NEED = {
  id: 'n1',
  key: 'n1',
  code: 'NEED-01',
  source: 'risk_analysis' as const,
  title: 'Old title',
  finding: 'A finding',
  affected_capability: 'crisis_decision_making' as const,
  priority: 'high' as const,
}

function needsDraft(over: Partial<NeedsFormDraft> = {}): NeedsFormDraft {
  return {
    capabilities: ['crisis_decision_making'],
    needs: [NEED],
    objectives: [],
    risks: [],
    ...over,
  } as unknown as NeedsFormDraft
}

describe('mergeNeedsProposals', () => {
  it('applies an update the page left alone, and flags one it changed since', () => {
    const update = proposal({
      operation: 'update',
      target_id: 'n1',
      base: { title: 'Old title' },
      patch: { title: 'Proposed title' },
    })

    const clean = mergeNeedsProposals(needsDraft(), [update])
    const edited = mergeNeedsProposals(
      needsDraft({ needs: [{ ...NEED, title: 'My own title' }] }),
      [update],
    )

    expect(clean.conflicts).toEqual([])
    expect(clean.patch.needs?.[0].title).toBe('Proposed title')
    expect(clean.keys).toEqual({ p1: 'n1' })
    expect(edited.conflicts).toEqual([
      { proposalId: 'p1', field: 'title', current: 'My own title', proposed: 'Proposed title' },
    ])
  })

  it('creates a need and an objective linked to it, adding the capability', () => {
    const need = proposal({
      id: 'pn',
      patch: {
        source: 'previous_aar',
        title: 'Backups untested',
        affected_capability: 'continuity_recovery',
        priority: 'high',
      },
    })
    const objective = proposal({
      id: 'po',
      target: 'objective',
      depends_on: ['pn'],
      patch: {
        statement: 'Agree the restore order.',
        capability: 'continuity_recovery',
        linked_need_keys: ['proposal:pn', 'n1'],
        capabilities_to_add: ['continuity_recovery'],
      },
    })

    const group = withDependencies(objective, [objective, need])
    const merged = mergeNeedsProposals(needsDraft(), group)

    expect(group.map((p) => p.id)).toEqual(['pn', 'po'])
    const [, created] = merged.patch.needs ?? []
    expect(created).toMatchObject({ id: null, code: '', title: 'Backups untested' })
    const [linked] = merged.patch.objectives ?? []
    expect(linked.linked_need_keys).toEqual([created.key, 'n1'])
    expect(linked).not.toHaveProperty('capabilities_to_add')
    expect(merged.patch.capabilities).toEqual(['crisis_decision_making', 'continuity_recovery'])
    expect(merged.keys).toEqual({ pn: created.key, po: linked.key })
  })

  it('says when the row an update targets is gone', () => {
    const merged = mergeNeedsProposals(needsDraft({ needs: [] }), [
      proposal({ operation: 'update', target_id: 'n1', base: {}, patch: { priority: 'low' } }),
    ])
    expect(merged.missing).toEqual(['p1'])
  })
})

describe('mergeMselProposals', () => {
  it('adds an inject at the page keys of its phase and actor, with its actions', () => {
    const draft = {
      phases: [{ id: 'ph1', key: 'new-7', code: 'PH-01', start_offset: 0, end_offset: 45 }],
      actors: [{ id: 'a1', key: 'a1', code: 'ACT-01' }],
      threat_actors: [],
      injects: [],
    } as unknown as MselDraft
    const inject = proposal({
      target: 'inject',
      patch: {
        phase_key: 'ph1',
        actor_key: 'a1',
        title: 'Insurer calls',
        offset_minutes: 10,
        objective_ids: ['o1'],
        review_status: 'draft',
        expected_actions: [{ description: 'Legal answers', expected_within_minutes: 15 }],
      },
    })

    const merged = mergeMselProposals(draft, [inject])

    const [row] = merged.patch.injects ?? []
    expect(row).toMatchObject({ phase_key: 'new-7', actor_key: 'a1', title: 'Insurer calls' })
    expect(row.expected_actions).toEqual([
      expect.objectContaining({
        id: null,
        description: 'Legal answers',
        expected_within_minutes: 15,
        objective_ids: ['o1'],
      }),
    ])
  })

  it('builds from scratch: a phase, an actor and a threat actor, then the inject on them', () => {
    const draft = { phases: [], actors: [], threat_actors: [], injects: [] } as unknown as MselDraft
    const phase = proposal({
      id: 'p-phase',
      target: 'msel_phase',
      patch: { name: 'Detection', start_offset: 0, end_offset: 45, key_questions: ['Who?'] },
    })
    const actor = proposal({
      id: 'p-actor',
      target: 'msel_actor',
      patch: { name: 'Regulator', type: 'authority' },
    })
    const threat = proposal({
      id: 'p-threat',
      target: 'msel_threat',
      patch: { name: 'Crew', mitre_group_id: 'G0001', origin: 'system', origin_id: 'G0001' },
    })
    const inject = proposal({
      id: 'p-inject',
      target: 'inject',
      depends_on: ['p-phase', 'p-actor', 'p-threat'],
      patch: {
        phase_key: 'proposal:p-phase',
        actor_key: 'proposal:p-actor',
        threat_actor_key: 'proposal:p-threat',
        attack_attribution: 'threat_actor',
        title: 'The regulator calls',
      },
    })

    const merged = mergeMselProposals(draft, [phase, actor, threat, inject])

    const [newPhase] = merged.patch.phases ?? []
    const [newActor] = merged.patch.actors ?? []
    const [newThreat] = merged.patch.threat_actors ?? []
    expect(newPhase).toMatchObject({ id: null, name: 'Detection', key_questions: ['Who?'] })
    expect(newActor).toMatchObject({ id: null, name: 'Regulator', type: 'authority' })
    expect(newThreat).toMatchObject({ id: null, mitre_group_id: 'G0001', origin: 'system' })
    const [row] = merged.patch.injects ?? []
    expect(row).toMatchObject({
      phase_key: newPhase.key,
      actor_key: newActor.key,
      threat_actor_key: newThreat.key,
    })
    expect(merged.keys).toMatchObject({ 'p-phase': newPhase.key, 'p-inject': row.key })
  })

  it('names a row accepted earlier on the page by the key it got', () => {
    const draft = {
      phases: [{ id: null, key: 'new-3', code: '', start_offset: 0, end_offset: 30 }],
      actors: [],
      threat_actors: [],
      injects: [],
    } as unknown as MselDraft
    const inject = proposal({
      target: 'inject',
      depends_on: ['p-phase'],
      patch: { phase_key: 'proposal:p-phase', title: 'Press call' },
    })

    const merged = mergeMselProposals(draft, [inject], { 'p-phase': 'new-3' })

    expect(merged.patch.injects?.[0].phase_key).toBe('new-3')
  })

  it('changes a phase and keeps only due objectives it still holds', () => {
    const draft = {
      phases: [
        {
          id: 'ph1',
          key: 'ph1',
          code: 'PH-01',
          headline: 'Old',
          objective_ids: ['o1', 'o2'],
          due_objective_ids: ['o2'],
        },
      ],
      actors: [],
      threat_actors: [],
      injects: [],
    } as unknown as MselDraft
    const change = proposal({
      target: 'msel_phase',
      operation: 'update',
      target_id: 'ph1',
      base: { headline: 'Old', objective_ids: ['o1', 'o2'] },
      patch: { headline: 'New', objective_ids: ['o1'] },
    })

    const merged = mergeMselProposals(draft, [change])

    expect(merged.conflicts).toEqual([])
    expect(merged.patch.phases?.[0]).toMatchObject({ headline: 'New', due_objective_ids: [] })
  })
})

describe('acceptedState', () => {
  const create = proposal({ patch: { title: 'New' } })
  const update = proposal({
    operation: 'update',
    target_id: 'n1',
    base: { title: 'Old' },
    patch: { title: 'New' },
  })

  it('follows a created row from the draft to the save', () => {
    expect(acceptedState(create, 'new-1', [{ id: null, key: 'new-1' }], [])).toEqual({
      state: 'unsaved',
    })
    expect(
      acceptedState(create, 'new-1', [{ id: 'r1', key: 'new-1' }], [{ id: 'r1', key: 'new-1' }]),
    ).toEqual({ state: 'saved', rowId: 'r1' })
    // Undone or removed before the save: back to pending.
    expect(acceptedState(create, 'new-1', [], [])).toEqual({ state: 'gone' })
  })

  it('takes an update as saved once the saved row holds it', () => {
    const changed = { id: 'n1', key: 'n1', title: 'New' }
    const old = { id: 'n1', key: 'n1', title: 'Old' }
    expect(acceptedState(update, 'n1', [changed], [old])).toEqual({ state: 'unsaved' })
    expect(acceptedState(update, 'n1', [changed], [changed])).toEqual({
      state: 'saved',
      rowId: 'n1',
    })
    // The confirmation was cancelled: the draft never took it.
    expect(acceptedState(update, 'n1', [old], [old])).toEqual({ state: 'gone' })
  })

  // A patch comes back from JSONB with its keys sorted; the saved row reads
  // in the schema's field order, and link lists in no order at all.
  const techniqueStored = {
    domain: 'ics',
    tactic_id: 'TA0105',
    tactic_name: 'Impact',
    technique_id: 'T0829',
    technique_name: 'Loss of View',
  }
  const techniqueRead = {
    domain: 'ics',
    tactic_id: 'TA0105',
    technique_id: 'T0829',
    tactic_name: 'Impact',
    technique_name: 'Loss of View',
  }
  const injectUpdate = proposal({
    target: 'inject',
    operation: 'update',
    target_id: 'i1',
    base: { attack_techniques: [], objective_ids: ['o1'] },
    patch: { attack_techniques: [techniqueStored], objective_ids: ['o1', 'o2'] },
  })
  const savedInject = {
    id: 'i1',
    key: 'i1',
    attack_techniques: [techniqueRead],
    objective_ids: ['o2', 'o1'],
  }

  it('takes as saved a row holding the patch in another key or link order', () => {
    expect(acceptedState(injectUpdate, 'i1', [savedInject], [savedInject])).toEqual({
      state: 'saved',
      rowId: 'i1',
    })
    expect(heldBySaved(injectUpdate, [savedInject], [savedInject])).toBe('i1')
  })

  it('finds no conflict in a field that only reads in another order', () => {
    const draft = {
      phases: [],
      actors: [],
      threat_actors: [],
      injects: [{ ...savedInject, attack_techniques: [], objective_ids: ['o1'] }],
    } as unknown as MselDraft
    const stored = proposal({
      ...injectUpdate,
      base: { attack_techniques: [], objective_ids: ['o1'] },
    })

    expect(mergeMselProposals(draft, [stored]).conflicts).toEqual([])

    const reordered = {
      ...draft,
      injects: [
        { ...savedInject, attack_techniques: [techniqueRead], objective_ids: ['o2', 'o1'] },
      ],
    } as unknown as MselDraft
    // The page already holds it: nothing to replace, so nothing to ask.
    expect(mergeMselProposals(reordered, [stored]).conflicts).toEqual([])
  })

  it('applies nothing at once to a create or a row that holds something else', () => {
    expect(heldBySaved(create, [{ id: null, key: 'new-1' }], [])).toBeNull()
    const other = { ...savedInject, attack_techniques: [] }
    expect(heldBySaved(injectUpdate, [other], [other])).toBeNull()
  })
})

describe('mergeAarProposals', () => {
  const report = {
    id: 'r1',
    executive_summary: '',
    scenario_summary: '',
    conclusions: 'Mine',
    objectives: [{ id: 'o1', objective_code: 'OBJ-01', overall: 'M', analysis: '' }],
    actions: [{ id: 'a1', code: 'IP-01', finding: 'F', action: 'Old', status: 'done' }],
  } as unknown as AarRead

  it('merges text and an objective, and never touches the level', () => {
    const merged = mergeAarProposals(report, [
      proposal({
        id: 't',
        target: 'aar_text',
        operation: 'update',
        target_id: 'r1',
        base: { executive_summary: '' },
        patch: { executive_summary: 'Summary' },
      }),
      proposal({
        id: 'o',
        target: 'aar_objective',
        operation: 'update',
        target_id: 'o1',
        base: { analysis: '' },
        patch: { analysis: 'Why' },
      }),
    ])
    expect(merged.patch.executive_summary).toBe('Summary')
    expect(merged.patch.objectives?.[0]).toMatchObject({ analysis: 'Why', overall: 'M' })
    expect(merged.keys).toEqual({ t: 'r1', o: 'o1' })
    expect(merged.conflicts).toEqual([])
  })

  it('flags text the page changed since', () => {
    const merged = mergeAarProposals(report, [
      proposal({
        target: 'aar_text',
        operation: 'update',
        target_id: 'r1',
        base: { conclusions: '' },
        patch: { conclusions: 'Theirs' },
      }),
    ])
    expect(merged.conflicts).toEqual([
      { proposalId: 'p1', field: 'conclusions', current: 'Mine', proposed: 'Theirs' },
    ])
  })

  it('adds an action open, under a key, and changes one keeping its follow-up', () => {
    const merged = mergeAarProposals(report, [
      proposal({ id: 'new', target: 'aar_action', patch: { finding: 'N', action: 'Do' } }),
      proposal({
        id: 'old',
        target: 'aar_action',
        operation: 'update',
        target_id: 'a1',
        base: { action: 'Old' },
        patch: { action: 'New' },
      }),
    ])
    const [changed, added] = merged.patch.actions ?? []
    expect(changed).toMatchObject({ action: 'New', status: 'done' })
    expect(added).toMatchObject({ id: null, finding: 'N', status: 'open', due_date: null })
    expect(added.key).toBe(merged.keys.new)
  })

  it('says when the row is gone', () => {
    const merged = mergeAarProposals(report, [
      proposal({ target: 'aar_objective', operation: 'update', target_id: 'gone' }),
    ])
    expect(merged.missing).toEqual(['p1'])
  })

  it('names a saved action by its key until the page reloads it', () => {
    const rows = aarRows({ ...report, actions: [{ ...report.actions[0], key: 'proposal:p1' }] })
    expect(rows.aar_action[0].key).toBe('proposal:p1')
    expect(aarRows(report).aar_action[0].key).toBe('a1')
    expect(aarRows(report).aar_text[0].key).toBe('r1')
  })
})

describe('mergeConductPrepProposals', () => {
  const point = { id: 'pt1', kind: 'criterion', text: 'Decision in 60 min', criteria_p: '' }
  const draft = {
    eeg: [
      { id: 'e1', points: [point] },
      { id: 'e2', points: [] },
    ],
  } as unknown as ConductPrepDraft

  it('adds a point to the EEG it names and changes one by id', () => {
    const created = proposal({
      id: 'p-new',
      target: 'eeg_point',
      patch: { eeg_id: 'e2', text: 'Names a spokesperson', criteria_p: 'Within 20 min' },
    })
    const changed = proposal({
      id: 'p-change',
      target: 'eeg_point',
      operation: 'update',
      target_id: 'pt1',
      base: { criteria_p: '' },
      patch: { criteria_p: 'On time' },
    })

    const merged = mergeConductPrepProposals(draft, [created, changed])

    const [first, second] = merged.patch.eeg ?? []
    expect(first.points[0]).toMatchObject({ id: 'pt1', criteria_p: 'On time' })
    expect(second.points[0]).toMatchObject({
      id: null,
      kind: 'custom',
      text: 'Names a spokesperson',
      criteria_p: 'Within 20 min',
    })
    expect(second.points[0]).not.toHaveProperty('eeg_id')
    expect(merged.keys['p-new']).toBe(second.points[0].key)
    expect(merged.keys['p-change']).toBe('pt1')
    expect(merged.conflicts).toEqual([])
  })

  it('says when the EEG or the point is gone', () => {
    const lost = proposal({ target: 'eeg_point', patch: { eeg_id: 'e9', text: 'x' } })
    expect(mergeConductPrepProposals(draft, [lost]).missing).toEqual(['p1'])
  })

  it('keeps the key of a new point through the save, so the panel still finds it', () => {
    const sent = {
      eeg: [{ id: 'e1', points: [point, { ...point, id: null, key: 'k-7' }] }],
    } as unknown as ConductPrepDraft
    const saved = {
      eeg: [{ id: 'e1', points: [point, { ...point, id: 'pt2' }] }],
    } as unknown as ConductPrepDraft

    const kept = keepPointKeys(saved, sent)

    expect(kept.eeg[0].points[1]).toMatchObject({ id: 'pt2', key: 'k-7' })
  })
})

describe('proposals adding to one list', () => {
  const inject = { id: 'i1', key: 'i1', code: 'INJ-27', recipients: [] as string[] }
  const crisis = proposal({
    id: 'p-crisis',
    target: 'inject',
    operation: 'update',
    target_id: 'i1',
    base: { recipients: [] },
    patch: { recipients: ['Crisis committee'] },
  })
  const soc = proposal({
    id: 'p-soc',
    target: 'inject',
    operation: 'update',
    target_id: 'i1',
    base: { recipients: [] },
    patch: { recipients: ['SOC shift lead', 'OT manager'] },
  })

  it('both land, with no conflict between them', () => {
    const draft = {
      phases: [],
      actors: [],
      threat_actors: [],
      injects: [inject],
    } as unknown as MselDraft

    const merged = mergeMselProposals(draft, [crisis, soc])

    expect(merged.conflicts).toEqual([])
    expect(merged.patch.injects?.[0].recipients).toEqual([
      'Crisis committee',
      'SOC shift lead',
      'OT manager',
    ])
  })

  it('each one reads as saved in the list that holds them all', () => {
    const saved = { ...inject, recipients: ['Crisis committee', 'SOC shift lead', 'OT manager'] }
    expect(acceptedState(crisis, 'i1', [saved], [saved])).toEqual({ state: 'saved', rowId: 'i1' })
    expect(acceptedState(soc, 'i1', [saved], [saved])).toEqual({ state: 'saved', rowId: 'i1' })
    // One whose member was taken out again isn't held.
    const without = { ...inject, recipients: ['SOC shift lead', 'OT manager'] }
    expect(acceptedState(crisis, 'i1', [without], [without])).toEqual({ state: 'gone' })
  })
})

describe('deleting rows and changing the scope', () => {
  it('deletes a need with its links, and an objective', () => {
    const draft = needsDraft({
      needs: [NEED],
      objectives: [
        { id: 'o1', key: 'o1', code: 'OBJ-01', linked_need_keys: ['n1'] },
        { id: 'o2', key: 'o2', code: 'OBJ-02', linked_need_keys: [] },
      ] as unknown as NeedsFormDraft['objectives'],
    })
    const need = proposal({ id: 'p-need', operation: 'delete', target_id: 'n1' })
    const objective = proposal({
      id: 'p-obj',
      target: 'objective',
      operation: 'delete',
      target_id: 'o2',
    })

    const merged = mergeNeedsProposals(draft, [need, objective])

    expect(merged.patch.needs).toEqual([])
    expect(merged.patch.objectives?.map((o) => [o.id, o.linked_need_keys])).toEqual([['o1', []]])
    expect(merged.keys).toEqual({ 'p-need': 'n1', 'p-obj': 'o2' })
  })

  it('adds the areas a scope proposal adds, hours back as text', () => {
    const draft = needsDraft({
      participating_areas: ['SOC'],
      max_duration_hours: '4',
    } as Partial<NeedsFormDraft>)
    const scope = proposal({
      target: 'needs_scope',
      operation: 'update',
      target_id: 'f1',
      base: { participating_areas: ['SOC'], max_duration_hours: 4 },
      patch: { participating_areas: ['SOC', 'Legal'], max_duration_hours: 6 },
    })

    const merged = mergeNeedsProposals(draft, [scope])

    expect(merged.patch).toMatchObject({
      participating_areas: ['SOC', 'Legal'],
      max_duration_hours: '6',
    })
    const saved = scopeRow('f1', { ...draft, ...merged.patch } as NeedsFormDraft)
    expect(acceptedState(scope, 'f1', [saved], [saved])).toEqual({ state: 'saved', rowId: 'f1' })
  })

  it('deletes an actor and clears the injects that named it', () => {
    const draft = {
      phases: [],
      actors: [{ id: 'a1', key: 'a1', code: 'ACT-01' }],
      threat_actors: [],
      injects: [{ id: 'i1', key: 'i1', actor_key: 'a1', threat_actor_key: null }],
    } as unknown as MselDraft
    const gone = proposal({ target: 'msel_actor', operation: 'delete', target_id: 'a1' })

    const merged = mergeMselProposals(draft, [gone])

    expect(merged.patch.actors).toEqual([])
    expect(merged.patch.injects?.[0].actor_key).toBeNull()
  })

  it('takes a deletion as saved once the row is gone from the save', () => {
    const del = proposal({ target: 'inject', operation: 'delete', target_id: 'i1' })
    const row = { id: 'i1', key: 'i1' }
    expect(acceptedState(del, 'i1', [row], [row])).toEqual({ state: 'gone' })
    expect(acceptedState(del, 'i1', [], [row])).toEqual({ state: 'unsaved' })
    expect(acceptedState(del, 'i1', [], [])).toEqual({ state: 'saved', rowId: 'i1' })
    // Already gone everywhere: applied at once.
    expect(heldBySaved(del, [], [])).toBe('i1')
    expect(heldBySaved(del, [row], [row])).toBeNull()
  })
})

describe('MSEL coverage', () => {
  const parent = {
    id: 'i1',
    key: 'i1',
    code: 'INJ-01',
    objective_ids: ['o1'],
    expected_actions: [{ id: 'a1', key: 'a1', code: 'INJ-01-A1', description: 'Old' }],
    actor_key: null,
    threat_actor_key: null,
  }
  const draft = {
    title: 'Old title',
    summary: '',
    exercise_start: '',
    incident_start: '',
    incident_date: '',
    duration_minutes: 120,
    time_compression: 60,
    meters: [],
    phases: [{ id: 'ph1', key: 'ph1', code: 'PH-01' }],
    actors: [],
    threat_actors: [],
    injects: [parent],
  } as unknown as MselDraft

  it('replaces the expected actions of an inject on a change', () => {
    const change = proposal({
      id: 'p-acts',
      target: 'inject',
      operation: 'update',
      target_id: 'i1',
      base: { expected_actions: [{ description: 'Old' }] },
      patch: { expected_actions: [{ description: 'Isolate', expected_within_minutes: 10 }] },
    })

    const [row] = mergeMselProposals(draft, [change]).patch.injects ?? []

    expect(row.expected_actions).toEqual([
      expect.objectContaining({
        id: null,
        key: 'proposal:p-acts:1',
        description: 'Isolate',
        expected_within_minutes: 10,
        objective_ids: ['o1'],
      }),
    ])
  })

  it('anchors a contingent inject to the page keys of its parent and action', () => {
    const contingent = proposal({
      target: 'inject',
      patch: {
        phase_key: 'ph1',
        kind: 'contingent',
        title: 'Escalation',
        branch_from_key: 'i1',
        branch_action_key: 'a1',
        rejoin_key: 'i1',
      },
    })

    const rows = mergeMselProposals(draft, [contingent]).patch.injects ?? []

    expect(rows[1]).toMatchObject({ branch_from_key: 'i1', branch_action_key: 'a1' })
  })

  it('changes the settings and reads them back as saved', () => {
    const settings = proposal({
      target: 'msel_meta',
      operation: 'update',
      target_id: 'm1',
      base: { title: 'Old title', exercise_start: null, meters: [] },
      patch: {
        title: 'New title',
        exercise_start: '10:00',
        meters: [{ key: 'reputation', name: 'Reputation' }],
      },
    })

    const merged = mergeMselProposals(draft, [settings])

    expect(merged.patch).toMatchObject({
      title: 'New title',
      exercise_start: '10:00',
      meters: [{ key: 'reputation', name: 'Reputation' }],
    })
    const saved = mselMetaRow('m1', { ...draft, ...merged.patch } as MselDraft)
    expect(acceptedState(settings, 'm1', [saved], [saved])).toEqual({ state: 'saved', rowId: 'm1' })
  })
})

describe('the classification (TLP)', () => {
  it('changes the needs analysis TLP and reads back as saved', () => {
    const draft = needsDraft({ tlp: 'amber' } as Partial<NeedsFormDraft>)
    const tlp = proposal({
      target: 'needs_tlp',
      operation: 'update',
      target_id: 'f1',
      base: { tlp: 'amber' },
      patch: { tlp: 'red' },
    })

    const merged = mergeNeedsProposals(draft, [tlp])

    expect(merged.patch.tlp).toBe('red')
    const saved = tlpRow('f1', { ...draft, ...merged.patch } as NeedsFormDraft)
    expect(acceptedState(tlp, 'f1', [saved], [saved])).toEqual({ state: 'saved', rowId: 'f1' })
  })
})
