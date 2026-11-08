import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'

/** Shown after signing up while the deployment sends email, until the
 * address is confirmed -- or past the periodic reconfirmation's grace
 * period, until it's confirmed again: the API answers only the account
 * itself (EMAIL_VERIFICATION_REQUIRED / EMAIL_RECONFIRMATION_REQUIRED
 * elsewhere), so the ways out are the link in the email, asking for
 * another, or signing out. */
export function EmailVerificationGate() {
  const { t } = useTranslation()
  const { user, refresh, logout } = useAuth()
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [checking, setChecking] = useState(false)
  // Held by the periodic reconfirmation rather than at signup.
  const reconfirming = user?.email_reconfirmation_overdue === true

  // Confirmed from another tab or device: coming back here moves on.
  useEffect(() => {
    function onFocus() {
      void refresh()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [refresh])

  async function resend() {
    setSending(true)
    setNotice(null)
    setError(null)
    try {
      await apiFetch('/auth/email/verification', { method: 'POST' })
      setNotice(t('auth.verifyEmail.resent'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSending(false)
    }
  }

  async function confirmed() {
    setChecking(true)
    setNotice(null)
    // Confirmed: the route guard moves on by itself. Still here: not yet.
    await refresh()
    setChecking(false)
    setNotice(t('auth.verifyEmail.notYet'))
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t(reconfirming ? 'auth.reconfirmEmail.gateTitle' : 'auth.verifyEmail.gateTitle')}
        </h1>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t(reconfirming ? 'auth.reconfirmEmail.gateIntro' : 'auth.verifyEmail.gateIntro', {
            email: user?.email ?? '',
          })}
        </p>
      </div>
      {notice && (
        <p role="status" className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={() => void confirmed()}
        disabled={checking}
        className={`w-full ${btnPrimary}`}
      >
        {checking ? <ButtonSpinner /> : t('auth.verifyEmail.confirmed')}
      </button>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={sending}
          className={btnSecondary}
        >
          {sending ? <ButtonSpinner /> : t('auth.verifyEmail.resend')}
        </button>
        <button type="button" onClick={() => void logout()} className={btnSecondary}>
          {t('nav.logout')}
        </button>
      </div>
    </div>
  )
}
