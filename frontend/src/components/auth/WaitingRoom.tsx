import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router-dom'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import type { DomainOrganizationListResponse, InvitationTokenRedeemResponse } from '../../lib/types'
import { RoleInvitationsNotice } from '../common/RoleInvitationsNotice'

export function WaitingRoom() {
  const { t } = useTranslation()
  const { refresh, user, logout } = useAuth()
  const navigate = useNavigate()
  // Where founding is controlled ("single"/"managed"), a newcomer whose
  // email domain an organization allows is told which one to ask. The
  // server answers empty in "open".
  const canFoundOrganization = user?.can_found_organization !== false
  const domainOrganizations = useApiResource<DomainOrganizationListResponse>(
    canFoundOrganization ? null : '/instance/domain-organizations',
  )
  const domainOrganizationNames = (domainOrganizations.data?.items ?? []).map((o) => o.name)
  const location = useLocation()
  const navState = location.state as {
    justRequestedAccess?: boolean
    organizationName?: string
    organizationDomain?: string | null
  } | null

  const [token, setToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(Boolean(navState?.justRequestedAccess))
  const [organizationName, setOrganizationName] = useState<string | null>(
    navState?.organizationName ?? null,
  )
  const [organizationDomain, setOrganizationDomain] = useState<string | null>(
    navState?.organizationDomain ?? null,
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await apiFetch<InvitationTokenRedeemResponse>('/invitation-tokens/redeem', {
        method: 'POST',
        body: JSON.stringify({ token }),
      })
      await refresh()
      setOrganizationName(result.organization_name)
      setOrganizationDomain(result.organization_domain)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  // No header here (no role, no module), so the way out lives on the page.
  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  const organizationDisplayName = organizationDomain
    ? `${organizationName} (${organizationDomain})`
    : organizationName

  return (
    <div className="w-full space-y-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-balance">
        {t('auth.waitingRoom.title')}
      </h1>
      {/* An organization offering this account a role: accepting it is
          the way in. */}
      <RoleInvitationsNotice variant="card" />
      {submitted ? (
        <>
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('auth.waitingRoom.submittedTitle')}
          </p>
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {organizationDisplayName
              ? t('auth.waitingRoom.submittedDescriptionOrg', {
                  organizationName: organizationDisplayName,
                })
              : t('auth.waitingRoom.submittedDescription')}
          </p>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className={`text-sm underline ${linkAccent}`}
          >
            {t('auth.waitingRoom.submitAnotherLink')}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('auth.waitingRoom.description')}
          </p>
          <form onSubmit={handleSubmit} className="space-y-2 text-left">
            <label className="block text-sm" htmlFor="waiting-room-token">
              {t('auth.waitingRoom.tokenLabel')}
            </label>
            <input
              spellCheck={false}
              autoComplete="off"
              id="waiting-room-token"
              name="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className={inputBase}
              required
            />
            {error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting} className={`w-full ${btnPrimary}`}>
              {t('auth.waitingRoom.submit')}
            </button>
          </form>
          {/* No invitation to wait for: found an organization instead --
                or, where the deployment doesn't allow that, ask the one
                the email's domain belongs to. */}
          {canFoundOrganization ? (
            <Link to="/account/organizations/new" className={`text-sm underline ${linkAccent}`}>
              {t('auth.waitingRoom.createOrganizationLink')}
            </Link>
          ) : (
            <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {domainOrganizationNames.length > 0
                ? t('auth.waitingRoom.domainOrganization', {
                    organizationName: domainOrganizationNames.join(' · '),
                  })
                : t('auth.waitingRoom.managedDeployment')}
            </p>
          )}
        </>
      )}
      <div className="border-t border-paper-line pt-4 dark:border-line">
        <button
          type="button"
          onClick={() => void handleLogout()}
          className={`text-sm underline ${linkAccent}`}
        >
          {t('nav.logout')}
        </button>
      </div>
    </div>
  )
}
