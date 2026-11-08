import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useLibraryFilters } from '../../hooks/useLibraryFilters'
import { useLibraryLevelParam } from '../../hooks/useLibraryLevelParam'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import {
  badgeNeutral,
  libraryActionsCellClass,
  btnSecondary,
  linkAccent,
} from '../../lib/buttonStyles'
import {
  asDuplicate,
  emptyInjectFields,
  filterInjects,
  fromExerciseInject,
  fromOrganizationInject,
  fromSystemInject,
  SYSTEM_INJECT_LANGUAGES,
  contentLanguage,
  INJECT_AUDIENCES,
  INJECT_FAMILIES,
  INJECT_STAGES,
  localized,
  type InjectFilters,
} from '../../lib/injectLibrary'
import { libraryLevels, type LibraryPermissions } from '../../lib/libraryLevels'
import { enabledOnly } from '../../lib/libraryItems'
import {
  lazyRow,
  panelMainTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type {
  ContentLanguage,
  Msel,
  MselInject,
  OrganizationActor,
  OrganizationInject,
  OrganizationInjectFields,
  SystemActor,
  SystemInject,
  SystemInjectCatalog,
} from '../../lib/types'
import type { ApiResource } from '../../hooks/useApiResource'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { EditButton, PencilIcon } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { IconLinkButton } from '../common/IconLinkButton'
import { InjectMediaMarks } from '../common/InjectMediaMarks'
import { Panel } from '../common/Panel'
import { SaveToLibraryButton } from '../common/SaveToLibraryButton'
import { ViewButton } from '../common/ViewButton'
import { ActorOriginBadge } from './ActorOriginBadge'
import { AvailableLanguages } from './AvailableLanguages'
import { LibraryDeleteDialog } from './LibraryDeleteDialog'
import { DisabledBadge, EnableButton } from './LibraryItemState'
import { DuplicateMenu } from './DuplicateMenu'
import { InjectCopyDialog } from './InjectCopyDialog'
import { InjectFormModal } from './InjectFormModal'
import { InjectTemplateDialog } from './InjectTemplateDialog'
import {
  LibraryAside,
  LibraryFilterBar,
  LibraryNoMatches,
  type LibrarySelectFilter,
} from './LibraryFilters'
import { LibraryAttackUpgrade } from './LibraryAttackUpgrade'
import { LibraryItemText } from './LibraryItemText'
import { LibraryLevelSwitch } from './LibraryLevelSwitch'
import { HelpText } from '../common/HelpText'

const emptyClass = 'px-5 py-8 text-center text-sm text-paper-ink/70 dark:text-fg-muted'

type Level = 'organization' | 'exercise'

function withoutMeta(inject: OrganizationInject): OrganizationInjectFields {
  const { id: _id, created_at: _created, updated_at: _updated, ...fields } = inject
  void _id
  void _created
  void _updated
  return fields
}

/** The inject library, same three levels and rules as the actor library:
 * TTX-Zone's catalog (read-only, duplicable), the organization's own
 * (Program Managers create, edit and delete them in Admin; Exercise
 * Planners copy them)
 * and -- with an exercise in context -- that exercise's MSEL. Every use is
 * a copy that remembers its origin: duplicating into the organization adds
 * the `_copy` suffix; adding to the exercise asks for its phase,
 * objectives and scenario details. Writing or editing an MSEL inject
 * happens on the MSEL page, which the exercise level links to. */
export function InjectLibrary({
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
  const { activeTtx, ttxList } = useAuth()
  const levels = libraryLevels(ttxId !== null)
  const [level, setLevel] = useLibraryLevelParam(levels)
  const needsApproved = activeTtx?.id === ttxId && activeTtx?.needs_form_status === 'approved'
  // A new organization inject starts in the UI language (its form says
  // so and changes it); a copy into the exercise is in the exercise's own.
  const uiLanguage = contentLanguage(null, i18n.language)
  const exerciseLanguage = contentLanguage(
    ttxList.find((ttx) => ttx.id === ttxId)?.content_language,
    i18n.language,
  )

  const catalog = useApiResource<SystemInjectCatalog>('/inject-catalog')
  const systemActors = useApiResource<{ items: SystemActor[] }>('/actor-catalog')
  const organizationActors = useApiResource<{ items: OrganizationActor[] }>(
    `/organizations/${organizationId}/actors`,
  )
  const library = useApiResource<{ items: OrganizationInject[] }>(
    `/organizations/${organizationId}/injects`,
  )
  const msel = useApiResource<Msel>(
    ttxId && needsApproved && level === 'exercise' ? `/ttx/${ttxId}/msel` : null,
  )

  const filter = useLibraryFilters(['family', 'stage', 'audience', 'phase', 'kind'] as const)
  const templateSelects = useTemplateSelects()
  const matchesText = (...texts: string[]) =>
    !filter.query || texts.some((text) => text.toLowerCase().includes(filter.query))

  const [form, setForm] = useState<{
    id: string | null
    initial: OrganizationInjectFields
    readOnly?: boolean
  } | null>(null)
  const [copying, setCopying] = useState<OrganizationInjectFields | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{ level: Level; id: string; name: string } | null>(null)

  const errorText = (err: unknown) =>
    err instanceof ApiError ? err.message : t('auth.common.genericError')
  const libraryUrl = `/organizations/${organizationId}/injects`
  const actorName = (id: string) => {
    const actor = systemActors.data?.items.find((a) => a.id === id)
    return actor ? (spanish ? actor.name_es : actor.name_en) : id
  }

  async function duplicate(fields: OrganizationInjectFields, target: Level) {
    if (target === 'exercise') {
      setCopying(fields)
      return
    }
    const copy = asDuplicate(fields)
    try {
      const created = await apiFetch<OrganizationInject>(libraryUrl, {
        method: 'POST',
        body: JSON.stringify(copy),
      })
      library.refetch()
      // The copy is made; open it right away to adapt it (on its level's tab).
      setLevel('organization')
      setForm({ id: created.id, initial: withoutMeta(created) })
      showToast(t('templates.injects.copiedToOrganization', { name: copy.title }))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    }
  }

  /** An exercise inject into the organization's library, as it is (no
   * `_copy`, in the exercise's language; its images and files stay in the
   * MSEL). The MSEL isn't touched -- writing its origin would be an MSEL
   * edit that takes a READY MSEL back to DRAFT -- so "already saved" is read
   * from the library: an organization inject whose origin is this one. */
  async function saveToOrganization(inject: MselInject, data: Msel) {
    setSaving(inject.id)
    try {
      await apiFetch<OrganizationInject>(libraryUrl, {
        method: 'POST',
        body: JSON.stringify(fromExerciseInject(inject, data, exerciseLanguage)),
      })
      library.refetch()
      showToast(t('templates.injects.savedToOrganization', { name: inject.title || inject.code }))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    } finally {
      setSaving(null)
    }
  }
  const savedToOrganization = new Set(
    (library.data?.items ?? [])
      .filter((item) => item.origin === 'exercise' && item.origin_id)
      .map((item) => item.origin_id),
  )

  async function saveForm(values: OrganizationInjectFields) {
    if (!form) return
    try {
      await apiFetch(form.id ? `${libraryUrl}/${form.id}` : libraryUrl, {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      })
      setForm(null)
      library.refetch()
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    }
  }

  const duplicateMenu = (
    name: string,
    fields: (target: Level, language?: ContentLanguage) => OrganizationInjectFields,
    toExercise = true,
    languages?: readonly ContentLanguage[],
  ) => (
    <DuplicateMenu
      label={t('templates.injects.duplicateLabel', { name })}
      toOrganization={t('templates.injects.toOrganization')}
      toExercise={t('templates.injects.toExercise')}
      showOrganization={permissions.toOrganization}
      showExercise={permissions.toExercise && toExercise && ttxId !== null}
      languages={languages}
      onPick={(target, language) => void duplicate(fields(target, language), target)}
    />
  )

  function organizationTab() {
    const forbidden = library.error instanceof ApiError && library.error.status === 403
    const all = library.data?.items ?? []
    const { family, stage, audience } = filter.values
    const items = all.filter(
      (inject) =>
        (!family || inject.families.includes(family as OrganizationInject['families'][number])) &&
        (!stage || inject.stage === stage) &&
        (!audience || inject.audience === audience) &&
        matchesText(inject.title, inject.content),
    )
    return (
      <Panel
        title={t('templates.levels.organization')}
        description={
          <HelpText
            id="templates.injects.organizationDescription"
            text={t('templates.injects.organizationDescription')}
          />
        }
        aside={
          forbidden ? undefined : (
            <LibraryAside
              count={
                library.data ? t('templates.injects.count', { count: items.length }) : undefined
              }
              action={
                permissions.manageOrganization && (
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        id: null,
                        initial: {
                          ...emptyInjectFields(uiLanguage),
                          attack_version: catalog.data?.attack_version ?? '19.2',
                        },
                      })
                    }
                    className={btnSecondary}
                  >
                    <span aria-hidden="true">+ </span>
                    {t('templates.injects.newInject')}
                  </button>
                )
              }
            />
          )
        }
        flush
      >
        {!forbidden && permissions.manageOrganization && (
          <LibraryAttackUpgrade
            versions={all.map((inject) => inject.attack_version)}
            url={`${libraryUrl}/attack-upgrade`}
            onUpgraded={library.refetch}
          />
        )}
        {!forbidden && all.length > 0 && (
          <InjectFilterBar
            selects={templateSelects}
            values={filter.values}
            onChange={(key, value) => filter.set({ [key]: value })}
          />
        )}
        {forbidden ? (
          <p className={emptyClass}>{t('templates.injects.organizationForbidden')}</p>
        ) : library.data && all.length === 0 ? (
          <p className={emptyClass}>{t('templates.injects.organizationEmpty')}</p>
        ) : library.data && items.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelMainTh}>{t('templates.injects.columns.inject')}</th>
                  <th className={panelTh}>{t('templates.injects.columns.stage')}</th>
                  <th className={panelTh}>{t('templates.injects.columns.audience')}</th>
                  <th className={`${panelTh} whitespace-nowrap`}>
                    {t('templates.injects.columns.availableIn')}
                  </th>
                  <th className={panelTh}>{t('templates.injects.columns.sender')}</th>
                  <th className={panelTh}>{t('templates.injects.columns.origin')}</th>
                  <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {items.map((inject) => (
                  <tr key={inject.id} className={panelTr}>
                    <td className={panelTd}>
                      <LibraryItemText title={inject.title} description={inject.content} />
                    </td>
                    <td className={`${panelTd} text-sm whitespace-nowrap`}>
                      {t(`templates.injects.stages.${inject.stage}`)}
                    </td>
                    <td className={`${panelTd} text-sm whitespace-nowrap`}>
                      {t(`templates.injects.audiences.${inject.audience}`)}
                    </td>
                    <td className={`${panelTd} text-sm whitespace-nowrap`}>
                      <AvailableLanguages languages={inject.language ? [inject.language] : []} />
                    </td>
                    <td className={`${panelTd} text-sm`}>{inject.actor_name || '—'}</td>
                    <td className={panelTd}>
                      <span className="flex flex-wrap gap-1">
                        <ActorOriginBadge origin={inject.origin} kind="injects" />
                        {inject.format === 'poll' && (
                          <span className={badgeNeutral}>{t('creator.msel.formats.poll')}</span>
                        )}
                        <DisabledBadge item={inject} />
                      </span>
                    </td>
                    <td className={panelTd}>
                      <div className={libraryActionsCellClass}>
                        {permissions.manageOrganization ? (
                          <>
                            <EditButton
                              label={t('templates.injects.editLabel', { name: inject.title })}
                              onClick={() =>
                                setForm({ id: inject.id, initial: withoutMeta(inject) })
                              }
                            />
                            {duplicateMenu(
                              inject.title,
                              () => fromOrganizationInject(inject),
                              !inject.disabled_at,
                            )}
                            <EnableButton
                              item={inject}
                              url={`${libraryUrl}/${inject.id}`}
                              name={inject.title}
                              onDone={library.refetch}
                            />
                            <IconButton
                              label={t('templates.injects.deleteLabel', { name: inject.title })}
                              onClick={() =>
                                setDeleting({
                                  level: 'organization',
                                  id: inject.id,
                                  name: inject.title,
                                })
                              }
                            />
                          </>
                        ) : (
                          <>
                            <ViewButton
                              label={t('templates.injects.viewLabel', { name: inject.title })}
                              onClick={() =>
                                setForm({
                                  id: inject.id,
                                  initial: withoutMeta(inject),
                                  readOnly: true,
                                })
                              }
                            />
                            {duplicateMenu(
                              inject.title,
                              () => fromOrganizationInject(inject),
                              !inject.disabled_at,
                            )}
                          </>
                        )}
                      </div>
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
    const data = msel.data
    const mselLink = `/creator/${ttxId}/msel?tab=injects`
    const { phase, kind } = filter.values
    const injects = (data?.injects ?? []).filter(
      (inject) =>
        (!phase || inject.phase_id === phase) &&
        (!kind || inject.kind === kind) &&
        matchesText(inject.code, inject.title, inject.content),
    )
    const selects: LibrarySelectFilter[] = [
      {
        key: 'phase',
        label: t('creator.msel.filters.phase'),
        allLabel: t('creator.msel.filters.all'),
        options: (data?.phases ?? []).map((p) => ({ value: p.id, label: `${p.code} ${p.name}` })),
      },
      {
        key: 'kind',
        label: t('creator.msel.filters.kind'),
        allLabel: t('creator.msel.filters.all'),
        options: (['mandatory', 'contingent'] as const).map((k) => ({
          value: k,
          label: t(`creator.msel.kinds.${k}`),
        })),
      },
    ]
    return (
      <Panel
        title={t('templates.levels.exercise')}
        description={
          <HelpText
            id="templates.injects.exerciseDescription"
            text={t('templates.injects.exerciseDescription')}
          />
        }
        aside={
          <LibraryAside
            count={data ? t('templates.injects.count', { count: injects.length }) : undefined}
            action={
              needsApproved && data?.editable ? (
                <Link to={mselLink} className={btnSecondary}>
                  {t('templates.injects.exerciseCreate')}
                </Link>
              ) : undefined
            }
          />
        }
        flush
      >
        {data && data.injects.length > 0 && (
          <InjectFilterBar
            selects={selects}
            values={filter.values}
            onChange={(key, value) => filter.set({ [key]: value })}
          />
        )}
        {!needsApproved ? (
          <p className={emptyClass}>
            {t('templates.injects.exerciseNeedsApproval')}{' '}
            <Link to={`/creator/${ttxId}/needs`} className={linkAccent}>
              {t('templates.injects.exerciseNeedsApprovalLink')}
            </Link>
          </p>
        ) : msel.error ? (
          <p className={emptyClass}>{errorText(msel.error)}</p>
        ) : !data ? (
          <div className={emptyClass}>
            <ButtonSpinner />
          </div>
        ) : (
          <>
            {!data.editable && (
              <p className="border-b border-panel-line px-5 py-3 text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('templates.injects.exerciseReadOnly')}
              </p>
            )}
            {data.injects.length === 0 ? (
              <p className={emptyClass}>{t('templates.injects.exerciseEmpty')}</p>
            ) : injects.length === 0 ? (
              <LibraryNoMatches active={filter.active} onClear={filter.clear} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className={panelTableHeadRow}>
                      <th className={`${panelTh} w-24`}>{t('templates.injects.columns.code')}</th>
                      <th className={panelMainTh}>{t('templates.injects.columns.inject')}</th>
                      <th className={panelTh}>{t('templates.injects.columns.phase')}</th>
                      <th className={panelTh}>{t('templates.injects.columns.sender')}</th>
                      <th className={panelTh}>{t('templates.injects.columns.origin')}</th>
                      <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className={panelTbody}>
                    {injects.map((inject) => {
                      const phase = data.phases.find((p) => p.id === inject.phase_id)
                      const sender = data.actors.find((a) => a.id === inject.simulated_actor_id)
                      const name = inject.title || inject.code
                      return (
                        <tr key={inject.id} className={panelTr}>
                          <td
                            translate="no"
                            className={`${panelTd} font-mono text-xs whitespace-nowrap`}
                          >
                            {inject.code}
                          </td>
                          <td className={panelTd}>
                            <LibraryItemText
                              title={name}
                              description={inject.content}
                              marks={
                                <InjectMediaMarks
                                  images={inject.images?.length}
                                  files={inject.files?.length}
                                />
                              }
                            />
                          </td>
                          <td className={`${panelTd} text-sm whitespace-nowrap`}>
                            {phase ? `${phase.code} ${phase.name}` : '—'}
                          </td>
                          <td className={`${panelTd} text-sm`}>{sender?.name ?? '—'}</td>
                          <td className={panelTd}>
                            <ActorOriginBadge origin={inject.origin ?? 'exercise'} kind="injects" />
                          </td>
                          <td className={panelTd}>
                            <div className={libraryActionsCellClass}>
                              <IconLinkButton
                                to={`${mselLink}&inject=${inject.id}`}
                                label={t('templates.injects.editInMsel', { name })}
                                icon={<PencilIcon />}
                              />
                              {permissions.saveToOrganization &&
                                inject.origin !== 'organization' &&
                                !savedToOrganization.has(inject.id) && (
                                  <SaveToLibraryButton
                                    label={t('templates.injects.saveToOrganizationLabel', {
                                      name,
                                    })}
                                    pending={saving === inject.id}
                                    onClick={() => void saveToOrganization(inject, data)}
                                  />
                                )}
                              <IconButton
                                label={t('templates.injects.deleteLabel', { name })}
                                disabled={!data.editable}
                                onClick={() =>
                                  setDeleting({ level: 'exercise', id: inject.id, name })
                                }
                              />
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <LibraryLevelSwitch levels={levels} value={level} onChange={setLevel} />

      {level === 'system' && (
        <SystemInjects
          catalog={catalog}
          actorName={actorName}
          actions={(inject) =>
            duplicateMenu(
              localized(inject.title, spanish),
              (target, language) =>
                fromSystemInject(
                  inject,
                  target === 'exercise' ? exerciseLanguage : (language ?? uiLanguage),
                  catalog.data?.attack_version ?? '',
                  systemActors.data?.items ?? [],
                ),
              true,
              SYSTEM_INJECT_LANGUAGES,
            )
          }
        />
      )}
      {level === 'organization' && organizationTab()}
      {level === 'exercise' && exerciseTab()}

      {form && (
        <InjectFormModal
          title={
            form.readOnly
              ? form.initial.title
              : form.id
                ? t('templates.injects.editTitle', { name: form.initial.title })
                : t('templates.injects.newInject')
          }
          initial={form.initial}
          readOnly={form.readOnly}
          systemActors={systemActors.data?.items ?? []}
          organizationActors={enabledOnly(organizationActors.data?.items ?? [])}
          onSubmit={saveForm}
          onClose={() => setForm(null)}
        />
      )}
      {copying && ttxId && (
        <InjectCopyDialog
          fields={copying}
          ttxId={ttxId}
          onClose={() => setCopying(null)}
          onCopied={() => {
            setCopying(null)
            msel.refetch()
          }}
        />
      )}
      {deleting && (
        <LibraryDeleteDialog
          titleId="inject-delete-title"
          title={t('templates.injects.deleteTitle', { name: deleting.name })}
          name={deleting.name}
          url={
            deleting.level === 'organization'
              ? `${libraryUrl}/${deleting.id}`
              : `/ttx/${ttxId}/msel/injects/${deleting.id}`
          }
          usage={deleting.level === 'organization'}
          warning={
            deleting.level === 'organization'
              ? t('templates.injects.deleteOrganizationWarning')
              : t('templates.injects.deleteExerciseWarning')
          }
          deletedMessage={t('templates.injects.deleted', { name: deleting.name })}
          confirmLabel={t('templates.injects.deleteConfirm')}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null)
            if (deleting.level === 'organization') library.refetch()
            else msel.refetch()
          }}
        />
      )}
    </div>
  )
}

/** TTX-Zone's catalog: filterable by family, stage and audience, each
 * inject opening in full. Filters and the open inject live in the URL. */
function SystemInjects({
  catalog,
  actorName,
  actions,
}: {
  catalog: ApiResource<SystemInjectCatalog>
  actorName: (id: string) => string
  actions: (inject: SystemInject) => React.ReactNode
}) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const [searchParams, setSearchParams] = useSearchParams()

  const filter = useLibraryFilters(['family', 'stage', 'audience'] as const)
  const templateSelects = useTemplateSelects()
  const filters: InjectFilters = filter.values
  const setParams = (changes: Record<string, string | null>) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )

  const items = catalog.data?.items ?? []
  const shown = filterInjects(items, filters, spanish)
  const open = items.find((inject) => inject.id === searchParams.get('inject')) ?? null

  return (
    <Panel
      title={t('templates.levels.system')}
      description={
        <HelpText
          id="templates.injects.systemDescription"
          text={t('templates.injects.systemDescription')}
        />
      }
      aside={
        catalog.data ? (
          <LibraryAside count={t('templates.injects.count', { count: shown.length })} />
        ) : undefined
      }
      flush
    >
      <InjectFilterBar
        selects={templateSelects}
        values={filter.values}
        onChange={(key, value) => filter.set({ [key]: value })}
      />

      {catalog.error ? (
        <div className={`${emptyClass} space-y-3`}>
          <p>{t('templates.injects.loadError')}</p>
          <button type="button" onClick={catalog.refetch} className={btnSecondary}>
            {t('templates.injects.retry')}
          </button>
        </div>
      ) : catalog.data && shown.length === 0 ? (
        <LibraryNoMatches active={filter.active} onClear={filter.clear} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={panelTableHeadRow}>
                <th className={`${panelTh} w-32`}>{t('templates.injects.columns.code')}</th>
                <th className={panelMainTh}>{t('templates.injects.columns.inject')}</th>
                <th className={panelTh}>{t('templates.injects.columns.stage')}</th>
                <th className={panelTh}>{t('templates.injects.columns.audience')}</th>
                <th className={`${panelTh} whitespace-nowrap`}>
                  {t('templates.injects.columns.availableIn')}
                </th>
                <th className={panelTh}>{t('templates.injects.columns.sender')}</th>
                <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
              </tr>
            </thead>
            <tbody className={panelTbody}>
              {shown.map((inject) => {
                const title = localized(inject.title, spanish)
                return (
                  <tr key={inject.id} className={`${panelTr} ${lazyRow}`}>
                    <td translate="no" className={`${panelTd} font-mono text-xs whitespace-nowrap`}>
                      {inject.id}
                    </td>
                    <td className={panelTd}>
                      <LibraryItemText
                        title={title}
                        description={localized(inject.content, spanish)}
                        marks={<InjectMediaMarks images={inject.images?.length} />}
                      />
                    </td>
                    <td className={`${panelTd} text-sm whitespace-nowrap`}>
                      {t(`templates.injects.stages.${inject.stage}`)}
                    </td>
                    <td className={`${panelTd} text-sm whitespace-nowrap`}>
                      {t(`templates.injects.audiences.${inject.audience}`)}
                    </td>
                    <td className={`${panelTd} text-sm whitespace-nowrap`}>
                      <AvailableLanguages languages={SYSTEM_INJECT_LANGUAGES} />
                    </td>
                    <td className={`${panelTd} text-sm`}>{actorName(inject.actor)}</td>
                    <td className={panelTd}>
                      <div className={libraryActionsCellClass}>
                        <ViewButton
                          label={t('templates.injects.detail.open', { code: inject.id, title })}
                          onClick={() => setParams({ inject: inject.id })}
                        />
                        {actions(inject)}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {open && catalog.data && (
        <InjectTemplateDialog
          inject={open}
          attackVersion={catalog.data.attack_version}
          actorName={actorName}
          onClose={() => setParams({ inject: null })}
        />
      )}
    </Panel>
  )
}

/** Family, stage and audience: what a library inject is filtered by. */
function useTemplateSelects(): LibrarySelectFilter[] {
  const { t } = useTranslation()
  return [
    {
      key: 'family',
      label: t('templates.injects.filters.family'),
      allLabel: t('templates.injects.filters.allFamilies'),
      options: INJECT_FAMILIES.map(({ family, code }) => ({
        value: family,
        label: `${code} · ${t(`templates.injects.families.${family}`)}`,
      })),
    },
    {
      key: 'stage',
      label: t('templates.injects.filters.stage'),
      allLabel: t('templates.injects.filters.allStages'),
      options: INJECT_STAGES.map((stage) => ({
        value: stage,
        label: t(`templates.injects.stages.${stage}`),
      })),
    },
    {
      key: 'audience',
      label: t('templates.injects.filters.audience'),
      allLabel: t('templates.injects.filters.allAudiences'),
      options: INJECT_AUDIENCES.map((audience) => ({
        value: audience,
        label: t(`templates.injects.audiences.${audience}`),
      })),
    },
  ]
}

function InjectFilterBar({
  selects,
  values,
  onChange,
}: {
  selects: LibrarySelectFilter[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const { t } = useTranslation()
  return (
    <LibraryFilterBar
      legend={t('templates.injects.filters.label')}
      searchLabel={t('templates.injects.filters.search')}
      searchPlaceholder={t('templates.injects.filters.searchPlaceholder')}
      selects={selects}
      values={values}
      onChange={onChange}
    />
  )
}
