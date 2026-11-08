import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import type { PreferredMfaMethod } from '../../lib/types'
import { Panel } from '../common/Panel'
import { RadioCards } from '../common/RadioCards'
import { EmailMfaSetup } from './EmailMfaSetup'
import { ActiveSessions } from './ActiveSessions'
import { BackupCodesRegenerate } from './BackupCodesRegenerate'
import { ChangePassword } from './ChangePassword'
import { TotpDisable } from './TotpDisable'
import { TotpEnrollment } from './TotpEnrollment'
import { HelpText } from '../common/HelpText'
import { SignInMethods } from './SignInMethods'

export function AccountSettingsSecurity() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()

  // Program Manager/Planner have mandatory TOTP -- "most restrictive org
  // wins" for a multi-org user, so holding either role in *any* org (both
  // booleans are already global, not scoped to the active org) means it
  // can't be disabled at all, not just in the org where it's mandatory.
  const mfaMandatory = Boolean(user?.is_program_manager || user?.is_planner)
  const totpEnabled = Boolean(user?.totp_enabled)
  // A code by email counts only where two-step isn't mandatory.
  const mfaEnabled = totpEnabled || (!mfaMandatory && Boolean(user?.mfa_methods?.includes('email')))
  const hasPassword = user?.has_password !== false
  const bothMethods = totpEnabled && Boolean(user?.email_mfa_enabled)
  const [preferredError, setPreferredError] = useState<string | null>(null)

  async function choosePreferred(method: PreferredMfaMethod) {
    setPreferredError(null)
    try {
      await apiFetch('/auth/mfa/preferred', { method: 'PUT', body: JSON.stringify({ method }) })
      await refresh()
    } catch (err) {
      setPreferredError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    }
  }

  const mfaStatus = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
        mfaEnabled
          ? 'bg-accent/10 text-accent-fg'
          : 'bg-paper-ink/5 text-paper-ink/70 dark:bg-hover dark:text-fg-muted'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${mfaEnabled ? 'bg-accent' : 'bg-current opacity-60'}`}
      />
      {mfaEnabled ? t('account.settings.mfaActive') : t('account.settings.mfaInactive')}
    </span>
  )

  return (
    <div className="w-full max-w-xl space-y-6">
      <Panel
        title={t('account.settings.mfaTitle')}
        description={
          <HelpText
            id="account.settings.mfaDescription"
            text={t('account.settings.mfaDescription')}
          />
        }
        aside={mfaStatus}
      >
        {totpEnabled ? (
          <>
            {mfaMandatory ? (
              <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('account.settings.mfaMandatoryNote')}
              </p>
            ) : (
              <TotpDisable />
            )}
            <div className="border-t border-panel-line pt-5">
              <BackupCodesRegenerate />
            </div>
          </>
        ) : (
          <TotpEnrollment />
        )}
        <div className="border-t border-panel-line pt-5">
          <EmailMfaSetup mandatory={mfaMandatory} />
        </div>
        {bothMethods && (
          <div className="space-y-2 border-t border-panel-line pt-5">
            <RadioCards<PreferredMfaMethod>
              id="mfa-preferred"
              name="mfa-preferred"
              legend={t('account.settings.mfaPreferred.legend')}
              options={[
                {
                  value: 'totp',
                  label: t('account.settings.mfaPreferred.totp'),
                  hint: t('account.settings.mfaPreferred.totpHint'),
                },
                {
                  value: 'email',
                  label: t('account.settings.mfaPreferred.email'),
                  hint: t('account.settings.mfaPreferred.emailHint'),
                },
              ]}
              value={user?.mfa_preferred ?? 'totp'}
              onChange={(method) => void choosePreferred(method)}
            />
            {preferredError && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {preferredError}
              </p>
            )}
          </div>
        )}
      </Panel>

      <Panel
        title={
          hasPassword ? t('auth.changePassword.title') : t('account.settings.setPasswordTitle')
        }
        description={
          hasPassword ? (
            <HelpText
              id="account.settings.passwordDescription"
              text={t('account.settings.passwordDescription')}
            />
          ) : (
            <HelpText
              id="account.settings.setPasswordDescription"
              text={t('account.settings.setPasswordDescription')}
            />
          )
        }
      >
        {hasPassword ? (
          <ChangePassword minLength={user?.password_min_length} />
        ) : (
          <ChangePassword firstPassword minLength={user?.password_min_length} onChanged={refresh} />
        )}
      </Panel>

      <SignInMethods />

      <Panel
        title={t('account.sessions.title')}
        description={
          <HelpText id="account.sessions.description" text={t('account.sessions.description')} />
        }
      >
        <ActiveSessions />
      </Panel>
    </div>
  )
}
