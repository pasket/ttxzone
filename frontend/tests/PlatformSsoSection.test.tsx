import { fireEvent, render, screen } from '@testing-library/react'
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
  has_password: true,
  sso_linked: false,
  sso_provider: null,
}

const NOT_SET = {
  active: false,
  pinned_by_env: false,
  redirect_uri: 'https://ttx.acme.com/api/v1/auth/oidc/callback',
  configured: false,
  enabled: false,
  provider_kind: null,
  display_name: null,
  entra_tenant_id: null,
  issuer_url: null,
  client_id: null,
  allow_jit: false,
  trust_provider_mfa: true,
  has_client_secret: false,
  client_secret_readable: true,
  linked_accounts: 0,
  updated_at: null,
}

const SET = {
  ...NOT_SET,
  active: true,
  configured: true,
  enabled: true,
  provider_kind: 'entra',
  display_name: 'Microsoft',
  entra_tenant_id: '11111111-2222-3333-4444-555555555555',
  client_id: 'client-id',
  has_client_secret: true,
  updated_at: '2026-10-28T09:00:00Z',
}

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function stubSso(settings: unknown) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return json(ME)
    if (url.endsWith('/instance/oidc/test')) {
      return json({ ok: false, error: 'provider_unreachable', detail: 'timed out' })
    }
    if (url.endsWith('/instance/oidc')) {
      if (init?.method === 'PUT') return json(SET)
      return json(settings)
    }
    if (url.includes('/ttx')) return json({ items: [], total: 0, limit: 50, offset: 0 })
    return json({ items: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Platform -> Single sign-on', () => {
  it('sets up Microsoft Entra ID, sending the client secret once', async () => {
    window.history.pushState({}, '', '/platform/sso')
    const fetchMock = stubSso(NOT_SET)
    render(<App />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Single sign-on' }),
    ).toBeInTheDocument()
    expect(
      await screen.findByText('https://ttx.acme.com/api/v1/auth/oidc/callback'),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Directory (tenant) ID'), {
      target: { value: '11111111-2222-3333-4444-555555555555' },
    })
    fireEvent.change(screen.getByLabelText('Application (client) ID'), {
      target: { value: 'client-id' },
    })
    fireEvent.change(screen.getByLabelText('Client secret'), { target: { value: 's3cret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save and turn on' }))

    expect(await screen.findByText('Single sign-on settings saved')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(
      ([url, init]) => String(url).endsWith('/instance/oidc') && init?.method === 'PUT',
    )!
    expect(JSON.parse(String(put[1]!.body))).toEqual({
      enabled: true,
      provider_kind: 'entra',
      display_name: null,
      entra_tenant_id: '11111111-2222-3333-4444-555555555555',
      issuer_url: null,
      client_id: 'client-id',
      client_secret: 's3cret',
      allow_jit: false,
      trust_provider_mfa: true,
    })
  })

  it("shows the server's configuration read-only, without a save", async () => {
    window.history.pushState({}, '', '/platform/sso')
    stubSso({ ...SET, pinned_by_env: true })
    render(<App />)

    expect(await screen.findByLabelText('Application (client) ID')).toBeDisabled()
    expect(screen.getByText(/Set in the server's configuration \(OIDC_PROVIDER/)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('reports why the provider test failed', async () => {
    window.history.pushState({}, '', '/platform/sso')
    stubSso(SET)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Test' }))

    expect(
      await screen.findByText(/The provider can't be reached from the server\. \(timed out\)/),
    ).toBeVisible()
  })

  it('says why the provider is read-only without a public address', async () => {
    window.history.pushState({}, '', '/platform/sso')
    stubSso({ ...NOT_SET, redirect_uri: null })
    render(<App />)

    expect(await screen.findByLabelText('Application (client) ID')).toBeDisabled()
    expect(
      screen.getByText(/Set PUBLIC_BASE_URL on the server to configure single sign-on here/),
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Save and turn on' })).toBeNull()
  })
})
