/** Where the user was last working (a module page: path + query), so
 * leaving for Preferences and coming back through the logo returns there
 * instead of to the saved default workspace -- which is for starting a
 * session, not for resuming one. Kept per browser tab (sessionStorage)
 * and per user; cleared on logout. Storage can be unavailable: then the
 * default workspace applies, as before. */

const KEY = 'ttx_last_workspace'

interface Entry {
  userId: string
  path: string
}

export function rememberWorkspace(userId: string, path: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ userId, path } satisfies Entry))
  } catch {
    // Not remembered: the logo falls back to the default workspace.
  }
}

export function recallWorkspace(userId: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const entry = raw ? (JSON.parse(raw) as Partial<Entry>) : null
    return entry?.userId === userId && typeof entry.path === 'string' ? entry.path : null
  } catch {
    return null
  }
}

export function forgetWorkspace() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing stored.
  }
}
