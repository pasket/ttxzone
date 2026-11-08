import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import {
  actionsCellClass,
  btnSecondary,
  linkAccent,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../../lib/buttonStyles'
import {
  byCode,
  CAPABILITIES,
  fieldDomId,
  NEED_PRIORITIES,
  NEED_SOURCES,
  newRowKey,
  pick,
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
import type { Capability, NeedPriority, NeedSource } from '../../../lib/types'
import { codeRefText } from '../../../lib/codeRef'
import { EditButton } from '../../common/EditButton'
import { IconButton } from '../../common/IconButton'
import { Field, Select, TextArea, TextInput } from './fields'
import { RowDialog } from './RowDialog'
import type { StepProps } from './stepProps'

const NEED_GROUP_BY = ['capability', 'priority'] as const
type NeedGroupBy = (typeof NEED_GROUP_BY)[number]

/** The needs in groups -- by capability (the catalogue's order) or by
 * priority (high → low) -- each by code. */
function groupNeeds(needs: NeedDraft[], groupBy: NeedGroupBy) {
  const sorted = [...needs].sort(byCode)
  const order: readonly string[] = groupBy === 'capability' ? CAPABILITIES : NEED_PRIORITIES
  const field = groupBy === 'capability' ? 'affected_capability' : 'priority'
  return order
    .map((value) => ({
      key: value,
      heading: value,
      needs: sorted.filter((need) => need[field] === value),
    }))
    .filter((group) => group.needs.length > 0)
}

/** A labelled one-click switch (the MSEL's inject table pattern). */
export function Segmented<T extends string>({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id: string
  label: string
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span id={id} className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={id} className={segmentedControl}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={value === option.value ? segmentedOptionActive : segmentedOptionIdle}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const EMPTY_NEED: Omit<NeedDraft, 'key'> = {
  id: null,
  code: '',
  source: 'risk_analysis',
  title: '',
  finding: '',
  affected_capability: 'detection_triage_escalation',
  priority: 'medium',
}

/** Section 3 -- needs analysis: the evidence each objective answers. */
export function NeedsStep({
  draft,
  update,
  removeRow,
  isInvalid,
  focusRow,
  renumberButton,
}: StepProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState<{ need: NeedDraft; isNew: boolean } | null>(null)
  const [focusField, setFocusField] = useState<string | null>(null)

  // The validation summary asked for one of these rows: open it (React's
  // "adjust state during render" pattern -- each request is a new object).
  const [handledRow, setHandledRow] = useState<StepProps['focusRow']>(null)
  if (focusRow && focusRow !== handledRow) {
    setHandledRow(focusRow)
    const need = draft.needs.find((n) => n.key === focusRow.itemId)
    if (need) {
      setEditing({ need, isNew: false })
      setFocusField(fieldDomId(focusRow.field, need.key))
    }
  }

  // Grouped by capability unless asked otherwise; in the URL, like the
  // MSEL's inject table.
  const [searchParams, setSearchParams] = useSearchParams()
  const groupBy = pick(NEED_GROUP_BY, searchParams.get('group'), 'capability')
  function setGroupBy(value: NeedGroupBy) {
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

  const codeOf = (need: NeedDraft) => need.code || t('creator.needs.table.pendingCode')
  const linkedBy = (need: NeedDraft) =>
    draft.objectives.filter((objective) => objective.linked_need_keys.includes(need.key))

  function save(need: NeedDraft) {
    update({
      needs: draft.needs.some((n) => n.key === need.key)
        ? // Keep the id (and code) a save may have given the row meanwhile.
          draft.needs.map((n) =>
            n.key === need.key ? { ...need, id: n.id ?? need.id, code: n.code || need.code } : n,
          )
        : [...draft.needs, need],
    })
    setEditing(null)
  }

  const groups = groupNeeds(draft.needs, groupBy)
  const columns = 2 + (groupBy === 'capability' ? 0 : 1) + (groupBy === 'priority' ? 0 : 1)

  return (
    <div className="space-y-4">
      {/* One toolbar line: how the table is grouped on the left, adding
          on the right. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {draft.needs.length > 0 ? (
          <Segmented
            id="needs-group"
            label={t('creator.needs.table.groupBy')}
            options={NEED_GROUP_BY.map((value) => ({
              value,
              label: t(`creator.needs.table.group.${value}`),
            }))}
            value={groupBy}
            onChange={setGroupBy}
          />
        ) : (
          <span />
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          {renumberButton('needs')}
          <button
            type="button"
            onClick={() => {
              setFocusField(null)
              setEditing({ need: { ...EMPTY_NEED, key: newRowKey() }, isNew: true })
            }}
            className={btnSecondary}
          >
            <span aria-hidden="true">+ </span>
            {t('creator.needs.actions.addNeed')}
          </button>
        </div>
      </div>
      {draft.needs.length === 0 ? (
        <p
          id={fieldDomId('needs')}
          tabIndex={-1}
          className={`py-8 text-center text-sm ${isInvalid('needs') ? 'text-danger-fg' : 'text-paper-ink/70 dark:text-fg-muted'}`}
        >
          {t('creator.needs.table.noNeeds')}
        </p>
      ) : (
        <div className="-mx-5">
          {/* Fixed widths: the need's text gives way (one line, cut), so the
              table never scrolls sideways. */}
          <table className="w-full table-fixed text-left">
            <colgroup>
              <col />
              {groupBy !== 'capability' && <col className="w-44 lg:w-56" />}
              {groupBy !== 'priority' && <col className="w-24" />}
              <col className="w-28" />
            </colgroup>
            <thead>
              <tr className={panelTableHeadRow}>
                <th className={panelTh}>{t('creator.needs.table.need')}</th>
                {groupBy !== 'capability' && (
                  <th className={panelTh}>{t('creator.needs.fields.affected_capability')}</th>
                )}
                {groupBy !== 'priority' && (
                  <th className={panelTh}>{t('creator.needs.fields.priority')}</th>
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
                    <span className="flex flex-wrap items-baseline justify-between gap-2">
                      <span>
                        {groupBy === 'capability'
                          ? t(`creator.needs.capabilities.${group.heading as Capability}`)
                          : t(`creator.needs.priorities.${group.heading as NeedPriority}`)}
                      </span>
                      <span className="text-xs font-normal text-paper-ink/60 dark:text-fg-faint">
                        {t('creator.needs.table.needCount', { count: group.needs.length })}
                      </span>
                    </span>
                  </th>
                </tr>
                {group.needs.map((need) => {
                  const links = linkedBy(need)
                  const invalid = isInvalid('finding', need.key) || isInvalid('title', need.key)
                  return (
                    <tr key={need.key} className={panelTr}>
                      <td className={`${panelTd} min-w-0 text-sm`}>
                        {/* Code and title first; what was found, and where it
                          comes from, under them. */}
                        <span
                          className={`block font-medium ${invalid ? 'text-danger-fg' : 'text-paper-ink dark:text-fg'}`}
                        >
                          <span translate="no" className="tabular-nums">
                            {need.code || t('creator.needs.table.pendingCode')}
                          </span>
                          <span
                            aria-hidden="true"
                            className="mx-1.5 text-paper-ink/35 dark:text-fg-faint"
                          >
                            |
                          </span>
                          <span className="sr-only">, </span>
                          {need.title.trim() || (
                            <span className="italic text-paper-ink/60 dark:text-fg-faint">
                              {t('creator.needs.table.untitled')}
                            </span>
                          )}
                        </span>
                        {need.finding.trim() && (
                          <span
                            title={need.finding}
                            className="mt-0.5 block truncate text-xs text-paper-ink/70 dark:text-fg-muted"
                          >
                            {need.finding}
                          </span>
                        )}
                        <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
                          {t(`creator.needs.needSources.${need.source}`)}
                        </span>
                      </td>
                      {groupBy !== 'capability' && (
                        <td className={`${panelTd} text-sm`}>
                          {t(`creator.needs.capabilities.${need.affected_capability}`)}
                        </td>
                      )}
                      {groupBy !== 'priority' && (
                        <td className={`${panelTd} text-sm`}>
                          {t(`creator.needs.priorities.${need.priority}`)}
                        </td>
                      )}
                      <td className={panelTd}>
                        <div className={actionsCellClass}>
                          <EditButton
                            label={t('creator.needs.actions.editNeed', { code: codeOf(need) })}
                            onClick={() => {
                              setFocusField(null)
                              setEditing({ need, isNew: false })
                            }}
                          />
                          <IconButton
                            label={
                              links.length > 0
                                ? `${t('creator.needs.actions.removeNeed', { code: codeOf(need) })} (${links
                                    .map((o) =>
                                      codeRefText(
                                        o.code,
                                        objectiveName(o),
                                        t('creator.needs.table.pendingCode'),
                                      ),
                                    )
                                    .join('; ')})`
                                : t('creator.needs.actions.removeNeed', { code: codeOf(need) })
                            }
                            // A need an objective answers can't go: unlink it there first.
                            disabled={links.length > 0}
                            onClick={() =>
                              removeRow(
                                'needs',
                                need.key,
                                t('creator.needs.toast.needRemoved', { code: codeOf(need) }),
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

      {editing && (
        <NeedDialog
          initial={editing.need}
          title={
            editing.isNew
              ? t('creator.needs.dialogs.newNeed')
              : t('creator.needs.dialogs.editNeed', {
                  code: codeRefText(
                    editing.need.code,
                    needName(editing.need),
                    t('creator.needs.table.pendingCode'),
                  ),
                })
          }
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

function NeedDialog({
  initial,
  title,
  initialFocusId,
  onCancel,
  onDone,
}: {
  initial: NeedDraft
  title: string
  initialFocusId: string | null
  onCancel: () => void
  onDone: (need: NeedDraft) => void
}) {
  const { t } = useTranslation()
  const [need, setNeed] = useState(initial)
  const id = (field: string) => fieldDomId(field, need.key)
  return (
    <RowDialog
      titleId="needs-need-dialog-title"
      title={title}
      initialFocusId={initialFocusId}
      onCancel={onCancel}
      onDone={() => onDone(need)}
    >
      <Field
        id={id('title')}
        label={t('creator.needs.fields.title')}
        hint={t('creator.needs.findingHelp.titleHint')}
      >
        <TextInput
          id={id('title')}
          value={need.title}
          maxLength={255}
          placeholder={t('creator.needs.placeholders.title')}
          onChange={(title) => setNeed({ ...need, title })}
        />
      </Field>
      <div className="space-y-2">
        <Field
          id={id('finding')}
          label={t('creator.needs.fields.finding')}
          hint={t('creator.needs.findingHelp.hint')}
        >
          <TextArea
            id={id('finding')}
            value={need.finding}
            rows={5}
            placeholder={t('creator.needs.placeholders.finding')}
            onChange={(finding) => setNeed({ ...need, finding })}
          />
        </Field>
        <NeedExamples
          canUse={!need.finding.trim() && !need.title.trim()}
          onUse={(title, finding) => setNeed({ ...need, title, finding })}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id('source')} label={t('creator.needs.fields.source')}>
          <Select<NeedSource>
            id={id('source')}
            value={need.source}
            onChange={(source) => setNeed({ ...need, source })}
            options={NEED_SOURCES.map((value) => ({
              value,
              label: t(`creator.needs.needSources.${value}`),
            }))}
          />
        </Field>
        <Field id={id('priority')} label={t('creator.needs.fields.priority')}>
          <Select<NeedPriority>
            id={id('priority')}
            value={need.priority}
            onChange={(priority) => setNeed({ ...need, priority })}
            options={NEED_PRIORITIES.map((value) => ({
              value,
              label: t(`creator.needs.priorities.${value}`),
            }))}
          />
        </Field>
      </div>
      <Field id={id('affected_capability')} label={t('creator.needs.fields.affected_capability')}>
        <Select<Capability>
          id={id('affected_capability')}
          value={need.affected_capability}
          onChange={(affected_capability) => setNeed({ ...need, affected_capability })}
          options={CAPABILITIES.map((value) => ({
            value,
            label: t(`creator.needs.capabilities.${value}`),
          }))}
        />
      </Field>
    </RowDialog>
  )
}

const NEED_EXAMPLES = [
  'decisions',
  'borders',
  'escalation',
  'itOt',
  'thirdParty',
  'regulatory',
  'uncertainty',
] as const

/** Needs worded the way that works -- a name, what happens today, why it
 * matters -- folded under the field; one can start an empty field. */
function NeedExamples({
  canUse,
  onUse,
}: {
  canUse: boolean
  onUse: (title: string, finding: string) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div className="text-xs">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="needs-finding-examples"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1 rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
      >
        {open
          ? t('creator.needs.findingHelp.hideExamples')
          : t('creator.needs.findingHelp.showExamples')}
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div id="needs-finding-examples" className="mt-2 space-y-2">
          <p className="text-paper-ink/60 dark:text-fg-faint">
            {canUse
              ? t('creator.needs.findingHelp.useHint')
              : t('creator.needs.findingHelp.readHint')}
          </p>
          <ul className="divide-y divide-panel-line rounded-sm border border-panel-line">
            {NEED_EXAMPLES.map((key) => (
              <li key={key}>
                <button
                  type="button"
                  disabled={!canUse}
                  onClick={() =>
                    onUse(
                      t(`creator.needs.findingHelp.examples.${key}.name`),
                      t(`creator.needs.findingHelp.examples.${key}.text`),
                    )
                  }
                  className="block w-full px-3 py-2 text-left enabled:hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-default"
                >
                  <span className="font-medium text-paper-ink dark:text-fg">
                    {t(`creator.needs.findingHelp.examples.${key}.name`)}.
                  </span>{' '}
                  <span className="text-paper-ink/70 dark:text-fg-muted">
                    {t(`creator.needs.findingHelp.examples.${key}.text`)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
