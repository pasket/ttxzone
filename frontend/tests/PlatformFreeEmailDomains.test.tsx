import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const DOMAINS = [
  { domain: 'gmail.com', builtin: true, active: true },
  { domain: 'proton.me', builtin: true, active: true },
  { domain: 'telefonica.net', builtin: false, active: true },
]

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function stubPlatform(mode: 'open' | 'single' | 'managed') {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return json(ME)
    if (url.endsWith('/instance/settings')) {
      return json({
        tenancy_mode: mode,
        max_organizations: null,
        pinned_by_env: false,
        organization_count: 1,
      })
    }
    if (url.endsWith('/instance/free-email-domains') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      return json({ domain: body.domain.toLowerCase(), builtin: false, active: true }, 201)
    }
    const one = url.match(/\/instance\/free-email-domains\/([\w.-]+)$/)
    if (one && init?.method === 'PUT') {
      return json({ domain: one[1], builtin: true, ...JSON.parse(String(init.body)) })
    }
    if (url.endsWith('/instance/free-email-domains')) {
      return json({ items: DOMAINS, applies: mode === 'open' })
    }
    if (url.includes('/ttx')) return json({ items: [], total: 0, limit: 50, offset: 0 })
    return json({ items: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Platform → Tenancy rule: free email domains', () => {
  it.each(['managed', 'single'] as const)('hides the list under the %s rule', async (mode) => {
    window.history.pushState({}, '', '/platform/tenancy')
    const fetchMock = stubPlatform(mode)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Who can create organizations' }))
    expect(screen.queryByRole('heading', { name: 'Free email domains' })).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('free-email-domains'))).toBe(
      false,
    )
  })

  it('shows the list under the open rule, saying it applies only there', async () => {
    window.history.pushState({}, '', '/platform/tenancy')
    stubPlatform('open')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Free email domains' })).toBeInTheDocument()
    expect(screen.getByText(/Under the other rules this list has no effect/)).toBeInTheDocument()
    expect(await screen.findByText('3 domains')).toBeInTheDocument()
    const added = screen.getByText('telefonica.net').closest('tr')!
    expect(within(added).getByText('Added')).toBeInTheDocument()
    expect(within(added).getByRole('button', { name: 'Remove telefonica.net' })).toBeInTheDocument()
    const builtin = screen.getByRole('switch', { name: 'gmail.com' }).closest('tr')!
    expect(within(builtin).getByText('Built-in')).toBeInTheDocument()
    expect(within(builtin).queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })

  it('waits for the list before adding, or the new domain would replace it', async () => {
    window.history.pushState({}, '', '/platform/tenancy')
    const fetchMock = stubPlatform('open')
    const answer = fetchMock.getMockImplementation()!
    let release = () => {}
    const arrived = new Promise<void>((resolve) => (release = resolve))
    fetchMock.mockImplementation(async (input, init) => {
      if (String(input).endsWith('/instance/free-email-domains')) await arrived
      return answer(input, init)
    })
    render(<App />)

    fireEvent.change(await screen.findByLabelText('Domain'), { target: { value: 'hotmail.es' } })
    expect(screen.getByRole('button', { name: 'Add domain' })).toBeDisabled()
    release()
    await screen.findByText('3 domains')
    expect(screen.getByRole('button', { name: 'Add domain' })).toBeEnabled()
  })

  it('adds a domain and switches a built-in one off', async () => {
    window.history.pushState({}, '', '/platform/tenancy')
    const fetchMock = stubPlatform('open')
    render(<App />)

    await screen.findByText('3 domains')
    fireEvent.change(screen.getByLabelText('Domain'), { target: { value: 'Hotmail.ES' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }))
    expect(await screen.findByText('hotmail.es')).toBeInTheDocument()
    expect(screen.getByText('4 domains')).toBeInTheDocument()

    const gmail = screen.getByRole('switch', { name: 'gmail.com' })
    expect(gmail).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(gmail)
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'gmail.com' })).toHaveAttribute(
        'aria-checked',
        'false',
      ),
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(String(put[0])).toContain('/instance/free-email-domains/gmail.com')
    expect(JSON.parse(String(put[1]!.body))).toEqual({ active: false })
  })
})
