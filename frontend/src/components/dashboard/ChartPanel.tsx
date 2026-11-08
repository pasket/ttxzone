import { useId, useState, type ReactNode } from 'react'

import { btnSecondary } from '../../lib/buttonStyles'
import { panelClass, skeletonClass, textFaint, textPrimary, textSecondary } from './styles'
import type { PanelStatus } from './types'

const SPAN_CLASS = {
  full: 'lg:col-span-12',
  wide: 'lg:col-span-8',
  narrow: 'lg:col-span-4',
} as const

interface ChartPanelProps {
  title: string
  description?: string
  span?: keyof typeof SPAN_CLASS
  status: PanelStatus
  /** Says what's missing and what to do about it -- an empty panel is a
   * pointer to the next action, not just "no data". */
  emptyMessage?: string
  errorMessage?: string
  onRetry?: () => void
  retryLabel?: string
  /** Optional table view of the same data. When set, a Chart/Table toggle
   * appears in the panel header. */
  table?: ReactNode
  viewLabels?: { chart: string; table: string }
  /** Reserved body height so loading -> ready doesn't shift the layout. */
  bodyClassName?: string
  children: ReactNode
}

/** The one place every dashboard panel gets its frame and its
 * loading/empty/error states from, so individual charts only ever render
 * the "ready" case. */
export function ChartPanel({
  title,
  description,
  span = 'full',
  status,
  emptyMessage,
  errorMessage,
  onRetry,
  retryLabel,
  table,
  viewLabels,
  bodyClassName = 'min-h-48',
  children,
}: ChartPanelProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart')
  const titleId = useId()
  const showToggle = table !== undefined && viewLabels !== undefined && status === 'ready'

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={status === 'loading'}
      className={`${panelClass} ${SPAN_CLASS[span]} flex min-w-0 flex-col gap-4 p-5`}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className={`text-balance text-base font-semibold ${textPrimary}`}>
            {title}
          </h2>
          {description && <p className={`mt-0.5 text-sm ${textSecondary}`}>{description}</p>}
        </div>
        {showToggle && (
          <div
            role="group"
            aria-label={title}
            className="inline-flex rounded-sm border border-paper-line p-0.5 dark:border-line"
          >
            {(['chart', 'table'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={view === option}
                onClick={() => setView(option)}
                className={`rounded-xs px-2.5 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                  view === option
                    ? 'bg-paper-line text-paper-ink dark:bg-line dark:text-fg'
                    : `${textSecondary} hover:text-paper-ink dark:hover:text-fg`
                }`}
              >
                {viewLabels[option]}
              </button>
            ))}
          </div>
        )}
      </header>

      <div className={bodyClassName}>
        {status === 'loading' && (
          <div className="flex h-full flex-col justify-end gap-3">
            <span className={`${skeletonClass} h-3 w-3/4`} />
            <span className={`${skeletonClass} h-3 w-1/2`} />
            <span className={`${skeletonClass} h-3 w-2/3`} />
          </div>
        )}
        {status === 'empty' && <p className={`text-sm ${textFaint}`}>{emptyMessage}</p>}
        {status === 'error' && (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="text-sm text-danger-fg">
              {errorMessage}
            </p>
            {onRetry && retryLabel && (
              <button type="button" onClick={onRetry} className={btnSecondary}>
                {retryLabel}
              </button>
            )}
          </div>
        )}
        {status === 'ready' && (view === 'table' && table !== undefined ? table : children)}
      </div>
    </section>
  )
}
