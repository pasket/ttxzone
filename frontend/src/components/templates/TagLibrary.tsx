import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useLibraryFilters } from '../../hooks/useLibraryFilters'
import { useLibraryLevelParam } from '../../hooks/useLibraryLevelParam'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { libraryActionsCellClass, btnSecondary } from '../../lib/buttonStyles'
import { libraryEmptyClass, libraryLevels, type LibraryPermissions } from '../../lib/libraryLevels'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import {
  asTagDuplicate,
  emptyTagFields,
  tagFromLevel,
  tagFromSystem,
  type TagFields,
} from '../../lib/tagLibrary'
import type { OrganizationTag, SystemTag, SystemTagGroup, TTXTag } from '../../lib/types'
import { EditButton } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'
import { ViewButton } from '../common/ViewButton'
import { TagChip } from '../common/TagChip'
import { ActorOriginBadge } from './ActorOriginBadge'
import { LibraryDeleteDialog } from './LibraryDeleteDialog'
import { DisabledBadge, EnableButton } from './LibraryItemState'
import { DuplicateMenu } from './DuplicateMenu'
import {
  LibraryAside,
  LibraryFilterBar,
  LibraryNoMatches,
  type LibrarySelectFilter,
} from './LibraryFilters'
import { LibraryLevelSwitch } from './LibraryLevelSwitch'
import { TagFormModal } from './TagFormModal'
import { HelpText } from '../common/HelpText'

type Level = 'organization' | 'exercise'
type LibraryTag = OrganizationTag | TTXTag

/** What the form edits of a stored tag. */
function tagFormValues(tag: LibraryTag): TagFields {
  return {
    name: tag.name,
    color: tag.color,
    custom_hex: tag.custom_hex,
    origin: tag.origin,
    origin_id: tag.origin_id,
    origin_name: tag.origin_name,
  }
}

const GROUPS: SystemTagGroup[] = ['threat', 'audience', 'regulation', 'programme', 'people']

/** The tag library, three levels like simulated actors and injects:
 * TTX-Zone's own tags (read-only, duplicable), the organization's (applied
 * to the organization, its Program Managers, Exercise Planners and allowed
 * domains) and -- with an exercise in context -- that exercise's (applied
 * to the exercise, its invitations and its planning team). Every use is a
 * copy, `_copy` suffixed, remembering what it was copied from, and opened
 * for editing right away. Assigning
 * tags stays in each entity's own form. */
export function TagLibrary({
  organizationId,
  ttxId,
  permissions,
}: {
  organizationId: string
  /** The exercise in context (Creator), or null (Admin, or none yet). */
  ttxId: string | null
  permissions: LibraryPermissions
}) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const { showToast } = useToast()
  const tabs = libraryLevels(ttxId !== null)
  const [tab, setTab] = useLibraryLevelParam(tabs)

  const system = useApiResource<{ items: SystemTag[] }>('/tag-catalog')
  const organization = useApiResource<{ items: OrganizationTag[] }>(
    `/organizations/${organizationId}/tags?limit=200&offset=0&sort_by=name&sort_dir=asc`,
  )
  const exercise = useApiResource<{ items: TTXTag[] }>(
    ttxId ? `/ttx/${ttxId}/tags?limit=200&offset=0&sort_by=name&sort_dir=asc` : null,
  )

  // A TTX-Zone item opens only read-only (never saved).
  const [form, setForm] = useState<{
    level: Level | 'system'
    id: string | null
    initial: TagFields
    readOnly?: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState<{ level: Level; id: string; name: string } | null>(null)

  const errorText = (err: unknown) =>
    err instanceof ApiError ? err.message : t('auth.common.genericError')
  const collection = (level: Level) =>
    level === 'organization' ? `/organizations/${organizationId}/tags` : `/ttx/${ttxId}/tags`
  const reload = (level: Level) =>
    level === 'organization' ? organization.refetch() : exercise.refetch()

  async function duplicate(fields: TagFields, level: Level) {
    const copy = asTagDuplicate(fields)
    try {
      const created = await apiFetch<LibraryTag>(collection(level), {
        method: 'POST',
        body: JSON.stringify(copy),
      })
      reload(level)
      // The copy is made; open it right away to adapt it (on its level's tab).
      setTab(level)
      setForm({ level, id: created.id, initial: tagFormValues(created) })
      showToast(
        level === 'organization'
          ? t('templates.tags.copiedToOrganization', { name: copy.name })
          : t('templates.tags.copiedToExercise', { name: copy.name }),
      )
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    }
  }

  async function saveForm(values: TagFields) {
    if (!form || form.level === 'system') return
    const url = form.id ? `${collection(form.level)}/${form.id}` : collection(form.level)
    try {
      await apiFetch(url, { method: form.id ? 'PATCH' : 'POST', body: JSON.stringify(values) })
      setForm(null)
      reload(form.level)
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    }
  }

  const chipCell = (fields: Pick<TagFields, 'name' | 'color' | 'custom_hex'>) => (
    <td className={panelTd}>
      <TagChip name={fields.name} color={fields.color} customHex={fields.custom_hex} />
    </td>
  )
  const duplicateMenu = (name: string, fields: TagFields, toExercise = true) => (
    <DuplicateMenu
      label={t('templates.tags.duplicateLabel', { name })}
      toOrganization={t('templates.actors.toOrganization')}
      toExercise={t('templates.actors.toExercise')}
      showOrganization={permissions.toOrganization}
      showExercise={permissions.toExercise && toExercise && ttxId !== null}
      onPick={(target) => void duplicate(fields, target)}
    />
  )
  const newButton = (level: Level) => (
    <button
      type="button"
      onClick={() => setForm({ level, id: null, initial: emptyTagFields() })}
      className={btnSecondary}
    >
      <span aria-hidden="true">+ </span>
      {t('tagLibrary.createButton')}
    </button>
  )
  const empty = (message: string) => <p className={libraryEmptyClass}>{message}</p>

  const filter = useLibraryFilters(['group', 'origin'] as const)
  const matchesText = (...texts: string[]) =>
    !filter.query || texts.some((text) => text.toLowerCase().includes(filter.query))
  const count = (n: number) => t('tagLibrary.count', { count: n })
  const filterBar = (selects: LibrarySelectFilter[]) => (
    <LibraryFilterBar
      legend={t('templates.tags.filters.label')}
      searchLabel={t('templates.filters.search')}
      searchPlaceholder={t('templates.tags.filters.searchPlaceholder')}
      selects={selects}
      values={filter.values}
      onChange={(key, value) => filter.set({ [key]: value })}
    />
  )

  function systemTab() {
    const items = (system.data?.items ?? []).filter(
      (tag) =>
        (!filter.values.group || tag.group === filter.values.group) &&
        matchesText(
          spanish ? tag.name_es : tag.name_en,
          spanish ? tag.description_es : tag.description_en,
        ),
    )
    return (
      <Panel
        title={t('templates.levels.system')}
        description={
          <HelpText
            id="templates.tags.systemDescription"
            text={t('templates.tags.systemDescription')}
          />
        }
        aside={system.data ? <LibraryAside count={count(items.length)} /> : undefined}
        flush
      >
        {filterBar([
          {
            key: 'group',
            label: t('templates.tags.filters.group'),
            allLabel: t('templates.filters.all'),
            options: GROUPS.map((group) => ({
              value: group,
              label: t(`templates.tags.groups.${group}`),
            })),
          },
        ])}
        {system.data && items.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('tagLibrary.nameLabel')}</th>
                  <th className={panelTh}>{t('templates.tags.columns.use')}</th>
                  <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
                </tr>
              </thead>
              {GROUPS.map((group) => {
                const rows = items.filter((tag) => tag.group === group)
                if (rows.length === 0) return null
                return (
                  <tbody key={group} className={panelTbody}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={3}
                        className="bg-paper-ink/[0.03] px-5 py-2 text-xs font-semibold tracking-wide text-paper-ink/70 uppercase dark:bg-white/[0.03] dark:text-fg-muted"
                      >
                        {t(`templates.tags.groups.${group}`)}
                      </th>
                    </tr>
                    {rows.map((tag) => {
                      const fields = tagFromSystem(tag, spanish)
                      return (
                        <tr key={tag.id} className={panelTr}>
                          {chipCell(fields)}
                          <td className={`${panelTd} text-sm text-pretty`}>
                            {spanish ? tag.description_es : tag.description_en}
                          </td>
                          <td className={panelTd}>
                            <div className={libraryActionsCellClass}>
                              <ViewButton
                                label={t('templates.tags.viewLabel', { name: fields.name })}
                                onClick={() =>
                                  setForm({
                                    level: 'system',
                                    id: tag.id,
                                    // The catalog tag itself: nothing it was copied from.
                                    initial: {
                                      ...fields,
                                      origin: null,
                                      origin_id: null,
                                      origin_name: null,
                                    },
                                    readOnly: true,
                                  })
                                }
                              />
                              {duplicateMenu(fields.name, fields)}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </Panel>
    )
  }

  function levelTab(level: Level) {
    const resource = level === 'organization' ? organization : exercise
    const forbidden = resource.error instanceof ApiError && resource.error.status === 403
    // Seen from Creator, the organization's tags are only copied.
    const manage = level === 'exercise' || permissions.manageOrganization
    const all: LibraryTag[] = resource.data?.items ?? []
    const items = all.filter(
      (tag) =>
        (!filter.values.origin || (tag.origin ?? level) === filter.values.origin) &&
        matchesText(tag.name),
    )
    return (
      <Panel
        title={t(`templates.levels.${level}`)}
        description={
          <HelpText
            id={`templates.tags.${level}Description`}
            text={t(`templates.tags.${level}Description`)}
          />
        }
        aside={
          forbidden ? undefined : (
            <LibraryAside
              count={resource.data ? count(items.length) : undefined}
              action={manage ? newButton(level) : undefined}
            />
          )
        }
        flush
      >
        {!forbidden &&
          all.length > 0 &&
          filterBar([
            {
              key: 'origin',
              label: t('templates.actors.columns.origin'),
              allLabel: t('templates.filters.all'),
              options: (['system', 'organization', 'exercise'] as const).map((value) => ({
                value,
                label: t(`templates.actors.origins.${value}.label`),
              })),
            },
          ])}
        {forbidden ? (
          empty(t(`templates.tags.${level}Forbidden`))
        ) : resource.loading && !resource.data ? (
          empty(t('common.loading'))
        ) : all.length === 0 ? (
          empty(t(`templates.tags.${level}Empty`))
        ) : items.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <caption className="sr-only">
                {t('tagLibrary.count', { count: items.length })}
              </caption>
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('tagLibrary.nameLabel')}</th>
                  <th className={panelTh}>{t('templates.actors.columns.origin')}</th>
                  <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {items.map((tag) => (
                  <tr key={tag.id} className={panelTr}>
                    {chipCell(tag)}
                    <td className={panelTd}>
                      <span className="flex flex-wrap gap-1">
                        <ActorOriginBadge origin={tag.origin ?? level} kind="tags" />
                        {level === 'organization' && (
                          <DisabledBadge item={tag as OrganizationTag} />
                        )}
                      </span>
                    </td>
                    <td className={panelTd}>
                      {!manage ? (
                        <div className={libraryActionsCellClass}>
                          <ViewButton
                            label={t('templates.tags.viewLabel', { name: tag.name })}
                            onClick={() =>
                              setForm({
                                level,
                                id: tag.id,
                                initial: tagFormValues(tag),
                                readOnly: true,
                              })
                            }
                          />
                          {duplicateMenu(
                            tag.name,
                            tagFromLevel(tag, level),
                            !(tag as OrganizationTag).disabled_at,
                          )}
                        </div>
                      ) : (
                        <div className={libraryActionsCellClass}>
                          <EditButton
                            label={t('tagLibrary.editLabel', { name: tag.name })}
                            onClick={() =>
                              setForm({ level, id: tag.id, initial: tagFormValues(tag) })
                            }
                          />
                          {level === 'organization' &&
                            duplicateMenu(
                              tag.name,
                              tagFromLevel(tag, level),
                              !(tag as OrganizationTag).disabled_at,
                            )}
                          {level === 'organization' && (
                            <EnableButton
                              item={tag as OrganizationTag}
                              url={`${collection(level)}/${tag.id}`}
                              name={tag.name}
                              onDone={() => reload(level)}
                            />
                          )}
                          <IconButton
                            label={t('tagLibrary.deleteLabel', { name: tag.name })}
                            onClick={() => setDeleting({ level, id: tag.id, name: tag.name })}
                          />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <LibraryLevelSwitch levels={tabs} value={tab} onChange={setTab} />

      {tab === 'system' && systemTab()}
      {tab === 'organization' && levelTab('organization')}
      {tab === 'exercise' && levelTab('exercise')}

      {form && (
        <TagFormModal
          title={
            form.readOnly
              ? form.initial.name
              : form.id
                ? t('templates.tags.editTitle', { name: form.initial.name })
                : t('tagLibrary.createButton')
          }
          level={form.level}
          initial={form.initial}
          readOnly={form.readOnly}
          onSubmit={saveForm}
          onClose={() => setForm(null)}
        />
      )}
      {deleting && (
        <LibraryDeleteDialog
          titleId="tag-delete-title"
          title={t('templates.tags.deleteTitle', { name: deleting.name })}
          name={deleting.name}
          url={`${collection(deleting.level)}/${deleting.id}`}
          usage={deleting.level === 'organization'}
          warning={
            deleting.level === 'organization'
              ? t('templates.tags.deleteOrganizationWarning')
              : t('templates.tags.deleteExerciseWarning')
          }
          deletedMessage={t('templates.tags.deleted', { name: deleting.name })}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null)
            reload(deleting.level)
          }}
        />
      )}
    </div>
  )
}
