import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { apiFetch, ApiError } from '../../lib/api'
import {
  actionsCellClass,
  btnNeutralIconGhost,
  btnPrimary,
  inputBase,
  inputDisabled,
} from '../../lib/buttonStyles'
import {
  panelActionsTh,
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { TableToolbar } from '../common/TableToolbar'
import { ttxOptionsForModule } from '../../lib/moduleAccess'
import { LeaveRequestDialog } from './LeaveRequestDialog'
import type {
  InvitationTokenRedeemResponse,
  MyAccessRequestListResponse,
  MyLeaveRequest,
  SortBy,
  SortDir,
} from '../../lib/types'

const PAGE_SIZE = 10

/** Both lists on this screen are already fully loaded client-side (pending
 * requests come from a status-filtered subset of the user's own requests;
 * enrolled TTX come from AuthContext's already-fetched ttxList) -- there's
 * no per-list backend endpoint to paginate/sort server-side the way the
 * other screens' real list endpoints do, so sort+paginate happens here, in
 * memory, over data that's already in hand. */
function sortByDate<T extends { created_at: string }>(items: T[], sortDir: SortDir): T[] {
  const sorted = [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )
  return sortDir === 'desc' ? sorted.reverse() : sorted
}

function sortByName<T extends { name?: string; ttx_name?: string }>(
  items: T[],
  sortDir: SortDir,
): T[] {
  const key = (item: T) => (item.name ?? item.ttx_name ?? '').toLowerCase()
  const sorted = [...items].sort((a, b) => key(a).localeCompare(key(b)))
  return sortDir === 'desc' ? sorted.reverse() : sorted
}

function paginate<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
}

export function EnrollmentsSection() {
  const { t } = useTranslation()
  const { ttxList, refresh } = useAuth()
  const { showToast } = useToast()
  // A Player doesn't leave on their own: they ask, and the exercise's
  // Planners decide. The exercises they've asked to leave, by id.
  const [leaveRequests, setLeaveRequests] = useState<Map<string, MyLeaveRequest>>(new Map())
  const [askingToLeave, setAskingToLeave] = useState<{ id: string; name: string } | null>(null)

  const enrolled = ttxOptionsForModule('playground', ttxList).filter((ttx) => ttx.role === 'player')
  const {
    page: enrolledPage,
    setPage: setEnrolledPage,
    sortDir: enrolledSortDir,
    setSortDir: setEnrolledSortDir,
    sortBy: enrolledSortBy,
    setSortBy: setEnrolledSortBy,
    search: enrolledSearch,
    setSearch: setEnrolledSearch,
  } = useTableUrlState('enrolled_')

  const [requests, setRequests] = useState<MyAccessRequestListResponse['items']>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const {
    page: pendingPage,
    setPage: setPendingPage,
    sortDir: pendingSortDir,
    setSortDir: setPendingSortDir,
    sortBy: pendingSortBy,
    setSortBy: setPendingSortBy,
    search: pendingSearch,
    setSearch: setPendingSearch,
  } = useTableUrlState('pending_')

  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadRequests() {
      try {
        const [data, leaving] = await Promise.all([
          apiFetch<MyAccessRequestListResponse>('/access-requests/me'),
          apiFetch<MyLeaveRequest[]>('/leave-requests/me'),
        ])
        if (!cancelled) {
          setRequests(data.items)
          setLeaveRequests(new Map(leaving.map((request) => [request.ttx_id, request])))
        }
      } finally {
        if (!cancelled) setLoadingRequests(false)
      }
    }
    void loadRequests()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleJoin(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch<InvitationTokenRedeemResponse>('/invitation-tokens/redeem', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      setToken('')
      await refresh()
      const data = await apiFetch<MyAccessRequestListResponse>('/access-requests/me')
      setRequests(data.items)
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  function handleLeaveRequested(request: MyLeaveRequest) {
    setLeaveRequests((prev) => new Map(prev).set(request.ttx_id, request))
    setAskingToLeave(null)
    showToast(t('execution.enrollments.leaveRequest.sentToast'))
  }

  // pendingRequestsRaw (status-filtered only) decides whether the whole
  // "Pending requests" section exists at all -- unaffected by search, so a
  // search matching nothing doesn't make an otherwise-nonempty section
  // vanish along with its own toolbar (the user needs the toolbar visible
  // to clear the search). pendingRequests (raw + search-filtered) is what
  // actually gets sorted/paginated/shown inside that section.
  const pendingRequestsRaw = requests.filter((r) => r.status === 'pending')
  const pendingRequests = pendingRequestsRaw.filter((r) =>
    r.ttx_name.toLowerCase().includes(pendingSearch.toLowerCase()),
  )
  const pendingPageItems = paginate(
    pendingSortBy === 'name'
      ? sortByName(pendingRequests, pendingSortDir)
      : sortByDate(pendingRequests, pendingSortDir),
    pendingPage,
  )
  const pendingTotalPages = Math.ceil(pendingRequests.length / PAGE_SIZE)

  // Same split for the enrolled list: `enrolled` (unfiltered) still decides
  // the "you haven't joined anything" empty state; `enrolledFiltered` is
  // what's actually sorted/paginated/shown.
  const enrolledFiltered = enrolled.filter((ttx) =>
    ttx.name.toLowerCase().includes(enrolledSearch.toLowerCase()),
  )
  const enrolledSorted = paginate(
    enrolledSortBy === 'name'
      ? sortByName(enrolledFiltered, enrolledSortDir)
      : sortByDate(enrolledFiltered, enrolledSortDir),
    enrolledPage,
  )
  const enrolledTotalPages = Math.ceil(enrolledFiltered.length / PAGE_SIZE)
  usePageFallback({
    prefix: 'pending_',
    total: pendingRequests.length,
    pageSize: PAGE_SIZE,
    ready: !loadingRequests,
  })
  // ttxList comes from the auth snapshot, already loaded by the time this
  // screen renders.
  usePageFallback({
    prefix: 'enrolled_',
    total: enrolledFiltered.length,
    pageSize: PAGE_SIZE,
    ready: true,
  })

  function handlePendingSortChange(newSortDir: SortDir) {
    setPendingSortDir(newSortDir)
  }

  function handlePendingSortByChange(newSortBy: SortBy) {
    setPendingSortBy(newSortBy)
  }

  function handlePendingSearchChange(newSearch: string) {
    setPendingSearch(newSearch)
  }

  function handleEnrolledSortChange(newSortDir: SortDir) {
    setEnrolledSortDir(newSortDir)
  }

  function handleEnrolledSortByChange(newSortBy: SortBy) {
    setEnrolledSortBy(newSortBy)
  }

  function handleEnrolledSearchChange(newSearch: string) {
    setEnrolledSearch(newSearch)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleJoin}>
        <Panel
          title={t('execution.enrollments.joinTitle')}
          footer={
            <div className={panelFormActions}>
              <button type="submit" disabled={submitting} className={btnPrimary}>
                {submitting ? <ButtonSpinner /> : t('execution.enrollments.joinSubmit')}
              </button>
            </div>
          }
        >
          <div className="max-w-sm space-y-2">
            <label className="block text-sm" htmlFor="enrollments-token">
              {t('execution.enrollments.tokenLabel')}
            </label>
            <input
              spellCheck={false}
              autoComplete="off"
              id="enrollments-token"
              name="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={submitting}
              className={submitting ? inputDisabled : inputBase}
              required
            />
            {error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error}
              </p>
            )}
          </div>
        </Panel>
      </form>

      {!loadingRequests && pendingRequestsRaw.length > 0 && (
        <Panel
          title={t('execution.enrollments.pendingTitle')}
          aside={
            <TableToolbar
              sortDir={pendingSortDir}
              sortBy={pendingSortBy}
              onSortDirChange={handlePendingSortChange}
              onSortByChange={handlePendingSortByChange}
              search={pendingSearch}
              onSearchChange={handlePendingSearchChange}
              sortLabels={{ created_at: t('common.toolbar.sortFields.requested_at') }}
            />
          }
          footer={
            pendingTotalPages > 1 ? (
              <Pagination
                page={pendingPage}
                totalPages={pendingTotalPages}
                onPageChange={setPendingPage}
              />
            ) : undefined
          }
          flush
        >
          {pendingRequests.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('common.toolbar.noSearchResults', { query: pendingSearch })}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className={panelTableHeadRow}>
                    <th className={panelTh}>{t('execution.enrollments.columnExercise')}</th>
                    <th className={panelTh}>{t('execution.enrollments.columnOrganization')}</th>
                  </tr>
                </thead>
                <tbody className={panelTbody}>
                  {pendingPageItems.map((item) => (
                    <tr key={item.id} className={panelTr}>
                      <td className={panelTd}>
                        <span className="font-semibold text-paper-ink dark:text-fg">
                          {item.ttx_name}
                        </span>
                      </td>
                      <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                        {t('execution.enrollments.pendingFor', {
                          organizationName: item.organization_domain
                            ? `${item.organization_name} (${item.organization_domain})`
                            : item.organization_name,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      <Panel
        title={t('execution.enrollments.enrolledTitle')}
        aside={
          enrolled.length > 0 ? (
            <TableToolbar
              sortDir={enrolledSortDir}
              sortBy={enrolledSortBy}
              onSortDirChange={handleEnrolledSortChange}
              onSortByChange={handleEnrolledSortByChange}
              search={enrolledSearch}
              onSearchChange={handleEnrolledSearchChange}
            />
          ) : undefined
        }
        footer={
          enrolledTotalPages > 1 ? (
            <Pagination
              page={enrolledPage}
              totalPages={enrolledTotalPages}
              onPageChange={setEnrolledPage}
            />
          ) : undefined
        }
        flush
      >
        {enrolled.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('execution.enrollments.noEnrollmentsMessage')}
          </p>
        )}
        {enrolled.length > 0 && enrolledFiltered.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('common.toolbar.noSearchResults', { query: enrolledSearch })}
          </p>
        )}
        {enrolledFiltered.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('execution.enrollments.columnName')}</th>
                  <th className={panelActionsTh}>{t('common.table.actions')}</th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {enrolledSorted.map((ttx) => (
                  <tr key={ttx.id} className={panelTr}>
                    <td className={panelTd}>
                      <span className="font-semibold text-paper-ink dark:text-fg">{ttx.name}</span>
                      {ttx.description && (
                        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                          {ttx.description}
                        </p>
                      )}
                    </td>
                    <td className={panelTd}>
                      <div className={actionsCellClass}>
                        {leaveRequests.has(ttx.id) ? (
                          <span className="text-sm whitespace-nowrap text-paper-ink/70 dark:text-fg-muted">
                            {t('execution.enrollments.leaveRequest.pending')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setAskingToLeave({ id: ttx.id, name: ttx.name })}
                            aria-label={t('execution.enrollments.leaveButton')}
                            title={t('execution.enrollments.leaveButton')}
                            className={btnNeutralIconGhost}
                          >
                            <ExitIcon />
                          </button>
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
      {askingToLeave && (
        <LeaveRequestDialog
          ttxId={askingToLeave.id}
          ttxName={askingToLeave.name}
          onClose={() => setAskingToLeave(null)}
          onSent={handleLeaveRequested}
        />
      )}
    </div>
  )
}

/** A door with an arrow out: asking to leave. */
function ExitIcon() {
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
      <path d="M14 4H6v16h8M10 12h10M17 9l3 3-3 3" />
    </svg>
  )
}
