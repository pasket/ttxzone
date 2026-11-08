import { useEffect, useRef, type RefObject } from 'react'

// An open dialog or menu handles its own keys (Escape, Tab) first --
// not one in what's kept mounted but hidden (the page under the projector).
function overlayOpen(): boolean {
  return [...document.querySelectorAll('[role="dialog"], details[open]')].some(
    (element) => !element.closest('[hidden]'),
  )
}

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/** A panel raised over the page (the storyline map maximized, the stage
 * presented without the Fullscreen API): while `maximized`, the page
 * behind doesn't scroll, focus moves into the panel and Tab stays in it,
 * and Escape calls `onRestore` -- after any dialog or menu open in it
 * closed on its own. On restore, focus goes back to `toggleRef` (the
 * button that maximized it), without scrolling. */
export function useMaximize({
  maximized,
  onRestore,
  panelRef,
  toggleRef,
}: {
  maximized: boolean
  onRestore: () => void
  /** The raised panel; it needs `tabIndex={-1}` to take focus itself. */
  panelRef: RefObject<HTMLElement | null>
  toggleRef?: RefObject<HTMLElement | null>
}) {
  // The latest callback, without re-running the effect (and moving focus)
  // on every render.
  const restore = useRef(onRestore)
  useEffect(() => {
    restore.current = onRestore
  }, [onRestore])

  // Read when it restores: the button may have been rendered anew (the
  // projector's own way out gives way to the page's).
  const focusToggle = () => {
    const toggle = toggleRef?.current
    if (toggle?.isConnected) toggle.focus({ preventScroll: true })
  }
  const focusToggleRef = useRef(focusToggle)
  useEffect(() => {
    focusToggleRef.current = focusToggle
  })

  useEffect(() => {
    if (!maximized) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus({ preventScroll: true })

    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || overlayOpen()) return
      if (event.key === 'Escape') {
        restore.current()
        return
      }
      const panel = panelRef.current
      if (event.key !== 'Tab' || !panel) return
      // Not what's kept mounted but hidden (the page under the projector).
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => !element.closest('[hidden]'),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      const outside = !(active instanceof Node) || !panel.contains(active)
      if (event.shiftKey && (outside || active === first || active === panel)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (outside || active === last)) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    const restoreFocus = focusToggleRef.current
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
      restoreFocus()
    }
  }, [maximized, panelRef])
}
