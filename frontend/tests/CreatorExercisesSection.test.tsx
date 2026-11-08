import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreatorExercisesSection } from '../src/components/creator/CreatorExercisesSection'
import { render } from './testUtils'

const refresh = vi.fn(async () => {})
const setActiveTtxId = vi.fn()
let mockTtxList: Record<string, unknown>[] = []
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    ttxList: mockTtxList,
    activeTtxId: null,
    setActiveTtxId,
    refresh,
    activeOrganization: {
      organization_id: 'org-1',
      organization_name: 'Acme',
      is_program_manager: false,
      is_planner: true,
    },
  }),
}))

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const overview = {
  organization_id: 'org-1',
  organization_name: 'Acme',
  generated_at: '2026-09-25T12:00:00+00:00',
  exercises: 7,
  exercises_last_30_days: 2,
  owned_by_you: 1,
  co_planned_by_you: 1,
  planners: 3,
  unique_players: 12,
  my_exercises: [
    {
      ttx_id: 'ttx-1',
      name: 'Ransomware drill',
      created_at: '2026-10-01T10:00:00+00:00',
      players: 4,
      planners: 2,
      injects: 6,
      pending_requests: 1,
    },
  ],
  access_requests: { approved: 3, pending: 1, rejected: 0 },
  invitations: { active: 1, revoked: 0, expired: 0, redemptions: 4 },
  weekly_joins: Array.from({ length: 12 }, (_, i) => ({
    week_start: `2026-07-${String(6 + i).padStart(2, '0')}`,
    players: i === 11 ? 3 : 0,
    team: i === 11 ? 1 : 0,
  })),
}

function exercise(id: string, name: string, canDelete: boolean) {
  return {
    id,
    code: `TTX-2026-0${id.slice(-1)}`,
    name,
    organization_id: 'org-1',
    created_at: '2026-10-01T10:00:00+00:00',
    role: 'planner',
    plans: true,
    controls: true,
    tags: [],
    needs_form_status: 'draft',
    msel_status: null,
    lead_planner: { user_id: 'u1', full_name: 'Lea Lead' },
    can_delete: canDelete,
  }
}

function renderSection() {
  render(
    <MemoryRouter initialEntries={['/creator/exercises']}>
      <CreatorExercisesSection />
    </MemoryRouter>,
  )
}

describe('CreatorExercisesSection', () => {
  beforeEach(() => {
    mockTtxList = [
      exercise('ttx-1', 'Ransomware drill', true),
      exercise('ttx-2', 'Phishing drill', false),
    ]
  })

  it('lists the exercises over the organization overview, with New exercise', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(200, overview)),
    )
    renderSection()

    expect(await screen.findByRole('heading', { level: 1, name: 'Exercises' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'New exercise' })).toHaveAttribute(
      'href',
      '/creator/exercises/new',
    )
    // In the list (and in the breakdown chart below).
    expect(screen.getAllByText('Ransomware drill').length).toBeGreaterThanOrEqual(1)
    // An organization page says what it covers.
    expect(screen.getByText(/The exercises you work on in Acme: all of them/)).toBeInTheDocument()
    expect(screen.getByText('Phishing drill')).toBeInTheDocument()
    expect(await screen.findByText('7')).toBeInTheDocument()
    expect(screen.getByText('2 created in the last 30 days')).toBeInTheDocument()
    // Players and Exercise Planners are two figures, each in its own card.
    expect(
      screen.getByText("In the organization's exercises, each counted once"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("The organization's Exercise Planning Team, you included"),
    ).toBeInTheDocument()
    // The Program Manager's panels over the Planner's own exercises.
    expect(screen.getByText('Attendees in your exercises')).toBeInTheDocument()
    expect(
      screen.getByLabelText('Ransomware drill, Players 4, Planners 2, Total 6'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', { name: '3 approved, 1 pending, 0 rejected' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('listitem', { name: /Players 3, Exercise team 1, Total 4$/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Exercises created per week')).not.toBeInTheDocument()
    // Delete only where the user may (its Lead Planner, or a Program Manager).
    expect(screen.getByLabelText('Delete Ransomware drill')).toBeInTheDocument()
    expect(screen.queryByLabelText('Delete Phishing drill')).not.toBeInTheDocument()
  })

  it('deletes an exercise once its name is typed', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'DELETE' ? ({ ok: true, status: 204 } as Response) : json(200, overview),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderSection()

    fireEvent.click(await screen.findByLabelText('Delete Ransomware drill'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('Export it as a scenario first')).toBeInTheDocument()
    const confirm = within(dialog).getByRole('button', { name: 'Delete exercise' })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Type “Ransomware drill” to confirm'), {
      target: { value: 'Ransomware drill' },
    })
    fireEvent.click(confirm)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ confirmation: 'Ransomware drill' }),
        }),
      ),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('duplicates an exercise it plans under the name given, and opens the copy', async () => {
    mockTtxList = [
      exercise('ttx-1', 'Ransomware drill', true),
      { ...exercise('ttx-2', 'Phishing drill', false), plans: false },
    ]
    const copy = { ...exercise('ttx-3', 'Ransomware drill II', true) }
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json(201, { ttx: copy, skipped_members: ['Eve'] })
        : json(200, overview),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderSection()

    // Only an exercise the user plans offers it.
    expect(screen.queryByLabelText('Duplicate Phishing drill')).not.toBeInTheDocument()
    fireEvent.click(await screen.findByLabelText('Duplicate Ransomware drill'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Not copied: Players, invitations/)).toBeInTheDocument()
    const name = within(dialog).getByLabelText('Name of the copy')
    expect(name).toHaveValue('Ransomware drill (copy)')
    fireEvent.change(name, { target: { value: 'Ransomware drill II' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Duplicate exercise' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/duplicate',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Ransomware drill II', organization_id: 'org-1' }),
        }),
      ),
    )
    await waitFor(() => expect(setActiveTtxId).toHaveBeenCalledWith('ttx-3'))
    expect(refresh).toHaveBeenCalled()
    expect(
      await screen.findByText(/Ransomware drill II created\. Left off its team .*: Eve/),
    ).toBeInTheDocument()
  })

  it('shows active exercises by default, archived ones behind the filter, and archives', async () => {
    mockTtxList = [
      exercise('ttx-1', 'Ransomware drill', true),
      { ...exercise('ttx-2', 'Phishing drill', true), archived_at: '2026-10-20T10:00:00+00:00' },
    ]
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(200, mockTtxList[0]) : json(200, overview),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderSection()

    expect(await screen.findByLabelText('Archive Ransomware drill')).toBeInTheDocument()
    expect(screen.queryByLabelText('Unarchive Phishing drill')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'archived' } })
    expect(await screen.findByLabelText('Unarchive Phishing drill')).toBeInTheDocument()
    expect(screen.getByText('Archived')).toBeInTheDocument()
    expect(screen.queryByLabelText('Archive Ransomware drill')).not.toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Unarchive Phishing drill'))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Unarchive' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-2/unarchive',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })
})
