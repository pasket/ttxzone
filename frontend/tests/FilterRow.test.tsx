import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FilterRow, FilterSelect } from '../src/components/common/FilterRow'
import { render } from './testUtils'

describe('FilterRow', () => {
  it('names its filters and reports "all" as no filter', () => {
    const onChange = vi.fn()
    render(
      <FilterRow label="Filters">
        <FilterSelect
          id="status"
          label="Status"
          value="active"
          allLabel="All statuses"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'disabled', label: 'Disabled' },
          ]}
          onChange={onChange}
        />
      </FilterRow>,
    )
    expect(screen.getByRole('group', { name: 'Filters' })).toBeInTheDocument()
    // The label is on screen, not only for assistive tech.
    expect(screen.getByText('Status')).not.toHaveClass('sr-only')
    const select = screen.getByRole('combobox', { name: 'Status' })
    expect(select).toHaveValue('active')

    fireEvent.change(select, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument()
  })

  it('offers to clear while a filter is on', () => {
    const onClear = vi.fn()
    render(
      <FilterRow label="Filters" onClear={onClear}>
        <span>…</span>
      </FilterRow>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})
