import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase, inputDisabled, linkAccent } from '../../lib/buttonStyles'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useLegalConsent } from '../../hooks/useLegalConsent'
import { isPasswordValid } from '../../lib/passwordPolicy'
import { PasswordRequirementsList } from '../common/PasswordRequirementsList'
import { LegalConsentField } from './LegalConsentField'
import type { InstancePolicy, InvitationTokenRedeemResponse } from '../../lib/types'

type RegisterMode = 'choice' | 'plain' | 'organization' | 'token'

function PlainForm({
  onError,
  minLength,
}: {
  onError: (message: string) => void
  minLength: number
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const legal = useLegalConsent()

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !submitting && isPasswordValid(password, minLength) && !mismatch && legal.ready

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onError('')
    if (password !== confirmPassword) {
      onError(t('auth.register.passwordMismatchError'))
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          accepted_legal: legal.payload,
        }),
      })
      await refresh()
      navigate('/')
    } catch (err) {
      if (legal.handleError(err)) onError(t('legal.consent.outdatedError'))
      else onError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm" htmlFor="register-plain-name">
        {t('auth.register.fullNameLabel')}
      </label>
      <input
        id="register-plain-name"
        name="name"
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className={inputBase}
        required
      />
      <label className="block text-sm" htmlFor="register-plain-email">
        {t('auth.register.emailLabel')}
      </label>
      <input
        spellCheck={false}
        id="register-plain-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('auth.register.emailPlaceholder')}
        className={inputBase}
        required
      />
      <label className="block text-sm" htmlFor="register-plain-password">
        {t('auth.register.passwordLabel')}
      </label>
      <input
        id="register-plain-password"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputBase}
        required
      />
      <PasswordRequirementsList password={password} minLength={minLength} />
      <label className="block text-sm" htmlFor="register-plain-confirm-password">
        {t('auth.register.confirmPasswordLabel')}
      </label>
      <input
        id="register-plain-confirm-password"
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
      <LegalConsentField consent={legal} id="register-plain-legal" />
      <button type="submit" disabled={!canSubmit} className={`w-full ${btnPrimary}`}>
        {t('auth.register.createPlainSubmit')}
      </button>
    </form>
  )
}

/** Informational-only preview of the company name, derived from the email
 * domain as the user types it (e.g. "ada@acme.com" -> "Acme") -- the field
 * is read-only since the company's real name comes from its email domain,
 * not free text the signer-upper types. */
function companyNameFromEmail(email: string): string {
  const domain = email.split('@')[1]
  if (!domain) return ''
  const label = domain.split('.')[0]
  if (!label) return ''
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function OrganizationForm({
  onError,
  minLength,
}: {
  onError: (message: string) => void
  minLength: number
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const legal = useLegalConsent()

  const orgName = companyNameFromEmail(email)
  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !submitting && isPasswordValid(password, minLength) && !mismatch && legal.ready

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onError('')
    if (password !== confirmPassword) {
      onError(t('auth.register.passwordMismatchError'))
      return
    }
    setSubmitting(true)
    try {
      await apiFetch('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          organization: { name: orgName, tax_id: null },
          admin: { email, password, full_name: fullName },
          accepted_legal: legal.payload,
        }),
      })
      await refresh()
      navigate('/')
    } catch (err) {
      if (legal.handleError(err)) onError(t('legal.consent.outdatedError'))
      else onError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm" htmlFor="register-org-name">
        {t('auth.register.orgNameLabel')}
      </label>
      <input
        id="register-org-name"
        name="organization"
        autoComplete="organization"
        value={orgName}
        disabled
        className={inputDisabled}
      />
      <label className="block text-sm" htmlFor="register-org-full-name">
        {t('auth.register.fullNameLabel')}
      </label>
      <input
        id="register-org-full-name"
        name="name"
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className={inputBase}
        required
      />
      <label className="block text-sm" htmlFor="register-org-email">
        {t('auth.register.emailLabel')}
      </label>
      <input
        spellCheck={false}
        id="register-org-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('auth.register.emailPlaceholder')}
        className={inputBase}
        required
      />
      <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
        {t('auth.register.orgEmailDomainHint')}
      </p>
      <label className="block text-sm" htmlFor="register-org-password">
        {t('auth.register.passwordLabel')}
      </label>
      <input
        id="register-org-password"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputBase}
        required
      />
      <PasswordRequirementsList password={password} minLength={minLength} />
      <label className="block text-sm" htmlFor="register-org-confirm-password">
        {t('auth.register.confirmPasswordLabel')}
      </label>
      <input
        id="register-org-confirm-password"
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
      <LegalConsentField consent={legal} id="register-org-legal" />
      <button type="submit" disabled={!canSubmit} className={`w-full ${btnPrimary}`}>
        {t('auth.register.createOrgSubmit')}
      </button>
    </form>
  )
}

function TokenForm({
  onError,
  minLength,
}: {
  onError: (message: string) => void
  minLength: number
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const legal = useLegalConsent()

  const mismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !submitting && isPasswordValid(password, minLength) && !mismatch && legal.ready

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    onError('')
    if (password !== confirmPassword) {
      onError(t('auth.register.passwordMismatchError'))
      return
    }
    setSubmitting(true)
    try {
      const result = await apiFetch<InvitationTokenRedeemResponse>('/invitation-tokens/redeem', {
        method: 'POST',
        body: JSON.stringify({
          token,
          account: { email, password, full_name: fullName, accepted_legal: legal.payload },
        }),
      })
      await refresh()
      navigate('/', {
        state: {
          justRequestedAccess: true,
          organizationName: result.organization_name,
          organizationDomain: result.organization_domain,
        },
      })
    } catch (err) {
      if (legal.handleError(err)) onError(t('legal.consent.outdatedError'))
      else onError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="block text-sm" htmlFor="register-token-token">
        {t('auth.register.tokenLabel')}
      </label>
      <input
        spellCheck={false}
        autoComplete="off"
        id="register-token-token"
        name="token"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        className={inputBase}
        required
      />
      <label className="block text-sm" htmlFor="register-token-full-name">
        {t('auth.register.fullNameLabel')}
      </label>
      <input
        spellCheck={false}
        id="register-token-full-name"
        name="name"
        autoComplete="name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        className={inputBase}
        required
      />
      <label className="block text-sm" htmlFor="register-token-email">
        {t('auth.register.emailLabel')}
      </label>
      <input
        spellCheck={false}
        id="register-token-email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('auth.register.emailPlaceholder')}
        className={inputBase}
        required
      />
      <label className="block text-sm" htmlFor="register-token-password">
        {t('auth.register.passwordLabel')}
      </label>
      <input
        id="register-token-password"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputBase}
        required
      />
      <PasswordRequirementsList password={password} minLength={minLength} />
      <label className="block text-sm" htmlFor="register-token-confirm-password">
        {t('auth.register.confirmPasswordLabel')}
      </label>
      <input
        id="register-token-confirm-password"
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
      <LegalConsentField consent={legal} id="register-token-legal" />
      <button type="submit" disabled={!canSubmit} className={`w-full ${btnPrimary}`}>
        {t('auth.register.redeemTokenSubmit')}
      </button>
    </form>
  )
}

export function RegisterCard() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<RegisterMode>('choice')
  const [error, setError] = useState('')
  // The deployment's tenancy rules: "single" (once founded) and "managed"
  // close "Set up my organization". Unknown (still loading, or failed)
  // keeps it -- the server refuses anyway.
  const policy = useApiResource<InstancePolicy>('/instance/policy')
  const canFoundOrganization = policy.data?.can_found_organization !== false
  const minLength = Math.max(policy.data?.password_min_length ?? 8, 8)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t('auth.register.title')}
      </h1>

      {mode === 'choice' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMode('plain')}
            className="w-full rounded-sm border border-paper-line px-3 py-3 text-left text-sm hover:border-accent dark:border-line"
          >
            <span className="block font-medium">{t('auth.register.choosePlainTitle')}</span>
            <span className="block text-paper-ink/60 dark:text-fg-muted">
              {/* Where only the operator founds organizations, a role comes
                  from an existing one's Exercise Program Manager. */}
              {canFoundOrganization
                ? t('auth.register.choosePlainSubtitle')
                : t('auth.register.choosePlainSubtitleManaged')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode('token')}
            className="w-full rounded-sm border border-paper-line px-3 py-3 text-left text-sm hover:border-accent dark:border-line"
          >
            <span className="block font-medium">{t('auth.register.chooseTokenTitle')}</span>
            <span className="block text-paper-ink/60 dark:text-fg-muted">
              {t('auth.register.chooseTokenSubtitle')}
            </span>
          </button>
          {canFoundOrganization && (
            <button
              type="button"
              onClick={() => setMode('organization')}
              className="w-full rounded-sm border border-paper-line px-3 py-3 text-left text-sm hover:border-accent dark:border-line"
            >
              <span className="block font-medium">{t('auth.register.chooseOrgTitle')}</span>
              <span className="block text-paper-ink/60 dark:text-fg-muted">
                {t('auth.register.chooseOrgSubtitle')}
              </span>
            </button>
          )}
        </div>
      )}

      {mode === 'plain' && <PlainForm onError={setError} minLength={minLength} />}
      {mode === 'organization' && <OrganizationForm onError={setError} minLength={minLength} />}
      {mode === 'token' && <TokenForm onError={setError} minLength={minLength} />}

      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}

      {mode !== 'choice' && (
        <button
          type="button"
          onClick={() => setMode('choice')}
          className={`text-sm underline ${linkAccent}`}
        >
          {t('auth.register.back')}
        </button>
      )}

      <p className="text-center text-sm text-paper-ink/60 dark:text-fg-muted">
        {t('auth.register.haveAccount')}{' '}
        <Link to="/login" className={`${linkAccent} underline`}>
          {t('auth.register.loginLink')}
        </Link>
      </p>
    </div>
  )
}
