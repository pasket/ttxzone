import { useContext } from 'react'

import { ThemeContext } from '../lib/themeStore'
import type { ThemeContextValue } from '../lib/themeStore'

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (ctx === null) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return ctx
}
