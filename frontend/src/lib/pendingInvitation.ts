/** An email invitation's link token, kept while its holder signs in
 * (`/join` -> `/login` -> back to `/join`). Per tab, never in a URL: the
 * token must not stay in the history nor reach a server log. */
const PENDING_INVITATION_KEY = 'ttx_pending_invitation'

export function rememberPendingInvitation(token: string): void {
  try {
    sessionStorage.setItem(PENDING_INVITATION_KEY, token)
  } catch {
    // Storage unavailable: the link has to be opened again after signing in.
  }
}

export function readPendingInvitation(): string | null {
  try {
    return sessionStorage.getItem(PENDING_INVITATION_KEY)
  } catch {
    return null
  }
}

export function clearPendingInvitation(): void {
  try {
    sessionStorage.removeItem(PENDING_INVITATION_KEY)
  } catch {
    // Nothing to clear.
  }
}
