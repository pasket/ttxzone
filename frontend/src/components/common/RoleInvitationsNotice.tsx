import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary } from '../../lib/buttonStyles'
import type {
  MyRoleInvitation,
  MyRoleInvitationListResponse,
  OrgRole,
  RoleInvitationAcceptResponse,
} from '../../lib/types'
import { ButtonSpinner } from './ButtonSpinner'

/** Long role names: the offer is a sentence, not a label. */
const ROLE_NAME_KEYS = {
  program_manager: 'roleInvitations.roleNames.programManager',
  planner: 'roleInvitations.roleNames.planner',
  observer: 'roleInvitations.roleNames.observer',
  evaluator: 'roleInvitations.roleNames.evaluator',
} as const satisfies Record<OrgRole, string>

/** Organizations offering the signed-in account a role
 * (GET /role-invitations/mine): each with Accept and Decline. Under the
 * header of the module layouts (`banner`) and inside the Waiting Room
 * (`card`, an account with no role yet). Nothing while there are none,
 * or where the face doesn't serve them. */
export function RoleInvitationsNotice({ variant = 'banner' }: { variant?: 'banner' | 'card' }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { refresh, status } = useAuth()
  // Only for someone signed in (the Waiting Room renders before that's
  // settled).
  const invitations = useApiResource<MyRoleInvitationListResponse>(
    status === 'ready' ? '/role-invitations/mine' : null,
  )
  const [busy, setBusy] = useState<{ id: string; action: 'accept' | 'decline' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const items = invitations.data?.items ?? []
  if (items.length === 0) return null

  const roleNames = (roles: OrgRole[]) => roles.map((role) => t(ROLE_NAME_KEYS[role])).join(', ')

  async function answer(item: MyRoleInvitation, action: 'accept' | 'decline') {
    setBusy({ id: item.id, action })
    setError(null)
    const organization = item.organization_name
    try {
      if (action === 'accept') {
        const result = await apiFetch<RoleInvitationAcceptResponse>(
          `/role-invitations/${item.id}/accept`,
          { method: 'POST' },
        )
        showToast(
          result.roles.length > 0
            ? t('roleInvitations.acceptedToast', { organization })
            : t('roleInvitations.acceptedNothingToast', { organization }),
        )
        await refresh()
      } else {
        await apiFetch(`/role-invitations/${item.id}/decline`, { method: 'POST' })
        showToast(t('roleInvitations.declinedToast', { organization }))
      }
      invitations.refetch()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusy(null)
    }
  }

  const wrapper =
    variant === 'banner'
      ? 'border-b border-panel-line bg-panel px-4 py-3 text-sm'
      : 'rounded-sm border border-panel-line bg-panel p-4 text-left text-sm'

  return (
    <section aria-labelledby="role-invitations-title" className={wrapper}>
      <h2 id="role-invitations-title" className="font-medium">
        {t('roleInvitations.title', { count: items.length })}
      </h2>
      <ul className="mt-2 space-y-3">
        {items.map((item) => {
          const organization = item.organization_domain
            ? `${item.organization_name} (${item.organization_domain})`
            : item.organization_name
          const roles = roleNames(item.roles)
          return (
            <li
              key={item.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-paper-ink/80 dark:text-fg-muted">
                {item.invited_by_name
                  ? t('roleInvitations.offer', {
                      inviter: item.invited_by_name,
                      organization,
                      roles,
                    })
                  : t('roleInvitations.offerNoInviter', { organization, roles })}
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void answer(item, 'decline')}
                  disabled={busy !== null}
                  aria-label={t('roleInvitations.declineLabel', {
                    organization: item.organization_name,
                  })}
                  className={btnSecondary}
                >
                  {busy?.id === item.id && busy.action === 'decline' ? (
                    <ButtonSpinner />
                  ) : (
                    t('roleInvitations.decline')
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => void answer(item, 'accept')}
                  disabled={busy !== null}
                  aria-label={t('roleInvitations.acceptLabel', {
                    organization: item.organization_name,
                  })}
                  className={btnPrimary}
                >
                  {busy?.id === item.id && busy.action === 'accept' ? (
                    <ButtonSpinner />
                  ) : (
                    t('roleInvitations.accept')
                  )}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      {error && (
        <p className="mt-2 text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
    </section>
  )
}
