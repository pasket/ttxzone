import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreatorExerciseCreateSection } from '../src/components/creator/CreatorExerciseCreateSection'
import { CreatorExerciseSection } from '../src/components/creator/CreatorExerciseSection'
import { render } from './testUtils'

let mockTtxList: Record<string, unknown>[] = []
const refresh = vi.fn(async () => {})
const setActiveTtxId = vi.fn()
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    ttxList: mockTtxList,
    activeOrganizationId: 'org-1',
    refresh,
    setActiveTtxId,
  }),
}))

const tag = { id: 'tag-1', name: 'Q3', color: 'blue', custom_hex: null }
const drill = {
  id: 'ttx-1',
  code: 'TTX-2026-01',
  name: 'Ransomware Drill',
  needs_form_status: 'draft',
  tlp: 'amber',
  organization_id: 'org-1',
  role: 'planner',
  plans: true,
  controls: true,
  description: 'Tabletop for the board',
  content_language: 'es',
  created_by_id: 'me',
  created_at: '2026-09-01T00:00:00+00:00',
  image_url: null,
  tags: [tag],
  lead_planner: { user_id: 'me', full_name: 'Cara Creator' },
}

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

/** Routes fetch by method + path; each route can list several responses. */
function stubApi(routes: Record<string, Response[]>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '').split('?')[0]}`
    const queue = routes[key]
    if (!queue?.length) throw new Error(`Unexpected request: ${key}`)
    return queue.length > 1 ? queue.shift()! : queue[0]
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function weeks(counts: number[] = Array(12).fill(0)) {
  return counts.map((count, i) => ({
    week_start: `2026-07-${String(6 + i).padStart(2, '0')}`,
    count,
  }))
}

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    ttx_id: 'ttx-1',
    ttx_name: 'Ransomware Drill',
    generated_at: '2026-09-25T12:00:00+00:00',
    kpis: {
      players: 4,
      planners: 2,
      injects: 0,
      pending_requests: 1,
      oldest_pending_request_at: '2026-09-22T12:00:00+00:00',
    },
    invitation_breakdown: [
      {
        token_id: 'tok-1',
        description: 'Board members',
        role: 'player',
        status: 'active',
        created_at: '2026-09-10T00:00:00+00:00',
        redemptions: 5,
        approved: 3,
        pending: 1,
        rejected: 1,
      },
      {
        token_id: 'tok-2',
        description: null,
        role: 'player',
        status: 'revoked',
        created_at: '2026-09-02T00:00:00+00:00',
        redemptions: 1,
        approved: 1,
        pending: 0,
        rejected: 0,
      },
    ],
    access_requests: { approved: 4, pending: 1, rejected: 1 },
    invitations: { active: 1, revoked: 1, expired: 0, redemptions: 6 },
    weekly_joins: weeks([0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3]),
    ...overrides,
  }
}

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>
}

function renderExercisePage(path = '/creator/ttx-1/exercise') {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/creator/:ttxId/exercise" element={<CreatorExerciseSection />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreatorExerciseSection', () => {
  beforeEach(() => {
    mockTtxList = [drill]
    refresh.mockClear()
    setActiveTtxId.mockClear()
  })

  it('shows the active exercise identity above its dashboard', async () => {
    const fetchMock = stubApi({ 'GET /ttx/ttx-1/dashboard': [json(200, dashboard())] })

    renderExercisePage()

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Exercise profile' }),
    ).toBeInTheDocument()
    const band = screen.getByRole('region', { name: 'Ransomware Drill' })
    expect(within(band).getByText('Tabletop for the board')).toBeInTheDocument()
    expect(within(band).getByText('Q3')).toBeInTheDocument()
    // The Lead Planner, with the flag badge and what the role is for.
    const lead = within(band).getByText('Cara Creator')
    expect(lead.closest('div')).toHaveTextContent('Lead Planner')
    expect(lead).toHaveAttribute(
      'title',
      'The Lead Planner coordinates the team and owns the calendar and the deliverables.',
    )
    // Creating an exercise isn't done from inside one (Creator -> Exercises).
    expect(screen.queryByRole('link', { name: /New exercise/ })).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/ttx/ttx-1/dashboard', expect.anything())

    // KPI strip.
    expect(await screen.findByText('Including 1 other planner')).toBeInTheDocument()
    expect(screen.getByText('1 active invitation')).toBeInTheDocument()
    expect(screen.getByText('No injects in the timeline yet')).toBeInTheDocument()
    expect(screen.getByText('Oldest has waited 3 days')).toBeInTheDocument()
    // Requests per invitation: a described token by name, an undescribed
    // one by role and date.
    expect(screen.getByText('Board members')).toBeInTheDocument()
    expect(screen.getByText(/^Player invitation, /)).toBeInTheDocument()
  })

  it('shows the invitations breakdown as a table too', async () => {
    stubApi({ 'GET /ttx/ttx-1/dashboard': [json(200, dashboard())] })

    renderExercisePage()

    fireEvent.click(await screen.findByRole('button', { name: 'Table' }))
    const table = screen.getByRole('table', {
      name: 'Redemptions and request outcomes per invitation',
    })
    const rows = within(table).getAllByRole('row')
    expect(within(rows[1]).getByText('Board members')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Active')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Revoked')).toBeInTheDocument()
  })

  it('shows an empty state when the exercise has no invitations', async () => {
    stubApi({
      'GET /ttx/ttx-1/dashboard': [
        json(
          200,
          dashboard({
            invitation_breakdown: [],
            access_requests: { approved: 0, pending: 0, rejected: 0 },
            invitations: { active: 0, revoked: 0, expired: 0, redemptions: 0 },
            weekly_joins: weeks(),
          }),
        ),
      ],
    })

    renderExercisePage()

    expect(
      await screen.findByText('No invitations yet. Create one in Players → Invitations.'),
    ).toBeInTheDocument()
  })

  it('edits the exercise with one save and returns to the dashboard', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/dashboard': [json(200, dashboard())],
      'GET /ttx/ttx-1/tags': [json(200, { items: [tag], total: 1, limit: 200, offset: 0 })],
      'PATCH /ttx/ttx-1': [json(200, { ...drill, name: 'Board Drill' })],
      'GET /ttx/ttx-1/people': [json(200, { items: [] })],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
      'GET /ttx/ttx-1/rooms': [
        json(200, { uses_rooms: false, structure_locked: false, rooms: [], players: [] }),
      ],
    })

    renderExercisePage()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit exercise' }))
    // The form's tag picker is fed by the page (shared with the panels).
    expect(await screen.findByRole('checkbox', { name: /Q3/ })).toBeChecked()
    // Planning team sit below the form, as their own immediate-apply panel.
    expect(screen.getByRole('region', { name: 'Exercise team' })).toBeInTheDocument()
    const name = screen.getByLabelText('Name')
    expect(name).toHaveValue('Ransomware Drill')
    fireEvent.change(name, { target: { value: 'Board Drill' } })
    expect(screen.getByLabelText('Content language')).toHaveValue('es')
    fireEvent.change(screen.getByLabelText('Content language'), { target: { value: 'en' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update exercise' }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')
    expect(JSON.parse(patch![1]!.body as string)).toEqual({
      name: 'Board Drill',
      description: 'Tabletop for the board',
      content_language: 'en',
    })
    // Tags unchanged: no tags PUT.
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
    // Await both: React Router drops ?edit=1 in a transition, so the urgent
    // toast update can paint before the page is back in view mode.
    expect(await screen.findByText('Changes saved successfully')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Edit exercise' })).toBeInTheDocument()
  })

  it('opens straight into edit mode from a ?edit=1 link', async () => {
    stubApi({
      'GET /ttx/ttx-1/tags': [json(200, { items: [tag], total: 1, limit: 200, offset: 0 })],
      'GET /ttx/ttx-1/people': [json(200, { items: [] })],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
      'GET /ttx/ttx-1/rooms': [
        json(200, { uses_rooms: false, structure_locked: false, rooms: [], players: [] }),
      ],
    })

    renderExercisePage('/creator/ttx-1/exercise?edit=1')

    expect(screen.getByRole('heading', { name: 'Update exercise' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit exercise' })).not.toBeInTheDocument()
  })

  it('redirects away from an exercise the user does not manage', () => {
    mockTtxList = [{ ...drill, role: 'player' }]
    vi.stubGlobal('fetch', vi.fn())

    renderExercisePage()

    expect(screen.getByTestId('location')).toHaveTextContent('/creator')
  })
})

describe('CreatorExerciseCreateSection', () => {
  beforeEach(() => {
    refresh.mockClear()
    setActiveTtxId.mockClear()
  })

  function renderCreatePage() {
    render(
      <MemoryRouter initialEntries={['/creator/exercises/new']}>
        <Routes>
          <Route path="/creator/exercises/new" element={<CreatorExerciseCreateSection />} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('creates the exercise in the active organization and opens its needs form', async () => {
    mockTtxList = [drill]
    const created = { ...drill, id: 'ttx-2', name: 'Insider Threat', tags: [] }
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/tags': [json(200, { items: [], total: 0, limit: 200, offset: 0 })],
      'POST /ttx': [json(201, created)],
    })

    renderCreatePage()

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Insider Threat' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create exercise' }))

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/creator/ttx-2/needs'),
    )
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(post![1]!.body as string)).toEqual({
      name: 'Insider Threat',
      description: null,
      // Its content starts in the creator's language.
      content_language: 'en',
      organization_id: 'org-1',
    })
    expect(refresh).toHaveBeenCalled()
    expect(setActiveTtxId).toHaveBeenCalledWith('ttx-2')
  })

  it('has no Cancel for a first exercise', () => {
    mockTtxList = []
    stubApi({
      'GET /ttx/ttx-1/tags': [json(200, { items: [], total: 0, limit: 200, offset: 0 })],
    })

    renderCreatePage()

    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })
})
