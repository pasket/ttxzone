import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { ApiError, apiFetch } from '../../lib/api'
import { btnSecondary, inputBase } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'

/** Preferences: the account's own name, corrected by its owner. Save
 * shows once it differs from the one on record. */
export function NameField() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  // What is being typed; null while it shows the name on record.
  const [typed, setTyped] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = user?.full_name ?? ''
  const value = typed ?? current
  const changed = value.trim() !== current

  async function save() {
    setBusy(true)
    setError(null)
    try {
      await apiFetch('/auth/name', {
        method: 'PUT',
        body: JSON.stringify({ full_name: value.trim() }),
      })
      await refresh()
      setTyped(null)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        if (changed && value.trim()) void save()
      }}
      className="space-y-1"
    >
      <div className="flex items-center justify-between gap-4">
        <label htmlFor="settings-name" className="text-sm text-paper-ink dark:text-fg">
          {t('account.settings.nameLabel')}
        </label>
        <div className="flex min-w-0 items-center gap-2">
          <input
            name="name"
            id="settings-name"
            autoComplete="name"
            maxLength={255}
            value={value}
            onChange={(e) => {
              setTyped(e.target.value)
              setSaved(false)
            }}
            aria-describedby="settings-name-status"
            className={`${inputBase} max-w-[16rem] min-w-0`}
          />
          {changed && (
            <button type="submit" disabled={busy || !value.trim()} className={btnSecondary}>
              {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
            </button>
          )}
        </div>
      </div>
      <p
        id="settings-name-status"
        role="status"
        className={`text-right text-xs ${error ? 'text-danger-fg' : 'text-paper-ink/60 dark:text-fg-muted'}`}
      >
        {error ?? (saved ? t('account.settings.nameSaved') : t('account.settings.nameHint'))}
      </p>
    </form>
  )
}
