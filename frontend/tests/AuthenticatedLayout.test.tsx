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
          is_program_manager: Boolean(me.is_program_manager),
          is_planner: Boolean(me.is_planner),
        },
      ],
    }),
  } as Response
  const orgProfileResponse = {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'org-1',
      name: 'Acme',
      tax_id: null,
      subscription_tier: 'free',
      description: null,
      logo_url: null,
      created_at: new Date().toISOString(),
    }),
  } as Response
  const ttxDashboardResponse = () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
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
      }),
    }) as Response
  const eegNotReadyResponse = () =>
    ({
      ok: false,
      status: 409,
      json: async () => ({
        success: false,
        error: { code: 'NEEDS_FORM_NOT_APPROVED', message: 'Not yet', ttx_id: null },
      }),
    }) as Response
  // The Playground's live session, not started yet.
  const runResponse = () =>
    ({
      ok: true,
      status: 200,
      json: async () => ({
        state: 'not_started',
        seq: 0,
        started_at: null,
        ended_at: null,
        stop_reason: '',
        stop_keyword: 'APPLE',
        scenario_title: 'Ransomware',
        scenario_summary: '',
        incident_start: null,
        time_compression: 60,
        session_time: null,
        phases: [],
        current_phase_code: null,
        injects: [],
        can_control: false,
        msel_ready: true,
        plan_ready: true,
        control: null,
        cursor: '0.x',
        presence: [],
        facilitation: null,
      }),
    }) as Response
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => me } as Response)
    .mockResolvedValueOnce(ttxResponse)
    .mockResolvedValueOnce(organizationsResponse)
    // Whatever the landing page fetches next: Creator -> Exercise's own
    // dashboard, Execution -> Evaluation's EEG (not ready yet), or (bare
    // /admin -> /admin/organization) the org profile.
    .mockImplementation(async (url: string) =>
      /\/ttx\/[^/]+\/dashboard/.test(url)
        ? ttxDashboardResponse()
        : /\/ttx\/[^/]+\/run\/notes/.test(url)
          ? ({ ok: true, status: 200, json: async () => ({ items: [] }) } as Response)
          : /\/ttx\/[^/]+\/run/.test(url)
            ? runResponse()
            : /\/ttx\/[^/]+\/eeg/.test(url)
              ? eegNotReadyResponse()
              : orgProfileResponse,
    )
  vi.stubGlobal('fetch', fetchMock)
}

describe('AuthenticatedLayout primary nav shows the active module sections', () => {
  it('shows Admin sections at /admin', async () => {
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

    const nav = within(await screen.findByRole('navigation', { name: 'Primary' }))
    // Users and roles groups every org grant (second level in SecondaryNav).
    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Organization',
      'Users and roles',
      'Exercises',
      'Allowed Domains',
      'Library',
      'Improvement plan',
    ])
    // Tags are managed inside Organization's edit mode, not a section.
    expect(nav.queryByRole('link', { name: 'Tagging' })).not.toBeInTheDocument()
  })

  it('lets the content shrink to the viewport instead of scrolling the page', async () => {
    window.history.pushState({}, '', '/admin/users-and-roles')
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

    await screen.findByRole('navigation', { name: 'Primary' })
    const main = document.getElementById('main-content')!
    expect(main).toHaveClass('min-w-0')
    expect(main.firstElementChild).toHaveClass('max-w-[1584px]')
  })

  it('shows Creator sections at /creator/:ttxId', async () => {
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

    const nav = within(await screen.findByRole('navigation', { name: 'Primary' }))
    expect(nav.getByRole('link', { name: 'MSEL' })).toBeInTheDocument()
    // Library closes the menu; the portfolio is in the ContextBar.
    expect(nav.getByRole('link', { name: 'Library' })).toBeInTheDocument()
    expect(nav.queryByRole('link', { name: 'Exercises' })).not.toBeInTheDocument()
    expect(nav.queryByRole('link', { name: 'Settings' })).not.toBeInTheDocument()
    // Lands on the exercise page, which renders fully.
    expect(await screen.findByText('No other planners yet')).toBeInTheDocument()
  })

  it('shows Playground sections at /playground/:ttxId', async () => {
    window.history.pushState({}, '', '/playground/ttx-2')
    stubAuth(
      {
        id: 'u3',
        email: 'p@acme.com',
        full_name: 'Part',
        totp_enabled: false,
        legal_acceptance_pending: [],
        is_program_manager: false,
        is_planner: false,
      },
      [
        {
          id: 'ttx-2',
          name: 'Insider Threat',
          description: null,
          organization_id: 'org-1',
          created_by_id: 'u1',
          created_at: '2026-01-01T00:00:00Z',
          role: 'player',
          tags: [],
        },
      ],
    )

    render(<App />)

    const nav = within(await screen.findByRole('navigation', { name: 'Primary' }))
    expect(nav.getByRole('link', { name: 'Playground' })).toBeInTheDocument()
    // The EEG is for Planners and Evaluators, never for players.
    expect(nav.queryByRole('link', { name: 'Evaluation' })).not.toBeInTheDocument()
  })

  it('lands an Evaluator on the Player landing, identified, with Evaluation in reach', async () => {
    window.history.pushState({}, '', '/playground/ttx-3')
    stubAuth(
      {
        id: 'u4',
        email: 'auditor@external.org',
        full_name: 'Audra',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: false,
        is_planner: false,
      },
      [
        {
          id: 'ttx-3',
          name: 'Supply chain',
          description: null,
          organization_id: 'org-1',
          created_by_id: 'u1',
          created_at: '2026-01-01T00:00:00Z',
          role: 'evaluator',
          tags: [],
        },
      ],
    )

    render(<App />)

    const nav = within(await screen.findByRole('navigation', { name: 'Primary' }))
    expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Playground',
      'Evaluation',
      'After-action report',
    ])
    await waitFor(() => expect(window.location.pathname).toBe('/playground/ttx-3/dashboard'))
    expect(await screen.findByText('You take part as Evaluator')).toBeInTheDocument()
    // The same Playground as the table, with the exercise band.
    expect(screen.getByText('Exercise · Exercise · Exercise')).toBeInTheDocument()
    expect(screen.getByText('«APPLE»')).toBeInTheDocument()
  })
})
