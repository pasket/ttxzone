import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { useAuth } from '../../hooks/useAuth'
import type { BackupCodesResponse } from '../../lib/types'
import { BackupCodesReveal } from '../common/BackupCodesReveal'

/** Regenerating backup codes never touches totp_secret/totp_enabled --
 * unlike disable(), it's allowed regardless of the mandatory-MFA lock
 * (see AccountSettingsSecurity), since it doesn't weaken the account's
 * second factor at all. */
export function BackupCodesRegenerate() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  // No password (single sign-on only): the step-up went through the provider.
  const withPassword = user?.has_password !== false

  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await apiFetch<BackupCodesResponse>('/auth/totp/backup-codes/regenerate', {
        method: 'POST',
        body: JSON.stringify({ password: withPassword ? password : null }),
      })
      await refresh()
      setNewCodes(result.backup_codes)
      setPassword('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (newCodes !== null) {
    return (
      <BackupCodesReveal
        codes={newCodes}
        onAcknowledge={() => {
          setNewCodes(null)
          setOpen(false)
        }}
      />
    )
  }

  return (
    <div className="max-w-sm space-y-2">
      <h3 className="text-balance text-sm font-semibold text-paper-ink dark:text-fg">
        {t('account.settings.backupCodes.title')}
      </h3>
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('account.settings.backupCodes.remaining', { count: user?.backup_codes_remaining ?? 0 })}
      </p>
      {!open && (
        <button type="button" onClick={() => setOpen(true)} className={btnSecondary}>
          {t('account.settings.backupCodes.regenerateButton')}
        </button>
      )}
      {open && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {withPassword && (
            <>
              <label className="block text-sm" htmlFor="backup-codes-password">
                {t('account.settings.backupCodes.confirmPasswordLabel')}
              </label>
              <input
                id="backup-codes-password"
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
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {t('account.settings.backupCodes.regenerateButton')}
            </button>
            <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
              {t('auth.register.back')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
