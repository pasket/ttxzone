import { useCallback, useState } from 'react'

const KEYS = {
  presence: 'ttx_projector_presence',
  storyline: 'ttx_projector_storyline',
} as const

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'folded'
  } catch {
    // Storage unavailable: unfolded, the default.
    return false
  }
}

function remember(key: string, folded: boolean) {
  try {
    if (folded) localStorage.setItem(key, 'folded')
    else localStorage.removeItem(key)
  } catch {
    // Not remembered; the panel still folds.
  }
}

/** Whether the projected Playground's presence column and storyline are
 * folded: both open by default, each remembered on this device. */
export function useProjectorFold(panel: keyof typeof KEYS) {
  const key = KEYS[panel]
  const [folded, setFolded] = useState(() => read(key))
  const toggle = useCallback(() => {
    setFolded((current) => {
      remember(key, !current)
      return !current
    })
  }, [key])
  return { folded, toggle }
}
