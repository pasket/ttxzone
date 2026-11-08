import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../src/lib/AuthContext'
import { LoginCard } from '../src/components/auth/LoginCard'
import { mockFetchOnce } from './mockFetch'

function jsonResponse(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

const SSO_OFF = jsonResponse({ enabled: false, display_name: null, provider_kind: null })
const SSO_ON = jsonResponse({ enabled: true, display_name: 'Microsoft', provider_kind: 'entra' })
function policy(passwordResetAvailable: boolean): Response {
  return jsonResponse({
    tenancy_mode: 'managed',
    can_found_organization: false,
    password_reset_available: passwordResetAvailable,
  })
}

function renderLoginCard() {
  mockFetchOnce(401)
  return render(
    <MemoryRouter>
      <AuthProvider>
        <LoginCard />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('LoginCard', () => {
  it('renders the login form with a link to register', async () => {
    renderLoginCard()

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByText('Create an account')).toBeInTheDocument()
  })

  it('accepts a full-length backup code on the MFA screen, not just 6 digits', async () => {
    const fetchMock = mockFetchOnce(401)
    fetchMock
      .mockResolvedValueOnce(SSO_OFF)
      .mockResolvedValueOnce(policy(false))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          mfa_required: true,
          mfa_pending_token: 'pending-token',
          mfa_methods: ['totp', 'backup_code'],
          mfa_preferred: 'totp',
        }),
      } as Response)

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'a@acme.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correcthorse123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    const codeInput = await screen.findByLabelText('6-digit code')
    fireEvent.change(codeInput, { target: { value: 'aaaa1111-bbbb2222' } })

    expect(codeInput).toHaveValue('aaaa1111-bbbb2222')
    expect(
      screen.getByText('Lost your device? You can also enter one of your backup codes.'),
    ).toBeInTheDocument()
  })

  it('says when too many failed sign-ins lock the form, in the app language', async () => {
    const fetchMock = mockFetchOnce(401)
    fetchMock
      .mockResolvedValueOnce(SSO_OFF)
      .mockResolvedValueOnce(policy(false))
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          success: false,
          error: { code: 'LOGIN_THROTTLED', message: 'Too many requests.', ttx_id: null },
        }),
      } as Response)

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.change(await screen.findByLabelText('Email'), {
      target: { value: 'a@acme.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    expect(
      await screen.findByText('Too many sign-in attempts. Wait 15 minutes and try again.'),
    ).toBeInTheDocument()
  })

  it('offers single sign-on only when the deployment has it', async () => {
    mockFetchOnce(401).mockResolvedValueOnce(SSO_ON)
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('button', { name: 'Sign in with Microsoft' }),
    ).toBeInTheDocument()
  })

  it('offers "Forgot your password?" only while the deployment sends email links', async () => {
    mockFetchOnce(401).mockResolvedValueOnce(SSO_OFF).mockResolvedValueOnce(policy(true))
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    const link = await screen.findByRole('link', { name: 'Forgot your password?' })
    expect(link).toHaveAttribute('href', '/forgot-password')
  })

  it('hides "Forgot your password?" without email', async () => {
    mockFetchOnce(401).mockResolvedValueOnce(SSO_OFF).mockResolvedValueOnce(policy(false))
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Log in' })
    expect(screen.queryByRole('link', { name: 'Forgot your password?' })).not.toBeInTheDocument()
  })

  it('shows no single sign-on button without it', async () => {
    mockFetchOnce(401).mockResolvedValueOnce(SSO_OFF)
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: 'Log in' })
    expect(screen.queryByRole('button', { name: /Sign in with/ })).not.toBeInTheDocument()
  })

  it('explains why single sign-on sent the person back', async () => {
    mockFetchOnce(401).mockResolvedValueOnce(SSO_ON)
    render(
      <MemoryRouter initialEntries={['/login?sso_error=SSO_LINK_REQUIRED']}>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText(/An account with this email already exists/)).toBeInTheDocument()
  })

  it("finishes a single sign-on with the account's own code", async () => {
    // By URL: the challenge's methods are asked on mount, alongside
    // AuthProvider's own requests.
    const fetchMock = vi.fn((url: string) =>
      Promise.resolve(
        url.endsWith('/auth/login/challenge')
          ? jsonResponse({ mfa_methods: ['totp', 'backup_code'], mfa_preferred: 'totp' })
          : url.includes('/oidc')
            ? SSO_ON
            : ({
                ok: false,
                status: 401,
                json: async () => ({
                  error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.' },
                }),
              } as Response),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MemoryRouter initialEntries={['/login?return_to=%2Fadmin#mfa=pending-token']}>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByLabelText('6-digit code')).toBeInTheDocument()
  })

  it('switches the challenge to a code sent by email', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn((url: string) => {
      calls.push(url)
      if (url.endsWith('/auth/login'))
        return Promise.resolve(
          jsonResponse({
            mfa_required: true,
            mfa_pending_token: 'pending-token',
            mfa_methods: ['totp', 'email', 'backup_code'],
            mfa_preferred: 'totp',
          }),
        )
      if (url.endsWith('/auth/login/email-code'))
        return Promise.resolve(jsonResponse({ sent_to: 'a•••@acme.com' }))
      if (url.includes('/oidc')) return Promise.resolve(SSO_OFF)
      if (url.includes('/instance/policy')) return Promise.resolve(policy(false))
      return Promise.resolve({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.' },
        }),
      } as Response)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginCard />
        </AuthProvider>
      </MemoryRouter>,
    )
    fireEvent.change(await screen.findByLabelText('Email'), { target: { value: 'a@acme.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correcthorse123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Send me a code by email instead' }))

    expect(
      await screen.findByText('We sent a 6-digit code to a•••@acme.com. It works for 10 minutes.'),
    ).toBeInTheDocument()
    expect(calls.filter((url) => url.endsWith('/auth/login/email-code'))).toHaveLength(1)
    expect(
      screen.getByRole('button', { name: 'Use the authenticator app instead' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Send a new code in 60 s' })).toBeDisabled()
  })
})
