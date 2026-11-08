import { useCallback, useEffect, useState, type RefObject } from 'react'

import { useMaximize } from './useMaximize'

/** The stage shown on a projector: the browser's full screen when it has
 * one (Escape is the browser's), else the element raised over the page
 * (`useMaximize`: Escape restores, focus back on `toggleRef`). Nothing
 * reloads either way: it's the same element, shown larger. */
export function usePresentation(
  ref: RefObject<HTMLElement | null>,
  toggleRef: RefObject<HTMLElement | null>,
) {
  const [fullscreen, setFullscreen] = useState(false)
  const [overlay, setOverlay] = useState(false)

  useEffect(() => {
    // The element may render after this runs (a stage with no inject
    // yet), so it's read when the full screen changes.
    let presented: HTMLElement | null = null
    const sync = () => {
      const element = ref.current
      const was = presented
      presented = element && document.fullscreenElement === element ? element : null
      setFullscreen(presented !== null)
      // Out of the full screen: back on the button that went into it.
      if (was && !presented) {
        requestAnimationFrame(() => toggleRef.current?.focus({ preventScroll: true }))
      }
    }
    document.addEventListener('fullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      // Leaving the page while presented leaves the full screen too.
      if (presented && document.fullscreenElement === presented) {
        void document.exitFullscreen?.().catch(() => {})
      }
    }
  }, [ref, toggleRef])

  const restore = useCallback(() => setOverlay(false), [])
  useMaximize({ maximized: overlay, onRestore: restore, panelRef: ref, toggleRef })

  const toggle = useCallback(() => {
    if (fullscreen) {
      void document.exitFullscreen?.().catch(() => {})
      return
    }
    if (overlay) {
      setOverlay(false)
      return
    }
    const element = ref.current
    if (element && typeof element.requestFullscreen === 'function') {
      // Refused (a browser policy, an iframe without permission): raised
      // over the page instead.
      element.requestFullscreen().catch(() => setOverlay(true))
    } else {
      setOverlay(true)
    }
  }, [fullscreen, overlay, ref])

  return { presenting: fullscreen || overlay, fullscreen, toggle }
}
