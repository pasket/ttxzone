const RELOADED_AT_KEY = 'ttx-stale-chunk-reload'
const RELOAD_GUARD_MS = 30_000

/** False right after one such reload, or with no storage to remember it
 * in: better no reload than a loop. */
function mayReload(now: number): boolean {
  try {
    if (now - Number(sessionStorage.getItem(RELOADED_AT_KEY)) < RELOAD_GUARD_MS) return false
    sessionStorage.setItem(RELOADED_AT_KEY, String(now))
    return true
  } catch {
    return false
  }
}

/** A tab open across a deployment asks for chunks the new build no longer
 * has: a reload brings the new index.html and its names. If that doesn't
 * help (no network), the error is left to `RouteBoundary`. */
export function reloadOnStaleChunks(): void {
  window.addEventListener('vite:preloadError', () => {
    if (mayReload(Date.now())) window.location.reload()
  })
}
