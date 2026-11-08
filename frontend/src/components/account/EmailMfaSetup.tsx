import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { EmailCodeSentResponse } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { ResendCodeButton } from '../common/ResendCodeButton'

/** Preferences -> Security: a code by email as a second factor. Turned on
 * with a code sent to the account's address (which also proves it), off
 * after a recent confirmation (step-up, asked by apiFetch). Where two-step
 * is mandatory it's an alternative to the authenticator app, never instead
 * of it -- the server holds that line (email_mfa_service). */
export function EmailMfaSetup({ mandatory }: { mandatory: boolean }) {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const enabled = Boolean(user?.email_mfa_enabled)
  const available = Boolean(user?.email_mfa_available)

  function failure(err: unknown) {
    setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
  }

  async function sendCode() {
    setError(null)
    try {
      const sent = await apiFetch<EmailCodeSentResponse>('/auth/mfa/email/enable', {
        method: 'POST',
      })
      setSentTo(sent.sent_to)
    } catch (err) {
      failure(err)
      throw err
    }
  }

  async function start() {
    setSubmitting(true)
    try {
      await sendCode()
    } catch {
      // Shown by sendCode.
    } finally {
      setSubmitting(false)
    }
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/mfa/email/enable/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      setSentTo(null)
      setCode('')
      await refresh()
    } catch (err) {
      setCode('')
      failure(err)
    } finally {
      setSubmitting(false)
    }
  }

  async function turnOff() {
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/mfa/email', { method: 'DELETE' })
      await refresh()
    } catch (err) {
      failure(err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">{t('account.settings.emailMfa.title')}</h3>
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {enabled
          ? available
            ? t('account.settings.emailMfa.on', { email: user?.email ?? '' })
            : t('account.settings.emailMfa.onButUnavailable')
          : available
            ? t('account.settings.emailMfa.off')
            : t('account.settings.emailMfa.unavailable')}
      </p>
      {mandatory && (available || enabled) && (
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('account.settings.emailMfa.mandatoryNote')}
        </p>
      )}

      {sentTo !== null ? (
        <form onSubmit={confirm} className="max-w-sm space-y-2">
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('account.settings.emailMfa.sent', { address: sentTo })}
          </p>
          <label className="block text-sm" htmlFor="email-mfa-code">
            {t('auth.login.mfaCodeLabel')}
          </label>
          <input
            id="email-mfa-code"
            name="otp"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={6}
            placeholder={t('auth.login.mfaCodePlaceholder')}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputBase} text-center text-lg tracking-widest`}
            required
          />
          <ResendCodeButton onResend={sendCode} />
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setSentTo(null)
                setError(null)
              }}
              className={btnSecondary}
            >
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || code.trim() === ''}
              className={btnPrimary}
            >
              {submitting ? <ButtonSpinner /> : t('account.settings.emailMfa.confirm')}
            </button>
          </div>
        </form>
      ) : (
        <>
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
          {enabled ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => void turnOff()}
              className={btnSecondary}
            >
              {submitting ? <ButtonSpinner /> : t('account.settings.emailMfa.turnOff')}
            </button>
          ) : (
            available && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void start()}
                className={btnSecondary}
              >
                {submitting ? <ButtonSpinner /> : t('account.settings.emailMfa.turnOn')}
              </button>
            )
          )}
        </>
      )}
    </div>
  )
}
