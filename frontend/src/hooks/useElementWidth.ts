import { useCallback, useRef, useState } from 'react'

/** An element's rendered width, kept current as it resizes: a callback ref
 * and the width (0 until measured, or where ResizeObserver doesn't exist).
 * The observer is let go when the element goes. */
export function useElementWidth<T extends HTMLElement>(): [(node: T | null) => void, number] {
  const [width, setWidth] = useState(0)
  const observer = useRef<ResizeObserver | null>(null)
  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect()
    observer.current = null
    if (!node || typeof ResizeObserver !== 'function') return
    const measure = () => setWidth(node.getBoundingClientRect().width)
    measure()
    observer.current = new ResizeObserver(measure)
    observer.current.observe(node)
  }, [])
  return [ref, width]
}
