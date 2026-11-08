import { render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

function stubAuth(me: Record<string, unknown>, ttxItems: Record<string, unknown>[]) {
  const ttxResponse = {
    ok: true,
    status: 200,
    json: async () => ({ items: ttxItems, total: ttxItems.length, limit: 50, offset: 0 }),
  } as Response
  const organizationsResponse = {
    ok: true,
    status: 200,
    json: async () => ({
      items: [
        {
          organization_id: 'org-1',
          organization_name: 'Acme',
          domain: 'acme.com',
          is_program_manager: Boolean(me.is_program_manager),
          is_planner: Boolean(me.is_planner),
        },
      ],
    }),
  } as Response
  // AdminOrganizationProfileSection's own GET /organizations/{id}/tags and
  // its embedded dashboard's GET /organizations/{id}/dashboard, routed by
  // URL. Only the /admin test reaches these; /creator never renders it.
  const orgResponse = async (url: string) => ({
    ok: true,
    status: 200,
    json: async () =>
      /\/ttx\/[^/]+\/dashboard/.test(url)
        ? {
            ttx_id: 'ttx-1',
            ttx_name: 'Ransomware Drill',
            generated_at: '2026-09-25T12:00:00+00:00',
            kpis: {
              players: 0,
              planners: 1,
              injects: 0,
              pending_requests: 0,
              oldest_pending_request_at: null,
            },
            invitation_breakdown: [],
            access_requests: { approved: 0, pending: 0, rejected: 0 },
            invitations: { active: 0, revoked: 0, expired: 0, redemptions: 0 },
            weekly_joins: [],
          }
        : url.includes('/dashboard')
          ? {
              organization_id: 'org-1',
              organization_name: 'Acme',
              generated_at: '2026-09-25T12:00:00+00:00',
              kpis: {
                planners: 0,
                exercise_only_planners: 0,
                exercises: 0,
                exercises_last_30_days: 0,
                unique_players: 0,
                pending_requests: 0,
                oldest_pending_request_at: null,
              },
              exercises: [],
              access_requests: { approved: 0, pending: 0, rejected: 0 },
              invitations: { active: 0, revoked: 0, expired: 0, redemptions: 0 },
              weekly_joins: [],
            }
          : { items: [], total: 0, limit: 200, offset: 0 },
  })
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => me } as Response)
    .mockResolvedValueOnce(ttxResponse)
    .mockResolvedValueOnce(organizationsResponse)
    .mockImplementation(orgResponse)
  vi.stubGlobal('fetch', fetchMock)
}

describe('RequireSection redirects to the module default section', () => {
  it('bare /admin redirects to /admin/organization', async () => {
    window.history.pushState({}, '', '/admin')
    stubAuth(
      {
        id: 'u1',
        email: 'a@acme.com',
        full_name: 'Admin',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: true,
        is_planner: false,
      },
      [],
    )

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/admin/organization'))
    const identity = within(await screen.findByRole('region', { name: 'Acme' }))
    expect(identity.getByText('Acme')).toBeInTheDocument()
    expect(identity.getByText('acme.com')).toBeInTheDocument()
  })

  it('/admin/users-and-roles?role=program_manager shows Program Managers, linked from the menu', async () => {
    window.history.pushState({}, '', '/admin/users-and-roles?role=program_manager')
    stubAuth(
      {
        id: 'u1',
        email: 'a@acme.com',
        full_name: 'Admin',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: true,
        is_planner: false,
      },
      [],
    )

    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Users and roles' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/admin/users-and-roles')
    expect(window.location.search).toBe('?role=program_manager')
    const links = await screen.findAllByRole('link', { name: 'Users and roles' })
    expect(links[0]).toHaveAttribute('href', '/admin/users-and-roles')
  })

  it('bare /creator/:ttxId redirects to /creator/:ttxId/exercise', async () => {
    window.history.pushState({}, '', '/creator/ttx-1')
    stubAuth(
      {
        id: 'u2',
        email: 'e@acme.com',
        full_name: 'Eval',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: false,
        is_planner: false,
      },
      [
        {
          id: 'ttx-1',
          name: 'Ransomware Drill',
          description: null,
          organization_id: 'org-1',
          created_by_id: 'u1',
          created_at: '2026-01-01T00:00:00Z',
          role: 'planner',
          plans: true,
          controls: true,
          tags: [],
        },
      ],
    )

    render(<App />)

    await waitFor(() => expect(window.location.pathname).toBe('/creator/ttx-1/exercise'))
    // The exercise page itself renders (band + dashboard), not just the URL.
    expect(await screen.findByText('No other planners yet')).toBeInTheDocument()
  })
})
