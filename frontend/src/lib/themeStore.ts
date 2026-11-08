import { createContext } from 'react'

export type Theme = 'light' | 'dark'

export interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'ttx_theme'

/** No backend field on purpose -- this is a per-device cosmetic
 * preference, not account state (see 06_user_preferences.md). Defaults
 * to 'dark' when unset/invalid, matching index.html's static default so
 * a first-time visitor sees no flash. */
export function readStoredTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' ? 'light' : 'dark'
}

export function persistTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme)
}

/** Browser-chrome color per theme -- mirrors --color-ink / --color-paper
 * in index.css by hand (a <meta> can't read CSS custom properties).
 * index.html's static value is the pre-hydration dark default. */
const THEME_COLOR: Record<Theme, string> = { dark: '#0c0d10', light: '#eff1f4' }

export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme])
}
