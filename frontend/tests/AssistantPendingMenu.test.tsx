import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AssistantPendingMenu } from '../src/components/layout/AssistantPendingMenu'
import { DATA_CHANGED_EVENT, LIVE_REFRESH_MS } from '../src/lib/attention'
import { AuthContext, type AuthContextValue } from '../src/lib/authStore'

const pending = (id: string, target: string) => ({
  id,
  batch_id: 'b1',
  target,
  operation: 'create',
  target_id: null,
  base: null,
  patch: {},
  depends_on: [],
  summary: '',
  issues: [],
  status: 'pending',
  applied_row_id: null,
  created_at: '2026-11-07T10:00:00Z',
  decided_at: null,
  outdated: false,
})

function renderWith(items: unknown[], activeTtxId: string | null = 't1') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ items }) }),
  )
  render(
    <AuthContext.Provider value={{ activeTtxId } as AuthContextValue}>
      <MemoryRouter>
        <AssistantPendingMenu />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('The header says where AI proposals wait', () => {
  it('counts them and links each section that holds some', async () => {
    renderWith([pending('a', 'eeg_point'), pending('b', 'eeg_point'), pending('c', 'inject')])

    const trigger = await screen.findByLabelText('3 AI proposals waiting for you')
    fireEvent.click(trigger)
    expect(screen.getByRole('link', { name: /Session plan\s*2/ })).toHaveAttribute(
      'href',
      '/creator/t1/conduct-prep',
    )
    expect(screen.getByRole('link', { name: /MSEL\s*1/ })).toHaveAttribute(
      'href',
      '/creator/t1/msel',
    )
  })

  it('stays out of the way when none wait', async () => {
    renderWith([])
    await Promise.resolve()
    expect(screen.queryByLabelText(/AI proposals? waiting/)).not.toBeInTheDocument()
  })

  it('follows the writes of the page and what arrives from the AI client, without reloading', async () => {
    const answers = [
      [pending('a', 'inject')],
      [],
      [pending('b', 'eeg_point'), pending('c', 'eeg_point')],
    ]
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ items: answers.shift() ?? [] }),
      })),
    )
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(
      <AuthContext.Provider value={{ activeTtxId: 't1' } as AuthContextValue}>
        <MemoryRouter>
          <AssistantPendingMenu />
        </MemoryRouter>
      </AuthContext.Provider>,
    )

    expect(await screen.findByLabelText('1 AI proposal waiting for you')).toBeInTheDocument()
    // The page decided it: gone at once.
    window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
    await waitFor(() => expect(screen.queryByLabelText(/waiting for you/)).not.toBeInTheDocument())
    // The AI client proposed two more: they show up on the next round.
    await vi.advanceTimersByTimeAsync(LIVE_REFRESH_MS)
    expect(await screen.findByLabelText('2 AI proposals waiting for you')).toBeInTheDocument()
    vi.useRealTimers()
  })
})
