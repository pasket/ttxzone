import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { badgeNeutral, btnPrimary, btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { ATTENTION_CHANGED_EVENT, PROPOSALS_ARRIVED_EVENT } from '../../lib/attention'
import type { IssueMessage } from '../../lib/issueGroups'
import {
  acceptedState,
  compareLists,
  heldBySaved,
  listDelta,
  patchRow,
  PROPOSAL_REF,
  withDependencies,
  type Conflict,
  type ListDelta,
  type Merge,
  type Proposal,
  type ProposalListResponse,
  type ProposalTarget,
} from '../../lib/proposals'
import type {
  ActorType,
  Capability,
  DeliveryMethod,
  InjectKind,
  NeedPriority,
  NeedSource,
} from '../../lib/types'
import {
  countBySection,
  PROPOSAL_SECTIONS,
  PROPOSALS_CHANGED_EVENT,
  SECTION_TITLE_KEYS,
  TARGET_LABEL_KEYS,
  type ProposalSection,
} from '../../lib/proposalLabels'
import { CodeRef } from '../common/CodeRef'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'

type Row = { id: string | null; key: string }

/** A content language's name, as the exercise form shows it. */
const LANGUAGE_NAME_KEYS = { en: 'nav.languageEn', es: 'nav.languageEs' } as const

const EVIDENCE_LABEL_KEYS = {
  inject: 'assistant.evidence.inject',
  action: 'assistant.evidence.action',
  decision: 'assistant.evidence.decision',
  poll: 'assistant.evidence.poll',
  rating: 'assistant.evidence.rating',
  note: 'assistant.evidence.note',
  feedback: 'assistant.evidence.feedback',
} as const

const FIELD_LABEL_KEYS = {
  source: 'assistant.fields.source',
  title: 'assistant.fields.title',
  finding: 'assistant.fields.finding',
  affected_capability: 'assistant.fields.capability',
  capability: 'assistant.fields.capability',
  priority: 'assistant.fields.priority',
  statement: 'assistant.fields.statement',
  linked_need_keys: 'assistant.fields.needs',
  success_criterion: 'assistant.fields.successCriterion',
  evidence: 'assistant.fields.evidence',
  phase_key: 'assistant.fields.phase',
  actor_key: 'assistant.fields.actor',
  kind: 'assistant.fields.kind',
  content: 'assistant.fields.content',
  offset_minutes: 'assistant.fields.minute',
  objective_ids: 'assistant.fields.objectives',
  attack_techniques: 'assistant.fields.techniques',
  expected_actions: 'assistant.fields.expectedActions',
  delivery_method: 'assistant.fields.deliveryMethod',
  recipients: 'assistant.fields.recipients',
  executive_summary: 'aar.executiveSummary',
  scenario_summary: 'aar.scenarioSummary',
  conclusions: 'aar.conclusions',
  strengths: 'aar.fields.strengths',
  improvements: 'aar.fields.improvements',
  analysis: 'aar.fields.analysis',
  action: 'assistant.fields.action',
  owner: 'assistant.fields.owner',
  owner_area: 'assistant.fields.ownerArea',
  objective_code: 'assistant.fields.objective',
  name: 'assistant.fields.name',
  headline: 'assistant.fields.headline',
  start_offset: 'assistant.fields.startMinute',
  end_offset: 'assistant.fields.endMinute',
  incident_jump_minutes: 'assistant.fields.incidentJump',
  situation_update: 'assistant.fields.situationUpdate',
  key_questions: 'assistant.fields.keyQuestions',
  type: 'assistant.fields.actorType',
  channel: 'assistant.fields.channel',
  played_by: 'assistant.fields.playedBy',
  mitre_group_id: 'assistant.fields.mitreGroup',
  aliases: 'assistant.fields.aliases',
  description: 'assistant.fields.description',
  threat_actor_key: 'assistant.fields.threatActor',
  attack_attribution: 'assistant.fields.attribution',
  techniques: 'assistant.fields.techniques',
  text: 'assistant.fields.text',
  criteria_p: 'creator.needs.outputs.ratings.P',
  criteria_s: 'creator.needs.outputs.ratings.S',
  criteria_m: 'creator.needs.outputs.ratings.M',
  criteria_u: 'creator.needs.outputs.ratings.U',
  eeg_id: 'assistant.fields.eeg',
  content_language: 'assistant.fields.contentLanguage',
  tlp: 'assistant.fields.tlp',
} as const
type FieldLabelKey = (typeof FIELD_LABEL_KEYS)[keyof typeof FIELD_LABEL_KEYS]

// Shown as the row's code, or left out: bookkeeping, not content.
const HIDDEN_FIELDS = new Set([
  'review_status',
  'capabilities_to_add',
  'origin',
  'origin_id',
  'origin_name',
])

/** The AI assistant's pending proposals for this page's rows, above the
 * form: what each would change, accepted into the page's draft (the
 * form's autosave persists it and the proposal is then marked applied)
 * or discarded. Read again on load and when the tab comes back into view;
 * no polling. `disabledReason` keeps Accept off with the reason shown
 * (a read-only MSEL, the confirmation dialog of an approved form open). */
export function ProposalsPanel<D>({
  ttxId,
  targets,
  draftRows,
  savedRows,
  codeOf,
  merge,
  apply,
  disabledReason,
  description,
  issueMessage,
  onAction,
  actionBlocked = null,
  autoApply = [],
}: {
  ttxId: string
  targets: ProposalTarget[]
  draftRows: Partial<Record<ProposalTarget, Row[]>>
  savedRows: Partial<Record<ProposalTarget, Row[]>>
  /** The code of a row the page shows, by id (NEED-01, PH-02...). */
  codeOf: (id: string) => string | undefined
  merge: (group: Proposal[], accepted: Record<string, string>) => Merge<D>
  apply: (patch: Partial<D>) => void
  disabledReason: string | null
  description?: string
  /** The page's own wording of its validation issues, so a proposal's
   * warnings read as the form's do (never a bare code). */
  issueMessage?: IssueMessage
  /** Runs a proposal that's an action, not an edit (a code reset): the
   * page's own flow, its dialog included. Applied once the saved document
   * shows it done. */
  onAction?: (proposal: Proposal) => void
  /** Why an action can't run now (unsaved changes...). */
  actionBlocked?: string | null
  /** Targets applied by a form of their own (Creator → Exercise's edit
   * form): marked applied whenever the saved row holds them, since the
   * panel isn't there while the form is open. */
  autoApply?: ProposalTarget[]
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const location = useLocation()
  const list = useApiResource<ProposalListResponse>(`/ttx/${ttxId}/assistant/proposals`, {
    background: true,
  })
  const { refetch } = list
  const [decided, setDecided] = useState<ReadonlySet<string>>(new Set())
  const [accepted, setAccepted] = useState<Record<string, string>>({})
  const [conflicts, setConflicts] = useState<{ merged: Merge<D>; group: Proposal[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Accepted on this page: the saved row as it stood then, so one that
  // comes back to pending after a save isn't asked about again, while one
  // whose confirmation was cancelled is (see `savedAgain`).
  const [acceptedFrom, setAcceptedFrom] = useState<Record<string, string>>({})
  // Accepted deletions a save went through after: a row still there then
  // was kept by the form (a seeded EEG point leaves only with its source).
  const [savedAfter, setSavedAfter] = useState<ReadonlySet<string>>(new Set())
  const acceptedIds = useRef<string[]>([])
  acceptedIds.current = Object.keys(acceptedFrom)
  useEffect(() => {
    function onSaved() {
      setSavedAfter((prev) => new Set([...prev, ...acceptedIds.current]))
    }
    window.addEventListener(ATTENTION_CHANGED_EVENT, onSaved)
    return () => window.removeEventListener(ATTENTION_CHANGED_EVENT, onSaved)
  }, [])
  // Why closing one that came back failed, by proposal.
  const [stuck, setStuck] = useState<Record<string, string>>({})
  const [confirmDiscardAll, setConfirmDiscardAll] = useState(false)
  // Proposals unticked in their row's group (all are ticked at first).
  const [unselected, setUnselected] = useState<ReadonlySet<string>>(new Set())
  const marking = useRef(new Set<string>())

  /** Records it as applied to that saved row, once; off the list after. */
  async function markApplied(proposal: Proposal, rowId: string): Promise<void> {
    if (marking.current.has(proposal.id)) return
    marking.current.add(proposal.id)
    try {
      await apiFetch(`/ttx/${ttxId}/assistant/proposals/${proposal.id}/applied`, {
        method: 'POST',
        body: JSON.stringify({ row_id: rowId }),
      })
      setDecided((prev) => new Set(prev).add(proposal.id))
      window.dispatchEvent(new Event(PROPOSALS_CHANGED_EVENT))
    } catch (err) {
      marking.current.delete(proposal.id)
      throw err
    }
  }

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') refetch()
    }
    document.addEventListener('visibilitychange', onVisible)
    // Back from the AI client, a window focus brings its new proposals,
    // and so does the header noticing them while the page is open.
    window.addEventListener('focus', refetch)
    window.addEventListener(PROPOSALS_ARRIVED_EVENT, refetch)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refetch)
      window.removeEventListener(PROPOSALS_ARRIVED_EVENT, refetch)
    }
  }, [refetch])

  const items = (list.data?.items ?? []).filter(
    (p) => targets.includes(p.target) && !decided.has(p.id),
  )
  // Where each accepted one stands, from the page's own rows.
  const states = new Map(
    items
      .filter((p) => accepted[p.id])
      .map((p) => [
        p.id,
        acceptedState(p, accepted[p.id], draftRows[p.target] ?? [], savedRows[p.target] ?? []),
      ]),
  )
  const isAccepted = (p: Proposal) => {
    const state = states.get(p.id)
    return !!state && state.state !== 'gone'
  }
  const pending = items.filter((p) => !isAccepted(p))
  const toMark = items
    .map((p) => ({ proposal: p, state: states.get(p.id) }))
    .filter(
      (entry): entry is { proposal: Proposal; state: { state: 'saved'; rowId: string } } =>
        entry.state?.state === 'saved',
    )
  const markKey = toMark.map((entry) => `${entry.proposal.id}:${entry.state.rowId}`).join(',')

  // Saved by the form: recorded as applied (once), then off the list.
  useEffect(() => {
    for (const { proposal, state } of toMark) {
      markApplied(proposal, state.rowId).catch(() => undefined)
    }
    // markKey names exactly the rows to mark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markKey, ttxId])

  // The person's proposals waiting on other pages of the exercise.
  const others = (list.data?.items ?? []).filter(
    (p) => !targets.includes(p.target) && !decided.has(p.id),
  )
  const inCreator = location.pathname.startsWith('/creator/')

  /** A Creator section, as a link while the page is in Creator. */
  function sectionRef(section: ProposalSection) {
    const name = t(SECTION_TITLE_KEYS[section])
    return inCreator ? (
      <Link className={linkAccent} to={`/creator/${ttxId}/${section}`}>
        {name}
      </Link>
    ) : (
      name
    )
  }

  // Actions done: a code reset whose kind now follows the order.
  const actionsDone = items.filter(
    (p) =>
      p.target === 'msel_renumber' &&
      (savedRows.msel_renumber ?? []).some(
        (row) =>
          row.id === p.target_id &&
          !((row as Record<string, unknown>).out_of_order as string[] | undefined)?.includes(
            p.patch.kind as string,
          ),
      ),
  )
  for (const p of items) {
    if (
      autoApply.includes(p.target) &&
      !actionsDone.includes(p) &&
      heldBySaved(p, savedRows[p.target] ?? [], savedRows[p.target] ?? [])
    ) {
      actionsDone.push(p)
    }
  }
  const actionsKey = actionsDone.map((p) => p.id).join(',')
  useEffect(() => {
    for (const p of actionsDone) markApplied(p, p.target_id as string).catch(() => undefined)
    // actionsKey names exactly the proposals to mark.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionsKey])

  if (items.length === 0) return null
  // Still to decide: not accepted, nor back after a save (closed apart).
  // An action runs on its own (its own dialog): never in Accept all.
  const actionable = pending.filter((p) => !savedAgain(p) && !isAction(p))
  // A long list reads as titles; each one's changes open on demand.
  const folded = items.length > 3
  // By item: the proposals on one saved row (INJ-27) side by side, an
  // EEG's observation points under their objective (OBJ-01); any other new
  // row on its own.
  const groups: Proposal[][] = []
  const byRow = new Map<string, Proposal[]>()
  for (const p of items) {
    const row = `${p.changeset ?? ''}|${itemOf(p) ?? p.id}`
    const group = byRow.get(row)
    if (group) group.push(p)
    else {
      const fresh = [p]
      byRow.set(row, fresh)
      groups.push(fresh)
    }
  }

  // By changeset: a set the assistant named, decided together; the rest
  // after, on their own.
  const sections: { name: string | null; groups: Proposal[][] }[] = []
  for (const group of groups) {
    const name = group[0].changeset ?? null
    const section = sections.find((x) => x.name === name)
    if (section) section.groups.push(group)
    else sections.push({ name, groups: [group] })
  }
  sections.sort((a, b) => (a.name === null ? 1 : 0) - (b.name === null ? 1 : 0))

  /** The saved row an update targets, as text ('' when there's none). */
  function savedSnapshot(p: Proposal): string {
    const row = (savedRows[p.target] ?? []).find((r) => r.id === p.target_id)
    return row ? JSON.stringify(row) : ''
  }

  function commit(merged: Merge<D>, group: Proposal[]) {
    apply(merged.patch)
    setAccepted((prev) => ({ ...prev, ...merged.keys }))
    setAcceptedFrom((prev) => {
      const next = { ...prev }
      for (const p of group) next[p.id] = savedSnapshot(p)
      return next
    })
    if (merged.missing.length > 0) setError(t('assistant.rowGone'))
  }

  /** Accepted on this page, back to pending although its row is saved: the
   * page couldn't tell the save holds it. Closed with one action, never
   * asked for approval again. */
  function savedAgain(p: Proposal): boolean {
    if (!(p.id in acceptedFrom) || isAccepted(p)) return false
    if (p.operation === 'delete') return savedAfter.has(p.id)
    if (p.operation !== 'update') return false
    const now = savedSnapshot(p)
    return now !== '' && now !== acceptedFrom[p.id]
  }

  function accept(proposal: Proposal) {
    acceptGroup(withDependencies(proposal, pending))
  }

  /** Every proposal still to decide, each after the ones it needs: one
   * merge, so one question from the editor and one save. */
  function acceptAll() {
    acceptMany(actionable)
  }

  /** These proposals, each after the ones it needs, in one merge. Those
   * left behind are ticked again, ready for their own decision. */
  function acceptMany(list: Proposal[]) {
    setUnselected(new Set())
    const group: Proposal[] = []
    const seen = new Set<string>()
    for (const p of list) {
      for (const q of withDependencies(p, pending)) {
        if (!seen.has(q.id)) {
          seen.add(q.id)
          group.push(q)
        }
      }
    }
    acceptGroup(group)
  }

  async function discardAll() {
    setConfirmDiscardAll(false)
    await discardMany(actionable)
  }

  async function discardMany(list: Proposal[]) {
    setError(null)
    const gone = new Set<string>()
    try {
      for (const p of list) {
        if (gone.has(p.id)) continue
        const result = await apiFetch<{ discarded: string[] }>(
          `/ttx/${ttxId}/assistant/proposals/${p.id}/discard`,
          { method: 'POST' },
        )
        for (const id of result.discarded) gone.add(id)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    }
    setDecided((prev) => new Set([...prev, ...gone]))
    if (gone.size > 0) {
      window.dispatchEvent(new Event(PROPOSALS_CHANGED_EVENT))
      showToast(t('assistant.discarded', { count: gone.size }))
    }
  }

  function acceptGroup(group: Proposal[]) {
    setError(null)
    // What the saved document already holds changes nothing: applied now.
    const held = new Map<string, string>()
    for (const p of group) {
      const rowId = heldBySaved(p, draftRows[p.target] ?? [], savedRows[p.target] ?? [])
      if (rowId) held.set(p.id, rowId)
    }
    for (const p of group) {
      const rowId = held.get(p.id)
      if (rowId) markApplied(p, rowId).catch(() => setError(t('auth.common.genericError')))
    }
    const rest = group.filter((p) => !held.has(p.id))
    if (rest.length === 0) return
    const merged = merge(rest, accepted)
    if (merged.conflicts.length > 0) setConflicts({ merged, group: rest })
    else commit(merged, rest)
  }

  async function closeSaved(proposal: Proposal) {
    setError(null)
    try {
      await markApplied(proposal, proposal.target_id as string)
    } catch (err) {
      setStuck((prev) => ({
        ...prev,
        [proposal.id]: err instanceof ApiError ? err.message : t('auth.common.genericError'),
      }))
    }
  }

  async function discard(proposal: Proposal) {
    setError(null)
    try {
      const result = await apiFetch<{ discarded: string[] }>(
        `/ttx/${ttxId}/assistant/proposals/${proposal.id}/discard`,
        { method: 'POST' },
      )
      setDecided((prev) => new Set([...prev, ...result.discarded]))
      window.dispatchEvent(new Event(PROPOSALS_CHANGED_EVENT))
      showToast(t('assistant.discarded', { count: result.discarded.length }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    }
  }

  function show(field: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return '—'
    if (Array.isArray(value)) {
      return (
        value
          .map((v) => {
            if (typeof v === 'string') {
              if (v.startsWith(PROPOSAL_REF)) return proposedLabel(v)
              return codeOf(v) ?? v
            }
            if (v && typeof v === 'object') {
              const item = v as Record<string, unknown>
              return String(
                item.technique_id ?? item.description ?? item.name ?? JSON.stringify(item),
              )
            }
            return String(v)
          })
          .join(', ') || '—'
      )
    }
    if (typeof value === 'string') {
      if (value.startsWith(PROPOSAL_REF)) return proposedLabel(value)
      if (field.endsWith('_key')) return codeOf(value) ?? value
      return enumLabel(field, value) ?? value
    }
    return String(value)
  }

  /** The form's own label for a closed value (a priority, a capability). */
  function enumLabel(field: string, value: string): string | null {
    if (field === 'source') return t(`creator.needs.needSources.${value as NeedSource}`)
    if (field === 'priority') return t(`creator.needs.priorities.${value as NeedPriority}`)
    if (field === 'capability' || field === 'affected_capability') {
      return t(`creator.needs.capabilities.${value as Capability}`)
    }
    if (field === 'kind') return t(`creator.msel.kinds.${value as InjectKind}`)
    if (field === 'delivery_method' || field === 'channel') {
      return t(`creator.msel.deliveryMethods.${value as DeliveryMethod}`)
    }
    if (field === 'type') return t(`creator.msel.actorTypes.${value as ActorType}`)
    if (field === 'attack_attribution') {
      return t(`creator.msel.attribution.${value as 'threat_actor' | 'noise'}`)
    }
    if (field === 'format') return t(`creator.msel.formats.${value as 'inject' | 'poll'}`)
    if (field === 'tlp') return `TLP:${value.replace('_', '+').toUpperCase()}`
    if (field === 'content_language' && (value === 'en' || value === 'es')) {
      return t(LANGUAGE_NAME_KEYS[value])
    }
    return null
  }

  function fieldLabel(field: string): string {
    const key = (FIELD_LABEL_KEYS as Record<string, FieldLabelKey | undefined>)[field]
    if (key) return t(key)
    // Else the form's own label for it, never the field's internal name.
    const forms = [
      t('creator.msel.fields', { returnObjects: true }),
      t('creator.needs.fields', { returnObjects: true }),
    ] as Record<string, unknown>[]
    for (const labels of forms) {
      if (typeof labels[field] === 'string') return labels[field] as string
    }
    const words = field.replaceAll('_', ' ')
    return words.charAt(0).toUpperCase() + words.slice(1)
  }

  /** A row another pending proposal creates, by what it will be called. */
  function proposedLabel(ref: string): string {
    const id = ref.slice(PROPOSAL_REF.length)
    const other = (list.data?.items ?? []).find((p) => p.id === id)
    const name = other?.patch.name ?? other?.patch.title
    return typeof name === 'string' && name
      ? t('assistant.proposedNamed', { name })
      : t('assistant.proposedRow')
  }

  /** Pending proposals this one needs that wait on another page. */
  function outsideDeps(proposal: Proposal): Proposal[] {
    return proposal.depends_on
      .map((id) => others.find((p) => p.id === id))
      .filter((p): p is Proposal => p !== undefined)
  }

  /** The item a proposal belongs to, to group by: its row, or for an
   * observation point the objective whose EEG holds it. */
  function itemOf(p: Proposal): string | null {
    if (isAction(p)) return null
    if (p.target === 'eeg_point') {
      const objective = codeOf(String(p.target_id ?? p.patch.eeg_id ?? ''))
      return objective ? `eeg:${objective}` : null
    }
    return p.operation !== 'create' && p.target_id ? `${p.target}:${p.target_id}` : null
  }

  /** A group's heading: its row's, or the EEG it's in. */
  function groupTitle(first: Proposal): string {
    if (first.target === 'eeg_point') {
      return t('assistant.eegGroup', {
        code: codeOf(String(first.target_id ?? first.patch.eeg_id ?? '')) ?? '',
      })
    }
    return title(first)
  }

  function isAction(p: Proposal): boolean {
    return p.target === 'msel_renumber'
  }

  function title(proposal: Proposal): string {
    if (proposal.target === 'msel_renumber') {
      return t(
        `creator.msel.renumber.${proposal.patch.kind as 'phases' | 'injects' | 'threat_actors'}`,
      )
    }
    const code = proposal.target_id ? codeOf(proposal.target_id) : undefined
    const target = t(TARGET_LABEL_KEYS[proposal.target])
    if (proposal.operation === 'create') return t('assistant.create', { target })
    if (proposal.operation === 'delete') return t('assistant.remove', { target, code: code ?? '' })
    if (proposal.target === 'needs_scope') return t('assistant.changeScope')
    if (proposal.target === 'needs_tlp') return t('assistant.changeTlp')
    if (proposal.target === 'ttx_meta') return t('assistant.changeExercise')
    if (proposal.target === 'msel_meta') return t('assistant.changeMselSettings')
    return t('assistant.update', { target, code: code ?? '' })
  }

  /** What a deletion takes away, as the person knows the row. */
  function removedName(proposal: Proposal): string {
    const row = [...(draftRows[proposal.target] ?? []), ...(savedRows[proposal.target] ?? [])].find(
      (r) => r.id === proposal.target_id,
    ) as Record<string, unknown> | undefined
    const name = row?.title ?? row?.name ?? row?.text ?? row?.statement ?? row?.action
    return typeof name === 'string' ? name : ''
  }

  function choose(id: string, chosen: boolean) {
    setUnselected((prev) => {
      const next = new Set(prev)
      if (chosen) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** A change as it reads: a list's members added (+) and taken out (−),
   * any other value struck through, then the new one. */
  function change(field: string, before: unknown, after: unknown, delta: ListDelta | null) {
    if (delta) {
      return (
        <span className="flex flex-wrap gap-x-3 gap-y-0.5">
          {delta.added.map((v) => (
            <span key={`+${show(field, [v])}`}>+ {show(field, [v])}</span>
          ))}
          {delta.removed.map((v) => (
            <span key={`-${show(field, [v])}`} className="line-through opacity-60">
              − {show(field, [v])}
            </span>
          ))}
          {delta.added.length + delta.removed.length === 0 && '—'}
        </span>
      )
    }
    return (
      <>
        {before !== undefined && (
          <>
            <span className="line-through opacity-60">{show(field, before)}</span> →{' '}
          </>
        )}
        {show(field, after)}
      </>
    )
  }

  /** A warning the proposal would add, as the form words it; inside the
   * proposal, the row it's about goes without saying. */
  function issueText(proposal: Proposal, issue: Proposal['issues'][number]): string {
    if (!issueMessage) return issue.code
    const item =
      issue.item && !issue.item.startsWith(PROPOSAL_REF) ? issue.item : proposal.target_id
    const asIssue = { code: issue.code, section: 0, field: issue.field, item_id: item }
    let text = issueMessage(asIssue)
    const label = issueMessage.item?.(asIssue)
    if (label && text.startsWith(`${label}: `)) text = text.slice(label.length + 2)
    if (text.startsWith(': ')) text = text.slice(2)
    return text.charAt(0).toUpperCase() + text.slice(1)
  }

  /** One proposal: what it changes, why, and (alone) its own actions; in a
   * group, a checkbox instead, and the group's actions decide. */
  function renderProposal(proposal: Proposal, inGroup: boolean, position = 1) {
    const accepted = isAccepted(proposal)
    const fields = Object.entries(proposal.patch).filter(([f]) => !HIDDEN_FIELDS.has(f))
    const deps = withDependencies(proposal, pending).length - 1
    return (
      <>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {inGroup ? (
            <label className="inline-flex items-center gap-2 font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 accent-accent-fg"
                disabled={accepted || savedAgain(proposal)}
                checked={!accepted && !savedAgain(proposal) && !unselected.has(proposal.id)}
                onChange={(e) => choose(proposal.id, e.target.checked)}
              />
              {proposal.summary ||
                (proposal.target === 'eeg_point'
                  ? title(proposal)
                  : t('assistant.proposalNumber', { number: position }))}
            </label>
          ) : (
            <span className="font-medium">{title(proposal)}</span>
          )}
          {proposal.outdated && <span className={badgeNeutral}>{t('assistant.outdated')}</span>}
          {accepted && <span className={badgeNeutral}>{t('assistant.acceptedUnsaved')}</span>}
          {savedAgain(proposal) && (
            <span className={badgeNeutral}>
              {t(
                proposal.operation === 'delete' ? 'assistant.keptByForm' : 'assistant.alreadySaved',
              )}
            </span>
          )}
        </div>
        {inGroup && proposal.operation === 'delete' ? (
          <p className="pl-6 text-sm">
            {t('assistant.removes', { name: removedName(proposal) || title(proposal) })}
          </p>
        ) : inGroup ? (
          <dl className="grid gap-x-4 gap-y-1 pl-6 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
            {fields.map(([field, value]) => (
              <div key={field} className="contents">
                <dt className="text-paper-ink/60 dark:text-fg-muted">{fieldLabel(field)}</dt>
                <dd className="min-w-0 break-words">
                  {change(field, proposal.base?.[field], value, listDelta(proposal, field, value))}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <>
            {proposal.summary && (
              <p className="max-w-prose text-sm text-paper-ink/70 dark:text-fg-muted">
                {proposal.summary}
              </p>
            )}
            {proposal.target === 'needs_tlp' && (
              <p className="max-w-prose text-sm">{t('assistant.tlpNote')}</p>
            )}
            {isAction(proposal) ? (
              <p className="max-w-prose text-sm text-paper-ink/70 dark:text-fg-muted">
                {t(
                  proposal.patch.kind === 'injects'
                    ? 'creator.msel.renumber.injectsHint'
                    : 'creator.msel.renumber.hint',
                )}
              </p>
            ) : proposal.operation === 'delete' ? (
              <p className="text-sm">
                {t('assistant.removes', { name: removedName(proposal) || title(proposal) })}
              </p>
            ) : (
              <details open={!folded} className="text-sm">
                <summary className={`${linkAccent} cursor-pointer text-[13px]`}>
                  {t('assistant.changes', { count: fields.length })}
                </summary>
                <dl className="mt-1 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[minmax(8rem,auto)_1fr]">
                  {fields.map(([field, value]) => (
                    <div key={field} className="contents">
                      <dt className="text-paper-ink/60 dark:text-fg-muted">{fieldLabel(field)}</dt>
                      <dd className="min-w-0 break-words">
                        {change(
                          field,
                          proposal.base && field in proposal.base
                            ? proposal.base[field]
                            : undefined,
                          value,
                          listDelta(proposal, field, value),
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </>
        )}
        {Boolean(proposal.evidence?.length) && (
          <div className="text-sm">
            <p className="text-paper-ink/60 dark:text-fg-muted">{t('assistant.evidence.title')}</p>
            <ul className="mt-1 space-y-0.5">
              {proposal.evidence?.map((item) => (
                <li key={`${item.kind}-${item.ref}`} className="min-w-0 break-words">
                  {item.kind === 'inject' || item.kind === 'action' ? (
                    <CodeRef code={item.ref} title={item.label} />
                  ) : (
                    <>
                      <span className="text-paper-ink/60 dark:text-fg-muted">
                        {t(EVIDENCE_LABEL_KEYS[item.kind])}:
                      </span>{' '}
                      {item.label}
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {outsideDeps(proposal).map((dep) => (
          <p
            key={dep.id}
            className={`text-sm text-paper-ink/70 dark:text-fg-muted ${inGroup ? 'pl-6' : ''}`}
          >
            {t('assistant.acceptFirst', { name: dep.summary || title(dep) })}{' '}
            {sectionRef(PROPOSAL_SECTIONS[dep.target])}.
          </p>
        ))}
        {proposal.issues.length > 0 && (
          <div className={`text-sm ${inGroup ? 'pl-6' : ''}`}>
            <p className="text-paper-ink/60 dark:text-fg-muted">{t('assistant.warningsTitle')}</p>
            <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
              {proposal.issues.map((issue) => (
                <li key={`${issue.code}-${issue.field ?? ''}-${issue.item ?? ''}`}>
                  {issueText(proposal, issue)}
                </li>
              ))}
            </ul>
          </div>
        )}
        {savedAgain(proposal) && proposal.operation === 'delete' && (
          <div className="space-y-2">
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('assistant.keptByFormBody')}
            </p>
            <button type="button" className={btnSecondary} onClick={() => void discard(proposal)}>
              {t('assistant.discard')}
            </button>
          </div>
        )}
        {savedAgain(proposal) && proposal.operation !== 'delete' && (
          <div className="space-y-2">
            {stuck[proposal.id] && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {stuck[proposal.id]}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {stuck[proposal.id] ? (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => void discard(proposal)}
                >
                  {t('assistant.discard')}
                </button>
              ) : (
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => void closeSaved(proposal)}
                >
                  {t('assistant.closeSaved')}
                </button>
              )}
            </div>
          </div>
        )}
        {!inGroup && !accepted && !savedAgain(proposal) && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={
                disabledReason !== null || (isAction(proposal) && (actionBlocked ?? null) !== null)
              }
              title={isAction(proposal) ? (actionBlocked ?? undefined) : undefined}
              onClick={() => (isAction(proposal) ? onAction?.(proposal) : accept(proposal))}
            >
              {deps > 0 ? t('assistant.acceptWith', { count: deps }) : t('assistant.accept')}
            </button>
            <button type="button" className={btnSecondary} onClick={() => void discard(proposal)}>
              {t('assistant.discard')}
            </button>
          </div>
        )}
      </>
    )
  }

  /** What the ticked proposals do to their row together: one line per
   * field, lists showing every member they add. */
  function combined(first: Proposal, chosen: Proposal[]) {
    const row = (draftRows[first.target] ?? []).find((r) => r.id === first.target_id) as
      Record<string, unknown> | undefined
    if (!row) return null
    if (chosen.some((p) => p.operation === 'delete')) {
      return (
        <p className="text-sm font-medium">
          {t('assistant.removes', { name: removedName(first) })}
        </p>
      )
    }
    const after = chosen.reduce<Record<string, unknown>>((r, p) => patchRow(r, p), { ...row })
    const fields = [...new Set(chosen.flatMap((p) => Object.keys(p.patch)))].filter(
      (f) => !HIDDEN_FIELDS.has(f),
    )
    return (
      <div className="text-sm">
        <p className="font-medium">{t('assistant.together')}</p>
        <dl className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-[minmax(8rem,auto)_1fr]">
          {fields.map((field) => (
            <div key={field} className="contents">
              <dt className="text-paper-ink/60 dark:text-fg-muted">{fieldLabel(field)}</dt>
              <dd className="min-w-0 break-words">
                {change(field, row[field], after[field], compareLists(row[field], after[field]))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }

  function renderAny(group: Proposal[]) {
    return group.length > 1 ? (
      renderGroup(group)
    ) : (
      <li key={group[0].id} className="space-y-2 py-3 first:pt-0">
        {renderProposal(group[0], false)}
      </li>
    )
  }

  /** A changeset's name, how many it holds, and its actions for all of them. */
  function renderChangesetHeader(name: string, members: Proposal[]) {
    const open = members.filter((p) => !isAccepted(p) && !savedAgain(p))
    // What of the set waits on other pages: accepted there, with their form.
    const away = Object.entries(countBySection(others.filter((p) => p.changeset === name)))
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <p>
            <span className="font-medium">{t('assistant.changeset', { name })}</span>{' '}
            <span className="text-paper-ink/60 dark:text-fg-muted">
              · {t('assistant.groupCount', { count: members.length })}
            </span>
          </p>
          {away.map(([section, count]) => (
            <p key={section} className="text-paper-ink/70 dark:text-fg-muted">
              {t('assistant.changesetElsewhere', { count })}{' '}
              {sectionRef(section as ProposalSection)}.
            </p>
          ))}
        </div>
        {open.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={disabledReason !== null}
              onClick={() => acceptMany(open)}
            >
              {t('assistant.acceptGroup', { count: open.length })}
            </button>
            <button type="button" className={btnSecondary} onClick={() => void discardMany(open)}>
              {t('assistant.discardGroup')}
            </button>
          </div>
        )}
      </div>
    )
  }

  /** Several proposals on one row (INJ-27): decided together, all or the
   * ones ticked. */
  function renderGroup(group: Proposal[]) {
    const open = group.filter((p) => !isAccepted(p) && !savedAgain(p))
    const chosen = open.filter((p) => !unselected.has(p.id))
    const all = chosen.length === open.length
    return (
      <li key={`group-${group[0].id}`} className="space-y-3 py-3 first:pt-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            <span className="font-medium">{groupTitle(group[0])}</span>{' '}
            <span className="text-paper-ink/60 dark:text-fg-muted">
              · {t('assistant.groupCount', { count: group.length })}
            </span>
          </p>
          {open.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={btnPrimary}
                disabled={disabledReason !== null || chosen.length === 0}
                onClick={() => acceptMany(chosen)}
              >
                {all
                  ? t('assistant.acceptGroup', { count: chosen.length })
                  : t('assistant.acceptSelected', { count: chosen.length })}
              </button>
              <button
                type="button"
                className={btnSecondary}
                disabled={chosen.length === 0}
                onClick={() => void discardMany(chosen)}
              >
                {all ? t('assistant.discardGroup') : t('assistant.discardSelected')}
              </button>
            </div>
          )}
        </div>
        {chosen.length > 1 &&
          chosen.every((p) => p.target_id && p.target_id === group[0].target_id) &&
          combined(group[0], chosen)}
        <ul className="space-y-3 border-l border-panel-line pl-4">
          {group.map((p, index) => (
            <li key={p.id} className="space-y-2">
              {renderProposal(p, true, index + 1)}
            </li>
          ))}
        </ul>
      </li>
    )
  }

  return (
    <Panel
      title={t('assistant.title')}
      meta={t('assistant.count', { count: pending.length })}
      description={description ?? t('assistant.description')}
      aside={
        actionable.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={btnPrimary}
              disabled={disabledReason !== null}
              onClick={acceptAll}
            >
              {t('assistant.acceptAll', { count: actionable.length })}
            </button>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setConfirmDiscardAll(true)}
            >
              {t('assistant.discardAll')}
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {others.length > 0 && (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('assistant.elsewhere')}{' '}
            {Object.entries(countBySection(others)).map(([section, count], i) => (
              <span key={section}>
                {i > 0 && ' · '}
                {sectionRef(section as ProposalSection)} ({count})
              </span>
            ))}
          </p>
        )}
        {disabledReason && (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{disabledReason}</p>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <ul className="divide-y divide-panel-line">
          {sections.map((section) =>
            section.name === null ? (
              section.groups.map(renderAny)
            ) : (
              <li key={`changeset-${section.name}`} className="space-y-2 py-3 first:pt-0">
                {renderChangesetHeader(section.name, section.groups.flat())}
                <ul className="divide-y divide-panel-line">{section.groups.map(renderAny)}</ul>
              </li>
            ),
          )}
        </ul>
      </div>
      {confirmDiscardAll && (
        <Modal titleId="assistant-discard-all-title" onClose={() => setConfirmDiscardAll(false)}>
          <h2 id="assistant-discard-all-title" className="text-lg font-semibold tracking-tight">
            {t('assistant.discardAllTitle')}
          </h2>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('assistant.discardAllBody', { count: actionable.length })}
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setConfirmDiscardAll(false)}
            >
              {t('common.confirmButton.cancel')}
            </button>
            <button type="button" className={btnPrimary} onClick={() => void discardAll()}>
              {t('assistant.discardAll')}
            </button>
          </div>
        </Modal>
      )}
      {conflicts && (
        <Modal titleId="assistant-conflict-title" onClose={() => setConflicts(null)}>
          <h2 id="assistant-conflict-title" className="text-lg font-semibold tracking-tight">
            {t('assistant.conflictTitle')}
          </h2>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('assistant.conflictBody')}
          </p>
          <ul className="space-y-1 text-sm">
            {conflicts.merged.conflicts.map((conflict: Conflict) => (
              <li key={`${conflict.proposalId}-${conflict.field}`}>
                <span className="font-medium">{fieldLabel(conflict.field)}</span>:{' '}
                {show(conflict.field, conflict.current)} → {show(conflict.field, conflict.proposed)}
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <button type="button" className={btnSecondary} onClick={() => setConflicts(null)}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="button"
              className={btnPrimary}
              onClick={() => {
                commit(conflicts.merged, conflicts.group)
                setConflicts(null)
              }}
            >
              {t('assistant.conflictConfirm')}
            </button>
          </div>
        </Modal>
      )}
    </Panel>
  )
}
