import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

describe('Exercise Program Manager home routing', () => {
  it.each([['/', 'lands on the admin module, not the Waiting Room, even with zero TTX']])(
    'from %s: %s',
    async (startPath) => {
      window.history.pushState({}, '', startPath)

      const fetchMock = vi
        .fn()
        // GET /auth/me -- Exercise Program Manager, already TOTP-enrolled
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'user-1',
            email: 'owner@acme.com',
            full_name: 'Owner',
            totp_enabled: true,
            legal_acceptance_pending: [],
            is_program_manager: true,
            is_planner: false,
          }),
        } as Response)
        // GET /ttx -- brand-new org, no TTX created yet (AuthProvider's own
        // fetch on mount)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
        } as Response)
        // GET /organizations/mine -- becomes the active org, program_manager here.
        // AdminOrganizationProfileSection reads this list straight off
        // useAuth() rather than fetching it itself.
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                organization_id: 'org-1',
                organization_name: 'Acme',
                domain: 'acme.com',
                is_program_manager: true,
                is_planner: false,
              },
            ],
          }),
        } as Response)
        // AdminOrganizationProfileSection's own GET /organizations/{id}/tags
        // and its embedded dashboard's GET /organizations/{id}/dashboard --
        // routed by URL since child/parent effects decide their order.
        .mockImplementation(async (url: string) => ({
          ok: true,
          status: 200,
          json: async () =>
            url.includes('/dashboard')
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
        }))
      vi.stubGlobal('fetch', fetchMock)

      render(<App />)

      expect(await screen.findByText('Organization profile')).toBeInTheDocument()
      expect(window.location.pathname).toBe('/admin/organization')
      expect(screen.queryByText('Your profile is active')).not.toBeInTheDocument()
      const identity = within(await screen.findByRole('region', { name: 'Acme' }))
      expect(identity.getByText('Acme')).toBeInTheDocument()
      expect(identity.getByText('acme.com')).toBeInTheDocument()
    },
  )
})
