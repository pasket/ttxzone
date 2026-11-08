import { fireEvent, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { CreatorPlayersSection } from '../src/components/creator/CreatorPlayersSection'
import { render, stubFetchWithPendingCount } from './testUtils'

let mockActiveTtxId: string | null = 'ttx-1'

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ status: 'ready', activeTtxId: mockActiveTtxId }),
}))

const ana = {
  user_id: 'user-2',
  email: 'ana@external.com',
  full_name: 'Ana Ruiz',
  last_login_at: null,
  joined_at: '2026-10-12T09:00:00Z',
  room: { code: 'RM-01', name: 'Blue' },
  invitation: { id: 'token-1', description: 'SOC shift' },
}
const bea = {
  ...ana,
  user_id: 'user-3',
  email: 'bea@external.com',
  full_name: 'Bea Gil',
  room: null,
  invitation: null,
}

function playersResponse(items: unknown[], usesRooms = true) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ uses_rooms: usesRooms, items }),
  } as Response
}

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/creator/players']}>
      <CreatorPlayersSection />
    </MemoryRouter>,
  )
}

describe('CreatorPlayersSection', () => {
  it('asks for an exercise first when there is none', () => {
    mockActiveTtxId = null
    renderAt()
    expect(
      screen.getByText('Create an exercise first to generate invitations.'),
    ).toBeInTheDocument()
    mockActiveTtxId = 'ttx-1'
  })

  it('lists the Players with their invitation and room, under the Confirmed tab', async () => {
    stubFetchWithPendingCount(vi.fn().mockResolvedValueOnce(playersResponse([ana, bea])))
    renderAt()

    expect(await screen.findByText('Ana Ruiz')).toBeInTheDocument()
    expect(screen.getByText('2 Players')).toBeInTheDocument()
    expect(screen.getByText('SOC shift')).toBeInTheDocument()
    expect(screen.getByText('Added directly')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Room' })).toBeInTheDocument()
    expect(screen.getByText('No room')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Confirmed' })).toHaveAttribute('aria-current', 'page')
  })

  it('has no Room column when the exercise is played at one table', async () => {
    stubFetchWithPendingCount(vi.fn().mockResolvedValueOnce(playersResponse([bea], false)))
    renderAt()

    await screen.findByText('Bea Gil')
    expect(screen.queryByRole('columnheader', { name: 'Room' })).toBeNull()
  })

  it('shows the empty state with a way to invite', async () => {
    stubFetchWithPendingCount(vi.fn().mockResolvedValueOnce(playersResponse([])))
    renderAt()

    expect(await screen.findByText('No Players have joined yet.', { exact: false })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Create an invitation' })).toHaveAttribute(
      'href',
      '/creator/players/invitations',
    )
  })

  it('removes a Player optimistically and deletes after the undo grace period', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(playersResponse([ana]))
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null } as Response)
    stubFetchWithPendingCount(fetchMock)
    renderAt()
    await screen.findByText('Ana Ruiz')

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Ruiz from the exercise' }))

    expect(screen.queryByText('Ana Ruiz')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)
    vi.useRealTimers()

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/ttx/ttx-1/players/user-2'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('brings the Player back on Undo without deleting', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(playersResponse([ana]))
    stubFetchWithPendingCount(fetchMock)
    renderAt()
    await screen.findByText('Ana Ruiz')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Ana Ruiz from the exercise' }))
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))

    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
