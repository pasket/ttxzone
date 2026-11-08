import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AdminExercisesSection } from '../src/components/admin/AdminExercisesSection'
import { render } from './testUtils'

const setActiveTtxId = vi.fn()
const refresh = vi.fn(async () => {})
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    activeTtxId: null,
    setActiveTtxId,
    refresh,
    activeOrganization: {
      organization_id: 'org-1',
      organization_name: 'Acme',
      is_program_manager: true,
      is_planner: true,
      is_observer: false,
      is_evaluator: true,
    },
  }),
}))

const EXERCISES = [
  // On the team: planned by this Program Manager too.
  exercise('ttx-1', 'Ransomware drill', { role: 'planner', plans: true }),
  // Seen only through the Program Manager's oversight.
  exercise('ttx-2', 'Phishing drill', { role: 'program_manager', plans: false }),
]

/** The server's page of the portfolio for any GET /ttx, `{}` for a write. */
function serve(total = EXERCISES.length) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const listing = url.startsWith('/api/v1/ttx?') && init?.method === 'GET'
    return {
      ok: true,
      status: listing ? 200 : 201,
      json: async () => (listing ? { items: EXERCISES, total, limit: 20, offset: 0 } : {}),
    } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function exercise(id: string, name: string, access: { role: string; plans: boolean }) {
  return {
    id,
    code: `TTX-2026-0${id.slice(-1)}`,
    name,
    organization_id: 'org-1',
    created_at: '2026-10-01T10:00:00+00:00',
    ...access,
    controls: false,
    tags: [],
    needs_form_status: 'approved',
    msel_status: 'ready',
    lead_planner: { user_id: 'u1', full_name: 'Lea Lead' },
    can_delete: true,
  }
}

describe('AdminExercisesSection', () => {
  it('lists every exercise of the organization; opens only those the Program Manager plans', async () => {
    const fetchMock = serve()
    render(
      <MemoryRouter initialEntries={['/admin/exercises']}>
        <AdminExercisesSection />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { level: 1, name: 'Exercises' })).toBeInTheDocument()
    expect(screen.getByText(/Every exercise in Acme, whoever plans it/)).toBeInTheDocument()
    expect(await screen.findByText('Phishing drill')).toBeInTheDocument()
    // The organization's portfolio, one server page at a time.
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://x')
    expect(url.pathname).toBe('/api/v1/ttx')
    expect(url.searchParams.get('organization_id')).toBe('org-1')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument()
    expect(screen.getAllByText('Lea Lead')).toHaveLength(2)
    // Both can be deleted; only the one on their team opens in the Creator.
    expect(screen.getByLabelText('Delete Ransomware drill')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Phishing drill')).toBeInTheDocument()
    expect(screen.queryByLabelText('Open Phishing drill')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Open Ransomware drill'))
    expect(setActiveTtxId).toHaveBeenCalledWith('ttx-1')

    fireEvent.click(screen.getByLabelText('Delete Phishing drill'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('joins an exercise with no seat yet, as one of the roles the organization grants', async () => {
    const fetchMock = serve()
    render(
      <MemoryRouter initialEntries={['/admin/exercises']}>
        <AdminExercisesSection />
      </MemoryRouter>,
    )

    // Already on the team of the other one: nothing to join.
    fireEvent.click(await screen.findByLabelText('Join Phishing drill'))
    expect(screen.queryByLabelText('Join Ransomware drill')).not.toBeInTheDocument()
    const dialog = screen.getByRole('dialog')
    // Only the seats their grants allow; the rest are named.
    expect(within(dialog).getByRole('radio', { name: /Planner/ })).toBeChecked()
    expect(within(dialog).getByRole('radio', { name: /Evaluator/ })).toBeInTheDocument()
    expect(within(dialog).queryByRole('radio', { name: /Observer/ })).not.toBeInTheDocument()
    expect(within(dialog).getByText(/Not offered: Observer/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Controller/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Join' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-2/people/me',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ role: 'planner', controls: true }),
        }),
      ),
    )
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('pages past the first twenty exercises', async () => {
    const fetchMock = serve(45)
    render(
      <MemoryRouter initialEntries={['/admin/exercises?page=2&q=drill']}>
        <AdminExercisesSection />
      </MemoryRouter>,
    )

    expect(await screen.findByText('Page 2 of 3')).toBeInTheDocument()
    expect(screen.getByText('45 exercises')).toBeInTheDocument()
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'http://x')
    expect(url.searchParams.get('offset')).toBe('20')
    expect(url.searchParams.get('q')).toBe('drill')
  })
})
