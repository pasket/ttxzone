import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const ME = {
  id: 'u2',
  email: 'pat@acme.com',
  full_name: 'Pat',
  totp_enabled: false,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
  is_instance_admin: false,
  can_found_organization: false,
}

describe('Signing in with a temporary password', () => {
  it('asks for a new password before anything else, then goes on', async () => {
    let required = true
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/auth/me')) return json({ ...ME, password_change_required: required })
      if (url.endsWith('/auth/password') && init?.method === 'POST') {
        required = false
        return json(undefined, 204)
      }
      return json({ items: [], total: 0, limit: 50, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/admin/organization')
    render(<App />)

    expect(
      await screen.findByRole('heading', { name: 'Choose your own password' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account/password')
    // Nothing else was asked for while the password is temporary.
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/organizations/mine'),
      expect.anything(),
    )

    fireEvent.change(screen.getByLabelText('Temporary password'), {
      target: { value: 'Tmp#2kQ9xYzA7mWp' },
    })
    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'Brandnew123!' },
    })
    fireEvent.change(screen.getByLabelText(/Confirm/), { target: { value: 'Brandnew123!' } })
    fireEvent.click(screen.getByRole('button', { name: /password/i }))

    await waitFor(() => expect(window.location.pathname).not.toBe('/account/password'))
    const change = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/auth/password'))!
    expect(JSON.parse(String(change[1]!.body))).toEqual({
      current_password: 'Tmp#2kQ9xYzA7mWp',
      new_password: 'Brandnew123!',
    })
  })
})
