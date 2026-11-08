import { fireEvent, screen, waitFor, within, act } from '@testing-library/react'

import { render, stubFetchWithPendingCount } from './testUtils'
import { describe, expect, it, vi } from 'vitest'

import { CreatorInvitationsSection } from '../src/components/creator/CreatorInvitationsSection'

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
    activeOrganizationId: (mockTtxList[0]?.organization_id as string | undefined) ?? null,
    refresh: mockRefresh,
    logout: vi.fn(),
  }),
}))

function mockAuditList(items: Record<string, unknown>[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total: items.length, limit: 50, offset: 0 }),
  } as Response
}

// The component also fetches the org's available tags once, alongside the
// invitation list, via a separate effect keyed on activeOrganizationId --
// every test's fetch mock queue below (when it stubs `fetch` with an
// explicit tests using `mockTtxList = ttxList`) reserves one slot for this
// call right after the initial list load.
function mockTagList(items: Record<string, unknown>[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total: items.length, limit: 200, offset: 0 }),
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

describe('CreatorInvitationsSection', () => {
  it('shows a message and no form when there are no exercises', () => {
    mockTtxList = []
    render(<CreatorInvitationsSection />)

    expect(
      screen.getByText('Create an exercise first to generate invitations.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Generate invitation' })).not.toBeInTheDocument()
  })

  it('loads and displays existing invitations for the selected exercise', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockAuditList([
          {
            id: 'token-1',
            ttx_id: 'ttx-1',
            role: 'planner',
            description: 'IT team, Q1 drill',
            token: 'existing-plaintext-token',
            expires_at: '2026-02-01T00:00:00Z',
            max_uses: 5,
            redemption_count: 2,
            revoked_at: null,
            created_at: '2026-01-01T00:00:00Z',
            created_by_id: 'user-1',
            tags: [],
          },
        ]),
      )
      .mockResolvedValueOnce(mockTagList([]))
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorInvitationsSection />)

    await screen.findByText('existing-plaintext-token')
    const row = within(screen.getAllByRole('row')[1])
    expect(row.getByText('Planner')).toBeInTheDocument()
    expect(row.getByText('IT team, Q1 drill')).toBeInTheDocument()
    expect(row.getByText('existing-plaintext-token')).toBeInTheDocument()
    expect(row.getByText('2 / 5 used', { exact: false })).toBeInTheDocument()
    expect(row.getByText('Active', { exact: false })).toBeInTheDocument()
  })

  it('shows the unlimited usage label when max_uses is null', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockAuditList([
          {
            id: 'token-unlimited',
            ttx_id: 'ttx-1',
            role: 'player',
            description: null,
            token: 'unlimited-token',
            expires_at: '2026-02-01T00:00:00Z',
            max_uses: null,
            redemption_count: 7,
            revoked_at: null,
            created_at: '2026-01-01T00:00:00Z',
            created_by_id: 'user-1',
            tags: [],
          },
        ]),
      )
      .mockResolvedValueOnce(mockTagList([]))
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorInvitationsSection />)

    await screen.findByText('unlimited-token')
    const row = within(screen.getAllByRole('row')[1])
    expect(row.getByText('7 used (unlimited)', { exact: false })).toBeInTheDocument()
  })

  it('generates a new invitation with a description and unlimited uses, revealing the plaintext token', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockAuditList([]))
      .mockResolvedValueOnce(mockTagList([]))
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 'token-new',
          ttx_id: 'ttx-1',
          role: 'player',
          description: 'Second wave',
          expires_at: '2026-03-01T00:00:00Z',
          max_uses: null,
          created_at: '2026-01-02T00:00:00Z',
          token: 'plaintext-secret-token',
        }),
      } as Response)
      .mockResolvedValueOnce(
        mockAuditList([
          {
            id: 'token-new',
            ttx_id: 'ttx-1',
            role: 'player',
            description: 'Second wave',
            token: 'plaintext-secret-token',
            expires_at: '2026-03-01T00:00:00Z',
            max_uses: null,
            redemption_count: 0,
            revoked_at: null,
            created_at: '2026-01-02T00:00:00Z',
            created_by_id: 'user-1',
            tags: [],
          },
        ]),
      )
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorInvitationsSection />)
    await screen.findByText('No invitations generated yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Generate invitation' }))
    // No role picker: invitations are always for players.
    expect(screen.queryByLabelText('Role')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Description (optional)')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Description (optional)'), {
      target: { value: 'Second wave' },
    })
    fireEvent.change(screen.getByLabelText('Expires at'), {
      target: { value: '2026-03-01T00:00' },
    })
    fireEvent.click(screen.getByLabelText('Unlimited'))
    fireEvent.click(screen.getByRole('button', { name: 'Generate invitation' }))

    await waitFor(() => expect(screen.getAllByText('plaintext-secret-token')).toHaveLength(2))
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/invitation-tokens'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          role: 'player',
          description: 'Second wave',
          expires_at: new Date('2026-03-01T00:00').toISOString(),
          max_uses: null,
        }),
      }),
    )
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    // Panel collapses back to the trigger after a successful save; the
    // token reveal callout stays visible independently of that.
    expect(screen.getByRole('button', { name: 'Generate invitation' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Expires at')).not.toBeInTheDocument()
    // Focus returns to the trigger once it remounts -- regression test for
    // a bug where an imperative .focus() call fired before the button had
    // actually remounted, silently doing nothing.
    expect(screen.getByRole('button', { name: 'Generate invitation' })).toHaveFocus()
  })

  it('revokes an active invitation optimistically, then commits after the undo grace period', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockAuditList([
          {
            id: 'token-1',
            ttx_id: 'ttx-1',
            role: 'planner',
            description: null,
            token: 'revoke-token-value',
            expires_at: '2026-02-01T00:00:00Z',
            max_uses: 1,
            redemption_count: 0,
            revoked_at: null,
            created_at: '2026-01-01T00:00:00Z',
            created_by_id: 'user-1',
            tags: [],
          },
        ]),
      )
      .mockResolvedValueOnce(mockTagList([]))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'token-1', revoked_at: '2026-01-03T00:00:00Z' }),
      } as Response)
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorInvitationsSection />)
    const revokeButton = await screen.findByRole('button', { name: 'Revoke' })

    vi.useFakeTimers()
    fireEvent.click(revokeButton)

    // Optimistic: flips to Revoked immediately, no DELETE fired yet. Scoped
    // to the row -- the undo toast's own "Token revoked" message also
    // matches a bare substring query for "Revoked". Two calls already
    // happened at mount (the invitation list plus the org's available
    // tags, fetched via a separate effect), before the click itself.
    const row = within(screen.getAllByRole('row')[1])
    expect(row.getByText('Revoked', { exact: false })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5000)

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/invitation-tokens/token-1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('opens the tag modal, preselects existing tags, and saves the new set', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockAuditList([
          {
            id: 'token-1',
            ttx_id: 'ttx-1',
            role: 'planner',
            description: 'IT team, Q1 drill',
            token: 'existing-plaintext-token',
            expires_at: '2026-02-01T00:00:00Z',
            max_uses: 5,
            redemption_count: 2,
            revoked_at: null,
            created_at: '2026-01-01T00:00:00Z',
            created_by_id: 'user-1',
            tags: [
              { id: 'tag-1', name: 'VIP', color: 'indigo', created_at: '2026-01-01T00:00:00Z' },
            ],
          },
        ]),
      )
      .mockResolvedValueOnce(
        mockTagList([
          { id: 'tag-1', name: 'VIP', color: 'indigo', created_at: '2026-01-01T00:00:00Z' },
          { id: 'tag-2', name: 'Legal', color: 'slate', created_at: '2026-01-01T00:00:00Z' },
        ]),
      )
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'token-1',
          ttx_id: 'ttx-1',
          role: 'planner',
          description: 'IT team, Q1 drill',
          token: 'existing-plaintext-token',
          expires_at: '2026-02-01T00:00:00Z',
          max_uses: 5,
          redemption_count: 2,
          revoked_at: null,
          created_at: '2026-01-01T00:00:00Z',
          created_by_id: 'user-1',
          tags: [
            { id: 'tag-2', name: 'Legal', color: 'slate', created_at: '2026-01-01T00:00:00Z' },
          ],
        }),
      } as Response)
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorInvitationsSection />)
    await screen.findByText('existing-plaintext-token')

    fireEvent.click(screen.getByRole('button', { name: 'Assign tags' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /VIP/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Legal/ })).not.toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: /VIP/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Legal/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/invitation-tokens/token-1/tags'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ tag_ids: ['tag-2'] }) }),
    )

    // Row's chips update immediately from the PUT response, no re-fetch.
    const row = within(screen.getAllByRole('row')[1])
    expect(row.getByText('Legal')).toBeInTheDocument()
    expect(row.queryByText('VIP')).not.toBeInTheDocument()
  })

  it('keeps the Assign tags button present but hides Revoke on an already-revoked row', async () => {
    mockTtxList = ttxList
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockAuditList([
          {
            id: 'token-revoked',
            ttx_id: 'ttx-1',
            role: 'planner',
            description: null,
            token: 'revoked-token-value',
            expires_at: '2026-02-01T00:00:00Z',
            max_uses: 1,
            redemption_count: 0,
            revoked_at: '2026-01-03T00:00:00Z',
            created_at: '2026-01-01T00:00:00Z',
            created_by_id: 'user-1',
            tags: [],
          },
        ]),
      )
      .mockResolvedValueOnce(mockTagList([]))
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorInvitationsSection />)
    await screen.findByText('revoked-token-value')

    const row = within(screen.getAllByRole('row')[1])
    expect(row.getByRole('button', { name: 'Assign tags' })).toBeInTheDocument()
    expect(row.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })

  it('sends sort_by and q on the list request once the toolbar changes them', async () => {
    mockTtxList = ttxList
    const fetchMock = vi.fn().mockResolvedValue(mockAuditList([]))
    stubFetchWithPendingCount(fetchMock)

    render(<CreatorInvitationsSection />)
    await screen.findByText('No invitations generated yet.')

    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Date added' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Description' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('sort_by=name'),
        expect.anything(),
      ),
    )

    await act(async () => {
      vi.useFakeTimers()
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'legal' } })
      await vi.advanceTimersByTimeAsync(300)
      vi.useRealTimers()
    })

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('q=legal'),
      expect.anything(),
    )
  })
})
