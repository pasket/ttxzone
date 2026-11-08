import type { ReactNode } from 'react'

import { textPrimary, textSecondary } from './styles'

export interface DataTableColumn<Row> {
  key: string
  header: string
  align?: 'left' | 'right'
  render: (row: Row) => ReactNode
}

/** Plain table view of a chart's data -- the accessible fallback every
 * ChartPanel can offer through its Chart/Table toggle. */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
}: {
  caption: string
  columns: DataTableColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row) => string
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className={`border-b border-paper-line text-xs dark:border-line ${textSecondary}`}>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={`pb-2 pr-4 font-medium last:pr-0 ${col.align === 'right' ? 'text-right' : ''}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-paper-line dark:divide-line">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-2.5 pr-4 last:pr-0 ${textPrimary} ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
