import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { StackedBarList } from '../src/components/dashboard/StackedBarList'

const series = [
  { key: 'a', label: 'Players', color: 'var(--color-chart-1)' },
  { key: 'b', label: 'Planners', color: 'var(--color-chart-2)' },
]

function renderList(limit?: number) {
  render(
    <StackedBarList
      items={[
        { id: '1', label: 'Small', values: [1, 0] },
        { id: '2', label: 'Big', values: [5, 2] },
        { id: '3', label: 'Mid', values: [2, 1] },
      ]}
      series={series}
      formatValue={(v) => String(v)}
      totalLabel="Total"
      limit={limit}
      showAllLabel="Show all"
      showLessLabel="Show fewer"
    />,
  )
}

describe('StackedBarList', () => {
  it('ranks rows by total, largest first, with a full aria-label per row', () => {
    renderList()

    const rows = screen.getAllByRole('listitem').filter((el) => el.tabIndex === 0)
    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Big, Players 5, Planners 2, Total 7',
      'Mid, Players 2, Planners 1, Total 3',
      'Small, Players 1, Planners 0, Total 1',
    ])
  })

  it('shows a legend for two series', () => {
    renderList()

    expect(screen.getByText('Players')).toBeInTheDocument()
    expect(screen.getByText('Planners')).toBeInTheDocument()
  })

  it('limits rows and toggles the rest', () => {
    renderList(2)

    expect(screen.queryByText('Small')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(screen.getByText('Small')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }))
    expect(screen.queryByText('Small')).toBeNull()
  })

  it('shows the per-series split on focus', () => {
    renderList()

    const bigRow = screen.getByLabelText('Big, Players 5, Planners 2, Total 7')
    fireEvent.focus(bigRow)
    const tooltip = bigRow.querySelector('[aria-hidden="true"].absolute') as HTMLElement
    expect(within(tooltip).getByText('7')).toBeInTheDocument()
    fireEvent.blur(bigRow)
    expect(bigRow.querySelector('[aria-hidden="true"].absolute')).toBeNull()
  })
})
