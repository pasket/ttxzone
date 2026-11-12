import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { RoleInvitationsNotice } from '../src/components/common/RoleInvitationsNotice'
import { render } from './testUtils'

const mockRefresh = vi.fn(async () => {})

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ status: 'ready', refresh: mockRefresh }),
}))

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const offer = {
  id: 'inv-1',
  organization_id: 'org-2',
  organization_name: 'Globex',
  organization_domain: 'globex.com',
  roles: ['observer', 'evaluator'],
  invited_by_name: 'Hank Scorpio',
  sent_at: '2026-11-01T00:00:00+00:00',
  expires_at: '2026-11-15T00:00:00+00:00',
}

function stub(answer: 'accept' | 'decline') {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '')}`
    if (key === 'GET /role-invitations/mine') {
      const answered = fetchMock.mock.calls.some(([, i]) => i?.method === 'POST')
      return json(200, { items: answered ? [] : [offer] })
    }
    if (key === `POST /role-invitations/inv-1/${answer}`) {
      return answer === 'accept'
        ? json(200, { organization_id: 'org-2', roles: ['observer', 'evaluator'] })
        : json(204, null)
    }
    throw new Error(`Unexpected request: ${key}`)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('RoleInvitationsNotice', () => {
  it('shows nothing without offers', async () => {
    const fetchMock = vi.fn(async () => json(200, { items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(<RoleInvitationsNotice />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByRole('region')).toBeNull()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('accepts an offer and reloads the account', async () => {
    stub('accept')
    render(<RoleInvitationsNotice />)

    expect(
      await screen.findByText(
        'Hank Scorpio invites you to join Globex (globex.com) as: Observer, Evaluator.',
      ),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Accept the invitation to Globex' }))

    expect(await screen.findByText('You joined Globex')).toBeInTheDocument()
    expect(mockRefresh).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /Accept the invitation/ })).toBeNull(),
    )
  })

  it('declines an offer', async () => {
    stub('decline')
    render(<RoleInvitationsNotice variant="card" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Decline the invitation to Globex' }))

    expect(await screen.findByText('Invitation to Globex declined')).toBeInTheDocument()
  })
})
