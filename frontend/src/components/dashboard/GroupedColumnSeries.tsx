import { useState } from 'react'

import { niceTicks, toPercent } from '../../lib/chartScale'
import { ChartLegend } from './ChartLegend'
import { ChartTooltip, TooltipRow } from './ChartTooltip'
import { textFaint, textPrimary } from './styles'
import type { ChartSeries } from './types'

export interface GroupedColumnPoint {
  key: string
  /** Short x-axis label (e.g. "Sep 1"). */
  tickLabel: string
  /** Full label for the tooltip/aria (e.g. "Week of Sep 1, 2026"). */
  label: string
  /** One value per entry in `series`, same order. */
  values: number[]
}

/** A time series with a few series side by side per point (e.g. Players
 * and the exercise team, week by week), on one y-axis. A legend names the series; each point (the group) is
 * focusable, and its tooltip and aria label list every series and the
 * total. Columns in a group keep a 2px surface gap. */
export function GroupedColumnSeries({
  points,
  series,
  formatValue,
  totalLabel,
  labelEvery = 3,
}: {
  points: GroupedColumnPoint[]
  series: ChartSeries[]
  formatValue: (value: number) => string
  totalLabel: string
  labelEvery?: number
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const ticks = niceTicks(Math.max(0, ...points.flatMap((p) => p.values)))
  const top = ticks[ticks.length - 1]
  const total = (point: GroupedColumnPoint) => point.values.reduce((sum, v) => sum + v, 0)

  return (
    <div className="flex flex-col gap-3">
      <ChartLegend series={series} />
      <div className="grid grid-cols-[auto_1fr] gap-x-2">
        {/* y-axis labels */}
        <div className={`relative h-44 text-right text-xs tabular-nums ${textFaint}`}>
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-0 translate-y-1/2"
              style={{ bottom: `${toPercent(tick, top)}%` }}
            >
              {formatValue(tick)}
            </span>
          ))}
        </div>
        {/* plot */}
        <div className="relative h-44">
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden="true"
              className={`absolute inset-x-0 border-t ${tick === 0 ? 'border-paper-ink/30 dark:border-fg-faint/60' : 'border-paper-line dark:border-line'}`}
              style={{ bottom: `${toPercent(tick, top)}%` }}
            />
          ))}
          <ol className="relative flex h-full items-end gap-1 sm:gap-1.5">
            {points.map((point) => {
              const summary = [
                point.label,
                ...series.map((s, i) => `${s.label} ${formatValue(point.values[i] ?? 0)}`),
                `${totalLabel} ${formatValue(total(point))}`,
              ].join(', ')
              const dimmed = activeKey !== null && activeKey !== point.key
              return (
                <li
                  key={point.key}
                  tabIndex={0}
                  aria-label={summary}
                  onMouseEnter={() => setActiveKey(point.key)}
                  onMouseLeave={() => setActiveKey(null)}
                  onFocus={() => setActiveKey(point.key)}
                  onBlur={() => setActiveKey(null)}
                  className="relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-t focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
                >
                  {series.map((s, i) => (
                    <span
                      key={s.key}
                      className="w-full max-w-4 rounded-t"
                      style={{
                        height: `${toPercent(point.values[i] ?? 0, top)}%`,
                        backgroundColor: s.color,
                        opacity: dimmed ? 0.55 : 1,
                      }}
                    />
                  ))}
                  {activeKey === point.key && (
                    <ChartTooltip className="bottom-full left-1/2 mb-1.5 -translate-x-1/2">
                      <p className={`mb-1 font-medium ${textPrimary}`}>{point.label}</p>
                      {series.map((s, i) => (
                        <TooltipRow
                          key={s.key}
                          color={s.color}
                          label={s.label}
                          value={formatValue(point.values[i] ?? 0)}
                        />
                      ))}
                      <p className={`mt-1 ${textPrimary}`}>
                        {totalLabel} {formatValue(total(point))}
                      </p>
                    </ChartTooltip>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
        {/* x-axis labels */}
        <span />
        <ol aria-hidden="true" className={`mt-1.5 flex gap-1 text-xs sm:gap-1.5 ${textFaint}`}>
          {points.map((point, index) => (
            <li key={point.key} className="flex-1 truncate text-center">
              {index % labelEvery === 0 || index === points.length - 1 ? point.tickLabel : ''}
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
