import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AccountSettingsPrivacy } from '../src/components/account/AccountSettingsPrivacy'
import { AuthProvider } from '../src/lib/AuthContext'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const ME = {
  id: 'u1',
  email: 'owner@acme.com',
  full_name: 'Owner',
  totp_enabled: true,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
  is_instance_admin: false,
  is_last_instance_admin: false,
}

/** GET /auth/me answers `me`; the legal documents and acceptances, none;
 * GET /auth/me/lead-exercises (and anything else) `leads`; DELETE /auth/me
 * answers `deleted`. */
function stubApi(deleted: Response, leads: unknown[] = [], me: Record<string, unknown> = ME) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') return deleted
    if (String(url).endsWith('/auth/me')) return json(200, me)
    if (String(url).endsWith('/legal') || String(url).includes('/auth/legal/')) {
      return json(200, { items: [] })
    }
    return json(200, { items: leads })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderPrivacy() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <AccountSettingsPrivacy />
      </AuthProvider>
    </MemoryRouter>,
  )
}

async function typePhrase() {
  const submit = screen.getByRole('button', { name: 'Delete my account' })
  fireEvent.change(screen.getByPlaceholderText('delete my account'), {
    target: { value: 'delete my account' },
  })
  // Enabled once the exercises to hand over have loaded.
  await waitFor(() => expect(submit).toBeEnabled())
  return submit
}

describe('AccountSettingsPrivacy', () => {
  it("warns the deployment's last instance administrator", async () => {
    stubApi(json(204, undefined), [], {
      ...ME,
      is_instance_admin: true,
      is_last_instance_admin: true,
    })
    renderPrivacy()

    expect(await screen.findByText(/only instance administrator/)).toBeInTheDocument()
  })

  it('says nothing to anyone else', async () => {
    stubApi(json(204, undefined))
    renderPrivacy()

    await typePhrase()
    expect(screen.queryByText(/only instance administrator/)).toBeNull()
  })

  it('keeps submit disabled until the exact confirmation phrase is typed', async () => {
    stubApi(json(204, undefined))
    renderPrivacy()

    const submit = screen.getByRole('button', { name: 'Delete my account' })
    expect(submit).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('delete my account'), {
      target: { value: 'delete my acount' },
    })
    expect(submit).toBeDisabled()

    await typePhrase()
  })

  it('submits the confirmation and navigates to login on success', async () => {
    const fetchMock = stubApi(json(204, undefined))
    renderPrivacy()

    fireEvent.click(await typePhrase())

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ confirmation: 'delete my account', lead_successors: {} }),
      }),
    )
  })

  it('asks who takes over each exercise the account leads', async () => {
    const fetchMock = stubApi(json(204, undefined), [
      {
        ttx_id: 'ttx-1',
        ttx_code: 'TTX-2026-02',
        ttx_name: 'Ransomware drill',
        organization_name: 'Acme',
        candidates: [
          { user_id: 'max', full_name: 'Max Manager' },
          { user_id: 'ana', full_name: 'Ana Analyst' },
        ],
      },
    ])
    renderPrivacy()

    const successor = await screen.findByLabelText(/Ransomware drill/)
    expect(screen.getByText('Hand over the Lead Planner role')).toBeInTheDocument()
    // The longest-standing member is preselected.
    expect(successor).toHaveValue('max')
    fireEvent.change(successor, { target: { value: 'ana' } })
    fireEvent.click(await typePhrase())

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/login'))
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/me'),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          confirmation: 'delete my account',
          lead_successors: { 'ttx-1': 'ana' },
        }),
      }),
    )
  })

  it('shows the server error on confirmation mismatch', async () => {
    stubApi(
      json(400, {
        error: { code: 'CONFIRMATION_MISMATCH', message: 'Confirmation text does not match.' },
      }),
    )
    renderPrivacy()

    fireEvent.click(await typePhrase())

    expect(await screen.findByText('Confirmation text does not match.')).toBeInTheDocument()
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
