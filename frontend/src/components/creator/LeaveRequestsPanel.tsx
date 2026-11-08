import { useTranslation } from 'react-i18next'
import { useState } from 'react'

import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary } from '../../lib/buttonStyles'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import type { TTXLeaveRequest } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'

/** Creator -> Players -> Pending: Players asking to leave the exercise.
 * Approve takes the Player out (as Confirmed's remove does); reject keeps
 * them in. Rendered only while there is one. */
export function LeaveRequestsPanel({
  ttxId,
  requests,
  setRequests,
}: {
  ttxId: string
  requests: TTXLeaveRequest[]
  setRequests: (update: (prev: TTXLeaveRequest[]) => TTXLeaveRequest[]) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const runUndoable = useUndoableAction()
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function approve(id: string) {
    setError(null)
    setDecidingId(id)
    try {
      await apiFetch(`/ttx/${ttxId}/leave-requests/${id}/approve`, { method: 'POST' })
      setRequests((prev) => prev.filter((item) => item.id !== id))
      showToast(t('creator.leaveRequests.approvedToast'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setDecidingId(null)
    }
  }

  function reject(item: TTXLeaveRequest) {
    const index = requests.findIndex((r) => r.id === item.id)
    function restore() {
      setRequests((prev) => {
        const next = [...prev]
        next.splice(index, 0, item)
        return next
      })
    }
    runUndoable({
      message: t('creator.accessRequests.rejectedToast'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setRequests((prev) => prev.filter((r) => r.id !== item.id)),
      onRestore: restore,
      onCommit: async () => {
        try {
          await apiFetch(`/ttx/${ttxId}/leave-requests/${item.id}/reject`, { method: 'POST' })
        } catch (err) {
          restore()
          showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
            variant: 'error',
          })
        }
      },
    })
  }

  if (requests.length === 0) return null
  return (
    <Panel
      title={t('creator.leaveRequests.title')}
      meta={t('creator.leaveRequests.count', { count: requests.length })}
      description={t('creator.leaveRequests.description')}
      flush
    >
      {error && (
        <p className="px-5 pt-3 text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className={panelTableHeadRow}>
              <th className={panelTh}>{t('creator.leaveRequests.columnPlayer')}</th>
              <th className={panelTh}>{t('creator.leaveRequests.columnReason')}</th>
              <th className={`${panelTh} text-right`}>{t('common.table.actions')}</th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {requests.map((item) => (
              <tr key={item.id} aria-busy={decidingId === item.id} className={panelTr}>
                <td className={panelTd}>
                  <span className="font-semibold text-paper-ink dark:text-fg">
                    {item.full_name}
                  </span>{' '}
                  <span className="text-xs text-paper-ink/60 dark:text-fg-muted">{item.email}</span>
                </td>
                <td className={`${panelTd} text-sm text-paper-ink/70 dark:text-fg-muted`}>
                  {item.reason || '—'}
                </td>
                <td className={panelTd}>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => void approve(item.id)}
                      disabled={decidingId === item.id}
                      className={btnPrimary}
                    >
                      {decidingId === item.id ? (
                        <ButtonSpinner />
                      ) : (
                        t('creator.accessRequests.approveButton')
                      )}
                    </button>
                    <IconButton
                      onClick={() => reject(item)}
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
    </Panel>
  )
}
