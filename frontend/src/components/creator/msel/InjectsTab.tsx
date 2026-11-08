import { Fragment, useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'

import {
  actionsCellClass,
  btnNeutralIconGhost,
  btnPrimary,
  btnSecondary,
  inputCompact,
  linkAccent,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../../lib/buttonStyles'
import { codeRefText } from '../../../lib/codeRef'
import {
  emptyInjectDraft,
  formatOffset,
  injectDialogPatch,
  hasInjectFilter,
  INJECT_FILTERS,
  INJECT_FORMATS,
  injectFiltersFrom,
  type InjectFilterKey,
  matchesInjectFilters,
  INJECT_ROW_FIELDS,
  MAX_INJECTS,
  mselFieldId,
  newMselKey,
  orderedInjects,
  playedIn,
  type InjectDraft,
  type MselDraft,
} from '../../../lib/msel'
import {
  panelActionsTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../../lib/panelStyles'
import type { InjectReviewStatus, MselNeedsContext, MselRoom } from '../../../lib/types'
import { CodeRef, CodeRefList } from '../../common/CodeRef'
import { DuplicateIcon } from '../../common/DuplicateIcon'
import { EditButton } from '../../common/EditButton'
import { IconButton } from '../../common/IconButton'
import { InjectDialog } from './InjectDialog'
import { InjectKindMark } from './InjectKindMark'
import { InjectRooms } from './InjectRooms'
import type { TabProps } from './tabProps'
import { objectiveName } from '../../../lib/needsForm'

const FILTERS = INJECT_FILTERS

/** What the injects table groups its rows by (`?group=`, phase by
 * default). */
const INJECT_GROUP_BY = ['phase', 'objective', 'kind', 'recipient', 'room'] as const
type InjectGroupBy = (typeof INJECT_GROUP_BY)[number]
type FilterKey = InjectFilterKey

/** Review status in a table: a tick (validated) or a cross (not yet) in
 * its colour, the word on hover and for screen readers. */
function ReviewMark({ status }: { status: InjectReviewStatus }) {
  const { t } = useTranslation()
  const label = t(`creator.msel.reviewStatus.${status}`)
  const validated = status === 'validated'
  return (
    <span title={label} className={validated ? 'text-success-fg' : 'text-danger-fg'}>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {validated ? <path d="M3 8.5l3.2 3L13 4.5" /> : <path d="M4 4l8 8M12 4l-8 8" />}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

/** Tab 3 -- the injects, grouped by phase in timeline order and filterable
 * (filters live in the URL), edited in a dialog with their expected
 * actions. The exercise's simulated actors are managed in the Library
 * (This exercise); the dialog only picks the sender, or adds one. */
export function InjectsTab(props: TabProps) {
  const {
    msel,
    draft,
    update,
    removeRow,
    isInvalid,
    catalog,
    readOnly,
    focusRow,
    saveStatus,
    renumberButton,
  } = props
  const { t } = useTranslation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [editing, setEditing] = useState<{ inject: InjectDraft; isNew: boolean } | null>(null)
  const [focusField, setFocusField] = useState<string | null>(null)

  const [handledRow, setHandledRow] = useState<TabProps['focusRow']>(null)
  if (focusRow && focusRow !== handledRow) {
    setHandledRow(focusRow)
    const inject = draft.injects.find((i) => i.key === focusRow.itemId || i.id === focusRow.itemId)
    if (inject) {
      setEditing({ inject, isNew: false })
      setFocusField(mselFieldId(focusRow.field, inject.key))
    }
  }

  const filters = injectFiltersFrom(searchParams)
  function setFilter(key: FilterKey, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  // One URL update for all of them: several in a row would each start from
  // the same location and only the last would stick.
  function clearFilters() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        FILTERS.forEach((key) => next.delete(key))
        return next
      },
      { replace: true },
    )
  }
  // Only an exercise played in rooms aims injects at them.
  const rooms = msel.uses_rooms ? (msel.rooms ?? []) : []
  const requestedGroup = searchParams.get('group') as InjectGroupBy
  const groupBy: InjectGroupBy =
    INJECT_GROUP_BY.includes(requestedGroup) && (requestedGroup !== 'room' || rooms.length > 0)
      ? requestedGroup
      : 'phase'
  function setGroupBy(value: InjectGroupBy) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value === 'phase') next.delete('group')
        else next.set('group', value)
        return next
      },
      { replace: true },
    )
  }
  const filtered = orderedInjects(draft).filter((inject) =>
    matchesInjectFilters(inject, rooms.length > 0 ? filters : { ...filters, room: '' }),
  )
  const anyFilter = hasInjectFilter(filters)

  const codeOf = (inject: InjectDraft) => inject.code || t('creator.msel.table.pendingCode')
  const actorName = (key: string | null) => draft.actors.find((a) => a.key === key)?.name ?? '—'
  const rowInvalid = (inject: InjectDraft) =>
    INJECT_ROW_FIELDS.some(
      (field) => isInvalid(field, inject.key) || (inject.id && isInvalid(field, inject.id)),
    )

  function newInject(): InjectDraft {
    return emptyInjectDraft(draft, { phase_key: filters.phase || draft.phases[0]?.key || '' })
  }

  function duplicate(inject: InjectDraft) {
    update({
      injects: [
        ...draft.injects,
        {
          ...inject,
          id: null,
          key: newMselKey(),
          code: '',
          review_status: 'draft',
          validated_by: '',
          validated_by_id: null,
          expected_actions: inject.expected_actions.map((action) => ({
            ...action,
            id: null,
            key: newMselKey(),
            code: '',
          })),
        },
      ],
    })
  }

  // The table's groups: by phase (in timeline order), objective, type or
  // recipient -- an inject with several objectives or recipients shows
  // under each. Rows with none of them go in a last group.
  const pending = t('creator.msel.table.pendingCode')
  const groups: { key: string; heading: ReactNode; detail?: ReactNode; injects: InjectDraft[] }[] =
    groupBy === 'phase'
      ? [
          ...draft.phases.map((phase) => ({
            key: phase.key,
            heading: <CodeRef code={phase.code} title={phase.name} pending={pending} />,
            detail: `${formatOffset(phase.start_offset)} – ${formatOffset(phase.end_offset)}`,
            injects: filtered.filter((i) => i.phase_key === phase.key),
          })),
          {
            key: 'none',
            heading: t('creator.msel.groups.noPhase'),
            injects: filtered.filter((i) => !draft.phases.some((p) => p.key === i.phase_key)),
          },
        ]
      : groupBy === 'objective'
        ? [
            ...msel.needs.objectives.map((objective) => ({
              key: objective.id,
              heading: <CodeRef code={objective.code} title={objectiveName(objective)} />,
              injects: filtered.filter((i) => i.objective_ids.includes(objective.id)),
            })),
            {
              key: 'none',
              heading: t('creator.msel.groups.noObjective'),
              injects: filtered.filter((i) => i.objective_ids.length === 0),
            },
          ]
        : groupBy === 'kind'
          ? (['mandatory', 'contingent'] as const).map((kind) => ({
              key: kind,
              heading: t(`creator.msel.kinds.${kind}`),
              injects: filtered.filter((i) => i.kind === kind),
            }))
          : groupBy === 'room'
            ? rooms.map((room) => ({
                key: room.id,
                heading: <CodeRef code={room.code} title={room.name} />,
                // An inject for all rooms is played in each.
                injects: filtered.filter((i) => playedIn(i, room.id)),
              }))
            : [
                ...[
                  ...new Set([
                    ...msel.needs.participating_areas,
                    ...(msel.needs.third_parties ?? []),
                    ...filtered.flatMap((i) => i.recipients),
                  ]),
                ].map((area) => ({
                  key: area,
                  heading: area,
                  injects: filtered.filter((i) => i.recipients.includes(area)),
                })),
                {
                  key: 'none',
                  heading: t('creator.msel.groups.noRecipient'),
                  injects: filtered.filter((i) => i.recipients.length === 0),
                },
              ]
  // Inject, Objectives, Delivery (sender, method and recipients), Review
  // (+ Actions); Objectives goes when grouped by it -- its heading says it.
  const colSpan = 4 + (readOnly ? 0 : 1) - (groupBy === 'objective' ? 1 : 0)

  // A phase's rows hang from its heading: the same accent rule down their
  // left edge, the inject indented under the phase.
  const groupRule = 'shadow-[inset_2px_0_0_color-mix(in_oklab,var(--color-accent)_45%,transparent)]'
  const row = (inject: InjectDraft, groupKey: string) => (
    <tr key={`${groupKey}-${inject.key}`} className={`${panelTr} ${groupRule}`}>
      <td className="min-w-0 py-3 pr-3 pl-8">
        {/* Its kind as the storyline map draws it, before the code. */}
        <span className="flex items-start gap-1.5">
          <span className="pt-0.5">
            <InjectKindMark kind={inject.kind} />
          </span>
          <CodeRef
            variant="stacked"
            wrap
            code={inject.code}
            title={inject.title || '—'}
            pending={t('creator.msel.table.pendingCode')}
            invalid={rowInvalid(inject)}
          />
        </span>
      </td>
      {/* What it evaluates, one per line (not when grouped by it). */}
      {groupBy !== 'objective' && (
        <td className={`${panelTd} text-sm`}>
          {inject.format === 'inject' ? (
            <CodeRefList
              wrap
              items={msel.needs.objectives
                .filter((o) => inject.objective_ids.includes(o.id))
                .map((o) => ({ key: o.id, code: o.code, title: objectiveName(o) }))}
            />
          ) : (
            // Only an inject evaluates: say so instead of a blank.
            <span className="text-paper-ink/60 dark:text-fg-faint">
              {t(`creator.msel.formats.${inject.format}Summary`)}
            </span>
          )}
        </td>
      )}
      {/* Who sends it, how, and to whom: one fact, read together. The
          recipients wrap in smaller text (not when grouped by them). */}
      <td className={`${panelTd} break-words`}>
        <span className="block text-sm">
          {actorName(inject.actor_key)}
          <span className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {' · '}
            {t(`creator.msel.deliveryMethods.${inject.delivery_method}`)}
          </span>
        </span>
        {groupBy !== 'recipient' && (
          <span className="mt-0.5 block text-xs text-paper-ink/60 dark:text-fg-faint">
            <span aria-hidden="true">→ </span>
            {inject.recipients.join(' · ') || '—'}
          </span>
        )}
        {rooms.length > 0 && groupBy !== 'room' && (
          <span className="mt-0.5 block text-xs text-paper-ink/60 dark:text-fg-faint">
            <span className="sr-only">{t('creator.msel.fields.room_ids')}: </span>
            <InjectRooms roomIds={inject.room_ids} rooms={rooms} />
          </span>
        )}
      </td>
      <td className={panelTd}>
        <ReviewMark status={inject.review_status} />
      </td>
      {!readOnly && (
        <td className={panelTd}>
          <div className={actionsCellClass}>
            <EditButton
              label={t('creator.msel.actions.editInject', { code: codeOf(inject) })}
              onClick={() => {
                setFocusField(null)
                setEditing({ inject, isNew: false })
              }}
            />
            <button
              type="button"
              aria-label={t('creator.msel.actions.duplicateInject', { code: codeOf(inject) })}
              title={t('creator.msel.actions.duplicateInject', { code: codeOf(inject) })}
              disabled={draft.injects.length >= MAX_INJECTS}
              onClick={() => duplicate(inject)}
              className={btnNeutralIconGhost}
            >
              <DuplicateIcon />
            </button>
            <IconButton
              label={t('creator.msel.actions.removeInject', { code: codeOf(inject) })}
              onClick={() =>
                removeRow(
                  'injects',
                  inject.key,
                  t('creator.msel.toast.injectRemoved', { code: codeOf(inject) }),
                )
              }
            />
          </div>
        </td>
      )}
    </tr>
  )

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {/* Two rows: the count and the tab's action; then how the list is
            viewed -- grouped by (one click) and filtered (a panel that opens,
            with the filters in force always shown as chips). */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted" aria-live="polite">
            {t('creator.msel.table.injectCount', { count: filtered.length })}
          </p>
          {!readOnly && (
            <div className="flex flex-wrap gap-2">
              {renumberButton('injects')}
              <button
                type="button"
                disabled={draft.injects.length >= MAX_INJECTS || draft.phases.length === 0}
                onClick={() => {
                  setFocusField(null)
                  setEditing({ inject: newInject(), isNew: true })
                }}
                className={btnPrimary}
              >
                <span aria-hidden="true">+ </span>
                {t('creator.msel.actions.addInject')}
              </button>
            </div>
          )}
        </div>
        <InjectFilters
          draft={draft}
          needs={msel.needs}
          rooms={rooms}
          filters={filters}
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          onChange={setFilter}
          onClear={clearFilters}
        />
        {filtered.length === 0 ? (
          <p
            id={mselFieldId('injects')}
            tabIndex={-1}
            className={`py-8 text-center text-sm ${isInvalid('injects') ? 'text-danger-fg' : 'text-paper-ink/70 dark:text-fg-muted'}`}
          >
            {anyFilter
              ? t('creator.msel.table.noMatches')
              : draft.phases.length === 0
                ? t('creator.msel.table.noInjectsNoPhases')
                : t('creator.msel.table.noInjects')}
          </p>
        ) : (
          <div className="-mx-5">
            {/* Fixed widths, as in Phases: the inject's title gives way and
                wraps, so the table never scrolls sideways. */}
            <table className="w-full table-fixed text-left">
              <colgroup>
                <col />
                {groupBy !== 'objective' && <col className="w-56 lg:w-64" />}
                <col className="w-56 lg:w-72" />
                <col className="w-20" />
                {!readOnly && <col className="w-28" />}
              </colgroup>
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('creator.msel.table.inject')}</th>
                  {groupBy !== 'objective' && (
                    <th className={panelTh}>{t('creator.msel.table.objectives')}</th>
                  )}
                  <th className={panelTh}>
                    {groupBy === 'recipient'
                      ? t('creator.msel.table.actor')
                      : t('creator.msel.table.delivery')}
                  </th>
                  <th className={panelTh}>{t('creator.msel.table.review')}</th>
                  {!readOnly && <th className={panelActionsTh}>{t('common.table.actions')}</th>}
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {groups
                  .filter((group) => group.injects.length > 0)
                  .map((group) => (
                    <Fragment key={group.key}>
                      <tr className="shadow-[inset_2px_0_0_var(--color-accent)]">
                        <th
                          scope="rowgroup"
                          colSpan={colSpan}
                          className="bg-accent/5 px-5 pt-4 pb-2 text-left text-sm font-medium"
                        >
                          <span className="flex flex-wrap items-baseline justify-between gap-2">
                            <span>
                              {group.heading}
                              {group.detail && (
                                <span
                                  translate="no"
                                  className="ml-2 text-xs font-normal tabular-nums text-paper-ink/60 dark:text-fg-faint"
                                >
                                  {group.detail}
                                </span>
                              )}
                            </span>
                            <span className="text-xs font-normal text-paper-ink/60 dark:text-fg-faint">
                              {t('creator.msel.table.injectCount', { count: group.injects.length })}
                            </span>
                          </span>
                        </th>
                      </tr>
                      {group.injects.map((inject) => row(inject, group.key))}
                    </Fragment>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <InjectDialog
          rooms={msel.uses_rooms ? (msel.rooms ?? []) : []}
          ttxId={msel.ttx_id}
          initial={editing.inject}
          draft={draft}
          needs={msel.needs}
          catalog={catalog}
          readOnly={readOnly}
          isNew={editing.isNew}
          initialFocusId={focusField}
          saveStatus={saveStatus}
          // Every change goes into the draft (and autosaves); the dialog
          // hands focus back to whatever opened it without scrolling.
          onChange={(inject, newActors) => update(injectDialogPatch(draft, inject, newActors))}
          onDraftPatch={update}
          onClose={() => setEditing(null)}
          onDiscard={(inject) =>
            removeRow('injects', inject.key, t('creator.msel.wizard.discarded'))
          }
        />
      )}
    </div>
  )
}

/** How the list is viewed: "Group by" as a segmented control and a
 * Filters button (with the number in force) that opens the six filters on
 * a grid; the filters in force show as chips, each removable, with Clear
 * filters -- even with the panel closed. */
function InjectFilters({
  draft,
  needs,
  rooms,
  filters,
  groupBy,
  onGroupBy,
  onChange,
  onClear,
}: {
  draft: MselDraft
  needs: MselNeedsContext
  rooms: MselRoom[]
  filters: Record<FilterKey, string>
  groupBy: InjectGroupBy
  onGroupBy: (value: InjectGroupBy) => void
  onChange: (key: FilterKey, value: string) => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  // The room filter and grouping only for an exercise played in rooms.
  const shown = FILTERS.filter((key) => key !== 'room' || rooms.length > 0)
  const groupings = INJECT_GROUP_BY.filter((value) => value !== 'room' || rooms.length > 0)
  const active = shown.filter((key) => filters[key])
  // Open on arrival when filters are already in force (a shared link).
  const [open, setOpen] = useState(active.length > 0)
  const panelId = useId()
  const all = t('creator.msel.filters.all')
  const options: Record<FilterKey, { value: string; label: string }[]> = {
    phase: draft.phases.map((p) => ({
      value: p.key,
      label: codeRefText(p.code, p.name, t('creator.msel.table.pendingCode')),
    })),
    objective: needs.objectives.map((o) => ({
      value: o.id,
      label: codeRefText(o.code, objectiveName(o)),
    })),
    kind: (['mandatory', 'contingent'] as const).map((k) => ({
      value: k,
      label: t(`creator.msel.kinds.${k}`),
    })),
    format: INJECT_FORMATS.map((f) => ({
      value: f,
      label: t(`creator.msel.formats.${f}`),
    })),
    recipient: [...needs.participating_areas, ...(needs.third_parties ?? [])].map((area) => ({
      value: area,
      label: area,
    })),
    room: rooms.map((room) => ({ value: room.id, label: codeRefText(room.code, room.name) })),
    attack: [
      { value: 'none', label: t('creator.msel.attribution.none') },
      ...draft.threat_actors.map((a) => ({
        value: a.key,
        label: codeRefText(a.code, a.name, t('creator.msel.table.pendingCode')),
      })),
      { value: 'noise', label: t('creator.msel.attribution.noise') },
    ],
    review: (['draft', 'validated'] as const).map((r) => ({
      value: r,
      label: t(`creator.msel.reviewStatus.${r}`),
    })),
  }
  const valueLabel = (key: FilterKey) =>
    options[key].find((option) => option.value === filters[key])?.label ?? filters[key]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-y border-panel-line py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span id={`${panelId}-group`} className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.msel.groups.label')}
          </span>
          <div role="group" aria-labelledby={`${panelId}-group`} className={segmentedControl}>
            {groupings.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={groupBy === value}
                onClick={() => onGroupBy(value)}
                className={groupBy === value ? segmentedOptionActive : segmentedOptionIdle}
              >
                {t(`creator.msel.groups.by.${value}`)}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
          className={`${btnSecondary} inline-flex items-center gap-2`}
        >
          {t('creator.msel.filters.button')}
          {active.length > 0 && (
            <span className="rounded-xs bg-accent/15 px-1.5 text-xs tabular-nums text-accent-fg">
              {active.length}
            </span>
          )}
          <span aria-hidden="true" className="text-xs">
            {open ? '▴' : '▾'}
          </span>
        </button>
      </div>

      {open && (
        <fieldset id={panelId} className="space-y-2">
          <legend className="sr-only">{t('creator.msel.filters.label')}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {shown.map((key) => (
              <label key={key} className="min-w-0 space-y-1 text-xs font-medium">
                <span className="block truncate">{t(`creator.msel.filters.${key}`)}</span>
                <select
                  name={key}
                  value={filters[key]}
                  onChange={(e) => onChange(key, e.target.value)}
                  className={`${inputCompact} w-full truncate`}
                >
                  <option value="">{all}</option>
                  {options[key].map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {active.length > 0 && (
        <ul
          className="flex flex-wrap items-center gap-2"
          aria-label={t('creator.msel.filters.active')}
        >
          {active.map((key) => (
            <li key={key}>
              <span className="inline-flex max-w-full items-center gap-1 rounded-sm border border-accent/40 bg-accent/5 py-0.5 pr-1 pl-2 text-xs">
                <span className="truncate">
                  <span className="text-paper-ink/60 dark:text-fg-faint">
                    {t(`creator.msel.filters.${key}`)}:
                  </span>{' '}
                  {valueLabel(key)}
                </span>
                <button
                  type="button"
                  aria-label={t('creator.msel.filters.remove', {
                    filter: t(`creator.msel.filters.${key}`),
                  })}
                  onClick={() => onChange(key, '')}
                  className="flex h-5 w-5 items-center justify-center rounded-xs text-paper-ink/60 hover:bg-hover hover:text-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted dark:hover:text-fg"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </span>
            </li>
          ))}
          <li>
            <button type="button" onClick={onClear} className={`${linkAccent} text-xs`}>
              {t('creator.msel.filters.clear')}
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
