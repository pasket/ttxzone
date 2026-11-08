import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { apiFetch } from '../../lib/api'
import { btnPrimary, inputBase, optionalSuffix } from '../../lib/buttonStyles'
import { panelFormActions } from '../../lib/panelStyles'
import { PASSWORD_MIN_LENGTH } from '../../lib/passwordPolicy'
import type { MfaPolicy, MfaPolicyRole, SecurityPolicy } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { labelClass, useErrorMessage } from './platformCommon'

// Mirrors backend/app/core/password_policy.py's bounds.
const MIN_LENGTH_MAX = 64
const HISTORY_MAX = 24
const MAX_AGE_DAYS_MAX = 730

const MFA_ROLES: MfaPolicyRole[] = ['program_manager', 'planner', 'evaluator', 'observer', 'player']

const MFA_ROLE_KEYS = {
  program_manager: 'platform.security.roles.program_manager',
  planner: 'platform.security.roles.planner',
  evaluator: 'platform.security.roles.evaluator',
  observer: 'platform.security.roles.observer',
  player: 'platform.security.roles.player',
} as const

function intInRange(value: string, min: number, max: number): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : null
}

/** The form for both policies, saved together (one audit entry). */
function SecurityPolicyForm({
  current,
  onSaved,
}: {
  current: SecurityPolicy
  onSaved: (next: SecurityPolicy) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [minLength, setMinLength] = useState(String(current.password.min_length))
  const [rejectPersonal, setRejectPersonal] = useState(current.password.reject_personal)
  const [maxAge, setMaxAge] = useState(current.password.max_age_days?.toString() ?? '')
  const [history, setHistory] = useState(String(current.password.history_count))
  const [mfa, setMfa] = useState<MfaPolicy>(current.mfa)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const minLengthValue = intInRange(minLength, PASSWORD_MIN_LENGTH, MIN_LENGTH_MAX)
  const maxAgeValue = maxAge.trim() === '' ? null : intInRange(maxAge, 1, MAX_AGE_DAYS_MAX)
  const maxAgeValid = maxAge.trim() === '' || maxAgeValue !== null
  const historyValue = intInRange(history, 0, HISTORY_MAX)
  const valid = minLengthValue !== null && maxAgeValid && historyValue !== null
  const dirty =
    minLengthValue !== current.password.min_length ||
    rejectPersonal !== current.password.reject_personal ||
    maxAgeValue !== current.password.max_age_days ||
    historyValue !== current.password.history_count ||
    MFA_ROLES.some((role) => mfa[role] !== current.mfa[role])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const next = await apiFetch<SecurityPolicy>('/instance/security-policy', {
        method: 'PUT',
        body: JSON.stringify({
          password: {
            min_length: minLengthValue,
            reject_personal: rejectPersonal,
            max_age_days: maxAgeValue,
            history_count: historyValue,
          },
          mfa,
        }),
      })
      onSaved(next)
      showToast(t('platform.security.saved'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const footer = (
    <div className={panelFormActions}>
      <button type="submit" disabled={submitting || !dirty || !valid} className={btnPrimary}>
        {submitting ? <ButtonSpinner /> : t('platform.security.save')}
      </button>
    </div>
  )

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Panel
        title={t('platform.security.passwords.title')}
        description={
          <HelpText
            id="platform.security.passwords.description"
            text={t('platform.security.passwords.description')}
          />
        }
      >
        <div className="grid max-w-2xl gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="security-min-length">
              {t('platform.security.passwords.minLength')}
            </label>
            <input
              id="security-min-length"
              type="number"
              min={PASSWORD_MIN_LENGTH}
              max={MIN_LENGTH_MAX}
              inputMode="numeric"
              value={minLength}
              onChange={(e) => setMinLength(e.target.value)}
              aria-invalid={minLengthValue === null}
              className={inputBase}
            />
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('platform.security.passwords.minLengthHint', {
                min: PASSWORD_MIN_LENGTH,
                max: MIN_LENGTH_MAX,
              })}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="security-max-age">
              {t('platform.security.passwords.maxAge')}{' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </label>
            <input
              id="security-max-age"
              type="number"
              min={1}
              max={MAX_AGE_DAYS_MAX}
              inputMode="numeric"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
              aria-invalid={!maxAgeValid}
              className={inputBase}
            />
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('platform.security.passwords.maxAgeHint')}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="security-history">
              {t('platform.security.passwords.history')}
            </label>
            <input
              id="security-history"
              type="number"
              min={0}
              max={HISTORY_MAX}
              inputMode="numeric"
              value={history}
              onChange={(e) => setHistory(e.target.value)}
              aria-invalid={historyValue === null}
              className={inputBase}
            />
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('platform.security.passwords.historyHint')}
            </p>
          </div>
        </div>
        <label className="mt-4 flex max-w-2xl items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={rejectPersonal}
            onChange={(e) => setRejectPersonal(e.target.checked)}
            className="mt-1"
          />
          <span>
            <span className="block font-medium">
              {t('platform.security.passwords.rejectPersonal')}
            </span>
            <span className="block text-paper-ink/60 dark:text-fg-muted">
              {t('platform.security.passwords.rejectPersonalHint')}
            </span>
          </span>
        </label>
      </Panel>

      <Panel
        title={t('platform.security.mfa.title')}
        description={
          <HelpText
            id="platform.security.mfa.description"
            text={t('platform.security.mfa.description')}
          />
        }
        footer={footer}
      >
        <fieldset className="max-w-2xl space-y-3">
          <legend className="sr-only">{t('platform.security.mfa.title')}</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked disabled className="mt-1" />
            <span>
              <span className="block font-medium">
                {t('platform.security.roles.instance_admin')}
              </span>
              <span className="block text-paper-ink/60 dark:text-fg-muted">
                {t('platform.security.mfa.alwaysRequired')}
              </span>
            </span>
          </label>
          {MFA_ROLES.map((role) => {
            const without = current.accounts_without_totp[role]
            return (
              <label key={role} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={mfa[role]}
                  onChange={(e) => setMfa((prev) => ({ ...prev, [role]: e.target.checked }))}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{t(MFA_ROLE_KEYS[role])}</span>
                  <span className="block text-paper-ink/60 dark:text-fg-muted">
                    {without === 0
                      ? t('platform.security.mfa.allEnrolled')
                      : t('platform.security.mfa.withoutTotp', { count: without })}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </Panel>
    </form>
  )
}

/** Platform -> Sign-in security: password rules on top of the fixed floor, and
 * which roles must have a second factor. */
export function PlatformSecuritySection() {
  const { t } = useTranslation()
  const policy = useApiResource<SecurityPolicy>('/instance/security-policy')
  const [saved, setSaved] = useState<SecurityPolicy | null>(null)
  const current = saved ?? policy.data

  return (
    <div className="space-y-6">
      <SectionHeader title={t('platform.sections.security')} />
      {policy.error && (
        <p className="text-sm text-danger-fg" role="alert">
          {policy.error.message}
        </p>
      )}
      {current && (
        <SecurityPolicyForm
          key={JSON.stringify([current.password, current.mfa])}
          current={current}
          onSaved={setSaved}
        />
      )}
    </div>
  )
}
