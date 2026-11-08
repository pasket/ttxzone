import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import type { InstanceSettings, TenancyMode } from '../../lib/types'

export const labelClass = 'block text-sm text-paper-ink dark:text-fg'

export const MODES: TenancyMode[] = ['open', 'single', 'managed']

export const MODE_LABEL_KEYS = {
  open: 'platform.tenancy.modes.open',
  single: 'platform.tenancy.modes.single',
  managed: 'platform.tenancy.modes.managed',
} as const

export const MODE_HINT_KEYS = {
  open: 'platform.tenancy.modeHints.open',
  single: 'platform.tenancy.modeHints.single',
  managed: 'platform.tenancy.modeHints.managed',
} as const

/** Refusals the instance administrator can act on, in their own words. */
export const ERROR_KEYS = {
  TENANCY_SINGLE_EXISTS: 'platform.errors.TENANCY_SINGLE_EXISTS',
  TENANCY_ORG_LIMIT: 'platform.errors.TENANCY_ORG_LIMIT',
  TENANCY_PINNED_BY_ENV: 'platform.errors.TENANCY_PINNED_BY_ENV',
  USER_NOT_FOUND: 'platform.errors.USER_NOT_FOUND',
  ACCOUNT_SUSPENDED: 'platform.errors.ACCOUNT_SUSPENDED',
  CANNOT_SUSPEND_YOURSELF: 'platform.errors.CANNOT_SUSPEND_YOURSELF',
  LAST_INSTANCE_ADMIN: 'platform.errors.LAST_INSTANCE_ADMIN',
  ALREADY_INSTANCE_ADMIN: 'platform.errors.ALREADY_INSTANCE_ADMIN',
  NOT_INSTANCE_ADMIN: 'platform.errors.NOT_INSTANCE_ADMIN',
  INSTANCE_ADMIN_WEB_GRANTS_DISABLED: 'platform.errors.INSTANCE_ADMIN_WEB_GRANTS_DISABLED',
  AUDIT_WEBHOOK_URL_INVALID: 'platform.errors.AUDIT_WEBHOOK_URL_INVALID',
  CANNOT_MANAGE_YOURSELF: 'platform.errors.CANNOT_MANAGE_YOURSELF',
  ACCOUNT_NOT_FOUND: 'platform.errors.ACCOUNT_NOT_FOUND',
  ACCOUNT_HAS_DEPENDENCIES: 'platform.errors.ACCOUNT_HAS_DEPENDENCIES',
  REVOKE_INSTANCE_ADMIN_FIRST: 'platform.errors.REVOKE_INSTANCE_ADMIN_FIRST',
  EMAIL_ALREADY_REGISTERED: 'platform.errors.EMAIL_ALREADY_REGISTERED',
  CONFIRMATION_MISMATCH: 'platform.errors.CONFIRMATION_MISMATCH',
  AUDIT_WEBHOOK_NOT_CONFIGURED: 'platform.errors.AUDIT_WEBHOOK_NOT_CONFIGURED',
  LAST_PROGRAM_MANAGER: 'platform.errors.LAST_PROGRAM_MANAGER',
  ALREADY_PROGRAM_MANAGER: 'platform.errors.ALREADY_PROGRAM_MANAGER',
  DOMAIN_NOT_ALLOWED: 'platform.errors.DOMAIN_NOT_ALLOWED',
  FREE_EMAIL_DOMAIN_BLOCKED: 'account.createOrganization.errors.FREE_EMAIL_DOMAIN_BLOCKED',
  DOMAIN_NOT_ROUTABLE: 'account.createOrganization.errors.DOMAIN_NOT_ROUTABLE',
} as const

export function useErrorMessage() {
  const { t } = useTranslation()
  return (err: unknown) => {
    if (err instanceof ApiError) {
      const key = ERROR_KEYS[err.code as keyof typeof ERROR_KEYS]
      return key ? t(key) : err.message
    }
    return t('auth.common.genericError')
  }
}

/** Whether the deployment's rule leaves room for another organization. */
export function atLimit(settings: InstanceSettings | null | undefined) {
  if (!settings) return false
  if (settings.tenancy_mode === 'single') return settings.organization_count >= 1
  return (
    settings.max_organizations !== null && settings.organization_count >= settings.max_organizations
  )
}

export const ACCOUNTS_PAGE_SIZE = 20

export const ROLE_LABEL_KEYS = {
  program_manager: 'roles.programManager',
  planner: 'roles.planner',
  observer: 'roles.observer',
  evaluator: 'roles.evaluator',
} as const

export const badgeBase =
  'ml-2 inline-flex h-5 items-center rounded-xs px-1.5 align-middle text-xs font-medium'

/** One filter of a Platform list, kept in the URL next to useTableUrlState's
 * page/sort/search (`?status=suspended`): an unknown value reads as "all"
 * (`values` null: any value, e.g. an organization's id, which the server
 * checks), and changing it goes back to page 1 in the same URL update. */
export function useUrlFilter<T extends string>(key: string, values: readonly T[] | null) {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get(key)
  const value =
    values === null ? ((raw || null) as T | null) : (values.find((v) => v === raw) ?? null)
  function setValue(next: T | null) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next) params.set(key, next)
        else params.delete(key)
        params.delete('page')
        return params
      },
      { replace: true },
    )
  }
  return [value, setValue] as const
}
