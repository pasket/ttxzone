import type {
  AbsenceFallback,
  ConductPrep,
  ConductPrepEegPoint,
  FindingKind,
  FindingSource,
  SessionModality,
  ValidationReport,
} from './types'

/** The page's steps (`?step=`); `index` is a ValidationIssue's `section`
 * (backend: ttx_conduct_prep_service). */
export const CONDUCT_STEPS = [
  { index: 1, key: 'evaluation' },
  { index: 2, key: 'validation' },
  { index: 3, key: 'session' },
  { index: 4, key: 'documents' },
  { index: 5, key: 'review' },
] as const

export type ConductStepKey = (typeof CONDUCT_STEPS)[number]['key']

/** The step a `?step=` value names (the first one when unknown). */
export function conductStep(param: string | null) {
  return CONDUCT_STEPS.find((item) => item.key === param) ?? CONDUCT_STEPS[0]
}

// Mirrors the backend's vocabularies (schemas/ttx_conduct_prep.py).
export const DATA_COLLECTION_METHODS = [
  'direct_observation',
  'decision_timeline',
  'communications_log',
  'observation_notes',
  'document_review',
  'feedback_forms',
  'interviews',
  'hot_wash',
  'other',
] as const
export const BRIEFING_ITEMS = [
  'objectives',
  'eeg',
  'msel',
  'non_intervention',
  'data_collection',
  'logistics',
] as const
export const LOGISTICS_ITEMS = [
  'room_booked',
  'av_equipment',
  'connectivity_tested',
  'materials_printed',
  'real_vs_simulated',
  'attendance_list',
] as const
export const DOCUMENT_KINDS = [
  'sitman',
  'facilitator_guide',
  'inject_cards',
  'eeg',
  'evaluation_plan',
  'feedback_form',
] as const
export const CALENDAR_FIELDS = [
  'hot_wash_days',
  'debrief_days',
  'ratings_due_days',
  'draft_aar_days',
  'after_action_meeting_days',
] as const
export const RATING_LEVELS = ['p', 's', 'm', 'u'] as const
export const FINDING_KINDS: FindingKind[] = [
  'ambiguous_inject',
  'overloaded_phase',
  'unrealistic_timing',
  'other',
]
export const FINDING_SOURCES: FindingSource[] = ['design_review', 'planning_meeting', 'dry_run']
export const MODALITIES: SessionModality[] = ['in_person', 'remote', 'hybrid']
export const FALLBACKS: AbsenceFallback[] = ['substitute', 'postpone', 'proceed']

/** Rows created in the draft carry a client `key` until the server gives
 * them an id (stripped from the payload). */
interface Keyed {
  id: string | null
  key?: string
}

/** An observation point being edited. Seeded points keep their (read-only)
 * source fields; a new one is custom. */
export type DraftPoint = Keyed &
  Omit<ConductPrepEegPoint, 'id' | 'source_status'> & {
    source_status: ConductPrepEegPoint['source_status']
  }

export interface DraftEeg {
  id: string
  points: DraftPoint[]
}

export type DraftEvaluator = Keyed & {
  user_id: string
  areas: string[]
  briefed: boolean
  objective_ids: string[]
}

export type DraftFinding = Keyed & {
  kind: FindingKind
  found_in: FindingSource
  description: string
  inject_id: string | null
  phase_id: string | null
  resolved: boolean
}

export type DraftAttendee = Keyed & {
  /** A Player of the exercise, or null for someone added by hand. */
  user_id: string | null
  name: string
  role: string
  confirmed: boolean
  fallback: AbsenceFallback | null
  substitute: string
}

const SCALARS = [
  'data_collection_methods',
  'data_collection_other',
  'log_keeper_id',
  'briefing_date',
  'briefing_checklist',
  'briefing_notes',
  'briefed_controller_ids',
  'hot_wash_days',
  'debrief_days',
  'ratings_due_days',
  'draft_aar_days',
  'after_action_meeting_days',
  'fpm_date',
  'fpm_done',
  'fpm_attendees',
  'fpm_notes',
  'dry_run_date',
  'dry_run_done',
  'session_date',
  'session_time',
  'timezone',
  'modality',
  'venue',
  'room',
  'meeting_link',
  'session_notes',
  'invitation_sent_on',
  'invitation_text',
  'logistics_checklist',
  'documents_reviewed',
  'stop_procedure',
] as const

type Scalars = Pick<ConductPrep, (typeof SCALARS)[number]>

export type ConductPrepDraft = Scalars & {
  eeg: DraftEeg[]
  evaluators: DraftEvaluator[]
  findings: DraftFinding[]
  attendees: DraftAttendee[]
}

export function draftFromPrep(prep: ConductPrep): ConductPrepDraft {
  const scalars = Object.fromEntries(SCALARS.map((field) => [field, prep[field]])) as Scalars
  return {
    ...scalars,
    eeg: prep.eeg.map((o) => ({ id: o.id, points: o.points.map((p) => ({ ...p })) })),
    evaluators: prep.evaluators.map(({ id, user_id, areas, briefed, objective_ids }) => ({
      id,
      user_id,
      areas,
      briefed,
      objective_ids,
    })),
    findings: prep.findings.map((f) => ({ ...f })),
    attendees: prep.attendees.map((a) => ({ ...a })),
  }
}

function withoutKey<T extends Keyed>(row: T) {
  const rest = { ...row }
  delete rest.key
  return rest
}

export function payloadFromDraft(draft: ConductPrepDraft, revision: number) {
  return {
    revision,
    ...Object.fromEntries(SCALARS.map((field) => [field, draft[field]])),
    eeg: draft.eeg.map((o) => ({
      id: o.id,
      points: o.points.map((p) => ({
        id: p.id,
        text: p.text,
        criteria_p: p.criteria_p,
        criteria_s: p.criteria_s,
        criteria_m: p.criteria_m,
        criteria_u: p.criteria_u,
      })),
    })),
    evaluators: draft.evaluators.map(withoutKey),
    findings: draft.findings.map(withoutKey),
    attendees: draft.attendees.map(withoutKey),
  }
}

export function samePrepDraft(a: ConductPrepDraft, b: ConductPrepDraft): boolean {
  return JSON.stringify(payloadFromDraft(a, 0)) === JSON.stringify(payloadFromDraft(b, 0))
}

/** Rows the user created while a save was in flight keep their edits;
 * rows that were in the save adopt the ids the server gave them (it keeps
 * the payload's order, so the n-th sent row is the n-th saved one). */
export function adoptSavedIds(
  current: ConductPrepDraft,
  sent: ConductPrepDraft,
  saved: ConductPrepDraft,
): ConductPrepDraft {
  function ids<T extends Keyed>(sentRows: T[], savedRows: Keyed[]) {
    const byKey = new Map<string, string>()
    sentRows.forEach((row, index) => {
      const id = savedRows[index]?.id
      if (row.key && !row.id && id) byKey.set(row.key, id)
    })
    return byKey
  }
  function adopt<T extends Keyed>(rows: T[], byKey: Map<string, string>): T[] {
    return rows.map((row) =>
      row.key && !row.id && byKey.has(row.key) ? { ...row, id: byKey.get(row.key)! } : row,
    )
  }
  return {
    ...current,
    eeg: current.eeg.map((o) => {
      const sentEeg = sent.eeg.find((e) => e.id === o.id)
      const savedEeg = saved.eeg.find((e) => e.id === o.id)
      if (!sentEeg || !savedEeg) return o
      return { ...o, points: adopt(o.points, ids(sentEeg.points, savedEeg.points)) }
    }),
    evaluators: adopt(current.evaluators, ids(sent.evaluators, saved.evaluators)),
    findings: adopt(current.findings, ids(sent.findings, saved.findings)),
    attendees: adopt(current.attendees, ids(sent.attendees, saved.attendees)),
  }
}

/** The saved plan with the keys its points had in the draft that was sent
 * (by position: the server keeps the payload's order), so whatever named
 * a new point by its key -- an accepted AI proposal -- still finds it. */
export function keepPointKeys(saved: ConductPrepDraft, sent: ConductPrepDraft): ConductPrepDraft {
  return {
    ...saved,
    eeg: saved.eeg.map((o) => {
      const sentEeg = sent.eeg.find((e) => e.id === o.id)
      if (!sentEeg) return o
      return {
        ...o,
        points: o.points.map((p, i) =>
          sentEeg.points[i]?.key ? { ...p, key: sentEeg.points[i].key } : p,
        ),
      }
    }),
  }
}

let keySeed = 0
export function newKey(): string {
  keySeed += 1
  return `new-${Date.now().toString(36)}-${keySeed}`
}

export function newAttendee(userId: string | null = null, name = ''): DraftAttendee {
  return {
    id: null,
    key: newKey(),
    user_id: userId,
    name,
    role: '',
    confirmed: false,
    fallback: null,
    substitute: '',
  }
}

export function newPoint(): DraftPoint {
  return {
    id: null,
    key: newKey(),
    kind: 'custom',
    text: '',
    criteria_p: '',
    criteria_s: '',
    criteria_m: '',
    criteria_u: '',
    source_text: '',
    source_action_id: null,
    source_action_code: '',
    source_inject_code: '',
    source_inject_title: '',
    responsible_role: '',
    expected_within_minutes: null,
    source_requirement_id: '',
    source_status: 'custom',
  }
}

/** A row as the report names it: its id once saved; a draft row has no
 * name in a report yet (the dry run names it by a temporary id). */
export function rowId(row: Keyed): string {
  return row.id ?? row.key ?? ''
}

/** DOM id of a field, for focusing it from the issue summary. */
export function conductFieldId(field: string, itemId?: string | null): string {
  return itemId ? `cp-${field}-${itemId}` : `cp-${field}`
}

export function stepIssues(report: ValidationReport, section: number) {
  return report.ready.filter((issue) => issue.section === section)
}

export function stepWarnings(report: ValidationReport, section: number) {
  return report.warnings.filter((issue) => issue.section === section)
}

/** Formats an ISO date (YYYY-MM-DD) for display in the user's language. */
/** A calendar milestone's date: `days` after the session (ISO dates). */
export function deadlineDate(sessionDate: string | null, days: number): string | null {
  if (!sessionDate) return null
  const [year, month, day] = sessionDate.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function formatDay(value: string | null, language: string): string {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  )
}

export function emptyEvaluator(userId: string): DraftEvaluator {
  return { id: null, user_id: userId, areas: [], briefed: false, objective_ids: [] }
}

/** Change one Evaluator's row of the plan (created on first change). */
export function patchEvaluator(
  draft: ConductPrepDraft,
  update: (patch: Partial<ConductPrepDraft>) => void,
  userId: string,
  change: Partial<DraftEvaluator>,
) {
  const existing = draft.evaluators.find((e) => e.user_id === userId)
  update({
    evaluators: existing
      ? draft.evaluators.map((e) => (e.user_id === userId ? { ...e, ...change } : e))
      : [...draft.evaluators, { ...emptyEvaluator(userId), ...change }],
  })
}
