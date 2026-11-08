/** Categorical chart colors, in fixed order (see --color-chart-* in
 * index.css). A series is colored by its position in the chart's own
 * `series` definition, never by rank, so a filter never repaints the
 * survivors. Anything past the palette folds into "other" rather than
 * cycling back to the first hue. */
const CHART_SERIES_COLORS = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
] as const

export const CHART_OTHER_COLOR = 'var(--color-chart-other)'

export function seriesColor(index: number): string {
  return CHART_SERIES_COLORS[index] ?? CHART_OTHER_COLOR
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value)
}

export function formatPercent(share: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(share)
}

/** Access-request outcomes keep one color wherever they're split
 * (organization and exercise dashboards alike). */
export const REQUEST_OUTCOME_COLORS = {
  approved: seriesColor(0),
  pending: seriesColor(2),
  rejected: seriesColor(3),
} as const
