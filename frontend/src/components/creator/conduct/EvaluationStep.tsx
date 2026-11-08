import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { linkAccent, optionalSuffix } from '../../../lib/buttonStyles'
import {
  conductFieldId,
  DATA_COLLECTION_METHODS,
  emptyEvaluator,
  newPoint,
  patchEvaluator,
  rowId,
  type ConductPrepDraft,
  type DraftPoint,
} from '../../../lib/conductPrep'
import { markSeen, rememberChoice, startsOpen } from '../../../lib/helpText'
import type { EegSourceStatus } from '../../../lib/types'
import { CodeRef } from '../../common/CodeRef'
import { FieldGroup } from '../../common/FieldGroup'
import { IconButton } from '../../common/IconButton'
import { LeadEvaluatorBadge } from '../../common/LeadPlannerBadge'
import { CheckboxGroup, Field, Select, TextArea, TextInput } from '../needs/fields'
import { Hint } from './fields'
import type { StepProps } from './stepProps'
import { objectiveName } from '../../../lib/needsForm'

const STATUS_TONE: Partial<Record<EegSourceStatus, string>> = {
  changed: 'border-inactive-1/60 bg-inactive-1/10',
  orphaned: 'border-inactive-1/60 bg-inactive-1/10',
}

/** Step 1, the evaluation plan: what is measured (the definitive EEGs)
 * and who measures it (evaluator assignments) -- required -- and, optional,
 * how data is collected and who keeps the log. The controller and
 * evaluator briefing is in the session step; the deadlines after the
 * session in documents and follow-up. */
export function EvaluationStep(props: StepProps) {
  const { t } = useTranslation()
  const { prep, draft } = props
  const logKeeper = prep.context.team_members.find((p) => p.user_id === draft.log_keeper_id)
  const dataSummary = [
    t('creator.conductPrep.summaries.methods', { count: draft.data_collection_methods.length }),
    logKeeper && t('creator.conductPrep.summaries.logKeeper', { name: logKeeper.full_name }),
  ]
    .filter(Boolean)
    .join(' · ')
  // The hint names the two sources of the points' text as links.
  const sourceLinks: Record<string, React.ReactNode> = {
    needs: (
      <Link key="needs" to={`/creator/${props.ttxId}/needs?step=objectives`} className={linkAccent}>
        {t('creator.conductPrep.eeg.sourceNeeds')}
      </Link>
    ),
    msel: (
      <Link key="msel" to={`/creator/${props.ttxId}/msel?tab=injects`} className={linkAccent}>
        {t('creator.conductPrep.eeg.sourceMsel')}
      </Link>
    ),
  }
  const eegHint = t('creator.conductPrep.fieldGroups.eeg.hint', {
    needs: '\u0000needs\u0000',
    msel: '\u0000msel\u0000',
    interpolation: { escapeValue: false },
  })
    .split('\u0000')
    .map((part, index) => sourceLinks[part] ?? <span key={index}>{part}</span>)
  return (
    <div className="space-y-5">
      <FieldGroup
        id="cp-eeg-title"
        number={1}
        title={t('creator.conductPrep.fieldGroups.eeg.title')}
        hint={eegHint}
      >
        <EegEditor {...props} />
      </FieldGroup>
      <FieldGroup
        id="cp-evaluators-title"
        number={2}
        title={t('creator.conductPrep.fieldGroups.evaluators.title')}
        hint={t('creator.conductPrep.fieldGroups.evaluators.hint')}
      >
        <EvaluatorAssignments {...props} />
      </FieldGroup>
      <FieldGroup
        id="cp-data-title"
        number={3}
        optional
        title={t('creator.conductPrep.fieldGroups.data.title')}
        hint={t('creator.conductPrep.fieldGroups.data.hint')}
        // Folded even when filled: a new plan starts with the usual methods.
        collapsible={{ filled: false, summary: dataSummary }}
      >
        <DataCollection {...props} />
      </FieldGroup>
    </div>
  )
}

/** The definitive EEGs as an observation ledger: the common scale once,
 * then per objective a compact table of what the Evaluator watches for --
 * where each point comes from, its text, and its scale chip (which levels
 * it adjusts, opening the adjustment in place). Seeded points are read-only
 * (written and removed at their source); points of the plan's own are
 * added, written and removed here. */
function EegEditor({ prep, draft, update, removeRow, isInvalid, readOnly }: StepProps) {
  const { t } = useTranslation()

  function setPoints(eegId: string, change: (points: DraftPoint[]) => DraftPoint[]) {
    update({
      eeg: draft.eeg.map((o) => (o.id === eegId ? { ...o, points: change(o.points) } : o)),
    })
  }

  function patchPoint(eegId: string, id: string, patch: Partial<DraftPoint>) {
    setPoints(eegId, (points) => points.map((p) => (rowId(p) === id ? { ...p, ...patch } : p)))
  }

  function remove(eegId: string, point: DraftPoint, index: number) {
    const id = rowId(point)
    const change = (fn: (points: DraftPoint[]) => DraftPoint[]) => (d: ConductPrepDraft) => ({
      ...d,
      eeg: d.eeg.map((o) => (o.id === eegId ? { ...o, points: fn(o.points) } : o)),
    })
    removeRow(
      t('creator.conductPrep.eeg.removed'),
      change((points) => points.filter((p) => rowId(p) !== id)),
      change((points) => {
        if (points.some((p) => rowId(p) === id)) return points
        const next = [...points]
        next.splice(Math.min(index, next.length), 0, point)
        return next
      }),
    )
  }

  if (prep.eeg.length === 0) {
    return <Hint>{t('creator.conductPrep.eeg.empty')}</Hint>
  }

  return (
    <div className="space-y-4">
      <ScaleStrip />
      {prep.eeg.map((objective) => (
        <ObjectiveLedger
          key={objective.id}
          objective={objective}
          points={draft.eeg.find((o) => o.id === objective.id)?.points ?? []}
          isInvalid={isInvalid}
          readOnly={readOnly}
          onPatch={(id, patch) => patchPoint(objective.id, id, patch)}
          onAdd={() => {
            const point = newPoint()
            setPoints(objective.id, (list) => [...list, point])
            return rowId(point)
          }}
          onRemove={(point, index) => remove(objective.id, point, index)}
        />
      ))}
    </div>
  )
}

const LEVELS = ['p', 's', 'm', 'u'] as const
type Level = (typeof LEVELS)[number]
const levelKey = (level: Level) => level.toUpperCase() as 'P' | 'S' | 'M' | 'U'
const adjustedLevels = (point: DraftPoint) =>
  LEVELS.filter((level) => point[`criteria_${level}`].trim())

/** A level's letter in a small square: the scale's one visual token. */
function LevelMark({ level, filled = false }: { level: Level; filled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-xs border font-mono text-[11px] leading-none font-semibold ${
        filled
          ? 'border-accent bg-accent text-ink'
          : 'border-paper-line text-paper-ink/70 dark:border-line dark:text-fg-muted'
      }`}
    >
      {levelKey(level)}
    </span>
  )
}

/** The common scale on one line -- each level and its short name -- with
 * the full definitions behind a disclosure (open the first time, then as
 * the viewer left it). */
function ScaleStrip() {
  const { t } = useTranslation()
  const memoryId = 'creator.conductPrep.eeg.scaleDefinitions'
  const [open, setOpen] = useState(() => startsOpen(memoryId))
  useEffect(() => {
    if (open) markSeen(memoryId)
    // Only the first render records the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <section
      aria-labelledby="cp-scale-title"
      className="rounded-sm border border-panel-line px-3 py-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <h4 id="cp-scale-title" className="text-sm font-semibold">
          {t('creator.conductPrep.eeg.scaleTitle')}
        </h4>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEVELS.map((level) => (
            <li key={level} className="inline-flex items-center gap-1.5 text-xs">
              <LevelMark level={level} />
              {t(`creator.conductPrep.eeg.levelShort.${level}`)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="cp-scale-definitions"
          onClick={() => {
            rememberChoice(memoryId, !open)
            setOpen(!open)
          }}
          className={`ml-auto inline-flex items-center gap-1 rounded-xs text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
        >
          {open
            ? t('creator.conductPrep.eeg.hideDefinitions')
            : t('creator.conductPrep.eeg.showDefinitions')}
          <span aria-hidden="true">{open ? '▴' : '▾'}</span>
        </button>
      </div>
      {open && (
        <div id="cp-scale-definitions" className="mt-3 space-y-2">
          <dl className="grid gap-x-3 gap-y-1.5 text-xs sm:grid-cols-[auto_1fr]">
            {LEVELS.map((level) => (
              <div key={level} className="contents">
                <dt className="inline-flex items-center gap-1.5 font-medium">
                  <LevelMark level={level} />
                  {t(`creator.conductPrep.eeg.levelShort.${level}`)}
                </dt>
                <dd className="text-paper-ink/70 sm:pt-0.5 dark:text-fg-muted">
                  {t(`creator.needs.outputs.ratingDefinitions.${levelKey(level)}`)}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('creator.conductPrep.eeg.scaleHint')}
          </p>
        </div>
      )}
    </section>
  )
}

/** One objective's observation points as a compact table: source, what
 * is observed, and the scale chip; one adjustment open at a time. */
function ObjectiveLedger({
  objective,
  points,
  isInvalid,
  readOnly,
  onPatch,
  onAdd,
  onRemove,
}: {
  objective: StepProps['prep']['eeg'][number]
  points: DraftPoint[]
  isInvalid: StepProps['isInvalid']
  readOnly: boolean
  onPatch: (id: string, patch: Partial<DraftPoint>) => void
  onAdd: () => string
  onRemove: (point: DraftPoint, index: number) => void
}) {
  const { t } = useTranslation()
  const [openId, setOpenId] = useState<string | null>(null)
  // A point just added gets the focus once it's rendered.
  const focusNext = useRef<string | null>(null)
  const adjusted = points.filter((p) => adjustedLevels(p).length > 0).length

  useEffect(() => {
    if (!focusNext.current) return
    document.getElementById(conductFieldId('text', focusNext.current))?.focus()
    focusNext.current = null
  }, [points])

  return (
    <article
      id={conductFieldId('eeg', objective.id)}
      tabIndex={-1}
      aria-labelledby={`cp-eeg-${objective.id}`}
      className="overflow-hidden rounded-sm border border-panel-line bg-panel"
    >
      {/* A faint band marks where each objective starts when scanning. */}
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-panel-line bg-paper-ink/[0.05] px-3 py-2 dark:bg-white/[0.07]">
        <h4 id={`cp-eeg-${objective.id}`} className="text-sm font-semibold">
          <CodeRef code={objective.code} title={objectiveName(objective)} />
        </h4>
        <span className="flex flex-wrap items-center gap-x-3 text-xs text-paper-ink/60 dark:text-fg-faint">
          {objective.orphaned && (
            <span className="rounded-xs border border-inactive-1/60 bg-inactive-1/10 px-1.5 text-paper-ink dark:text-fg">
              {t('creator.conductPrep.eeg.objectiveOrphaned')}
            </span>
          )}
          <span>{t('creator.conductPrep.eeg.pointsCount', { count: points.length })}</span>
          {adjusted > 0 && (
            <span>{t('creator.conductPrep.eeg.adjustedCount', { count: adjusted })}</span>
          )}
        </span>
      </header>
      {points.length === 0 ? (
        <p
          id={conductFieldId('points', objective.id)}
          tabIndex={-1}
          className={`px-3 py-3 text-sm ${isInvalid('points', objective.id) ? 'text-danger-fg' : 'text-paper-ink/60 dark:text-fg-faint'}`}
        >
          {t('creator.conductPrep.eeg.noPoints')}
        </p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[9rem_minmax(0,1fr)_auto] gap-x-4 px-3 pt-2 text-xs text-paper-ink/60 lg:grid dark:text-fg-faint"
          >
            <span>{t('creator.conductPrep.eeg.columns.source')}</span>
            <span>{t('creator.conductPrep.eeg.columns.observe')}</span>
            <span className="w-[8.5rem] text-right">
              {t('creator.conductPrep.eeg.columns.scale')}
            </span>
          </div>
          <ul className="divide-y divide-panel-line">
            {points.map((point, index) => {
              const id = rowId(point)
              return (
                <PointRow
                  key={id}
                  id={id}
                  point={point}
                  open={openId === id}
                  invalid={isInvalid('text', id)}
                  readOnly={readOnly}
                  onToggle={() => setOpenId(openId === id ? null : id)}
                  onPatch={(patch) => onPatch(id, patch)}
                  onRemove={() => onRemove(point, index)}
                />
              )
            })}
          </ul>
        </>
      )}
      {!readOnly && (
        <div className="border-t border-panel-line px-3 py-2">
          <button
            type="button"
            onClick={() => {
              focusNext.current = onAdd()
            }}
            className={`rounded-xs text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
          >
            {t('creator.conductPrep.eeg.addOwnPoint')}
          </button>
        </div>
      )}
    </article>
  )
}

function PointRow({
  id,
  point,
  open,
  invalid,
  readOnly,
  onToggle,
  onPatch,
  onRemove,
}: {
  id: string
  point: DraftPoint
  open: boolean
  invalid: boolean
  readOnly: boolean
  onToggle: () => void
  onPatch: (patch: Partial<DraftPoint>) => void
  onRemove: () => void
}) {
  const { t } = useTranslation()
  const adjusted = adjustedLevels(point)
  const panelId = `${conductFieldId('criteria', id)}-levels`
  const chipLabel =
    adjusted.length > 0
      ? t('creator.conductPrep.eeg.scaleAdjusted', {
          levels: adjusted.map(levelKey).join(', '),
        })
      : t('creator.conductPrep.eeg.scaleCommon')
  const custom = point.kind === 'custom'
  const details = [
    point.responsible_role,
    point.expected_within_minutes !== null && point.expected_within_minutes !== undefined
      ? t('creator.conductPrep.eeg.within', { minutes: point.expected_within_minutes })
      : '',
  ].filter(Boolean)

  return (
    <li className="px-3 py-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1.5 lg:grid-cols-[9rem_minmax(0,1fr)_auto] lg:items-start">
        <div className="col-start-1 row-start-1 text-sm text-paper-ink/70 lg:pt-1.5 dark:text-fg-muted">
          {point.kind === 'expected_action' ? (
            <CodeRef
              code={point.source_inject_code}
              title={point.source_inject_title}
              variant="stacked"
            />
          ) : custom ? (
            t('creator.conductPrep.eeg.source.custom')
          ) : point.kind === 'notification' ? (
            t('creator.conductPrep.eeg.source.notification')
          ) : (
            t('creator.conductPrep.eeg.source.criterion')
          )}
        </div>
        <div className="col-span-2 row-start-2 min-w-0 lg:col-span-1 lg:col-start-2 lg:row-start-1">
          {custom ? (
            <TextInput
              id={conductFieldId('text', id)}
              value={point.text}
              invalid={invalid}
              maxLength={5000}
              placeholder={t('creator.conductPrep.eeg.textPlaceholder')}
              onChange={(text) => onPatch({ text })}
            />
          ) : (
            // Written at its source (success criterion, expected action, the
            // notification requirement an objective cites).
            <p
              id={conductFieldId('text', id)}
              tabIndex={-1}
              className="text-sm text-pretty lg:pt-1.5"
            >
              {point.text}
              {STATUS_TONE[point.source_status] && (
                <span
                  className={`ml-2 inline-block rounded-xs border px-1.5 text-xs ${STATUS_TONE[point.source_status]}`}
                  title={
                    point.source_text
                      ? t('creator.conductPrep.eeg.sourceWas', { text: point.source_text })
                      : undefined
                  }
                >
                  {t(`creator.conductPrep.eeg.sourceStatus.${point.source_status}`)}
                </span>
              )}
            </p>
          )}
          {details.length > 0 && (
            <p className="mt-0.5 text-xs text-paper-ink/60 dark:text-fg-faint">
              {details.join(' · ')}
            </p>
          )}
        </div>
        <div // Wide enough for the scale chip and the trash button (or its spacer):
          // narrower, the chip spills over the own point's input.
          className="col-start-2 row-start-1 flex shrink-0 items-center justify-end gap-1 lg:col-start-3 lg:w-[8.5rem]"
        >
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            title={chipLabel}
            onClick={onToggle}
            className={`inline-flex items-center gap-0.5 rounded-xs p-1 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${open ? 'bg-hover ring-1 ring-accent-fg/60' : ''}`}
          >
            {LEVELS.map((level) => (
              <LevelMark key={level} level={level} filled={adjusted.includes(level)} />
            ))}
            <span className="sr-only">{chipLabel}</span>
          </button>
          {custom && !readOnly ? (
            <IconButton
              label={
                point.text.trim()
                  ? t('creator.conductPrep.eeg.removeOwnPoint', { text: point.text.trim() })
                  : t('creator.conductPrep.eeg.removeOwnPointEmpty')
              }
              onClick={onRemove}
            />
          ) : (
            // Keeps the chips aligned whether or not a row can be removed.
            <span aria-hidden="true" className="hidden w-9 lg:block" />
          )}
        </div>
      </div>
      {open && (
        <div
          id={panelId}
          className="mt-2.5 space-y-2 rounded-sm border border-panel-line p-3 lg:ml-[calc(9rem+1rem)]"
        >
          <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('creator.conductPrep.eeg.adjustHint')}
          </p>
          <div className="grid gap-x-4 gap-y-2 2xl:grid-cols-2">
            {LEVELS.map((level) => (
              <label key={level} className="space-y-1 text-xs">
                <span className="inline-flex items-center gap-1.5 font-medium">
                  <LevelMark level={level} filled={adjusted.includes(level)} />
                  {t(`creator.conductPrep.eeg.levelShort.${level}`)}
                </span>
                <TextArea
                  id={conductFieldId(`criteria_${level}`, id)}
                  value={point[`criteria_${level}`]}
                  rows={2}
                  placeholder={`${t(
                    `creator.needs.outputs.ratingDefinitions.${levelKey(level)}`,
                  ).replace(/\.$/, '')}…`}
                  onChange={(value) => onPatch({ [`criteria_${level}`]: value })}
                />
              </label>
            ))}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onToggle}
              className={`rounded-xs text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
            >
              {t('creator.conductPrep.eeg.adjustDone')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

const toggled = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value]

/** Who covers what: objectives (each needs at least one Evaluator) and,
 * optionally, participating areas, as matrices with the exercise's
 * Evaluators as columns. The Evaluators and the Lead Evaluator are the
 * exercise team's (Creator -> Exercise), only linked from here. */
function EvaluatorAssignments({ prep, draft, update, isInvalid, readOnly, ttxId }: StepProps) {
  const { t } = useTranslation()
  const people = prep.context.exercise_evaluators
  const lead = prep.context.lead_evaluator
  const rowOf = (userId: string) =>
    draft.evaluators.find((e) => e.user_id === userId) ?? emptyEvaluator(userId)

  const teamLink = (
    <Link to={`/creator/${ttxId}/exercise?edit=1`} className={linkAccent}>
      {t('creator.conductPrep.evaluators.teamLink')}
    </Link>
  )

  if (people.length === 0) {
    return (
      <p id={conductFieldId('evaluators')} tabIndex={-1} className="text-sm">
        {t('creator.conductPrep.evaluators.none')} {teamLink}
      </p>
    )
  }

  const columns = people.map((person) => ({
    id: person.user_id,
    label: person.full_name,
    lead: lead?.user_id === person.user_id,
  }))
  const objectives = prep.eeg.filter((o) => !o.orphaned)

  return (
    <div className="space-y-4">
      {lead ? null : (
        <p
          id={conductFieldId('lead_evaluator')}
          tabIndex={-1}
          className={`text-sm ${isInvalid('lead_evaluator') ? 'text-danger-fg' : ''}`}
        >
          {t('creator.conductPrep.evaluators.noLead')} {teamLink}
        </p>
      )}
      <CoverageMatrix
        caption={t('creator.conductPrep.evaluators.objective')}
        columns={columns}
        rows={objectives.map((o) => ({
          id: o.id,
          domId: conductFieldId('evaluators', o.id),
          name: o.code,
          label: <CodeRef code={o.code} title={objectiveName(o)} />,
          invalid: isInvalid('evaluators', o.id),
        }))}
        isChecked={(rowId, userId) => rowOf(userId).objective_ids.includes(rowId)}
        onToggle={(rowId, userId) =>
          patchEvaluator(draft, update, userId, {
            objective_ids: toggled(rowOf(userId).objective_ids, rowId),
          })
        }
        required
        disabled={readOnly}
      />
      {prep.context.participating_areas.length > 0 && (
        <CoverageMatrix
          caption={t('creator.conductPrep.evaluators.area')}
          title={t('creator.conductPrep.evaluators.areasTitle')}
          columns={columns}
          rows={prep.context.participating_areas.map((area) => ({
            id: area,
            domId: conductFieldId('areas', area),
            name: area,
            label: area,
            invalid: isInvalid('areas', area),
          }))}
          isChecked={(area, userId) => rowOf(userId).areas.includes(area)}
          onToggle={(area, userId) =>
            patchEvaluator(draft, update, userId, { areas: toggled(rowOf(userId).areas, area) })
          }
          disabled={readOnly}
        />
      )}
      <p className="text-xs">{teamLink}</p>
      <Hint>{t('creator.conductPrep.evaluators.rule')}</Hint>
    </div>
  )
}

/** Rows to cover × the exercise's Evaluators, a checkbox per cell and,
 * at the end, whether the row is covered (required rows flag a gap). */
function CoverageMatrix({
  caption,
  title,
  columns,
  rows,
  isChecked,
  onToggle,
  required = false,
  disabled,
}: {
  caption: string
  title?: string
  columns: { id: string; label: string; lead: boolean }[]
  rows: { id: string; domId: string; name: string; label: React.ReactNode; invalid: boolean }[]
  isChecked: (rowId: string, columnId: string) => boolean
  onToggle: (rowId: string, columnId: string) => void
  required?: boolean
  disabled: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      {title && (
        <p className="text-sm font-medium">
          {title} <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
        </p>
      )}
      <div className="overflow-x-auto rounded-sm border border-panel-line">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-panel-line text-xs text-paper-ink/70 dark:text-fg-muted">
              <th scope="col" className="px-3 py-2 font-medium">
                {caption}
              </th>
              {columns.map((column) => (
                <th key={column.id} scope="col" className="px-3 py-2 text-center font-medium">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    {column.label}
                    {column.lead && <LeadEvaluatorBadge />}
                  </span>
                </th>
              ))}
              {required && (
                <th scope="col" className="px-3 py-2 text-right font-medium">
                  {t('creator.conductPrep.evaluators.covered')}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-panel-line">
            {rows.map((row) => {
              const covered = columns.some((column) => isChecked(row.id, column.id))
              return (
                <tr key={row.id} id={row.domId} tabIndex={-1}>
                  <th scope="row" className="px-3 py-2 font-normal">
                    {row.label}
                  </th>
                  {columns.map((column) => (
                    <td key={column.id} className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={isChecked(row.id, column.id)}
                        disabled={disabled}
                        aria-label={t('creator.conductPrep.evaluators.cellLabel', {
                          row: row.name,
                          name: column.label,
                        })}
                        onChange={() => onToggle(row.id, column.id)}
                        className="h-4 w-4 accent-accent-fg"
                      />
                    </td>
                  ))}
                  {required && (
                    <td
                      className={`px-3 py-2 text-right text-xs whitespace-nowrap ${
                        covered
                          ? 'text-success-fg'
                          : row.invalid
                            ? 'text-danger-fg'
                            : 'text-paper-ink/60 dark:text-fg-muted'
                      }`}
                    >
                      {covered ? (
                        <>
                          <span aria-hidden="true">✓</span>
                          <span className="sr-only">
                            {t('creator.conductPrep.evaluators.covered')}
                          </span>
                        </>
                      ) : (
                        t('creator.conductPrep.evaluators.uncovered')
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function DataCollection({ prep, draft, update, isInvalid }: StepProps) {
  const { t } = useTranslation()
  const methods = t('creator.conductPrep.dataCollection.methods', {
    returnObjects: true,
  }) as Record<string, string>
  return (
    <div className="space-y-4">
      <CheckboxGroup
        id={conductFieldId('data_collection_methods')}
        legend={t('creator.conductPrep.fields.data_collection_methods')}
        columns={2}
        options={DATA_COLLECTION_METHODS.map((value) => ({ value, label: methods[value] }))}
        selected={draft.data_collection_methods}
        onChange={(data_collection_methods) => update({ data_collection_methods })}
      />
      {draft.data_collection_methods.includes('other') && (
        <Field
          id={conductFieldId('data_collection_other')}
          label={t('creator.conductPrep.fields.data_collection_other')}
        >
          <TextInput
            id={conductFieldId('data_collection_other')}
            value={draft.data_collection_other}
            maxLength={255}
            invalid={isInvalid('data_collection_other')}
            onChange={(data_collection_other) => update({ data_collection_other })}
          />
        </Field>
      )}
      <Field
        id={conductFieldId('log_keeper_id')}
        label={t('creator.conductPrep.fields.log_keeper_id')}
        hint={t('creator.conductPrep.dataCollection.logKeeperHint')}
        optional
      >
        <Select
          id={conductFieldId('log_keeper_id')}
          value={draft.log_keeper_id}
          hint
          invalid={isInvalid('log_keeper_id')}
          placeholder={t('creator.conductPrep.dataCollection.pickPerson')}
          options={prep.context.team_members.map((p) => ({ value: p.user_id, label: p.full_name }))}
          onChange={(log_keeper_id) => update({ log_keeper_id })}
        />
      </Field>
    </div>
  )
}
