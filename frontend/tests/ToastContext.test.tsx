import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '../src/hooks/useToast'
import { ToastProvider } from '../src/lib/ToastContext'

function Trigger() {
  const { showToast } = useToast()
  return (
    <button type="button" onClick={() => showToast('Saved')}>
      Save
    </button>
  )
}

describe('ToastProvider', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('removes a toast after it is shown', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    act(() => screen.getByRole('button', { name: 'Save' }).click())
    expect(screen.getByText('Saved')).toBeInTheDocument()
    act(() => vi.advanceTimersByTime(3200))
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('leaves no timer behind once unmounted', () => {
    vi.useFakeTimers()
    const { unmount } = render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )
    act(() => screen.getByRole('button', { name: 'Save' }).click())
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
