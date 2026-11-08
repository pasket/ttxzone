import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const ANONYMOUS = json(
  { error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null } },
  401,
)

const ME = {
  id: 'u2',
  email: 'pat@acme.com',
  full_name: 'Pat',
  totp_enabled: false,
  legal_acceptance_pending: [],
  password_change_required: false,
  is_program_manager: false,
  is_planner: false,
  is_instance_admin: false,
  can_found_organization: false,
}

describe('Confirming the email address after signing up', () => {
  it('holds the account at the confirmation screen until the link is opened', async () => {
    let pending = true
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) return json({ ...ME, email_verification_pending: pending })
      if (url.endsWith('/auth/email/verification') && init?.method === 'POST') {
        return json(undefined, 202)
      }
      return json({ items: [], total: 0, limit: 50, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/admin/organization')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Confirm your email address' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account/verify-email')
    expect(screen.getByText(/pat@acme\.com/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/organizations/mine'),
      expect.anything(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }))
    expect(await screen.findByText(/New link sent/)).toBeInTheDocument()

    // Confirmed in another tab: coming back moves on.
    pending = false
    window.dispatchEvent(new Event('focus'))
    await waitFor(() => expect(window.location.pathname).not.toBe('/account/verify-email'))
  })

  it('spends the link once and takes the token off the address bar', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/email/verify')) return json(undefined, 204)
      return ANONYMOUS
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/verify-email#token=abc123')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Email address confirmed' }),
    ).toBeInTheDocument()
    const calls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/email/verify'))
    expect(calls).toHaveLength(1)
    expect(JSON.parse(String(calls[0][1]!.body))).toEqual({ token: 'abc123' })
    expect(window.location.hash).toBe('')
  })
})

describe('Confirming the email address again (periodic reconfirmation)', () => {
  function stubMe(me: Record<string, unknown>) {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) return json({ ...ME, email_verification_pending: false, ...me })
      if (url.endsWith('/auth/email/verification') && init?.method === 'POST') {
        return json(undefined, 202)
      }
      return json({ items: [], total: 0, limit: 50, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('says until when the account keeps working, with a new link at hand', async () => {
    // An instance administrator: Platform's layout carries the banner too.
    const fetchMock = stubMe({
      email_reconfirm_deadline: '2026-11-12T10:00:00Z',
      email_reconfirmation_overdue: false,
      is_instance_admin: true,
      totp_enabled: true,
    })
    window.history.pushState({}, '', '/platform/organizations')
    render(<App />)

    expect(
      await screen.findByText(/Confirm your email address again before November 12, 2026/),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }))
    expect(await screen.findByText(/New link sent/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/email/verification'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('holds the account at the confirmation screen once the date is past', async () => {
    stubMe({ email_reconfirm_deadline: '2026-10-01T10:00:00Z', email_reconfirmation_overdue: true })
    window.history.pushState({}, '', '/admin/organization')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Confirm your email address again' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account/verify-email')
  })
})

describe('Choosing a new password from an email link', () => {
  it('sends the token with the new password and says to sign in', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.endsWith('/auth/password/reset')) return json(undefined, 204)
      return ANONYMOUS
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/reset-password#token=tok-1')
    render(<App />)

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'Brandnew123!' },
    })
    fireEvent.change(screen.getByLabelText(/Confirm/), { target: { value: 'Brandnew123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByRole('heading', { name: 'Password changed' })).toBeInTheDocument()
    const reset = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/password/reset'))!
    expect(JSON.parse(String(reset[1]!.body))).toEqual({
      token: 'tok-1',
      new_password: 'Brandnew123!',
    })
    expect(window.location.hash).toBe('')
  })

  it('offers a new link when this one no longer works', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/auth/password/reset')
          ? json(
              {
                error: {
                  code: 'ACCOUNT_LINK_INVALID',
                  message: 'This link is invalid or has expired.',
                  ttx_id: null,
                },
              },
              400,
            )
          : ANONYMOUS,
      ),
    )
    window.history.pushState({}, '', '/reset-password#token=old')
    render(<App />)

    fireEvent.change(await screen.findByLabelText('New password'), {
      target: { value: 'Brandnew123!' },
    })
    fireEvent.change(screen.getByLabelText(/Confirm/), { target: { value: 'Brandnew123!' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    expect(await screen.findByRole('link', { name: 'Ask for a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    )
  })
})
