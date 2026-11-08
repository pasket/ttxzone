import { lazy } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RouteBoundary } from '../src/components/common/RouteBoundary'
import { reloadOnStaleChunks } from '../src/lib/staleChunks'

const Broken = lazy(() => Promise.reject(new Error('chunk gone')))
const Waiting = lazy(() => new Promise<{ default: () => null }>(() => {}))

function BrokenOnlyAtHome() {
  const { pathname } = useLocation()
  return pathname === '/' ? <Broken /> : <p>Another page</p>
}

function renderInBoundary(page: React.ReactNode) {
  return render(
    <MemoryRouter>
      <Link to="/elsewhere">Elsewhere</Link>
      <RouteBoundary>{page}</RouteBoundary>
    </MemoryRouter>,
  )
}

describe('RouteBoundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('says the page is loading while its chunk arrives', async () => {
    renderInBoundary(<Waiting />)
    expect(await screen.findByRole('status')).toHaveTextContent('Loading…')
  })

  it('offers a reload when the chunk never arrives, keeping what surrounds it', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderInBoundary(<Broken />)
    expect(await screen.findByRole('alert')).toHaveTextContent("This page couldn't be loaded")
    expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Elsewhere' })).toBeInTheDocument()
  })

  it('gives another page its chance after a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    renderInBoundary(<BrokenOnlyAtHome />)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('link', { name: 'Elsewhere' }))
    expect(await screen.findByText('Another page')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('reloadOnStaleChunks', () => {
  it('reloads once for a missing chunk, never in a loop', () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    sessionStorage.clear()
    reloadOnStaleChunks()

    window.dispatchEvent(new Event('vite:preloadError'))
    window.dispatchEvent(new Event('vite:preloadError'))

    expect(reload).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })
})
