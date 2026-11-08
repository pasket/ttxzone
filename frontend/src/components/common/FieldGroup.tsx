import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { optionalSuffix } from '../../lib/buttonStyles'

/** A framed group of a form's fields: a heading (optionally numbered)
 * with a line on what it's for, over its fields at the panel's full width.
 * Every group looks the same: a group that matters more says why in its
 * hint, never in colour (the accent is for navigation, links and focus).
 * Long forms read as a few decisions this way, and short fields can sit
 * side by side instead of in one narrow column.
 *
 * `optional` marks the title like an optional field. `collapsible` folds
 * the group behind its header (a native `<details>`, so keyboard and
 * assistive tech get it for free): open at first when it's `filled`, with
 * a one-line `summary` of what it holds shown while folded. A caller that
 * sends focus inside a folded group opens its `<details>` first. */
export function FieldGroup({
  id,
  title,
  hint,
  number,
  optional = false,
  collapsible,
  children,
}: {
  id: string
  title: string
  hint?: React.ReactNode
  number?: number
  optional?: boolean
  collapsible?: { filled: boolean; summary?: React.ReactNode }
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  // Only the first render decides: afterwards the group is the user's.
  const [initiallyOpen] = useState(() => collapsible?.filled ?? true)
  const [open, setOpen] = useState(initiallyOpen)

  const heading = (
    <h3 id={id} className="flex items-center gap-2 text-sm font-semibold text-balance">
      {number !== undefined && (
        <span className="text-paper-ink/60 tabular-nums dark:text-fg-faint">{number}</span>
      )}
      <span>
        {title}
        {optional && (
          <>
            {' '}
            <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
          </>
        )}
      </span>
    </h3>
  )
  const hintLine = hint && (
    <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">{hint}</p>
  )

  if (!collapsible) {
    return (
      <section aria-labelledby={id} className="space-y-4 rounded-sm border border-panel-line p-4">
        <header className="space-y-0.5">
          {heading}
          {hintLine}
        </header>
        {children}
      </section>
    )
  }

  return (
    <section aria-labelledby={id} className="rounded-sm border border-panel-line">
      <details
        open={initiallyOpen}
        onToggle={(event) => setOpen(event.currentTarget.open)}
        className="group"
      >
        <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-sm p-4 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg [&::-webkit-details-marker]:hidden">
          <span className="min-w-0 space-y-0.5">
            {heading}
            {hintLine}
            {!open && collapsible.summary && (
              <span className="block text-xs text-paper-ink/80 dark:text-fg-muted">
                {collapsible.summary}
              </span>
            )}
          </span>
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-paper-ink/60 transition-transform group-open:rotate-180 motion-reduce:transition-none dark:text-fg-faint"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div className="space-y-4 px-4 pb-4">{children}</div>
      </details>
    </section>
  )
}
