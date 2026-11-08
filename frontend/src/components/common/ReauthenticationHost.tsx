import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { setReauthenticationHandler } from '../../lib/reauthentication'
import { goToProvider } from '../../lib/sso'
import type { EmailCodeSentResponse, PreferredMfaMethod } from '../../lib/types'
import { ButtonSpinner } from './ButtonSpinner'
import { Modal } from './Modal'
import { ResendCodeButton } from './ResendCodeButton'

/** Answers step-up requests (lib/reauthentication.ts): when a sensitive
 * action needs a recent confirmation, asks for a TOTP code or a code by
 * email (the account's preferred one, the other a click away) -- or the
 * password on an account without either -- confirms it with
 * POST /auth/step-up, and lets the refused request go through again. An
 * account with neither (single sign-on only) confirms at its provider
 * instead: a full-page trip that comes back to this page, where the
 * person does the action again. Mounted once, inside AuthProvider. */
export function ReauthenticationHost() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // Which code is asked for (null: the password), and where an email
  // code went this time.
  const [codeMethod, setCodeMethod] = useState<PreferredMfaMethod | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null)
  const methods = user?.mfa_methods ?? []
  const preferred: PreferredMfaMethod | null =
    user?.mfa_preferred ??
    (methods.includes('totp') ? 'totp' : methods.includes('email') ? 'email' : null)
  // The handler is registered once; it reads the current account's choice
  // and sends through the current render's function.
  const preferredRef = useRef(preferred)
  const sendRef = useRef<() => Promise<void>>(() => Promise.resolve())
  useEffect(() => {
    preferredRef.current = preferred
    sendRef.current = sendEmailCode
  })

  useEffect(() => {
    setReauthenticationHandler(
      () =>
        new Promise<boolean>((resolve) => {
          resolveRef.current = resolve
          setValue('')
          setError(null)
          setSentTo(null)
          setCodeMethod(preferredRef.current)
          setOpen(true)
          if (preferredRef.current === 'email') {
            sendRef.current().catch(() => undefined)
          }
        }),
    )
    return () => setReauthenticationHandler(null)
  }, [])

  /** Throws only for the resend button; a failure is shown either way. */
  async function sendEmailCode() {
    try {
      const sent = await apiFetch<EmailCodeSentResponse>('/auth/step-up/email-code', {
        method: 'POST',
      })
      setSentTo(sent.sent_to)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      throw err
    }
  }

  function switchMethod(next: PreferredMfaMethod) {
    setCodeMethod(next)
    setValue('')
    setError(null)
    if (next === 'email' && sentTo === null) sendEmailCode().catch(() => undefined)
  }

  function finish(confirmed: boolean) {
    setOpen(false)
    resolveRef.current?.(confirmed)
    resolveRef.current = null
  }

  const withCode = codeMethod !== null
  const ssoOnly = !withCode && user?.has_password === false

  async function confirmAtProvider() {
    setError(null)
    setSubmitting(true)
    try {
      await goToProvider('step-up')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setSubmitting(false)
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/step-up', {
        method: 'POST',
        body: JSON.stringify(withCode ? { code: value, method: codeMethod } : { password: value }),
      })
      finish(true)
    } catch (err) {
      setError(
        err instanceof ApiError && err.code === 'TOO_MANY_ATTEMPTS'
          ? t('auth.login.tooManyAttempts')
          : withCode
            ? t('auth.reauth.invalidCode')
            : t('auth.reauth.invalidPassword'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  if (ssoOnly) {
    return (
      <Modal titleId="reauth-title" onClose={() => finish(false)} onTop>
        <div className="w-full max-w-sm space-y-3">
          <h2 id="reauth-title" className="text-balance text-lg font-semibold tracking-tight">
            {t('auth.reauth.title')}
          </h2>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('auth.reauth.ssoBody', { provider: user?.sso_provider ?? t('auth.sso.provider') })}
          </p>
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => finish(false)} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void confirmAtProvider()}
              className={btnPrimary}
            >
              {submitting ? (
                <ButtonSpinner />
              ) : (
                t('auth.sso.continueWith', {
                  provider: user?.sso_provider ?? t('auth.sso.provider'),
                })
              )}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <Modal titleId="reauth-title" onClose={() => finish(false)} onTop>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-3">
        <h2 id="reauth-title" className="text-balance text-lg font-semibold tracking-tight">
          {t('auth.reauth.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {codeMethod === 'totp'
            ? t('auth.reauth.totpBody')
            : codeMethod === 'email'
              ? sentTo
                ? t('auth.reauth.emailBody', { address: sentTo })
                : t('auth.login.emailCodeSending')
              : t('auth.reauth.passwordBody')}
        </p>
        <label className="block text-sm" htmlFor="reauth-value">
          {withCode ? t('auth.login.mfaCodeLabel') : t('auth.login.passwordLabel')}
        </label>
        {withCode ? (
          <input
            id="reauth-value"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder={t('auth.login.mfaCodePlaceholder')}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputBase}
            required
            autoFocus
          />
        ) : (
          <input
            id="reauth-value"
            name="current-password"
            type="password"
            autoComplete="current-password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={inputBase}
            required
            autoFocus
          />
        )}
        {codeMethod === 'email' && sentTo !== null && <ResendCodeButton onResend={sendEmailCode} />}
        {codeMethod !== null && methods.includes('totp') && methods.includes('email') && (
          <button
            type="button"
            onClick={() => switchMethod(codeMethod === 'totp' ? 'email' : 'totp')}
            className={`block text-sm ${linkAccent}`}
          >
            {codeMethod === 'totp'
              ? t('auth.login.useEmailCode')
              : t('auth.login.useAuthenticator')}
          </button>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => finish(false)} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={submitting || value.trim() === ''} className={btnPrimary}>
            {submitting ? <ButtonSpinner /> : t('auth.reauth.confirm')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
