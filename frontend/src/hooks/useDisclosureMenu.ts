import { useCallback } from 'react'

/** Menu behaviour for a <details> disclosure used as a dropdown: native
 * <details> only toggles from its <summary>, so Escape (focus back on the
 * summary), a click outside it and picking an item close it here. Returns
 * a callback ref for the <details> element. */
export function useDisclosureMenu() {
  return useCallback((details: HTMLDetailsElement | null) => {
    if (!details) return
    const summary = () => details.querySelector('summary')
    const close = () => {
      details.open = false
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !details!.open) return
      event.stopPropagation()
      close()
      summary()?.focus()
    }
    function onPointerDown(event: PointerEvent) {
      if (details!.open && !details!.contains(event.target as Node)) close()
    }
    function onClick(event: MouseEvent) {
      const item = (event.target as Element).closest('a, button')
      if (item && details!.contains(item) && !summary()?.contains(item)) close()
    }
    details.addEventListener('keydown', onKeyDown)
    details.addEventListener('click', onClick)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      details.removeEventListener('keydown', onKeyDown)
      details.removeEventListener('click', onClick)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [])
}
