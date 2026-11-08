import { useLayoutEffect, type RefObject } from 'react'

/** Fits a textarea to its content on every change and whenever its
 * width changes (a wider dialog wraps fewer lines), up to its CSS
 * max-height, where it starts to scroll. */
export function useAutoGrow(ref: RefObject<HTMLTextAreaElement | null>, value: string) {
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const fit = () => {
      element.style.height = 'auto'
      // +1: sub-pixel line heights would otherwise leave a scrollbar for a
      // text that fits. The scrollbar only shows once it hits the cap.
      element.style.height = `${element.scrollHeight + element.offsetHeight - element.clientHeight + 1}px`
      element.style.overflowY = element.scrollHeight > element.clientHeight + 1 ? 'auto' : 'hidden'
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return
    let width = element.clientWidth
    const observer = new ResizeObserver(() => {
      if (element.clientWidth === width) return
      width = element.clientWidth
      fit()
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref, value])
}
