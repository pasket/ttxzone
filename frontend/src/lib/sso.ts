/** Single sign-on through the deployment's OpenID Connect provider
 * (docs/architecture/sso.md). Every trip to the provider is a full-page
 * navigation; the server sends the browser back into the app, an outcome
 * in the URL: `?sso_error=SSO_<REASON>` on failure, `?sso_linked=1` after
 * linking, `?sso_confirmed=1` after a step-up, `#mfa=<token>` when the
 * account's own TOTP must finish the sign-in. */

import { API_BASE, apiFetch } from './api'
import type { OidcRedirectResponse } from './types'

/** Where the sign-in button sends the browser. */
export function ssoStartUrl(returnTo: string): string {
  return `${API_BASE}/auth/oidc/start?return_to=${encodeURIComponent(returnTo)}`
}

/** An in-app path to land on, or '/' (never another origin, never the
 * sign-in page itself). */
export function safeReturnTo(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.startsWith('/login')) {
    return '/'
  }
  return path
}

/** The current page, to come back to after the provider. */
export function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`
}

/** Asks the server for the provider's address (step-up or linking) and
 * goes there. */
export async function goToProvider(
  purpose: 'step-up' | 'link',
  returnTo: string = currentPath(),
): Promise<void> {
  const { authorize_url } = await apiFetch<OidcRedirectResponse>(`/auth/oidc/${purpose}`, {
    method: 'POST',
    body: JSON.stringify({ return_to: returnTo }),
  })
  window.location.assign(authorize_url)
}

export const SSO_ERROR_KEYS = {
  SSO_UNAVAILABLE: 'auth.sso.errors.unavailable',
  SSO_ACCOUNT_NOT_FOUND: 'auth.sso.errors.accountNotFound',
  SSO_LINK_REQUIRED: 'auth.sso.errors.linkRequired',
  SSO_EMAIL_UNVERIFIED: 'auth.sso.errors.emailUnverified',
  SSO_SUSPENDED: 'auth.login.accountSuspended',
  SSO_CANCELLED: 'auth.sso.errors.cancelled',
  SSO_STATE_EXPIRED: 'auth.sso.errors.expired',
  SSO_PROVIDER_UNREACHABLE: 'auth.sso.errors.unreachable',
  SSO_IDENTITY_TAKEN: 'auth.sso.errors.identityTaken',
  SSO_ALREADY_LINKED: 'auth.sso.errors.alreadyLinked',
  SSO_IDENTITY_MISMATCH: 'auth.sso.errors.identityMismatch',
  SSO_MFA_REQUIRED: 'auth.sso.errors.mfaRequired',
  SSO_NOT_RECENT: 'auth.sso.errors.notRecent',
} as const

/** The message for an `sso_error` code; anything else reads as a generic
 * failure (a bad state or token says nothing useful to the person). */
export function ssoErrorKey(code: string) {
  return code in SSO_ERROR_KEYS
    ? SSO_ERROR_KEYS[code as keyof typeof SSO_ERROR_KEYS]
    : ('auth.sso.errors.generic' as const)
}
