import type {
  AarRecipient,
  ApproverKind,
  Capability,
  ExerciseLevel,
  NeedPriority,
  NeedSource,
  NeedsForm,
  NeedsTrigger,
  RegulatoryCatalog,
  RegulatoryFramework,
  Tlp,
  ValidationIssue,
  ValidationReport,
} from './types'

/** The needs form's ten sections, in the order they're shown -- `index`
 * is the backend's `ValidationIssue.section` (not the position: the
 * capabilities to evaluate come right after the triggers, before the
 * needs that refer to them); `key` is what `?step=` carries. */
export const NEEDS_STEPS = [
  { index: 0, key: 'document' },
  { index: 1, key: 'sponsorship' },
  { index: 2, key: 'triggers' },
  { index: 4, key: 'capabilities' },
  { index: 3, key: 'needs' },
  { index: 5, key: 'objectives' },
  { index: 6, key: 'scope' },
  { index: 7, key: 'constraints' },
  { index: 8, key: 'risks' },
  { index: 9, key: 'approval' },
] as const

export type NeedsStepKey = (typeof NEEDS_STEPS)[number]['key']

/** Read-only views derived from the saved form, listed after the sections. */
export const OUTPUT_STEPS = ['traceability', 'eeg'] as const
export type OutputStepKey = (typeof OUTPUT_STEPS)[number]

export const TLP_VALUES: readonly Tlp[] = ['clear', 'green', 'amber', 'amber_strict', 'red']
export const CAPABILITIES: readonly Capability[] = [
  'detection_triage_escalation',
  'incident_classification',
  'crisis_decision_making',
  'regulatory_notification',
  'internal_external_comms',
  'cross_unit_coordination',
  'third_party_supply_chain',
  'continuity_recovery',
  'legal_forensics',
]
/** The "Other" regulation: no catalog entry, described in free text. */
export const FRAMEWORK_OTHER = 'OTHER'

/** A framework id's label in the UI language ("RGPD / UK GDPR" in
 * Spanish); ids no framework has (the ISO standards some requirements
 * belong to) are already display names. */
export function frameworkLabel(
  catalog: RegulatoryCatalog | null,
  id: string,
  spanish: boolean,
): string {
  const framework: RegulatoryFramework | undefined = catalog?.frameworks.find((f) => f.id === id)
  if (!framework) return id
  return spanish ? framework.label_es : framework.label_en
}

export const TRIGGERS: readonly NeedsTrigger[] = [
  'regulatory',
  'annual_program',
  'new_or_revised_plan',
  'recent_incident',
  'pending_aar_actions',
  'new_threat',
  'audit_finding',
  'org_or_tech_change',
  'other',
]
export const LEVELS: readonly ExerciseLevel[] = ['strategic', 'tactical', 'operational']
export const AAR_RECIPIENTS: readonly AarRecipient[] = [
  'executive_committee',
  'crisis_committee',
  'board',
  'other',
]
export const NEED_SOURCES: readonly NeedSource[] = [
  'risk_analysis',
  'incident_history',
  'previous_aar',
  'recent_changes',
  'threat_intel',
  'regulatory',
  'other',
]
export const NEED_PRIORITIES: readonly NeedPriority[] = ['high', 'medium', 'low']
export const APPROVER_KINDS: readonly ApproverKind[] = ['sponsor', 'design_lead', 'compliance']

/** Mirrors the backend's V01 limits, so the UI can stop offering more
 * before a save is rejected. */
export const MAX_CAPABILITIES = 4
export const MAX_OBJECTIVES = 5

export interface NeedDraft {
  /** Existing row id, or null for a row not saved yet. */
  id: string | null
  /** How objectives refer to it: the id, or a temporary `new-N`. */
  key: string
  /** Shown code (NEED-01); empty until the backend assigns one. */
  code: string
  source: NeedSource
  title: string
  finding: string
  affected_capability: Capability
  priority: NeedPriority
}

/** How a need is named: its title, or -- before it had one -- its finding. */
export function needName(need: { title: string; finding: string }): string {
  return need.title.trim() || need.finding
}

/** How an objective is named in lists, references, headings and messages:
 * its title, or its statement while it has none (an older record). The
 * statement stays the full sentence it's rated against. */
export function objectiveName(objective: { title?: string; statement: string }): string {
  return objective.title?.trim() || objective.statement
}

export interface ObjectiveDraft {
  id: string | null
  key: string
  code: string
  title: string
  statement: string
  capability: Capability
  linked_need_keys: string[]
  success_criterion: string
  achieve_at_least: number | null
  time_box_minutes: number | null
  achieved_note: string
  partially_achieved: string
  not_achieved: string
  evidence: string
  regulatory_requirement_ids: string[]
}

export interface RiskDraft {
  id: string | null
  key: string
  risk: string
  mitigation: string
  owner: string
}

/** The editable part of the form, held by the page while the user moves
 * between steps; saved in one PUT. */
export interface NeedsFormDraft {
  tlp: Tlp
  document_date: string
  design_lead: string
  sponsor_name: string
  sponsor_role: string
  sponsor_motivation: string
  findings_closure_commitment: boolean
  findings_owner: string
  aar_recipient: AarRecipient | null
  aar_recipient_other: string
  triggers: NeedsTrigger[]
  regulatory_frameworks: string[]
  regulatory_framework_other: string
  trigger_other: string
  capabilities: Capability[]
  levels: ExerciseLevel[]
  participating_areas: string[]
  third_parties: string[]
  perimeter: string
  out_of_scope: string
  date_window_start: string
  date_window_end: string
  max_duration_hours: string
  key_participants_availability: string
  confidentiality_restrictions: string
  budget_and_external_support: string
  stop_exercise_keyword: string
  needs: NeedDraft[]
  objectives: ObjectiveDraft[]
  risks: RiskDraft[]
}

export function draftFromForm(form: NeedsForm): NeedsFormDraft {
  return {
    tlp: form.tlp,
    document_date: form.document_date,
    design_lead: form.design_lead,
    sponsor_name: form.sponsor_name,
    sponsor_role: form.sponsor_role,
    sponsor_motivation: form.sponsor_motivation,
    findings_closure_commitment: form.findings_closure_commitment,
    findings_owner: form.findings_owner,
    aar_recipient: form.aar_recipient,
    aar_recipient_other: form.aar_recipient_other,
    triggers: form.triggers,
    regulatory_frameworks: form.regulatory_frameworks,
    regulatory_framework_other: form.regulatory_framework_other,
    trigger_other: form.trigger_other,
    capabilities: form.capabilities,
    levels: form.levels,
    participating_areas: form.participating_areas,
    third_parties: form.third_parties,
    perimeter: form.perimeter,
    out_of_scope: form.out_of_scope,
    date_window_start: form.date_window_start ?? '',
    date_window_end: form.date_window_end ?? '',
    max_duration_hours: form.max_duration_hours === null ? '' : String(form.max_duration_hours),
    key_participants_availability: form.key_participants_availability,
    confidentiality_restrictions: form.confidentiality_restrictions,
    budget_and_external_support: form.budget_and_external_support,
    stop_exercise_keyword: form.stop_exercise_keyword,
    needs: form.needs.map((need) => ({
      id: need.id,
      key: need.id,
      code: need.code,
      source: need.source,
      title: need.title,
      finding: need.finding,
      affected_capability: need.affected_capability,
      priority: need.priority,
    })),
    objectives: form.objectives.map((objective) => ({
      id: objective.id,
      key: objective.id,
      code: objective.code,
      title: objective.title ?? '',
      statement: objective.statement,
      capability: objective.capability,
      linked_need_keys: objective.linked_need_ids,
      success_criterion: objective.success_criterion,
      // Defaults for a form read before these existed (a cached response).
      achieve_at_least: objective.achieve_at_least ?? null,
      time_box_minutes: objective.time_box_minutes ?? null,
      achieved_note: objective.achieved_note ?? '',
      partially_achieved: objective.partially_achieved ?? '',
      not_achieved: objective.not_achieved ?? '',
      evidence: objective.evidence,
      regulatory_requirement_ids: objective.regulatory_requirement_ids,
    })),
    risks: form.risks.map((risk) => ({ ...risk, key: risk.id })),
  }
}

/** The PUT body: the draft plus the revision it was based on. Empty
 * optional inputs become null. */
export function payloadFromDraft(draft: NeedsFormDraft, revision: number) {
  const hours = draft.max_duration_hours.trim()
  return {
    ...draft,
    revision,
    date_window_start: draft.date_window_start || null,
    date_window_end: draft.date_window_end || null,
    max_duration_hours: hours === '' ? null : Number(hours),
    needs: draft.needs.map(
      ({ id, key, source, title, finding, affected_capability, priority }) => ({
        id,
        key,
        source,
        title,
        finding,
        affected_capability,
        priority,
      }),
    ),
    objectives: draft.objectives.map((objective) => ({
      id: objective.id,
      // Names an unsaved row in the dry-run validation report.
      key: objective.key,
      title: objective.title,
      statement: objective.statement,
      capability: objective.capability,
      linked_need_keys: objective.linked_need_keys,
      success_criterion: objective.success_criterion,
      achieve_at_least: objective.achieve_at_least,
      time_box_minutes: objective.time_box_minutes,
      achieved_note: objective.achieved_note,
      partially_achieved: objective.partially_achieved,
      not_achieved: objective.not_achieved,
      evidence: objective.evidence,
      regulatory_requirement_ids: objective.regulatory_requirement_ids,
    })),
    risks: draft.risks.map(({ id, key, risk, mitigation, owner }) => ({
      id,
      key,
      risk,
      mitigation,
      owner,
    })),
  }
}

let newRowCounter = 0

/** A temporary key for a row not saved yet -- unique within the page. */
export function newRowKey(): string {
  newRowCounter += 1
  return `new-${newRowCounter}`
}

export function sameDraft(a: NeedsFormDraft, b: NeedsFormDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** Every blocking issue (ready + approved) of one section. */
export function sectionIssues(report: ValidationReport, section: number): ValidationIssue[] {
  return [...report.ready, ...report.approved].filter((issue) => issue.section === section)
}

/** The DOM id of a field, so the validation summary can focus it. Row
 * fields (a need's finding, an objective's evidence) are edited in a
 * dialog, opened by the step when asked to focus one of its rows. */
export function fieldDomId(field: string, itemId?: string | null): string {
  return itemId ? `needs-${field}-${itemId}` : `needs-${field}`
}

/** The draft that now matches the server after saving `sent`: the saved
 * values, ids and codes from `saved`, but the row keys (and objective
 * link order) of `sent`, so rows keep their identity on the page and the
 * next comparison with the draft isn't thrown off by keys changing. The
 * server keeps collections in the order they were sent. */
export function reconcileSaved(sent: NeedsFormDraft, saved: NeedsForm): NeedsFormDraft {
  const base = draftFromForm(saved)
  return {
    ...base,
    needs: base.needs.map((need, i) => ({ ...need, key: sent.needs[i]?.key ?? need.key })),
    objectives: base.objectives.map((objective, i) => ({
      ...objective,
      key: sent.objectives[i]?.key ?? objective.key,
      linked_need_keys: sent.objectives[i]?.linked_need_keys ?? objective.linked_need_keys,
    })),
    risks: base.risks.map((risk, i) => ({ ...risk, key: sent.risks[i]?.key ?? risk.key })),
  }
}

/** Gives rows the user created before a save landed the id and code the
 * server assigned them (matched by key), so the next save updates those
 * rows instead of creating them again. */
export function adoptSavedIds(draft: NeedsFormDraft, saved: NeedsFormDraft): NeedsFormDraft {
  function adopt<T extends { id: string | null; key: string }>(
    rows: T[],
    savedRows: (T & { code?: string })[],
  ): T[] {
    return rows.map((row) => {
      if (row.id) return row
      const match = savedRows.find((savedRow) => savedRow.key === row.key)
      return match
        ? { ...row, id: match.id, ...('code' in match ? { code: match.code } : {}) }
        : row
    })
  }
  return {
    ...draft,
    needs: adopt(draft.needs, saved.needs),
    objectives: adopt(draft.objectives, saved.objectives),
    risks: adopt(draft.risks, saved.risks),
  }
}

/** `value` if it is one of `values`, else `fallback` (a URL parameter). */
export function pick<T extends string>(values: readonly T[], value: string | null, fallback: T): T {
  return values.includes(value as T) ? (value as T) : fallback
}

/** Rows by code; new rows (no code yet) after the coded ones, in the order
 * added. */
export const byCode = (a: { code: string }, b: { code: string }) =>
  (a.code || '~').localeCompare(b.code || '~', undefined, { numeric: true })

/** The lines of a one-per-line text (the success criterion's conditions,
 * the evidence's items): non-blank, trimmed, without a closing "." or ";".
 * Mirrors the backend's services/objective_text.lines -- what the EEG
 * turns into points and a checklist. */
export function textLines(text: string): string[] {
  return text
    .split('\n')
    .map((line) =>
      line
        .trim()
        .replace(/[.;]+$/, '')
        .trim(),
    )
    .filter(Boolean)
}

// Mirrors services/objective_text.RATING_LEVEL.
const RATING_LEVEL =
  /^\s*(?:(?:fully|partially|not)\s+achieved|(?:parcialmente|totalmente)\s+(?:conseguido|logrado|alcanzado)|no\s+(?:se\s+)?(?:consigue|conseguido|logrado|alcanzado))[^:\n]*:/i

/** A line that says how to rate rather than what to observe ("Partially
 * achieved: …", a lead-in ending in ":"): rating guidance, not a
 * condition. */
export function isRatingLevel(line: string): boolean {
  const trimmed = line.trim()
  return RATING_LEVEL.test(trimmed) || trimmed.endsWith(':')
}

/** A condition that lists several in one line -- "Within 15 min: (1) a,
 * (2) b, and (3) c" -- split into its items, with the lead-in before
 * "(1)" apart. Null unless there are at least two numbered items. */
export function splitEnumerated(line: string): { lead: string; items: string[] } | null {
  const parts = line.split(/\(\d+\)\s*/)
  if (parts.length < 3) return null
  const [lead, ...rest] = parts
  const items = rest
    .map((item) =>
      item
        .trim()
        .replace(/[,;]\s*(?:and|y|e)?\s*$/i, '')
        .replace(/[.;]+$/, '')
        .trim(),
    )
    .filter(Boolean)
  if (items.length < 2) return null
  // Each item reads as a sentence of its own.
  return {
    lead: lead
      .trim()
      .replace(/[:,]\s*$/, '')
      .trim(),
    items: items.map((item) => item.charAt(0).toUpperCase() + item.slice(1)),
  }
}

// Mirror services/objective_text's level patterns.
const PARTIAL =
  /^\s*(?:partially\s+achieved|parcialmente\s+(?:conseguido|logrado|alcanzado))\s*:?\s*/i
const NOT =
  /^\s*(?:not\s+achieved|no\s+(?:se\s+)?(?:consigue|conseguido|logrado|alcanzado))\s*:?\s*/i

export type OutcomeLevel = 'achieved' | 'partial' | 'not'

/** Which outcome a rating line describes ("Partially achieved: …",
 * "Not achieved: …", a lead-in on what "achieved" takes), or null. */
export function classifyLevel(line: string): OutcomeLevel | null {
  if (PARTIAL.test(line)) return 'partial'
  if (NOT.test(line)) return 'not'
  return isRatingLevel(line) ? 'achieved' : null
}

/** The line without its "Partially achieved:" / "Not achieved:" prefix. */
export function stripLevel(line: string): string {
  const text = line.trim().replace(PARTIAL, '').replace(NOT, '').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
