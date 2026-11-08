import { API_BASE } from './api'
import { codeRefText } from './codeRef'
import type {
  ActorOrigin,
  ActorType,
  AttackAttribution,
  InjectArtifact,
  AttackCatalog,
  AttackRef,
  Capability,
  DeliveryMethod,
  InjectKind,
  InjectReviewStatus,
  Msel,
  ThreatActorTechnique,
  ValidationIssue,
  ValidationReport,
  InjectFormat,
} from './types'

/** Techniques one inject may name (the backend's MAX_INJECT_TECHNIQUES). */
export const MAX_INJECT_TECHNIQUES = 20
/** Threat actors behind one scenario (the backend's MAX_THREAT_ACTORS). */
export const MAX_THREAT_ACTORS = 5

/** One (domain, tactic, technique) selection, as a string key. */
export function attackKey(ref: Pick<AttackRef, 'domain' | 'tactic_id' | 'technique_id'>): string {
  return `${ref.domain}|${ref.tactic_id}|${ref.technique_id}`
}

/** What the API stores of a ref: ids only, names come from the release. */
export function attackRefPayload({ domain, tactic_id, technique_id }: AttackRef) {
  return { domain, tactic_id, technique_id }
}

/** attack.mitre.org's permanent page for that release (e.g. v19), so the
 * link shows what the MSEL was written against, not today's text. */
export function attackUrl(version: string, techniqueId: string): string {
  const major = version.split('.')[0]
  return `https://attack.mitre.org/versions/v${major}/techniques/${techniqueId.replace('.', '/')}/`
}

/** Refs grouped by domain then tactic, tactics in matrix order (as the
 * release lists them; appearance order while it hasn't loaded). */
export function groupByTactic(
  refs: AttackRef[],
  catalog: AttackCatalog | null,
): {
  key: string
  domain: AttackRef['domain']
  tacticId: string
  tacticName: string
  refs: AttackRef[]
}[] {
  const order = new Map<string, number>()
  catalog?.domains.forEach((domain, d) =>
    domain.tactics.forEach((tactic, t) => order.set(`${domain.domain}|${tactic.id}`, d * 100 + t)),
  )
  const groups = new Map<string, AttackRef[]>()
  for (const ref of refs) {
    const key = `${ref.domain}|${ref.tactic_id}`
    groups.set(key, [...(groups.get(key) ?? []), ref])
  }
  return [...groups.entries()]
    .map(([key, grouped], index) => ({
      key,
      domain: grouped[0].domain,
      tacticId: grouped[0].tactic_id,
      tacticName: grouped[0].tactic_name,
      refs: grouped,
      rank: order.get(key) ?? 10_000 + index,
    }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ key, domain, tacticId, tacticName, refs }) => ({
      key,
      domain,
      tacticId,
      tacticName,
      refs,
    }))
}

/** The MSEL page's tabs, in order -- `index` matches the backend's
 * `ValidationIssue.section` (1-6; 4, once the timeline tab, is the threat
 * actors' now). `review`
 * holds the status actions and, below them, the load by recipient (section
 * 6, a tab of its own until it turned out to be something to check before
 * submitting, not something to edit). `key` is what `?tab=` carries. */
export const MSEL_TABS = [
  { index: 1, key: 'scenario' },
  // Second: who is behind the attack shapes the injects (their ATT&CK
  // techniques are attributed to them); optional.
  { index: 4, key: 'threats' },
  { index: 2, key: 'phases' },
  { index: 3, key: 'injects' },
  { index: 5, key: 'coverage' },
  { index: 6, key: 'review' },
] as const

export type MselTabKey = (typeof MSEL_TABS)[number]['key']

/** Warnings the backend lists under one tab but that are fixed by writing
 * injects (an unused threat actor, a phase with no mandatory inject, a recipient
 * swamped): shown in Injects, where something can be done about them --
 * never as a note in a tab with nothing to do -- with the Injects filter
 * that shows what they're about. */
const FIXED_IN_INJECTS: Partial<Record<string, InjectFilterKey>> = {
  THREAT_ACTOR_WITHOUT_INJECTS: 'attack',
  PHASE_WITHOUT_MANDATORY: 'phase',
  RECIPIENT_OVERLOAD: 'recipient',
  ROOM_WITHOUT_INJECTS: 'room',
}

const INJECTS_SECTION = 3

/** The report as the page shows it: those warnings moved to Injects. */
export function relocateIssues(report: ValidationReport): ValidationReport {
  return {
    ...report,
    warnings: report.warnings.map((issue) =>
      issue.code in FIXED_IN_INJECTS ? { ...issue, section: INJECTS_SECTION } : issue,
    ),
  }
}

/** The Injects filter a relocated warning opens on (its phase, threat
 * actor or recipient), or null. */
export function issueInjectFilter(issue: Pick<ValidationIssue, 'code'>): InjectFilterKey | null {
  return FIXED_IN_INJECTS[issue.code] ?? null
}

/** Warnings of one tab (they never block). */
export function tabWarnings(report: ValidationReport, section: number): ValidationIssue[] {
  return report.warnings.filter((issue) => issue.section === section)
}

export const ACTOR_TYPES: readonly ActorType[] = [
  'soc',
  'csirt',
  'authority',
  'media',
  'supplier',
  'customer',
  'threat_actor',
  'internal',
  'other',
]
export const DELIVERY_METHODS: readonly DeliveryMethod[] = [
  'email',
  'phone',
  'chat',
  'ticket',
  'security_tool',
  'in_person',
  'briefing',
  'media',
  'document',
]
export const MAX_PHASES = 8
export const MAX_INJECTS = 40
export const MAX_EXPECTED_ACTIONS = 8

export interface ActorDraft {
  /** Saved row id, or null for a row not saved yet. */
  id: string | null
  /** How injects refer to it: the id, or a temporary `new-N`. */
  key: string
  code: string
  name: string
  type: ActorType
  description: string
  channel: DeliveryMethod | null
  origin: ActorOrigin
  origin_id: string | null
  origin_name: string | null
  played_by: string
}

export interface PhaseDraft {
  id: string | null
  key: string
  code: string
  name: string
  /** One line the table sees once the phase begins (≤ 80). */
  headline: string
  start_offset: number
  end_offset: number
  /** Incident time that passes before this phase ("48 h later"), on top
   * of the time compression. Meaningless for a phase at T+0. */
  incident_jump_minutes: number
  situation_update: string
  key_questions: string[]
  objective_ids: string[]
  /** The objectives due by the end of this phase (a subset of
   * `objective_ids`): their deadline, shown in the EEG. */
  due_objective_ids: string[]
}

export interface ActionDraft {
  id: string | null
  key: string
  code: string
  description: string
  responsible_role: string
  expected_within_minutes: number | null
  /** A subset of the inject's `objective_ids`. */
  objective_ids: string[]
}

export interface InjectDraft {
  id: string | null
  key: string
  code: string
  phase_key: string
  kind: InjectKind
  title: string
  content: string
  offset_minutes: number | null
  trigger_condition: string
  contingent_purpose: string
  /** Contingent only: when the facilitator checks whether to fire it, in
   * minutes after its phase starts (null: its trigger action's window). */
  fires_at_minute: number | null
  /** What it is: anything but an inject evaluates nothing, and a poll has
   * a question and options instead of expected actions. */
  format: InjectFormat
  poll_question: string
  poll_options: string[]
  /** What follows each option, by position. */
  poll_outcomes: string[]
  /** What each option adds to the meters: meter key -> level. */
  poll_impacts: Record<string, number>[]
  /** Contingent injects only -- where the branch leaves the storyline (an
   * inject's key, and optionally one of its expected actions' key) and
   * the mandatory inject where it comes back. */
  branch_from_key: string | null
  branch_action_key: string | null
  rejoin_key: string | null
  actor_key: string | null
  /** Whose activity its techniques are (null: no ATT&CK); the threat
   * actor's key when it's one. */
  attack_attribution: AttackAttribution | null
  threat_actor_key: string | null
  recipients: string[]
  /** The rooms it's played in (ids); empty: all of them. */
  room_ids: string[]
  delivery_method: DeliveryMethod
  attachment_notes: string[]
  attack_techniques: AttackRef[]
  facilitator_notes: string
  /** Shown to the table as a simulated email, press release… (null: text). */
  artifact: InjectArtifact | null
  review_status: InjectReviewStatus
  /** Who validated it, as the server stamped it (the page fills in the
   * user who marks it validated meanwhile); the id is what the save sends
   * back: unchanged keeps it, the user's own takes it over. */
  validated_by: string
  validated_by_id: string | null
  objective_ids: string[]
  expected_actions: ActionDraft[]
  /** Images shown with it, in order (uploaded first, linked by the save);
   * width/height only to lay out a preview. */
  images: InjectImageDraft[]
  /** Files the players download with it, in order (uploaded first,
   * linked by the save). */
  files: InjectFileDraft[]
}

export interface InjectImageDraft {
  image_id: string
  caption: string
  width: number
  height: number
}

export interface InjectFileDraft {
  file_id: string
  name: string
  size_bytes: number
  sha256: string
  description: string
}

/** The API path an inject file downloads from (through `apiDownload`). */
export function mselFilePath(ttxId: string, fileId: string): string {
  return `/ttx/${ttxId}/msel/files/${fileId}`
}

/** The URL an inject image is served at (same origin, with the session). */
export function mselImageUrl(ttxId: string, imageId: string): string {
  return `${API_BASE}/ttx/${ttxId}/msel/images/${imageId}`
}

/** A threat actor behind the scenario, as the page edits it. */
export interface ThreatActorDraft {
  id: string | null
  /** How injects attribute to it: the id, or a temporary `new-N`. */
  key: string
  code: string
  name: string
  mitre_group_id: string | null
  aliases: string[]
  description: string
  techniques: ThreatActorTechnique[]
  origin: ActorOrigin
  origin_id: string | null
  origin_name: string | null
  /** Read-only, from the server: when it last changed (null: never). */
  modified_at: string | null
}

/** The editable part of the MSEL, held by the page across tabs and saved
 * in one PUT. */
export interface MselDraft {
  title: string
  summary: string
  /** "HH:MM", or "" when not set. */
  exercise_start: string
  /** When the incident starts inside the fiction, "HH:MM" or "". */
  incident_start: string
  /** The scene's date, "YYYY-MM-DD" or "". */
  incident_date: string
  duration_minutes: number | null
  time_compression: number
  /** The impact meters the polls add up on. */
  meters: { key: string; name: string }[]
  threat_actors: ThreatActorDraft[]
  actors: ActorDraft[]
  phases: PhaseDraft[]
  injects: InjectDraft[]
}

export function draftFromMsel(msel: Msel): MselDraft {
  return {
    title: msel.title,
    summary: msel.summary,
    exercise_start: msel.exercise_start ? msel.exercise_start.slice(0, 5) : '',
    incident_start: msel.incident_start ? msel.incident_start.slice(0, 5) : '',
    incident_date: msel.incident_date ?? '',
    duration_minutes: msel.duration_minutes,
    time_compression: msel.time_compression,
    meters: msel.meters ?? [],
    threat_actors: (msel.threat_actors ?? []).map((actor) => ({
      ...actor,
      key: actor.id,
      modified_at: actor.modified_at ?? null,
      techniques: actor.techniques.map(({ domain, technique_id }) => ({ domain, technique_id })),
    })),
    actors: msel.actors.map((actor) => ({ ...actor, key: actor.id })),
    phases: msel.phases.map((phase) => ({
      ...phase,
      key: phase.id,
      headline: phase.headline ?? '',
      due_objective_ids: phase.due_objective_ids ?? [],
    })),
    injects: msel.injects.map((inject) => ({
      id: inject.id,
      key: inject.id,
      code: inject.code,
      phase_key: inject.phase_id ?? '',
      kind: inject.kind,
      title: inject.title,
      content: inject.content,
      offset_minutes: inject.offset_minutes,
      trigger_condition: inject.trigger_condition,
      contingent_purpose: inject.contingent_purpose,
      fires_at_minute: inject.fires_at_minute ?? null,
      format: inject.format ?? 'inject',
      poll_question: inject.poll_question ?? '',
      poll_options: inject.poll_options ?? [],
      poll_outcomes: inject.poll_outcomes ?? [],
      poll_impacts: inject.poll_impacts ?? [],
      branch_from_key: inject.branch_from_id,
      branch_action_key: inject.branch_action_id,
      rejoin_key: inject.rejoin_inject_id,
      actor_key: inject.simulated_actor_id,
      attack_attribution: inject.attack_attribution ?? null,
      threat_actor_key: inject.threat_actor_id ?? null,
      recipients: inject.recipients,
      room_ids: inject.room_ids ?? [],
      delivery_method: inject.delivery_method,
      attachment_notes: inject.attachment_notes,
      attack_techniques: inject.attack_techniques,
      facilitator_notes: inject.facilitator_notes,
      artifact: inject.artifact ?? null,
      review_status: inject.review_status,
      validated_by: inject.validated_by,
      validated_by_id: inject.validated_by_id ?? null,
      objective_ids: inject.objective_ids,
      expected_actions: inject.expected_actions.map((action) => ({ ...action, key: action.id })),
      images: (inject.images ?? []).map(({ id, caption, width, height }) => ({
        image_id: id,
        caption,
        width,
        height,
      })),
      files: (inject.files ?? []).map(({ id, name, size_bytes, sha256, description }) => ({
        file_id: id,
        name,
        size_bytes,
        sha256,
        description,
      })),
    })),
  }
}

/** The PUT body: the draft plus the revision it was based on. */
export function payloadFromDraft(draft: MselDraft, revision: number) {
  return {
    revision,
    title: draft.title,
    summary: draft.summary,
    exercise_start: draft.exercise_start || null,
    incident_start: draft.incident_start || null,
    incident_date: draft.incident_date || null,
    duration_minutes: draft.duration_minutes,
    time_compression: draft.time_compression,
    meters: draft.meters,
    threat_actors: draft.threat_actors.map(
      ({
        id,
        key,
        name,
        mitre_group_id,
        aliases,
        description,
        techniques,
        origin,
        origin_id,
        origin_name,
      }) => ({
        id,
        key,
        name,
        mitre_group_id,
        aliases,
        description,
        techniques,
        origin,
        origin_id,
        origin_name,
      }),
    ),
    actors: draft.actors.map(
      ({
        id,
        key,
        name,
        type,
        description,
        channel,
        origin,
        origin_id,
        origin_name,
        played_by,
      }) => ({
        id,
        key,
        name,
        type,
        description,
        channel,
        origin,
        origin_id,
        origin_name,
        played_by,
      }),
    ),
    phases: draft.phases.map((phase) => ({
      id: phase.id,
      key: phase.key,
      name: phase.name,
      headline: phase.headline,
      start_offset: phase.start_offset,
      end_offset: phase.end_offset,
      incident_jump_minutes: phase.incident_jump_minutes,
      situation_update: phase.situation_update,
      key_questions: phase.key_questions,
      objective_ids: phase.objective_ids,
      due_objective_ids: phase.due_objective_ids.filter((id) => phase.objective_ids.includes(id)),
    })),
    injects: draft.injects.map((inject) => ({
      id: inject.id,
      key: inject.key,
      phase_key: inject.phase_key,
      kind: inject.kind,
      title: inject.title,
      content: inject.content,
      offset_minutes: inject.offset_minutes,
      trigger_condition: inject.trigger_condition,
      contingent_purpose: inject.contingent_purpose,
      fires_at_minute: inject.kind === 'contingent' ? inject.fires_at_minute : null,
      format: inject.format,
      poll_question: inject.poll_question,
      poll_options: inject.poll_options,
      poll_outcomes: inject.poll_outcomes,
      poll_impacts: inject.poll_impacts,
      branch_from_key: inject.branch_from_key,
      branch_action_key: inject.branch_action_key,
      rejoin_key: inject.rejoin_key,
      actor_key: inject.actor_key,
      attack_attribution: inject.attack_attribution,
      threat_actor_key: inject.threat_actor_key,
      recipients: inject.recipients,
      room_ids: inject.room_ids,
      delivery_method: inject.delivery_method,
      attachment_notes: inject.attachment_notes,
      attack_techniques: inject.attack_techniques.map(attackRefPayload),
      facilitator_notes: inject.facilitator_notes,
      artifact: inject.artifact,
      review_status: inject.review_status,
      validated_by: inject.validated_by,
      validated_by_id: inject.validated_by_id,
      objective_ids: inject.format === 'inject' ? inject.objective_ids : [],
      expected_actions: inject.expected_actions.map(
        ({ id, key, description, responsible_role, expected_within_minutes, objective_ids }) => ({
          id,
          key,
          description,
          responsible_role,
          expected_within_minutes,
          objective_ids:
            inject.format === 'inject'
              ? objective_ids.filter((o) => inject.objective_ids.includes(o))
              : [],
        }),
      ),
      images: inject.images.map(({ image_id, caption }) => ({ image_id, caption })),
      files: inject.files.map(({ file_id, description }) => ({ file_id, description })),
    })),
  }
}

let newRowCounter = 0

/** A temporary key for a row not saved yet -- unique within the page. */
export function newMselKey(): string {
  newRowCounter += 1
  return `new-${newRowCounter}`
}

/** A meter's key outlives the page, in the injects that name it. */
export function newMeterKey(): string {
  return `m-${Date.now().toString(36)}-${newMselKey()}`
}

export const MAX_METERS = 6

export function sameMselDraft(a: MselDraft, b: MselDraft): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** The draft that now matches the server after saving `sent`: saved
 * values, ids and codes, but the keys (and the references between rows)
 * of `sent`, so rows keep their identity on the page. The server keeps
 * collections in the order they were sent. */
export function reconcileSaved(sent: MselDraft, saved: Msel): MselDraft {
  const base = draftFromMsel(saved)
  // Branches point at rows by id in the response: name them by the keys the
  // page uses (a branch end the server dropped stays dropped).
  const injectKeys = new Map(base.injects.map((inject, i) => [inject.id, sent.injects[i]?.key]))
  const actionKeys = new Map(
    base.injects.flatMap((inject, i) =>
      inject.expected_actions.map((action, j) => [
        action.id,
        sent.injects[i]?.expected_actions[j]?.key,
      ]),
    ),
  )
  const threatKeys = new Map(
    base.threat_actors.map((actor, i) => [actor.id, sent.threat_actors[i]?.key]),
  )
  const keyOf = (map: Map<string | null, string | undefined>, id: string | null) =>
    id === null ? null : (map.get(id) ?? id)
  return {
    ...base,
    threat_actors: base.threat_actors.map((actor, i) => ({
      ...actor,
      key: sent.threat_actors[i]?.key ?? actor.key,
    })),
    actors: base.actors.map((actor, i) => ({ ...actor, key: sent.actors[i]?.key ?? actor.key })),
    phases: base.phases.map((phase, i) => ({ ...phase, key: sent.phases[i]?.key ?? phase.key })),
    injects: base.injects.map((inject, i) => {
      const was = sent.injects[i]
      if (!was) return inject
      return {
        ...inject,
        key: was.key,
        phase_key: was.phase_key,
        actor_key: was.actor_key,
        threat_actor_key: keyOf(threatKeys, inject.threat_actor_key),
        branch_from_key: keyOf(injectKeys, inject.branch_from_key),
        branch_action_key: keyOf(actionKeys, inject.branch_action_key),
        rejoin_key: keyOf(injectKeys, inject.rejoin_key),
        expected_actions: inject.expected_actions.map((action, j) => ({
          ...action,
          key: was.expected_actions[j]?.key ?? action.key,
        })),
      }
    }),
  }
}

/** Gives rows the user created before a save landed the id and code the
 * server assigned them (matched by key), so the next save updates them
 * instead of creating them again. Saved rows take the server's code too:
 * an inject whose format changed moved from INJ- to DSC- or POL- (or back). */
export function adoptSavedIds(draft: MselDraft, saved: MselDraft): MselDraft {
  function adopt<T extends { id: string | null; key: string; code: string }>(
    rows: T[],
    savedRows: T[],
  ): T[] {
    return rows.map((row) => {
      const match = savedRows.find((savedRow) => savedRow.key === row.key)
      if (!match) return row
      if (row.id) return row.code === match.code ? row : { ...row, code: match.code }
      return { ...row, id: match.id, code: match.code }
    })
  }
  return {
    ...draft,
    threat_actors: adopt(draft.threat_actors, saved.threat_actors),
    actors: adopt(draft.actors, saved.actors),
    phases: adopt(draft.phases, saved.phases),
    injects: adopt(draft.injects, saved.injects).map((inject) => {
      const match = saved.injects.find((savedInject) => savedInject.key === inject.key)
      return match
        ? { ...inject, expected_actions: adopt(inject.expected_actions, match.expected_actions) }
        : inject
    }),
  }
}

/** What the Phases tab's history keeps of the draft at each step: the
 * phases and the injects they carry (moving or resizing a phase moves its
 * injects, and may stretch the session). */
export type PhaseSnapshot = Pick<MselDraft, 'phases' | 'injects' | 'duration_minutes'>

export function phaseSnapshot(draft: MselDraft): PhaseSnapshot {
  return {
    phases: draft.phases,
    injects: draft.injects,
    duration_minutes: draft.duration_minutes,
  }
}

/** Puts a Phases-tab snapshot back into the current draft. Every row
 * takes the id and code it has *now* (matched by key): one saved since the
 * snapshot keeps the server's id, and one the autosave has deleted since
 * is created again as new -- a save never names an id that is gone. */
export function restoreSnapshot(current: MselDraft, snapshot: PhaseSnapshot): MselDraft {
  function rekey<T extends { id: string | null; key: string; code: string }>(
    rows: T[],
    now: T[],
  ): T[] {
    return rows.map((row) => {
      const match = now.find((item) => item.key === row.key)
      return match ? { ...row, id: match.id, code: match.code } : { ...row, id: null, code: '' }
    })
  }
  return {
    ...current,
    duration_minutes: snapshot.duration_minutes,
    phases: rekey(snapshot.phases, current.phases),
    injects: rekey(snapshot.injects, current.injects).map((inject) => {
      const now = current.injects.find((item) => item.key === inject.key)
      return {
        ...inject,
        expected_actions: rekey(inject.expected_actions, now?.expected_actions ?? []),
      }
    }),
  }
}

/** Every blocking issue (ready + approved) of one tab. */
export function tabIssues(report: ValidationReport, section: number): ValidationIssue[] {
  return [...report.ready, ...report.approved].filter((issue) => issue.section === section)
}

/** The DOM id of a field, so the validation summary can focus it. */
export function mselFieldId(field: string, itemId?: string | null): string {
  return itemId ? `msel-${field}-${itemId}` : `msel-${field}`
}

/** "T+01:05" for 65 minutes; "—" when not set. */
/** Scenario minutes per session minute offered in the Scenario tab: real
 * time up to a day a minute; 60 (an hour a minute) is the default. */
export const COMPRESSION_PRESETS: readonly number[] = [1, 10, 30, 60, 240, 1440]

/** Minutes as an hours figure in the UI language ("3", "2,5"); "" for none. */
export function formatHours(minutes: number | null, language: string): string {
  if (minutes === null) return ''
  return new Intl.NumberFormat(language, { maximumFractionDigits: 2, useGrouping: false }).format(
    minutes / 60,
  )
}

/** Typed hours ("3", "2,5", "2.5") as whole minutes, up to `maxMinutes`
 * (a day by default): `null` for empty or zero, `undefined` while it
 * isn't a number yet (keep the last value). */
export function parseHours(text: string, maxMinutes = 1440): number | null | undefined {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === '.') return undefined
  const minutes = Math.round(Number(trimmed) * 60)
  return minutes > 0 ? Math.min(minutes, maxMinutes) : null
}

/** Longest time jump before a phase (the backend's
 * MAX_INCIDENT_JUMP_MINUTES): 30 days of incident time. */
export const MAX_INCIDENT_JUMP_MINUTES = 30 * 24 * 60

/** The inject dialog's blocks, in order. */
export const INJECT_SECTIONS = ['what', 'who', 'evaluates', 'poll', 'attack', 'review'] as const
export type InjectSection = (typeof INJECT_SECTIONS)[number]

export const INJECT_FORMATS: readonly InjectFormat[] = ['inject', 'discussion', 'poll']

/** The steps an inject of this format goes through. A poll goes straight
 * to the Players: no one sends it, and it evaluates nothing. */
export function injectSteps(format: InjectFormat): readonly InjectSection[] {
  return format === 'poll'
    ? ['what', 'poll', 'review']
    : ['what', 'who', 'evaluates', 'attack', 'review']
}

/** The letter a poll's option goes by, for the table and in the PDFs. */
export function pollLetter(index: number): string {
  return String.fromCharCode(65 + index)
}

/** Most options a poll takes (the backend's MAX_POLL_OPTIONS). */
export const MAX_POLL_OPTIONS = 6

/** Where a block of the inject dialog stands, as the user edits it -- the
 * same rules the report applies, read on the dialog's own copy: `todo`
 * blocks the MSEL's review, `warn` is worth a look (the MSEL can't be
 * marked ready, or the ATT&CK attribution is half done), `optional`
 * nothing set and nothing needed, `done` complete. */
export type InjectSectionStatus = 'done' | 'todo' | 'warn' | 'optional'

/** When the storyline reaches the point a contingent inject leaves from:
 * the time of its mandatory ancestor (contingent parents are followed up);
 * null when it hangs from nothing on the storyline (or loops). Mirrors the
 * backend's `fork_time`. */
export function branchForkTime(
  draft: Pick<MselDraft, 'injects'>,
  inject: Pick<InjectDraft, 'key' | 'branch_from_key'>,
): number | null {
  const seen = new Set([inject.key])
  let parent = draft.injects.find((i) => i.key === inject.branch_from_key)
  while (parent && parent.kind === 'contingent') {
    if (seen.has(parent.key)) return null
    seen.add(parent.key)
    const next: string | null = parent.branch_from_key
    parent = draft.injects.find((i) => i.key === next)
  }
  return parent?.offset_minutes ?? null
}

/** Whether `candidate` hangs (directly or further down) from `inject`: it
 * can't be what `inject` branches off, or the branch would loop. */
export function branchesFrom(
  draft: Pick<MselDraft, 'injects'>,
  candidate: Pick<InjectDraft, 'key' | 'branch_from_key'>,
  inject: Pick<InjectDraft, 'key'>,
): boolean {
  const seen = new Set<string>()
  let parentKey = candidate.branch_from_key
  while (parentKey && !seen.has(parentKey)) {
    if (parentKey === inject.key) return true
    seen.add(parentKey)
    parentKey = draft.injects.find((i) => i.key === parentKey)?.branch_from_key ?? null
  }
  return false
}

/** Where a contingent inject may come back to the storyline: a mandatory
 * inject later than the point it leaves from (any phase, never earlier). */
export function validRejoin(
  draft: Pick<MselDraft, 'injects'>,
  inject: Pick<InjectDraft, 'key' | 'branch_from_key'>,
  target: Pick<InjectDraft, 'kind' | 'offset_minutes'>,
): boolean {
  if (target.kind !== 'mandatory') return false
  const fork = branchForkTime(draft, inject)
  return fork === null || target.offset_minutes === null || target.offset_minutes > fork
}

/** What a block of the inject still needs, as i18n keys under
 * `creator.msel.wizard.issues` with their values -- the reason behind a
 * step's mark, said on the step itself. */
/** Internal verbs an evaluator can't see happen (the backend's
 * VAGUE_ACTION_WORDS, rule M13): an expected action should be something
 * said, decided or recorded in the room. */
export const VAGUE_ACTION_WORDS: readonly string[] = [
  'manage',
  'assess',
  'check',
  'analyse the situation',
  'analyze the situation',
  'gestionar',
  'valorar',
  'comprobar',
  'analizar la situación',
]

const VAGUE_ACTION = new RegExp(
  `(?<![\\p{L}\\p{N}_])(${VAGUE_ACTION_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![\\p{L}\\p{N}_])`,
  'giu',
)

/** The vague words an inject's expected actions use, each once, as typed
 * in the list (lower case). */
export function vagueActionWords(inject: Pick<InjectDraft, 'expected_actions'>): string[] {
  const found = new Set<string>()
  for (const action of inject.expected_actions) {
    for (const match of action.description.matchAll(VAGUE_ACTION)) {
      found.add(match[1].toLowerCase())
    }
  }
  return [...found]
}

export interface InjectSectionIssue {
  key: string
  values?: Record<string, string | number>
}

export function injectSectionIssues(
  inject: InjectDraft,
  draft: Pick<MselDraft, 'phases' | 'injects'>,
  section: InjectSection,
): InjectSectionIssue[] {
  const blank = (text: string) => text.trim() === ''
  const issues: InjectSectionIssue[] = []
  switch (section) {
    case 'what': {
      if (!inject.phase_key) issues.push({ key: 'phase' })
      if (blank(inject.title)) issues.push({ key: 'title' })
      // A poll's context is optional: its question says what it's about.
      if (inject.format !== 'poll' && blank(inject.content)) issues.push({ key: 'content' })
      if (inject.kind === 'contingent') {
        if (blank(inject.trigger_condition)) issues.push({ key: 'trigger' })
        if (blank(inject.contingent_purpose)) issues.push({ key: 'purpose' })
        // It leaves from an inject of its own phase, and comes back later.
        const parent = draft.injects.find((i) => i.key === inject.branch_from_key)
        if (!parent) issues.push({ key: 'branchFrom' })
        else if (parent.phase_key !== inject.phase_key) issues.push({ key: 'branchOtherPhase' })
        const rejoin = draft.injects.find((i) => i.key === inject.rejoin_key)
        if (rejoin && !validRejoin(draft, inject, rejoin)) issues.push({ key: 'rejoinInvalid' })
        // It's checked while its phase runs.
        const phase = draft.phases.find((p) => p.key === inject.phase_key)
        if (
          phase &&
          inject.fires_at_minute !== null &&
          inject.fires_at_minute > phase.end_offset - phase.start_offset
        ) {
          issues.push({
            key: 'checkAfterEnd',
            values: { minutes: phase.end_offset - phase.start_offset },
          })
        }
      } else if (inject.offset_minutes === null) {
        issues.push({ key: 'time' })
      } else {
        const phase = draft.phases.find((p) => p.key === inject.phase_key)
        if (
          phase &&
          (inject.offset_minutes < phase.start_offset || inject.offset_minutes > phase.end_offset)
        ) {
          issues.push({
            key: 'timeOutside',
            values: { minutes: phase.end_offset - phase.start_offset },
          })
        }
      }
      return issues
    }
    case 'who':
      if (!inject.actor_key) issues.push({ key: 'sender' })
      if (inject.recipients.length === 0) issues.push({ key: 'recipients' })
      return issues
    case 'evaluates': {
      // A discussion inject (debrief, reflection) evaluates nothing.
      const evaluated = inject.format === 'inject'
      if (evaluated && inject.objective_ids.length === 0) issues.push({ key: 'objectives' })
      if (evaluated && inject.expected_actions.length === 0) issues.push({ key: 'actions' })
      inject.expected_actions.forEach((action, index) => {
        if (blank(action.description)) {
          issues.push({ key: 'actionDescription', values: { index: index + 1 } })
        }
      })
      return issues
    }
    case 'poll': {
      const options = inject.poll_options.map((o) => o.trim().toLowerCase())
      if (blank(inject.poll_question)) issues.push({ key: 'pollQuestion' })
      if (options.length < 2 || options.some((o) => !o) || new Set(options).size < options.length) {
        issues.push({ key: 'pollOptions' })
      }
      return issues
    }
    case 'attack':
      if (!inject.attack_attribution) return issues
      if (inject.attack_attribution === 'threat_actor' && !inject.threat_actor_key) {
        issues.push({ key: 'threatActor' })
      }
      // Noise may name techniques or not; a threat actor's activity should.
      if (inject.attack_attribution === 'threat_actor' && inject.attack_techniques.length === 0) {
        issues.push({ key: 'techniques' })
      }
      return issues
    case 'review':
      if (inject.kind === 'mandatory' && inject.review_status !== 'validated') {
        issues.push({ key: 'notValidated' })
      }
      return issues
  }
}

export function injectSectionStatus(
  inject: InjectDraft,
  draft: Pick<MselDraft, 'phases' | 'injects'>,
  section: InjectSection,
): InjectSectionStatus {
  if (section === 'attack' && !inject.attack_attribution) return 'optional'
  if (injectSectionIssues(inject, draft, section).length === 0) return 'done'
  // ATT&CK half done and an unvalidated mandatory inject don't stop the
  // review; the rest does.
  return section === 'attack' || section === 'review' ? 'warn' : 'todo'
}

/** The order a crisis usually goes through: the phases suggested from the
 * objectives follow it, one per capability they evaluate. */
export const CAPABILITY_PHASE_ORDER: readonly Capability[] = [
  'detection_triage_escalation',
  'incident_classification',
  'crisis_decision_making',
  'cross_unit_coordination',
  'third_party_supply_chain',
  'legal_forensics',
  'internal_external_comms',
  'regulatory_notification',
  'continuity_recovery',
]

/** The objectives grouped by capability, in CAPABILITY_PHASE_ORDER: a
 * suggested phase each -- moments of the crisis drawn from what the
 * exercise evaluates, not stages of the attack. */
export function objectivePhaseGroups(
  objectives: readonly { id: string; capability: Capability }[],
): { capability: Capability; objective_ids: string[] }[] {
  return CAPABILITY_PHASE_ORDER.map((capability) => ({
    capability,
    objective_ids: objectives.filter((o) => o.capability === capability).map((o) => o.id),
  })).filter((group) => group.objective_ids.length > 0)
}

/** `count` bands one after another from `start`, sharing `minutes` evenly
 * (the last takes the remainder). */
export function evenBands(
  start: number,
  minutes: number,
  count: number,
): { start_offset: number; end_offset: number }[] {
  const each = Math.max(1, Math.floor(minutes / Math.max(1, count)))
  return Array.from({ length: count }, (_, index) => ({
    start_offset: start + index * each,
    end_offset: index === count - 1 ? start + minutes : start + (index + 1) * each,
  }))
}

/** Phases in session order: by start, then end. */
export function inSessionOrder<T extends Pick<PhaseDraft, 'start_offset' | 'end_offset'>>(
  phases: T[],
): T[] {
  return [...phases].sort((a, b) => a.start_offset - b.start_offset || a.end_offset - b.end_offset)
}

/** The phase before `key` in session order that reaches furthest -- the
 * one it overlaps, or leaves a gap after. */
export function previousPhase(phases: PhaseDraft[], key: string): PhaseDraft | null {
  const ordered = inSessionOrder(phases)
  const index = ordered.findIndex((phase) => phase.key === key)
  return ordered
    .slice(0, Math.max(0, index))
    .reduce<PhaseDraft | null>((far, p) => (!far || p.end_offset > far.end_offset ? p : far), null)
}

/** Keys of the phases after `key` in session order. */
export function followingPhases(phases: PhaseDraft[], key: string): string[] {
  const ordered = inSessionOrder(phases)
  const index = ordered.findIndex((phase) => phase.key === key)
  return index < 0 ? [] : ordered.slice(index + 1).map((phase) => phase.key)
}

/** Moves phases `minutes` along the session, each carrying its injects
 * (they keep their place inside it). */
export function movePhases(draft: MselDraft, keys: string[], minutes: number): MselDraft {
  if (minutes === 0 || keys.length === 0) return draft
  const moving = new Set(keys)
  return {
    ...draft,
    phases: draft.phases.map((phase) =>
      moving.has(phase.key)
        ? {
            ...phase,
            start_offset: Math.max(0, phase.start_offset + minutes),
            end_offset: Math.max(0, phase.end_offset + minutes),
          }
        : phase,
    ),
    injects: draft.injects.map((inject) =>
      moving.has(inject.phase_key) && inject.offset_minutes !== null
        ? { ...inject, offset_minutes: Math.max(0, inject.offset_minutes + minutes) }
        : inject,
    ),
  }
}

/** A phase edited in its dialog, applied to the draft. Moving its start
 * carries its injects along; with `pushLater` a change in where it ends
 * moves every later phase (and their injects) by as much, so the session
 * stays one sequence; without it the later phases stay where they are
 * (an overlap is allowed; a gap becomes scenario time on Done). */
export function applyPhaseEdit(
  draft: MselDraft,
  edited: PhaseDraft,
  pushLater: boolean,
): MselDraft {
  const old = draft.phases.find((phase) => phase.key === edited.key)
  if (!old) return { ...draft, phases: [...draft.phases, edited] }
  const later = pushLater ? followingPhases(draft.phases, edited.key) : []
  const moved = movePhases(
    movePhases(draft, [edited.key], edited.start_offset - old.start_offset),
    later,
    edited.end_offset - old.end_offset,
  )
  return {
    ...moved,
    phases: moved.phases.map((phase) =>
      phase.key === edited.key
        ? { ...edited, id: old.id ?? edited.id, code: old.code || edited.code }
        : phase,
    ),
  }
}

/** A phase edited in its dialog (in Phases or on the storyline map), saved
 * the one way: applied (moving later phases or not) and any session left
 * between phases turned into scenario time (see closeSessionGaps). */
export function savePhaseEdit(draft: MselDraft, phase: PhaseDraft, pushLater: boolean) {
  return closeSessionGaps(applyPhaseEdit(draft, phase, pushLater))
}

/** The shortest a phase can be made by dragging its edges on the map. */
export const MIN_PHASE_MINUTES = 5

const snapMinutes = (minutes: number) => Math.round(minutes / 5) * 5

/** One edge of a phase dragged on the storyline map: that phase alone gets
 * the new start or end (snapped to 5 min, inside the session, at least
 * MIN_PHASE_MINUTES long); its injects keep their times. */
export function resizePhase(
  draft: MselDraft,
  key: string,
  edge: 'start' | 'end',
  minutes: number,
): MselDraft {
  const session = draft.duration_minutes ?? 0
  return {
    ...draft,
    phases: draft.phases.map((phase) => {
      if (phase.key !== key) return phase
      const time = Math.min(session, Math.max(0, snapMinutes(minutes)))
      return edge === 'start'
        ? { ...phase, start_offset: Math.min(time, phase.end_offset - MIN_PHASE_MINUTES) }
        : { ...phase, end_offset: Math.max(time, phase.start_offset + MIN_PHASE_MINUTES) }
    }),
  }
}

/** A phase dragged whole on the storyline map so that it starts at
 * `minutes` (snapped, kept inside the session): it carries its injects. */
export function movePhaseBox(draft: MselDraft, key: string, minutes: number): MselDraft {
  const phase = draft.phases.find((p) => p.key === key)
  if (!phase) return draft
  const length = phase.end_offset - phase.start_offset
  const session = draft.duration_minutes ?? 0
  const start = Math.min(Math.max(0, session - length), Math.max(0, snapMinutes(minutes)))
  return movePhases(draft, [key], start - phase.start_offset)
}

/** A one-click way out of a warning: what it does (an i18n key under
 * `creator.msel.fixes` and its values) and the draft it leaves. */
export interface MselFix {
  id: string
  values: Record<string, string>
  apply: (draft: MselDraft) => MselDraft
}

/** The fixes a timing issue offers, worked out on the draft as it is.
 * Nothing is applied until the user picks one (and it can be undone). */
export function issueFixes(draft: MselDraft, issue: ValidationIssue): MselFix[] {
  const phase = draft.phases.find((p) => p.key === issue.item_id || p.id === issue.item_id)
  const code = (p: PhaseDraft) => codeRefText(p.code, p.name)
  const setPhase = (key: string, patch: Partial<PhaseDraft>) => (d: MselDraft) => ({
    ...d,
    phases: d.phases.map((p) => (p.key === key ? { ...p, ...patch } : p)),
  })
  const session = draft.duration_minutes ?? 0
  if (phase) {
    const previous = previousPhase(draft.phases, phase.key)
    const item = code(phase)
    switch (issue.code) {
      case 'PHASES_OVERLAP':
        if (!previous) return []
        return [
          {
            id: 'startAfter',
            values: { item, previous: code(previous), time: formatOffset(previous.end_offset) },
            apply: (d) =>
              movePhases(
                d,
                [phase.key, ...followingPhases(d.phases, phase.key)],
                previous.end_offset - phase.start_offset,
              ),
          },
          ...(phase.start_offset > previous.start_offset
            ? [
                {
                  id: 'endBefore',
                  values: {
                    item,
                    previous: code(previous),
                    time: formatOffset(phase.start_offset),
                  },
                  apply: setPhase(previous.key, { end_offset: phase.start_offset }),
                },
              ]
            : []),
        ]
      case 'PHASE_GAP':
        if (!previous) return []
        return [
          { id: 'toScenario', values: { item }, apply: (d) => closeSessionGaps(d).draft },
          {
            id: 'extendPrevious',
            values: { previous: code(previous), time: formatOffset(phase.start_offset) },
            apply: setPhase(previous.key, { end_offset: phase.start_offset }),
          },
        ]
      case 'SESSION_START_UNCOVERED':
        return [
          { id: 'startAtZero', values: { item }, apply: setPhase(phase.key, { start_offset: 0 }) },
        ]
      case 'SESSION_END_UNCOVERED':
        return session > phase.end_offset
          ? [
              {
                id: 'extendToEnd',
                values: { item, time: formatOffset(session) },
                apply: setPhase(phase.key, { end_offset: session }),
              },
              {
                id: 'shortenSession',
                values: { time: formatOffset(phase.end_offset) },
                apply: (d) => ({ ...d, duration_minutes: phase.end_offset }),
              },
            ]
          : []
    }
    return []
  }
  const inject = draft.injects.find((i) => i.key === issue.item_id || i.id === issue.item_id)
  if (inject && issue.code === 'BRANCH_FROM_OTHER_PHASE') {
    const parent = draft.injects.find((i) => i.key === inject.branch_from_key)
    const parentPhase = draft.phases.find((p) => p.key === parent?.phase_key)
    return parentPhase
      ? [
          {
            id: 'toParentPhase',
            values: { phase: code(parentPhase) },
            apply: (d) => ({
              ...d,
              injects: d.injects.map((i) =>
                i.key === inject.key ? { ...i, phase_key: parentPhase.key } : i,
              ),
            }),
          },
        ]
      : []
  }
  if (inject && issue.code === 'ACTION_PAST_PHASE_END') {
    const own = draft.phases.find((p) => p.key === inject.phase_key)
    const start = deliveredAt(inject, draft.phases)
    if (!own || start === null || own.end_offset - start < 1) return []
    const left = own.end_offset - start
    return [
      {
        id: 'actionsToPhaseEnd',
        values: { phase: code(own), minutes: String(left) },
        apply: (d) => ({
          ...d,
          injects: d.injects.map((i) =>
            i.key === inject.key
              ? {
                  ...i,
                  expected_actions: i.expected_actions.map((a) =>
                    a.expected_within_minutes !== null && a.expected_within_minutes > left
                      ? { ...a, expected_within_minutes: left }
                      : a,
                  ),
                }
              : i,
          ),
        }),
      },
    ]
  }
  if (inject && issue.code === 'BRANCH_REJOIN_INVALID') {
    return [
      {
        id: 'clearRejoin',
        values: {},
        apply: (d) => ({
          ...d,
          injects: d.injects.map((i) => (i.key === inject.key ? { ...i, rejoin_key: null } : i)),
        }),
      },
    ]
  }
  if (!inject || issue.code !== 'INJECT_OUTSIDE_PHASE' || inject.offset_minutes === null) return []
  const own = draft.phases.find((p) => p.key === inject.phase_key)
  const time = inject.offset_minutes
  const holding = inSessionOrder(draft.phases).find(
    (p) => p.key !== inject.phase_key && p.start_offset <= time && time <= p.end_offset,
  )
  const setInject = (patch: Partial<InjectDraft>) => (d: MselDraft) => ({
    ...d,
    injects: d.injects.map((i) => (i.key === inject.key ? { ...i, ...patch } : i)),
  })
  const inside = own ? Math.min(own.end_offset, Math.max(own.start_offset, time)) : null
  return [
    ...(own && inside !== null
      ? [
          {
            id: 'intoPhase',
            values: { phase: code(own), time: formatOffset(inside) },
            apply: setInject({ offset_minutes: inside }),
          },
        ]
      : []),
    ...(holding
      ? [
          {
            id: 'toHoldingPhase',
            values: { phase: code(holding) },
            apply: setInject({ phase_key: holding.key }),
          },
        ]
      : []),
  ]
}

/** Session minute an inject reaches the players: a mandatory one's T+; a
 * contingent one's check minute in its phase (null when it has none) --
 * the backend's `_delivered_at`. */
export function deliveredAt(
  inject: Pick<InjectDraft, 'kind' | 'offset_minutes' | 'fires_at_minute' | 'phase_key'>,
  phases: Pick<PhaseDraft, 'key' | 'start_offset'>[],
): number | null {
  if (inject.kind === 'mandatory') return inject.offset_minutes
  const phase = phases.find((p) => p.key === inject.phase_key)
  return phase && inject.fires_at_minute !== null
    ? phase.start_offset + inject.fires_at_minute
    : null
}

/** Session time between two consecutive phases: where one ends and the
 * next one starts later. Overlaps aren't gaps (the report flags them). */
export function sessionGaps(
  phases: Pick<PhaseDraft, 'key' | 'start_offset' | 'end_offset'>[],
): { phaseKey: string; minutes: number }[] {
  const ordered = [...phases].sort((a, b) => a.start_offset - b.start_offset)
  const gaps: { phaseKey: string; minutes: number }[] = []
  let reached: number | null = null
  for (const phase of ordered) {
    if (reached !== null && phase.start_offset > reached) {
      gaps.push({ phaseKey: phase.key, minutes: phase.start_offset - reached })
    }
    reached = Math.max(reached ?? 0, phase.end_offset)
  }
  return gaps
}

/** The session never pauses: a stretch of session between two phases is
 * a lapse in the *scenario*. Each gap becomes a time jump of the phase
 * after it (gap × compression, so scenario time stays where it was) and
 * that phase, the later ones and their injects move up by the gap -- T+
 * stays the same everywhere: the session's clock stops across the lapse,
 * the scenario's goes on. Returns the draft untouched when there's no gap. */
export function closeSessionGaps(draft: MselDraft): {
  draft: MselDraft
  closed: { phaseKey: string; minutes: number }[]
} {
  const gaps = sessionGaps(draft.phases)
  if (gaps.length === 0) return { draft, closed: [] }
  const gapBefore = new Map(gaps.map((gap) => [gap.phaseKey, gap.minutes]))
  const shiftOf = new Map<string, number>()
  let shift = 0
  for (const phase of [...draft.phases].sort((a, b) => a.start_offset - b.start_offset)) {
    shift += gapBefore.get(phase.key) ?? 0
    shiftOf.set(phase.key, shift)
  }
  return {
    closed: gaps,
    draft: {
      ...draft,
      phases: draft.phases.map((phase) => {
        const by = shiftOf.get(phase.key) ?? 0
        const gap = gapBefore.get(phase.key) ?? 0
        return by === 0
          ? phase
          : {
              ...phase,
              start_offset: phase.start_offset - by,
              end_offset: phase.end_offset - by,
              incident_jump_minutes: Math.min(
                MAX_INCIDENT_JUMP_MINUTES,
                phase.incident_jump_minutes + gap * draft.time_compression,
              ),
            }
      }),
      injects: draft.injects.map((inject) => {
        const by = shiftOf.get(inject.phase_key) ?? 0
        return by === 0 || inject.offset_minutes === null
          ? inject
          : { ...inject, offset_minutes: Math.max(0, inject.offset_minutes - by) }
      }),
    },
  }
}

/** Incident time elapsed `minutes` into the session: the session time
 * times the compression, plus the jump of every phase that has started by
 * then (a phase at T+0 has nothing to jump from). */
export function incidentMinutesAt(
  draft: Pick<MselDraft, 'phases' | 'time_compression'>,
  minutes: number,
): number {
  const jumps = draft.phases
    .filter((phase) => phase.start_offset > 0 && phase.start_offset <= minutes)
    .reduce((total, phase) => total + phase.incident_jump_minutes, 0)
  return minutes * draft.time_compression + jumps
}

/** Elapsed incident time as "+10 h", "+2 d 12 h" (whole hours past a
 * day) or "+0". */
export function formatIncident(minutes: number): string {
  if (minutes <= 0) return '+0'
  return `+${formatSpan(minutes >= 1440 ? Math.round(minutes / 60) * 60 : minutes)}`
}

/** A span of minutes as "2 d 12 h", "3 h 30 min" or "45 min". */
export function formatSpan(minutes: number): string {
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const rest = minutes % 60
  const parts = [
    days ? `${days} d` : '',
    hours ? `${hours} h` : '',
    rest ? `${rest} min` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' ') : '0 min'
}

/** The wall-clock time `minutes` into a session that starts at `start`
 * ("HH:MM"; past midnight it wraps): "10:05" for "09:30" + 35. */
export function clockAt(start: string, minutes: number): string {
  const [hours, mins] = start.split(':').map(Number)
  const total = (((hours * 60 + mins + minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** "T+00:35 · 10:05 am" with a start time, "T+00:35" without. */
export function formatOffsetAt(minutes: number | null, start: string, locale = 'en'): string {
  return minutes !== null && start
    ? `${formatOffset(minutes)} · ${formatClock(clockAt(start, minutes), locale)}`
    : formatOffset(minutes)
}

/** Whether `locale` reads the time of day on the 12-hour clock (Intl's
 * default hour cycle for it: "en" yes, "es" no). */
function uses12HourClock(locale: string): boolean {
  const cycle = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hourCycle
  return cycle === 'h11' || cycle === 'h12'
}

/** A 24-hour "HH:MM" as `locale` reads it: on the 12-hour clock "10:30 am",
 * "6:45 pm", "12:00 pm" (noon), "12:15 am" (just after midnight); on the
 * 24-hour clock unchanged ("18:45"). */
export function formatClock(time: string, locale = 'en'): string {
  if (!uses12HourClock(locale)) return time
  const [hours, mins] = time.split(':').map(Number)
  const hour = hours % 12 === 0 ? 12 : hours % 12
  return `${hour}:${String(mins).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`
}

export function formatOffset(minutes: number | null): string {
  if (minutes === null) return '—'
  const hours = Math.floor(minutes / 60)
  return `T+${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

/** Injects in timeline order: by phase, then offset (contingents last in
 * their phase), then their saved order. */
export function orderedInjects(draft: MselDraft): InjectDraft[] {
  const phaseOrder = new Map(draft.phases.map((phase, index) => [phase.key, index]))
  return draft.injects
    .map((inject, index) => ({ inject, index }))
    .sort(
      (a, b) =>
        (phaseOrder.get(a.inject.phase_key) ?? 99) - (phaseOrder.get(b.inject.phase_key) ?? 99) ||
        (a.inject.offset_minutes ?? Number.MAX_SAFE_INTEGER) -
          (b.inject.offset_minutes ?? Number.MAX_SAFE_INTEGER) ||
        a.index - b.index,
    )
    .map(({ inject }) => inject)
}

/** A new, unsaved inject for this MSEL (defaults: the first phase and
 * actor), with `patch` on top. */
/** Minutes after the last mandatory inject of a phase that a new one is
 * proposed at. */
export const NEXT_INJECT_GAP_MINUTES = 5

/** Where a new mandatory inject of `phaseKey` goes by default: as the
 * phase opens when it's the first, a little after the phase's last one
 * otherwise -- stacked at the phase's end once there's no room left. */
export function nextOffsetIn(
  draft: Pick<MselDraft, 'phases' | 'injects'>,
  phaseKey: string,
  except: string | null = null,
): number | null {
  const phase = draft.phases.find((p) => p.key === phaseKey)
  if (!phase) return null
  const times = draft.injects
    .filter(
      (i) =>
        i.key !== except &&
        i.phase_key === phaseKey &&
        i.kind === 'mandatory' &&
        i.offset_minutes !== null,
    )
    .map((i) => i.offset_minutes as number)
  if (times.length === 0) return phase.start_offset
  return Math.min(phase.end_offset, Math.max(...times) + NEXT_INJECT_GAP_MINUTES)
}

export function emptyInjectDraft(draft: MselDraft, patch: Partial<InjectDraft> = {}): InjectDraft {
  const inject = emptyInjectDraftBase(draft, patch)
  // A mandatory inject with no time yet gets its phase's next one.
  return inject.kind === 'mandatory' && inject.offset_minutes === null
    ? { ...inject, offset_minutes: nextOffsetIn(draft, inject.phase_key) }
    : inject
}

function emptyInjectDraftBase(draft: MselDraft, patch: Partial<InjectDraft>): InjectDraft {
  return {
    id: null,
    key: newMselKey(),
    code: '',
    phase_key: draft.phases[0]?.key ?? '',
    kind: 'mandatory',
    title: '',
    content: '',
    offset_minutes: null,
    trigger_condition: '',
    contingent_purpose: '',
    fires_at_minute: null,
    format: 'inject',
    poll_question: '',
    poll_options: [],
    poll_outcomes: [],
    poll_impacts: [],
    branch_from_key: null,
    branch_action_key: null,
    rejoin_key: null,
    actor_key: draft.actors[0]?.key ?? null,
    recipients: [],
    room_ids: [],
    delivery_method: 'email',
    attachment_notes: [],
    attack_attribution: null,
    threat_actor_key: null,
    attack_techniques: [],
    facilitator_notes: '',
    artifact: null,
    review_status: 'draft',
    validated_by: '',
    validated_by_id: null,
    objective_ids: [],
    expected_actions: [],
    images: [],
    files: [],
    ...patch,
  }
}

/** The injects with `inject` written in: replaced by key (keeping the id
 * and code a save may have given it meanwhile), or added. */
export function upsertInject(draft: MselDraft, inject: InjectDraft): InjectDraft[] {
  // The draft's ids and codes win: the inject dialog writes as it goes, and
  // a save meanwhile has handed the new rows (and their actions) theirs.
  return draft.injects.some((i) => i.key === inject.key)
    ? draft.injects.map((i) =>
        i.key === inject.key
          ? {
              ...inject,
              id: i.id ?? inject.id,
              code: i.code || inject.code,
              expected_actions: inject.expected_actions.map((action) => {
                const saved = i.expected_actions.find((a) => a.key === action.key)
                return saved
                  ? { ...action, id: saved.id ?? action.id, code: saved.code || action.code }
                  : action
              }),
            }
          : i,
      )
    : [...draft.injects, inject]
}

/** What the inject dialog writes into the draft on every change: the
 * inject, plus any actors created or copied from the library while it is
 * open. */
export function injectDialogPatch(
  draft: MselDraft,
  inject: InjectDraft,
  newActors: ActorDraft[],
): Partial<MselDraft> {
  return {
    injects: upsertInject(draft, inject),
    // Applied as the dialog goes: an actor already in the cast isn't added
    // twice.
    ...(newActors.some((actor) => !draft.actors.some((a) => a.key === actor.key))
      ? {
          actors: [
            ...draft.actors,
            ...newActors.filter((actor) => !draft.actors.some((a) => a.key === actor.key)),
          ],
        }
      : {}),
  }
}

/** The Injects tab's filters, kept in the URL query (and read by the
 * storyline strip to highlight the same injects). */
export const INJECT_FILTERS = [
  'phase',
  'objective',
  'kind',
  'format',
  'recipient',
  'room',
  'attack',
  'review',
] as const
export type InjectFilterKey = (typeof INJECT_FILTERS)[number]
export type InjectFilters = Record<InjectFilterKey, string>

export function injectFiltersFrom(params: URLSearchParams): InjectFilters {
  return Object.fromEntries(
    INJECT_FILTERS.map((key) => [key, params.get(key) ?? '']),
  ) as InjectFilters
}

export function hasInjectFilter(filters: InjectFilters): boolean {
  return INJECT_FILTERS.some((key) => filters[key])
}

export function matchesInjectFilters(inject: InjectDraft, filters: InjectFilters): boolean {
  return (
    (!filters.phase || inject.phase_key === filters.phase) &&
    (!filters.objective || inject.objective_ids.includes(filters.objective)) &&
    (!filters.kind || inject.kind === filters.kind) &&
    (!filters.format || inject.format === filters.format) &&
    (!filters.recipient || inject.recipients.includes(filters.recipient)) &&
    (!filters.room || playedIn(inject, filters.room)) &&
    (!filters.attack || attackFilterValue(inject) === filters.attack) &&
    (!filters.review || inject.review_status === filters.review)
  )
}

/** Whether an inject is played in this room: aimed at it, or at all. */
export function playedIn(inject: Pick<InjectDraft, 'room_ids'>, roomId: string): boolean {
  return inject.room_ids.length === 0 || inject.room_ids.includes(roomId)
}

/** An inject's value for the ATT&CK filter: "none", "noise", or the key of
 * the threat actor it's attributed to ("" -- a threat actor's, none
 * chosen). */
export function attackFilterValue(inject: InjectDraft): string {
  if (inject.attack_attribution === null) return 'none'
  if (inject.attack_attribution === 'noise') return 'noise'
  return inject.threat_actor_key ?? ''
}

/** Row fields edited in a dialog: the summary opens the row rather than
 * focusing a field on the page. */
export const PHASE_ROW_FIELDS = ['name', 'start_offset', 'end_offset', 'objective_ids', 'injects']
export const INJECT_ROW_FIELDS = [
  'branch_from_key',
  'rejoin_key',
  'title',
  'content',
  'actor_key',
  'recipients',
  'objective_ids',
  'expected_actions',
  'offset_minutes',
  'trigger_condition',
  'contingent_purpose',
  'attack_techniques',
  'threat_actor_key',
  'review_status',
]

/** A number input's value as a nullable whole number ("" = not set). */
export function toNumber(value: string): number | null {
  if (value.trim() === '') return null
  const parsed = Number.parseInt(value, 10)
  return Number.isNaN(parsed) ? null : parsed
}
