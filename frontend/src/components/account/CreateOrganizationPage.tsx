import { startTransition, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase, inputDisabled } from '../../lib/buttonStyles'
import { panelFormActions } from '../../lib/panelStyles'
import type { OrganizationProfile } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { Panel } from '../common/Panel'
import { Header } from '../layout/Header'

const labelClass = 'block text-sm text-paper-ink dark:text-fg'

/** Founding refusals the user can act on, in their own words; anything
 * else falls back to the server's message. */
const ERROR_KEYS = {
  FREE_EMAIL_DOMAIN_BLOCKED: 'account.createOrganization.errors.FREE_EMAIL_DOMAIN_BLOCKED',
  DOMAIN_NOT_ROUTABLE: 'account.createOrganization.errors.DOMAIN_NOT_ROUTABLE',
  ORG_LIMIT_REACHED: 'account.createOrganization.errors.ORG_LIMIT_REACHED',
  TENANCY_SINGLE_EXISTS: 'account.createOrganization.errors.TENANCY_SINGLE_EXISTS',
  TENANCY_MANAGED_ONLY: 'account.createOrganization.errors.TENANCY_MANAGED_ONLY',
  TENANCY_ORG_LIMIT: 'account.createOrganization.errors.TENANCY_ORG_LIMIT',
} as const

/** Any signed-in account founds an organization of its own -- reached from
 * the avatar menu (and the Waiting Room), never the Primary Menu: it isn't
 * work inside the current context but a new context. Like Preferences, it
 * has the header but no module menu. The founder becomes the new org's
 * Program Manager and one of its Planners, then lands on its Admin. */
export function CreateOrganizationPage() {
  const { t } = useTranslation()
  const { user, refresh, setActiveOrganizationId } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const domain = user?.email.split('@').pop() ?? ''

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const organization = await apiFetch<OrganizationProfile>('/organizations/mine', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim() }),
      })
      await refresh()
      showToast(t('account.createOrganization.created'))
      startTransition(() => {
        setActiveOrganizationId(organization.id, null)
        navigate('/admin')
      })
    } catch (err) {
      if (err instanceof ApiError) {
        const key = ERROR_KEYS[err.code as keyof typeof ERROR_KEYS]
        setError(key ? t(key) : err.message)
      } else {
        setError(t('auth.common.genericError'))
      }
      setSubmitting(false)
    }
  }

  // The deployment's tenancy rules don't let accounts found organizations
  // (an old link or bookmark): back home. Not while a submit is landing.
  if (user?.can_found_organization === false && !submitting) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen flex-col bg-paper text-paper-ink dark:bg-ink dark:text-fg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-cta focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink"
      >
        {t('common.skipToContent')}
      </a>
      <Header />
      <main id="main-content" className="flex-1 p-6">
        <h1 className="sr-only">{t('account.createOrganization.title')}</h1>
        <form onSubmit={handleSubmit} className="w-full max-w-xl">
          <Panel
            title={t('account.createOrganization.title')}
            description={
              <HelpText
                id="account.createOrganization.description"
                text={t('account.createOrganization.description')}
              />
            }
            footer={
              <div className={panelFormActions}>
                <Link to="/" className={btnSecondary}>
                  {t('account.createOrganization.cancel')}
                </Link>
                <button
                  type="submit"
                  disabled={submitting || name.trim() === ''}
                  className={btnPrimary}
                >
                  {submitting ? <ButtonSpinner /> : t('account.createOrganization.submit')}
                </button>
              </div>
            }
          >
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="create-organization-name">
                {t('account.createOrganization.nameLabel')}
              </label>
              <input
                id="create-organization-name"
                name="organization-name"
                autoComplete="organization"
                maxLength={255}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputBase}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass} htmlFor="create-organization-domain">
                {t('account.createOrganization.domainLabel')}
              </label>
              <input
                id="create-organization-domain"
                name="organization-domain"
                autoComplete="off"
                spellCheck={false}
                value={domain}
                readOnly
                aria-describedby="create-organization-domain-hint"
                className={inputDisabled}
              />
              <p
                id="create-organization-domain-hint"
                className="text-xs text-paper-ink/60 dark:text-fg-faint"
              >
                {t('account.createOrganization.domainHint')}
              </p>
            </div>
            {error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error}
              </p>
            )}
          </Panel>
        </form>
      </main>
    </div>
  )
}
