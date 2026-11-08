import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AdminOrganizationDashboard } from '../src/components/admin/AdminOrganizationDashboard'

function weeks(counts: number[] = Array(12).fill(0)) {
  // Players / exercise team split of each week's count.
  return counts.map((count, i) => ({
    week_start: `2026-07-${String(6 + i).padStart(2, '0')}`,
    players: Math.ceil(count / 2),
    team: Math.floor(count / 2),
  }))
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: 'org-1',
    organization_name: 'Acme',
    generated_at: '2026-09-25T12:00:00+00:00',
    kpis: {
      planners: 3,
      exercise_only_planners: 1,
      exercises: 2,
      exercises_last_30_days: 1,
      unique_players: 5,
      pending_requests: 2,
      oldest_pending_request_at: '2026-09-21T12:00:00',
    },
    exercises: [
      {
        ttx_id: 't1',
        name: 'Ransomware drill',
        created_at: '2026-08-01T10:00:00',
        players: 4,
        planners: 1,
        injects: 6,
        pending_requests: 2,
      },
      {
        ttx_id: 't2',
        name: 'Insider threat',
        created_at: '2026-09-20T10:00:00',
        players: 2,
        planners: 1,
        injects: 0,
        pending_requests: 0,
      },
    ],
    access_requests: { approved: 6, pending: 2, rejected: 2 },
    invitations: { active: 2, revoked: 1, expired: 0, redemptions: 10 },
    weekly_joins: weeks([0, 0, 0, 0, 0, 0, 0, 0, 1, 3, 2, 4]),
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function renderDashboard() {
  render(
    <AdminOrganizationDashboard
      organizationId="org-1"
      title="Organization profile"
      summary={<p>Identity summary</p>}
    />,
  )
}

describe('AdminOrganizationDashboard', () => {
  it('fetches the org dashboard and renders KPIs and panels', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, dashboard()))
    vi.stubGlobal('fetch', fetchMock)

    renderDashboard()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Organization profile' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Identity summary')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/organizations/org-1/dashboard',
      expect.anything(),
    )
    expect(await screen.findByText('+1 planner on single exercises only')).toBeInTheDocument()
    expect(screen.getByText('1 created in the last 30 days')).toBeInTheDocument()
    expect(screen.getByText('3 per exercise on average')).toBeInTheDocument()
    expect(screen.getByText('Oldest has waited 4 days')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Ransomware drill, Players 4, Planners 1, Total 5'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '6 approved, 2 pending, 2 rejected' }),
    ).toBeInTheDocument()
    // New access per week: two series per week, both in each week's label.
    expect(
      screen.getAllByRole('listitem', { name: /^Week of .*Players .*Exercise team/ }),
    ).toHaveLength(12)
    expect(
      screen.getByRole('listitem', { name: /Players 2, Exercise team 2, Total 4$/ }),
    ).toBeInTheDocument()
  })

  it('switches the attendance panel to a table', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(200, dashboard())))

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Table' }))
    const table = screen.getByRole('table', {
      name: 'Attendees, injects and pending requests per exercise',
    })
    expect(table).toHaveTextContent('Ransomware drill')
    expect(table).toHaveTextContent('Injects')
  })

  it('shows actionable empty states for an organization with no activity', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          200,
          dashboard({
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
            weekly_joins: weeks(),
          }),
        ),
      ),
    )

    renderDashboard()

    expect(
      await screen.findByText('No exercises yet. An Exercise Planner creates them from Creator.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Nothing waiting for approval')).toBeInTheDocument()
    expect(
      screen.getByText('No one has been granted access in the last 12 weeks.'),
    ).toBeInTheDocument()
  })

  it('shows an error with a retry that refetches', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(500, { error: { code: 'INTERNAL', message: 'boom', ttx_id: null } }),
      )
      .mockResolvedValueOnce(jsonResponse(200, dashboard()))
    vi.stubGlobal('fetch', fetchMock)

    renderDashboard()

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Oldest has waited 4 days')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
