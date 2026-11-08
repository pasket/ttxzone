import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountSettingsGeneral } from '../src/components/account/AccountSettingsGeneral'
import { AuthProvider } from '../src/lib/AuthContext'
import { ThemeProvider } from '../src/lib/ThemeContext'

function stubAuth() {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'u1',
        email: 'owner@acme.com',
        full_name: 'Owner',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: true,
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
  vi.stubGlobal('fetch', fetchMock)
}

function renderGeneral() {
  stubAuth()
  return render(
    <ThemeProvider>
      <AuthProvider>
        <AccountSettingsGeneral />
      </AuthProvider>
    </ThemeProvider>,
  )
}

function stubMultiOrgAuth() {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'u1',
        email: 'multi@acme.com',
        full_name: 'Multi',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: true,
        default_organization_id: null,
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
      json: async () => ({
        items: [
          {
            organization_id: 'org-1',
            organization_name: 'Org One',
            is_program_manager: true,
            is_planner: false,
          },
          {
            organization_id: 'org-2',
            organization_name: 'Org Two',
            is_program_manager: false,
            is_planner: true,
          },
        ],
      }),
    } as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AccountSettingsGeneral', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('shows the read-only email once auth resolves', async () => {
    renderGeneral()

    expect(await screen.findByDisplayValue('owner@acme.com')).toBeDisabled()
  })

  it('defaults to Dark and toggling Light removes the dark class + persists it', async () => {
    renderGeneral()
    await screen.findByDisplayValue('owner@acme.com')

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('ttx_theme')).toBe('light')
  })

  it('toggling back to Dark re-adds the dark class + persists it', async () => {
    renderGeneral()
    await screen.findByDisplayValue('owner@acme.com')

    fireEvent.click(screen.getByRole('button', { name: 'Light' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('ttx_theme')).toBe('dark')
  })

  it('hides the default-organization picker for a single-organization user', async () => {
    renderGeneral()

    await screen.findByDisplayValue('owner@acme.com')
    expect(screen.queryByText('Default organization')).not.toBeInTheDocument()
  })

  it('carries no default-organization picker (that is Default selection)', async () => {
    stubMultiOrgAuth()
    render(
      <ThemeProvider>
        <AuthProvider>
          <AccountSettingsGeneral />
        </AuthProvider>
      </ThemeProvider>,
    )

    await screen.findByDisplayValue('multi@acme.com')
    expect(screen.queryByText('Default organization')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Organization')).not.toBeInTheDocument()
  })
})
