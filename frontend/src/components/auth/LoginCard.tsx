import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { useAuth } from '../../hooks/useAuth'
import { useApiResource } from '../../hooks/useApiResource'
import { useOidcConfig } from '../../hooks/useOidcConfig'
import { clearSessionExpired, readSessionExpired, returnPathAfterLogin } from '../../lib/authStore'
import { readPendingInvitation } from '../../lib/pendingInvitation'
import { safeReturnTo, ssoErrorKey, ssoStartUrl } from '../../lib/sso'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { ResendCodeButton } from '../common/ResendCodeButton'
import type {
  EmailCodeSentResponse,
  InstancePolicy,
  LoginResponse,
  MfaChallengeResponse,
  MfaMethod,
  PreferredMfaMethod,
} from '../../lib/types'
import { hasFinePointer } from '../../lib/pointer'
import { MicrosoftLogo } from './MicrosoftLogo'

export function LoginCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh, status } = useAuth()
  const location = useLocation()
  const sso = useOidcConfig(status === 'anonymous')
  const policy = useApiResource<InstancePolicy>(status === 'anonymous' ? '/instance/policy' : null)

  // Back from single sign-on (lib/sso.ts): a failure to explain, or the
  // account's own TOTP to finish the sign-in, and where to go afterwards.
  const [ssoReturn] = useState(() => {
    const params = new URLSearchParams(location.search)
    const hash = new URLSearchParams(location.hash.slice(1))
    return {
      error: params.get('sso_error'),
      mfaToken: hash.get('mfa'),
      returnTo: params.get('return_to'),
    }
  })

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(ssoReturn.mfaToken)
  // The pending challenge: how it can be answered, which way it's being
  // answered now, and where an email code went.
  const [mfaMethods, setMfaMethods] = useState<MfaMethod[]>(['totp', 'backup_code'])
  const [mfaMethod, setMfaMethod] = useState<PreferredMfaMethod>('totp')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const ssoChallengeLoaded = useRef(false)
  const [error, setError] = useState<string | null>(() =>
    ssoReturn.error ? t(ssoErrorKey(ssoReturn.error)) : null,
  )
  const [submitting, setSubmitting] = useState(false)
  // Sent here because the session expired mid-use: say so, and once they
  // sign in again take them back where they were.
  const [sessionExpired] = useState(readSessionExpired)

  // Back from single sign-on with a challenge: only its token came in the
  // fragment, so ask how it can be answered (once: opening on email sends
  // a code).
  useEffect(() => {
    const token = ssoReturn.mfaToken
    if (token === null || ssoChallengeLoaded.current) return
    ssoChallengeLoaded.current = true
    void (async () => {
      try {
        const challenge = await apiFetch<MfaChallengeResponse>('/auth/login/challenge', {
          method: 'POST',
          body: JSON.stringify({ mfa_pending_token: token }),
        })
        setMfaMethods(challenge.mfa_methods)
        if (challenge.mfa_preferred === 'email') {
          setMfaMethod('email')
          const sent = await apiFetch<EmailCodeSentResponse>('/auth/login/email-code', {
            method: 'POST',
            body: JSON.stringify({ mfa_pending_token: token }),
          })
          setSentTo(sent.sent_to)
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      }
    })()
  }, [ssoReturn.mfaToken, t])

  // The outcome is read: off the URL (the token mustn't stay in history).
  useEffect(() => {
    if (location.search || location.hash) navigate('/login', { replace: true })
  }, [location.search, location.hash, navigate])

  async function finishLogin() {
    await refresh()
    // Sent here by an email invitation's link: back to it to join.
    const target = ssoReturn.mfaToken
      ? safeReturnTo(ssoReturn.returnTo)
      : readPendingInvitation()
        ? '/join'
        : returnPathAfterLogin(sessionExpired, email)
    clearSessionExpired()
    navigate(target, { replace: target !== '/' })
  }

  function startSso() {
    const expiredPath = readPendingInvitation()
      ? '/join'
      : sessionExpired
        ? safeReturnTo(sessionExpired.returnTo)
        : '/'
    clearSessionExpired()
    window.location.assign(ssoStartUrl(expiredPath))
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (result.mfa_required && result.mfa_pending_token) {
        setMfaPendingToken(result.mfa_pending_token)
        setMfaMethods(result.mfa_methods)
        setMfaMethod(result.mfa_preferred ?? 'totp')
        setSentTo(null)
        setCode('')
        if (result.mfa_preferred === 'email') await sendEmailCode(result.mfa_pending_token)
      } else {
        await finishLogin()
      }
    } catch (err) {
      setError(loginError(err))
    } finally {
      setSubmitting(false)
    }
  }

  /** Throws only for the resend button; a failure is shown either way. */
  async function sendEmailCode(token: string) {
    try {
      const sent = await apiFetch<EmailCodeSentResponse>('/auth/login/email-code', {
        method: 'POST',
        body: JSON.stringify({ mfa_pending_token: token }),
      })
      setSentTo(sent.sent_to)
    } catch (err) {
      setError(loginError(err))
      throw err
    }
  }

  function switchMethod(next: PreferredMfaMethod) {
    setMfaMethod(next)
    setCode('')
    setError(null)
    if (next === 'email' && sentTo === null && mfaPendingToken !== null) {
      sendEmailCode(mfaPendingToken).catch(() => undefined)
    }
  }

  async function handleMfaSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (mfaPendingToken === null) return
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch<LoginResponse>('/auth/login/verify-totp', {
        method: 'POST',
        // Without a method the server tries TOTP, then a backup code.
        body: JSON.stringify({
          mfa_pending_token: mfaPendingToken,
          code,
          method: mfaMethod === 'email' ? 'email' : null,
        }),
      })
      await finishLogin()
    } catch (err) {
      setCode('')
      if (err instanceof ApiError && err.code === 'MFA_CHALLENGE_EXPIRED') {
        // Too many wrong codes, or a newer sign-in started: back to the
        // password step.
        setMfaPendingToken(null)
        setPassword('')
        setError(t('auth.login.challengeExpired'))
      } else {
        setError(loginError(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  function loginError(err: unknown): string {
    if (!(err instanceof ApiError)) return t('auth.common.genericError')
    if (err.code === 'TOO_MANY_ATTEMPTS') return t('auth.login.tooManyAttempts')
    if (err.code === 'LOGIN_THROTTLED') return t('auth.login.tooManySignIns')
    if (err.code === 'ACCOUNT_SUSPENDED') return t('auth.login.accountSuspended')
    return err.message
  }

  if (mfaPendingToken !== null) {
    return (
      <form onSubmit={handleMfaSubmit} className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t('auth.login.mfaTitle')}
        </h1>
        <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
          {mfaMethod === 'email'
            ? sentTo
              ? t('auth.login.emailCodeInstructions', { address: sentTo })
              : t('auth.login.emailCodeSending')
            : t('auth.login.mfaInstructions')}
        </p>
        <label className="block text-sm" htmlFor="login-mfa-code">
          {t('auth.login.mfaCodeLabel')}
        </label>
        <input
          spellCheck={false}
          id="login-mfa-code"
          name="otp"
          type="text"
          autoComplete="one-time-code"
          autoFocus={hasFinePointer()}
          maxLength={17}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('auth.login.mfaCodePlaceholder')}
          className={`${inputBase} text-center text-lg tracking-widest`}
          required
        />
        {mfaMethod === 'totp' && mfaMethods.includes('backup_code') && (
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('auth.login.mfaBackupCodeHint')}
          </p>
        )}
        {mfaMethod === 'email' && sentTo !== null && mfaPendingToken !== null && (
          <ResendCodeButton onResend={() => sendEmailCode(mfaPendingToken)} />
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <button type="submit" disabled={submitting} className={`w-full ${btnPrimary}`}>
          {submitting ? <ButtonSpinner /> : t('auth.login.mfaSubmit')}
        </button>
        {mfaMethod === 'totp' && mfaMethods.includes('email') && (
          <button
            type="button"
            onClick={() => switchMethod('email')}
            className={`block w-full text-center text-sm ${linkAccent}`}
          >
            {t('auth.login.useEmailCode')}
          </button>
        )}
        {mfaMethod === 'email' && mfaMethods.includes('totp') && (
          <button
            type="button"
            onClick={() => switchMethod('totp')}
            className={`block w-full text-center text-sm ${linkAccent}`}
          >
            {t('auth.login.useAuthenticator')}
          </button>
        )}
      </form>
    )
  }

  return (
    <form onSubmit={handlePasswordSubmit} className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t('auth.login.title')}
      </h1>
      {sessionExpired && (
        <p role="status" className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('auth.common.sessionExpired')}
        </p>
      )}
      <div className="space-y-2">
        <label className="block text-sm" htmlFor="login-email">
          {t('auth.login.emailLabel')}
        </label>
        <input
          spellCheck={false}
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.login.emailPlaceholder')}
          className={inputBase}
          required
        />
        <div className="flex items-baseline justify-between gap-2">
          <label className="block text-sm" htmlFor="login-password">
            {t('auth.login.passwordLabel')}
          </label>
          {policy.data?.password_reset_available && (
            <Link to="/forgot-password" state={{ email }} className={`text-sm ${linkAccent}`}>
              {t('auth.login.forgotPassword')}
            </Link>
          )}
        </div>
        <input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
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
        {submitting ? <ButtonSpinner /> : t('auth.login.submit')}
      </button>
      {sso.enabled && (
        <>
          <p className="flex items-center gap-3 text-xs uppercase tracking-wide text-paper-ink/60 dark:text-fg-muted">
            <span aria-hidden="true" className="h-px flex-1 bg-panel-line" />
            {t('auth.sso.or')}
            <span aria-hidden="true" className="h-px flex-1 bg-panel-line" />
          </p>
          <button
            type="button"
            onClick={startSso}
            className={`flex w-full items-center justify-center gap-2 ${btnSecondary}`}
          >
            {sso.provider_kind === 'entra' && <MicrosoftLogo />}
            {t('auth.sso.signInWith', { provider: sso.display_name })}
          </button>
        </>
      )}
      <p className="text-center text-sm text-paper-ink/60 dark:text-fg-muted">
        {t('auth.login.noAccount')}{' '}
        <Link to="/register" className={`${linkAccent} underline`}>
          {t('auth.login.registerLink')}
        </Link>
      </p>
    </form>
  )
}
