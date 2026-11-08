import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

const ME = {
  id: 'u1',
  email: 'pat@globex.com',
  full_name: 'Pat Player',
  totp_enabled: true,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
}
const GLOBEX = {
  organization_id: 'org-new',
  organization_name: 'Globex Security',
  domain: 'globex.com',
  alias: null,
  logo_url: null,
  is_program_manager: true,
  is_planner: true,
}

/** A signed-in account with no role anywhere; POST /organizations/mine
 * answers `founding`, after which the new org is listed. */
function stubFetch(founding: { status: number; body: unknown }) {
  let founded = false
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const json = (status: number, body: unknown) =>
      ({ ok: status < 400, status, json: async () => body }) as Response
    if (url.includes('/organizations/mine') && init?.method === 'POST') {
      founded = founding.status === 201
      return json(founding.status, founding.body)
    }
    if (url.includes('/auth/me')) {
      return json(200, founded ? { ...ME, is_program_manager: true, is_planner: true } : ME)
    }
    if (url.includes('/organizations/mine')) return json(200, { items: founded ? [GLOBEX] : [] })
    if (url.includes('/ttx')) return json(200, { items: [], total: 0, limit: 50, offset: 0 })
    return json(200, { items: [], total: 0, limit: 50, offset: 0 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Create organization', () => {
  it('is reached from the avatar menu', async () => {
    window.history.pushState({}, '', '/account/settings/general')
    stubFetch({ status: 201, body: {} })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Create your own organization' }))

    expect(await screen.findByLabelText('Organization name')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account/organizations/new')
  })

  it('founds the organization and opens its Admin', async () => {
    window.history.pushState({}, '', '/account/organizations/new')
    const fetchMock = stubFetch({
      status: 201,
      body: { id: 'org-new', name: 'Globex Security', domain: 'globex.com' },
    })
    render(<App />)

    expect(await screen.findByDisplayValue('globex.com')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Organization name'), {
      target: { value: '  Globex Security ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create organization' }))

    await waitFor(() => expect(window.location.pathname).toMatch(/^\/admin/))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/organizations/mine'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Globex Security' }),
      }),
    )
  })

  it('explains why a personal email cannot found one', async () => {
    window.history.pushState({}, '', '/account/organizations/new')
    stubFetch({
      status: 422,
      body: {
        success: false,
        error: { code: 'FREE_EMAIL_DOMAIN_BLOCKED', message: 'Server text', ttx_id: null },
      },
    })
    render(<App />)

    fireEvent.change(await screen.findByLabelText('Organization name'), {
      target: { value: 'Mine' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create organization' }))

    expect(
      await screen.findByText(/An organization needs a work email address/),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account/organizations/new')
  })
})
