import type { ChartSeries } from './types'
import { textSecondary } from './styles'

/** Swatch + text for each series, so identity never relies on color
 * alone. Rendered only for 2+ series -- a single series is named by its
 * panel title. */
export function ChartLegend({ series }: { series: ChartSeries[] }) {
  if (series.length < 2) return null
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 text-xs ${textSecondary}`}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ backgroundColor: s.color }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  )
}
