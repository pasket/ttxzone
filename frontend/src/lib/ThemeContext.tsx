import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { applyTheme, persistTheme, readStoredTheme, ThemeContext } from './themeStore'
import type { Theme } from './themeStore'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme())

  // Reconciles the DOM with the stored preference on mount -- index.html's
  // static class="dark" is only the pre-hydration default (no flash for
  // the common case), this brings it in line with an actual 'light' pick.
  // setTheme already applies changes directly, so re-running this on every
  // theme change is redundant but harmless (idempotent DOM toggle).
  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function setTheme(next: Theme) {
    persistTheme(next)
    applyTheme(next)
    setThemeState(next)
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
}
