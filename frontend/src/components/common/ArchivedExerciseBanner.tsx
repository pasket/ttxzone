import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { linkAccent } from '../../lib/buttonStyles'

/** One line under the header while the exercise in the URL is archived:
 * it's read-only (the server refuses every change), with Unarchive for
 * whoever may (its Lead Planner, a Program Manager); nothing otherwise. */
export function ArchivedExerciseBanner() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { ttxList, refresh } = useAuth()
  const { ttxId } = useParams<{ ttxId?: string }>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const exercise = ttxList.find((ttx) => ttx.id === ttxId)
  if (!exercise?.archived_at) return null

  async function unarchive() {
    if (!exercise) return
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/ttx/${exercise.id}/unarchive`, { method: 'POST' })
      await refresh()
      showToast(t('creator.exercises.unarchived', { name: exercise.name }))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      className="border-b border-panel-line bg-panel px-4 py-2 text-sm text-paper-ink/80 dark:text-fg-muted"
    >
      {t('creator.exercises.archivedBanner')}{' '}
      {error ? (
        <span className="text-danger-fg">{error}</span>
      ) : (
        exercise.can_delete && (
          <button
            type="button"
            onClick={() => void unarchive()}
            disabled={busy}
            className={`underline ${linkAccent}`}
          >
            {t('creator.exercises.unarchive')}
          </button>
        )
      )}
    </div>
  )
}
