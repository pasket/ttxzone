import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useLibraryFilters } from '../../hooks/useLibraryFilters'
import { useLibraryLevelParam } from '../../hooks/useLibraryLevelParam'
import { useToast } from '../../hooks/useToast'
import {
  asDuplicate,
  emptyActorFields,
  fromExercise,
  fromOrganization,
  fromSystem,
  saveActorToOrganization,
  type ActorFields,
} from '../../lib/actorLibrary'
import { apiFetch, ApiError } from '../../lib/api'
import { libraryActionsCellClass, btnSecondary } from '../../lib/buttonStyles'
import { libraryEmptyClass, libraryLevels, type LibraryPermissions } from '../../lib/libraryLevels'
import { ACTOR_TYPES, DELIVERY_METHODS } from '../../lib/msel'
import {
  panelMainTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type { ExerciseActor, MselActor, OrganizationActor, SystemActor } from '../../lib/types'
import { EditButton } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'
import { SaveToLibraryButton } from '../common/SaveToLibraryButton'
import { ViewButton } from '../common/ViewButton'
import { ActorFormModal, type ActorFormValues } from './ActorFormModal'
import { ActorOriginBadge } from './ActorOriginBadge'
import { DuplicateMenu } from './DuplicateMenu'
import { LibraryDeleteDialog } from './LibraryDeleteDialog'
import { DisabledBadge, EnableButton } from './LibraryItemState'
import {
  LibraryAside,
  LibraryFilterBar,
  LibraryNoMatches,
  type LibrarySelectFilter,
} from './LibraryFilters'
import { LibraryItemText } from './LibraryItemText'
import { LibraryLevelSwitch } from './LibraryLevelSwitch'
import { HelpText } from '../common/HelpText'

type Level = 'organization' | 'exercise'

/** The simulated actor library, three levels: TTX-Zone's own actors
 * (read-only, duplicable), the organization's (Program Managers manage
 * them in Admin; Exercise Planners copy them) and -- with an exercise in context --
 * that exercise's cast. All independent of the needs analysis and the
 * MSEL: an exercise's actors are copied, created and deleted at any time
 * (except one an inject sends). Every use is a copy, `_copy` suffixed
 * when duplicated, remembering what it was copied from -- and opened for
 * editing right away. */
export function ActorLibrary({
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

  const system = useApiResource<{ items: SystemActor[] }>('/actor-catalog')
  const organization = useApiResource<{ items: OrganizationActor[] }>(
    `/organizations/${organizationId}/actors`,
  )
  const cast = useApiResource<{ items: ExerciseActor[] }>(ttxId ? `/ttx/${ttxId}/actors` : null)

  const filter = useLibraryFilters(['type', 'channel', 'origin'] as const)
  // What the filters leave of a level's actors.
  const keep = (fields: ActorFields) =>
    (!filter.values.type || fields.type === filter.values.type) &&
    (!filter.values.channel || fields.channel === filter.values.channel) &&
    (!filter.query ||
      [fields.name, fields.description].some((text) => text.toLowerCase().includes(filter.query)))
  const selects = (withOrigin: boolean): LibrarySelectFilter[] => [
    {
      key: 'type',
      label: t('creator.msel.fields.type'),
      allLabel: t('templates.filters.all'),
      options: ACTOR_TYPES.map((value) => ({
        value,
        label: t(`creator.msel.actorTypes.${value}`),
      })),
    },
    {
      key: 'channel',
      label: t('templates.actors.fields.channel'),
      allLabel: t('templates.filters.all'),
      options: DELIVERY_METHODS.map((value) => ({
        value,
        label: t(`creator.msel.deliveryMethods.${value}`),
      })),
    },
    ...(withOrigin
      ? [
          {
            key: 'origin',
            label: t('templates.actors.columns.origin'),
            allLabel: t('templates.filters.all'),
            options: (['system', 'organization', 'exercise'] as const).map((value) => ({
              value,
              label: t(`templates.actors.origins.${value}.label`),
            })),
          },
        ]
      : []),
  ]
  const filterBar = (withOrigin: boolean) => (
    <LibraryFilterBar
      legend={t('templates.actors.filters.label')}
      searchLabel={t('templates.filters.search')}
      searchPlaceholder={t('templates.actors.filters.searchPlaceholder')}
      selects={selects(withOrigin)}
      values={filter.values}
      onChange={(key, value) => filter.set({ [key]: value })}
    />
  )
  const originMatches = (origin: string | null, level: Level) =>
    !filter.values.origin || (origin ?? level) === filter.values.origin
  const count = (n: number) => t('templates.actors.count', { count: n })

  // A TTX-Zone item opens only read-only (never saved).
  const [form, setForm] = useState<{
    level: Level | 'system'
    id: string | null
    initial: ActorFormValues
    readOnly?: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState<{ level: Level; id: string; name: string } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const errorText = (err: unknown) =>
    err instanceof ApiError ? err.message : t('auth.common.genericError')
  const collection = (level: Level) =>
    level === 'organization' ? `/organizations/${organizationId}/actors` : `/ttx/${ttxId}/actors`
  const reload = (level: Level) =>
    level === 'organization' ? organization.refetch() : cast.refetch()

  async function duplicate(fields: ActorFields, level: Level) {
    const copy = asDuplicate(fields)
    try {
      const created = await apiFetch<OrganizationActor | MselActor>(collection(level), {
        method: 'POST',
        body: JSON.stringify(level === 'exercise' ? { ...copy, played_by: '' } : copy),
      })
      reload(level)
      // The copy is made; open it right away to adapt it (on its level's tab).
      setTab(level)
      setForm({ level, id: created.id, initial: editValues(created) })
      showToast(
        level === 'organization'
          ? t('templates.actors.copiedToOrganization', { name: copy.name })
          : t('templates.actors.copiedToExercise', { name: copy.name }),
      )
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    }
  }

  /** An exercise actor into the organization's library, as it is (no
   * `_copy`); the exercise actor becomes a copy of it. */
  async function saveToOrganization(actor: ExerciseActor) {
    setSaving(actor.id)
    try {
      const origin = await saveActorToOrganization(organizationId, actor)
      await apiFetch(`${collection('exercise')}/${actor.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...editValues(actor), ...origin }),
      })
      reload('organization')
      reload('exercise')
      showToast(t('templates.actors.savedToOrganization', { name: actor.name }))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    } finally {
      setSaving(null)
    }
  }

  async function saveForm(values: ActorFormValues) {
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

  const editValues = (actor: OrganizationActor | MselActor): ActorFormValues => ({
    name: actor.name,
    type: actor.type,
    description: actor.description,
    channel: actor.channel,
    origin: actor.origin,
    origin_id: actor.origin_id,
    origin_name: actor.origin_name,
    ...('played_by' in actor ? { played_by: actor.played_by } : {}),
  })

  const nameCell = (name: string, description: string) => (
    <td className={panelTd}>
      <LibraryItemText title={name} description={description} />
    </td>
  )
  const typeCell = (type: MselActor['type']) => (
    <td className={`${panelTd} text-sm`}>{t(`creator.msel.actorTypes.${type}`)}</td>
  )
  const channelCell = (channel: MselActor['channel']) => (
    <td className={`${panelTd} text-sm`}>
      {channel ? t(`creator.msel.deliveryMethods.${channel}`) : '—'}
    </td>
  )
  const head = (extra: string[] = []) => (
    <thead>
      <tr className={panelTableHeadRow}>
        <th className={panelMainTh}>{t('creator.msel.table.name')}</th>
        <th className={`${panelTh} whitespace-nowrap`}>{t('creator.msel.table.type')}</th>
        <th className={`${panelTh} whitespace-nowrap`}>{t('templates.actors.fields.channel')}</th>
        {extra.map((label) => (
          <th key={label} className={panelTh}>
            {label}
          </th>
        ))}
        <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
      </tr>
    </thead>
  )
  const newButton = (level: Level) => (
    <button
      type="button"
      onClick={() => setForm({ level, id: null, initial: emptyActorFields() })}
      className={btnSecondary}
    >
      <span aria-hidden="true">+ </span>
      {t('templates.actors.newActor')}
    </button>
  )
  const duplicateMenu = (name: string, fields: ActorFields, toExercise = true) => (
    <DuplicateMenu
      label={t('templates.actors.duplicateLabel', { name })}
      toOrganization={t('templates.actors.toOrganization')}
      toExercise={t('templates.actors.toExercise')}
      showOrganization={permissions.toOrganization}
      showExercise={permissions.toExercise && toExercise && ttxId !== null}
      onPick={(target) => void duplicate(fields, target)}
    />
  )
  const rowActions = (
    level: Level,
    actor: OrganizationActor | ExerciseActor,
    fields: ActorFields,
  ) => {
    const inUse = 'in_use' in actor && actor.in_use
    // A disabled library actor can't be copied into an exercise.
    const disabled = 'disabled_at' in actor && Boolean(actor.disabled_at)
    // Seen from Creator, the organization's actors are only copied.
    if (level === 'organization' && !permissions.manageOrganization) {
      return (
        <div className={libraryActionsCellClass}>
          <ViewButton
            label={t('templates.actors.viewLabel', { name: actor.name })}
            onClick={() =>
              setForm({ level, id: actor.id, initial: editValues(actor), readOnly: true })
            }
          />
          {duplicateMenu(actor.name, fields, !disabled)}
        </div>
      )
    }
    return (
      <div className={libraryActionsCellClass}>
        <EditButton
          label={t('templates.actors.editLabel', { name: actor.name })}
          onClick={() => setForm({ level, id: actor.id, initial: editValues(actor) })}
        />
        {level === 'organization' && duplicateMenu(actor.name, fields)}
        {level === 'exercise' &&
          permissions.saveToOrganization &&
          actor.origin !== 'organization' && (
            <SaveToLibraryButton
              label={t('templates.actors.saveToOrganizationLabel', { name: actor.name })}
              pending={saving === actor.id}
              onClick={() => void saveToOrganization(actor as ExerciseActor)}
            />
          )}
        {level === 'organization' && (
          <EnableButton
            item={actor as OrganizationActor}
            url={`${collection(level)}/${actor.id}`}
            name={actor.name}
            onDone={() => reload(level)}
          />
        )}
        <IconButton
          label={
            inUse
              ? t('templates.actors.inUse', { name: actor.name })
              : t('templates.actors.deleteLabel', { name: actor.name })
          }
          disabled={inUse}
          onClick={() => setDeleting({ level, id: actor.id, name: actor.name })}
        />
      </div>
    )
  }

  function systemTab() {
    const rows = (system.data?.items ?? [])
      .map((actor) => ({ actor, fields: fromSystem(actor, spanish) }))
      .filter(({ fields }) => keep(fields))
    return (
      <Panel
        title={t('templates.levels.system')}
        description={
          <HelpText
            id="templates.actors.systemDescription"
            text={t('templates.actors.systemDescription')}
          />
        }
        aside={system.data ? <LibraryAside count={count(rows.length)} /> : undefined}
        flush
      >
        {filterBar(false)}
        {system.data && rows.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head()}
              <tbody className={panelTbody}>
                {rows.map(({ actor, fields }) => {
                  return (
                    <tr key={actor.id} className={panelTr}>
                      {nameCell(fields.name, fields.description)}
                      {typeCell(actor.type)}
                      {channelCell(actor.channel)}
                      <td className={panelTd}>
                        <div className={libraryActionsCellClass}>
                          <ViewButton
                            label={t('templates.actors.viewLabel', { name: fields.name })}
                            onClick={() =>
                              setForm({
                                level: 'system',
                                id: actor.id,
                                // The catalog item itself: nothing it was copied from.
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
            </table>
          </div>
        )}
      </Panel>
    )
  }

  function organizationTab() {
    const forbidden = organization.error instanceof ApiError && organization.error.status === 403
    const all = organization.data?.items ?? []
    const items = all.filter(
      (actor) => keep(fromOrganization(actor)) && originMatches(actor.origin, 'organization'),
    )
    return (
      <Panel
        title={t('templates.levels.organization')}
        description={
          <HelpText
            id="templates.actors.organizationDescription"
            text={t('templates.actors.organizationDescription')}
          />
        }
        aside={
          forbidden ? undefined : (
            <LibraryAside
              count={organization.data ? count(items.length) : undefined}
              action={permissions.manageOrganization ? newButton('organization') : undefined}
            />
          )
        }
        flush
      >
        {!forbidden && all.length > 0 && filterBar(true)}
        {forbidden ? (
          <p className={libraryEmptyClass}>{t('templates.actors.organizationForbidden')}</p>
        ) : all.length === 0 ? (
          <p className={libraryEmptyClass}>{t('templates.actors.organizationEmpty')}</p>
        ) : items.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head([t('templates.actors.columns.origin')])}
              <tbody className={panelTbody}>
                {items.map((actor) => (
                  <tr key={actor.id} className={panelTr}>
                    {nameCell(actor.name, actor.description)}
                    {typeCell(actor.type)}
                    {channelCell(actor.channel)}
                    <td className={panelTd}>
                      <span className="flex flex-wrap gap-1">
                        <ActorOriginBadge origin={actor.origin} />
                        <DisabledBadge item={actor} />
                      </span>
                    </td>
                    <td className={panelTd}>
                      {rowActions('organization', actor, fromOrganization(actor))}
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

  function exerciseTab() {
    const all = cast.data?.items ?? []
    const actors = all.filter(
      (actor) => keep(fromExercise(actor)) && originMatches(actor.origin, 'exercise'),
    )
    return (
      <Panel
        title={t('templates.levels.exercise')}
        description={
          <HelpText
            id="templates.actors.exerciseDescription"
            text={t('templates.actors.exerciseDescription')}
          />
        }
        aside={
          <LibraryAside
            count={cast.data ? count(actors.length) : undefined}
            action={newButton('exercise')}
          />
        }
        flush
      >
        {all.length > 0 && filterBar(true)}
        {all.length === 0 ? (
          <p className={libraryEmptyClass}>{t('templates.actors.exerciseEmpty')}</p>
        ) : actors.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head([t('templates.actors.columns.origin'), t('creator.msel.table.playedBy')])}
              <tbody className={panelTbody}>
                {actors.map((actor) => (
                  <tr key={actor.id} className={panelTr}>
                    {nameCell(actor.name, actor.description)}
                    {typeCell(actor.type)}
                    {channelCell(actor.channel)}
                    <td className={panelTd}>
                      <ActorOriginBadge origin={actor.origin} />
                    </td>
                    <td className={`${panelTd} text-sm`}>{actor.played_by || '—'}</td>
                    <td className={panelTd}>
                      {rowActions('exercise', actor, fromExercise(actor))}
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
      {tab === 'organization' && organizationTab()}
      {tab === 'exercise' && exerciseTab()}

      {form && (
        <ActorFormModal
          title={
            form.readOnly
              ? form.initial.name
              : form.id
                ? t('templates.actors.editTitle', { name: form.initial.name })
                : t('templates.actors.newActor')
          }
          level={form.level}
          initial={form.initial}
          readOnly={form.readOnly}
          withPlayedBy={form.level === 'exercise'}
          onSubmit={saveForm}
          onClose={() => setForm(null)}
        />
      )}
      {deleting && (
        <LibraryDeleteDialog
          titleId="actor-delete-title"
          title={t('templates.actors.deleteTitle', { name: deleting.name })}
          name={deleting.name}
          url={`${collection(deleting.level)}/${deleting.id}`}
          usage={deleting.level === 'organization'}
          warning={
            deleting.level === 'organization'
              ? t('templates.actors.deleteOrganizationWarning')
              : t('templates.actors.deleteExerciseWarning')
          }
          deletedMessage={t('templates.actors.deleted', { name: deleting.name })}
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
