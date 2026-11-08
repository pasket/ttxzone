import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PrimaryNav } from '../src/components/layout/PrimaryNav'
import { useNavCollapsed } from '../src/hooks/useNavCollapsed'

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ ttxList: [], activeTtx: null, executionRole: null }),
}))

function Harness() {
  const nav = useNavCollapsed()
  return <PrimaryNav collapsed={nav.collapsed} onToggle={nav.toggle} />
}

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/admin/organization']}>
      <Harness />
    </MemoryRouter>,
  )
}

describe('PrimaryNav', () => {
  it('starts expanded with visible section names', () => {
    renderNav()
    expect(screen.getByRole('button', { name: 'Collapse menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(screen.getByRole('link', { name: 'Organization' })).not.toHaveAttribute('title')
  })

  it('folds into an icon rail that keeps names and the active section', () => {
    renderNav()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }))

    const toggle = screen.getByRole('button', { name: 'Expand menu' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    const active = screen.getByRole('link', { name: 'Organization' })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(active).toHaveAttribute('title', 'Organization')
    expect(active.querySelector('.sr-only')).not.toBeNull()
  })

  it('remembers the folded menu on this device', () => {
    const { unmount } = renderNav()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }))
    unmount()

    renderNav()
    expect(screen.getByRole('button', { name: 'Expand menu' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Expand menu' }))
    expect(localStorage.getItem('ttx_nav_collapsed')).toBeNull()
  })

  it("lists the exercise's sections, then the Library after a divider, with no headings", () => {
    render(
      <MemoryRouter initialEntries={['/creator/ttx-1/needs']}>
        <Routes>
          <Route path="/creator/:ttxId/:section" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    )
    const nav = screen.getByRole('navigation', { name: 'Primary' })
    expect(Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)).toEqual([
      'Exercise',
      'Needs analysis',
      'MSEL',
      'Session plan',
      'After-action report',
      'Players',
      'Library',
    ])
    // The organization's exercises are reached from the ContextBar.
    expect(screen.queryByRole('link', { name: 'Exercises' })).not.toBeInTheDocument()
    expect(nav.querySelectorAll('hr')).toHaveLength(1)
    expect(nav.querySelector('p')).toBeNull()
    expect(screen.queryByRole('button', { name: /Organization/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Library' })).toHaveAttribute(
      'href',
      '/creator/library',
    )
    expect(screen.getByRole('link', { name: 'Needs analysis' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // The icon rail keeps every section and the divider.
    fireEvent.click(screen.getByRole('button', { name: 'Collapse menu' }))
    expect(screen.getByRole('link', { name: 'Library' })).toBeInTheDocument()
    expect(nav.querySelectorAll('hr')).toHaveLength(1)
  })
})
