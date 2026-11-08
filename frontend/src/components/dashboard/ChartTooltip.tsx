import type { ReactNode } from 'react'

/** Visual-only hover/focus detail for a chart mark. The mark itself
 * carries the same information in its aria-label, so this stays
 * aria-hidden (screen readers would otherwise hear it twice). */
export function ChartTooltip({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute z-10 min-w-36 rounded-md border border-paper-line bg-paper-surface-raised px-3 py-2 text-xs shadow-lg shadow-black/10 dark:border-line dark:bg-surface-raised dark:shadow-none ${className}`}
    >
      {children}
    </div>
  )
}

/** One "swatch label ... value" line inside a ChartTooltip. */
export function TooltipRow({
  color,
  label,
  value,
}: {
  color?: string
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-paper-ink dark:text-fg">
      <span className="flex items-center gap-1.5 text-paper-ink/70 dark:text-fg-muted">
        {color && (
          <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
        )}
        {label}
      </span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
