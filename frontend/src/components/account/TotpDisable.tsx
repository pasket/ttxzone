import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch, ApiError } from '../../lib/api'
import { btnDanger, inputBase } from '../../lib/buttonStyles'
import { useAuth } from '../../hooks/useAuth'

export function TotpDisable() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  // No password (single sign-on only): the step-up went through the provider.
  const withPassword = user?.has_password !== false

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/totp/disable', {
        method: 'POST',
        body: JSON.stringify({ password: withPassword ? password : null }),
      })
      await refresh()
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return <p className="text-sm text-paper-ink/60 dark:text-fg-muted">{t('auth.totp.disabled')}</p>
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-2">
      {withPassword && (
        <>
          <label className="block text-sm" htmlFor="totp-disable-password">
            {t('auth.totp.disablePasswordLabel')}
          </label>
          <input
            id="totp-disable-password"
            name="current-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputBase}
            required
          />
        </>
      )}
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} className={`w-full ${btnDanger}`}>
        {t('auth.totp.disableButton')}
      </button>
    </form>
  )
}
