import { useState } from 'react'

import { toPercent } from '../../lib/chartScale'
import { ChartLegend } from './ChartLegend'
import { ChartTooltip, TooltipRow } from './ChartTooltip'
import { textPrimary, textSecondary } from './styles'
import type { ChartSeries } from './types'

export interface StackedBarItem {
  id: string
  label: string
  /** One value per entry in `series`, same order. */
  values: number[]
}

interface StackedBarListProps {
  items: StackedBarItem[]
  series: ChartSeries[]
  formatValue: (value: number) => string
  totalLabel: string
  /** Rows shown before "Show all"; omit to always show every row. */
  limit?: number
  showAllLabel?: string
  showLessLabel?: string
}

const total = (item: StackedBarItem) => item.values.reduce((sum, v) => sum + v, 0)

/** Ranked horizontal bars, each split into its series. Largest first
 * (ties by label), lengths relative to the largest total, total printed
 * at the end of each bar. Every row is keyboard-focusable and carries a
 * full aria-label; the hover/focus tooltip shows the per-series split. */
export function StackedBarList({
  items,
  series,
  formatValue,
  totalLabel,
  limit,
  showAllLabel,
  showLessLabel,
}: StackedBarListProps) {
  const [expanded, setExpanded] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sorted = [...items].sort((a, b) => total(b) - total(a) || a.label.localeCompare(b.label))
  const visible = limit !== undefined && !expanded ? sorted.slice(0, limit) : sorted
  const max = Math.max(0, ...sorted.map(total))
  const canToggle = limit !== undefined && sorted.length > limit && showAllLabel && showLessLabel

  return (
    <div className="flex flex-col gap-4">
      <ChartLegend series={series} />
      <ul className="flex flex-col gap-2.5">
        {visible.map((item) => {
          const itemTotal = total(item)
          const summary = [
            item.label,
            ...series.map((s, i) => `${s.label} ${formatValue(item.values[i] ?? 0)}`),
            `${totalLabel} ${formatValue(itemTotal)}`,
          ].join(', ')
          return (
            <li
              key={item.id}
              tabIndex={0}
              aria-label={summary}
              onMouseEnter={() => setActiveId(item.id)}
              onMouseLeave={() => setActiveId(null)}
              onFocus={() => setActiveId(item.id)}
              onBlur={() => setActiveId(null)}
              className="relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg sm:grid-cols-[minmax(0,12rem)_1fr]"
            >
              <span className={`truncate text-sm ${textPrimary}`} title={item.label}>
                {item.label}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="flex h-3 gap-[2px]"
                  style={{ width: `${toPercent(itemTotal, max)}%` }}
                >
                  {series.map((s, i) => {
                    const value = item.values[i] ?? 0
                    if (value === 0) return null
                    return (
                      <span
                        key={s.key}
                        className="h-full first:rounded-l last:rounded-r"
                        style={{ flexGrow: value, flexBasis: 0, backgroundColor: s.color }}
                      />
                    )
                  })}
                </span>
                <span className={`shrink-0 text-sm tabular-nums ${textSecondary}`}>
                  {formatValue(itemTotal)}
                </span>
              </span>
              {activeId === item.id && (
                <ChartTooltip className="bottom-full right-0 mb-1.5">
                  <p className={`mb-1 font-medium ${textPrimary}`}>{item.label}</p>
                  {series.map((s, i) => (
                    <TooltipRow
                      key={s.key}
                      color={s.color}
                      label={s.label}
                      value={formatValue(item.values[i] ?? 0)}
                    />
                  ))}
                  <TooltipRow label={totalLabel} value={formatValue(itemTotal)} />
                </ChartTooltip>
              )}
            </li>
          )
        })}
      </ul>
      {canToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm font-medium text-accent-fg hover:text-accent-fg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          {expanded ? showLessLabel : showAllLabel}
        </button>
      )}
    </div>
  )
}
