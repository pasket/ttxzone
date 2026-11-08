import { fireEvent, render, screen } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  useConfirmDiscardChanges,
  useUnsavedChangesWarning,
} from '../src/hooks/useUnsavedChangesWarning'

function DirtyForm({ dirty }: { dirty: boolean }) {
  useUnsavedChangesWarning(dirty)
  const confirmDiscard = useConfirmDiscardChanges()
  return (
    <>
      <Link to="/elsewhere">Leave</Link>
      <button type="button" onClick={() => confirmDiscard() && void 0}>
        Switch context
      </button>
    </>
  )
}

function renderAt(dirty: boolean) {
  render(
    <MemoryRouter initialEntries={['/form']}>
      <Routes>
        <Route path="/form" element={<DirtyForm dirty={dirty} />} />
        <Route path="/elsewhere" element={<p>Elsewhere</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('unsaved changes guard', () => {
  afterEach(() => vi.restoreAllMocks())

  it('lets in-app links through when nothing is dirty', () => {
    const confirm = vi.spyOn(window, 'confirm')
    renderAt(false)

    fireEvent.click(screen.getByRole('link', { name: 'Leave' }))

    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
    expect(confirm).not.toHaveBeenCalled()
  })

  it('keeps the user on the form when they decline leaving', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(true)

    fireEvent.click(screen.getByRole('link', { name: 'Leave' }))

    expect(confirm).toHaveBeenCalledWith('You have unsaved changes. Leave and discard them?')
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument()
  })

  it('navigates when they confirm discarding', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt(true)

    fireEvent.click(screen.getByRole('link', { name: 'Leave' }))

    expect(screen.getByText('Elsewhere')).toBeInTheDocument()
  })

  it('asks non-link navigation (ContextBar, logout) through the same registry', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(true)

    fireEvent.click(screen.getByRole('button', { name: 'Switch context' }))

    expect(confirm).toHaveBeenCalledTimes(1)
  })
})
