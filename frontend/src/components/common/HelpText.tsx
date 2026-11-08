import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { linkAccent } from '../../lib/buttonStyles'
import { markSeen, rememberChoice, startsOpen } from '../../lib/helpText'
import { AcronymText } from './AcronymText'

/** Whether an inline element runs over more than one line. It has a rect
 * per fragment, not per line (an <abbr> inside splits a single line in
 * three), so a second line is a rect that starts below the first one. */
function wraps(el: HTMLElement): boolean {
  const [first, ...rest] = Array.from(el.getClientRects())
  return rest.some((rect) => rect.top > first.top + first.height / 2)
}

/** A description that teaches the page the first times and then gets out
 * of the way. When it doesn't fit on one line it folds to that line, cut
 * with "…", and a quiet "Show more" opens the rest in place; one that fits
 * shows whole, with no button. Open the first time the viewer meets it,
 * folded from then on unless they open it again (lib/helpText.ts). Built
 * from spans, so it sits in the paragraph that styles the description.
 * `id` is the text's i18n key. `extra` (span content, e.g. a worked
 * example) shows under the text only while it's open, so there is
 * always something to fold. */
export function HelpText({ id, text, extra }: { id: string; text: string; extra?: ReactNode }) {
  const { t } = useTranslation()
  const textId = useId()
  const [open, setOpen] = useState(() => startsOpen(id))
  // Whether the text needs more than one line, read off the text itself:
  // folded, whether its one line is cut; open, whether it wraps. Measured
  // whenever the paragraph's box changes size (and when the text changes).
  const [overflows, setOverflows] = useState(false)
  const textRef = useRef<HTMLSpanElement | null>(null)
  const observer = useRef<ResizeObserver | null>(null)
  const containerRef = useCallback(
    (node: HTMLSpanElement | null) => {
      observer.current?.disconnect()
      observer.current = null
      if (!node || typeof ResizeObserver !== 'function') return
      const measure = () => {
        const el = textRef.current
        if (!el) return
        setOverflows(el.dataset.folded === 'true' ? el.scrollWidth > el.clientWidth + 1 : wraps(el))
      }
      observer.current = new ResizeObserver(measure)
      observer.current.observe(node)
    },
    // A new text is measured again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text],
  )
  useEffect(() => () => observer.current?.disconnect(), [])
  // Shown open with something to fold: it starts folded next time.
  const foldable = overflows || extra !== undefined
  useEffect(() => {
    if (foldable && open) markSeen(id)
  }, [id, foldable, open])

  function toggle() {
    rememberChoice(id, !open)
    setOpen(!open)
  }
  const toggleButton = (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={textId}
      onClick={toggle}
      // The app's quiet link (like "Clear filters"), a point smaller
      // than the description it follows.
      className={`${linkAccent} inline-flex min-h-6 shrink-0 items-center gap-0.5 rounded-xs text-[0.8125rem] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg`}
    >
      {open ? t('common.help.less') : t('common.help.more')}
      {/* Down to unfold, up to fold. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`h-3 w-3 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>
  )
  const folded = foldable && !open
  return (
    <span ref={containerRef} className="block">
      {folded ? (
        <span className="flex items-baseline gap-2">
          <span ref={textRef} id={textId} data-folded="true" className="min-w-0 truncate">
            <AcronymText text={text} />
          </span>
          {toggleButton}
        </span>
      ) : (
        <>
          <span ref={textRef} id={textId}>
            <AcronymText text={text} />
          </span>
          {extra !== undefined && <span className="mt-2 block">{extra}</span>}
          {foldable && <> {toggleButton}</>}
        </>
      )}
    </span>
  )
}
