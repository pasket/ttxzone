const STORAGE_KEY = 'ttx_nav_collapsed'

/** Whether the Primary Menu is folded into its icon rail. A per-device
 * cosmetic preference like the theme (see themeStore.ts), not account
 * state. Storage can be unavailable (private window, blocked site data):
 * the menu then just starts expanded and the choice isn't remembered. */
export function readNavCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function persistNavCollapsed(collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(STORAGE_KEY, '1')
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Not remembered on this device; the toggle still works.
  }
}
