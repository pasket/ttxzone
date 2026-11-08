import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { usePageFallback, useTableUrlState } from '../src/hooks/useTableUrlState'
import type { SortBy } from '../src/lib/types'

function setup(initialEntry = '/list', prefix?: string, sortOptions?: readonly SortBy[]) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  )
  return renderHook(
    () => ({ table: useTableUrlState(prefix, sortOptions), location: useLocation() }),
    {
      wrapper,
    },
  )
}

describe('useTableUrlState', () => {
  it('only accepts a sort field the table offers', () => {
    expect(setup('/list?sort=last_login').result.current.table.sortBy).toBe('created_at')
    expect(
      setup('/list?sort=last_login', '', ['created_at', 'name', 'last_login']).result.current.table
        .sortBy,
    ).toBe('last_login')
  })

  it('reads defaults from a bare URL and keeps them out of it', () => {
    const { result } = setup()
    expect(result.current.table).toMatchObject({
      page: 1,
      sortDir: 'desc',
      sortBy: 'created_at',
      search: '',
    })
    expect(result.current.location.search).toBe('')
  })

  it('restores state from the query string', () => {
    const { result } = setup('/list?page=3&dir=asc&sort=name&q=acme')
    expect(result.current.table).toMatchObject({
      page: 3,
      sortDir: 'asc',
      sortBy: 'name',
      search: 'acme',
    })
  })

  it('resets the page when the sort or search changes', () => {
    const { result } = setup('/list?page=3')
    act(() => result.current.table.setSearch('acme'))
    expect(result.current.table.page).toBe(1)
    expect(result.current.location.search).toBe('?q=acme')

    act(() => result.current.table.setPage(2))
    act(() => result.current.table.setSortDir('asc'))
    expect(result.current.location.search).toBe('?q=acme&dir=asc')
  })

  it('namespaces keys with a prefix and ignores invalid values', () => {
    const { result } = setup('/list?pending_page=-4&pending_dir=sideways&page=2', 'pending_')
    expect(result.current.table.page).toBe(1)
    expect(result.current.table.sortDir).toBe('desc')

    act(() => result.current.table.setPage(5))
    expect(result.current.location.search).toBe('?pending_page=5&pending_dir=sideways&page=2')
  })
})

describe('usePageFallback', () => {
  function setupFallback(
    initialEntry: string,
    props: { total: number; ready: boolean; prefix?: string },
  ) {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    )
    return renderHook(
      (p: { total: number; ready: boolean; prefix?: string }) => {
        usePageFallback({ ...p, pageSize: 10 })
        return useLocation()
      },
      { wrapper, initialProps: props },
    )
  }

  it('falls back to page 1 when the requested page no longer exists', () => {
    // e.g. ?page=3 carried over from a bigger exercise into one with 5 rows
    const { result } = setupFallback('/list?page=3&q=acme', { total: 5, ready: true })
    expect(result.current.search).toBe('?q=acme')
  })

  it('keeps a page that exists', () => {
    const { result } = setupFallback('/list?page=3', { total: 25, ready: true })
    expect(result.current.search).toBe('?page=3')
  })

  it('waits until the list is loaded before judging the page', () => {
    const { result, rerender } = setupFallback('/list?page=3', { total: 0, ready: false })
    expect(result.current.search).toBe('?page=3')
    rerender({ total: 25, ready: true })
    expect(result.current.search).toBe('?page=3')
  })

  it('only touches its own prefixed key', () => {
    const { result } = setupFallback('/list?pending_page=4&enrolled_page=2', {
      total: 3,
      ready: true,
      prefix: 'pending_',
    })
    expect(result.current.search).toBe('?enrolled_page=2')
  })
})
