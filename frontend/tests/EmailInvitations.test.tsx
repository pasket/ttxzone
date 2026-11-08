import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { render, stubFetchWithPendingCount } from './testUtils'
import { JoinInvitationCard } from '../src/components/auth/JoinInvitationCard'
import { CreatorInvitationsSection } from '../src/components/creator/CreatorInvitationsSection'
import { parseAddresses } from '../src/lib/emailInvitations'
import { readPendingInvitation } from '../src/lib/pendingInvitation'

const mockRefresh = vi.fn()
const mockLogout = vi.fn()
let mockStatus = 'anonymous'
let mockUser: Record<string, unknown> | null = null

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    status: mockStatus,
    user: mockUser,
    ttxList: [],
    activeTtxId: 'ttx-1',
    activeOrganizationId: 'org-1',
    refresh: mockRefresh,
    logout: mockLogout,
  }),
}))

function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

function error(code: string, message: string, status: number) {
  return json({ error: { code, message, ttx_id: null } }, status)
}

const preview = {
  organization_name: 'Acme',
  ttx_name: 'Ransomware Drill',
  email_hint: 'p•••@example.com',
  account_exists: false,
}

type Handler = (url: string, init?: RequestInit) => Promise<Response> | undefined

/** Routes each request by URL; `/legal` answers "nothing published". */
function stubRoutes(handler: Handler) {
  const fetchMock = vi.fn((input: unknown, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/legal')) return json({ items: [] })
    return handler(url, init) ?? error('NOT_FOUND', 'Not found.', 404)
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderJoin(entry = '/join#token=tok-1') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/join" element={<JoinInvitationCard />} />
        <Route path="/playground/:ttxId" element={<p>Playground page</p>} />
        <Route path="/login" element={<p>Sign-in page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockStatus = 'anonymous'
  mockUser = null
  mockRefresh.mockReset()
  mockLogout.mockReset()
  sessionStorage.clear()
})

describe('parseAddresses', () => {
  it('splits on separators and keeps each address once', () => {
    expect(parseAddresses(' pat@a.com, lee@a.com;\npat@a.com  kim@a.com ,')).toEqual([
      'pat@a.com',
      'lee@a.com',
      'kim@a.com',
    ])
    expect(parseAddresses('  \n ')).toEqual([])
  })
})

describe('JoinInvitationCard', () => {
  it('says so when the link carries no token', () => {
    stubRoutes(() => undefined)
    renderJoin('/join')

    expect(screen.getByText(/no longer valid/)).toBeInTheDocument()
  })

  it('says so when the invitation is invalid', async () => {
    stubRoutes((url) =>
      url.endsWith('/email-invitations/preview')
        ? error('INVITATION_INVALID', 'This invitation is invalid or has expired.', 400)
        : undefined,
    )
    renderJoin()

    expect(await screen.findByText(/no longer valid/)).toBeInTheDocument()
    expect(readPendingInvitation()).toBeNull()
  })

  it('creates the account and opens the exercise', async () => {
    const fetchMock = stubRoutes((url) => {
      if (url.endsWith('/email-invitations/preview')) return json(preview)
      if (url.endsWith('/email-invitations/accept'))
        return json({
          ttx_id: 'ttx-9',
          ttx_name: 'Ransomware Drill',
          organization_id: 'org-1',
          organization_name: 'Acme',
          created_account: true,
        })
      return undefined
    })
    renderJoin()

    expect(await screen.findByText('Join “Ransomware Drill”')).toBeInTheDocument()
    expect(screen.getByText(/The invitation went to p•••@example.com/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Pat' } })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correcthorse123!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Correcthorse123!' },
    })
    const submit = screen.getByRole('button', { name: 'Create account and join' })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)

    expect(await screen.findByText('Playground page')).toBeInTheDocument()
    const acceptCall = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/email-invitations/accept'),
    )
    expect(JSON.parse(String(acceptCall?.[1]?.body))).toEqual({
      token: 'tok-1',
      account: { full_name: 'Pat', password: 'Correcthorse123!', accepted_legal: [] },
    })
    expect(mockRefresh).toHaveBeenCalled()
    expect(readPendingInvitation()).toBeNull()
  })

  it('asks to accept the documents again when a new version was published meanwhile', async () => {
    stubRoutes((url) => {
      if (url.endsWith('/email-invitations/preview')) return json(preview)
      if (url.endsWith('/email-invitations/accept'))
        return error('LEGAL_VERSION_OUTDATED', 'Outdated.', 409)
      return undefined
    })
    renderJoin()

    await screen.findByText('Join “Ransomware Drill”')
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Pat' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correcthorse123!' } })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Correcthorse123!' },
    })
    const submit = screen.getByRole('button', { name: 'Create account and join' })
    await waitFor(() => expect(submit).toBeEnabled())
    fireEvent.click(submit)

    expect(
      await screen.findByText(
        'The documents have just been updated. Read the current version and accept it again.',
      ),
    ).toBeInTheDocument()
  })

  it('sends an existing account to sign in, keeping the link for afterwards', async () => {
    stubRoutes((url) =>
      url.endsWith('/email-invitations/preview')
        ? json({ ...preview, account_exists: true })
        : undefined,
    )
    renderJoin()

    fireEvent.click(await screen.findByRole('link', { name: 'Sign in to join' }))

    expect(await screen.findByText('Sign-in page')).toBeInTheDocument()
    expect(readPendingInvitation()).toBe('tok-1')
  })

  it('offers to sign out when another account is signed in', async () => {
    mockStatus = 'ready'
    mockUser = { id: 'u-2', email: 'lee@example.com', full_name: 'Lee' }
    stubRoutes((url) => {
      if (url.endsWith('/email-invitations/preview')) return json(preview)
      if (url.endsWith('/email-invitations/accept'))
        return error(
          'INVITATION_OTHER_ACCOUNT',
          'This invitation is for another email address. Sign out and use that one.',
          409,
        )
      return undefined
    })
    renderJoin()

    expect(await screen.findByText("You're signed in as lee@example.com.")).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Join the exercise' }))

    expect(
      await screen.findByText(/but this invitation is for p•••@example.com/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(mockLogout).toHaveBeenCalled()
  })
})

describe('CreatorInvitationsSection by email', () => {
  function list(items: Record<string, unknown>[]) {
    return json({ items, total: items.length, limit: 10, offset: 0 })
  }

  it('is hidden while the deployment sends no email', async () => {
    mockStatus = 'ready'
    stubFetchWithPendingCount((input) =>
      String(input).includes('/invitation-tokens') ? list([]) : json({ items: [] }),
    )
    render(<CreatorInvitationsSection />)

    expect(await screen.findByText('No invitations generated yet.')).toBeInTheDocument()
    expect(screen.queryByText('Invitations by email')).not.toBeInTheDocument()
  })

  it('sends to the typed addresses and reports each one', async () => {
    mockStatus = 'ready'
    const sent: unknown[] = []
    stubFetchWithPendingCount(
      (input, init) => {
        const url = String(input)
        const method = (init as RequestInit | undefined)?.method ?? 'GET'
        if (url.includes('/email-invitations') && method === 'POST') {
          sent.push(JSON.parse(String((init as RequestInit).body)))
          return json(
            {
              results: [
                { email: 'pat@example.com', outcome: 'sent' },
                { email: 'lee@example.com', outcome: 'already_player' },
              ],
            },
            201,
          )
        }
        if (url.includes('/email-invitations'))
          return list([
            {
              id: 'inv-1',
              ttx_id: 'ttx-1',
              email: 'kim@example.com',
              status: 'pending',
              invited_by_name: 'Planner',
              created_at: '2026-10-01T00:00:00Z',
              sent_at: '2026-10-01T00:00:00Z',
              expires_at: '2026-10-15T00:00:00Z',
              accepted_at: null,
              revoked_at: null,
            },
          ])
        if (url.includes('/invitation-tokens')) return list([])
        return json({ items: [] })
      },
      0,
      true,
    )
    render(<CreatorInvitationsSection />)

    const row = within((await screen.findByText('kim@example.com')).closest('tr') as HTMLElement)
    expect(row.getByText('Waiting')).toBeInTheDocument()
    expect(row.getByText('Planner')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Send invitations by email' }))
    fireEvent.change(screen.getByLabelText('Email addresses'), {
      target: { value: 'pat@example.com, lee@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send 2 invitations' }))

    expect(await screen.findByText('Result of the last send')).toBeInTheDocument()
    expect(sent).toEqual([{ emails: ['pat@example.com', 'lee@example.com'] }])
    expect(screen.getByText('Already a Player: not sent')).toBeInTheDocument()
  })
})
