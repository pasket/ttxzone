import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../hooks/useToast'
import {
  emptyActorFields,
  saveActorToOrganization,
  type ActorFields,
} from '../../../lib/actorLibrary'
import { ApiError } from '../../../lib/api'
import {
  btnNeutralIconGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
  linkAccent,
} from '../../../lib/buttonStyles'
import { codeRefText } from '../../../lib/codeRef'
import {
  ACTOR_TYPES,
  DELIVERY_METHODS,
  formatIncident,
  formatOffset,
  formatSpan,
  incidentMinutesAt,
  INJECT_FORMATS,
  INJECT_SECTIONS,
  injectSteps,
  pollLetter,
  injectSectionIssues,
  injectSectionStatus,
  MAX_EXPECTED_ACTIONS,
  mselFieldId,
  newMselKey,
  nextOffsetIn,
  orderedInjects,
  branchesFrom,
  validRejoin,
  toNumber,
  type ActionDraft,
  type ActorDraft,
  type InjectDraft,
  type InjectSection,
  type MselDraft,
} from '../../../lib/msel'
import type {
  ActorType,
  AttackCatalog,
  DeliveryMethod,
  InjectFormat,
  InjectKind,
  MselNeedsContext,
  MselRoom,
} from '../../../lib/types'
import { CodeRef } from '../../common/CodeRef'
import { FormattedTextArea } from '../../common/FormattedTextArea'
import { IconButton } from '../../common/IconButton'
import { Modal } from '../../common/Modal'
import { RadioCards } from '../../common/RadioCards'
import { Switch } from '../../common/Switch'
import { ActorLibraryPicker } from '../../templates/ActorLibraryPicker'
import { CopiedFrom } from '../../templates/ActorFormModal'
import { Field, ListInput, Select, TextArea, TextInput } from '../needs/fields'
import { RowDialog } from '../needs/RowDialog'
import { InjectArtifactField } from './InjectArtifactField'
import { InjectAttackField } from './InjectAttackField'
import { InjectFilesField } from './InjectFilesField'
import { InjectFormatChooser } from './InjectFormatChooser'
import { InjectImagesField } from './InjectImagesField'
import { InjectPollFields } from './InjectPollFields'
import { METER_LEVEL_KEYS } from './meterLevels'
import { InjectRooms } from './InjectRooms'
import { objectiveName } from '../../../lib/needsForm'

/** A step's copy: a discussion inject's Evaluation step is its discussion
 * points. */
function sectionCopyKey(section: InjectSection, format: InjectFormat) {
  return section === 'evaluates' && format === 'discussion' ? 'discussion' : section
}

/** "{{index}}" placeholders filled from `values`. */
function interpolate(text: string, values: Record<string, string | number> = {}): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => String(values[key] ?? ''))
}

/** Fields of each step, so a summary entry (or a field id) opens the
 * dialog on the step that holds it. */
/** Mirrors the backend's LongText limit on the inject text. */
const CONTENT_MAX = 5000

const STEP_FIELDS: Record<InjectSection, readonly string[]> = {
  what: [
    'phase_key',
    'kind',
    'title',
    'content',
    'offset_minutes',
    'trigger_condition',
    'contingent_purpose',
    'branch_from_key',
    'branch_action_key',
    'rejoin_key',
    'fires_at_minute',
    'images',
    'files',
  ],
  who: ['actor_key', 'delivery_method', 'recipients', 'room_ids', 'attachment_notes'],
  evaluates: [
    'objective_ids',
    'expected_actions',
    'description',
    'responsible_role',
    'expected_within_minutes',
  ],
  poll: ['poll_question', 'poll_options', 'poll_outcomes', 'poll_impacts'],
  attack: ['attack_attribution', 'threat_actor_key', 'attack_techniques'],
  review: ['facilitator_notes', 'review_status', 'validated_by'],
}

function stepOfFieldId(fieldId: string | null, format: InjectFormat): InjectSection {
  if (!fieldId) return 'what'
  const steps = injectSteps(format)
  // A poll has its rooms with the question, not with a sender.
  if (format === 'poll' && fieldId.startsWith('msel-room_ids-')) return 'poll'
  return (
    steps.find((section) =>
      STEP_FIELDS[section].some((field) => fieldId.startsWith(`msel-${field}-`)),
    ) ?? 'what'
  )
}

/** What a step's mark says on the rail: where it stands, from the same
 * rules as the report (injectSectionStatus) -- a step not visited yet that
 * still lacks something is just "not started", not an error. */
type StepMark = 'current' | 'done' | 'todo' | 'warn' | 'pending' | 'optional'

const MARK_GLYPH: Record<StepMark, string> = {
  current: '●',
  done: '✓',
  todo: '!',
  warn: '●',
  pending: '○',
  optional: '○',
}
const MARK_TONE: Record<StepMark, string> = {
  current: 'text-accent-fg',
  done: 'text-success-fg',
  todo: 'text-danger-fg',
  warn: 'text-inactive-1',
  pending: 'text-paper-ink/40 dark:text-fg-faint',
  optional: 'text-paper-ink/40 dark:text-fg-faint',
}

/** The inject, edited as a wizard. A new one starts by choosing its format,
 * which sets the steps (`injectSteps`): a rail on the left, each with its
 * state; one step at a time on the right; Back / Next below. Every
 * change goes straight into the MSEL draft (`onChange`), which autosaves
 * like the rest of the page -- so the dialog has Close, not Cancel, and a
 * new inject can be discarded. A new inject reaches the MSEL once it has a
 * title. `initialFocusId` (a field the validation summary points at) opens
 * the step that holds it. */
export function InjectDialog({
  initial,
  ttxId,
  draft,
  needs,
  rooms,
  catalog,
  readOnly,
  isNew,
  initialFocusId,
  saveStatus,
  onChange,
  onDraftPatch,
  onClose,
  onDiscard,
}: {
  initial: InjectDraft
  /** The exercise: where its images are uploaded and served. */
  ttxId: string
  draft: MselDraft
  needs: MselNeedsContext
  /** The exercise's rooms when it's played in rooms (else none: no field). */
  rooms: MselRoom[]
  catalog: AttackCatalog | null
  readOnly: boolean
  isNew: boolean
  initialFocusId: string | null
  /** The page's save state, shown in the dialog's header. */
  saveStatus?: ReactNode
  /** Every change: the inject as it stands and the senders created or
   * copied from the library meanwhile. */
  onChange: (inject: InjectDraft, newActors: ActorDraft[]) => void
  /** Other changes to the MSEL draft made from the dialog (a technique
   * added to a threat actor's profile). */
  onDraftPatch: (patch: Partial<MselDraft>) => void
  onClose: () => void
  /** A new inject already in the draft: take it out again (with Undo). */
  onDiscard: (inject: InjectDraft) => void
}) {
  const { t } = useTranslation()
  const { activeOrganizationId, activeOrganization, user } = useAuth()
  const { showToast } = useToast()
  const [inject, setInject] = useState(initial)
  const [newActors, setNewActors] = useState<ActorDraft[]>([])
  const [savingSender, setSavingSender] = useState(false)
  // The draft as it stands when a save to the library comes back (edits
  // may have landed while it was in flight).
  const latestDraft = useRef({ draft, onDraftPatch })
  useEffect(() => {
    latestDraft.current = { draft, onDraftPatch }
  })
  const [addingActor, setAddingActor] = useState<'new' | 'library' | null>(null)
  // A new inject starts by saying what it is.
  const [choosing, setChoosing] = useState(isNew && !readOnly)
  const [step, setStep] = useState<InjectSection>(() =>
    stepOfFieldId(initialFocusId, initial.format),
  )
  // Steps the user has been on: an untouched step isn't flagged yet. An
  // existing inject shows where every step really stands.
  const [visited, setVisited] = useState<Set<InjectSection>>(
    () => new Set(isNew ? [stepOfFieldId(initialFocusId, initial.format)] : INJECT_SECTIONS),
  )
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  const actors = [...draft.actors, ...newActors]
  const inDraft = draft.injects.some((i) => i.key === inject.key)
  const pending = t('creator.msel.table.pendingCode')
  const id = (field: string) => mselFieldId(field, inject.key)
  const areas = needs.participating_areas
  const thirdParties = needs.third_parties ?? []
  const startOf = (phaseKey: string) =>
    draft.phases.find((p) => p.key === phaseKey)?.start_offset ?? 0
  const statusOf = (section: InjectSection) => injectSectionStatus(inject, draft, section)
  const stepIssues = injectSectionIssues(inject, draft, step)
  // Looked up, not t(`...${key}`): issue keys are plain strings from lib/msel.
  const issueTexts = t('creator.msel.wizard.issues', { returnObjects: true }) as Record<
    string,
    string
  >

  // Into the draft as it goes (once there's a title to name it by).
  function commit(next: InjectDraft, nextActors = newActors) {
    setInject(next)
    if (!readOnly && (inDraft || next.title.trim() !== '')) onChange(next, nextActors)
  }
  const set = (patch: Partial<InjectDraft>) => commit({ ...inject, ...patch })

  function addActor(actor: ActorDraft) {
    const nextActors = [...newActors, actor]
    setNewActors(nextActors)
    // The new sender is the one this inject is for; its usual channel the
    // likely delivery method.
    commit(
      {
        ...inject,
        actor_key: actor.key,
        ...(actor.channel ? { delivery_method: actor.channel } : {}),
      },
      nextActors,
    )
  }

  /** The sender into the organization's library (a Program Manager of it
   * only), as it is; the exercise's actor becomes a copy of it, which the
   * autosave keeps. */
  async function saveSenderToLibrary(actor: ActorDraft) {
    if (!activeOrganizationId) return
    setSavingSender(true)
    try {
      const linked = { ...actor, ...(await saveActorToOrganization(activeOrganizationId, actor)) }
      if (newActors.some((a) => a.key === actor.key)) {
        const nextActors = newActors.map((a) => (a.key === actor.key ? linked : a))
        setNewActors(nextActors)
        commit(inject, nextActors)
      } else {
        const { draft: current, onDraftPatch: patch } = latestDraft.current
        patch({ actors: current.actors.map((a) => (a.key === actor.key ? linked : a)) })
      }
      showToast(t('templates.actors.savedToOrganization', { name: actor.name }))
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    } finally {
      setSavingSender(false)
    }
  }
  const sender = actors.find((a) => a.key === inject.actor_key)
  const canSaveSender =
    !readOnly &&
    Boolean(activeOrganization?.is_program_manager) &&
    sender !== undefined &&
    sender.origin !== 'organization'

  /** The inject's objectives change, and its actions follow: one it gains
   * every action evidences (untick where it doesn't), one it loses none
   * does. */
  function linkObjectives(objective_ids: string[]): Partial<InjectDraft> {
    const added = objective_ids.filter((o) => !inject.objective_ids.includes(o))
    return {
      objective_ids,
      expected_actions: inject.expected_actions.map((action) => ({
        ...action,
        objective_ids: objective_ids.filter(
          (o) => added.includes(o) || action.objective_ids.includes(o),
        ),
      })),
    }
  }

  /** Only an inject evaluates: the objective links go with any other
   * format, and a poll has no expected actions. A poll starts with two
   * options to fill in. */
  function formatPatch(format: InjectFormat): Partial<InjectDraft> {
    return {
      format,
      ...(format === 'inject' ? {} : linkObjectives([])),
      ...(format === 'poll'
        ? {
            expected_actions: [],
            poll_options: inject.poll_options.length ? inject.poll_options : ['', ''],
          }
        : {}),
    }
  }

  function setAction(index: number, patch: Partial<ActionDraft>) {
    set({
      expected_actions: inject.expected_actions.map((action, i) =>
        i === index ? { ...action, ...patch } : action,
      ),
    })
  }

  function goTo(next: InjectSection) {
    setStep(next)
    setVisited((current) => new Set([...current, next]))
  }

  // Focus: the field a summary entry pointed at on opening, the step's
  // heading on every change of step after that.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      if (initialFocusId) {
        document.getElementById(initialFocusId)?.focus()
        return
      }
    }
    headingRef.current?.focus({ preventScroll: true })
  }, [step, choosing, initialFocusId])

  const markOf = (section: InjectSection): StepMark => {
    if (section === step) return 'current'
    const status = statusOf(section)
    if (status === 'optional') return 'optional'
    if (status === 'done') return 'done'
    if (!visited.has(section)) return 'pending'
    return status
  }
  const steps = injectSteps(inject.format)
  const position = steps.indexOf(step)
  const previous = position > 0 ? steps[position - 1] : null
  const next = position < steps.length - 1 ? steps[position + 1] : null
  const stepKey = sectionCopyKey(step, inject.format)
  const stepTitle = (section: InjectSection) =>
    t(`creator.msel.injectSections.${sectionCopyKey(section, inject.format)}.title`)
  const title = inDraft
    ? codeRefText(
        draft.injects.find((i) => i.key === inject.key)?.code ?? '',
        inject.title,
        pending,
      )
    : t('creator.msel.dialogs.newInject')
  const phase = draft.phases.find((p) => p.key === inject.phase_key)
  // Validating needs the three steps the review can't do without.
  const blockers = steps.filter(
    (section) => section !== 'attack' && section !== 'review' && statusOf(section) === 'todo',
  )

  if (choosing) {
    return (
      <Modal titleId="msel-inject-dialog-title" onClose={onClose} size="xl" align="top">
        <InjectFormatChooser
          titleId="msel-inject-dialog-title"
          onChoose={(format) => {
            setInject({ ...inject, ...formatPatch(format) })
            setChoosing(false)
          }}
          onClose={onClose}
        />
      </Modal>
    )
  }

  const roomsField = rooms.length > 0 && (
    <ToggleChips
      id={id('room_ids')}
      legend={t('creator.msel.fields.room_ids')}
      hint={t('creator.msel.hints.room_ids')}
      options={[
        { value: ALL_ROOMS, label: t('creator.msel.rooms.all'), text: '' },
        ...rooms.map((room) => ({
          value: room.id,
          label: <CodeRef code={room.code} title={room.name} />,
          text: codeRefText(room.code, room.name),
        })),
      ]}
      selected={inject.room_ids.length ? inject.room_ids : [ALL_ROOMS]}
      onChange={(chosen) =>
        // "All rooms" is exclusive: picking it clears the rooms, picking a
        // room clears it; none left is all again.
        set({
          room_ids:
            chosen.includes(ALL_ROOMS) && inject.room_ids.length > 0
              ? []
              : chosen.filter((value) => value !== ALL_ROOMS),
        })
      }
    />
  )

  return (
    <Modal titleId="msel-inject-dialog-title" onClose={onClose} size="xl" align="top">
      <div className="flex items-start justify-between gap-3">
        <h2
          id="msel-inject-dialog-title"
          className="min-w-0 text-balance text-lg font-semibold tracking-tight"
        >
          {inDraft ? t('creator.msel.dialogs.injectTitle', { code: title }) : title}
        </h2>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          {!readOnly && saveStatus}
          {/* Everything is already in: close from any step. */}
          <button
            type="button"
            onClick={onClose}
            aria-label={t('creator.msel.wizard.closeDialog')}
            title={t('creator.msel.wizard.closeDialog')}
            className={btnNeutralIconGhost}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ×
            </span>
          </button>
        </div>
      </div>
      {readOnly && (
        // Why nothing here can change, and the way out: the page says it at
        // the top, out of view once an inject is open.
        <div
          role="status"
          className="mt-3 rounded-sm border border-paper-line bg-hover/40 p-3 text-sm dark:border-line"
        >
          {needs.status === 'approved' ? (
            <p>{t('creator.exercises.archivedBanner')}</p>
          ) : (
            <>
              <p className="font-semibold">{t('creator.msel.readOnly.title')}</p>
              <p className="text-paper-ink/70 dark:text-fg-muted">
                {needs.status === 'ready_for_approval'
                  ? t('creator.msel.readOnly.bodyReady', { version: needs.version })
                  : t('creator.msel.readOnly.body', { version: needs.version })}
              </p>
              <Link
                to={`/creator/${ttxId}/needs?step=approval`}
                className={`${linkAccent} mt-1 inline-block font-medium`}
              >
                {t('creator.msel.readOnly.action')}
              </Link>
            </>
          )}
        </div>
      )}

      {/* A floor under the steps, so moving between them (or switching the
          type) doesn't move the buttons below: the dialog only grows down. */}
      <div className="md:grid md:min-h-[30rem] md:grid-cols-[13rem_1fr] md:gap-6">
        {/* The rail: every step with its state; any step can be opened. */}
        <aside className="mb-4 space-y-4 md:mb-0">
          <nav aria-label={t('creator.msel.injectSections.navLabel')}>
            <label className="block md:hidden">
              <span className="sr-only">{t('creator.msel.injectSections.navLabel')}</span>
              <select
                name="inject-step"
                value={step}
                onChange={(e) => goTo(e.target.value as InjectSection)}
                className={inputBase}
              >
                {steps.map((section, index) => (
                  <option key={section} value={section}>
                    {t('creator.msel.wizard.stepOf', {
                      number: index + 1,
                      total: steps.length,
                      step: stepTitle(section),
                    })}
                  </option>
                ))}
              </select>
            </label>
            <ol className="hidden space-y-1 md:block">
              {steps.map((section, index) => {
                const mark = markOf(section)
                return (
                  <li key={section}>
                    <button
                      type="button"
                      onClick={() => goTo(section)}
                      aria-current={section === step ? 'step' : undefined}
                      // Number, step and where it stands, as one name.
                      aria-label={`${index + 1} ${stepTitle(section)} (${t(
                        `creator.msel.wizard.marks.${mark}`,
                      )})`}
                      className={`flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                        section === step
                          ? 'bg-accent/10 font-medium text-accent-fg'
                          : 'text-paper-ink/80 hover:bg-hover dark:text-fg-nav'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-3 shrink-0 text-center ${MARK_TONE[mark]}`}
                      >
                        {MARK_GLYPH[mark]}
                      </span>
                      <span className="min-w-0">
                        <span className="mr-1 text-paper-ink/60 tabular-nums dark:text-fg-faint">
                          {index + 1}
                        </span>
                        {stepTitle(section)}
                        {mark === 'optional' && (
                          <span className="ml-1 text-xs text-paper-ink/60 dark:text-fg-faint">
                            {t('creator.msel.wizard.marks.optional')}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ol>
          </nav>
          {/* What the inject is, kept in view while it's filled in. */}
          <dl className="hidden space-y-1 border-t border-panel-line pt-3 text-xs text-paper-ink/70 md:block dark:text-fg-muted">
            <div>
              <dt className="sr-only">{t('creator.msel.fields.format')}</dt>
              <dd>{t(`creator.msel.formats.${inject.format}`)}</dd>
            </div>
            <div>
              <dt className="sr-only">{t('creator.msel.fields.kind')}</dt>
              <dd>{t(`creator.msel.kinds.${inject.kind}`)}</dd>
            </div>
            {phase && (
              <div>
                <dt className="sr-only">{t('creator.msel.fields.phase_key')}</dt>
                <dd>
                  <CodeRef code={phase.code} title={phase.name} pending={pending} />
                </dd>
              </div>
            )}
            {inject.kind === 'mandatory' && inject.offset_minutes !== null && (
              <div>
                <dt className="sr-only">{t('creator.msel.table.time')}</dt>
                <dd className="tabular-nums">
                  {formatOffset(inject.offset_minutes)} (+
                  {formatSpan(Math.max(0, inject.offset_minutes - startOf(inject.phase_key)))})
                </dd>
              </div>
            )}
          </dl>
        </aside>

        <section aria-labelledby="msel-inject-step-title" className="min-w-0 space-y-4">
          <header className="space-y-0.5">
            <h3
              id="msel-inject-step-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-balance text-base font-semibold focus-visible:outline-none"
            >
              <span className="text-paper-ink/60 tabular-nums dark:text-fg-faint">
                {position + 1} ·{' '}
              </span>
              {stepTitle(step)}
            </h3>
            <p className="text-sm text-pretty text-paper-ink/60 dark:text-fg-faint">
              {t(`creator.msel.injectSections.${stepKey}.hint`)}
            </p>
          </header>
          {/* Why the step isn't complete, where the user is looking. */}
          {stepIssues.length > 0 && (
            <div
              role="status"
              className={`rounded-sm border p-3 text-sm ${
                statusOf(step) === 'todo'
                  ? 'border-danger/40 bg-danger/5'
                  : 'border-inactive-1/50 bg-inactive-1/5'
              }`}
            >
              <p className="font-medium">
                {statusOf(step) === 'todo'
                  ? t('creator.msel.wizard.toComplete')
                  : t('creator.msel.wizard.toReview')}
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {stepIssues.map((issue) => (
                  <li key={`${issue.key}-${issue.values?.index ?? ''}`}>
                    {interpolate(issueTexts[issue.key] ?? issue.key, issue.values)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <fieldset disabled={readOnly} className="min-w-0 space-y-4">
            {step === 'what' && (
              <>
                {!isNew && (
                  <div className="space-y-1.5">
                    <RadioCards<InjectFormat>
                      id={id('format')}
                      name={id('format')}
                      legend={t('creator.msel.fields.format')}
                      columns={3}
                      value={inject.format}
                      onChange={(format) => set(formatPatch(format))}
                      options={INJECT_FORMATS.map((format) => ({
                        value: format,
                        label: t(`creator.msel.formats.${format}`),
                        hint: t(`creator.msel.formats.${format}Hint`),
                      }))}
                    />
                    <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
                      {t('creator.msel.formats.changeNote')}
                    </p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Two options, both in view, the chosen one plain to see. */}
                  <div className="sm:col-span-2">
                    <RadioCards<InjectKind>
                      id={id('kind')}
                      name={id('kind')}
                      legend={t('creator.msel.fields.kind')}
                      value={inject.kind}
                      // Made mandatory with no time yet: its phase's next.
                      onChange={(kind) =>
                        set(
                          kind === 'mandatory' && inject.offset_minutes === null
                            ? {
                                kind,
                                offset_minutes: nextOffsetIn(draft, inject.phase_key, inject.key),
                              }
                            : { kind },
                        )
                      }
                      options={(['mandatory', 'contingent'] as const).map((kind) => ({
                        value: kind,
                        label: t(`creator.msel.kinds.${kind}`),
                        hint: t(`creator.msel.wizard.kindHints.${kind}`),
                      }))}
                    />
                  </div>
                  <Field id={id('phase_key')} label={t('creator.msel.fields.phase_key')}>
                    <Select<string>
                      id={id('phase_key')}
                      value={inject.phase_key || null}
                      // Its time is counted from the phase's start: moving it
                      // to another phase keeps that, at the new phase's start.
                      // A new inject takes its new phase's next time; an
                      // existing one keeps its minutes into the phase.
                      onChange={(phase_key) =>
                        set({
                          phase_key,
                          // A branch leaves from an inject of its own phase.
                          ...(inject.kind === 'contingent' &&
                          draft.injects.find((i) => i.key === inject.branch_from_key)?.phase_key !==
                            phase_key
                            ? { branch_from_key: null, branch_action_key: null }
                            : {}),
                          offset_minutes:
                            isNew || inject.offset_minutes === null
                              ? inject.kind === 'mandatory'
                                ? nextOffsetIn(draft, phase_key, inject.key)
                                : null
                              : startOf(phase_key) +
                                (inject.offset_minutes - startOf(inject.phase_key)),
                        })
                      }
                      options={draft.phases.map((p) => ({
                        value: p.key,
                        label: codeRefText(p.code, p.name, pending),
                      }))}
                    />
                  </Field>
                </div>
                <Field id={id('title')} label={t('creator.msel.fields.inject_title')}>
                  <TextInput
                    id={id('title')}
                    value={inject.title}
                    maxLength={255}
                    onChange={(value) => set({ title: value })}
                  />
                </Field>
                <Field
                  id={id('content')}
                  label={
                    inject.format === 'poll'
                      ? t('creator.msel.fields.poll_content')
                      : t('creator.msel.fields.content')
                  }
                  optional={inject.format === 'poll'}
                >
                  {/* What the players receive: bold, italic and lists help
                      a long message scan, on screen and on the inject card. */}
                  <FormattedTextArea
                    id={id('content')}
                    value={inject.content}
                    rows={8}
                    maxLength={CONTENT_MAX}
                    disabled={readOnly}
                    onChange={(content) => set({ content })}
                  />
                </Field>
                {/* A poll is the app asking: nobody in the fiction sends it. */}
                {inject.format !== 'poll' && (
                  <InjectArtifactField
                    id={id}
                    artifact={inject.artifact}
                    content={inject.content}
                    senderName={actors.find((a) => a.key === inject.actor_key)?.name ?? ''}
                    onChange={(artifact) => set({ artifact })}
                  />
                )}
                <InjectImagesField
                  id={id('images')}
                  ttxId={ttxId}
                  images={inject.images}
                  disabled={readOnly}
                  onChange={(images) => set({ images })}
                />
                <InjectFilesField
                  id={id('files')}
                  ttxId={ttxId}
                  files={inject.files}
                  disabled={readOnly}
                  onChange={(files) => set({ files })}
                />
                {inject.kind === 'mandatory' ? (
                  // Minutes after its phase starts (0 = as it opens), stored
                  // as session minutes (T+), which the hint shows.
                  <Field
                    id={id('offset_minutes')}
                    label={t('creator.msel.fields.offset_minutes')}
                    // Where that lands: in the session (T+) and in the scenario.
                    hint={
                      inject.offset_minutes === null
                        ? t('creator.msel.hints.offset')
                        : t('creator.msel.hints.offsetLands', {
                            session: formatOffset(inject.offset_minutes),
                            scenario: formatIncident(
                              incidentMinutesAt(draft, inject.offset_minutes),
                            ),
                          })
                    }
                  >
                    <TextInput
                      id={id('offset_minutes')}
                      type="number"
                      min={0}
                      max={1440}
                      hint
                      className={`${inputBase} max-w-[10rem]`}
                      value={
                        inject.offset_minutes === null
                          ? ''
                          : String(inject.offset_minutes - startOf(inject.phase_key))
                      }
                      onChange={(value) => {
                        const minutes = toNumber(value)
                        set({
                          offset_minutes:
                            minutes === null ? null : startOf(inject.phase_key) + minutes,
                        })
                      }}
                    />
                  </Field>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      id={id('trigger_condition')}
                      label={t('creator.msel.fields.trigger_condition')}
                    >
                      <TextArea
                        id={id('trigger_condition')}
                        value={inject.trigger_condition}
                        rows={2}
                        placeholder={t('creator.msel.placeholders.trigger_condition')}
                        onChange={(trigger_condition) => set({ trigger_condition })}
                      />
                    </Field>
                    <Field
                      id={id('contingent_purpose')}
                      label={t('creator.msel.fields.contingent_purpose')}
                    >
                      <TextArea
                        id={id('contingent_purpose')}
                        value={inject.contingent_purpose}
                        rows={2}
                        onChange={(contingent_purpose) => set({ contingent_purpose })}
                      />
                    </Field>
                    <BranchFields inject={inject} draft={draft} set={set} id={id} />
                    <Field
                      id={id('fires_at_minute')}
                      label={t('creator.msel.fields.fires_at_minute')}
                      // Where that lands in the session, or what an empty
                      // field means: the trigger action's window.
                      hint={
                        inject.fires_at_minute === null
                          ? t('creator.msel.hints.firesAtEmpty')
                          : t('creator.msel.hints.firesAtLands', {
                              session: formatOffset(
                                startOf(inject.phase_key) + inject.fires_at_minute,
                              ),
                            })
                      }
                      optional
                    >
                      <TextInput
                        id={id('fires_at_minute')}
                        type="number"
                        min={0}
                        max={1440}
                        hint
                        className={`${inputBase} max-w-[10rem]`}
                        value={
                          inject.fires_at_minute === null ? '' : String(inject.fires_at_minute)
                        }
                        onChange={(value) => set({ fires_at_minute: toNumber(value) })}
                      />
                    </Field>
                  </div>
                )}
              </>
            )}

            {step === 'who' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Field id={id('actor_key')} label={t('creator.msel.fields.actor_key')}>
                      <Select<string>
                        id={id('actor_key')}
                        value={inject.actor_key}
                        onChange={(actor_key) => {
                          // The actor's usual channel is the likely delivery
                          // method.
                          const channel = actors.find((a) => a.key === actor_key)?.channel
                          set(channel ? { actor_key, delivery_method: channel } : { actor_key })
                        }}
                        options={actors.map((a) => ({ value: a.key, label: a.name || a.code }))}
                      />
                    </Field>
                    {!readOnly && (
                      <div className="flex flex-wrap gap-x-3 text-xs">
                        <button
                          type="button"
                          onClick={() => setAddingActor('new')}
                          className={`${linkAccent} font-medium`}
                        >
                          <span aria-hidden="true">+ </span>
                          {t('creator.msel.actors.newSender')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAddingActor('library')}
                          className={`${linkAccent} font-medium`}
                        >
                          {t('creator.msel.actors.senderFromLibrary')}
                        </button>
                        {canSaveSender && (
                          <button
                            type="button"
                            onClick={() => void saveSenderToLibrary(sender)}
                            disabled={savingSender}
                            className={`${linkAccent} font-medium disabled:opacity-60`}
                          >
                            {savingSender
                              ? t('creator.msel.actors.savingSenderToLibrary')
                              : t('creator.msel.actors.saveSenderToLibrary')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <Field
                    id={id('delivery_method')}
                    label={t('creator.msel.fields.delivery_method')}
                  >
                    <Select<DeliveryMethod>
                      id={id('delivery_method')}
                      value={inject.delivery_method}
                      onChange={(delivery_method) => set({ delivery_method })}
                      options={DELIVERY_METHODS.map((value) => ({
                        value,
                        label: t(`creator.msel.deliveryMethods.${value}`),
                      }))}
                    />
                  </Field>
                </div>
                {/* Recipients: the participating areas and, apart, the third
                    parties taking part -- both from the needs analysis. */}
                <ToggleChips
                  id={id('recipients')}
                  legend={t('creator.msel.fields.recipients')}
                  hint={
                    areas.length
                      ? t('creator.msel.hints.recipients')
                      : t('creator.msel.hints.noAreas')
                  }
                  options={areas.map((area) => ({ value: area, label: area, text: area }))}
                  selected={inject.recipients.filter((r) => areas.includes(r))}
                  onChange={(chosen) =>
                    set({
                      recipients: [
                        ...chosen,
                        ...inject.recipients.filter((r) => !areas.includes(r)),
                      ],
                    })
                  }
                />
                {thirdParties.length > 0 && (
                  <ToggleChips
                    id={id('recipients_third_parties')}
                    legend={t('creator.msel.fields.recipient_third_parties')}
                    options={thirdParties.map((party) => ({
                      value: party,
                      label: party,
                      text: party,
                    }))}
                    selected={inject.recipients.filter((r) => thirdParties.includes(r))}
                    onChange={(chosen) =>
                      set({
                        recipients: [
                          ...inject.recipients.filter((r) => !thirdParties.includes(r)),
                          ...chosen,
                        ],
                      })
                    }
                  />
                )}
                {roomsField}
                <ListInput
                  id={id('attachment_notes')}
                  label={t('creator.msel.fields.attachment_notes')}
                  optional
                  values={inject.attachment_notes}
                  onChange={(attachment_notes) => set({ attachment_notes })}
                />
              </>
            )}

            {step === 'evaluates' && (
              <>
                {inject.format === 'inject' && (
                  <ToggleChips
                    id={id('objective_ids')}
                    stacked
                    legend={t('creator.msel.fields.objective_ids')}
                    options={needs.objectives.map((objective) => ({
                      value: objective.id,
                      label: <CodeRef code={objective.code} title={objectiveName(objective)} />,
                      text: codeRefText(objective.code, objectiveName(objective)),
                    }))}
                    selected={inject.objective_ids}
                    onChange={(objective_ids) => set(linkObjectives(objective_ids))}
                  />
                )}
                <ExpectedActions
                  id={id('expected_actions')}
                  discussion={inject.format === 'discussion'}
                  actions={inject.expected_actions}
                  objectives={needs.objectives.filter((o) => inject.objective_ids.includes(o.id))}
                  areas={areas}
                  thirdParties={thirdParties}
                  onChange={(index, patch) => setAction(index, patch)}
                  onRemove={(index) =>
                    set({
                      expected_actions: inject.expected_actions.filter((_, i) => i !== index),
                    })
                  }
                  onAdd={() => {
                    const action: ActionDraft = {
                      id: null,
                      key: newMselKey(),
                      code: '',
                      description: '',
                      responsible_role: '',
                      expected_within_minutes: null,
                      objective_ids: inject.objective_ids,
                    }
                    set({ expected_actions: [...inject.expected_actions, action] })
                    // The new row is where the user types next.
                    requestAnimationFrame(() =>
                      document.getElementById(mselFieldId('description', action.key))?.focus(),
                    )
                  }}
                />
              </>
            )}

            {step === 'poll' && (
              <>
                <InjectPollFields
                  id={id}
                  question={inject.poll_question}
                  options={inject.poll_options}
                  outcomes={inject.poll_outcomes}
                  impacts={inject.poll_impacts}
                  meters={draft.meters}
                  onChange={set}
                />
                {roomsField}
              </>
            )}

            {step === 'attack' && (
              <InjectAttackField
                inject={inject}
                draft={draft}
                catalog={catalog}
                attackVersion={catalog?.version ?? ''}
                set={set}
                id={id}
                onAddToProfile={
                  readOnly
                    ? undefined
                    : (ref) =>
                        onDraftPatch({
                          threat_actors: draft.threat_actors.map((actor) =>
                            actor.key === inject.threat_actor_key
                              ? {
                                  ...actor,
                                  techniques: [
                                    ...actor.techniques,
                                    { domain: ref.domain, technique_id: ref.technique_id },
                                  ],
                                }
                              : actor,
                          ),
                        })
                }
              />
            )}

            {step === 'review' && (
              <>
                <ReviewSummary
                  inject={inject}
                  draft={draft}
                  needs={needs}
                  rooms={rooms}
                  actors={actors}
                  statusOf={statusOf}
                  onEdit={goTo}
                />
                <Field
                  id={id('facilitator_notes')}
                  label={t('creator.msel.fields.facilitator_notes')}
                  optional
                >
                  <TextArea
                    id={id('facilitator_notes')}
                    value={inject.facilitator_notes}
                    onChange={(facilitator_notes) => set({ facilitator_notes })}
                  />
                </Field>
                <div id={id('review_status')} tabIndex={-1} className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Validating records whoever does it (the server stamps
                        the same on save); off clears it. Not until Context,
                        Sender and recipients and Evaluation are complete. */}
                    <Switch
                      tone="success"
                      checked={inject.review_status === 'validated'}
                      describedBy={`${id('review_status')}-note`}
                      disabled={inject.review_status !== 'validated' && blockers.length > 0}
                      onChange={(validated) =>
                        set(
                          validated
                            ? {
                                review_status: 'validated',
                                validated_by: user?.full_name ?? '',
                                validated_by_id: user?.id ?? null,
                              }
                            : { review_status: 'draft', validated_by: '', validated_by_id: null },
                        )
                      }
                    >
                      {t('creator.msel.wizard.validated')}
                    </Switch>
                    {inject.review_status === 'validated' && (
                      <span className="text-sm text-paper-ink/80 dark:text-fg-muted">
                        {t('creator.msel.validatedByLabel', {
                          name: inject.validated_by || t('creator.msel.validatedByUnknown'),
                        })}
                      </span>
                    )}
                    {inject.review_status === 'validated' &&
                      user &&
                      inject.validated_by_id !== user.id && (
                        <button
                          type="button"
                          onClick={() =>
                            set({ validated_by: user.full_name, validated_by_id: user.id })
                          }
                          className={`${linkAccent} text-sm font-medium`}
                        >
                          {t('creator.msel.actions.overrideValidation')}
                        </button>
                      )}
                  </div>
                  <p
                    id={`${id('review_status')}-note`}
                    className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint"
                  >
                    {readOnly
                      ? t('creator.msel.wizard.validateReadOnly')
                      : inject.review_status !== 'validated' && blockers.length > 0
                        ? t('creator.msel.wizard.validateBlocked', {
                            steps: blockers.map(stepTitle).join(' · '),
                          })
                        : t('creator.msel.wizard.validateHint')}
                  </p>
                </div>
              </>
            )}
          </fieldset>
        </section>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-panel-line pt-4">
        <div>
          {isNew && !readOnly && (
            <button
              type="button"
              onClick={() => {
                if (inDraft) onDiscard(inject)
                onClose()
              }}
              className="text-sm font-medium text-danger-fg hover:underline"
            >
              {t('creator.msel.wizard.discard')}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {previous && (
            <button type="button" onClick={() => goTo(previous)} className={btnSecondary}>
              <span aria-hidden="true">← </span>
              {t('creator.msel.wizard.back')}
            </button>
          )}
          {next ? (
            <button type="button" onClick={() => goTo(next)} className={btnPrimary}>
              {t('creator.msel.wizard.next', { step: stepTitle(next) })}
              <span aria-hidden="true"> →</span>
            </button>
          ) : (
            <button type="button" onClick={onClose} className={btnPrimary}>
              {t('creator.msel.wizard.close')}
            </button>
          )}
        </div>
      </div>

      {addingActor === 'library' && (
        <ActorLibraryPicker
          organizationId={activeOrganizationId}
          alreadyCopied={new Set(actors.map((a) => a.origin_id).filter((v): v is string => !!v))}
          onAdd={(fields) => addActor(actorFromFields(fields))}
          onClose={() => setAddingActor(null)}
        />
      )}
      {addingActor === 'new' && (
        <ActorDialog
          initial={actorFromFields(emptyActorFields())}
          title={t('creator.msel.dialogs.newActor')}
          onCancel={() => setAddingActor(null)}
          onDone={(actor) => {
            addActor(actor)
            setAddingActor(null)
          }}
        />
      )}
    </Modal>
  )
}

/** The "All rooms" chip's value: no room id is ever this. */
const ALL_ROOMS = '__all__'

/** A multi-select as toggle buttons (recipients, objectives): one click
 * each, a tick on the chosen ones; a fieldset + legend, each button
 * `aria-pressed`. */
function ToggleChips<T extends string>({
  id,
  legend,
  hint,
  options,
  selected,
  onChange,
  stacked = false,
}: {
  id: string
  legend: string
  hint?: string
  /** One under the other (long labels, like objectives). */
  stacked?: boolean
  /** `label` is what the chip shows; `text` its plain words (tooltip). */
  options: { value: T; label: ReactNode; text: string }[]
  selected: readonly T[]
  onChange: (next: T[]) => void
}) {
  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : // Keep the options' own order, not the click order.
          options.map((o) => o.value).filter((v) => v === value || selected.includes(v)),
    )
  }
  return (
    <fieldset id={id} tabIndex={-1} className="space-y-2">
      <legend className="text-sm font-medium">{legend}</legend>
      {hint && <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{hint}</p>}
      <div className={stacked ? 'flex flex-col items-start gap-1.5' : 'flex flex-wrap gap-2'}>
        {options.map((option) => {
          const on = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              title={option.text}
              onClick={() => toggle(option.value)}
              className={`inline-flex max-w-full items-center gap-1.5 rounded-sm border px-2.5 py-1 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                on
                  ? 'border-accent bg-accent/10 text-paper-ink dark:text-fg'
                  : 'border-paper-line text-paper-ink/80 hover:bg-hover dark:border-line dark:text-fg-muted'
              }`}
            >
              <span aria-hidden="true" className={`w-3 shrink-0 ${on ? 'text-accent-fg' : ''}`}>
                {on ? '✓' : '+'}
              </span>
              <span className="min-w-0 truncate">{option.label}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

/** The expected actions as compact rows -- what Players are expected to
 * do, by which area, within how long -- with column headings above them. */
function ExpectedActions({
  id,
  discussion,
  actions,
  objectives,
  areas,
  thirdParties,
  onChange,
  onRemove,
  onAdd,
}: {
  id: string
  /** A discussion inject's rows are discussion points, not evaluated. */
  discussion: boolean
  actions: ActionDraft[]
  /** The inject's objectives: with two or more, each action says which it
   * evidences. */
  objectives: MselNeedsContext['objectives']
  areas: string[]
  thirdParties: string[]
  onChange: (index: number, patch: Partial<ActionDraft>) => void
  onRemove: (index: number) => void
  onAdd: () => void
}) {
  const { t } = useTranslation()
  const grid = 'sm:grid sm:grid-cols-[1fr_10rem_6.5rem_2.25rem] sm:items-start sm:gap-2'
  return (
    <fieldset id={id} tabIndex={-1} className="space-y-2">
      <legend className="text-sm font-medium">
        {discussion
          ? t('creator.msel.injectSections.discussion.title')
          : t('creator.msel.fields.expected_actions')}
      </legend>
      <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
        {discussion
          ? t('creator.msel.wizard.discussionHint')
          : t('creator.msel.wizard.actionsHint')}{' '}
        {areas.length > 0 ? t('creator.msel.wizard.areasFrom') : t('creator.msel.wizard.noAreas')}
      </p>
      {actions.length === 0 ? (
        <p className="text-sm text-paper-ink/60 dark:text-fg-faint">
          {t('creator.msel.table.noActions')}
        </p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className={`hidden text-xs font-medium text-paper-ink/60 sm:grid dark:text-fg-faint ${grid}`}
          >
            <span>{t('creator.msel.fields.description')}</span>
            <span>{t('creator.msel.fields.responsible_role')}</span>
            <span>{t('creator.msel.wizard.within')}</span>
            <span />
          </div>
          <ol className="space-y-2">
            {actions.map((action, index) => (
              <li key={action.key} className={`space-y-2 sm:space-y-0 ${grid}`}>
                <TextInput
                  id={mselFieldId('description', action.key)}
                  value={action.description}
                  aria-label={`${t('creator.msel.fields.description')} ${index + 1}`}
                  placeholder={t('creator.msel.placeholders.description')}
                  onChange={(description) => onChange(index, { description })}
                />
                <select
                  id={mselFieldId('responsible_role', action.key)}
                  name={mselFieldId('responsible_role', action.key)}
                  aria-label={t('creator.msel.wizard.areaOf', { index: index + 1 })}
                  value={action.responsible_role}
                  onChange={(e) => onChange(index, { responsible_role: e.target.value })}
                  className={inputBase}
                >
                  <option value="">—</option>
                  {thirdParties.length > 0 ? (
                    <>
                      <optgroup label={t('creator.msel.fields.recipients_areas')}>
                        {areas.map((area) => (
                          <option key={area} value={area}>
                            {area}
                          </option>
                        ))}
                      </optgroup>
                      <optgroup label={t('creator.msel.fields.recipient_third_parties')}>
                        {thirdParties.map((party) => (
                          <option key={party} value={party}>
                            {party}
                          </option>
                        ))}
                      </optgroup>
                    </>
                  ) : (
                    areas.map((area) => (
                      <option key={area} value={area}>
                        {area}
                      </option>
                    ))
                  )}
                </select>
                <TextInput
                  id={mselFieldId('expected_within_minutes', action.key)}
                  type="number"
                  min={1}
                  max={1440}
                  aria-label={t('creator.msel.wizard.withinOf', { index: index + 1 })}
                  placeholder="min"
                  value={
                    action.expected_within_minutes === null
                      ? ''
                      : String(action.expected_within_minutes)
                  }
                  onChange={(value) =>
                    onChange(index, { expected_within_minutes: toNumber(value) })
                  }
                />
                <IconButton
                  label={t('creator.msel.actions.removeAction', { index: index + 1 })}
                  onClick={() => onRemove(index)}
                />
                {objectives.length > 1 && (
                  <ActionObjectives
                    index={index}
                    objectives={objectives}
                    selected={action.objective_ids}
                    onChange={(objective_ids) => onChange(index, { objective_ids })}
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}
      <button
        type="button"
        disabled={actions.length >= MAX_EXPECTED_ACTIONS}
        onClick={onAdd}
        className={`${linkAccent} text-sm font-medium`}
      >
        <span aria-hidden="true">+ </span>
        {t('creator.msel.actions.addAction')}
      </button>
    </fieldset>
  )
}

/** Which of the inject's objectives an action evidences -- the EEGs that
 * list it -- as small toggles under its row. */
function ActionObjectives({
  index,
  objectives,
  selected,
  onChange,
}: {
  index: number
  objectives: MselNeedsContext['objectives']
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const { t } = useTranslation()
  const labelId = `action-objectives-${index}`
  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:col-span-4 sm:pt-1.5">
      <span id={labelId} className="text-xs text-paper-ink/60 dark:text-fg-faint">
        <span className="sr-only">
          {t('creator.msel.wizard.actionObjectivesOf', { index: index + 1 })}
        </span>
        <span aria-hidden="true">{t('creator.msel.wizard.actionObjectives')}</span>
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {objectives.map((objective) => {
          const on = selected.includes(objective.id)
          const name = objectiveName(objective)
          return (
            <button
              key={objective.id}
              type="button"
              aria-pressed={on}
              title={codeRefText(objective.code, name)}
              onClick={() =>
                onChange(
                  objectives
                    .map((o) => o.id)
                    .filter((o) => (o === objective.id ? !on : selected.includes(o))),
                )
              }
              className={`inline-flex max-w-full items-center gap-1 rounded-sm border px-2 py-0.5 text-left text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                on
                  ? 'border-accent bg-accent/10 text-paper-ink dark:text-fg'
                  : 'border-paper-line text-paper-ink/80 hover:bg-hover dark:border-line dark:text-fg-muted'
              }`}
            >
              <span aria-hidden="true" className={`w-3 shrink-0 ${on ? 'text-accent-fg' : ''}`}>
                {on ? '✓' : '+'}
              </span>
              <CodeRef code={objective.code} title={name} className="min-w-0" />
            </button>
          )
        })}
      </div>
      {selected.length === 0 && (
        <span className="text-xs text-paper-ink/60 dark:text-fg-faint">
          {t('creator.msel.wizard.actionNoObjective')}
        </span>
      )}
    </div>
  )
}

/** The last step's recap of the first four, each with its state and an
 * Edit link back to it. */
function ReviewSummary({
  inject,
  draft,
  needs,
  rooms,
  actors,
  statusOf,
  onEdit,
}: {
  inject: InjectDraft
  draft: MselDraft
  needs: MselNeedsContext
  rooms: MselRoom[]
  actors: ActorDraft[]
  statusOf: (section: InjectSection) => ReturnType<typeof injectSectionStatus>
  onEdit: (section: InjectSection) => void
}) {
  const { t } = useTranslation()
  const pending = t('creator.msel.table.pendingCode')
  const phase = draft.phases.find((p) => p.key === inject.phase_key)
  const sender = actors.find((a) => a.key === inject.actor_key)
  const threat = draft.threat_actors.find((a) => a.key === inject.threat_actor_key)
  const allRows: { section: InjectSection; value: ReactNode }[] = [
    {
      section: 'what',
      value: (
        <>
          <span className="block">{inject.title || '—'}</span>
          <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
            {t(`creator.msel.kinds.${inject.kind}`)}
            {phase ? ` · ${codeRefText(phase.code, phase.name, pending)}` : ''}
            {inject.kind === 'mandatory' && inject.offset_minutes !== null
              ? ` · ${formatOffset(inject.offset_minutes)}`
              : ''}
            {inject.kind === 'contingent' && phase && inject.fires_at_minute !== null
              ? ` · ${t('creator.msel.hints.firesAtLands', {
                  session: formatOffset(phase.start_offset + inject.fires_at_minute),
                })}`
              : ''}
            {inject.images.length > 0
              ? ` · ${t('creator.msel.images.count', { count: inject.images.length })}`
              : ''}
            {inject.files.length > 0
              ? ` · ${t('creator.msel.files.count', { count: inject.files.length })}`
              : ''}
          </span>
        </>
      ),
    },
    {
      section: 'who',
      value: (
        <>
          <span className="block">{sender?.name || '—'}</span>
          <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
            {t(`creator.msel.deliveryMethods.${inject.delivery_method}`)} →{' '}
            {inject.recipients.length > 0 ? inject.recipients.join(' · ') : '—'}
          </span>
          {rooms.length > 0 && (
            <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.msel.fields.room_ids')}:{' '}
              <InjectRooms roomIds={inject.room_ids} rooms={rooms} />
            </span>
          )}
        </>
      ),
    },
    {
      section: 'evaluates',
      value: (
        <>
          {inject.format === 'discussion' && (
            <span className="block">{t('creator.msel.formats.discussionSummary')}</span>
          )}
          <ul className="space-y-0.5">
            {needs.objectives
              .filter((o) => inject.objective_ids.includes(o.id))
              .map((o) => (
                <li key={o.id}>
                  <CodeRef code={o.code} title={objectiveName(o)} />
                </li>
              ))}
          </ul>
          <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('creator.msel.wizard.actionCount', { count: inject.expected_actions.length })}
          </span>
        </>
      ),
    },
    {
      section: 'poll',
      value: (
        <>
          <span className="block">{inject.poll_question || '—'}</span>
          <ol className="mt-0.5 text-xs text-paper-ink/60 dark:text-fg-faint">
            {inject.poll_options.map((option, index) => (
              <li key={index}>
                {pollLetter(index)}. {option || '—'}
                {inject.poll_outcomes[index]?.trim() && (
                  <span className="block pl-4">→ {inject.poll_outcomes[index]}</span>
                )}
                {draft.meters.some((meter) => inject.poll_impacts[index]?.[meter.key]) && (
                  <span className="block pl-4">
                    {draft.meters
                      .filter((meter) => inject.poll_impacts[index]?.[meter.key])
                      .map(
                        (meter) =>
                          `${meter.name}: ${t(METER_LEVEL_KEYS[inject.poll_impacts[index][meter.key]])}`,
                      )
                      .join(' · ')}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {rooms.length > 0 && (
            <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.msel.fields.room_ids')}:{' '}
              <InjectRooms roomIds={inject.room_ids} rooms={rooms} />
            </span>
          )}
        </>
      ),
    },
    {
      section: 'attack',
      value: !inject.attack_attribution ? (
        t('creator.msel.attribution.none')
      ) : (
        <>
          <span className="block">
            {inject.attack_attribution === 'noise'
              ? t('creator.msel.attribution.noise')
              : threat
                ? codeRefText(threat.code, threat.name, pending)
                : '—'}
          </span>
          <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('creator.msel.wizard.techniqueCount', { count: inject.attack_techniques.length })}
          </span>
        </>
      ),
    },
  ]
  const steps = injectSteps(inject.format)
  const rows = allRows.filter((row) => steps.includes(row.section))
  return (
    <dl className="divide-y divide-panel-line rounded-sm border border-panel-line">
      {rows.map(({ section, value }) => {
        const status = statusOf(section)
        return (
          <div key={section} className="flex items-start gap-3 px-3 py-2 text-sm">
            <dt className="w-40 shrink-0 font-medium">
              <span aria-hidden="true" className={`mr-1.5 ${MARK_TONE[status]}`}>
                {MARK_GLYPH[status]}
              </span>
              {t(`creator.msel.injectSections.${sectionCopyKey(section, inject.format)}.title`)}
              <span className="sr-only"> ({t(`creator.msel.wizard.marks.${status}`)})</span>
            </dt>
            <dd className="min-w-0 flex-1">{value}</dd>
            <dd>
              <button
                type="button"
                onClick={() => onEdit(section)}
                className={`${linkAccent} text-xs font-medium`}
                aria-label={t('creator.msel.wizard.editStep', {
                  step: t(`creator.msel.injectSections.${section}.title`),
                })}
              >
                {t('creator.msel.wizard.edit')}
              </button>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/** A new, unsaved member of the exercise's cast. Who voices it ("Played
 * by") is set in the Library, with the rest of the cast. */
function actorFromFields(fields: ActorFields): ActorDraft {
  return {
    id: null,
    key: newMselKey(),
    code: '',
    ...fields,
    origin: fields.origin ?? 'exercise',
    played_by: '',
  }
}

function ActorDialog({
  initial,
  title,
  onCancel,
  onDone,
}: {
  initial: ActorDraft
  title: string
  onCancel: () => void
  onDone: (actor: ActorDraft) => void
}) {
  const { t } = useTranslation()
  const [actor, setActor] = useState(initial)
  const id = (field: string) => mselFieldId(field, actor.key)
  return (
    <RowDialog
      titleId="msel-actor-dialog-title"
      title={title}
      initialFocusId={id('name')}
      onCancel={onCancel}
      onDone={() => onDone(actor)}
    >
      {actor.origin_id && <CopiedFrom origin={actor.origin} name={actor.origin_name} />}
      <Field id={id('name')} label={t('creator.msel.fields.name')}>
        <TextInput
          id={id('name')}
          value={actor.name}
          maxLength={255}
          onChange={(name) => setActor({ ...actor, name })}
        />
      </Field>
      <Field id={id('type')} label={t('creator.msel.fields.type')}>
        <Select<ActorType>
          id={id('type')}
          value={actor.type}
          onChange={(type) => setActor({ ...actor, type })}
          options={ACTOR_TYPES.map((value) => ({
            value,
            label: t(`creator.msel.actorTypes.${value}`),
          }))}
        />
      </Field>
      <Field id={id('channel')} label={t('templates.actors.fields.channel')} optional>
        <Select<DeliveryMethod | ''>
          id={id('channel')}
          value={actor.channel ?? ''}
          onChange={(channel) => setActor({ ...actor, channel: channel || null })}
          options={[
            { value: '', label: t('templates.actors.noChannel') },
            ...DELIVERY_METHODS.map((value) => ({
              value,
              label: t(`creator.msel.deliveryMethods.${value}`),
            })),
          ]}
        />
      </Field>
      <Field id={id('description')} label={t('templates.actors.fields.description')} optional>
        <TextArea
          id={id('description')}
          value={actor.description}
          rows={3}
          placeholder={t('templates.actors.descriptionPlaceholder')}
          onChange={(description) => setActor({ ...actor, description })}
        />
      </Field>
    </RowDialog>
  )
}

/** Where a contingent inject sits on the storyline map: the inject it
 * hangs from, the expected action of that inject whose absence fires it,
 * and the mandatory inject where the storyline resumes. All optional --
 * the report says what's missing (M14-M17). */
function BranchFields({
  inject,
  draft,
  set,
  id,
}: {
  inject: InjectDraft
  draft: MselDraft
  set: (patch: Partial<InjectDraft>) => void
  id: (field: string) => string
}) {
  const { t } = useTranslation()
  const none = t('creator.msel.map.none')
  const label = (other: InjectDraft) =>
    codeRefText(
      other.code,
      `${other.kind === 'mandatory' ? `${formatOffset(other.offset_minutes)} · ` : ''}${
        other.title || '—'
      }`,
      t('creator.msel.table.pendingCode'),
    )
  const others = orderedInjects(draft).filter((other) => other.key !== inject.key)
  // It leaves from an inject of its own phase (mandatory or contingent --
  // not one that already hangs from it, or the branch would loop)...
  const branchPoints = others.filter(
    (other) => other.phase_key === inject.phase_key && !branchesFrom(draft, other, inject),
  )
  const parent = others.find((other) => other.key === inject.branch_from_key)
  const actions = parent?.expected_actions ?? []
  // ...and comes back, if it does, at a later mandatory inject.
  const rejoins = others.filter((other) => validRejoin(draft, inject, other))
  return (
    <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
      <Field
        id={id('branch_from_key')}
        label={t('creator.msel.fields.branch_from_key')}
        hint={
          branchPoints.length > 0
            ? t('creator.msel.hints.branch_from')
            : t('creator.msel.map.noBranchPoint')
        }
      >
        <Select<string>
          id={id('branch_from_key')}
          hint
          value={inject.branch_from_key}
          placeholder={t('creator.msel.map.chooseBranch')}
          // A new branch point has other expected actions, and may make the
          // way back come too early.
          onChange={(key) => {
            const next = { ...inject, branch_from_key: key || null }
            const back = draft.injects.find((i) => i.key === inject.rejoin_key)
            set({
              branch_from_key: key || null,
              branch_action_key: null,
              ...(back && !validRejoin(draft, next, back) ? { rejoin_key: null } : {}),
            })
          }}
          options={branchPoints.map((other) => ({ value: other.key, label: label(other) }))}
        />
      </Field>
      <Field
        id={id('branch_action_key')}
        label={t('creator.msel.fields.branch_action_key')}
        hint={t('creator.msel.hints.branch_action')}
        optional
      >
        <Select<string>
          id={id('branch_action_key')}
          hint
          value={inject.branch_action_key ?? ''}
          onChange={(key) => set({ branch_action_key: key || null })}
          options={[
            { value: '', label: none },
            ...actions.map((action) => ({
              value: action.key,
              label: codeRefText(
                action.code,
                action.description || '—',
                t('creator.msel.table.pendingCode'),
              ),
            })),
          ]}
        />
      </Field>
      <Field
        id={id('rejoin_key')}
        label={t('creator.msel.fields.rejoin_key')}
        hint={t('creator.msel.hints.rejoin')}
        optional
      >
        <Select<string>
          id={id('rejoin_key')}
          hint
          value={inject.rejoin_key ?? ''}
          onChange={(key) => set({ rejoin_key: key || null })}
          options={[
            { value: '', label: none },
            ...rejoins.map((other) => ({ value: other.key, label: label(other) })),
          ]}
        />
      </Field>
    </div>
  )
}
