import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

const ME = {
  id: 'u1',
  email: 'ops@acme.com',
  full_name: 'Ops',
  totp_enabled: true,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
  is_instance_admin: true,
  is_last_instance_admin: true,
  can_found_organization: false,
}

const NOT_SET = {
  active: false,
  pinned_by_env: false,
  allow_insecure: false,
  configured: false,
  enabled: false,
  transport: null,
  from_address: null,
  from_name: null,
  reply_to: null,
  smtp_host: null,
  smtp_port: null,
  smtp_security: null,
  smtp_username: null,
  has_password: false,
  password_readable: true,
  updated_at: null,
  pending: 0,
  failed: 0,
  last_sent_at: null,
  last_failed_at: null,
  last_error: null,
}

const SET = {
  ...NOT_SET,
  active: true,
  configured: true,
  enabled: true,
  transport: 'smtp',
  from_address: 'ttx@acme.com',
  smtp_host: 'smtp.acme.com',
  smtp_port: 587,
  smtp_security: 'starttls',
  smtp_username: 'ttx@acme.com',
  has_password: true,
  updated_at: '2026-10-28T09:00:00Z',
  pending: 1,
  failed: 1,
}

const OUTBOX = [
  {
    id: 'm1',
    created_at: '2026-10-28T09:10:00Z',
    template: 'test',
    locale: 'en',
    to_address: 'pat@acme.com',
    status: 'failed',
    attempts: 3,
    next_attempt_at: '2026-10-28T09:10:00Z',
    last_attempt_at: '2026-10-28T09:12:00Z',
    sent_at: null,
    last_error: 'SMTP 550: no such user',
  },
]

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const RECONFIRMATION_OFF = { days: null, pinned_by_env: false, grace_days: 14 }

function stubEmail(settings: unknown, reconfirmation: unknown = RECONFIRMATION_OFF) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return json(ME)
    if (url.endsWith('/instance/email/reconfirmation')) {
      if (init?.method === 'PUT') {
        return json({ ...RECONFIRMATION_OFF, ...JSON.parse(String(init.body)) })
      }
      return json(reconfirmation)
    }
    if (url.endsWith('/instance/email/test')) {
      return json({ ok: false, to: 'ops@acme.com', error: 'SMTP 535: authentication failed' })
    }
    if (url.includes('/instance/email/outbox')) {
      return json({ items: OUTBOX, total: OUTBOX.length, limit: 20, offset: 0, retention_days: 30 })
    }
    if (url.endsWith('/instance/email')) {
      if (init?.method === 'PUT') return json(SET)
      return json(settings)
    }
    if (url.includes('/ttx')) return json({ items: [], total: 0, limit: 50, offset: 0 })
    return json({ items: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Platform -> Email', () => {
  it('sets up the sender and server, sending the password once', async () => {
    window.history.pushState({}, '', '/platform/email')
    const fetchMock = stubEmail(NOT_SET)
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Email' })).toBeInTheDocument()
    expect(await screen.findByText('Not set up')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('From address'), {
      target: { value: 'ttx@acme.com' },
    })
    fireEvent.change(screen.getByLabelText('Host'), { target: { value: 'smtp.acme.com' } })
    fireEvent.change(screen.getByLabelText('Connection'), { target: { value: 'tls' } })
    fireEvent.change(screen.getByLabelText(/Password/), { target: { value: 's3cret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and turn on' }))

    expect(await screen.findByText('Email settings saved')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/instance/email') && init?.method === 'PUT',
    )!
    expect(JSON.parse(String(put[1]!.body))).toEqual({
      enabled: true,
      from_address: 'ttx@acme.com',
      from_name: null,
      reply_to: null,
      smtp_host: 'smtp.acme.com',
      // The connection's usual port followed the choice.
      smtp_port: 465,
      smtp_security: 'tls',
      smtp_username: null,
      smtp_password: 's3cret',
    })
    // Unencrypted is only offered where the server allows it.
    expect(
      within(screen.getByLabelText('Connection')).queryByRole('option', {
        name: /Unencrypted/,
      }),
    ).toBeNull()
  })

  it("shows the server's configuration read-only, without a save", async () => {
    window.history.pushState({}, '', '/platform/email')
    stubEmail({ ...SET, pinned_by_env: true }, { days: 365, pinned_by_env: true, grace_days: 14 })
    render(<App />)

    expect(await screen.findByLabelText('Host')).toBeDisabled()
    expect(
      await screen.findByText("The server's configuration sets it: every 365 days."),
    ).toBeVisible()
    expect(screen.getByLabelText('Host')).toHaveValue('smtp.acme.com')
    expect(screen.getByText(/Set in the server's configuration \(EMAIL_TRANSPORT/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it('turns on the periodic reconfirmation with a period', async () => {
    window.history.pushState({}, '', '/platform/email')
    const fetchMock = stubEmail(SET)
    render(<App />)

    fireEvent.click(
      await screen.findByLabelText('Ask accounts to confirm their address periodically'),
    )
    fireEvent.change(screen.getByLabelText('Every (days)'), { target: { value: '10' } })
    expect(screen.getByText('Between 30 and 730 days.')).toBeVisible()
    fireEvent.change(screen.getByLabelText('Every (days)'), { target: { value: '180' } })
    const panel = screen.getByText('Periodic reconfirmation').closest('form') as HTMLElement
    fireEvent.click(within(panel).getByRole('button', { name: 'Save' }))

    await screen.findByText('Changes saved', { exact: false })
    const put = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url).endsWith('/instance/email/reconfirmation') && init?.method === 'PUT',
    )
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ days: 180 })
  })

  it('reports what the server answered a test email', async () => {
    window.history.pushState({}, '', '/platform/email')
    stubEmail(SET)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Send test email' }))

    expect(await screen.findByText('Not sent: SMTP 535: authentication failed')).toBeVisible()
  })

  it('lists the outbox without content, failures with their reason', async () => {
    window.history.pushState({}, '', '/platform/email')
    stubEmail(SET)
    render(<App />)

    const row = (await screen.findByText('pat@acme.com')).closest('tr')!
    expect(within(row).getByText('Failed')).toBeInTheDocument()
    expect(within(row).getByText('3 attempts')).toBeInTheDocument()
    expect(within(row).getByText('SMTP 550: no such user')).toBeInTheDocument()
    expect(screen.getByText('1 waiting · 1 failed')).toBeInTheDocument()
  })
})
