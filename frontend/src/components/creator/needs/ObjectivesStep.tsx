import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import { codeRefText } from '../../../lib/codeRef'
import {
  actionsCellClass,
  btnSecondary,
  inputBase,
  linkAccent,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../../lib/buttonStyles'
import {
  byCode,
  CAPABILITIES,
  fieldDomId,
  classifyLevel,
  MAX_OBJECTIVES,
  newRowKey,
  pick,
  splitEnumerated,
  stripLevel,
  textLines,
  type ObjectiveDraft,
  needName,
  type NeedDraft,
  objectiveName,
} from '../../../lib/needsForm'
import {
  panelActionsTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../../lib/panelStyles'
import { expectedNotifications } from '../../../lib/notifications'
import type { Capability, RegulatoryCatalog } from '../../../lib/types'
import { CodeRefList } from '../../common/CodeRef'
import { EditButton } from '../../common/EditButton'
import { IconButton } from '../../common/IconButton'
import { NotificationReference } from '../../common/NotificationReference'
import { ScrollArea } from '../../common/ScrollArea'
import { CheckboxGroup, Field, Select, TextArea, TextInput } from './fields'
import { Segmented } from './NeedsStep'
import { LineListEditor } from './LineListEditor'
import { ObjectiveLibraryDialog } from './NeedsLibraryPicker'
import { objectiveTemplateText } from '../../../lib/needsLibrary'
import { RatingLevels } from '../../common/RatingLevels'
import { RegulatoryPicker } from './RegulatoryPicker'
import { RowDialog } from './RowDialog'
import type { StepProps } from './stepProps'

const OBJECTIVE_GROUP_BY = ['capability', 'need'] as const
type ObjectiveGroupBy = (typeof OBJECTIVE_GROUP_BY)[number]

/** The objectives in groups, each by code. By capability: the catalogue's
 * order, only the ones in use. By need: every need by code, empty ones
 * included (no objective answers it yet), so an objective answering two
 * needs shows under both; one linked to none goes last. */
function groupObjectives(
  draft: { objectives: ObjectiveDraft[]; needs: NeedDraft[] },
  groupBy: ObjectiveGroupBy,
  labels: {
    capability: (value: Capability) => string
    need: (need: NeedDraft) => string
    noNeed: string
  },
) {
  const sorted = [...draft.objectives].sort(byCode)
  if (groupBy === 'capability') {
    return CAPABILITIES.map((value) => ({
      key: value,
      heading: labels.capability(value),
      objectives: sorted.filter((objective) => objective.capability === value),
    })).filter((group) => group.objectives.length > 0)
  }
  const groups = [...draft.needs].sort(byCode).map((need) => ({
    key: need.key,
    heading: labels.need(need),
    objectives: sorted.filter((objective) => objective.linked_need_keys.includes(need.key)),
  }))
  const unlinked = sorted.filter((objective) =>
    objective.linked_need_keys.every((key) => !draft.needs.some((need) => need.key === key)),
  )
  return unlinked.length > 0
    ? [...groups, { key: 'no-need', heading: labels.noNeed, objectives: unlinked }]
    : groups
}

/** Section 5 -- SMART objectives (at most five). */
export function ObjectivesStep({
  draft,
  update,
  removeRow,
  isInvalid,
  catalog,
  focusRow,
  newObjective,
  renumberButton,
}: StepProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<{ objective: ObjectiveDraft; isNew: boolean } | null>(null)
  const [focusField, setFocusField] = useState<string | null>(null)
  const [libraryOpen, setLibraryOpen] = useState(false)

  const [handledRow, setHandledRow] = useState<StepProps['focusRow']>(null)
  if (focusRow && focusRow !== handledRow) {
    setHandledRow(focusRow)
    const objective = draft.objectives.find((o) => o.key === focusRow.itemId)
    if (objective) {
      setEditing({ objective, isNew: false })
      setFocusField(fieldDomId(focusRow.field, objective.key))
    }
  }

  // A fix elsewhere asked for an objective: open it prefilled.
  const [handledNew, setHandledNew] = useState<StepProps['newObjective']>(null)
  if (newObjective && newObjective !== handledNew) {
    setHandledNew(newObjective)
    const need = draft.needs.find((n) => n.key === newObjective.needKey)
    const wanted = newObjective.capability ?? need?.affected_capability
    add({
      linked_need_keys: need ? [need.key] : [],
      ...(wanted && draft.capabilities.includes(wanted as Capability)
        ? { capability: wanted as Capability }
        : {}),
    })
  }

  const pending = t('creator.needs.table.pendingCode')
  const codeOf = (item: { code: string }) => item.code || pending
  const full = draft.objectives.length >= MAX_OBJECTIVES
  const notifications = expectedNotifications(draft.objectives, catalog, pending)
  const noCapabilities = draft.capabilities.length === 0

  // Grouped by capability unless asked otherwise; in the URL, like Needs.
  const [searchParams, setSearchParams] = useSearchParams()
  const groupBy = pick(OBJECTIVE_GROUP_BY, searchParams.get('group'), 'capability')
  function setGroupBy(value: ObjectiveGroupBy) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'capability') next.delete('group')
        else next.set('group', value)
        return next
      },
      { replace: true },
    )
  }
  const groups = groupObjectives(draft, groupBy, {
    capability: (value) => t(`creator.needs.capabilities.${value}`),
    need: (need) => codeRefText(need.code, needName(need), pending),
    noNeed: t('creator.needs.table.noLinkedNeed'),
  })
  const columns = 2 + (groupBy === 'capability' ? 0 : 1) + (groupBy === 'need' ? 0 : 1)

  function save(objective: ObjectiveDraft) {
    update({
      objectives: draft.objectives.some((o) => o.key === objective.key)
        ? // Keep the id (and code) a save may have given the row meanwhile.
          draft.objectives.map((o) =>
            o.key === objective.key
              ? { ...objective, id: o.id ?? objective.id, code: o.code || objective.code }
              : o,
          )
        : [...draft.objectives, objective],
    })
    setEditing(null)
  }

  function add(prefill: Partial<ObjectiveDraft> = {}) {
    setFocusField(null)
    setEditing({
      objective: {
        id: null,
        key: newRowKey(),
        code: '',
        title: '',
        statement: '',
        capability: draft.capabilities[0],
        linked_need_keys: [],
        success_criterion: '',
        achieve_at_least: null,
        time_box_minutes: null,
        achieved_note: '',
        partially_achieved: '',
        not_achieved: '',
        evidence: '',
        regulatory_requirement_ids: [],
        ...prefill,
      },
      isNew: true,
    })
  }

  return (
    <div className="space-y-4">
      {/* One toolbar line, as in Needs: grouping on the left, the limit
          and adding on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {draft.objectives.length > 0 ? (
          <Segmented
            id="objectives-group"
            label={t('creator.needs.table.groupBy')}
            options={OBJECTIVE_GROUP_BY.map((value) => ({
              value,
              label: t(`creator.needs.table.group.${value}`),
            }))}
            value={groupBy}
            onChange={setGroupBy}
          />
        ) : (
          <span />
        )}
        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {noCapabilities
              ? t('creator.needs.hints.objectiveCapabilityFromSelection')
              : t('creator.needs.hints.objectivesLimit', { max: MAX_OBJECTIVES })}
          </p>
          {renumberButton('objectives')}
          <button
            type="button"
            onClick={() => setLibraryOpen(true)}
            disabled={full || noCapabilities || draft.needs.length === 0}
            className={btnSecondary}
          >
            {t('creator.needs.library.addFromLibrary')}
          </button>
          <button
            // The validation summary's "no objective validates X" lands here
            // once the list isn't empty (the empty-state text has the id before).
            id={draft.objectives.length > 0 ? fieldDomId('objectives') : undefined}
            type="button"
            onClick={() => add()}
            disabled={full || noCapabilities || draft.needs.length === 0}
            className={btnSecondary}
          >
            <span aria-hidden="true">+ </span>
            {t('creator.needs.actions.addObjective')}
          </button>
        </div>
      </div>
      {draft.objectives.length === 0 ? (
        <p
          id={fieldDomId('objectives')}
          tabIndex={-1}
          className={`py-8 text-center text-sm ${isInvalid('objectives') ? 'text-danger-fg' : 'text-paper-ink/70 dark:text-fg-muted'}`}
        >
          {t('creator.needs.table.noObjectives')}
        </p>
      ) : (
        <div className="-mx-5">
          {/* Fixed widths: the statement gives way (cut), so the table never
              scrolls sideways. */}
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col />
              {groupBy !== 'capability' && <col className="w-40 lg:w-52" />}
              {groupBy !== 'need' && <col className="w-52 lg:w-64" />}
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className={panelTableHeadRow}>
                <th className={panelTh}>{t('creator.needs.table.objective')}</th>
                {groupBy !== 'capability' && (
                  <th className={panelTh}>{t('creator.needs.fields.capability')}</th>
                )}
                {groupBy !== 'need' && (
                  <th className={panelTh}>{t('creator.needs.fields.linked_need_keys')}</th>
                )}
                <th className={panelActionsTh}>{t('common.table.actions')}</th>
              </tr>
            </thead>
            {groups.map((group) => (
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
                        {t('creator.needs.table.objectiveCount', {
                          count: group.objectives.length,
                        })}
                      </span>
                    </span>
                  </th>
                </tr>
                {group.objectives.length === 0 && (
                  <tr>
                    <td
                      colSpan={columns}
                      className={`${panelTd} text-sm text-paper-ink/60 italic dark:text-fg-faint`}
                    >
                      {t('creator.needs.table.noObjectiveForNeed')}
                    </td>
                  </tr>
                )}
                {group.objectives.map((objective) => {
                  const invalid = [
                    'title',
                    'statement',
                    'success_criterion',
                    'evidence',
                    'linked_need_keys',
                    'capability',
                  ].some((field) => isInvalid(field, objective.key))
                  return (
                    <tr key={objective.key} className={panelTr}>
                      <td className={`${panelTd} min-w-0 text-sm`}>
                        {/* As in Needs: code and title first; the statement,
                          and how it's judged, under them. */}
                        <span
                          className={`block font-medium ${invalid ? 'text-danger-fg' : 'text-paper-ink dark:text-fg'}`}
                        >
                          <span translate="no" className="tabular-nums">
                            {codeOf(objective)}
                          </span>
                          <span
                            aria-hidden="true"
                            className="mx-1.5 text-paper-ink/35 dark:text-fg-faint"
                          >
                            |
                          </span>
                          <span className="sr-only">, </span>
                          {objective.title.trim() || (
                            <span className="italic text-paper-ink/60 dark:text-fg-faint">
                              {t('creator.needs.table.untitled')}
                            </span>
                          )}
                        </span>
                        {objective.statement.trim() && (
                          <span
                            title={objective.statement}
                            className="mt-0.5 block truncate text-xs text-paper-ink/70 dark:text-fg-muted"
                          >
                            {objective.statement}
                          </span>
                        )}
                        <MeasureSummary objective={objective} />
                      </td>
                      {groupBy !== 'capability' && (
                        <td className={`${panelTd} text-sm`}>
                          {t(`creator.needs.capabilities.${objective.capability}`)}
                        </td>
                      )}
                      {groupBy !== 'need' && (
                        <td className={`${panelTd} min-w-0 text-sm`}>
                          <CodeRefList
                            wrap
                            pending={pending}
                            items={objective.linked_need_keys
                              .map((key) => draft.needs.find((n) => n.key === key))
                              .filter((need): need is NeedDraft => need !== undefined)
                              .map((need) => ({
                                key: need.key,
                                code: need.code,
                                title: needName(need),
                              }))}
                          />
                        </td>
                      )}
                      <td className={panelTd}>
                        <div className={actionsCellClass}>
                          <EditButton
                            label={t('creator.needs.actions.editObjective', {
                              code: codeOf(objective),
                            })}
                            onClick={() => {
                              setFocusField(null)
                              setEditing({ objective, isNew: false })
                            }}
                          />
                          <IconButton
                            label={t('creator.needs.actions.removeObjective', {
                              code: codeOf(objective),
                            })}
                            onClick={() =>
                              removeRow(
                                'objectives',
                                objective.key,
                                t('creator.needs.toast.objectiveRemoved', {
                                  code: codeOf(objective),
                                }),
                              )
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {/* A clear break: the reference is its own panel, not more table. */}
      {notifications.length > 0 && (
        <div className="pt-6">
          <NotificationReference variant="design" notifications={notifications} />
        </div>
      )}

      {libraryOpen && (
        <ObjectiveLibraryDialog
          capabilities={draft.capabilities}
          onClose={() => setLibraryOpen(false)}
          onPick={(template, lang) => {
            const text = objectiveTemplateText(template, lang)
            setLibraryOpen(false)
            // Opens the objective dialog prefilled: the Planner links the
            // need it answers and adjusts it before Done.
            add({
              title: text.title,
              statement: text.statement,
              capability: template.capability,
              success_criterion: text.criterion.join('\n'),
              evidence: text.evidence.join('\n'),
              time_box_minutes: template.time_box_minutes,
              regulatory_requirement_ids: template.regulatory_requirement_ids,
            })
          }}
        />
      )}
      {editing && (
        <ObjectiveDialog
          initial={editing.objective}
          title={
            editing.isNew
              ? t('creator.needs.dialogs.newObjective')
              : t('creator.needs.dialogs.editObjective', {
                  code: codeRefText(
                    editing.objective.code,
                    objectiveName(editing.objective),
                    pending,
                    // A title is short: the heading shows it whole.
                    editing.objective.title.trim() ? Infinity : undefined,
                  ),
                })
          }
          capabilities={draft.capabilities}
          needs={draft.needs}
          catalog={catalog}
          frameworks={draft.regulatory_frameworks}
          initialFocusId={focusField}
          // The dialog hands focus back to whatever opened it (the Add
          // button, a row, the storyline strip) without scrolling.
          onCancel={() => setEditing(null)}
          onDone={save}
        />
      )}
    </div>
  )
}

/** One block of the objective dialog: a heading and a line on what it's
 * for, over its fields. The blocks follow how an objective is written:
 * why (the needs it answers), what (the objective and its capability),
 * how it's measured, and -- optional -- the regulations it evidences. */
function DialogBlock({
  id,
  title,
  hint,
  aside,
  children,
}: {
  id: string
  title: string
  hint: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      aria-labelledby={id}
      className="space-y-3 border-t border-panel-line pt-4 first:border-t-0 first:pt-0"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="space-y-0.5">
          <h3 id={id} className="text-sm font-semibold">
            {title}
          </h3>
          <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{hint}</p>
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Under a condition row: an offer to split one that lists several, or to
 * move one that's a rating level to the rating guidance. */
function ConditionAssist({
  line,
  onSplit,
  onMove,
}: {
  line: string
  onSplit: (lead: string, items: string[]) => void
  onMove: () => void
}) {
  const { t } = useTranslation()
  const split = splitEnumerated(line)
  const level = split ? null : classifyLevel(line)
  if (!split && !level) return null
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-inactive-1">
      <span>
        {split
          ? t('creator.needs.objectiveDialog.assist.several', { count: split.items.length })
          : t('creator.needs.objectiveDialog.assist.level')}
      </span>
      <button
        type="button"
        onClick={() => (split ? onSplit(split.lead, split.items) : onMove())}
        className={`rounded-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
      >
        {split
          ? t('creator.needs.objectiveDialog.assist.split', { count: split.items.length })
          : t('creator.needs.objectiveDialog.assist.move', {
              level: t(`creator.needs.measure.levels.${level!}`),
            })}
      </button>
    </p>
  )
}

/** Under a row's statement: how it's judged, at a glance ("3 conditions,
 * at least 2, within 15 min"). */
function MeasureSummary({ objective }: { objective: ObjectiveDraft }) {
  const { t } = useTranslation()
  const conditions = textLines(objective.success_criterion).length
  if (conditions === 0) return null
  const parts = [t('creator.needs.measure.conditions', { count: conditions })]
  if (objective.achieve_at_least)
    parts.push(t('creator.needs.measure.atLeastShort', { count: objective.achieve_at_least }))
  if (objective.time_box_minutes)
    parts.push(t('creator.needs.measure.withinShort', { minutes: objective.time_box_minutes }))
  return (
    <span className="mt-1.5 block text-xs text-paper-ink/60 dark:text-fg-faint">
      {parts.join(', ')}
    </span>
  )
}

/** What the evaluator will get for this objective, live: the points to
 * tick (its conditions and the notifications its requirements add), how
 * it's judged and the evidence to collect -- the EEG, before it exists. */
function ObjectivePreview({
  objective,
  catalog,
}: {
  objective: ObjectiveDraft
  catalog: RegulatoryCatalog | null
}) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const conditions = textLines(objective.success_criterion)
  const evidence = textLines(objective.evidence)
  const notifications = expectedNotifications([objective], catalog, '')
  const muted = 'text-xs text-paper-ink/60 dark:text-fg-faint'
  const box = (
    <span
      aria-hidden="true"
      className="mt-1 h-3 w-3 shrink-0 rounded-xs border border-paper-line dark:border-line"
    />
  )
  const nothing = <p className={muted}>{t('creator.needs.preview.nothing')}</p>
  return (
    <div className="space-y-3 text-sm">
      <p className={muted}>{t('creator.needs.preview.hint')}</p>
      <div className="space-y-1">
        <p className="text-pretty font-semibold">{objective.title.trim() || '—'}</p>
        {objective.statement.trim() && (
          <p className="text-pretty text-paper-ink/80 dark:text-fg-nav">{objective.statement}</p>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">{t('creator.needs.outputs.observationPoints')}</p>
        {conditions.length + notifications.length === 0 ? (
          nothing
        ) : (
          <ul className="space-y-1">
            {conditions.map((condition, index) => (
              <li key={`c-${index}`} className="flex items-start gap-2">
                {box}
                <span className="min-w-0 break-words">{condition}</span>
              </li>
            ))}
            {notifications.map((item) => (
              <li key={item.requirement_id} className="flex items-start gap-2">
                {box}
                <span className="min-w-0 break-words">
                  {t('creator.needs.preview.notification', {
                    regime: `${spanish ? item.framework_label_es : item.framework_label_en} ${item.reference}`,
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
        {objective.time_box_minutes ? (
          <p className={muted}>
            {t('creator.needs.measure.within', { minutes: objective.time_box_minutes })}
          </p>
        ) : null}
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium">{t('creator.needs.fields.evidence')}</p>
        {evidence.length === 0 ? (
          nothing
        ) : (
          <ul className="space-y-1">
            {evidence.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                {box}
                <span className="min-w-0 break-words">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <RatingLevels
        conditions={conditions.length}
        achieveAtLeast={objective.achieve_at_least}
        achievedNote={objective.achieved_note}
        partiallyAchieved={objective.partially_achieved}
        notAchieved={objective.not_achieved}
      />
    </div>
  )
}

/** One outcome of "How to rate it": its name and the scale's boxes it
 * stands for on the left, what it means here on the right. */
function LevelRow({
  id,
  level,
  scale,
  children,
}: {
  id: string
  level: string
  scale: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-x-4 gap-y-1.5 px-3 py-2.5 sm:grid-cols-[10rem_minmax(0,1fr)]">
      <label htmlFor={id} className="text-sm sm:pt-2">
        <span className="block font-medium">{level}</span>
        <span
          translate="no"
          className="block font-mono text-xs text-paper-ink/60 dark:text-fg-faint"
        >
          {scale}
        </span>
      </label>
      <div className="min-w-0 space-y-1.5">{children}</div>
    </div>
  )
}

/** Without blank rows: what's kept when the dialog is done. */
function tidy(objective: ObjectiveDraft): ObjectiveDraft {
  const clean = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .join('\n')
  const success_criterion = clean(objective.success_criterion)
  const n = textLines(success_criterion).length
  return {
    ...objective,
    success_criterion,
    evidence: clean(objective.evidence),
    achieved_note: objective.achieved_note.trim(),
    partially_achieved: objective.partially_achieved.trim(),
    not_achieved: objective.not_achieved.trim(),
    achieve_at_least:
      objective.achieve_at_least && objective.achieve_at_least < n
        ? objective.achieve_at_least
        : null,
  }
}

function ObjectiveDialog({
  initial,
  title,
  capabilities,
  needs,
  catalog,
  frameworks,
  initialFocusId,
  onCancel,
  onDone,
}: {
  initial: ObjectiveDraft
  title: string
  capabilities: Capability[]
  needs: NeedDraft[]
  catalog: RegulatoryCatalog | null
  /** The frameworks named in Triggers: their requirements come first. */
  frameworks: string[]
  initialFocusId: string | null
  onCancel: () => void
  onDone: (objective: ObjectiveDraft) => void
}) {
  const { t } = useTranslation()
  const [objective, setObjective] = useState(initial)
  // The capability follows the first need ticked until it's picked by hand.
  const [capabilityTouched, setCapabilityTouched] = useState(!!initial.id)
  const id = (field: string) => fieldDomId(field, objective.key)
  const pending = t('creator.needs.table.pendingCode')

  const conditionCount = textLines(objective.success_criterion).length
  const atLeast =
    objective.achieve_at_least && objective.achieve_at_least < conditionCount
      ? objective.achieve_at_least
      : null

  /** The row at `index` replaced by its numbered items; its lead-in goes
   * to the note on "achieved", and a "15 minutes" in it fills the time box. */
  function splitCondition(index: number, lead: string, items: string[]) {
    const rows = objective.success_criterion.split('\n')
    const minutes = /(\d+)\s*(?:min|minutes|minutos)\b/i.exec(lead)
    setObjective({
      ...objective,
      success_criterion: [...rows.slice(0, index), ...items, ...rows.slice(index + 1)].join('\n'),
      achieved_note: lead
        ? [lead + ':', objective.achieved_note.trim()].filter(Boolean).join('\n')
        : objective.achieved_note,
      time_box_minutes:
        objective.time_box_minutes ?? (minutes ? Math.min(1440, Number(minutes[1])) : null),
    })
  }

  /** A rating level written as a condition, moved to its level: partially
   * or not achieved (without its prefix), or a lead-in to the note on
   * achieved. */
  function moveToGuidance(index: number) {
    const rows = objective.success_criterion.split('\n')
    const line = rows[index].trim()
    const level = classifyLevel(line) ?? 'achieved'
    const field =
      level === 'partial'
        ? 'partially_achieved'
        : level === 'not'
          ? 'not_achieved'
          : 'achieved_note'
    const text = level === 'achieved' ? line : stripLevel(line)
    setObjective({
      ...objective,
      success_criterion: rows.filter((_, i) => i !== index).join('\n'),
      [field]: [objective[field].trim(), text].filter(Boolean).join('\n'),
    })
  }

  function setNeeds(linked_need_keys: string[]) {
    const first = needs.find((need) => need.key === linked_need_keys[0])
    const suggested =
      !capabilityTouched && first && capabilities.includes(first.affected_capability)
        ? first.affected_capability
        : objective.capability
    setObjective({ ...objective, linked_need_keys, capability: suggested })
  }

  return (
    <RowDialog
      titleId="needs-objective-dialog-title"
      title={title}
      size="xl"
      initialFocusId={initialFocusId}
      dirty={JSON.stringify(objective) !== JSON.stringify(initial)}
      onCancel={onCancel}
      onDone={() => onDone(tidy(objective))}
      aside={{
        label: t('creator.needs.preview.title'),
        content: <ObjectivePreview objective={objective} catalog={catalog} />,
      }}
    >
      <DialogBlock
        id="objective-why"
        title={t('creator.needs.objectiveDialog.why.title')}
        hint={t('creator.needs.objectiveDialog.why.hint')}
      >
        <ScrollArea label={t('creator.needs.fields.linked_need_keys')} maxClass="max-h-48">
          <CheckboxGroup
            id={id('linked_need_keys')}
            legend={t('creator.needs.fields.linked_need_keys')}
            options={needs.map((need) => ({
              value: need.key,
              code: need.code || pending,
              label: needName(need) || '—',
            }))}
            selected={objective.linked_need_keys}
            onChange={setNeeds}
          />
        </ScrollArea>
      </DialogBlock>

      <DialogBlock
        id="objective-what"
        title={t('creator.needs.objectiveDialog.what.title')}
        hint={t('creator.needs.objectiveDialog.what.hint')}
      >
        {/* Long texts get the dialog's full width, one under the other. */}
        <div className="space-y-4">
          {/* The block's "What" is its question: the title answers it, so
              it carries no label of its own (only for screen readers). */}
          <div className="space-y-1.5">
            <TextInput
              id={id('title')}
              value={objective.title}
              maxLength={255}
              aria-label={t('creator.needs.fields.title')}
              hint
              placeholder={t('creator.needs.placeholders.objectiveTitle')}
              onChange={(title) => setObjective({ ...objective, title })}
              className={`${inputBase} text-base font-medium`}
            />
            <p id={`${id('title')}-hint`} className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.needs.objectiveDialog.titleHint')}
            </p>
          </div>
          <Field
            id={id('statement')}
            label={t('creator.needs.fields.statement')}
            hint={t('creator.needs.objectiveDialog.statementHint')}
          >
            <TextArea
              id={id('statement')}
              value={objective.statement}
              rows={3}
              placeholder={t('creator.needs.placeholders.statement')}
              onChange={(statement) => setObjective({ ...objective, statement })}
            />
          </Field>
          <div className="max-w-md">
            <Field
              id={id('capability')}
              label={t('creator.needs.fields.capability')}
              hint={t('creator.needs.hints.objectiveCapabilityFromSelection')}
            >
              <Select<Capability>
                id={id('capability')}
                value={objective.capability}
                onChange={(capability) => {
                  setCapabilityTouched(true)
                  setObjective({ ...objective, capability })
                }}
                // Its current capability stays listed even if it was unticked in
                // Capabilities, so the select shows the truth until it's changed.
                options={(capabilities.includes(initial.capability)
                  ? capabilities
                  : [initial.capability, ...capabilities]
                ).map((value) => ({
                  value,
                  label: t(`creator.needs.capabilities.${value}`),
                }))}
              />
            </Field>
          </div>
        </div>
      </DialogBlock>

      <DialogBlock
        id="objective-how"
        title={t('creator.needs.objectiveDialog.how.title')}
        hint={t('creator.needs.objectiveDialog.how.hint')}
      >
        <div className="space-y-4">
          <LineListEditor
            id={id('success_criterion')}
            label={t('creator.needs.objectiveDialog.conditions.label')}
            hint={t('creator.needs.objectiveDialog.conditions.hint')}
            value={objective.success_criterion}
            onChange={(success_criterion) => setObjective({ ...objective, success_criterion })}
            addLabel={t('creator.needs.objectiveDialog.conditions.add')}
            rowLabel={(n) => t('creator.needs.objectiveDialog.conditions.row', { n })}
            placeholder={t('creator.needs.objectiveDialog.conditions.placeholder')}
            numbered
            assist={(line, index) => (
              <ConditionAssist
                line={line}
                onSplit={(lead, items) => splitCondition(index, lead, items)}
                onMove={() => moveToGuidance(index)}
              />
            )}
          />
          <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
            {conditionCount >= 2 && (
              <div className="space-y-1.5">
                <span id={`${id('achieve_at_least')}-label`} className="block text-sm font-medium">
                  {t('creator.needs.objectiveDialog.rule.label')}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="group"
                    aria-labelledby={`${id('achieve_at_least')}-label`}
                    className={segmentedControl}
                  >
                    <button
                      type="button"
                      aria-pressed={!atLeast}
                      onClick={() => setObjective({ ...objective, achieve_at_least: null })}
                      className={!atLeast ? segmentedOptionActive : segmentedOptionIdle}
                    >
                      {t('creator.needs.objectiveDialog.rule.all', { n: conditionCount })}
                    </button>
                    <button
                      type="button"
                      aria-pressed={!!atLeast}
                      onClick={() =>
                        setObjective({ ...objective, achieve_at_least: conditionCount - 1 })
                      }
                      className={atLeast ? segmentedOptionActive : segmentedOptionIdle}
                    >
                      {t('creator.needs.objectiveDialog.rule.atLeast')}
                    </button>
                  </div>
                  {atLeast && (
                    <span className="flex items-center gap-2 text-sm">
                      <select
                        id={id('achieve_at_least')}
                        aria-label={t('creator.needs.objectiveDialog.rule.count')}
                        value={atLeast}
                        onChange={(event) =>
                          setObjective({
                            ...objective,
                            achieve_at_least: Number(event.target.value),
                          })
                        }
                        className={`${inputBase} max-w-20 py-1`}
                      >
                        {Array.from({ length: conditionCount - 1 }, (_, i) => i + 1).map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                      {t('creator.needs.objectiveDialog.rule.ofN', { n: conditionCount })}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor={id('time_box_minutes')} className="block text-sm font-medium">
                {t('creator.needs.objectiveDialog.timeBox.label')}{' '}
                <span className="font-normal text-paper-ink/60 dark:text-fg-faint">
                  ({t('common.optionalSuffix')})
                </span>
              </label>
              <div className="flex items-center gap-2 text-sm">
                <input
                  name={id('time_box_minutes')}
                  autoComplete="off"
                  id={id('time_box_minutes')}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={1440}
                  value={objective.time_box_minutes ?? ''}
                  onChange={(event) =>
                    setObjective({
                      ...objective,
                      time_box_minutes: event.target.value
                        ? Math.max(1, Math.min(1440, Number(event.target.value)))
                        : null,
                    })
                  }
                  className={`${inputBase} max-w-24 shrink-0 tabular-nums`}
                />
                <span className="whitespace-nowrap text-paper-ink/70 dark:text-fg-muted">
                  {t('creator.needs.objectiveDialog.timeBox.suffix')}
                </span>
              </div>
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              {t('creator.needs.objectiveDialog.levels.label')}
            </legend>
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.needs.objectiveDialog.levels.hint')}
            </p>
            <div className="divide-y divide-panel-line rounded-sm border border-panel-line">
              <LevelRow
                id={id('achieved_note')}
                level={t('creator.needs.measure.levels.achieved')}
                scale="P · S"
              >
                {conditionCount > 0 && (
                  <p className="text-sm text-paper-ink/80 dark:text-fg-nav">
                    {atLeast
                      ? t('creator.needs.measure.atLeast', { k: atLeast, n: conditionCount })
                      : conditionCount === 1
                        ? t('creator.needs.measure.one')
                        : t('creator.needs.measure.all', { n: conditionCount })}
                  </p>
                )}
                <TextArea
                  id={id('achieved_note')}
                  value={objective.achieved_note}
                  rows={1}
                  placeholder={t('creator.needs.objectiveDialog.levels.achievedPlaceholder')}
                  onChange={(achieved_note) => setObjective({ ...objective, achieved_note })}
                />
              </LevelRow>
              <LevelRow
                id={id('partially_achieved')}
                level={t('creator.needs.measure.levels.partial')}
                scale="M"
              >
                <TextArea
                  id={id('partially_achieved')}
                  value={objective.partially_achieved}
                  rows={1}
                  placeholder={t('creator.needs.objectiveDialog.levels.partialPlaceholder')}
                  onChange={(partially_achieved) =>
                    setObjective({ ...objective, partially_achieved })
                  }
                />
              </LevelRow>
              <LevelRow
                id={id('not_achieved')}
                level={t('creator.needs.measure.levels.not')}
                scale="U"
              >
                <TextArea
                  id={id('not_achieved')}
                  value={objective.not_achieved}
                  rows={1}
                  placeholder={t('creator.needs.objectiveDialog.levels.notPlaceholder')}
                  onChange={(not_achieved) => setObjective({ ...objective, not_achieved })}
                />
              </LevelRow>
            </div>
          </fieldset>
        </div>
      </DialogBlock>

      <DialogBlock
        id="objective-evidence"
        title={t('creator.needs.objectiveDialog.evidence.title')}
        hint={t('creator.needs.objectiveDialog.evidence.hint')}
      >
        <LineListEditor
          id={id('evidence')}
          label={t('creator.needs.fields.evidence')}
          value={objective.evidence}
          onChange={(evidence) => setObjective({ ...objective, evidence })}
          addLabel={t('creator.needs.objectiveDialog.evidence.add')}
          rowLabel={(n) => t('creator.needs.objectiveDialog.evidence.row', { n })}
          placeholder={t('creator.needs.objectiveDialog.evidence.placeholder')}
          max={12}
          legendHidden
        />
      </DialogBlock>

      <DialogBlock
        id="objective-regulatory"
        title={t('creator.needs.objectiveDialog.regulatory.title')}
        hint={t('creator.needs.objectiveDialog.regulatory.hint')}
        aside={
          <span className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('creator.needs.objectiveDialog.regulatory.selected', {
              count: objective.regulatory_requirement_ids.length,
            })}
          </span>
        }
      >
        <RegulatoryPicker
          id={id('regulatory_requirement_ids')}
          catalog={catalog}
          frameworks={frameworks}
          selected={objective.regulatory_requirement_ids}
          onChange={(regulatory_requirement_ids) =>
            setObjective({ ...objective, regulatory_requirement_ids })
          }
        />
      </DialogBlock>
    </RowDialog>
  )
}
