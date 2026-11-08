import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useApiDownload } from '../../hooks/useApiDownload'
import { type ArchivedFilter, useArchivedFilter } from '../../hooks/useArchivedFilter'
import { useAuth } from '../../hooks/useAuth'
import { useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { API_BASE, apiFetch, ApiError } from '../../lib/api'
import {
  actionsCellClass,
  btnDanger,
  btnNeutralIconGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputCompact,
  linkAccent,
} from '../../lib/buttonStyles'
import {
  panelActionsTh,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type { TTXDuplicateResponse, TTXRead } from '../../lib/types'
import { ButtonSpinner } from './ButtonSpinner'
import { CodeRef } from './CodeRef'
import { DuplicateIcon } from './DuplicateIcon'
import { IconButton } from './IconButton'
import { Modal } from './Modal'
import { Pagination } from './Pagination'
import { Panel } from './Panel'
import { TableToolbar } from './TableToolbar'

const mutedClass = 'text-sm text-pretty text-paper-ink/70 dark:text-fg-muted'

function OpenIcon() {
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
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}

/** One page of a list the server searches, sorts and pages (the caller
 * fetches it from the same `useTableUrlState`). */
export interface ExercisePage {
  total: number
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  loading: boolean
  error: Error | null
}

/** A box with a lid: archive / unarchive. */
function ArchiveIcon() {
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
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4" />
    </svg>
  )
}

/** "Archived", next to an exercise's name: a state, in neutral. */
export function ArchivedBadge() {
  const { t } = useTranslation()
  return (
    <span className="ml-1 inline-block rounded-xs bg-hover px-1 align-middle text-xs text-paper-ink/80 dark:text-fg-muted">
      {t('creator.exercises.archivedBadge')}
    </span>
  )
}

/** A list of exercises -- code and name, needs analysis and MSEL status,
 * Lead Planner, creation date -- to open in the Creator (those `canOpen`
 * allows: the caller plans them) and delete (`can_delete`). Creator ->
 * Exercises lists the Planner's own, searched and sorted here; Admin ->
 * Exercises the whole organization's, one server `page` at a time.
 * Active ones by default, archived ones behind the filter (applied here to
 * a local list, by the caller's request to a paged one); `onArchive`
 * archives or unarchives (`can_delete`). */
export function ExerciseList({
  exercises,
  page,
  onDelete,
  onArchive,
  title,
  description,
  empty,
  canOpen = () => true,
  action,
}: {
  exercises: TTXRead[]
  page?: ExercisePage
  onDelete: (exercise: TTXRead) => void
  onArchive?: (exercise: TTXRead) => void
  title: string
  description: string
  empty: React.ReactNode
  canOpen?: (exercise: TTXRead) => boolean
  /** One more action per row, before Delete. */
  action?: (exercise: TTXRead) => React.ReactNode
}) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { setActiveTtxId } = useAuth()
  const { sortDir, setSortDir, sortBy, setSortBy, search, setSearch } = useTableUrlState()
  const [archivedFilter, setArchivedFilter] = useArchivedFilter()
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const query = search.trim().toLowerCase()
  const rows = page
    ? exercises
    : exercises
        .filter(
          (ttx) =>
            archivedFilter === 'all' || !!ttx.archived_at === (archivedFilter === 'archived'),
        )
        .filter(
          (ttx) =>
            !query || [ttx.code, ttx.name].some((text) => text.toLowerCase().includes(query)),
        )
        .sort((a, b) => {
          const order =
            sortBy === 'name'
              ? a.name.localeCompare(b.name, i18n.language)
              : a.created_at.localeCompare(b.created_at)
          return sortDir === 'asc' ? order : -order
        })
  const total = page ? page.total : rows.length
  // Searching or filtering on the server leaves no rows to tell "none yet"
  // from "no match".
  const none = page
    ? total === 0 && !query && archivedFilter === 'active' && !page.loading
    : exercises.length === 0

  function open(ttx: TTXRead) {
    setActiveTtxId(ttx.id)
    navigate(`/creator/${ttx.id}/exercise`)
  }

  return (
    <Panel
      title={title}
      meta={t('creator.exercises.count', { count: total })}
      description={description}
      aside={
        !none ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="exercise-archived-filter">
              {t('creator.exercises.archivedFilter')}
            </label>
            <select
              id="exercise-archived-filter"
              name="archived"
              value={archivedFilter}
              onChange={(e) => setArchivedFilter(e.target.value as ArchivedFilter)}
              className={`${inputCompact} w-auto text-sm`}
            >
              <option value="active">{t('creator.exercises.filterActive')}</option>
              <option value="archived">{t('creator.exercises.filterArchived')}</option>
              <option value="all">{t('creator.exercises.filterAll')}</option>
            </select>
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
            />
          </div>
        ) : undefined
      }
      footer={
        page && page.totalPages > 1 ? (
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            onPageChange={page.onPageChange}
          />
        ) : undefined
      }
      flush
    >
      {page?.error ? (
        <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
          {page.error.message}
        </p>
      ) : none ? (
        <div className="space-y-3 px-5 py-8 text-center">{empty}</div>
      ) : rows.length === 0 ? (
        <p className={`px-5 py-8 text-center ${mutedClass}`}>
          {page?.loading
            ? t('common.loading')
            : query
              ? t('creator.exercises.noMatches')
              : t('creator.exercises.noneInView')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className={panelTableHeadRow}>
                <th className={panelTh}>{t('creator.exercises.columns.exercise')}</th>
                <th className={panelTh}>{t('creator.exercises.columns.needs')}</th>
                <th className={panelTh}>{t('creator.exercises.columns.msel')}</th>
                <th className={panelTh}>{t('creator.exercises.columns.lead')}</th>
                <th className={panelTh}>{t('creator.exercises.columns.created')}</th>
                <th className={panelActionsTh}>{t('common.table.actions')}</th>
              </tr>
            </thead>
            <tbody className={panelTbody}>
              {rows.map((ttx) => (
                <tr key={ttx.id} className={panelTr}>
                  <td className={panelTd}>
                    {canOpen(ttx) ? (
                      <button
                        type="button"
                        onClick={() => open(ttx)}
                        className={`text-left text-sm ${linkAccent}`}
                      >
                        <CodeRef code={ttx.code} title={ttx.name} variant="stacked" strong wrap />
                      </button>
                    ) : (
                      <span className="text-sm">
                        <CodeRef code={ttx.code} title={ttx.name} variant="stacked" strong wrap />
                      </span>
                    )}
                    {ttx.archived_at && <ArchivedBadge />}
                  </td>
                  <td className={`${panelTd} text-sm whitespace-nowrap`}>
                    {t(`creator.needs.status.${ttx.needs_form_status}`)}
                  </td>
                  <td className={`${panelTd} text-sm whitespace-nowrap`}>
                    {ttx.msel_status ? t(`creator.msel.status.${ttx.msel_status}`) : '—'}
                  </td>
                  <td className={`${panelTd} text-sm`}>{ttx.lead_planner?.full_name ?? '—'}</td>
                  <td className={`${panelTd} text-sm whitespace-nowrap`}>
                    {dateFmt.format(new Date(ttx.created_at))}
                  </td>
                  <td className={panelTd}>
                    <div className={actionsCellClass}>
                      {canOpen(ttx) && (
                        <button
                          type="button"
                          onClick={() => open(ttx)}
                          aria-label={t('creator.exercises.openLabel', { name: ttx.name })}
                          title={t('creator.exercises.openLabel', { name: ttx.name })}
                          className={btnNeutralIconGhost}
                        >
                          <OpenIcon />
                        </button>
                      )}
                      {action?.(ttx)}
                      {onArchive && ttx.can_delete && (
                        <button
                          type="button"
                          onClick={() => onArchive(ttx)}
                          aria-label={t(
                            ttx.archived_at
                              ? 'creator.exercises.unarchiveLabel'
                              : 'creator.exercises.archiveLabel',
                            { name: ttx.name },
                          )}
                          title={t(
                            ttx.archived_at
                              ? 'creator.exercises.unarchiveLabel'
                              : 'creator.exercises.archiveLabel',
                            { name: ttx.name },
                          )}
                          className={btnNeutralIconGhost}
                        >
                          <ArchiveIcon />
                        </button>
                      )}
                      {ttx.can_delete && (
                        <IconButton
                          label={t('creator.exercises.deleteLabel', { name: ttx.name })}
                          onClick={() => onDelete(ttx)}
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

/** Delete an exercise for good: what goes, a way to keep a copy (export
 * it as a scenario), its name typed to confirm; the server asks for a
 * recent sign-in. */
export function DeleteExerciseModal({
  exercise,
  onClose,
}: {
  exercise: TTXRead
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { refresh } = useAuth()
  const download = useApiDownload()
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exportUrl = `/ttx/${exercise.id}/scenario/export`

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/ttx/${exercise.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
      })
      showToast(t('creator.exercises.deleted', { name: exercise.name }))
      await refresh()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="exercise-delete-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <h2
          id="exercise-delete-title"
          className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
        >
          {t('creator.exercises.deleteTitle', { name: exercise.name })}
        </h2>
        <p className={mutedClass}>{t('creator.exercises.deleteWarning')}</p>
        <p className={mutedClass}>
          {t('creator.exercises.exportFirst')}{' '}
          <a
            href={`${API_BASE}${exportUrl}`}
            download
            onClick={download(exportUrl)}
            className={linkAccent}
          >
            {t('creator.exercises.exportLink')}
          </a>
        </p>
        <label className="block text-sm" htmlFor="exercise-delete-confirm">
          {t('creator.exercises.confirmLabel', { name: exercise.name })}
        </label>
        <input
          name="exercise-delete-confirm"
          id="exercise-delete-confirm"
          autoComplete="off"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          placeholder={exercise.name}
          className={inputBase}
        />
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button
            type="submit"
            disabled={busy || confirmation.trim() !== exercise.name.trim()}
            className={btnDanger}
          >
            {busy ? <ButtonSpinner /> : t('creator.exercises.deleteConfirm')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** The row action that opens DuplicateExerciseModal. */
export function DuplicateExerciseButton({
  exercise,
  onDuplicate,
}: {
  exercise: TTXRead
  onDuplicate: (exercise: TTXRead) => void
}) {
  const { t } = useTranslation()
  const label = t('creator.exercises.duplicateLabel', { name: exercise.name })
  return (
    <button
      type="button"
      onClick={() => onDuplicate(exercise)}
      aria-label={label}
      title={label}
      className={btnNeutralIconGhost}
    >
      <DuplicateIcon />
    </button>
  )
}

/** Duplicate an exercise: a new one in the same organization with its
 * design and team, named here; what comes along and what doesn't is said
 * up front. The copy becomes the active exercise and opens. */
export function DuplicateExerciseModal({
  exercise,
  onClose,
}: {
  exercise: TTXRead
  onClose: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { refresh, setActiveTtxId } = useAuth()
  const [name, setName] = useState(() =>
    t('creator.exercises.duplicateDefaultName', { name: exercise.name }).slice(0, 255),
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await apiFetch<TTXDuplicateResponse>(`/ttx/${exercise.id}/duplicate`, {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), organization_id: exercise.organization_id }),
      })
      await refresh()
      setActiveTtxId(result.ttx.id)
      showToast(
        result.skipped_members.length
          ? t('creator.exercises.duplicatedSkipped', {
              name: result.ttx.name,
              people: result.skipped_members.join(', '),
            })
          : t('creator.exercises.duplicated', { name: result.ttx.name }),
      )
      onClose()
      navigate(`/creator/${result.ttx.id}/exercise`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="exercise-duplicate-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <h2
          id="exercise-duplicate-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {t('creator.exercises.duplicateTitle', { name: exercise.name })}
        </h2>
        <p className={mutedClass}>{t('creator.exercises.duplicateCopies')}</p>
        <p className={mutedClass}>{t('creator.exercises.duplicateLeaves')}</p>
        <label className="block text-sm" htmlFor="exercise-duplicate-name">
          {t('creator.exercises.duplicateNameLabel')}
        </label>
        <input
          name="exercise-duplicate-name"
          id="exercise-duplicate-name"
          autoComplete="off"
          maxLength={255}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className={inputBase}
        />
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={busy || !name.trim()} className={btnPrimary}>
            {busy ? <ButtonSpinner /> : t('creator.exercises.duplicateConfirm')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Archive an exercise (read-only, out of the default lists) or bring it
 * back -- reversible, so a plain confirmation. */
export function ArchiveExerciseModal({
  exercise,
  onClose,
}: {
  exercise: TTXRead
  onClose: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { refresh } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const archived = !!exercise.archived_at

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/ttx/${exercise.id}/${archived ? 'unarchive' : 'archive'}`, {
        method: 'POST',
      })
      showToast(
        t(archived ? 'creator.exercises.unarchived' : 'creator.exercises.archived', {
          name: exercise.name,
        }),
      )
      await refresh()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="exercise-archive-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <h2
          id="exercise-archive-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {t(archived ? 'creator.exercises.unarchiveTitle' : 'creator.exercises.archiveTitle', {
            name: exercise.name,
          })}
        </h2>
        <p className={mutedClass}>
          {t(archived ? 'creator.exercises.unarchiveBody' : 'creator.exercises.archiveBody')}
        </p>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? (
              <ButtonSpinner />
            ) : (
              t(archived ? 'creator.exercises.unarchive' : 'creator.exercises.archive')
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
