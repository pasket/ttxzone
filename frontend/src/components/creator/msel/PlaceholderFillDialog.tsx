import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useDiscardGuard } from '../../../hooks/useDiscardGuard'
import { useToast } from '../../../hooks/useToast'
import { apiFetch } from '../../../lib/api'
import { btnPrimary, btnSecondary } from '../../../lib/buttonStyles'
import type { TtxPlaceholders } from '../../../lib/scenarios'
import { ButtonSpinner } from '../../common/ButtonSpinner'
import { DiscardConfirm } from '../../common/DiscardConfirm'
import { Modal } from '../../common/Modal'
import { VariableFields } from '../../templates/VariableFields'

const mutedClass = 'text-sm text-pretty text-paper-ink/70 dark:text-fg-muted'

/** The {placeholders} a template left in the exercise (its needs analysis,
 * MSEL, cast…), each with what it stands for and where it's used, to write
 * their values throughout it at once. Blank ones stay for another time. */
export function PlaceholderFillDialog({
  ttxId,
  onClose,
  onFilled,
  initialValues = {},
}: {
  ttxId: string
  /** Values to start from (an AI proposal the person accepted): reviewed
   * here before anything is written. */
  initialValues?: Record<string, string>
  onClose: () => void
  /** The exercise's texts changed: read them again. */
  onFilled: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const guard = useDiscardGuard(onClose)
  const [found, setFound] = useState<TtxPlaceholders | null>(null)
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await apiFetch<TtxPlaceholders>(`/ttx/${ttxId}/placeholders`)
        if (!cancelled) setFound(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId])

  const variables = found?.variables ?? []
  const written = Object.values(values).filter((value) => value.trim()).length

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // Only what's still there: a proposed value for one filled since is dropped.
      const left = new Set(variables.map((variable) => variable.name))
      const kept = Object.fromEntries(Object.entries(values).filter(([name]) => left.has(name)))
      await apiFetch<TtxPlaceholders>(`/ttx/${ttxId}/placeholders/fill`, {
        method: 'POST',
        body: JSON.stringify({ variables: kept }),
      })
      showToast(t('creator.msel.leftover.filled', { count: written }))
      onFilled()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="placeholder-fill-title" onClose={guard.requestClose} size="lg" align="top">
      <form onSubmit={submit} className="space-y-4" onChange={guard.touch}>
        <h2
          id="placeholder-fill-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {t('creator.msel.leftover.dialogTitle')}
        </h2>
        {!found && !error && (
          <p className={mutedClass} role="status">
            {t('creator.msel.leftover.loading')}
          </p>
        )}
        {found && variables.length === 0 && (
          <p className={mutedClass}>{t('creator.msel.leftover.none')}</p>
        )}
        <VariableFields
          legend={t('templates.scenarios.variables.legend')}
          hint={t('creator.msel.leftover.dialogHint')}
          variables={variables.map((v) => v.name)}
          values={values}
          onChange={(next) => {
            setValues(next)
            guard.touch()
          }}
          countLabel={(name) =>
            t('templates.scenarios.variables.used', {
              count: variables.find((v) => v.name === name)?.count ?? 0,
            })
          }
          details={Object.fromEntries(variables.map((v) => [v.name, v]))}
        />
        {found?.reopens_needs && (
          <p role="note" className="text-sm text-pretty">
            {t('creator.msel.leftover.reopensNeeds')}
          </p>
        )}
        {found?.reopens_msel && (
          <p role="note" className="text-sm text-pretty">
            {t('creator.msel.leftover.reopensMsel')}
          </p>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        {guard.confirming ? (
          <DiscardConfirm onKeep={guard.keep} onDiscard={guard.discard} />
        ) : (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={guard.requestClose} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button type="submit" disabled={busy || written === 0} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('creator.msel.leftover.submit')}
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}
