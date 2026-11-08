import type {
  Capability,
  ContentLanguage,
  InjectAudience,
  InjectFamily,
  InjectStage,
  LocalizedText,
  Msel,
  MselInject,
  OrganizationInject,
  OrganizationInjectFields,
  SystemActor,
  SystemInject,
} from './types'

/** Catalog order, with each family's code (the <FAM> in INJ-<FAM>-NN). */
export const INJECT_FAMILIES: readonly { family: InjectFamily; code: string }[] = [
  { family: 'ransomware', code: 'RAN' },
  { family: 'data_breach', code: 'DBR' },
  { family: 'bec_fraud', code: 'BEC' },
  { family: 'phishing_account_takeover', code: 'PHI' },
  { family: 'supply_chain', code: 'SUP' },
  { family: 'cloud_compromise', code: 'CLD' },
  { family: 'ddos', code: 'DOS' },
  { family: 'insider', code: 'INS' },
  { family: 'wiper_destructive', code: 'WIP' },
  { family: 'ot_ics', code: 'ICS' },
  { family: 'physical_hybrid', code: 'HYB' },
  { family: 'regulatory', code: 'REG' },
  { family: 'generic', code: 'GEN' },
]

export const INJECT_STAGES: readonly InjectStage[] = [
  'detection',
  'escalation',
  'response',
  'recovery',
]

export const INJECT_AUDIENCES: readonly InjectAudience[] = ['executive', 'mixed', 'technical']

/** The languages TTX-Zone's injects exist in: the catalog requires both. */
export const SYSTEM_INJECT_LANGUAGES: readonly ContentLanguage[] = ['en', 'es']

export function localized(text: LocalizedText, spanish: boolean): string {
  return spanish ? text.es || text.en : text.en || text.es
}

/** A supported content language: the given one (an exercise's
 * `content_language`), else the UI's. */
export function contentLanguage(
  language: string | null | undefined,
  uiLanguage: string,
): ContentLanguage {
  const pick = language || uiLanguage
  return pick.startsWith('es') ? 'es' : 'en'
}

export interface InjectFilters {
  q: string
  family: string
  stage: string
  audience: string
}

/** Injects matching every filter: a family anywhere in its list, the
 * search against code, title and message in the UI language. */
export function filterInjects(
  items: SystemInject[],
  filters: InjectFilters,
  spanish: boolean,
): SystemInject[] {
  const query = filters.q.trim().toLowerCase()
  return items.filter(
    (inject) =>
      (!filters.family || inject.families.includes(filters.family as InjectFamily)) &&
      (!filters.stage || inject.stage === filters.stage) &&
      (!filters.audience || inject.audience === filters.audience) &&
      (!query ||
        [inject.id, localized(inject.title, spanish), localized(inject.content, spanish)].some(
          (text) => text.toLowerCase().includes(query),
        )),
  )
}

/** A text split into plain runs and {variable} names, for rendering the
 * variables apart. */
export function splitVariables(text: string): { text: string; variable: boolean }[] {
  return text
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => {
      const match = /^\{(\w+)\}$/.exec(part)
      return match ? { text: match[1], variable: true } : { text: part, variable: false }
    })
}

/** Variables that describe the organization: no default value, filled
 * per exercise. Every other {variable} is a scenario one. */
export const SYSTEM_VARIABLES: ReadonlySet<string> = new Set([
  'organization',
  'organization_short',
  'sector',
  'country',
  'critical_service',
  'critical_system',
  'data_type',
  'supplier',
  'customer',
  'product',
  'location',
])

export function templateTexts(fields: OrganizationInjectFields): string[] {
  return [
    fields.title,
    fields.content,
    fields.trigger_condition,
    fields.contingent_purpose,
    fields.key_question,
    fields.facilitator_notes,
    fields.poll_question,
    ...fields.poll_options,
    ...fields.poll_outcomes,
    ...fields.recipients,
    ...fields.attachment_notes,
    ...fields.expected_actions.flatMap((a) => [a.description, a.responsible_role]),
  ]
}

/** Every {variable} the texts use, in first-use order. */
export function variablesIn(texts: string[]): string[] {
  const names: string[] = []
  for (const text of texts) {
    for (const match of text.matchAll(/\{(\w+)\}/g)) {
      if (!names.includes(match[1])) names.push(match[1])
    }
  }
  return names
}

export function emptyInjectFields(
  language: ContentLanguage | null = null,
): OrganizationInjectFields {
  return {
    language,
    format: 'inject',
    poll_question: '',
    poll_options: [],
    poll_outcomes: [],
    title: '',
    content: '',
    kind: 'mandatory',
    trigger_condition: '',
    contingent_purpose: '',
    actor_name: '',
    actor_type: 'other',
    actor_origin: null,
    actor_origin_id: null,
    delivery_method: 'email',
    recipients: [],
    expected_actions: [],
    attachment_notes: [],
    key_question: '',
    facilitator_notes: '',
    families: [],
    stage: 'response',
    audience: 'mixed',
    capabilities: [],
    attack_version: '',
    attack: [],
    frameworks: [],
    variable_defaults: {},
    origin: null,
    origin_id: null,
    origin_name: null,
  }
}

/** A copy of a TTX-Zone inject (bilingual) in one language: the
 * exercise's when it goes into one, else the UI's. */
export function fromSystemInject(
  inject: SystemInject,
  language: ContentLanguage,
  attackVersion: string,
  actors: SystemActor[],
): OrganizationInjectFields {
  const spanish = language === 'es'
  const l = (text: LocalizedText | null) => (text ? localized(text, spanish) : '')
  const actor = actors.find((a) => a.id === inject.actor)
  return {
    language,
    format: 'inject',
    poll_question: '',
    poll_options: [],
    poll_outcomes: [],
    title: l(inject.title),
    content: l(inject.content),
    kind: inject.kind,
    trigger_condition: l(inject.trigger),
    contingent_purpose: l(inject.purpose),
    actor_name: actor ? (spanish ? actor.name_es : actor.name_en) : inject.actor,
    actor_type: actor?.type ?? 'other',
    actor_origin: 'system',
    actor_origin_id: inject.actor,
    delivery_method: inject.delivery_method,
    recipients: inject.recipients.map(l),
    expected_actions: inject.expected_actions.map((a) => ({
      description: l(a.description),
      responsible_role: l(a.responsible_role),
      within_minutes: a.within_minutes,
    })),
    attachment_notes: inject.attachments.map(l),
    key_question: l(inject.key_question),
    facilitator_notes: l(inject.facilitator_notes),
    families: [...inject.families],
    stage: inject.stage,
    audience: inject.audience,
    capabilities: [...inject.capabilities],
    attack_version: attackVersion,
    attack: inject.attack.map((a) => ({ ...a, domain: a.domain as 'enterprise' | 'ics' })),
    frameworks: [...inject.frameworks],
    variable_defaults: Object.fromEntries(
      Object.entries(inject.variable_defaults).map(([name, value]) => [name, l(value)]),
    ),
    origin: 'system',
    origin_id: inject.id,
    origin_name: l(inject.title),
  }
}

export function fromOrganizationInject(inject: OrganizationInject): OrganizationInjectFields {
  const { id, created_at: _created, updated_at: _updated, ...fields } = inject
  void _created
  void _updated
  return { ...fields, origin: 'organization', origin_id: id, origin_name: inject.title }
}

/** The stage an MSEL phase stands for, by its place in the timeline. */
function stageOfPhase(msel: Msel, phaseId: string | null): InjectStage {
  const index = msel.phases.findIndex((p) => p.id === phaseId)
  if (index <= 0) return 'detection'
  if (index === msel.phases.length - 1) return 'recovery'
  return index === 1 ? 'escalation' : 'response'
}

/** An MSEL inject as a library template: session minutes back to scenario
 * minutes, its objectives' capabilities, its sender described. */
export function fromExerciseInject(
  inject: MselInject,
  msel: Msel,
  language: ContentLanguage | null = null,
): OrganizationInjectFields {
  const actor = msel.actors.find((a) => a.id === inject.simulated_actor_id)
  const capabilities = [
    ...new Set(
      msel.needs.objectives
        .filter((o) => inject.objective_ids.includes(o.id))
        .map((o) => o.capability as Capability),
    ),
  ]
  return {
    ...emptyInjectFields(language),
    format: inject.format ?? 'inject',
    poll_question: inject.poll_question ?? '',
    poll_options: inject.poll_options ?? [],
    poll_outcomes: inject.poll_outcomes ?? [],
    title: inject.title,
    content: inject.content,
    kind: inject.kind,
    trigger_condition: inject.trigger_condition,
    contingent_purpose: inject.contingent_purpose,
    actor_name: actor?.name ?? '',
    actor_type: actor?.type ?? 'other',
    actor_origin: actor?.origin === 'system' ? 'system' : null,
    actor_origin_id: actor?.origin === 'system' ? (actor.origin_id ?? null) : null,
    delivery_method: inject.delivery_method,
    recipients: [...inject.recipients],
    expected_actions: inject.expected_actions.map((a) => ({
      description: a.description,
      responsible_role: a.responsible_role,
      within_minutes:
        a.expected_within_minutes === null
          ? null
          : a.expected_within_minutes * msel.time_compression,
    })),
    attachment_notes: [...inject.attachment_notes],
    facilitator_notes: inject.facilitator_notes,
    stage: stageOfPhase(msel, inject.phase_id),
    capabilities,
    attack_version: msel.attack_version,
    attack: inject.attack_techniques,
    origin: 'exercise',
    origin_id: inject.id,
    origin_name: inject.title,
  }
}

/** A duplicate: the same inject under the `_copy` suffix, so it never
 * reads as the original (same rule as actors). */
export function asDuplicate(fields: OrganizationInjectFields): OrganizationInjectFields {
  return { ...fields, title: `${fields.title}_copy` }
}

/** Replace each {variable} that has a (non-blank) value; the rest stay. */
export function fillVariables(text: string, values: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => values[name]?.trim() || whole)
}

/** The MSEL phase a template's stage proposes: detection the first,
 * escalation the second, recovery the last, response in between. */
export function proposedPhaseIndex(stage: InjectStage, phaseCount: number): number {
  if (phaseCount === 0) return -1
  const index = { detection: 0, escalation: 1, response: 2, recovery: phaseCount - 1 }[stage]
  return Math.min(index, phaseCount - 1)
}

/** Scenario minutes as MSEL (session) minutes: each session minute
 * represents `compression` scenario minutes. */
export function toSessionMinutes(
  scenarioMinutes: number | null,
  compression: number,
): number | null {
  if (scenarioMinutes === null) return null
  return Math.min(1440, Math.max(1, Math.ceil(scenarioMinutes / Math.max(1, compression))))
}

export interface ExerciseInjectInput {
  phase_id: string
  objective_ids: string[]
  offset_minutes: number | null
  kind: OrganizationInjectFields['kind']
  format: OrganizationInjectFields['format']
  poll_question: string
  poll_options: string[]
  poll_outcomes: string[]
  title: string
  content: string
  trigger_condition: string
  contingent_purpose: string
  sender: {
    name: string
    type: OrganizationInjectFields['actor_type']
    origin: OrganizationInjectFields['actor_origin']
    origin_id: string | null
  } | null
  recipients: string[]
  delivery_method: OrganizationInjectFields['delivery_method']
  attachment_notes: string[]
  attack_techniques: { domain: string; tactic_id: string; technique_id: string }[]
  /** Whose activity the techniques are; left out, the scenario's first
   * threat actor. */
  attack_attribution?: 'threat_actor' | 'noise'
  threat_actor_id?: string | null
  facilitator_notes: string
  expected_actions: {
    description: string
    responsible_role: string
    expected_within_minutes: number | null
  }[]
  origin: OrganizationInjectFields['origin']
  origin_id: string | null
  origin_name: string | null
  /** The copy's language (its illustrations come in it). */
  language?: ContentLanguage
}

/** POST /ttx/{id}/msel/injects for a template: variables filled in, the
 * key question kept in the facilitator notes (MSEL injects have no field
 * for it), deadlines in session minutes. */
export function toExerciseInject(
  fields: OrganizationInjectFields,
  choices: { phaseId: string; objectiveIds: string[]; offset: number | null },
  values: Record<string, string>,
  compression: number,
  keyQuestionLabel: string,
): ExerciseInjectInput {
  const fill = (text: string) => fillVariables(text, values)
  const question = fill(fields.key_question).trim()
  const notes = fill(fields.facilitator_notes).trim()
  return {
    phase_id: choices.phaseId,
    objective_ids: choices.objectiveIds,
    offset_minutes: fields.kind === 'mandatory' ? choices.offset : null,
    kind: fields.kind,
    format: fields.format,
    poll_question: fill(fields.poll_question),
    poll_options: fields.poll_options.map(fill),
    poll_outcomes: fields.poll_outcomes.map(fill),
    title: fill(fields.title).slice(0, 255),
    content: fill(fields.content),
    trigger_condition: fill(fields.trigger_condition),
    contingent_purpose: fill(fields.contingent_purpose),
    sender: fields.actor_name.trim()
      ? {
          name: fields.actor_name.trim(),
          type: fields.actor_type,
          origin: fields.actor_origin,
          origin_id: fields.actor_origin_id,
        }
      : null,
    recipients: fields.recipients.map(fill),
    delivery_method: fields.delivery_method,
    attachment_notes: fields.attachment_notes.map(fill),
    attack_techniques: fields.attack.map(({ domain, tactic_id, technique_id }) => ({
      domain,
      tactic_id,
      technique_id,
    })),
    facilitator_notes: [notes, question ? `${keyQuestionLabel}: ${question}` : '']
      .filter(Boolean)
      .join('\n\n'),
    expected_actions: fields.expected_actions.map((a) => ({
      description: fill(a.description),
      responsible_role: fill(a.responsible_role),
      expected_within_minutes: toSessionMinutes(a.within_minutes, compression),
    })),
    origin: fields.origin,
    origin_id: fields.origin_id,
    origin_name: fields.origin_name,
    // A TTX-Zone inject's illustrations come along in this language.
    ...(fields.language ? { language: fields.language } : {}),
  }
}
