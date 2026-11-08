import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnSecondary } from '../../lib/buttonStyles'
import { goToProvider } from '../../lib/sso'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { Panel } from '../common/Panel'

/** Preferences -> Security -> Single sign-on: link this account to the
 * deployment's provider (a trip there and back, with step-up), or unlink
 * it -- refused while the account has no password, or it couldn't sign
 * in at all. Hidden when the deployment has no single sign-on and the
 * account isn't linked. */
export function SignInMethods() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()
  const { showToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const linked = Boolean(user?.sso_linked)
  // Linking needs the provider on; unlinking doesn't.
  const available = Boolean(user?.sso_provider)
  const hasPassword = user?.has_password !== false
  if (!user?.sso_provider && !linked) return null
  const provider = user?.sso_provider ?? t('auth.sso.provider')

  async function link() {
    setError(null)
    setSubmitting(true)
    try {
      await goToProvider('link')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setSubmitting(false)
    }
  }

  async function unlink() {
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/auth/oidc/link', { method: 'DELETE' })
      await refresh()
      showToast(t('account.settings.sso.unlinked'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  const status = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
        linked
          ? 'bg-accent/10 text-accent-fg'
          : 'bg-paper-ink/5 text-paper-ink/70 dark:bg-hover dark:text-fg-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${linked ? 'bg-accent' : 'bg-current opacity-60'}`}
      />
      {linked ? t('account.settings.sso.linked') : t('account.settings.sso.notLinked')}
    </span>
  )

  return (
    <Panel
      title={t('account.settings.sso.title')}
      description={
        <HelpText
          id="account.settings.sso.description"
          text={t('account.settings.sso.description', { provider })}
        />
      }
      aside={status}
    >
      <div className="max-w-sm space-y-2">
        {linked && !hasPassword && (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('account.settings.sso.onlyWay')}
          </p>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        {linked
          ? hasPassword && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void unlink()}
                className={btnSecondary}
              >
                {submitting ? <ButtonSpinner /> : t('account.settings.sso.unlink')}
              </button>
            )
          : available && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void link()}
                className={btnSecondary}
              >
                {submitting ? <ButtonSpinner /> : t('account.settings.sso.link', { provider })}
              </button>
            )}
      </div>
    </Panel>
  )
}
