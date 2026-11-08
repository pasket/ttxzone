import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { codeRefText } from '../../../lib/codeRef'
import { useSavePhase } from '../../../hooks/useSavePhase'
import { useToast } from '../../../hooks/useToast'
import { actionsCellClass, btnSecondary } from '../../../lib/buttonStyles'
import {
  applyPhaseEdit,
  closeSessionGaps,
  evenBands,
  followingPhases,
  formatIncident,
  formatOffset,
  formatSpan,
  MAX_INCIDENT_JUMP_MINUTES,
  incidentMinutesAt,
  MAX_PHASES,
  mselFieldId,
  newMselKey,
  objectivePhaseGroups,
  sessionGaps,
  toNumber,
  type MselDraft,
  type PhaseDraft,
} from '../../../lib/msel'
import {
  panelActionsTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../../lib/panelStyles'
import type { MselNeedsContext } from '../../../lib/types'
import { CodeRef, CodeRefList } from '../../common/CodeRef'
import { EditButton } from '../../common/EditButton'
import { IconButton } from '../../common/IconButton'
import { CheckboxGroup, Field, ListInput, TextArea, TextInput } from '../needs/fields'
import { RowDialog } from '../needs/RowDialog'
import { HoursInput } from './HoursInput'
import type { TabProps } from './tabProps'
import { objectiveName, pick } from '../../../lib/needsForm'
import { Segmented } from '../needs/NeedsStep'

/** The usual arc of an incident: the "suggested phases" start when the
 * objectives evaluate fewer than two capabilities. */
const SUGGESTED_PHASES = ['detection', 'escalation', 'response', 'recovery'] as const
const DEFAULT_SUGGESTED_SESSION_MINUTES = 180

const PHASE_GROUP_BY = ['session', 'objective'] as const
type PhaseGroupBy = (typeof PHASE_GROUP_BY)[number]

/** Tab 2 -- the phases: bands of the session, each with its situation
 * update, the facilitator's key questions and the objectives it works. */
/** The number in a code (PH-03 -> 3); null for a phase not saved yet. */
function codeNumber(code: string | null | undefined): number | null {
  const match = code?.match(/-(\d+)$/)
  return match ? Number(match[1]) : null
}

export function PhasesTab({
  msel,
  draft,
  update,
  removeRow,
  isInvalid,
  readOnly,
  focusRow,
  renumberButton,
}: TabProps) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [editing, setEditing] = useState<{ phase: PhaseDraft; isNew: boolean } | null>(null)
  const [focusField, setFocusField] = useState<string | null>(null)

  const [handledRow, setHandledRow] = useState<TabProps['focusRow']>(null)
  if (focusRow && focusRow !== handledRow) {
    setHandledRow(focusRow)
    const phase = draft.phases.find((p) => p.key === focusRow.itemId || p.id === focusRow.itemId)
    if (phase) {
      setEditing({ phase, isNew: false })
      setFocusField(mselFieldId(focusRow.field, phase.key))
    }
  }

  const codeOf = (phase: PhaseDraft) => phase.code || t('creator.msel.table.pendingCode')
  // Each phase's place in the session (1 = the first to start).
  const sessionPosition = new Map(
    [...draft.phases]
      .sort((a, b) => a.start_offset - b.start_offset)
      .map((phase, index) => [phase.key, index + 1]),
  )

  function newPhase(): PhaseDraft {
    const last = draft.phases.at(-1)
    const start = last ? last.end_offset : 0
    return {
      id: null,
      key: newMselKey(),
      code: '',
      name: '',
      start_offset: start,
      end_offset: start + 45,
      incident_jump_minutes: 0,
      headline: '',
      situation_update: '',
      key_questions: [],
      objective_ids: msel.needs.objectives.map((o) => o.id),
      due_objective_ids: [],
    }
  }

  // A ready-made starting point: a phase per capability the objectives
  // evaluate, in the order a crisis goes through (each with its objectives
  // and key questions to adapt) -- moments of the crisis, not stages of the
  // attack. With fewer than two (or more than fit), the usual arc of an incident with every
  // objective (narrowed per phase later). The session split evenly.
  const objectiveGroups = objectivePhaseGroups(msel.needs.objectives)
  const fromObjectives = objectiveGroups.length >= 2 && objectiveGroups.length <= MAX_PHASES
  const suggestedNames = fromObjectives
    ? objectiveGroups.map((group) => t(`creator.msel.phaseOutline.${group.capability}.name`))
    : SUGGESTED_PHASES.map((key) => t(`creator.msel.suggestedPhases.${key}.name`))
  function suggestedPhases(): PhaseDraft[] {
    const bands = evenBands(
      0,
      draft.duration_minutes ?? DEFAULT_SUGGESTED_SESSION_MINUTES,
      suggestedNames.length,
    )
    return bands.map((band, index) => ({
      id: null,
      key: newMselKey(),
      code: '',
      name: suggestedNames[index],
      ...band,
      incident_jump_minutes: 0,
      headline: '',
      situation_update: '',
      key_questions: (fromObjectives
        ? t(`creator.msel.phaseOutline.${objectiveGroups[index].capability}.questions`, {
            returnObjects: true,
          })
        : t(`creator.msel.suggestedPhases.${SUGGESTED_PHASES[index]}.questions`, {
            returnObjects: true,
          })) as string[],
      objective_ids: fromObjectives
        ? objectiveGroups[index].objective_ids
        : msel.needs.objectives.map((o) => o.id),
      due_objective_ids: [],
    }))
  }
  function applySuggested() {
    const phases = suggestedPhases()
    update({ phases })
    showToast(t('creator.msel.phaseOutline.done', { count: phases.length }), {
      action: { label: t('common.toast.undo'), onAction: () => update({ phases: [] }) },
    })
  }

  // The session never pauses: session time left between two phases becomes
  // a lapse in the scenario (savePhaseEdit), said in a toast.
  const savePhase = useSavePhase(draft, update)
  // Gaps already there: turned into scenario time on request.
  function applyClosingGaps(next: MselDraft) {
    const { draft: closed, closed: gaps } = closeSessionGaps(next)
    update({ phases: closed.phases, injects: closed.injects })
    if (gaps.length > 0) {
      const minutes = gaps.reduce((total, gap) => total + gap.minutes, 0)
      showToast(
        t('creator.msel.gaps.closed', {
          session: formatSpan(minutes),
          scenario: formatSpan(minutes * draft.time_compression),
        }),
      )
    }
  }
  function save(phase: PhaseDraft, pushLater: boolean) {
    savePhase(phase, pushLater)
    setEditing(null)
  }

  // Gaps already there (a phase removed, or saved before gaps became lapses).
  const gapMinutes = sessionGaps(draft.phases).reduce((total, gap) => total + gap.minutes, 0)
  // The phase's stretch of scenario: where it starts (compression plus every
  // jump so far, its own included) and as long as its session times the
  // compression.
  const scenarioBand = (phase: PhaseDraft) => {
    const start = incidentMinutesAt(draft, phase.start_offset)
    const end = start + (phase.end_offset - phase.start_offset) * draft.time_compression
    return `${formatIncident(start)} – ${formatIncident(end)}`
  }

  // In session order unless asked otherwise; in the URL, like the needs
  // analysis' tables. By objective: every objective of the needs analysis,
  // empty ones included (no phase works it yet), so a phase working two
  // shows under both; phases working none go last.
  const [searchParams, setSearchParams] = useSearchParams()
  const groupBy = pick(PHASE_GROUP_BY, searchParams.get('group'), 'session')
  function setGroupBy(value: PhaseGroupBy) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'session') next.delete('group')
        else next.set('group', value)
        return next
      },
      { replace: true },
    )
  }
  const inSession = [...draft.phases].sort((a, b) => a.start_offset - b.start_offset)
  const pending = t('creator.msel.table.pendingCode')
  const byObjective = [...msel.needs.objectives]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((objective) => ({
      key: objective.id,
      heading: codeRefText(objective.code, objectiveName(objective), pending),
      phases: inSession.filter((phase) => phase.objective_ids.includes(objective.id)),
    }))
  const unlinked = inSession.filter(
    (phase) => !phase.objective_ids.some((id) => msel.needs.objectives.some((o) => o.id === id)),
  )
  const groups =
    unlinked.length > 0
      ? [
          ...byObjective,
          {
            key: 'no-objective',
            heading: t('creator.msel.table.noObjectiveGroup'),
            phases: unlinked,
          },
        ]
      : byObjective
  const columns = 3 + (groupBy === 'session' ? 1 : 0) + (readOnly ? 0 : 1)

  const row = (phase: PhaseDraft, groupKey: string) => {
    const used = draft.injects.some((inject) => inject.phase_key === phase.key)
    const invalid =
      isInvalid('name', phase.key) ||
      isInvalid('end_offset', phase.key) ||
      isInvalid('name', phase.id) ||
      isInvalid('end_offset', phase.id)
    return (
      <tr key={`${groupKey}-${phase.key}`} className={panelTr}>
        <td className={`${panelTd} min-w-0`}>
          <CodeRef
            variant="stacked"
            wrap
            code={phase.code}
            title={phase.name || '—'}
            pending={t('creator.msel.table.pendingCode')}
            invalid={invalid}
          />
          {/* Where it falls in the session, when its code doesn't say so
              (a gap, or created out of order). */}
          {sessionPosition.get(phase.key) !== codeNumber(phase.code) && (
            <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.msel.table.phasePosition', {
                position: sessionPosition.get(phase.key),
                count: draft.phases.length,
              })}
            </span>
          )}
        </td>
        <td translate="no" className={`${panelTd} font-mono text-sm tabular-nums`}>
          <span className="block whitespace-nowrap">
            {formatOffset(phase.start_offset)} – {formatOffset(phase.end_offset)}
          </span>
          {/* The same stretch in the scenario, in a quieter tone. */}
          <span className="block font-sans text-xs text-paper-ink/60 italic dark:text-fg-faint">
            {t('creator.msel.table.scenarioBand', { band: scenarioBand(phase) })}
          </span>
          {phase.start_offset > 0 && phase.incident_jump_minutes > 0 && (
            <span className="block font-sans text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.msel.phaseJump', { span: formatSpan(phase.incident_jump_minutes) })}
            </span>
          )}
        </td>
        {groupBy === 'session' && (
          <td className={`${panelTd} min-w-0 text-sm`}>
            <CodeRefList
              wrap
              items={msel.needs.objectives
                .filter((o) => phase.objective_ids.includes(o.id))
                .map((o) => ({
                  key: o.id,
                  code: o.code,
                  title: phase.due_objective_ids.includes(o.id)
                    ? `${objectiveName(o)} · ${t('creator.msel.dueMark')}`
                    : objectiveName(o),
                }))}
            />
          </td>
        )}
        <td
          className={`${panelTd} text-center text-xs tabular-nums text-paper-ink/60 dark:text-fg-faint`}
        >
          {phase.key_questions.length}
        </td>
        {!readOnly && (
          <td className={panelTd}>
            <div className={actionsCellClass}>
              <EditButton
                label={t('creator.msel.actions.editPhase', { code: codeOf(phase) })}
                onClick={() => {
                  setFocusField(null)
                  setEditing({ phase, isNew: false })
                }}
              />
              <IconButton
                label={
                  used
                    ? `${t('creator.msel.actions.removePhase', { code: codeOf(phase) })} (${t('creator.msel.phaseInUse')})`
                    : t('creator.msel.actions.removePhase', { code: codeOf(phase) })
                }
                // Injects point at their phase: move them first.
                disabled={used}
                onClick={() =>
                  removeRow(
                    'phases',
                    phase.key,
                    t('creator.msel.toast.phaseRemoved', { code: codeOf(phase) }),
                  )
                }
              />
            </div>
          </td>
        )}
      </tr>
    )
  }

  return (
    <div className="space-y-4">
      {/* One toolbar line, as in the needs analysis: grouping on the left,
          renumbering and adding on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {draft.phases.length > 0 ? (
          <Segmented
            id="phases-group"
            label={t('creator.needs.table.groupBy')}
            options={PHASE_GROUP_BY.map((value) => ({
              value,
              label: t(`creator.msel.table.phaseGroup.${value}`),
            }))}
            value={groupBy}
            onChange={setGroupBy}
          />
        ) : (
          <span />
        )}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.msel.table.phaseCount', { count: draft.phases.length })}
          </p>
          {!readOnly && renumberButton('phases')}
          {!readOnly && (
            <button
              type="button"
              disabled={draft.phases.length >= MAX_PHASES}
              onClick={() => {
                setFocusField(null)
                setEditing({ phase: newPhase(), isNew: true })
              }}
              className={btnSecondary}
            >
              <span aria-hidden="true">+ </span>
              {t('creator.msel.actions.addPhase')}
            </button>
          )}
        </div>
      </div>
      {!readOnly && gapMinutes > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-inactive-1/50 bg-inactive-1/5 p-3">
          <p className="text-sm text-pretty">
            {t('creator.msel.gaps.notice', {
              session: formatSpan(gapMinutes),
              scenario: formatSpan(gapMinutes * draft.time_compression),
            })}
          </p>
          <button type="button" onClick={() => applyClosingGaps(draft)} className={btnSecondary}>
            {t('creator.msel.gaps.close')}
          </button>
        </div>
      )}
      {draft.phases.length === 0 ? (
        <div className="space-y-3 py-8 text-center">
          <p
            id={mselFieldId('phases')}
            tabIndex={-1}
            className={`text-sm ${isInvalid('phases') ? 'text-danger-fg' : 'text-paper-ink/70 dark:text-fg-muted'}`}
          >
            {t('creator.msel.table.noPhases')}
          </p>
          {!readOnly && (
            <div className="space-y-1">
              <button type="button" onClick={applySuggested} className={btnSecondary}>
                {t('creator.msel.actions.useSuggestedPhases')}
              </button>
              <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                {fromObjectives
                  ? t('creator.msel.phaseOutline.hint', { phases: suggestedNames.join(' → ') })
                  : t('creator.msel.hints.suggestedPhases')}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="-mx-5">
          {/* Fixed widths, as in the needs analysis: the objectives (or,
              grouped by objective, the phase) give way and wrap, so the
              table never scrolls sideways. */}
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col className={groupBy === 'session' ? 'w-44 lg:w-56' : undefined} />
              <col className="w-52 lg:w-56" />
              {groupBy === 'session' && <col />}
              <col className="w-24" />
              {!readOnly && <col className="w-28" />}
            </colgroup>
            <thead>
              <tr className={panelTableHeadRow}>
                <th className={panelTh}>{t('creator.msel.table.phase')}</th>
                <th className={panelTh}>{t('creator.msel.table.band')}</th>
                {groupBy === 'session' && (
                  <th className={panelTh}>{t('creator.msel.table.objectives')}</th>
                )}
                <th className={`${panelTh} text-center`}>{t('creator.msel.table.questions')}</th>
                {!readOnly && <th className={panelActionsTh}>{t('common.table.actions')}</th>}
              </tr>
            </thead>
            {groupBy === 'session' ? (
              <tbody className={panelTbody}>
                {inSession.map((phase) => row(phase, 'session'))}
              </tbody>
            ) : (
              groups.map((group) => (
                <tbody key={group.key} className={panelTbody}>
                  <tr>
                    <th
                      scope="rowgroup"
                      colSpan={columns}
                      className="bg-paper-ink/[0.05] px-5 py-2 text-left text-sm font-medium dark:bg-white/[0.07]"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="min-w-0 truncate">{group.heading}</span>
                        <span className="shrink-0 text-xs font-normal text-paper-ink/60 dark:text-fg-faint">
                          {t('creator.msel.table.phaseCount', { count: group.phases.length })}
                        </span>
                      </span>
                    </th>
                  </tr>
                  {group.phases.length === 0 && (
                    <tr>
                      <td
                        colSpan={columns}
                        className={`${panelTd} text-sm text-paper-ink/60 italic dark:text-fg-faint`}
                      >
                        {t('creator.msel.table.noPhaseForObjective')}
                      </td>
                    </tr>
                  )}
                  {group.phases.map((phase) => row(phase, group.key))}
                </tbody>
              ))
            )}
          </table>
        </div>
      )}

      {editing && (
        <PhaseDialog
          initial={editing.phase}
          draft={draft}
          needs={msel.needs}
          title={
            editing.isNew
              ? t('creator.msel.dialogs.newPhase')
              : t('creator.msel.dialogs.phaseTitle', {
                  code: codeRefText(
                    editing.phase.code,
                    editing.phase.name,
                    t('creator.msel.table.pendingCode'),
                  ),
                })
          }
          initialFocusId={focusField}
          readOnly={readOnly}
          // The dialog hands focus back to whatever opened it (the Add
          // button, a row, the storyline strip) without scrolling.
          onCancel={() => setEditing(null)}
          onDone={(phase, pushLater) => (readOnly ? setEditing(null) : save(phase, pushLater))}
        />
      )}
    </div>
  )
}

export function PhaseDialog({
  initial,
  draft,
  needs,
  title,
  initialFocusId,
  readOnly,
  onCancel,
  onDone,
}: {
  initial: PhaseDraft
  draft: MselDraft
  needs: MselNeedsContext
  title: string
  initialFocusId: string | null
  readOnly: boolean
  onCancel: () => void
  onDone: (phase: PhaseDraft, pushLater: boolean) => void
}) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState(initial)
  const id = (field: string) => mselFieldId(field, phase.key)
  const duration = phase.end_offset - phase.start_offset
  // What Done does to the later phases: move with this one (the default,
  // so the session stays one sequence) or stay put.
  const [pushLater, setPushLater] = useState(true)
  const existing = draft.phases.find((p) => p.key === phase.key)
  const later = existing ? followingPhases(draft.phases, phase.key) : []
  const timesChanged =
    !!existing &&
    (existing.start_offset !== phase.start_offset || existing.end_offset !== phase.end_offset)
  const applied = applyPhaseEdit(draft, phase, pushLater)
  // Said before it happens: which later phases move and by how much, and
  // whether one would then run past the session.
  const moved = applied.phases.filter((p) => {
    const before = draft.phases.find((o) => o.key === p.key)
    return p.key !== phase.key && before && before.start_offset !== p.start_offset
  })
  const shift = existing ? phase.end_offset - existing.end_offset : 0
  const session = draft.duration_minutes ?? 0
  const overrun = applied.phases.find((p) => session > 0 && p.end_offset > session)
  // Scenario time, with this phase as edited: where it starts and how
  // long it lasts there.
  const scenarioStart = incidentMinutesAt(applied, phase.start_offset)
  // Session left with no phase around this one: on Done it becomes scenario
  // time (closeSessionGaps), said here before it happens.
  const gap = sessionGaps(applied.phases).reduce((total, g) => total + g.minutes, 0)
  return (
    <RowDialog
      titleId="msel-phase-dialog-title"
      title={title}
      initialFocusId={initialFocusId}
      onCancel={onCancel}
      onDone={() => onDone(phase, pushLater)}
    >
      <fieldset disabled={readOnly} className="min-w-0 space-y-4">
        <Field id={id('name')} label={t('creator.msel.fields.name')}>
          <TextInput
            id={id('name')}
            value={phase.name}
            maxLength={255}
            onChange={(name) => setPhase({ ...phase, name })}
          />
        </Field>
        <Field
          id={id('headline')}
          label={t('creator.msel.fields.headline')}
          hint={t('creator.msel.hints.headline')}
          optional
        >
          <TextInput
            id={id('headline')}
            value={phase.headline}
            maxLength={80}
            hint
            onChange={(headline) => setPhase({ ...phase, headline })}
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={id('start_offset')}
            label={t('creator.msel.fields.start_offset')}
            hint={t('creator.msel.hints.scenarioStart', { time: formatIncident(scenarioStart) })}
          >
            <TextInput
              id={id('start_offset')}
              type="number"
              min={0}
              max={1440}
              value={String(phase.start_offset)}
              // Moving the start keeps the duration.
              onChange={(value) => {
                const start = toNumber(value) ?? 0
                setPhase({ ...phase, start_offset: start, end_offset: start + duration })
              }}
            />
          </Field>
          {/* Stored as where it ends; asked as how long it lasts. */}
          <Field
            id={id('end_offset')}
            label={t('creator.msel.fields.session_duration')}
            hint={
              duration > 0
                ? t('creator.msel.hints.scenarioDuration', {
                    span: formatSpan(duration * draft.time_compression),
                    end: formatOffset(phase.end_offset),
                  })
                : undefined
            }
          >
            <TextInput
              id={id('end_offset')}
              type="number"
              min={1}
              max={1440}
              value={String(duration)}
              onChange={(value) =>
                setPhase({ ...phase, end_offset: phase.start_offset + (toNumber(value) ?? 0) })
              }
            />
          </Field>
        </div>
        {later.length > 0 && timesChanged && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t('creator.msel.phaseEdit.legend')}</legend>
            {(['push', 'keep'] as const).map((option) => (
              <label key={option} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={id('push_later')}
                  checked={pushLater === (option === 'push')}
                  onChange={() => setPushLater(option === 'push')}
                  className="mt-1"
                />
                <span>
                  {t(`creator.msel.phaseEdit.${option}`)}
                  <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
                    {t(`creator.msel.phaseEdit.${option}Hint`)}
                  </span>
                </span>
              </label>
            ))}
            {moved.length > 0 && (
              <div className="space-y-1 text-sm text-paper-ink/80 dark:text-fg-muted">
                <p>
                  {t('creator.msel.phaseEdit.preview', {
                    count: moved.length,
                    shift: `${shift > 0 ? '+' : '−'}${formatSpan(Math.abs(shift))}`,
                  })}
                </p>
                <CodeRefList
                  items={moved.map((p) => ({ key: p.key, code: p.code, title: p.name }))}
                  pending={t('creator.msel.table.pendingCode')}
                />
              </div>
            )}
          </fieldset>
        )}
        {overrun && (
          <p className="rounded-sm border border-inactive-1/50 bg-inactive-1/5 p-3 text-sm text-pretty">
            {t('creator.msel.phaseEdit.overrun', {
              phase: overrun.code || overrun.name || t('creator.msel.table.pendingCode'),
              end: formatOffset(overrun.end_offset),
              session: formatOffset(session),
            })}
          </p>
        )}
        {gap > 0 && (
          <p className="rounded-sm border border-inactive-1/50 bg-inactive-1/5 p-3 text-sm text-pretty">
            {t('creator.msel.gaps.willClose', {
              session: formatSpan(gap),
              scenario: formatSpan(gap * draft.time_compression),
            })}
          </p>
        )}
        {/* A phase at T+0 opens the incident: nothing to jump from. */}
        {phase.start_offset > 0 && (
          <Field
            id={id('incident_jump_minutes')}
            label={t('creator.msel.fields.incident_jump_minutes')}
            hint={t('creator.msel.hints.incident_jump')}
            optional
          >
            <HoursInput
              id={id('incident_jump_minutes')}
              minutes={phase.incident_jump_minutes || null}
              maxMinutes={MAX_INCIDENT_JUMP_MINUTES}
              onChange={(minutes) => setPhase({ ...phase, incident_jump_minutes: minutes ?? 0 })}
            />
          </Field>
        )}
        <Field
          id={id('situation_update')}
          label={t('creator.msel.fields.situation_update')}
          optional
        >
          <TextArea
            id={id('situation_update')}
            value={phase.situation_update}
            onChange={(situation_update) => setPhase({ ...phase, situation_update })}
          />
        </Field>
        <ListInput
          id={id('key_questions')}
          label={t('creator.msel.fields.key_questions')}
          optional
          values={phase.key_questions}
          onChange={(key_questions) => setPhase({ ...phase, key_questions })}
        />
        <CheckboxGroup
          id={id('objective_ids')}
          legend={t('creator.msel.fields.objective_ids')}
          hint={t('creator.msel.hints.objectives')}
          optional
          options={needs.objectives.map((objective) => ({
            value: objective.id,
            code: objective.code,
            label: objectiveName(objective),
          }))}
          selected={phase.objective_ids}
          // Only an objective the phase works on can be due by its end.
          onChange={(objective_ids) =>
            setPhase({
              ...phase,
              objective_ids,
              due_objective_ids: phase.due_objective_ids.filter((o) => objective_ids.includes(o)),
            })
          }
        />
        {phase.objective_ids.length > 0 && (
          <CheckboxGroup
            id={id('due_objective_ids')}
            legend={t('creator.msel.fields.due_objective_ids')}
            hint={t('creator.msel.hints.due')}
            optional
            options={needs.objectives
              .filter((objective) => phase.objective_ids.includes(objective.id))
              .map((objective) => ({
                value: objective.id,
                code: objective.code,
                label: objectiveName(objective),
              }))}
            selected={phase.due_objective_ids}
            onChange={(due_objective_ids) => setPhase({ ...phase, due_objective_ids })}
          />
        )}
      </fieldset>
    </RowDialog>
  )
}
