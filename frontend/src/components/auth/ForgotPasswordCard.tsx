import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { hasFinePointer } from '../../lib/pointer'
import { ButtonSpinner } from '../common/ButtonSpinner'

/** "Forgot your password?": asks for the address and says the same
 * whether or not an account uses it -- the link, if any, goes by email
 * (account_email_service). Reached from the sign-in page, which offers it
 * only while the deployment sends email. */
export function ForgotPasswordCard() {
  const { t } = useTranslation()
  const location = useLocation()
  const [email, setEmail] = useState(
    () => (location.state as { email?: string } | null)?.email ?? '',
  )
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/password/forgot', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  const backToSignIn = (
    <p className="text-center text-sm">
      <Link to="/login" className={linkAccent}>
        {t('auth.forgotPassword.backToSignIn')}
      </Link>
    </p>
  )

  if (sent) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t('auth.forgotPassword.sentTitle')}
        </h1>
        <p role="status" className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t('auth.forgotPassword.sent', { email })}
        </p>
        {backToSignIn}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t('auth.forgotPassword.title')}
        </h1>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t('auth.forgotPassword.intro')}
        </p>
      </div>
      <div className="space-y-2">
        <label className="block text-sm" htmlFor="forgot-email">
          {t('auth.login.emailLabel')}
        </label>
        <input
          spellCheck={false}
          id="forgot-email"
          name="email"
          type="email"
          autoComplete="email"
          autoFocus={hasFinePointer()}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.login.emailPlaceholder')}
          className={inputBase}
          required
        />
      </div>
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <button type="submit" disabled={submitting} className={`w-full ${btnPrimary}`}>
        {submitting ? <ButtonSpinner /> : t('auth.forgotPassword.submit')}
      </button>
      {backToSignIn}
    </form>
  )
}
