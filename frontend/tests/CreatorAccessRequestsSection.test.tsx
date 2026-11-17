import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { render, stubFetchWithPendingCount } from './testUtils'
import { describe, expect, it, vi } from 'vitest'

import { CreatorAccessRequestsSection } from '../src/components/creator/CreatorAccessRequestsSection'

const mockRefresh = vi.fn()
let mockTtxList: Record<string, unknown>[] = []

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'ready',
    user: {
      id: 'user-1',
      email: 'a@acme.com',
      full_name: 'Planner',
      totp_enabled: true,
      legal_acceptance_pending: [],
      is_program_manager: false,
      is_planner: true,
    },
    ttxList: mockTtxList,
    activeTtxId: (mockTtxList[0]?.id as string | undefined) ?? null,
    refresh: mockRefresh,
    logout: vi.fn(),
  }),
}))

function mockRequestList(items: Record<string, unknown>[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total: items.length, limit: 50, offset: 0 }),
  } as Response
}

const ttxList = [
  {
    id: 'ttx-1',
    name: 'Ransomware Drill',
    description: null,
    organization_id: 'org-1',
    created_by_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    role: 'planner',
    plans: true,
    controls: true,
  },
]

const pendingRequest = {
  id: 'request-1',
  ttx_id: 'ttx-1',
  role: 'player',
  token_description: 'IT team, Q1 drill',
  status: 'pending',
  user: { id: 'user-2', email: 'req@external.com', full_name: 'Requester' },
  created_at: '2026-01-01T00:00:00Z',
  is_allowed_domain: true,
}

describe('CreatorAccessRequestsSection', () => {
  it('shows a message and no picker when there are no exercises', () => {
    mockTtxList = []
    render(<CreatorAccessRequestsSection />)

    expect(
      screen.getByText('Create an exercise first to generate invitations.'),
    ).toBeInTheDocument()
  })

  it('shows the empty state when there are no pending requests', async () => {
    mockTtxList = ttxList
    stubFetchWithPendingCount(vi.fn().mockResolvedValueOnce(mockRequestList([])))

    render(<CreatorAccessRequestsSection />)

    expect(await screen.findByText('No pending requests.')).toBeInTheDocument()
  })

  it('lists pending requests with requester, role, and token description', async () => {
    mockTtxList = ttxList
    stubFetchWithPendingCount(vi.fn().mockResolvedValueOnce(mockRequestList([pendingRequest])))

    render(<CreatorAccessRequestsSection />)

    expect(await screen.findByText('Requester')).toBeInTheDocument()
    expect(screen.getByText('req@external.com')).toBeInTheDocument()
    expect(screen.getByText('IT team, Q1 drill', { exact: false })).toBeInTheDocument()
  })

  it('shows a domain-not-allowed indicator when the request fails the allowlist', async () => {
    mockTtxList = ttxList
    stubFetchWithPendingCount(
      vi
        .fn()
        .mockResolvedValueOnce(mockRequestList([{ ...pendingRequest, is_allowed_domain: false }])),
    )

    render(<CreatorAccessRequestsSection />)

    expect(
      await screen.findByText('Domain not on the allowed list -- add it in Admin to approve'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled()
  })

  it('does not show the indicator when the domain is allowed', async () => {
    mockTtxList = ttxList
    stubFetchWithPendingCount(vi.fn().mockResolvedValueOnce(mockRequestList([pendingRequest])))

    render(<CreatorAccessRequestsSection />)

    await screen.findByText('Requester')
    expect(
      screen.queryByText('Domain not on the allowed list -- add it in Admin to approve'),
    ).toBeNull()
    expect(screen.getByRole('button', { name: 'Approve' })).toBeEnabled()
  })

  it('approves a request and removes it from the pending list', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRequestList([pendingRequest]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...pendingRequest, status: 'approved' }),
      } as Response)
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorAccessRequestsSection />)
    await screen.findByText('Requester')

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }))

    expect(await screen.findByText('No pending requests.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/access-requests/request-1/approve'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('rejects a request optimistically, then commits after the undo grace period', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRequestList([pendingRequest]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ ...pendingRequest, status: 'rejected' }),
      } as Response)
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorAccessRequestsSection />)
    await screen.findByText('Requester')

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Reject' }))

    // Optimistic: gone immediately, no POST fired yet.
    expect(screen.getByText('No pending requests.')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(5000)

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/access-requests/request-1/reject'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('sends sort_by and q on the list request once the toolbar changes them', async () => {
    mockTtxList = ttxList
    const fetchMock = vi.fn().mockResolvedValue(mockRequestList([]))
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorAccessRequestsSection />)
    await screen.findByText('No pending requests.')

    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Date requested' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Name' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('sort_by=name'),
        expect.anything(),
      ),
    )

    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'zoe' } })
    await vi.advanceTimersByTimeAsync(300)
    vi.useRealTimers()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('q=zoe'),
        expect.anything(),
      ),
    )
  })

  it('approves the ticked requests together, and says which one could not be', async () => {
    mockTtxList = ttxList
    const second = {
      ...pendingRequest,
      id: 'request-2',
      user: { ...pendingRequest.user, id: 'user-3', full_name: 'Second' },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRequestList([pendingRequest, second]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          done: ['request-1'],
          failed: [{ id: 'request-2', code: 'X', message: 'Already decided.' }],
        }),
      } as Response)
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorAccessRequestsSection />)
    await screen.findByText('Requester')
    // Nothing to act on until a row is ticked.
    expect(screen.queryByRole('group', { name: 'Act on the selected requests' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select every row on this page' }))
    expect(screen.getByRole('status')).toHaveTextContent('2 selected')
    fireEvent.click(screen.getByRole('button', { name: 'Approve 2' }))

    expect(await screen.findByText('1 request approved')).toBeInTheDocument()
    expect(screen.getByText('1 couldn’t be done: Already decided.')).toBeInTheDocument()
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
    expect(url).toContain('/ttx/ttx-1/access-requests/decide')
    expect(JSON.parse(String(init.body))).toEqual({
      request_ids: ['request-1', 'request-2'],
      decision: 'approve',
    })
    // The one that went through leaves the list; the other stays, still ticked.
    expect(screen.queryByText('Requester')).toBeNull()
    expect(screen.getByText('Second')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select Second' })).toBeChecked()
  })

  it('asks before rejecting several at once', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRequestList([pendingRequest]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ done: ['request-1'], failed: [] }),
      } as Response)
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorAccessRequestsSection />)
    await screen.findByText('Requester')
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select Requester' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reject 1' }))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('Reject 1 request?')
    expect(dialog).toHaveTextContent('Requester.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reject 1' }))

    expect(await screen.findByText('1 request rejected')).toBeInTheDocument()
    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
    expect(JSON.parse(String(init.body)).decision).toBe('reject')
  })
})
