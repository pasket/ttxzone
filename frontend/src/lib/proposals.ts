/** The AI assistant's proposals (docs/features/ai-assistant.md#proposals):
 * accepting one is an edit of the page's draft, merged here, and the
 * form's own autosave persists it. Pure functions, so the merge rules are
 * tested apart from the page. */

import { emptyAction } from './aar'
import type { ConductPrepDraft, DraftPoint } from './conductPrep'
import { newPoint } from './conductPrep'
import type {
  ActionDraft,
  ActorDraft,
  InjectDraft,
  MselDraft,
  PhaseDraft,
  ThreatActorDraft,
} from './msel'
import { emptyInjectDraft, newMselKey } from './msel'
import type { NeedDraft, NeedsFormDraft, ObjectiveDraft } from './needsForm'
import { newRowKey } from './needsForm'
import type { AarRead, Capability } from './types'

export type ProposalTarget =
  | 'need'
  | 'objective'
  | 'needs_scope'
  | 'needs_tlp'
  | 'ttx_meta'
  | 'inject'
  | 'msel_phase'
  | 'msel_actor'
  | 'msel_threat'
  | 'msel_meta'
  | 'msel_renumber'
  | 'eeg_point'
  | 'aar_text'
  | 'aar_objective'
  | 'aar_action'

/** What of the session backs an after-action proposal. */
export interface ProposalEvidence {
  kind: 'inject' | 'action' | 'decision' | 'poll' | 'rating' | 'note' | 'feedback'
  ref: string
  label: string
}

export interface Proposal {
  id: string
  batch_id: string
  target: ProposalTarget
  operation: 'create' | 'update' | 'delete'
  target_id: string | null
  /** On an update: the proposed fields as they were saved when proposed. */
  base: Record<string, unknown> | null
  patch: Record<string, unknown>
  /** Proposals this one needs (an objective linked to a proposed need). */
  depends_on: string[]
  /** The name the assistant gave a set of proposals, decided together. */
  changeset?: string | null
  summary: string
  issues: { level: string; code: string; field: string | null; item: string | null }[]
  evidence?: ProposalEvidence[]
  status: 'pending' | 'accepted' | 'discarded'
  applied_row_id: string | null
  created_at: string
  decided_at: string | null
  /** An update whose row changed (or went) since it was proposed. */
  outdated: boolean
}

export interface ProposalListResponse {
  items: Proposal[]
}

/** How the server names a row another proposal creates. */
export const PROPOSAL_REF = 'proposal:'

/** The proposal and every pending one it depends on, dependencies first. */
export function withDependencies(proposal: Proposal, all: Proposal[]): Proposal[] {
  const byId = new Map(all.map((p) => [p.id, p]))
  const out: Proposal[] = []
  const seen = new Set<string>()
  function visit(p: Proposal) {
    if (seen.has(p.id)) return
    seen.add(p.id)
    for (const dep of p.depends_on) {
      const found = byId.get(dep)
      if (found) visit(found)
    }
    out.push(p)
  }
  visit(proposal)
  return out
}

/** Lists the server keeps as link rows, with no order of their own: the
 * same members in another order are the same value. */
const UNORDERED_FIELDS = new Set(['objective_ids', 'due_objective_ids', 'linked_need_keys'])

/** Objects with their keys sorted, all the way down: a proposal's patch
 * comes back from JSONB with its keys reordered, a saved row in its
 * schema's field order. Arrays keep their order (it's a position). */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map((key) => [key, canonical(record[key])]),
    )
  }
  return value
}

/** Whether two values of a field are the same, whatever the order of an
 * object's keys (or, for a link list, of its members). */
export function same(a: unknown, b: unknown, field?: string): boolean {
  let x = canonical(a)
  let y = canonical(b)
  if (field && UNORDERED_FIELDS.has(field) && Array.isArray(x) && Array.isArray(y)) {
    x = x.map((v) => JSON.stringify(v)).sort()
    y = y.map((v) => JSON.stringify(v)).sort()
  }
  return JSON.stringify(x) === JSON.stringify(y)
}

/** What a proposal does to a list field: the members it adds and the ones
 * it takes out, against the value it was proposed over. Null for a field
 * that isn't a list (or a create, which has no base). */
export interface ListDelta {
  added: unknown[]
  removed: unknown[]
}

function memberKey(value: unknown): string {
  return JSON.stringify(canonical(value))
}

export function listDelta(proposal: Proposal, field: string, value: unknown): ListDelta | null {
  if (proposal.operation !== 'update' || !proposal.base || !(field in proposal.base)) return null
  return compareLists(proposal.base[field], value)
}

/** What changes from one list to another; null unless both are lists (an
 * empty value counts as an empty list). */
export function compareLists(before: unknown, after: unknown): ListDelta | null {
  if (!Array.isArray(after) || (before != null && !Array.isArray(before))) return null
  const was = (before ?? []) as unknown[]
  const wasKeys = new Set(was.map(memberKey))
  const willKeys = new Set(after.map(memberKey))
  return {
    added: after.filter((v) => !wasKeys.has(memberKey(v))),
    removed: was.filter((v) => !willKeys.has(memberKey(v))),
  }
}

function applyDelta(current: unknown, delta: ListDelta): unknown[] {
  const removed = new Set(delta.removed.map(memberKey))
  const kept = (Array.isArray(current) ? current : []).filter((v) => !removed.has(memberKey(v)))
  const have = new Set(kept.map(memberKey))
  return [...kept, ...delta.added.filter((v) => !have.has(memberKey(v)))]
}

/** A row with a proposal's patch on it. A list field takes what the
 * proposal adds and removes, so two proposals adding to one list (two
 * recipients each) both land; any other field is replaced. `patch` is
 * the proposal's, or the page's translation of it. */
export function patchRow<R extends object>(
  row: R,
  proposal: Proposal,
  patch: Record<string, unknown> = proposal.patch,
): R {
  const out = { ...row } as Record<string, unknown>
  for (const [field, value] of Object.entries(patch)) {
    const delta = listDelta(proposal, field, proposal.patch[field] ?? value)
    out[field] = delta
      ? applyDelta(out[field], translateDelta(delta, value, proposal.patch[field]))
      : value
  }
  return out as R
}

/** The delta in the page's terms when the page translated the field
 * (ids to keys): members taken by position from the translated list. */
function translateDelta(delta: ListDelta, translated: unknown, original: unknown): ListDelta {
  if (!Array.isArray(translated) || !Array.isArray(original) || translated === original)
    return delta
  const added = new Set(delta.added.map(memberKey))
  return {
    added: translated.filter((_, i) => added.has(memberKey(original[i]))),
    removed: delta.removed,
  }
}

/** A field the page changed since the proposal was made, to a value other
 * than the proposed one: accepting would overwrite that edit. */
export interface Conflict {
  proposalId: string
  field: string
  current: unknown
  proposed: unknown
}

function updateConflicts(proposal: Proposal, row: object | undefined): Conflict[] {
  if (!row || !proposal.base) return []
  const current = row as Record<string, unknown>
  return Object.entries(proposal.patch)
    .filter(
      ([field, proposed]) =>
        field in proposal.base! &&
        listDelta(proposal, field, proposed) === null &&
        !same(current[field], proposal.base![field], field) &&
        !same(current[field], proposed, field),
    )
    .map(([field, proposed]) => ({
      proposalId: proposal.id,
      field,
      current: current[field],
      proposed,
    }))
}

export interface Merge<D> {
  /** What to pass to the editor's update(). */
  patch: Partial<D>
  /** proposal id -> the key of the row it made or changed. */
  keys: Record<string, string>
  conflicts: Conflict[]
  /** Proposals whose row no longer exists (nothing to change). */
  missing: string[]
}

/** The needs analysis' scope fields a proposal may change. */
export const SCOPE_FIELDS = [
  'participating_areas',
  'third_parties',
  'perimeter',
  'out_of_scope',
  'regulatory_frameworks',
  'regulatory_framework_other',
  'max_duration_hours',
  'confidentiality_restrictions',
  'budget_and_external_support',
] as const

/** The scope as one row, in the server's shape (the draft keeps the hours
 * as text), so a scope proposal can be compared with it. */
export function scopeRow(id: string, draft: NeedsFormDraft) {
  const row: Record<string, unknown> = { id, key: id }
  for (const field of SCOPE_FIELDS) row[field] = draft[field as keyof NeedsFormDraft]
  const hours = String(draft.max_duration_hours ?? '').trim()
  row.max_duration_hours = hours === '' ? null : Number(hours)
  return row as { id: string; key: string } & Record<string, unknown>
}

/** The needs analysis' classification as one row. */
export function tlpRow(id: string, draft: NeedsFormDraft) {
  return { id, key: id, tlp: draft.tlp }
}

/** The exercise's presentation as one row (Creator → Exercise). */
export function exerciseRow(ttx: {
  id: string
  name: string
  description?: string | null
  content_language?: string | null
}) {
  return {
    id: ttx.id,
    key: ttx.id,
    name: ttx.name,
    description: ttx.description ?? '',
    content_language: ttx.content_language ?? null,
  }
}

/** Needs and objectives into the needs analysis draft. `accepted` maps
 * proposals accepted earlier on this page to their rows' keys. */
export function mergeNeedsProposals(
  draft: NeedsFormDraft,
  group: Proposal[],
  accepted: Record<string, string> = {},
): Merge<NeedsFormDraft> {
  let needs = [...draft.needs]
  let objectives = [...draft.objectives]
  const capabilities = [...draft.capabilities]
  const keys: Record<string, string> = {}
  const conflicts: Conflict[] = []
  const missing: string[] = []
  const needKeyById = new Map(needs.filter((n) => n.id).map((n) => [n.id as string, n.key]))

  function needKey(reference: string): string | null {
    if (reference.startsWith(PROPOSAL_REF)) {
      const id = reference.slice(PROPOSAL_REF.length)
      return keys[id] ?? accepted[id] ?? null
    }
    return needKeyById.get(reference) ?? null
  }

  let scope: Record<string, unknown> = {}
  for (const proposal of group) {
    const patch = { ...proposal.patch }
    if (proposal.target === 'needs_tlp') {
      conflicts.push(...updateConflicts(proposal, tlpRow(proposal.target_id ?? '', draft)))
      scope = { ...scope, tlp: patch.tlp }
      keys[proposal.id] = proposal.target_id ?? ''
      continue
    }
    if (proposal.target === 'needs_scope') {
      const current = { ...scopeRow(proposal.target_id ?? '', draft), ...scope }
      conflicts.push(...updateConflicts(proposal, current))
      scope = patchRow(current, proposal)
      keys[proposal.id] = proposal.target_id ?? ''
      continue
    }
    if (proposal.operation === 'delete') {
      const rows = proposal.target === 'need' ? needs : objectives
      const gone = rows.find((r) => r.id === proposal.target_id)
      if (!gone) {
        missing.push(proposal.id)
        continue
      }
      keys[proposal.id] = gone.key
      if (proposal.target === 'need') {
        needs = needs.filter((n) => n !== gone)
        objectives = objectives.map((o) => ({
          ...o,
          linked_need_keys: o.linked_need_keys.filter((k) => k !== gone.key),
        }))
      } else {
        objectives = objectives.filter((o) => o !== gone)
      }
      continue
    }
    if (proposal.target === 'need') {
      if (proposal.operation === 'create') {
        const row: NeedDraft = {
          id: null,
          key: newRowKey(),
          code: '',
          title: '',
          finding: '',
          ...(patch as Pick<NeedDraft, 'source' | 'affected_capability' | 'priority'>),
        }
        needs = [...needs, row]
        keys[proposal.id] = row.key
      } else {
        const index = needs.findIndex((n) => n.id === proposal.target_id)
        if (index < 0) {
          missing.push(proposal.id)
          continue
        }
        conflicts.push(...updateConflicts(proposal, needs[index]))
        needs = needs.map((n, i) => (i === index ? patchRow(n, proposal, patch) : n))
        keys[proposal.id] = needs[index].key
      }
      continue
    }
    if (proposal.target !== 'objective') continue
    for (const capability of (patch.capabilities_to_add as Capability[] | undefined) ?? []) {
      if (!capabilities.includes(capability)) capabilities.push(capability)
    }
    delete patch.capabilities_to_add
    if (Array.isArray(patch.linked_need_keys)) {
      patch.linked_need_keys = (patch.linked_need_keys as string[])
        .map(needKey)
        .filter((key): key is string => key !== null)
    }
    if (proposal.operation === 'create') {
      const row: ObjectiveDraft = {
        id: null,
        key: newRowKey(),
        code: '',
        title: '',
        statement: '',
        capability: patch.capability as Capability,
        linked_need_keys: [],
        success_criterion: '',
        achieve_at_least: null,
        time_box_minutes: null,
        achieved_note: '',
        partially_achieved: '',
        not_achieved: '',
        evidence: '',
        regulatory_requirement_ids: [],
        ...(patch as Partial<ObjectiveDraft>),
      }
      objectives = [...objectives, row]
      keys[proposal.id] = row.key
    } else {
      const index = objectives.findIndex((o) => o.id === proposal.target_id)
      if (index < 0) {
        missing.push(proposal.id)
        continue
      }
      conflicts.push(...updateConflicts(proposal, objectives[index]))
      objectives = objectives.map((o, i) => (i === index ? patchRow(o, proposal, patch) : o))
      keys[proposal.id] = objectives[index].key
    }
  }
  const scoped: Partial<NeedsFormDraft> =
    'tlp' in scope ? { tlp: scope.tlp as NeedsFormDraft['tlp'] } : {}
  for (const field of SCOPE_FIELDS) {
    if (!(field in scope)) continue
    const value = scope[field]
    ;(scoped as Record<string, unknown>)[field] =
      field === 'max_duration_hours' ? (value === null ? '' : String(value)) : value
  }
  return { patch: { ...scoped, needs, objectives, capabilities }, keys, conflicts, missing }
}

/** The MSEL's settings a proposal may change, as one row. */
export const META_FIELDS = [
  'title',
  'summary',
  'exercise_start',
  'incident_start',
  'incident_date',
  'duration_minutes',
  'time_compression',
  'meters',
] as const

export function mselMetaRow(id: string, draft: MselDraft) {
  const row: Record<string, unknown> = { id, key: id }
  for (const field of META_FIELDS) {
    const value = draft[field]
    row[field] = value === '' ? null : value
  }
  return row as { id: string; key: string } & Record<string, unknown>
}

/** The MSEL as a code reset proposal reads it: the kinds still out of order. */
export function renumberRow(id: string, outOfOrder: readonly string[]) {
  return { id, key: id, out_of_order: [...outOfOrder] }
}

/** Phases, actors, threat actors and injects into the MSEL draft. Rows
 * are named by id in a proposal; the page may know a row created this
 * session by a temporary key, so ids are translated to the page's keys,
 * and a row another proposal creates (`proposal:<id>`) to the key it got
 * when accepted -- in this group (dependencies come first) or earlier on
 * the page (`accepted`). */
export function mergeMselProposals(
  draft: MselDraft,
  group: Proposal[],
  accepted: Record<string, string> = {},
): Merge<MselDraft> {
  let phases = [...draft.phases]
  let actors = [...draft.actors]
  let threatActors = [...draft.threat_actors]
  let injects = [...draft.injects]
  const keys: Record<string, string> = {}
  const conflicts: Conflict[] = []
  const missing: string[] = []

  function rowKey(rows: { id: string | null; key: string }[], id: unknown): string | null {
    if (id === null || id === undefined) return null
    const text = id as string
    if (text.startsWith(PROPOSAL_REF)) {
      const proposalId = text.slice(PROPOSAL_REF.length)
      return keys[proposalId] ?? accepted[proposalId] ?? text
    }
    return rows.find((r) => r.id === text)?.key ?? text
  }

  function translate(patch: Record<string, unknown>): Partial<InjectDraft> {
    const out: Record<string, unknown> = { ...patch }
    if ('phase_key' in out) out.phase_key = rowKey(phases, out.phase_key)
    if ('actor_key' in out) out.actor_key = rowKey(actors, out.actor_key)
    if ('threat_actor_key' in out) out.threat_actor_key = rowKey(threatActors, out.threat_actor_key)
    if ('branch_from_key' in out) out.branch_from_key = rowKey(injects, out.branch_from_key)
    if ('rejoin_key' in out) out.rejoin_key = rowKey(injects, out.rejoin_key)
    if (
      typeof out.branch_action_key === 'string' &&
      !out.branch_action_key.startsWith(PROPOSAL_REF)
    ) {
      const id = out.branch_action_key
      out.branch_action_key =
        injects.flatMap((i) => i.expected_actions).find((a) => a.id === id)?.key ?? id
    }
    delete out.expected_actions
    return out as Partial<InjectDraft>
  }

  /** A proposal on one of the MSEL's lists: a new row, or a change of one. */
  function mergeRow<R extends { id: string | null; key: string }>(
    rows: R[],
    proposal: Proposal,
    create: () => R,
    adjust: (row: R) => R = (row) => row,
  ): R[] {
    if (proposal.operation === 'create') {
      const row = create()
      keys[proposal.id] = row.key
      return [...rows, row]
    }
    const index = rows.findIndex((r) => r.id === proposal.target_id)
    if (proposal.operation === 'delete') {
      if (index < 0) {
        missing.push(proposal.id)
        return rows
      }
      keys[proposal.id] = rows[index].key
      return rows.filter((_, i) => i !== index)
    }
    if (index < 0) {
      missing.push(proposal.id)
      return rows
    }
    conflicts.push(...updateConflicts(proposal, rows[index]))
    keys[proposal.id] = rows[index].key
    return rows.map((r, i) => (i === index ? adjust(patchRow(r, proposal)) : r))
  }

  /** A proposal's expected actions as the draft's, keyed so a contingent
   * inject proposed with them can name one (proposal:<id>:<n>). */
  function actionsOf(proposal: Proposal, objectiveIds: string[]): ActionDraft[] {
    return ((proposal.patch.expected_actions as Partial<ActionDraft>[] | undefined) ?? []).map(
      (action, n): ActionDraft => ({
        id: null,
        key: `${PROPOSAL_REF}${proposal.id}:${n + 1}`,
        code: '',
        description: action.description ?? '',
        responsible_role: action.responsible_role ?? '',
        expected_within_minutes: action.expected_within_minutes ?? null,
        objective_ids: objectiveIds,
      }),
    )
  }

  let meta: Record<string, unknown> = {}
  for (const proposal of group) {
    const patch = proposal.patch
    if (proposal.target === 'msel_meta') {
      const current = { ...mselMetaRow(proposal.target_id ?? '', draft), ...meta }
      conflicts.push(...updateConflicts(proposal, current))
      meta = patchRow(current, proposal)
      keys[proposal.id] = proposal.target_id ?? ''
      continue
    }
    if (proposal.target === 'msel_phase') {
      phases = mergeRow(
        phases,
        proposal,
        (): PhaseDraft => ({
          id: null,
          key: newMselKey(),
          code: '',
          name: '',
          headline: '',
          start_offset: 0,
          end_offset: 0,
          incident_jump_minutes: 0,
          situation_update: '',
          key_questions: [],
          objective_ids: [],
          due_objective_ids: [],
          ...(patch as Partial<PhaseDraft>),
        }),
        (row) => ({
          ...row,
          due_objective_ids: row.due_objective_ids.filter((o) => row.objective_ids.includes(o)),
        }),
      )
    } else if (proposal.target === 'msel_actor') {
      actors = mergeRow(actors, proposal, (): ActorDraft => ({
        id: null,
        key: newMselKey(),
        code: '',
        name: '',
        type: 'other',
        description: '',
        channel: null,
        origin: 'exercise',
        origin_id: null,
        origin_name: null,
        played_by: '',
        ...(patch as Partial<ActorDraft>),
      }))
    } else if (proposal.target === 'msel_threat') {
      threatActors = mergeRow(threatActors, proposal, (): ThreatActorDraft => ({
        id: null,
        key: newMselKey(),
        code: '',
        name: '',
        mitre_group_id: null,
        aliases: [],
        description: '',
        techniques: [],
        origin: 'exercise',
        origin_id: null,
        origin_name: null,
        modified_at: null,
        ...(patch as Partial<ThreatActorDraft>),
      }))
    } else if (proposal.target === 'inject') {
      if (proposal.operation === 'delete') {
        const gone = injects.find((i) => i.id === proposal.target_id)
        if (!gone) {
          missing.push(proposal.id)
          continue
        }
        keys[proposal.id] = gone.key
        injects = injects.filter((i) => i !== gone)
        continue
      }
      if (proposal.operation === 'create') {
        const fields = translate(patch)
        const objectiveIds = (fields.objective_ids as string[] | undefined) ?? []
        const actions = actionsOf(proposal, objectiveIds)
        const row = emptyInjectDraft(
          { ...draft, phases, actors, threat_actors: threatActors },
          { ...fields, expected_actions: actions },
        )
        injects = [...injects, row]
        keys[proposal.id] = row.key
      } else {
        const index = injects.findIndex((i) => i.id === proposal.target_id)
        if (index < 0) {
          missing.push(proposal.id)
          continue
        }
        const current = injects[index]
        const idOf = (rows: { id: string | null; key: string }[], key: string | null) =>
          rows.find((r) => r.key === key)?.id ?? key
        const comparable = {
          ...current,
          phase_key: idOf(phases, current.phase_key),
          actor_key: idOf(actors, current.actor_key),
          threat_actor_key: idOf(threatActors, current.threat_actor_key),
        }
        conflicts.push(...updateConflicts(proposal, comparable))
        injects = injects.map((inject, i) => {
          if (i !== index) return inject
          const changed = patchRow(inject, proposal, translate(patch))
          // A new list of expected actions replaces the inject's.
          return 'expected_actions' in patch
            ? { ...changed, expected_actions: actionsOf(proposal, changed.objective_ids) }
            : changed
        })
        keys[proposal.id] = current.key
      }
    }
  }
  // What named a deleted actor or threat actor no longer does.
  const actorKeys = new Set(actors.map((a) => a.key))
  const threatKeys = new Set(threatActors.map((a) => a.key))
  injects = injects.map((i) =>
    (i.actor_key && !actorKeys.has(i.actor_key)) ||
    (i.threat_actor_key && !threatKeys.has(i.threat_actor_key))
      ? {
          ...i,
          actor_key: i.actor_key && actorKeys.has(i.actor_key) ? i.actor_key : null,
          threat_actor_key:
            i.threat_actor_key && threatKeys.has(i.threat_actor_key) ? i.threat_actor_key : null,
        }
      : i,
  )
  const settings: Partial<MselDraft> = {}
  for (const field of META_FIELDS) {
    if (field in meta) {
      ;(settings as Record<string, unknown>)[field] =
        meta[field] === null && field !== 'duration_minutes' ? '' : meta[field]
    }
  }
  return {
    patch: { ...settings, phases, actors, threat_actors: threatActors, injects },
    keys,
    conflicts,
    missing,
  }
}

/** Observation points into the session plan's draft: a new one on the EEG
 * its proposal names (`eeg_id`), a change on the point by id. */
export function mergeConductPrepProposals(
  draft: ConductPrepDraft,
  group: Proposal[],
): Merge<ConductPrepDraft> {
  let eeg = draft.eeg.map((o) => ({ ...o, points: [...o.points] }))
  const keys: Record<string, string> = {}
  const conflicts: Conflict[] = []
  const missing: string[] = []
  for (const proposal of group) {
    if (proposal.target !== 'eeg_point') continue
    const patch = { ...proposal.patch }
    if (proposal.operation === 'create') {
      const eegId = patch.eeg_id as string
      delete patch.eeg_id
      const index = eeg.findIndex((o) => o.id === eegId)
      if (index < 0) {
        missing.push(proposal.id)
        continue
      }
      const point: DraftPoint = { ...newPoint(), ...(patch as Partial<DraftPoint>) }
      eeg = eeg.map((o, i) => (i === index ? { ...o, points: [...o.points, point] } : o))
      keys[proposal.id] = point.key as string
      continue
    }
    const owner = eeg.findIndex((o) => o.points.some((p) => p.id === proposal.target_id))
    if (owner < 0) {
      missing.push(proposal.id)
      continue
    }
    if (proposal.operation === 'delete') {
      const gone = eeg[owner].points.find((p) => p.id === proposal.target_id)!
      keys[proposal.id] = gone.key ?? (gone.id as string)
      eeg = eeg.map((o, i) =>
        i === owner ? { ...o, points: o.points.filter((p) => p !== gone) } : o,
      )
      continue
    }
    const current = eeg[owner].points.find((p) => p.id === proposal.target_id)!
    conflicts.push(...updateConflicts(proposal, current))
    keys[proposal.id] = current.key ?? (current.id as string)
    eeg = eeg.map((o, i) =>
      i === owner
        ? {
            ...o,
            points: o.points.map((p) =>
              p.id === proposal.target_id ? patchRow(p, proposal, patch) : p,
            ),
          }
        : o,
    )
  }
  return { patch: { eeg }, keys, conflicts, missing }
}

/** The report's rows as the proposals name them: its texts, as one row. */
export function aarRows(report: AarRead) {
  return {
    aar_text: [{ ...report, key: report.id }],
    aar_objective: report.objectives.map((objective) => ({ ...objective, key: objective.id })),
    aar_action: report.actions.map((action) => ({ ...action, key: action.key ?? action.id ?? '' })),
  }
}

/** Text, objectives' text and improvement actions into the report. */
export function mergeAarProposals(draft: AarRead, group: Proposal[]): Merge<AarRead> {
  const patch: Partial<AarRead> = {}
  let objectives = draft.objectives
  let actions = draft.actions
  const keys: Record<string, string> = {}
  const conflicts: Conflict[] = []
  const missing: string[] = []

  for (const proposal of group) {
    if (proposal.target === 'aar_text') {
      conflicts.push(...updateConflicts(proposal, draft))
      Object.assign(patch, proposal.patch)
      keys[proposal.id] = draft.id
    } else if (proposal.target === 'aar_objective') {
      const current = objectives.find((objective) => objective.id === proposal.target_id)
      if (!current) {
        missing.push(proposal.id)
        continue
      }
      conflicts.push(...updateConflicts(proposal, current))
      objectives = objectives.map((objective) =>
        objective === current ? { ...objective, ...proposal.patch } : objective,
      )
      patch.objectives = objectives
      keys[proposal.id] = current.id
    } else if (proposal.operation === 'delete') {
      const gone = actions.find((action) => action.id === proposal.target_id)
      if (!gone) {
        missing.push(proposal.id)
        continue
      }
      keys[proposal.id] = gone.key ?? gone.id ?? ''
      actions = actions.filter((action) => action !== gone)
      patch.actions = actions
    } else if (proposal.operation === 'create') {
      const key = `${PROPOSAL_REF}${proposal.id}`
      actions = [...actions, { ...emptyAction(), ...proposal.patch, key }]
      patch.actions = actions
      keys[proposal.id] = key
    } else {
      const current = actions.find((action) => action.id === proposal.target_id)
      if (!current) {
        missing.push(proposal.id)
        continue
      }
      conflicts.push(...updateConflicts(proposal, current))
      actions = actions.map((action) =>
        action === current ? { ...action, ...proposal.patch } : action,
      )
      patch.actions = actions
      keys[proposal.id] = current.key ?? current.id ?? ''
    }
  }
  return { patch, keys, conflicts, missing }
}

/** Where an accepted proposal stands on the page: still in the draft
 * (waiting for the autosave), saved (to be marked applied with its row's
 * id), or gone (removed, undone, or the change was never confirmed). */
export function acceptedState(
  proposal: Proposal,
  key: string,
  draftRows: { id: string | null; key: string }[],
  savedRows: { id: string | null; key: string }[],
): { state: 'unsaved' } | { state: 'saved'; rowId: string } | { state: 'gone' } {
  const inDraft = draftRows.find((row) => row.key === key) as
    (Record<string, unknown> & { id: string | null }) | undefined
  const saved = savedRows.find((row) => row.key === key) as
    (Record<string, unknown> & { id: string | null }) | undefined
  const holdsPatch = (row: Record<string, unknown> | undefined) =>
    !!row &&
    Object.entries(proposal.patch).every(
      ([field, value]) =>
        // Fields the merge rewrites (references by key, actions, the
        // capability added to the form) are checked by the row existing.
        [
          'linked_need_keys',
          'capabilities_to_add',
          'expected_actions',
          'phase_key',
          'actor_key',
          'threat_actor_key',
          'branch_from_key',
          'branch_action_key',
          'rejoin_key',
        ].includes(field) || holds(row[field], field, value),
    )
  // A list holds the proposal when it has what it adds and lacks what it
  // takes out (other proposals may have added to the same list).
  const holds = (current: unknown, field: string, value: unknown) => {
    const delta = listDelta(proposal, field, value)
    if (!delta || !Array.isArray(current)) return same(current, value, field)
    const members = new Set(current.map(memberKey))
    return (
      delta.added.every((v) => members.has(memberKey(v))) &&
      delta.removed.every((v) => !members.has(memberKey(v)))
    )
  }
  if (proposal.operation === 'delete') {
    // Accepted, the row leaves the draft; saved once it's gone from the save.
    if (inDraft) return { state: 'gone' }
    return saved ? { state: 'unsaved' } : { state: 'saved', rowId: proposal.target_id as string }
  }
  if (proposal.operation === 'update') {
    if (!holdsPatch(inDraft)) return { state: 'gone' }
    return holdsPatch(saved) && saved?.id
      ? { state: 'saved', rowId: saved.id }
      : { state: 'unsaved' }
  }
  if (!inDraft) return { state: 'gone' }
  return saved?.id ? { state: 'saved', rowId: saved.id } : { state: 'unsaved' }
}

/** An update the saved document already holds -- accepting it would change
 * nothing: the saved row's id, to mark it applied at once. Null for a
 * create, or when the row is gone or holds something else. */
export function heldBySaved(
  proposal: Proposal,
  draftRows: { id: string | null; key: string }[],
  savedRows: { id: string | null; key: string }[],
): string | null {
  if (proposal.operation === 'delete') {
    const anywhere = [...draftRows, ...savedRows].some((r) => r.id === proposal.target_id)
    return anywhere ? null : (proposal.target_id as string)
  }
  if (proposal.operation !== 'update') return null
  const row = draftRows.find((r) => r.id === proposal.target_id)
  if (!row) return null
  const state = acceptedState(proposal, row.key, draftRows, savedRows)
  return state.state === 'saved' ? state.rowId : null
}
