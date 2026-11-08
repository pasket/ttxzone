import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary } from '../../lib/buttonStyles'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { IconButton } from '../common/IconButton'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { TableToolbar } from '../common/TableToolbar'
import { ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type {
  SortBy,
  SortDir,
  TTXAccessRequestListResponse,
  TTXAccessRequestRead,
  TTXLeaveRequest,
} from '../../lib/types'
import { LeaveRequestsPanel } from './LeaveRequestsPanel'
import { PlayersTabs } from './PlayersTabs'

const PAGE_SIZE = 10

export function CreatorAccessRequestsSection() {
  const { t } = useTranslation()
  const { activeTtxId } = useAuth()
  const { showToast } = useToast()
  const runUndoable = useUndoableAction()

  const [requests, setRequests] = useState<TTXAccessRequestRead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState()
  usePageFallback({ total, pageSize: PAGE_SIZE, ready: !loading })
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<TTXLeaveRequest[] | null>(null)

  useEffect(() => {
    if (!activeTtxId) return
    let cancelled = false
    apiFetch<TTXLeaveRequest[]>(`/ttx/${activeTtxId}/leave-requests`).then(
      (data) => {
        if (!cancelled) setLeaveRequests(data)
      },
      () => {
        if (!cancelled) setLeaveRequests([])
      },
    )
    return () => {
      cancelled = true
    }
  }, [activeTtxId])

  useEffect(() => {
    if (!activeTtxId) return
    let cancelled = false
    async function loadRequests() {
      setLoading(true)
      try {
        const offset = (page - 1) * PAGE_SIZE
        const data = await apiFetch<TTXAccessRequestListResponse>(
          `/ttx/${activeTtxId}/access-requests?limit=${PAGE_SIZE}&offset=${offset}&sort_dir=${sortDir}&sort_by=${sortBy}&q=${encodeURIComponent(search)}`,
        )
        if (!cancelled) {
          setRequests(data.items)
          setTotal(data.total)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void loadRequests()
    return () => {
      cancelled = true
    }
  }, [activeTtxId, page, sortDir, sortBy, search])

  function handleSortDirChange(newSortDir: SortDir) {
    setSortDir(newSortDir)
  }

  function handleSortByChange(newSortBy: SortBy) {
    setSortBy(newSortBy)
  }

  function handleSearchChange(newSearch: string) {
    setSearch(newSearch)
  }

  async function handleApprove(requestId: string) {
    if (!activeTtxId) return
    setError(null)
    setDecidingId(requestId)
    try {
      await apiFetch(`/ttx/${activeTtxId}/access-requests/${requestId}/approve`, {
        method: 'POST',
      })
      setRequests((prev) => prev.filter((item) => item.id !== requestId))
      setTotal((prev) => prev - 1)
      showToast(t('common.toast.savedSuccess'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setDecidingId(null)
    }
  }

  function handleReject(item: TTXAccessRequestRead) {
    if (!activeTtxId) return
    const index = requests.findIndex((r) => r.id === item.id)
    function restore() {
      setRequests((prev) => {
        const next = [...prev]
        next.splice(index, 0, item)
        return next
      })
      setTotal((prev) => prev + 1)
    }
    runUndoable({
      message: t('creator.accessRequests.rejectedToast'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => {
        setRequests((prev) => prev.filter((r) => r.id !== item.id))
        setTotal((prev) => prev - 1)
      },
      onRestore: restore,
      onCommit: async () => {
        try {
          await apiFetch(`/ttx/${activeTtxId}/access-requests/${item.id}/reject`, {
            method: 'POST',
          })
        } catch (err) {
          restore()
          showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
            variant: 'error',
          })
        }
      },
    })
  }

  if (activeTtxId === null) {
    return (
      <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
        {t('creator.invitations.noTtxMessage')}
      </p>
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-4">
      {/* A search narrows `total`: the tab then counts on its own. */}
      <PlayersTabs
        pendingCount={
          loading || search || leaveRequests === null ? undefined : total + leaveRequests.length
        }
      />
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <Panel
        label={t('creator.accessRequests.title')}
        meta={loading ? undefined : t('creator.accessRequests.count', { count: total })}
        aside={
          <TableToolbar
            sortDir={sortDir}
            sortBy={sortBy}
            onSortDirChange={handleSortDirChange}
            onSortByChange={handleSortByChange}
            search={search}
            onSearchChange={handleSearchChange}
            sortLabels={{ created_at: t('common.toolbar.sortFields.requested_at') }}
          />
        }
        footer={
          totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          ) : undefined
        }
        flush
      >
        {!loading && requests.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {search
              ? t('common.toolbar.noSearchResults', { query: search })
              : t('creator.accessRequests.noRequestsMessage')}
          </p>
        )}
        {requests.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th className={panelTh}>{t('creator.accessRequests.columnUser')}</th>
                  <th className={panelTh}>{t('creator.accessRequests.columnRole')}</th>
                  <th className={`${panelTh} text-right`}>{t('common.table.actions')}</th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {requests.map((item) => (
                  <tr key={item.id} aria-busy={decidingId === item.id} className={panelTr}>
                    <td className={panelTd}>
                      <span className="font-semibold text-paper-ink dark:text-fg">
                        {item.user.full_name}
                      </span>{' '}
                      <span className="text-xs text-paper-ink/60 dark:text-fg-muted">
                        {item.user.email}
                      </span>
                      {!item.is_allowed_domain && (
                        <span
                          title={t('creator.accessRequests.domainNotAllowedHint')}
                          className="ml-2 rounded-full bg-danger/10 px-2 py-0.5 text-xs font-medium text-danger-fg"
                        >
                          {t('creator.accessRequests.domainNotAllowedHint')}
                        </span>
                      )}
                    </td>
                    <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                      {t(ROLE_LABEL_KEYS[item.role as keyof typeof ROLE_LABEL_KEYS])}
                      {item.token_description && ` · ${item.token_description}`}
                    </td>
                    <td className={panelTd}>
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApprove(item.id)}
                          // Backend rejects this with DOMAIN_NOT_ALLOWED anyway;
                          // disable up front so the only way forward is Reject
                          // or allowlisting the domain first.
                          disabled={decidingId === item.id || !item.is_allowed_domain}
                          title={
                            item.is_allowed_domain
                              ? undefined
                              : t('creator.accessRequests.domainNotAllowedHint')
                          }
                          className={btnPrimary}
                        >
                          {decidingId === item.id ? (
                            <ButtonSpinner />
                          ) : (
                            t('creator.accessRequests.approveButton')
                          )}
                        </button>
                        <IconButton
                          onClick={() => handleReject(item)}
                          disabled={decidingId === item.id}
                          label={t('creator.accessRequests.rejectButton')}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {leaveRequests && (
        <LeaveRequestsPanel
          ttxId={activeTtxId}
          requests={leaveRequests}
          setRequests={(update) => setLeaveRequests((prev) => update(prev ?? []))}
        />
      )}
    </div>
  )
}
