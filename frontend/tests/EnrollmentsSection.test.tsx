import { fireEvent, screen } from '@testing-library/react'
import { act } from 'react'

import { render, stubFetchWithPendingCount } from './testUtils'
import { describe, expect, it, vi } from 'vitest'

import { EnrollmentsSection } from '../src/components/playground/EnrollmentsSection'

let mockTtxList: Record<string, unknown>[] = []

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'ready',
    user: { id: 'user-1', email: 'a@acme.com', full_name: 'A', totp_enabled: true },
    ttxList: mockTtxList,
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

function requestsResponse(items: Record<string, unknown>[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total: items.length, limit: 50, offset: 0 }),
  } as Response
}

describe('EnrollmentsSection', () => {
  it('suffixes the organization name with its domain in the pending-request line', async () => {
    stubFetchWithPendingCount(
      vi.fn().mockResolvedValueOnce(
        requestsResponse([
          {
            id: 'req-1',
            ttx_id: 'ttx-1',
            ttx_name: 'Ransomware Drill',
            organization_name: 'Acme Corp',
            organization_domain: 'acme.com',
            role: 'player',
            status: 'pending',
            created_at: '2026-01-01T00:00:00Z',
          },
        ]),
      ),
    )

    render(<EnrollmentsSection />)

    expect(
      await screen.findByText('Awaiting approval from Acme Corp (acme.com)'),
    ).toBeInTheDocument()
  })

  it('shows the plain organization name when no domain is present', async () => {
    stubFetchWithPendingCount(
      vi.fn().mockResolvedValueOnce(
        requestsResponse([
          {
            id: 'req-2',
            ttx_id: 'ttx-2',
            ttx_name: 'Insider Threat',
            organization_name: 'Legacy Org',
            organization_domain: null,
            role: 'player',
            status: 'pending',
            created_at: '2026-01-01T00:00:00Z',
          },
        ]),
      ),
    )

    render(<EnrollmentsSection />)

    expect(await screen.findByText('Awaiting approval from Legacy Org')).toBeInTheDocument()
  })

  it('filters and alphabetically sorts the pending-requests list client-side, with no extra network call', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      requestsResponse([
        {
          id: 'req-1',
          ttx_id: 'ttx-1',
          ttx_name: 'Zeta Drill',
          organization_name: 'Acme Corp',
          organization_domain: null,
          role: 'player',
          status: 'pending',
          created_at: '2026-01-01T00:00:00Z',
        },
        {
          id: 'req-2',
          ttx_id: 'ttx-2',
          ttx_name: 'Alpha Drill',
          organization_name: 'Acme Corp',
          organization_domain: null,
          role: 'player',
          status: 'pending',
          created_at: '2026-01-02T00:00:00Z',
        },
      ]),
    )
    stubFetchWithPendingCount(fetchMock)

    render(<EnrollmentsSection />)
    await screen.findByText('Zeta Drill')

    // Direction defaults to 'desc' and switching field doesn't reset it --
    // for the name field 'desc' means Z-to-A, mirroring the backend's own
    // sort_dir=desc -> ORDER BY name DESC (ttx_service.py) and
    // TableToolbar's own setAToZ/setZToA labeling convention.
    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Date requested' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Name' }))
    const rows = screen.getAllByRole('row').slice(1) // skip the header row
    expect(rows[0].textContent).toContain('Zeta Drill')

    await act(async () => {
      vi.useFakeTimers()
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zeta' } })
      await vi.advanceTimersByTimeAsync(300)
      vi.useRealTimers()
    })

    expect(screen.queryByText('Alpha Drill')).not.toBeInTheDocument()
    expect(screen.getByText('Zeta Drill')).toBeInTheDocument()
    // Purely client-side -- no fetch beyond the one initial load.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('asks to leave an exercise instead of leaving it', async () => {
    mockTtxList = [
      { id: 'ttx-9', name: 'Ransomware Drill', role: 'player', created_at: '2026-01-01T00:00:00Z' },
    ]
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(requestsResponse([]))
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'leave-1',
          ttx_id: 'ttx-9',
          ttx_name: 'Ransomware Drill',
          organization_name: 'Acme Corp',
          reason: 'New team',
          created_at: '2026-01-02T00:00:00Z',
        }),
      } as Response)
    stubFetchWithPendingCount(fetchMock)

    render(<EnrollmentsSection />)
    fireEvent.click(await screen.findByRole('button', { name: 'Request to leave' }))
    fireEvent.change(screen.getByLabelText(/Reason/), { target: { value: 'New team' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }))

    expect(await screen.findByText('Leave requested')).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(url).toContain('/ttx/ttx-9/leave-request')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ reason: 'New team' })
    expect(screen.queryByRole('button', { name: 'Request to leave' })).toBeNull()
    mockTtxList = []
  })
})
