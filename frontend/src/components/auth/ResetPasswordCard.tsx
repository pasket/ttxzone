import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { usePasswordMinLength } from '../../hooks/usePasswordPolicy'
import { isPasswordValid } from '../../lib/passwordPolicy'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { PasswordRequirementsList } from '../common/PasswordRequirementsList'

/** Opened from the "choose a new password" email: the token travels in
 * the fragment (#token=), never sent to a server nor in a Referer, and
 * leaves the address bar at once. Choosing the password signs every
 * session out; the person then signs in, second factor included. */
export function ResetPasswordCard() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [token] = useState(() => new URLSearchParams(location.hash.slice(1)).get('token'))
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [outcome, setOutcome] = useState<'form' | 'done' | 'invalid'>(token ? 'form' : 'invalid')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // The token is read: off the URL (it mustn't stay in history).
  useEffect(() => {
    if (location.hash) navigate('/reset-password', { replace: true })
  }, [location.hash, navigate])

  const minLength = usePasswordMinLength()
  const passwordValid = isPasswordValid(newPassword, minLength)
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!passwordValid || newPassword !== confirmPassword) return
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/password/reset', {
        method: 'POST',
        body: JSON.stringify({ token, new_password: newPassword }),
      })
      setOutcome('done')
      // Any session in this browser ended with it.
      await refresh()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ACCOUNT_LINK_INVALID') {
        setOutcome('invalid')
      } else {
        setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (outcome !== 'form') {
    const done = outcome === 'done'
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t(done ? 'auth.resetPassword.doneTitle' : 'auth.accountLink.invalidTitle')}
        </h1>
        <p role="status" className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t(done ? 'auth.resetPassword.done' : 'auth.resetPassword.invalid')}
        </p>
        <p className="text-center text-sm">
          <Link to={done ? '/login' : '/forgot-password'} className={linkAccent}>
            {t(done ? 'auth.forgotPassword.backToSignIn' : 'auth.resetPassword.requestAgain')}
          </Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t('auth.resetPassword.title')}
        </h1>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t('auth.resetPassword.intro')}
        </p>
      </div>
      <div className="space-y-2">
        <label className="block text-sm" htmlFor="reset-password-new">
          {t('auth.changePassword.newLabel')}
        </label>
        <input
          id="reset-password-new"
          name="new-password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputBase}
          required
        />
        <PasswordRequirementsList password={newPassword} minLength={minLength} />
        <label className="block text-sm" htmlFor="reset-password-confirm">
          {t('auth.changePassword.confirmLabel')}
        </label>
        <input
          id="reset-password-confirm"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputBase}
          required
        />
        {mismatch && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {t('auth.changePassword.mismatchError')}
          </p>
        )}
      </div>
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={submitting || !passwordValid || mismatch}
        className={`w-full ${btnPrimary}`}
      >
        {submitting ? <ButtonSpinner /> : t('auth.resetPassword.submit')}
      </button>
    </form>
  )
}
