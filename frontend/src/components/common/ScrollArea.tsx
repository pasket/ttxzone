import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** A box that grows with its content up to `maxClass` (a Tailwind max-height),
 * then scrolls. Only when it does overflow it joins the tab order (so the
 * keyboard can scroll it, named by `label`) and fades its bottom edge as
 * a hint that there is more below; at the end the fade goes. */
export function ScrollArea({
  label,
  maxClass,
  className = '',
  children,
}: {
  label: string
  maxClass: string
  className?: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflow, setOverflow] = useState(false)
  const [atEnd, setAtEnd] = useState(true)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const measure = () => {
      const overflowing = element.scrollHeight > element.clientHeight + 1
      setOverflow(overflowing)
      setAtEnd(!overflowing || element.scrollTop + element.clientHeight >= element.scrollHeight - 1)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    for (const child of Array.from(element.children)) observer.observe(child)
    return () => observer.disconnect()
  }, [children])

  return (
    <div
      ref={ref}
      tabIndex={overflow ? 0 : undefined}
      role={overflow ? 'region' : undefined}
      aria-label={overflow ? label : undefined}
      onScroll={(event) => {
        const element = event.currentTarget
        setAtEnd(element.scrollTop + element.clientHeight >= element.scrollHeight - 1)
      }}
      className={`${maxClass} overflow-y-auto overscroll-contain rounded-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
        overflow ? 'pr-2' : ''
      } ${
        overflow && !atEnd
          ? '[mask-image:linear-gradient(to_bottom,black_calc(100%-1.5rem),transparent)]'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
