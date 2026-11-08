import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useLegalConsent } from '../../hooks/useLegalConsent'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { usePasswordMinLength } from '../../hooks/usePasswordPolicy'
import { isPasswordValid } from '../../lib/passwordPolicy'
import {
  clearPendingInvitation,
  readPendingInvitation,
  rememberPendingInvitation,
} from '../../lib/pendingInvitation'
import type { EmailInvitationAcceptResponse, EmailInvitationPreview } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { PasswordRequirementsList } from '../common/PasswordRequirementsList'
import { LegalConsentField } from './LegalConsentField'

/** Opened from a personal invitation sent by email: the token travels in
 * the fragment (#token=) and leaves the address bar at once; it waits in
 * this tab's storage while its holder signs in. Accepting grants the
 * exercise straight away -- to the account with the invited address only,
 * created here when there is none. */
export function JoinInvitationCard() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { status, user, refresh, logout } = useAuth()
  const [token] = useState(
    () => new URLSearchParams(location.hash.slice(1)).get('token') ?? readPendingInvitation(),
  )
  const [preview, setPreview] = useState<EmailInvitationPreview | null>(null)
  const [invalid, setInvalid] = useState(!token)
  const [error, setError] = useState<string | null>(null)
  const [otherAccount, setOtherAccount] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // The token is read: off the URL (it mustn't stay in history), kept for
  // a sign-in round trip.
  useEffect(() => {
    if (token) rememberPendingInvitation(token)
    if (location.hash) navigate('/join', { replace: true })
  }, [token, location.hash, navigate])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    async function load() {
      try {
        const data = await apiFetch<EmailInvitationPreview>('/email-invitations/preview', {
          method: 'POST',
          body: JSON.stringify({ token }),
        })
        if (!cancelled) setPreview(data)
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.code === 'INVITATION_INVALID') {
          clearPendingInvitation()
          setInvalid(true)
        } else {
          setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token, t])

  /** `handleError` gets the first look at a failure (the signup form's
   * legal consent, when a new version was published meanwhile). */
  async function accept(
    account?: object,
    handleError?: (err: unknown) => boolean,
  ): Promise<boolean> {
    setError(null)
    setOtherAccount(false)
    setSubmitting(true)
    try {
      const result = await apiFetch<EmailInvitationAcceptResponse>('/email-invitations/accept', {
        method: 'POST',
        body: JSON.stringify(account ? { token, account } : { token }),
      })
      clearPendingInvitation()
      await refresh()
      navigate(`/playground/${result.ttx_id}`, { replace: true })
      return true
    } catch (err) {
      if (handleError?.(err)) {
        setError(t('legal.consent.outdatedError'))
      } else if (err instanceof ApiError && err.code === 'INVITATION_INVALID') {
        clearPendingInvitation()
        setInvalid(true)
      } else if (err instanceof ApiError && err.code === 'INVITATION_OTHER_ACCOUNT') {
        setOtherAccount(true)
      } else {
        setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      }
      return false
    } finally {
      setSubmitting(false)
    }
  }

  if (invalid) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t('auth.accountLink.invalidTitle')}
        </h1>
        <p role="status" className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t('auth.joinInvitation.invalid')}
        </p>
        <p className="text-center text-sm">
          <Link to="/" className={linkAccent}>
            {t('auth.joinInvitation.goHome')}
          </Link>
        </p>
      </div>
    )
  }

  if (!preview || status === 'loading') {
    return (
      <div className="space-y-4">
        {error ? (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        ) : (
          <p role="status" className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('auth.joinInvitation.loading')}
          </p>
        )}
      </div>
    )
  }

  const signedIn = status !== 'anonymous' && user !== null

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t('auth.joinInvitation.title', { exercise: preview.ttx_name })}
        </h1>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t('auth.joinInvitation.intro', {
            organization: preview.organization_name,
            email: preview.email_hint,
          })}
        </p>
      </div>

      {signedIn && (
        <div className="space-y-3">
          {otherAccount ? (
            <>
              <p className="text-sm text-danger-fg" aria-live="polite">
                {t('auth.joinInvitation.otherAccount', {
                  current: user.email,
                  email: preview.email_hint,
                })}
              </p>
              <button
                type="button"
                onClick={() => void logout()}
                className={`w-full ${btnSecondary}`}
              >
                {t('auth.joinInvitation.signOut')}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('auth.joinInvitation.signedInAs', { email: user.email })}
              </p>
              <button
                type="button"
                onClick={() => void accept()}
                disabled={submitting}
                className={`w-full ${btnPrimary}`}
              >
                {submitting ? <ButtonSpinner /> : t('auth.joinInvitation.join')}
              </button>
            </>
          )}
        </div>
      )}

      {!signedIn && preview.account_exists && (
        <div className="space-y-3">
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('auth.joinInvitation.signInFirst')}
          </p>
          <Link to="/login" className={`block w-full text-center ${btnPrimary}`}>
            {t('auth.joinInvitation.signIn')}
          </Link>
        </div>
      )}

      {!signedIn && !preview.account_exists && (
        <NewAccountForm submitting={submitting} onSubmit={accept} />
      )}

      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}

function NewAccountForm({
  submitting,
  onSubmit,
}: {
  submitting: boolean
  onSubmit: (account: object, handleError: (err: unknown) => boolean) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const legal = useLegalConsent()

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  const minLength = usePasswordMinLength()
  const canSubmit = !submitting && isPasswordValid(password, minLength) && !mismatch && legal.ready

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!canSubmit || password !== confirmPassword) return
    void onSubmit({ full_name: fullName, password, accepted_legal: legal.payload }, (err) =>
      legal.handleError(err),
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('auth.joinInvitation.createAccount')}
      </p>
      <label className="block text-sm" htmlFor="join-full-name">
        {t('auth.register.fullNameLabel')}
      </label>
      <input
        spellCheck={false}
        id="join-full-name"
        name="name"
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className={inputBase}
        required
      />
      <label className="block text-sm" htmlFor="join-password">
        {t('auth.register.passwordLabel')}
      </label>
      <input
        id="join-password"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputBase}
        required
      />
      <PasswordRequirementsList password={password} minLength={minLength} />
      <label className="block text-sm" htmlFor="join-confirm-password">
        {t('auth.register.confirmPasswordLabel')}
      </label>
      <input
        id="join-confirm-password"
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
          {t('auth.register.passwordMismatchError')}
        </p>
      )}
      <LegalConsentField consent={legal} id="join-legal" />
      <button type="submit" disabled={!canSubmit} className={`w-full ${btnPrimary}`}>
        {submitting ? <ButtonSpinner /> : t('auth.joinInvitation.createAndJoin')}
      </button>
    </form>
  )
}
