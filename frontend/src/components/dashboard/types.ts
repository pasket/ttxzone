/** One categorical series in a chart. `color` comes from
 * lib/chartTheme.ts's seriesColor(index) -- never a raw hex. */
export interface ChartSeries {
  key: string
  label: string
  color: string
}

export type PanelStatus = 'loading' | 'error' | 'empty' | 'ready'
