import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TableToolbar } from '../src/components/common/TableToolbar'

describe('TableToolbar', () => {
  it('has a labeled search input and calls onSearchChange after a debounce', async () => {
    vi.useFakeTimers()
    const onSearchChange = vi.fn()
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="created_at"
        onSortDirChange={vi.fn()}
        onSortByChange={vi.fn()}
        search=""
        onSearchChange={onSearchChange}
      />,
    )

    const input = screen.getByLabelText('Search')
    fireEvent.change(input, { target: { value: 'acme' } })
    expect(onSearchChange).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(300)
    expect(onSearchChange).toHaveBeenCalledWith('acme')
    vi.useRealTimers()
  })

  it('never fires onSearchChange when the user has not typed', async () => {
    vi.useFakeTimers()
    const onSearchChange = vi.fn()
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="created_at"
        onSortDirChange={vi.fn()}
        onSortByChange={vi.fn()}
        search=""
        onSearchChange={onSearchChange}
      />,
    )

    await vi.advanceTimersByTimeAsync(1000)
    expect(onSearchChange).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('does not misfire when the parent re-renders or changes the search prop', async () => {
    vi.useFakeTimers()
    const onSearchChange = vi.fn()
    const props = {
      sortDir: 'desc' as const,
      sortBy: 'created_at' as const,
      onSortDirChange: vi.fn(),
      onSortByChange: vi.fn(),
    }
    const { rerender } = render(
      <TableToolbar {...props} search="" onSearchChange={onSearchChange} />,
    )

    // A parent re-render passing a brand-new (non-memoized) callback
    // identity must not restart or trigger the debounce window.
    rerender(<TableToolbar {...props} search="" onSearchChange={() => onSearchChange('stale')} />)
    await vi.advanceTimersByTimeAsync(1000)
    expect(onSearchChange).not.toHaveBeenCalled()

    // An externally-driven search value must not echo back either.
    rerender(<TableToolbar {...props} search="acme" onSearchChange={onSearchChange} />)
    await vi.advanceTimersByTimeAsync(1000)
    expect(onSearchChange).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('sort-direction button calls onSortDirChange with the flipped direction', () => {
    const onSortDirChange = vi.fn()
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="created_at"
        onSortDirChange={onSortDirChange}
        onSortByChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort oldest first' }))
    expect(onSortDirChange).toHaveBeenCalledWith('asc')
  })

  it('sort-field button switches between date and alphabetical', () => {
    const onSortByChange = vi.fn()
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="created_at"
        onSortDirChange={vi.fn()}
        onSortByChange={onSortByChange}
        search=""
        onSearchChange={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Date added' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Name' }))
    expect(onSortByChange).toHaveBeenCalledWith('name')
  })

  it('relabels the direction button once sortBy is alphabetical', () => {
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="name"
        onSortDirChange={vi.fn()}
        onSortByChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Sort A to Z' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sort by: Name' })).toBeInTheDocument()
  })

  it('offers every sort field the table passes in the menu', () => {
    const onSortByChange = vi.fn()
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="created_at"
        onSortDirChange={vi.fn()}
        onSortByChange={onSortByChange}
        search=""
        onSearchChange={vi.fn()}
        sortOptions={['created_at', 'name', 'last_login']}
      />,
    )

    const trigger = screen.getByRole('button', { name: 'Sort by: Date added' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(trigger)

    expect(screen.getByRole('menuitemradio', { name: 'Date added' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Last login' }))

    expect(onSortByChange).toHaveBeenCalledWith('last_login')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('closes the sort-field menu on Escape', () => {
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="last_login"
        onSortDirChange={vi.fn()}
        onSortByChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        sortOptions={['created_at', 'name', 'last_login']}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Last login' }))
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })

    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Sort least recent login first' }),
    ).toBeInTheDocument()
  })

  it('names a field with the table-specific label when one is given', () => {
    render(
      <TableToolbar
        sortDir="desc"
        sortBy="name"
        onSortDirChange={vi.fn()}
        onSortByChange={vi.fn()}
        search=""
        onSearchChange={vi.fn()}
        sortLabels={{ name: 'Domain' }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Domain' }))
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2)
    expect(screen.getByRole('menuitemradio', { name: 'Domain' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: 'Date added' })).toBeInTheDocument()
  })
})
