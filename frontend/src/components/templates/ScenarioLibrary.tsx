import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../hooks/useApiDownload'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useLibraryFilters } from '../../hooks/useLibraryFilters'
import { useLibraryLevelParam } from '../../hooks/useLibraryLevelParam'
import { useToast } from '../../hooks/useToast'
import { API_BASE, apiFetch, ApiError } from '../../lib/api'
import {
  libraryActionsCellClass,
  btnDangerGhost,
  btnNeutralIconGhost,
  btnSecondary,
  linkAccent,
} from '../../lib/buttonStyles'
import { libraryEmptyClass, libraryLevels, type LibraryPermissions } from '../../lib/libraryLevels'
import {
  panelMainTh,
  panelNumTd,
  panelNumTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type { ExerciseScenario, ScenarioSource, ScenarioSummary } from '../../lib/scenarios'
import { SCENARIO_COUNT_KEYS } from '../../lib/scenarios'
import { EditButton } from '../common/EditButton'
import { HelpText } from '../common/HelpText'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'
import { ViewButton } from '../common/ViewButton'
import { ActorOriginBadge } from './ActorOriginBadge'
import { AvailableLanguages } from './AvailableLanguages'
import { DuplicateMenu } from './DuplicateMenu'
import { LibraryDeleteDialog } from './LibraryDeleteDialog'
import { LibraryAside, LibraryFilterBar, LibraryNoMatches } from './LibraryFilters'
import { DisabledBadge, EnableButton } from './LibraryItemState'
import { LibraryItemText } from './LibraryItemText'
import { LibraryLevelSwitch } from './LibraryLevelSwitch'
import {
  ScenarioApplyDialog,
  ScenarioEditDialog,
  ScenarioFromExerciseDialog,
  ScenarioImportDialog,
  ScenarioViewDialog,
} from './ScenarioDialogs'

/** What a scenario's row counts: the rest is in its View. */
const SCENARIO_TABLE_COUNTS = ['objectives', 'phases', 'injects'] as const

const actionHeadingClass = 'text-sm font-semibold'
const actionTextClass = 'text-sm text-pretty text-paper-ink/70 dark:text-fg-muted'

export function DownloadIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
    </svg>
  )
}

/** The scenario library: whole exercises -- definition, needs analysis,
 * MSEL and the exercise's own actors, threat actors, injects and tags --
 * packaged for reuse, without people, approvals or dates. TTX-Zone's
 * (read-only), the organization's (its Program Managers make them from a
 * TTX-Zone scenario, an exercise or a shared file, and export them) and,
 * with an exercise in context, that exercise (its Exercise Planners
 * export it, or overwrite it with a scenario or a file -- checked first,
 * then confirmed). */
export function ScenarioLibrary({
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
  const { activeTtx, ttxList } = useAuth()
  const download = useApiDownload()
  const tabs = libraryLevels(ttxId !== null)
  const [tab, setTab] = useLibraryLevelParam(tabs)

  const system = useApiResource<{ items: ScenarioSummary[] }>('/scenario-catalog')
  const collection = `/organizations/${organizationId}/scenarios`
  const organization = useApiResource<{ items: ScenarioSummary[] }>(collection)
  const exercise = useApiResource<ExerciseScenario>(
    ttxId && tab === 'exercise' ? `/ttx/${ttxId}/scenario` : null,
  )

  const filter = useLibraryFilters([] as const)
  const keep = (item: ScenarioSummary) =>
    !filter.query ||
    [item.name, item.description ?? ''].some((text) => text.toLowerCase().includes(filter.query))
  const count = (n: number) => t('templates.scenarios.count', { count: n })

  const [viewing, setViewing] = useState<string | null>(null)
  const [editing, setEditing] = useState<ScenarioSummary | null>(null)
  const [deleting, setDeleting] = useState<ScenarioSummary | null>(null)
  /** A scenario (or a file) on its way into an exercise: `replace` the one
   * in context, or a new one. */
  const [applying, setApplying] = useState<{
    replace: boolean
    library?: ScenarioSource
  } | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [fromExercise, setFromExercise] = useState(false)

  async function duplicateToOrganization(body: Record<string, string>) {
    try {
      const created = await apiFetch<ScenarioSummary>(collection, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      organization.refetch()
      // The copy is made; open it right away to adapt it (on its level's tab).
      setTab('organization')
      setEditing(created)
      showToast(t('templates.scenarios.copiedToOrganization', { name: created.name }))
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    }
  }

  async function saveExerciseToOrganization() {
    setSaving(true)
    try {
      const created = await apiFetch<ScenarioSummary>(collection, {
        method: 'POST',
        body: JSON.stringify({ ttx_id: ttxId }),
      })
      organization.refetch()
      showToast(t('templates.scenarios.copiedToOrganization', { name: created.name }))
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const filterBar = (
    <LibraryFilterBar
      legend={t('templates.scenarios.filters.label')}
      searchLabel={t('templates.filters.search')}
      searchPlaceholder={t('templates.scenarios.filters.searchPlaceholder')}
      selects={[]}
      values={filter.values}
      onChange={(key, value) => filter.set({ [key]: value })}
    />
  )
  const head = (extra: string[] = []) => (
    <thead>
      <tr className={panelTableHeadRow}>
        <th className={panelMainTh}>{t('templates.scenarios.columns.scenario')}</th>
        <th className={`${panelTh} whitespace-nowrap`}>
          {t('templates.scenarios.columns.availableIn')}
        </th>
        {SCENARIO_TABLE_COUNTS.map((key) => (
          <th key={key} className={panelNumTh}>
            {t(`templates.scenarios.counts.${key}`)}
          </th>
        ))}
        {extra.map((label) => (
          <th key={label} className={panelTh}>
            {label}
          </th>
        ))}
        <th className={`${panelTh} w-44 text-right`}>{t('common.table.actions')}</th>
      </tr>
    </thead>
  )
  const cells = (item: ScenarioSummary) => (
    <>
      <td className={panelTd}>
        <LibraryItemText title={item.name} description={item.description} />
      </td>
      <td className={`${panelTd} text-sm whitespace-nowrap`}>
        <AvailableLanguages languages={item.languages} />
      </td>
      {SCENARIO_TABLE_COUNTS.map((key) => (
        <td key={key} className={panelNumTd}>
          {item.counts[key]}
        </td>
      ))}
    </>
  )
  const exportLink = (url: string, name: string) => (
    <a
      href={`${API_BASE}${url}`}
      download
      onClick={download(url)}
      aria-label={t('templates.scenarios.exportLabel', { name })}
      title={t('templates.scenarios.exportLabel', { name })}
      className={btnNeutralIconGhost}
    >
      <DownloadIcon />
    </a>
  )
  const duplicateMenu = (
    item: ScenarioSummary,
    level: 'system' | 'organization',
    toExercise = true,
  ) => {
    const library = { source: level, id: item.id, name: item.name, languages: item.languages }
    return (
      <DuplicateMenu
        label={t('templates.scenarios.duplicateLabel', { name: item.name })}
        toOrganization={t('templates.actors.toOrganization')}
        toExercise={t('templates.scenarios.replaceExercise')}
        newExercise={
          permissions.toExercise && toExercise
            ? {
                label: t('templates.scenarios.toNewExercise'),
                onPick: () => setApplying({ replace: false, library }),
              }
            : undefined
        }
        showOrganization={permissions.toOrganization}
        showExercise={permissions.toExercise && toExercise && ttxId !== null}
        languages={level === 'system' ? item.languages : undefined}
        onPick={(target, language) =>
          target === 'exercise'
            ? setApplying({ replace: true, library })
            : void duplicateToOrganization(
                level === 'system'
                  ? { system_id: item.id, ...(language ? { language } : {}) }
                  : { organization_scenario_id: item.id },
              )
        }
      />
    )
  }

  function systemTab() {
    const all = system.data?.items ?? []
    const items = all.filter(keep)
    return (
      <Panel
        title={t('templates.levels.system')}
        description={
          <HelpText
            id="templates.scenarios.systemDescription"
            text={t('templates.scenarios.systemDescription')}
          />
        }
        aside={system.data ? <LibraryAside count={count(items.length)} /> : undefined}
        flush
      >
        {all.length > 0 && filterBar}
        {system.data && all.length === 0 ? (
          <p className={libraryEmptyClass}>{t('templates.scenarios.systemEmpty')}</p>
        ) : system.data && items.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head()}
              <tbody className={panelTbody}>
                {items.map((item) => (
                  <tr key={item.id} className={panelTr}>
                    {cells(item)}
                    <td className={panelTd}>
                      <div className={libraryActionsCellClass}>
                        <ViewButton
                          label={t('templates.scenarios.viewLabel', { name: item.name })}
                          onClick={() => setViewing(`/scenario-catalog/${item.id}`)}
                        />
                        {duplicateMenu(item, 'system')}
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

  function organizationTab() {
    const forbidden = organization.error instanceof ApiError && organization.error.status === 403
    const all = organization.data?.items ?? []
    const items = all.filter(keep)
    const manage = permissions.manageOrganization
    return (
      <Panel
        title={t('templates.levels.organization')}
        description={
          <HelpText
            id="templates.scenarios.organizationDescription"
            text={t('templates.scenarios.organizationDescription')}
          />
        }
        aside={
          forbidden ? undefined : (
            <LibraryAside
              count={organization.data ? count(items.length) : undefined}
              action={
                manage && (
                  <span className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setImporting(true)}
                      className={btnSecondary}
                    >
                      {t('templates.scenarios.import')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFromExercise(true)}
                      className={btnSecondary}
                    >
                      <span aria-hidden="true">+ </span>
                      {t('templates.scenarios.fromExercise')}
                    </button>
                  </span>
                )
              }
            />
          )
        }
        flush
      >
        {!forbidden && all.length > 0 && filterBar}
        {forbidden ? (
          <p className={libraryEmptyClass}>{t('templates.scenarios.organizationForbidden')}</p>
        ) : organization.data && all.length === 0 ? (
          <p className={libraryEmptyClass}>{t('templates.scenarios.organizationEmpty')}</p>
        ) : organization.data && items.length === 0 ? (
          <LibraryNoMatches active={filter.active} onClear={filter.clear} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              {head([t('templates.actors.columns.origin')])}
              <tbody className={panelTbody}>
                {items.map((item) => {
                  const url = `${collection}/${item.id}`
                  return (
                    <tr key={item.id} className={panelTr}>
                      {cells(item)}
                      <td className={panelTd}>
                        <span className="flex flex-wrap gap-1">
                          <ActorOriginBadge origin={item.origin} kind="scenarios" />
                          <DisabledBadge item={item} />
                        </span>
                      </td>
                      <td className={panelTd}>
                        <div className={libraryActionsCellClass}>
                          {manage ? (
                            <EditButton
                              label={t('templates.scenarios.editLabel', { name: item.name })}
                              onClick={() => setEditing(item)}
                            />
                          ) : (
                            <ViewButton
                              label={t('templates.scenarios.viewLabel', { name: item.name })}
                              onClick={() => setViewing(url)}
                            />
                          )}
                          {duplicateMenu(item, 'organization', !item.disabled_at)}
                          {manage && (
                            <>
                              {exportLink(`${url}/export`, item.name)}
                              <EnableButton
                                item={item}
                                url={url}
                                name={item.name}
                                onDone={organization.refetch}
                              />
                              <IconButton
                                label={t('templates.scenarios.deleteLabel', { name: item.name })}
                                onClick={() => setDeleting(item)}
                              />
                            </>
                          )}
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

  function exerciseTab() {
    const data = exercise.data
    const name =
      (activeTtx?.id === ttxId ? activeTtx?.name : ttxList.find((ttx) => ttx.id === ttxId)?.name) ??
      ''
    const exportUrl = `/ttx/${ttxId}/scenario/export`
    return (
      <Panel
        title={name || t('templates.levels.exercise')}
        description={t('templates.scenarios.exerciseDescription')}
      >
        {exercise.error ? (
          <p className="text-sm text-danger-fg" role="alert">
            {exercise.error.message}
          </p>
        ) : data ? (
          <div className="space-y-6">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {SCENARIO_COUNT_KEYS.map((key) => (
                <div key={key}>
                  <dt className="text-xs text-paper-ink/60 dark:text-fg-faint">
                    {t(`templates.scenarios.counts.${key}`)}
                  </dt>
                  <dd className="text-lg font-semibold tabular-nums">{data[key]}</dd>
                </div>
              ))}
            </dl>

            <div className="grid gap-6 border-t border-panel-line pt-5 lg:grid-cols-2">
              <section aria-labelledby="scenario-copy-heading" className="space-y-3">
                <h3 id="scenario-copy-heading" className={actionHeadingClass}>
                  {t('templates.scenarios.copyHeading')}
                </h3>
                <p className={actionTextClass}>
                  {t('templates.scenarios.copyIntro', { exercise: name })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={`${API_BASE}${exportUrl}`}
                    download
                    onClick={download(exportUrl)}
                    className={`${btnSecondary} inline-flex items-center gap-1.5`}
                  >
                    <DownloadIcon />
                    {t('templates.scenarios.exportExercise')}
                  </a>
                  {permissions.saveToOrganization && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveExerciseToOrganization()}
                      className={btnSecondary}
                    >
                      {t('templates.scenarios.saveToOrganization')}
                    </button>
                  )}
                </div>
              </section>

              <section aria-labelledby="scenario-bring-heading" className="space-y-4">
                <h3 id="scenario-bring-heading" className={actionHeadingClass}>
                  {t('templates.scenarios.bringHeading')}
                </h3>
                <div className="space-y-2">
                  <p className={actionTextClass}>
                    <span className="font-medium">{t('templates.scenarios.newHeading')}.</span>{' '}
                    {t('templates.scenarios.newIntro', { exercise: name })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setApplying({ replace: false })}
                    className={btnSecondary}
                  >
                    {t('templates.scenarios.newFromFile')}
                  </button>
                </div>
                <div className="space-y-2">
                  <p className={actionTextClass}>
                    <span className="font-medium">{t('templates.scenarios.replaceHeading')}.</span>{' '}
                    {data.played
                      ? t('templates.scenarios.playedNote')
                      : t('templates.scenarios.replaceIntro', { exercise: name })}
                  </p>
                  <button
                    type="button"
                    disabled={data.played}
                    onClick={() => setApplying({ replace: true })}
                    className={btnDangerGhost}
                  >
                    {t('templates.scenarios.importExercise')}
                  </button>
                </div>
                <p className={actionTextClass}>
                  {t('templates.scenarios.fromLibrary')}{' '}
                  <button type="button" onClick={() => setTab('system')} className={linkAccent}>
                    {t('templates.levels.system')}
                  </button>{' '}
                  {t('templates.scenarios.fromLibraryOr')}{' '}
                  <button
                    type="button"
                    onClick={() => setTab('organization')}
                    className={linkAccent}
                  >
                    {t('templates.levels.organization')}
                  </button>
                  .
                </p>
              </section>
            </div>
          </div>
        ) : (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted" role="status">
            {t('templates.scenarios.loading')}
          </p>
        )}
      </Panel>
    )
  }

  return (
    <div className="space-y-4">
      <LibraryLevelSwitch levels={tabs} value={tab} onChange={setTab} />

      {tab === 'system' && systemTab()}
      {tab === 'organization' && organizationTab()}
      {tab === 'exercise' && ttxId && exerciseTab()}

      {viewing && <ScenarioViewDialog url={viewing} onClose={() => setViewing(null)} />}
      {editing && (
        <ScenarioEditDialog
          url={`${collection}/${editing.id}`}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            organization.refetch()
          }}
        />
      )}
      {deleting && (
        <LibraryDeleteDialog
          titleId="scenario-delete-title"
          title={t('templates.scenarios.deleteTitle', { name: deleting.name })}
          name={deleting.name}
          url={`${collection}/${deleting.id}`}
          usage
          warning={t('templates.scenarios.deleteWarning')}
          deletedMessage={t('templates.scenarios.deleted', { name: deleting.name })}
          onClose={() => setDeleting(null)}
          onDone={() => {
            setDeleting(null)
            organization.refetch()
          }}
        />
      )}
      {applying && (
        <ScenarioApplyDialog
          organizationId={organizationId}
          ttxId={applying.replace ? ttxId : null}
          contextTtxId={ttxId}
          library={applying.library}
          onClose={() => setApplying(null)}
        />
      )}
      {importing && (
        <ScenarioImportDialog
          organizationId={organizationId}
          onClose={() => setImporting(false)}
          onImported={() => {
            setImporting(false)
            organization.refetch()
          }}
        />
      )}
      {fromExercise && (
        <ScenarioFromExerciseDialog
          organizationId={organizationId}
          onClose={() => setFromExercise(false)}
          onCreated={() => {
            setFromExercise(false)
            organization.refetch()
          }}
        />
      )}
    </div>
  )
}
