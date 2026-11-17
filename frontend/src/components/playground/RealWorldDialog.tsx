import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, apiFetch } from '../../lib/api'
import { btnDanger, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { foldStopKeyword } from '../../lib/stopKeyword'
import type { RunRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'

/** REAL WORLD, confirmed: typing the exercise's stop keyword (case, accents
 * and spacing aside) pauses the session on every screen for a real-world event, until a
 * Controller resumes it. */
export function RealWorldDialog({
  ttxId,
  keyword,
  onClose,
  apply,
}: {
  ttxId: string
  keyword: string
  onClose: () => void
  apply: (next: RunRead) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [typed, setTyped] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const matches = foldStopKeyword(typed) === foldStopKeyword(keyword)
  // Straight to the field: in an emergency every tap counts. After Modal's
  // own focus (a child's effect runs first, this one wins).
  const fieldRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    fieldRef.current?.focus()
  }, [])

  async function submit() {
    setPending(true)
    setError(null)
    try {
      apply(
        await apiFetch<RunRead>(`/ttx/${ttxId}/run/real-world`, {
          method: 'POST',
          body: JSON.stringify({ keyword: typed }),
        }),
      )
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (matches) void submit()
        }}
        className="space-y-4"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('playground.realWorld.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.realWorld.body')}
        </p>
        <div className="space-y-1">
          <label htmlFor={`${titleId}-keyword`} className="block text-sm">
            {t('playground.realWorld.confirm', { keyword })}
          </label>
          <input
            ref={fieldRef}
            autoCapitalize="characters"
            name={`${titleId}-keyword`}
            id={`${titleId}-keyword`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            aria-describedby={`${titleId}-hint`}
            className={`${inputBase} font-mono`}
          />
          <p id={`${titleId}-hint`} className="text-xs text-paper-ink/70 dark:text-fg-muted">
            {t('playground.realWorld.hint')}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger-fg">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button type="submit" disabled={pending || !matches} className={btnDanger}>
            {pending ? <ButtonSpinner /> : t('playground.realWorld.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
