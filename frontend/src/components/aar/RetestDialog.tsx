import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { codeRefText } from '../../lib/codeRef'
import type { RetestCandidate, RetestRef } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'

const labelClass = 'block text-sm'
const muted = 'text-paper-ink/70 dark:text-fg-muted'

/** Which later exercise of the organization re-tests an improvement
 * action, and optionally which of its objectives -- or none. The choices
 * come from `candidatesPath` (code, name and objectives only); `onSave`
 * applies it at once (follow-up: it never reopens a final report). Shared
 * by the report's authors and Admin -> Improvement plan. */
export function RetestDialog({
  code,
  current,
  candidatesPath,
  onClose,
  onSave,
}: {
  code: string
  current: RetestRef | null | undefined
  candidatesPath: string
  onClose: () => void
  onSave: (ttxId: string | null, objectiveId: string | null) => Promise<void>
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [candidates, setCandidates] = useState<RetestCandidate[] | null>(null)
  const [ttxId, setTtxId] = useState(current?.ttx_id ?? '')
  const [objectiveId, setObjectiveId] = useState(current?.objective_id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<RetestCandidate[]>(candidatesPath)
      .then((result) => !cancelled && setCandidates(result))
      .catch((err) => {
        if (cancelled) return
        setCandidates([])
        setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      })
    return () => {
      cancelled = true
    }
  }, [candidatesPath, t])

  const chosen = candidates?.find((c) => c.ttx_id === ttxId)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSave(ttxId || null, (ttxId && objectiveId) || null)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setBusy(false)
    }
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full space-y-3">
        <h2 id={titleId} className="text-balance text-lg font-semibold tracking-tight">
          {t('aar.retest.title', { code })}
        </h2>
        <p className={`text-sm text-pretty ${muted}`}>{t('aar.retest.intro')}</p>
        {candidates === null ? (
          <p className={`text-sm ${muted}`}>{t('common.loading')}</p>
        ) : candidates.length === 0 && !current ? (
          <p className={`text-sm ${muted}`}>{t('aar.retest.noCandidates')}</p>
        ) : (
          <>
            <label className={labelClass} htmlFor={`${titleId}-ttx`}>
              {t('aar.retest.exercise')}
            </label>
            <select
              id={`${titleId}-ttx`}
              value={ttxId}
              onChange={(e) => {
                setTtxId(e.target.value)
                setObjectiveId('')
              }}
              className={inputBase}
            >
              <option value="">{t('aar.retest.none')}</option>
              {candidates.map((c) => (
                <option key={c.ttx_id} value={c.ttx_id}>
                  {codeRefText(c.ttx_code, c.ttx_name)}
                  {c.archived ? ` (${t('creator.exercises.archivedBadge')})` : ''}
                </option>
              ))}
            </select>
            {chosen && (
              <>
                <label className={labelClass} htmlFor={`${titleId}-objective`}>
                  {t('aar.retest.objective')}
                </label>
                <select
                  id={`${titleId}-objective`}
                  value={objectiveId}
                  onChange={(e) => setObjectiveId(e.target.value)}
                  className={inputBase}
                >
                  <option value="">{t('aar.retest.wholeExercise')}</option>
                  {chosen.objectives.map((o) => (
                    <option key={o.id} value={o.id}>
                      {codeRefText(o.code, o.title)}
                    </option>
                  ))}
                </select>
              </>
            )}
          </>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={busy || candidates === null} className={btnPrimary}>
            {busy ? <ButtonSpinner /> : t('aar.retest.save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
