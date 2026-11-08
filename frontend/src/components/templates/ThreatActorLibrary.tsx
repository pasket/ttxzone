import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAttackConversionSummary } from '../../hooks/useAttackConversionSummary'
import { useAuth } from '../../hooks/useAuth'
import { useLibraryFilters } from '../../hooks/useLibraryFilters'
import { useLibraryLevelParam } from '../../hooks/useLibraryLevelParam'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { libraryActionsCellClass, btnSecondary, linkAccent } from '../../lib/buttonStyles'
import {
  libraryEmptyClass,
  libraryLevels,
  type LibraryLevel,
  type LibraryPermissions,
} from '../../lib/libraryLevels'
import {
  lazyRow,
  panelMainTh,
  panelNumTd,
  panelNumTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import {
  asDuplicate,
  editValues,
  emptyThreatActor,
  copyOfSystem,
  fromExerciseThreatActor,
  fromOrganization,
  fromSystem,
  groupUrl,
  type ThreatActorFields,
} from '../../lib/threatActors'
import type {
  AttackCatalog,
  AttackConversion,
  Msel,
  MselThreatActor,
  OrganizationThreatActor,
  SystemThreatActorCatalog,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { EditButton, PencilIcon } from '../common/EditButton'
import { IconLinkButton } from '../common/IconLinkButton'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'
import { SaveToLibraryButton } from '../common/SaveToLibraryButton'
import { ViewButton } from '../common/ViewButton'
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
import { LibraryAttackUpgrade } from './LibraryAttackUpgrade'
import { LibraryLevelSwitch } from './LibraryLevelSwitch'
import { ThreatActorFormModal } from './ThreatActorFormModal'
import { HelpText } from '../common/HelpText'

/** The threat actor library: MITRE ATT&CK's groups (TTX-Zone, read-only,
 * searchable by id, name or associated group), the organization's own
 * threat actors -- MITRE groups copied and narrowed, or unknown actors
 * with or without techniques -- and, with an exercise in context, the ones
 * behind its scenario (edited on the MSEL page). Every use is a copy:
 * `_copy` suffixed and opened for editing when duplicated to the
 * organization; added as is to the scenario. */
export function ThreatActorLibrary({
  organizationId,
  ttxId,
  permissions,
}: {
  organizationId: string
  /** The exercise in context (Creator), or null (Admin, or none yet). */
  ttxId: string | null
  permissions: LibraryPermissions
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const summarize = useAttackConversionSummary()
  const { activeTtx } = useAuth()
  const levels = libraryLevels(ttxId !== null)
  const [tab, setTab] = useLibraryLevelParam(levels)
  const needsApproved = activeTtx?.id === ttxId && activeTtx?.needs_form_status === 'approved'
  const msel = useApiResource<Msel>(ttxId && needsApproved ? `/ttx/${ttxId}/msel` : null)
  const canAddToExercise = ttxId !== null && needsApproved && msel.data?.editable === true

  const system = useApiResource<SystemThreatActorCatalog>('/threat-actor-catalog')
  const organization = useApiResource<{ items: OrganizationThreatActor[] }>(
    `/organizations/${organizationId}/threat-actors`,
  )
  const collection = `/organizations/${organizationId}/threat-actors`
  const version = system.data?.attack_version ?? ''
  const attack = useApiResource<AttackCatalog>(version ? `/attack/${version}` : null).data

  // Filters: free text over id, name, associated groups and technique ids
  // ("T1486" lists who uses it), then matrix, tactic and -- for the
  // organization's and the exercise's -- MITRE group or unknown actor.
  const filter = useLibraryFilters(['domain', 'tactic', 'kind'] as const)
  const tacticsOf = new Map(
    attack?.domains.flatMap((d) => d.techniques.map((x) => [`${d.domain}|${x.id}`, x.tactics])) ??
      [],
  )
  const keep = (actor: {
    mitre_group_id: string | null
    name: string
    aliases: string[]
    techniques: { domain: string; technique_id: string }[]
  }) => {
    const { domain, tactic, kind } = filter.values
    const q = filter.query
    return (
      (!kind || (kind === 'mitre') === (actor.mitre_group_id !== null)) &&
      (!domain || actor.techniques.some((x) => x.domain === domain)) &&
      (!tactic ||
        actor.techniques.some((x) =>
          tacticsOf.get(`${x.domain}|${x.technique_id}`)?.includes(tactic),
        )) &&
      (!q ||
        [actor.mitre_group_id ?? '', actor.name, ...actor.aliases].some((text) =>
          text.toLowerCase().includes(q),
        ) ||
        actor.techniques.some((x) => x.technique_id.toLowerCase().startsWith(q)))
    )
  }
  const selects = (withKind: boolean): LibrarySelectFilter[] => [
    {
      key: 'domain',
      label: t('templates.threats.filters.domain'),
      allLabel: t('templates.filters.all'),
      options: (attack?.domains ?? []).map((d) => ({ value: d.domain, label: d.name })),
    },
    {
      key: 'tactic',
      label: t('templates.threats.filters.tactic'),
      allLabel: t('templates.filters.all'),
      options: (attack?.domains ?? []).flatMap((d) =>
        d.tactics.map((tactic) => ({
          value: tactic.id,
          label: d.domain === 'ics' ? `${tactic.name} (ICS)` : tactic.name,
        })),
      ),
    },
    ...(withKind
      ? [
          {
            key: 'kind',
            label: t('templates.threats.filters.kind'),
            allLabel: t('templates.filters.all'),
            options: [
              { value: 'mitre', label: t('templates.threats.filters.mitre') },
              { value: 'unknown', label: t('templates.threats.unknownActor') },
            ],
          },
        ]
      : []),
  ]
  const filterBar = (withKind: boolean) => (
    <LibraryFilterBar
      legend={t('templates.threats.filters.label')}
      searchLabel={t('templates.filters.search')}
      searchPlaceholder={t('templates.threats.searchPlaceholder')}
      selects={selects(withKind)}
      values={filter.values}
      onChange={(key, value) => filter.set({ [key]: value })}
    />
  )
  const count = (n: number) => t('templates.threats.count', { count: n })

  const [viewing, setViewing] = useState<{
    level: LibraryLevel
    fields: ThreatActorFields
  } | null>(null)
  const [form, setForm] = useState<{ id: string | null; initial: ThreatActorFields } | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<{
    level: 'organization' | 'exercise'
    id: string
    name: string
  } | null>(null)

  // An organization actor was modified when it was updated after its
  // creation (the two stamps differ by a moment on create).
  const libraryModifiedAt = (id: string) => {
    const actor = organization.data?.items.find((a) => a.id === id)
    if (!actor) return undefined
    const changed =
      new Date(actor.updated_at).getTime() - new Date(actor.created_at).getTime() > 1000
    return changed ? actor.updated_at : null
  }
  const errorText = (err: unknown) =>
    err instanceof ApiError ? err.message : t('auth.common.genericError')

  async function duplicate(fields: ThreatActorFields, target: 'organization' | 'exercise') {
    if (target === 'exercise') {
      // A use, not a duplicate: into the scenario under its own name.
      try {
        // Moved onto the MSEL's ATT&CK release on the way: say what changed.
        const { actor, conversion } = await apiFetch<{
          actor: MselThreatActor
          conversion: AttackConversion
        }>(`/ttx/${ttxId}/msel/threat-actors`, {
          method: 'POST',
          body: JSON.stringify(fields),
        })
        msel.refetch()
        setTab('exercise')
        const groupGone = fields.mitre_group_id !== null && actor.mitre_group_id === null
        showToast(
          [
            t('templates.threats.addedToExercise', { name: fields.name }),
            groupGone
              ? t('creator.msel.threatActors.groupNotInRelease', {
                  group: fields.mitre_group_id,
                  version: msel.data?.attack_version ?? '',
                })
              : '',
            summarize({
              ...conversion,
              removed: conversion.removed.filter((id) => id !== fields.mitre_group_id),
            }),
          ]
            .filter(Boolean)
            .join(' '),
        )
      } catch (err) {
        showToast(errorText(err), { variant: 'error' })
      }
      return
    }
    const copy = asDuplicate(fields)
    try {
      const created = await apiFetch<OrganizationThreatActor>(collection, {
        method: 'POST',
        body: JSON.stringify(copy),
      })
      organization.refetch()
      // The copy is made; open it right away to adapt it.
      setTab('organization')
      setForm({ id: created.id, initial: editValues(created) })
      showToast(t('templates.threats.copiedToOrganization', { name: copy.name }))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    }
  }

  /** A scenario's threat actor into the organization's library, as it is.
   * The MSEL isn't written (that would take a READY MSEL back to DRAFT), so
   * "already saved" is read from the library: an actor copied from it. */
  async function saveToOrganization(actor: MselThreatActor, attackVersion: string) {
    setSaving(actor.id)
    try {
      await apiFetch<OrganizationThreatActor>(collection, {
        method: 'POST',
        body: JSON.stringify(fromExerciseThreatActor(actor, attackVersion)),
      })
      organization.refetch()
      showToast(t('templates.threats.savedToOrganization', { name: actor.name }))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    } finally {
      setSaving(null)
    }
  }
  const savedToOrganization = new Set(
    (organization.data?.items ?? [])
      .filter((item) => item.origin === 'exercise' && item.origin_id)
      .map((item) => item.origin_id),
  )

  async function saveForm(values: ThreatActorFields) {
    if (!form) return
    try {
      await apiFetch(form.id ? `${collection}/${form.id}` : collection, {
        method: form.id ? 'PATCH' : 'POST',
        body: JSON.stringify(values),
      })
      setForm(null)
      organization.refetch()
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      showToast(errorText(err), { variant: 'error' })
    }
  }

  const groupIdCell = (groupId: string | null, attackVersion: string) => (
    <td translate="no" className={`${panelTd} whitespace-nowrap font-mono text-sm`}>
      {groupId ? (
        <a
          href={groupUrl(attackVersion, groupId)}
          target="_blank"
          rel="noreferrer"
          title={t('templates.threats.onMitre', { version: attackVersion })}
          className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          {groupId}
        </a>
      ) : (
        <span title={t('templates.threats.unknownHint')}>—</span>
      )}
    </td>
  )
  const nameCell = (name: string, aliases: string[], description = '') => (
    <td className={panelTd}>
      <span className="block text-sm font-medium">{name}</span>
      {aliases.length > 0 && (
        <span className="block max-w-3xl truncate text-xs/5 text-paper-ink/70 dark:text-fg-muted">
          {aliases.join(', ')}
        </span>
      )}
      {description && (
        <span
          title={description}
          className="mt-0.5 line-clamp-2 max-w-3xl text-[0.8125rem]/5 text-pretty text-paper-ink/70 dark:text-fg-muted"
        >
          {description}
        </span>
      )}
    </td>
  )
  const countCell = (count: number) => <td className={panelNumTd}>{count}</td>
  const head = (extra: string[] = []) => (
    <thead>
      <tr className={panelTableHeadRow}>
        <th className={panelTh}>{t('templates.threats.columns.id')}</th>
        <th className={panelMainTh}>{t('templates.threats.columns.name')}</th>
        <th className={panelNumTh}>{t('templates.threats.columns.techniques')}</th>
        {extra.map((label) => (
          <th key={label} className={panelTh}>
            {label}
          </th>
        ))}
        <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
      </tr>
    </thead>
  )
  const duplicateMenu = (name: string, fields: ThreatActorFields, toExercise = true) => (
    <DuplicateMenu
      label={t('templates.threats.duplicateLabel', { name })}
      toOrganization={t('templates.actors.toOrganization')}
      toExercise={t('templates.actors.toExercise')}
      showOrganization={permissions.toOrganization}
      showExercise={permissions.toExercise && toExercise && canAddToExercise}
      onPick={(target) => void duplicate(fields, target)}
    />
  )

  function systemTab() {
    const groups = (system.data?.items ?? []).filter((group) =>
      keep({ ...group, mitre_group_id: group.id }),
    )
    return (
      <Panel
        title={t('templates.levels.system')}
        description={
          <HelpText
            id="templates.threats.systemDescription"
            text={t('templates.threats.systemDescription', { version })}
          />
        }
        aside={system.data ? <LibraryAside count={count(groups.length)} /> : undefined}
        flush
      >
        {filterBar(false)}
        {system.error ? (
          <p role="alert" className="px-5 py-8 text-center text-sm text-danger-fg">
            {t('templates.threats.loadError')}
          </p>
        ) : groups.length === 0 && system.data ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head()}
              <tbody className={panelTbody}>
                {groups.map((group) => {
                  const fields = fromSystem(group, version)
                  return (
                    <tr key={group.id} className={`${panelTr} ${lazyRow}`}>
                      {groupIdCell(group.id, version)}
                      {nameCell(group.name, group.aliases)}
                      {countCell(group.techniques.length)}
                      <td className={panelTd}>
                        <div className={libraryActionsCellClass}>
                          <ViewButton
                            label={t('templates.threats.viewLabel', { name: group.name })}
                            onClick={() => setViewing({ level: 'system', fields })}
                          />
                          {duplicateMenu(group.name, copyOfSystem(group, version))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {system.data && (
          <p className="border-t border-panel-line px-5 py-3 text-xs text-paper-ink/60 dark:text-fg-faint">
            {system.data.copyright}
          </p>
        )}
      </Panel>
    )
  }

  function organizationTab() {
    const forbidden = organization.error instanceof ApiError && organization.error.status === 403
    const all = organization.data?.items ?? []
    const items = all.filter(keep)
    return (
      <Panel
        title={t('templates.levels.organization')}
        description={
          <HelpText
            id="templates.threats.organizationDescription"
            text={t('templates.threats.organizationDescription')}
          />
        }
        aside={
          forbidden || !version ? undefined : (
            <LibraryAside
              count={organization.data ? count(items.length) : undefined}
              action={
                permissions.manageOrganization && (
                  <button
                    type="button"
                    onClick={() => setForm({ id: null, initial: emptyThreatActor(version) })}
                    className={btnSecondary}
                  >
                    <span aria-hidden="true">+ </span>
                    {t('templates.threats.newActor')}
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
            versions={all.map((actor) => actor.attack_version)}
            url={`${collection}/attack-upgrade`}
            onUpgraded={organization.refetch}
          />
        )}
        {!forbidden && all.length > 0 && filterBar(true)}
        {forbidden ? (
          <p className={libraryEmptyClass}>{t('templates.actors.organizationForbidden')}</p>
        ) : all.length === 0 ? (
          <p className={libraryEmptyClass}>{t('templates.threats.organizationEmpty')}</p>
        ) : items.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head([t('templates.actors.columns.origin')])}
              <tbody className={panelTbody}>
                {items.map((actor) => (
                  <tr key={actor.id} className={panelTr}>
                    {groupIdCell(actor.mitre_group_id, actor.attack_version)}
                    {nameCell(actor.name, actor.aliases, actor.description)}
                    {countCell(actor.techniques.length)}
                    <td className={panelTd}>
                      <span className="flex flex-wrap gap-1">
                        <ActorOriginBadge origin={actor.origin} kind="threats" />
                        <DisabledBadge item={actor} />
                      </span>
                    </td>
                    <td className={panelTd}>
                      {permissions.manageOrganization ? (
                        <div className={libraryActionsCellClass}>
                          <EditButton
                            label={t('templates.threats.editLabel', { name: actor.name })}
                            onClick={() => setForm({ id: actor.id, initial: editValues(actor) })}
                          />
                          {duplicateMenu(actor.name, fromOrganization(actor), !actor.disabled_at)}
                          <EnableButton
                            item={actor}
                            url={`${collection}/${actor.id}`}
                            name={actor.name}
                            onDone={organization.refetch}
                          />
                          <IconButton
                            label={t('templates.threats.deleteLabel', { name: actor.name })}
                            onClick={() =>
                              setDeleting({ level: 'organization', id: actor.id, name: actor.name })
                            }
                          />
                        </div>
                      ) : (
                        <div className={libraryActionsCellClass}>
                          <ViewButton
                            label={t('templates.threats.viewLabel', { name: actor.name })}
                            onClick={() =>
                              setViewing({ level: 'organization', fields: editValues(actor) })
                            }
                          />
                          {duplicateMenu(actor.name, fromOrganization(actor), !actor.disabled_at)}
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

  function exerciseTab() {
    const data = msel.data
    const scenarioLink = `/creator/${ttxId}/msel?tab=threats`
    const empty = libraryEmptyClass
    const attributed = (id: string) =>
      data?.injects.filter((i) => i.threat_actor_id === id).length ?? 0
    const all = data?.threat_actors ?? []
    const actors = all.filter(keep)
    return (
      <Panel
        title={t('templates.levels.exercise')}
        description={
          <HelpText
            id="templates.threats.exerciseDescription"
            text={t('templates.threats.exerciseDescription')}
          />
        }
        aside={
          <LibraryAside
            count={data ? count(actors.length) : undefined}
            action={
              canAddToExercise ? (
                <Link to={scenarioLink} className={btnSecondary}>
                  {t('templates.threats.openScenario')}
                </Link>
              ) : undefined
            }
          />
        }
        flush
      >
        {all.length > 0 && filterBar(true)}
        {!needsApproved ? (
          <p className={empty}>
            {t('templates.threats.exerciseNeedsApproval')}{' '}
            <Link to={`/creator/${ttxId}/needs`} className={linkAccent}>
              {t('templates.injects.exerciseNeedsApprovalLink')}
            </Link>
          </p>
        ) : msel.error ? (
          <p className={empty}>{errorText(msel.error)}</p>
        ) : !data ? (
          <div className={empty}>
            <ButtonSpinner />
          </div>
        ) : all.length === 0 ? (
          <p className={empty}>{t('templates.threats.exerciseEmpty')}</p>
        ) : actors.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head([t('templates.threats.columns.injects'), t('templates.actors.columns.origin')])}
              <tbody className={panelTbody}>
                {actors.map((actor) => (
                  <tr key={actor.id} className={panelTr}>
                    {groupIdCell(actor.mitre_group_id, data.attack_version)}
                    {nameCell(`${actor.code} ${actor.name}`, actor.aliases, actor.description)}
                    {countCell(actor.techniques.length)}
                    {countCell(attributed(actor.id))}
                    <td className={panelTd}>
                      <ActorOriginBadge origin={actor.origin} kind="threats" />
                    </td>
                    <td className={panelTd}>
                      <div className={libraryActionsCellClass}>
                        <IconLinkButton
                          to={scenarioLink}
                          label={t('templates.threats.editInScenario', { name: actor.name })}
                          icon={<PencilIcon />}
                        />
                        {permissions.saveToOrganization &&
                          actor.origin !== 'organization' &&
                          !savedToOrganization.has(actor.id) && (
                            <SaveToLibraryButton
                              label={t('templates.threats.saveToOrganizationLabel', {
                                name: actor.name,
                              })}
                              pending={saving === actor.id}
                              onClick={() => void saveToOrganization(actor, data.attack_version)}
                            />
                          )}
                        {data.editable && (
                          <IconButton
                            label={t('templates.threats.removeFromExercise', { name: actor.name })}
                            onClick={() =>
                              setDeleting({ level: 'exercise', id: actor.id, name: actor.name })
                            }
                          />
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

  return (
    <div className="space-y-4">
      <LibraryLevelSwitch levels={levels} value={tab} onChange={setTab} />

      {tab === 'system' && systemTab()}
      {tab === 'organization' && organizationTab()}
      {tab === 'exercise' && exerciseTab()}

      {viewing && (
        <ThreatActorFormModal
          title={
            viewing.fields.mitre_group_id
              ? `${viewing.fields.mitre_group_id} · ${viewing.fields.name}`
              : viewing.fields.name
          }
          level={viewing.level}
          initial={viewing.fields}
          readOnly
          onClose={() => setViewing(null)}
        />
      )}
      {form && (
        <ThreatActorFormModal
          title={
            form.id
              ? t('templates.threats.editTitle', { name: form.initial.name })
              : t('templates.threats.newActor')
          }
          level="organization"
          initial={form.initial}
          modifiedAt={form.id ? libraryModifiedAt(form.id) : undefined}
          onSubmit={saveForm}
          onClose={() => setForm(null)}
        />
      )}
      {deleting && (
        <LibraryDeleteDialog
          titleId="threat-actor-delete-title"
          title={t('templates.threats.deleteTitle', { name: deleting.name })}
          name={deleting.name}
          url={
            deleting.level === 'organization'
              ? `${collection}/${deleting.id}`
              : `/ttx/${ttxId}/msel/threat-actors/${deleting.id}`
          }
          usage={deleting.level === 'organization'}
          warning={
            deleting.level === 'organization'
              ? t('templates.threats.deleteWarning')
              : t('templates.threats.removeWarning')
          }
          deletedMessage={t('templates.threats.deleted', { name: deleting.name })}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null)
            if (deleting.level === 'organization') organization.refetch()
            else msel.refetch()
          }}
        />
      )}
    </div>
  )
}
