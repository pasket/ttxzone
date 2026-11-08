import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../src/lib/AuthContext'
import { RegisterCard } from '../src/components/auth/RegisterCard'
import { mockFetchOnce } from './mockFetch'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

/** RegisterCard asks for the deployment's tenancy policy before
 * AuthProvider's /auth/me (a child's effect runs first). */
function mockPolicyThenAnonymous(canFoundOrganization = true) {
  const fetchMock = mockFetchOnce(200, {
    tenancy_mode: canFoundOrganization ? 'open' : 'managed',
    can_found_organization: canFoundOrganization,
  })
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status: 401,
    json: async () => ({
      error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
    }),
  } as Response)
  return fetchMock
}

function renderRegisterCard(canFoundOrganization = true) {
  mockPolicyThenAnonymous(canFoundOrganization)
  return render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterCard />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('RegisterCard', () => {
  it('offers three registration flows, plain-account first', async () => {
    renderRegisterCard()

    const buttons = await screen.findAllByRole('button')
    const labels = buttons.map((b) => b.textContent ?? '')
    const plainIdx = labels.findIndex((l) => l.includes('Create my account'))
    const tokenIdx = labels.findIndex((l) => l.includes('I have an invitation token'))
    const orgIdx = labels.findIndex((l) => l.includes('Set up my organization'))

    expect(plainIdx).toBeGreaterThanOrEqual(0)
    expect(tokenIdx).toBeGreaterThan(plainIdx)
    expect(orgIdx).toBeGreaterThan(tokenIdx)
  })

  it('hides "Set up my organization" when the deployment does not allow it', async () => {
    renderRegisterCard(false)

    expect(await screen.findByText('Create my account')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByText('Set up my organization')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('I have an invitation token')).toBeInTheDocument()
    // A plain account gets its role from an organization's Exercise Program Manager.
    expect(
      screen.getByText(
        "Create your account, then ask your organization's Exercise Program Manager for a role. To join an exercise as a Player, use a token instead.",
      ),
    ).toBeInTheDocument()
  })

  it('shows the organization form fields after choosing that flow', async () => {
    renderRegisterCard()

    fireEvent.click(await screen.findByText('Set up my organization'))

    const orgNameInput = screen.getByLabelText('Company name')
    expect(orgNameInput).toBeInTheDocument()
    expect(orgNameInput).toBeDisabled()
    expect(screen.getByText(/Use your company email address/)).toBeInTheDocument()
  })

  it('fills the read-only company name from the email domain', async () => {
    renderRegisterCard()

    fireEvent.click(await screen.findByText('Set up my organization'))
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@acme.com' },
    })

    expect(screen.getByLabelText('Company name')).toHaveValue('Acme')
  })

  it('registers a plain (pending-assignment) account and lands on the Waiting Room', async () => {
    const fetchMock = mockPolicyThenAnonymous()
    fetchMock
      // The form's GET /legal: nothing published.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response)
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-3',
          email: 'plain@acme.com',
          full_name: 'Plain Person',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response)

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText('Create my account'))
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'Plain Person' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'plain@acme.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correcthorse123456!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Correcthorse123456!' },
    })
    // Enabled once the deployment's legal documents (none here) are loaded.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled(),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  })

  it('shows unmet requirements and keeps submit disabled for a weak password', async () => {
    renderRegisterCard()

    fireEvent.click(await screen.findByText('Create my account'))
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'short1' },
    })

    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument()
    expect(screen.getByText(/One uppercase letter/)).toBeInTheDocument()
    expect(screen.getByText(/One symbol/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('disables submit and shows an error when passwords do not match', async () => {
    renderRegisterCard()

    fireEvent.click(await screen.findByText('Create my account'))
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correcthorse123456!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Correcthorse123456!x' },
    })

    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
  })

  it('navigates home with a pending-request flag after redeeming a token', async () => {
    const fetchMock = mockPolicyThenAnonymous()
    fetchMock
      // The form's GET /legal: nothing published.
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ttx_id: 'ttx-1',
          ttx_name: 'Ransomware Drill',
          organization_name: 'Acme Corp',
          role: 'player',
          status: 'pending',
          user: { id: 'user-2', email: 'new@external.com', full_name: 'New Person' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-2',
          email: 'new@external.com',
          full_name: 'New Person',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ items: [] }),
      } as Response)

    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText('I have an invitation token'))
    fireEvent.change(screen.getByLabelText('Invitation token'), {
      target: { value: 'some-token' },
    })
    fireEvent.change(screen.getByLabelText('Full name'), {
      target: { value: 'New Person' },
    })
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@external.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correcthorse123456!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Correcthorse123456!' },
    })
    // Enabled once the deployment's legal documents (none here) are loaded.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Join exercise' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Join exercise' }))

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/', {
        state: { justRequestedAccess: true, organizationName: 'Acme Corp' },
      }),
    )
  })
})
