import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { linkAccent } from '../../lib/buttonStyles'

/** Opened from the "confirm your email address" email, in any browser,
 * signed in or not: the link itself proves the address. The token travels
 * in the fragment and leaves the address bar at once. */
export function VerifyEmailLink() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token'))
  const [outcome, setOutcome] = useState<'checking' | 'done' | 'invalid' | 'error'>(
    token ? 'checking' : 'invalid',
  )
  // Spending the link isn't repeatable: once, even under StrictMode.
  const started = useRef(false)

  useEffect(() => {
    if (location.hash) navigate('/verify-email', { replace: true })
  }, [location.hash, navigate])

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    apiFetch('/auth/email/verify', { method: 'POST', body: JSON.stringify({ token }) })
      .then(async () => {
        setOutcome('done')
        await refresh()
      })
      .catch((err: unknown) => {
        setOutcome(
          err instanceof ApiError && err.code === 'ACCOUNT_LINK_INVALID' ? 'invalid' : 'error',
        )
      })
  }, [token, refresh])

  if (outcome === 'checking') {
    return (
      <p role="status" className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('auth.verifyEmail.checking')}
      </p>
    )
  }

  const done = outcome === 'done'
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t(done ? 'auth.verifyEmail.doneTitle' : 'auth.accountLink.invalidTitle')}
      </h1>
      <p role="status" className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
        {t(
          done
            ? 'auth.verifyEmail.done'
            : outcome === 'invalid'
              ? 'auth.verifyEmail.invalid'
              : 'auth.common.genericError',
        )}
      </p>
      <p className="text-center text-sm">
        <Link to="/" className={linkAccent}>
          {t('auth.verifyEmail.continue')}
        </Link>
      </p>
    </div>
  )
}
