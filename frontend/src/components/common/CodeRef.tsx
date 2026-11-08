import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { CODE_PATTERN, shortTitle } from '../../lib/codeRef'

/** One coded row named the app's way (see lib/codeRef.ts), in the same
 * type as a checkbox option with its description (the needs analysis'
 * regulation list): the code as the label -- the body font, primary
 * colour -- then its title as the description -- muted -- under it in a
 * table cell (`stacked`, smaller and cut by the cell's width), or after a
 * thin "|" on one line (`inline`, cut at 40 characters). The full title is
 * on hover; screen readers hear "OBJ-01, Contain the…", not the bar. With
 * no code yet, `pending` takes its place. */
export function CodeRef({
  code,
  title,
  pending = '',
  variant = 'inline',
  invalid = false,
  wrap = false,
  strong = false,
  className = '',
}: {
  code: string
  title: string
  pending?: string
  variant?: 'stacked' | 'inline'
  /** The report flags the row: code and title in the danger colour. */
  invalid?: boolean
  /** Stacked: the whole title, wrapped, instead of one cut line -- for a
   * table whose first column is the row's own text. */
  wrap?: boolean
  /** Stacked: the title in the body size and colour, for a row whose
   * title is its name (with longer text muted under it). */
  strong?: boolean
  className?: string
}) {
  const ref = code || pending
  const trimmed = title.trim()
  const codeClass = `tabular-nums ${
    invalid
      ? 'text-danger-fg'
      : code
        ? 'text-paper-ink dark:text-fg'
        : 'text-paper-ink/60 italic dark:text-fg-faint'
  }`
  const titleTone = invalid ? 'text-danger-fg' : 'text-paper-ink/60 dark:text-fg-faint'
  if (variant === 'stacked') {
    return (
      <span className={`block min-w-0 ${className}`}>
        <span translate="no" className={`block text-sm ${codeClass}`}>
          {ref}
        </span>
        {trimmed && (
          <span
            title={wrap ? undefined : trimmed}
            className={`block ${strong ? 'text-sm font-medium' : 'text-xs'} ${wrap ? 'text-pretty break-words' : 'max-w-xs truncate'} ${strong && !invalid ? 'text-paper-ink dark:text-fg' : titleTone}`}
          >
            <span className="sr-only">, </span>
            {trimmed}
          </span>
        )}
      </span>
    )
  }
  const short = shortTitle(trimmed)
  return (
    <span className={className} title={short !== trimmed ? trimmed : undefined}>
      <span translate="no" className={codeClass}>
        {ref}
      </span>
      {short && (
        <>
          <span aria-hidden="true" className="mx-1.5 text-paper-ink/35 dark:text-fg-faint">
            |
          </span>
          <span className="sr-only">, </span>
          <span className={titleTone}>{short}</span>
        </>
      )}
    </span>
  )
}

export interface CodeRefItem {
  key: string
  code: string
  title: string
}

/** Several coded rows: one per line, never run together with commas.
 * Past `visible` (4), the rest wait behind a "+N more" link that unfolds
 * them (and "Show less" folds them back). Nothing: "—". */
export function CodeRefList({
  items,
  pending = '',
  visible = 4,
  wrap = false,
  className = '',
}: {
  items: CodeRefItem[]
  pending?: string
  visible?: number
  /** Let a long line wrap inside a narrow column instead of overflowing it. */
  wrap?: boolean
  className?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  if (items.length === 0) return <span className={className}>—</span>
  const folded = items.length > visible && !open
  const shown = folded ? items.slice(0, visible) : items
  return (
    <span className={`block space-y-0.5 ${className}`}>
      <ul className="space-y-0.5">
        {shown.map((item) => (
          <li key={item.key} className={wrap ? 'break-words' : 'whitespace-nowrap'}>
            <CodeRef code={item.code} title={item.title} pending={pending} />
          </li>
        ))}
      </ul>
      {items.length > visible && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className="rounded-xs text-xs font-medium text-accent-fg hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          {open
            ? t('common.codeRef.less')
            : t('common.codeRef.more', { count: items.length - visible })}
        </button>
      )}
    </span>
  )
}

/** A sentence that names coded rows ("OBJ-01 | Contain…: evidence is
 * missing."): every code in it kept from translation, in the sentence's
 * own type. For messages built as plain text (validation reports, fix
 * labels). */
export function CodeText({ text }: { text: string }) {
  const parts: (string | { code: string })[] = []
  let last = 0
  for (const match of text.matchAll(CODE_PATTERN)) {
    const at = match.index ?? 0
    if (at > last) parts.push(text.slice(last, at))
    parts.push({ code: match[0] })
    last = at + match[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return (
    <>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <span key={index} translate="no">
            {part.code}
          </span>
        ),
      )}
    </>
  )
}
