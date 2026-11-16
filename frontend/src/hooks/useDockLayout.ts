import { useCallback, useState, useSyncExternalStore } from 'react'

/** The dock's narrowest width, in px. */
export const DOCK_MIN = 280

interface DockLayout {
  /** px; null for the module's default (360 px, or half the page). */
  width: number | null
  folded: boolean
}

function read(key: string): DockLayout {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? 'null') as Partial<DockLayout> | null
    return {
      width: typeof saved?.width === 'number' ? saved.width : null,
      folded: saved?.folded === true,
    }
  } catch {
    return { width: null, folded: false }
  }
}

function persist(key: string, layout: DockLayout): void {
  try {
    localStorage.setItem(key, JSON.stringify(layout))
  } catch {
    // Not remembered on this device; resizing still works.
  }
}

/** The Playground dock's width and fold, remembered per module on this
 * device (a cosmetic preference, like the Primary Menu's fold). */
export function useDockLayout(module: string) {
  const key = `ttx_dock_${module}`
  const [layout, setLayout] = useState(() => read(key))
  const update = useCallback(
    (change: Partial<DockLayout>) =>
      setLayout((current) => {
        const next = { ...current, ...change }
        persist(key, next)
        return next
      }),
    [key],
  )
  return {
    ...layout,
    setWidth: useCallback((width: number) => update({ width }), [update]),
    toggleFold: useCallback(() => update({ folded: !layout.folded }), [update, layout.folded]),
  }
}

const WIDE = { lg: '(min-width: 1024px)', md: '(min-width: 768px)' }

/** Whether the page is wide enough for side-by-side columns: from `lg`,
 * or from `md` for the Control center (on a tablet held upright the
 * Controller sees the stage and what to deliver at once; a Player's
 * stage keeps the whole width there). Without matchMedia (tests, old
 * browsers) it's taken as wide. */
export function useIsWide(from: 'lg' | 'md' = 'lg'): boolean {
  const media = WIDE[from]
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const query = window.matchMedia(media)
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    [media],
  )
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia !== 'function' || window.matchMedia(media).matches,
    () => true,
  )
}
