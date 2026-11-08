import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'
import { BUILD_INFO } from '../src/lib/buildInfo'

// The Program Manager's organization -- without one, Admin isn't visible
// and RequireModule sends /admin back home.
const ACME = { id: 'org-1', name: 'Acme', is_program_manager: true, is_planner: false }

describe('Header logout', () => {
  it('calls POST /auth/logout and returns to the login screen', async () => {
    window.history.pushState({}, '', '/admin')

    const meResponse = {
      id: 'u1',
      email: 'owner@acme.com',
      full_name: 'Owner',
      totp_enabled: true,
      legal_acceptance_pending: [],
      is_program_manager: true,
      is_planner: false,
    }
    const anonymousError = {
      error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
    }

    let loggedOut = false
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/logout')) {
        loggedOut = true
        return { ok: true, status: 204, json: async () => undefined } as Response
      }
      if (url.includes('/auth/me')) {
        if (loggedOut)
          return { ok: false, status: 401, json: async () => anonymousError } as Response
        return { ok: true, status: 200, json: async () => meResponse } as Response
      }
      if (url.includes('/ttx')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
        } as Response
      }
      if (url.includes('/organizations/mine')) {
        return { ok: true, status: 200, json: async () => ({ items: [ACME] }) } as Response
      }
      if (url.includes('/planners')) {
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response
      }
      return { ok: false, status: 401, json: async () => anonymousError } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const avatarButton = await screen.findByRole('button', { name: 'Account menu' })
    fireEvent.click(avatarButton)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Log out' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('Header account menu keyboard support', () => {
  function stubSignedInFetch(overrides: Record<string, unknown> = {}) {
    const meResponse = {
      id: 'u1',
      email: 'owner@acme.com',
      full_name: 'Owner',
      totp_enabled: true,
      legal_acceptance_pending: [],
      is_program_manager: true,
      is_planner: false,
      ...overrides,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/me')) {
          return { ok: true, status: 200, json: async () => meResponse } as Response
        }
        if (url.includes('/ttx')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
          } as Response
        }
        if (url.includes('/organizations/mine')) {
          return { ok: true, status: 200, json: async () => ({ items: [ACME] }) } as Response
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response
      }),
    )
  }

  it('follows the deployment: no Create organization when closed, Platform for its administrator', async () => {
    window.history.pushState({}, '', '/admin')
    stubSignedInFetch({ can_found_organization: false, is_instance_admin: true })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }))

    expect(
      await screen.findByRole('menuitem', { name: 'Instance administration' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('menuitem', { name: 'Create new organization' })).toBeNull()
  })

  it('moves focus into the menu, cycles with arrows and closes on Escape', async () => {
    window.history.pushState({}, '', '/admin')
    stubSignedInFetch()
    render(<App />)

    const trigger = await screen.findByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)

    const preferences = await screen.findByRole('menuitem', { name: 'Preferences' })
    const createOrganization = screen.getByRole('menuitem', {
      name: 'Create new organization',
    })
    const about = screen.getByRole('menuitem', { name: 'About TTX-Zone' })
    const logout = screen.getByRole('menuitem', { name: 'Log out' })
    expect(preferences).toHaveFocus()

    const menu = screen.getByRole('menu')
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(createOrganization).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(about).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(logout).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(preferences).toHaveFocus()
    fireEvent.keyDown(menu, { key: 'End' })
    expect(logout).toHaveFocus()

    fireEvent.keyDown(menu, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes when clicking outside the menu', async () => {
    window.history.pushState({}, '', '/admin')
    stubSignedInFetch()
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Account menu' }))
    expect(await screen.findByRole('menu')).toBeInTheDocument()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('opens About with the build version and returns focus to the trigger', async () => {
    window.history.pushState({}, '', '/admin')
    stubSignedInFetch()
    render(<App />)

    const trigger = await screen.findByRole('button', { name: 'Account menu' })
    fireEvent.click(trigger)
    fireEvent.click(await screen.findByRole('menuitem', { name: 'About TTX-Zone' }))

    const dialog = await screen.findByRole('dialog', { name: 'About TTX-Zone' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(dialog).toHaveTextContent(BUILD_INFO.version)
    expect(dialog).toHaveTextContent('The MITRE Corporation')
    expect(dialog).toHaveTextContent('TTX-Zone, created by Andoni Valverde.')
    expect(within(dialog).getByRole('link', { name: 'GNU AGPL v3.0 or later' })).toHaveAttribute(
      'href',
      'https://www.gnu.org/licenses/agpl-3.0.html',
    )
    expect(
      within(dialog).getByRole('link', { name: 'https://github.com/pasket/ttxzone' }),
    ).toHaveAttribute('href', 'https://github.com/pasket/ttxzone')

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })
})
