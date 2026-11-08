import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { LoginCard } from '../src/components/auth/LoginCard'
import { useAuth } from '../src/hooks/useAuth'
import { apiFetch } from '../src/lib/api'
import { AuthProvider } from '../src/lib/AuthContext'
import { markSessionExpired, readSessionExpired, returnPathAfterLogin } from '../src/lib/authStore'

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const unauthenticated = (code: string) =>
  json(401, { success: false, error: { code, message: 'Nope', ttx_id: null } })

const me = {
  id: 'user-1',
  email: 'ada@acme.com',
  full_name: 'Ada',
  totp_enabled: true,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
  default_organization_id: null,
  default_role: null,
  default_ttx_id: null,
}

function Status() {
  return <p data-testid="status">{useAuth().status}</p>
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>
}

afterEach(() => sessionStorage.clear())

describe('an expired session', () => {
  it('goes anonymous when a request is refused for lack of a session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, me))
      .mockResolvedValueOnce(json(200, { items: [], total: 0, limit: 50, offset: 0 }))
      .mockResolvedValueOnce(json(200, { items: [] }))
      // The page's own request, then the re-check of /auth/me.
      .mockResolvedValueOnce(unauthenticated('TOKEN_EXPIRED'))
      .mockResolvedValue(unauthenticated('NOT_AUTHENTICATED'))
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/creator/ttx-1/msel?tab=phases')

    render(
      <MemoryRouter>
        <AuthProvider>
          <Status />
        </AuthProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

    await expect(apiFetch('/actor-catalog')).rejects.toThrow()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(readSessionExpired()).toEqual({
      returnTo: '/creator/ttx-1/msel?tab=phases',
      email: 'ada@acme.com',
    })
    window.history.pushState({}, '', '/')
  })

  it('returns to where it expired after signing in again as the same account', async () => {
    markSessionExpired('/creator/ttx-1/msel?tab=phases', 'ada@acme.com')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(unauthenticated('NOT_AUTHENTICATED'))
      // GET /auth/oidc/config: no single sign-on.
      .mockResolvedValueOnce(json(200, { enabled: false, display_name: null, provider_kind: null }))
      // GET /instance/policy: no email links.
      .mockResolvedValueOnce(
        json(200, {
          tenancy_mode: 'managed',
          can_found_organization: false,
          password_reset_available: false,
        }),
      )
      // POST /auth/login, then the refreshed snapshot.
      .mockResolvedValueOnce(json(200, { mfa_required: false, mfa_pending_token: null }))
      .mockResolvedValueOnce(json(200, me))
      .mockResolvedValueOnce(json(200, { items: [], total: 0, limit: 50, offset: 0 }))
      .mockResolvedValueOnce(json(200, { items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginCard />} />
            <Route path="*" element={<Where />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'Ada@acme.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correcthorse123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByTestId('where')).toHaveTextContent('/creator/ttx-1/msel?tab=phases')
    expect(readSessionExpired()).toBeNull()
  })

  it('leaves the session alone on a wrong password (also a 401)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(200, me))
      .mockResolvedValueOnce(json(200, { items: [], total: 0, limit: 50, offset: 0 }))
      .mockResolvedValueOnce(json(200, { items: [] }))
      .mockResolvedValue(unauthenticated('INVALID_CREDENTIALS'))
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <Status />
        </AuthProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'))

    await expect(apiFetch('/auth/password', { method: 'POST' })).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(screen.getByTestId('status')).toHaveTextContent('ready')
  })

  it('is explained on the login screen', async () => {
    markSessionExpired('/admin/organization', 'ada@acme.com')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(unauthenticated('NOT_AUTHENTICATED')))

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Your session has expired. Log in again.')).toBeInTheDocument()
  })
})

describe('returnPathAfterLogin', () => {
  const expired = { returnTo: '/creator/ttx-1/msel?tab=phases', email: 'ada@acme.com' }

  it('returns the same account to where it was', () => {
    expect(returnPathAfterLogin(expired, ' ADA@acme.com ')).toBe('/creator/ttx-1/msel?tab=phases')
  })

  it('sends anyone else, or a plain login, home', () => {
    expect(returnPathAfterLogin(expired, 'eve@acme.com')).toBe('/')
    expect(returnPathAfterLogin(null, 'ada@acme.com')).toBe('/')
  })

  it('never leaves the app or loops back to login', () => {
    for (const returnTo of ['//evil.example/x', 'https://evil.example', '/login']) {
      expect(returnPathAfterLogin({ returnTo, email: 'ada@acme.com' }, 'ada@acme.com')).toBe('/')
    }
  })
})
