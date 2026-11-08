import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

function stubAuth(me: Record<string, unknown>, ttxItems: Record<string, unknown>[]) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({ ok: true, status: 200, json: async () => me } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: ttxItems, total: ttxItems.length, limit: 50, offset: 0 }),
    } as Response)
    .mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        items: [
          {
            organization_id: 'org-1',
            organization_name: 'Org One',
            is_program_manager: false,
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
    // The Playground's session (not started) where a page shows it, and
    // the no-exercise overview's own GET, once switching to org-2 (no
    // exercise yet) lands on /creator/exercise.
    .mockImplementation(
      async (url: string) =>
        ({
          ok: true,
          status: 200,
          json: async () => (/\/run/.test(url) ? notStartedRun : emptyOverview),
        }) as Response,
    )
  vi.stubGlobal('fetch', fetchMock)
}

/** GET /ttx/{id}/run before the session starts. */
const notStartedRun = {
  state: 'not_started',
  seq: 0,
  started_at: null,
  ended_at: null,
  stop_reason: '',
  stop_keyword: '',
  scenario_title: '',
  scenario_summary: '',
  incident_start: null,
  time_compression: 60,
  session_time: null,
  phases: [],
  current_phase_code: null,
  injects: [],
  can_control: false,
  msel_ready: false,
  plan_ready: false,
  control: null,
  cursor: '0.x',
  presence: [],
  facilitation: null,
}

/** GET .../planner-overview for a Planner with no exercise. */
const emptyOverview = {
  organization_id: 'org-2',
  organization_name: 'Org Two',
  generated_at: '2026-09-25T12:00:00+00:00',
  exercises: 0,
  exercises_last_30_days: 0,
  owned_by_you: 0,
  co_planned_by_you: 0,
  planners: 1,
  unique_players: 0,
  weekly_exercises: [],
}

/** GET /ttx/{ttx_id}/dashboard for Creator -> Exercise. */
const emptyTtxDashboard = {
  ttx_id: 'ttx-1',
  ttx_name: 'Drill',
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

/** URL-branching fetch mock for scenarios that need to serve requests
 * fired after the initial mount (a Creator form's own list fetch,
 * re-fetched when `activeTtxId` changes), unlike the sequential
 * `stubAuth` above which only covers the fixed 3-call mount sequence. */
function dynamicFetchMock(opts: {
  me: Record<string, unknown>
  ttxItems: Record<string, unknown>[]
  organizations: Record<string, unknown>[]
}) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/auth/me')) {
      return { ok: true, status: 200, json: async () => opts.me } as Response
    }
    if (url.includes('/organizations/mine')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: opts.organizations }),
      } as Response
    }
    if (/\/ttx\/[^/]+\/dashboard/.test(url)) {
      return { ok: true, status: 200, json: async () => emptyTtxDashboard } as Response
    }
    if (url.includes('/planner-overview')) {
      return { ok: true, status: 200, json: async () => emptyOverview } as Response
    }
    if (url.includes('/invitation-tokens')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
      } as Response
    }
    // An exercise's own resources (needs form, MSEL, …) aren't served:
    // answering them with the exercise list crashes the page reading them.
    if (/\/ttx\/[^/?]+\/[^?]/.test(url)) {
      return { ok: false, status: 404, json: async () => ({}) } as Response
    }
    if (url.includes('/ttx')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: opts.ttxItems,
          total: opts.ttxItems.length,
          limit: 50,
          offset: 0,
        }),
      } as Response
    }
    return { ok: false, status: 404, json: async () => ({}) } as Response
  })
}

describe('ContextBar', () => {
  it('shows a static label (no control) for a single-organization user', async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'ttx-1',
              name: 'Drill',
              description: null,
              organization_id: 'org-1',
              created_by_id: 'u2',
              created_at: '2026-01-01T00:00:00Z',
              role: 'player',
              tags: [],
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              organization_id: 'org-1',
              organization_name: 'Org One',
              is_program_manager: false,
              is_planner: false,
            },
          ],
        }),
      } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByRole('navigation', { name: 'Primary' })
    expect(await screen.findByText('Org One')).toBeInTheDocument()
    expect(screen.queryByLabelText('Select organization')).not.toBeInTheDocument()
  })

  it('shows the alias in parentheses next to the organization name when set', async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'ttx-1',
              name: 'Drill',
              description: null,
              organization_id: 'org-1',
              created_by_id: 'u2',
              created_at: '2026-01-01T00:00:00Z',
              role: 'player',
              tags: [],
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              organization_id: 'org-1',
              organization_name: 'Org One',
              alias: 'The Original',
              is_program_manager: false,
              is_planner: false,
            },
          ],
        }),
      } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText('Org One (The Original)')).toBeInTheDocument()
  })

  it("shows the active organization's logo as a badge when set", async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'ttx-1',
              name: 'Drill',
              description: null,
              organization_id: 'org-1',
              created_by_id: 'u2',
              created_at: '2026-01-01T00:00:00Z',
              role: 'player',
              tags: [],
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              organization_id: 'org-1',
              organization_name: 'Org One',
              alias: null,
              logo_url: '/media/org-logos/org-1.jpg',
              is_program_manager: false,
              is_planner: false,
            },
          ],
        }),
      } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    await screen.findByText('Org One')
    const badge = document.querySelector('img[src="/media/org-logos/org-1.jpg"]')
    expect(badge).toBeInTheDocument()
  })

  it('renders no image when the organization has no logo', async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              id: 'ttx-1',
              name: 'Drill',
              description: null,
              organization_id: 'org-1',
              created_by_id: 'u2',
              created_at: '2026-01-01T00:00:00Z',
              role: 'player',
              tags: [],
            },
          ],
          total: 1,
          limit: 50,
          offset: 0,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          items: [
            {
              organization_id: 'org-1',
              organization_name: 'Org One',
              alias: null,
              logo_url: null,
              is_program_manager: false,
              is_planner: false,
            },
          ],
        }),
      } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const orgLabel = await screen.findByText('Org One')
    expect(orgLabel.parentElement?.querySelector('img')).not.toBeInTheDocument()
  })

  it('lists every organization by name and switching navigates home', async () => {
    // Start on the settled URL: a bare /playground/ttx-1 redirects to its first
    // section in an effect, and a click landing before that redirect gets
    // overwritten by it (flaky under CI load).
    window.history.pushState({}, '', '/playground/ttx-1/dashboard')
    stubAuth(
      {
        id: 'u1',
        email: 'multi@acme.com',
        full_name: 'Multi',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: false,
        is_planner: true,
      },
      [
        {
          id: 'ttx-1',
          name: 'Drill',
          description: null,
          organization_id: 'org-1',
          created_by_id: 'u2',
          created_at: '2026-01-01T00:00:00Z',
          role: 'player',
          tags: [],
        },
      ],
    )

    render(<App />)

    const select = await screen.findByLabelText('Select organization')
    expect(screen.getByRole('option', { name: 'Org One' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Org Two' })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'org-2' } })

    // Switching orgs navigates home, which then re-resolves the default
    // route for the newly active org -- org-2's Planner membership with
    // zero TTX there yet sends it to the organization overview.
    expect(await screen.findByText('Exercises in the organization')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/creator/exercises')
  })

  it('keeps the Planner role when switching org from an exercise route', async () => {
    // On /creator/{ttx}, the old URL's exercise must not pull the context
    // back to its org once the switch lands.
    window.history.pushState({}, '', '/creator/ttx-1/exercise')
    const planner = (id: string, organization_id: string, role: string) => ({
      id,
      name: id,
      description: null,
      organization_id,
      created_by_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      role,
      tags: [],
    })
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'test2@acme.com',
          full_name: 'Test Two',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: true,
        },
        ttxItems: [planner('ttx-1', 'org-1', 'planner'), planner('ttx-3', 'org-3', 'player')],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Abc',
            is_program_manager: false,
            is_planner: true,
          },
          {
            organization_id: 'org-2',
            organization_name: 'Globex',
            is_program_manager: false,
            is_planner: true,
          },
          {
            organization_id: 'org-3',
            organization_name: 'Players Inc',
            is_program_manager: false,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    const select = await screen.findByLabelText('Select organization')
    await waitFor(() => expect(select).toHaveValue('org-1'))
    fireEvent.change(select, { target: { value: 'org-2' } })

    // Planner there too, with no exercise yet: the organization overview.
    expect(await screen.findByText('Exercises in the organization')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/creator/exercises')
    expect(screen.getByLabelText('Select organization')).toHaveValue('org-2')

    // No Planner role in org-3: its first role (Player) instead.
    fireEvent.change(screen.getByLabelText('Select organization'), {
      target: { value: 'org-3' },
    })
    await waitFor(() => expect(window.location.pathname).toMatch(/^\/playground\/ttx-3/))
    expect(screen.getByLabelText('Select organization')).toHaveValue('org-3')
  })

  it('shows Program Manager in the Role segment and hides the TTX segment on Admin', async () => {
    window.history.pushState({}, '', '/admin')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'admin@acme.com',
          full_name: 'Admin',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: true,
          is_planner: false,
        },
        ttxItems: [],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Acme',
            is_program_manager: true,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    const roleLabel = await screen.findByText('Program Manager')
    expect(roleLabel).toBeInTheDocument()
    expect(roleLabel.parentElement?.querySelector('svg')).toBeInTheDocument()
    expect(screen.queryByLabelText('Select exercise')).not.toBeInTheDocument()
    expect(screen.queryByText('No exercises available')).not.toBeInTheDocument()
  })

  it('lets a Program Manager who is also Planner switch roles, with no View switch as Program Manager', async () => {
    window.history.pushState({}, '', '/admin/organization')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u2',
          email: 'test2@acme.com',
          full_name: 'Test Two',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: true,
          is_planner: true,
        },
        ttxItems: [],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Abc',
            is_program_manager: true,
            is_planner: true,
          },
        ],
      }),
    )

    render(<App />)

    const roleSelect = (await screen.findByLabelText('Select role')) as HTMLSelectElement
    expect(roleSelect.value).toBe('program_manager')
    expect(Array.from(roleSelect.options).map((o) => o.text)).toEqual([
      'Program Manager',
      'Planner',
    ])
    expect(screen.queryByLabelText('Select view')).not.toBeInTheDocument()

    fireEvent.change(roleSelect, { target: { value: 'planner' } })

    await waitFor(() => expect(window.location.pathname).toBe('/creator/exercises'))
    expect(((await screen.findByLabelText('Select role')) as HTMLSelectElement).value).toBe(
      'planner',
    )
  })

  it('shows the acting role for Execution derived from the active TTX', async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        },
        ttxItems: [
          {
            id: 'ttx-1',
            name: 'Drill',
            description: null,
            organization_id: 'org-1',
            created_by_id: 'u2',
            created_at: '2026-01-01T00:00:00Z',
            role: 'player',
            tags: [],
          },
        ],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Org One',
            is_program_manager: false,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    expect(await screen.findByText('Player')).toBeInTheDocument()
  })

  it("shows the active TTX's image as a badge inside the chip when set", async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        },
        ttxItems: [
          {
            id: 'ttx-1',
            name: 'Drill',
            description: null,
            organization_id: 'org-1',
            created_by_id: 'u2',
            created_at: '2026-01-01T00:00:00Z',
            role: 'player',
            tags: [],
            image_url: '/media/ttx-images/ttx-1.jpg',
          },
        ],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Org One',
            is_program_manager: false,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    const ttxLabel = await screen.findByText('Drill')
    expect(
      ttxLabel.parentElement?.querySelector('img[src="/media/ttx-images/ttx-1.jpg"]'),
    ).toBeInTheDocument()
  })

  it('renders no image inside the TTX chip when unset', async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        },
        ttxItems: [
          {
            id: 'ttx-1',
            name: 'Drill',
            description: null,
            organization_id: 'org-1',
            created_by_id: 'u2',
            created_at: '2026-01-01T00:00:00Z',
            role: 'player',
            tags: [],
            image_url: null,
          },
        ],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Org One',
            is_program_manager: false,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    const ttxLabel = await screen.findByText('Drill')
    expect(ttxLabel.parentElement?.querySelector('img')).not.toBeInTheDocument()
  })

  it("follows the URL's exercise into its organization, even when another one is active", async () => {
    // org-1 comes first (the default); the linked exercise is in org-2.
    window.history.pushState({}, '', '/creator/ttx-9/library')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'e@acme.com',
          full_name: 'Eval',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: true,
        },
        ttxItems: [
          {
            id: 'ttx-9',
            name: 'Deep Link Drill',
            description: null,
            organization_id: 'org-2',
            created_by_id: 'u1',
            created_at: '2026-01-01T00:00:00Z',
            role: 'planner',
            plans: true,
            controls: true,
            tags: [],
          },
        ],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Org One',
            is_program_manager: false,
            is_planner: true,
          },
          {
            organization_id: 'org-2',
            organization_name: 'Org Two',
            is_program_manager: false,
            is_planner: true,
          },
        ],
      }),
    )

    render(<App />)

    const context = await screen.findByRole('navigation', { name: 'Context' })
    await waitFor(() =>
      expect(within(context).getByLabelText('Select organization')).toHaveValue('org-2'),
    )
    expect(within(context).getByText('Deep Link Drill')).toBeInTheDocument()
    expect(within(context).queryByText(/Create exercise/)).not.toBeInTheDocument()
    expect(window.location.pathname).toBe('/creator/ttx-9/library')
  })

  it('navigates and preserves the current section when switching TTX on a ttx-scoped route', async () => {
    window.history.pushState({}, '', '/creator/ttx-1/library')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'e@acme.com',
          full_name: 'Eval',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: true,
        },
        ttxItems: [
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
          {
            id: 'ttx-2',
            name: 'Insider Threat',
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
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Acme',
            is_program_manager: false,
            is_planner: true,
          },
        ],
      }),
    )

    render(<App />)

    const select = await screen.findByLabelText('Select exercise')
    fireEvent.change(select, { target: { value: 'ttx-2' } })

    expect(window.location.pathname).toBe('/creator/ttx-2/library')
  })

  it('offers Planner and Controller as roles, each with its own workspace, and no view switch', async () => {
    // Start on the settled URL: a bare /control/ttx-1 redirects to its
    // first section in an effect, and a change landing before that
    // redirect gets overwritten by it (flaky under CI load).
    window.history.pushState({}, '', '/control/ttx-1/dashboard')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'e@acme.com',
          full_name: 'Eval',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        },
        ttxItems: [
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
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Acme',
            is_program_manager: false,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    const roleSelect = await screen.findByRole('combobox', { name: 'Select role' })
    expect(roleSelect).toHaveValue('controller')
    expect(
      within(roleSelect)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Planner', 'Controller'])
    expect(screen.queryByRole('group', { name: 'Select view' })).not.toBeInTheDocument()

    // One trail in dependency order: Organization › Role / Exercise.
    const trail = within(screen.getByRole('navigation', { name: 'Context' }))
    const org = trail.getByText('Acme')
    const exercise = trail.getByText('Ransomware Drill')
    expect(org.compareDocumentPosition(roleSelect)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(roleSelect.compareDocumentPosition(exercise)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)

    fireEvent.change(roleSelect, { target: { value: 'planner' } })

    await waitFor(() => expect(window.location.pathname).toBe('/creator/ttx-1/exercise'))
    expect(await screen.findByText('No other planners yet')).toBeInTheDocument()
  })

  it('lets a Facilitator who also evaluates the exercise switch to Evaluator on it', async () => {
    window.history.pushState({}, '', '/playground/ttx-1/dashboard')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'c@acme.com',
          full_name: 'Cole',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        },
        ttxItems: [
          {
            id: 'ttx-1',
            name: 'Ransomware Drill',
            description: null,
            organization_id: 'org-1',
            created_by_id: 'u2',
            created_at: '2026-01-01T00:00:00Z',
            role: 'planner',
            plans: false,
            controls: true,
            facilitates: true,
            evaluates: true,
            observes: false,
            tags: [],
          },
        ],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Acme',
            is_program_manager: false,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    const roleSelect = await screen.findByRole('combobox', { name: 'Select role' })
    expect(roleSelect).toHaveValue('facilitator')
    expect(
      within(roleSelect)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Controller', 'Facilitator', 'Evaluator'])

    fireEvent.change(roleSelect, { target: { value: 'evaluator' } })

    // Same exercise, now acting as its Evaluator.
    await waitFor(() => expect(roleSelect).toHaveValue('evaluator'))
    expect(window.location.pathname.startsWith('/playground/ttx-1')).toBe(true)
  })

  it('never shows a view switch to a single-role user', async () => {
    window.history.pushState({}, '', '/playground/ttx-1')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Part',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        },
        ttxItems: [
          {
            id: 'ttx-1',
            name: 'Drill',
            description: null,
            organization_id: 'org-1',
            created_by_id: 'u2',
            created_at: '2026-01-01T00:00:00Z',
            role: 'player',
            tags: [],
          },
        ],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Org One',
            is_program_manager: false,
            is_planner: false,
          },
        ],
      }),
    )

    render(<App />)

    await screen.findByText('Drill')
    expect(screen.queryByLabelText('Select view')).not.toBeInTheDocument()
    expect(screen.queryByText('View')).not.toBeInTheDocument()
  })

  it('updates context without navigating away when switching TTX on an org-scoped route', async () => {
    window.history.pushState({}, '', '/creator/players')
    const fetchMock = dynamicFetchMock({
      me: {
        id: 'u1',
        email: 'e@acme.com',
        full_name: 'Eval',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: false,
        is_planner: true,
      },
      ttxItems: [
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
        {
          id: 'ttx-2',
          name: 'Insider Threat',
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
      organizations: [
        {
          organization_id: 'org-1',
          organization_name: 'Acme',
          is_program_manager: false,
          is_planner: true,
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    const select = await screen.findByLabelText('Select exercise')
    fireEvent.change(select, { target: { value: 'ttx-2' } })

    expect(window.location.pathname).toBe('/creator/players')
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/ttx/ttx-2/players'),
        expect.anything(),
      )
    })
  })

  it('reads as a caption-free breadcrumb, and offers to create the first exercise', async () => {
    window.history.pushState({}, '', '/creator/players')
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u3',
          email: 'new-manager@acme.com',
          full_name: 'New Manager',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: true,
        },
        ttxItems: [],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Acme',
            is_program_manager: false,
            is_planner: true,
          },
        ],
      }),
    )

    render(<App />)

    const bar = await screen.findByRole('navigation', { name: 'Context' })
    // Captions are screen-reader-only now, never visible text.
    for (const caption of ['Organization:', 'Role:']) {
      expect(within(bar).getByText(caption)).toHaveClass('sr-only')
    }
    expect(within(bar).queryByText('No exercises available')).not.toBeInTheDocument()
    const create = within(bar).getByRole('link', { name: 'Create exercise' })
    expect(create).toHaveAttribute('href', '/creator/exercises/new')

    fireEvent.click(create)
    await waitFor(() => expect(window.location.pathname).toBe('/creator/exercises/new'))
    // Already on the New exercise page, which has its own create button.
    await waitFor(() =>
      expect(within(bar).queryByRole('link', { name: 'Create exercise' })).not.toBeInTheDocument(),
    )
  })

  it('shows a new exercise while it is being created, then switches the whole context to it', async () => {
    window.history.pushState({}, '', '/creator/exercises/new')
    const drill = {
      id: 'ttx-1',
      name: 'jjjjj',
      description: null,
      organization_id: 'org-1',
      created_by_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      role: 'planner',
      plans: true,
      controls: true,
      tags: [],
    }
    const created = { ...drill, id: 'ttx-2', name: 'Ransomware 2027' }
    let ttxItems = [drill]
    const base = dynamicFetchMock({
      me: {
        id: 'u1',
        email: 'p@acme.com',
        full_name: 'Plan',
        totp_enabled: true,
        legal_acceptance_pending: [],
        is_program_manager: false,
        is_planner: true,
      },
      ttxItems,
      organizations: [
        {
          organization_id: 'org-1',
          organization_name: 'Acme',
          is_program_manager: false,
          is_planner: true,
        },
      ],
    })
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (init?.method === 'POST' && url.endsWith('/api/v1/ttx')) {
          ttxItems = [drill, created]
          return { ok: true, status: 201, json: async () => created } as Response
        }
        if (/\/api\/v1\/ttx(\?|$)/.test(url)) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: ttxItems, total: ttxItems.length, limit: 50, offset: 0 }),
          } as Response
        }
        return base(input)
      }),
    )

    render(<App />)

    const bar = await screen.findByRole('navigation', { name: 'Context' })
    // Not the exercise you came from: the one being created.
    expect(await within(bar).findByText('New exercise (creating…)')).toBeInTheDocument()
    expect(within(bar).queryByText('jjjjj')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Ransomware 2027' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create exercise' }))

    await waitFor(() => expect(window.location.pathname).toBe('/creator/ttx-2/needs'))
    expect(await within(bar).findByRole('combobox', { name: 'Select exercise' })).toHaveValue(
      'ttx-2',
    )
  })

  it('returns from Preferences to the page being worked on, not the default workspace', async () => {
    sessionStorage.setItem(
      'ttx_last_workspace',
      JSON.stringify({ userId: 'u1', path: '/creator/ttx-2/exercise' }),
    )
    // The settled URL: bare /account/settings redirects in an effect,
    // which could land after the click and overwrite it.
    window.history.pushState({}, '', '/account/settings/general')
    const exercise = (id: string, name: string) => ({
      id,
      name,
      description: null,
      organization_id: 'org-1',
      created_by_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
      role: 'planner',
      plans: true,
      controls: true,
      tags: [],
    })
    vi.stubGlobal(
      'fetch',
      dynamicFetchMock({
        me: {
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Plan',
          totp_enabled: true,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: true,
          default_organization_id: 'org-1',
          default_role: 'planner',
          default_ttx_id: 'ttx-1',
        },
        ttxItems: [exercise('ttx-1', 'Default drill'), exercise('ttx-2', 'DEMO')],
        organizations: [
          {
            organization_id: 'org-1',
            organization_name: 'Acme',
            is_program_manager: false,
            is_planner: true,
          },
        ],
      }),
    )

    render(<App />)

    const [logo] = await screen.findAllByRole('link', { name: /TTX-Zone/ })
    fireEvent.click(logo)

    await waitFor(() => expect(window.location.pathname).toBe('/creator/ttx-2/exercise'))
    sessionStorage.clear()
  })
})
