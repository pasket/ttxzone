import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AdminUsersAndRolesSection } from '../src/components/admin/AdminUsersAndRolesSection'
import type { OrgMemberRead, OrgRole } from '../src/lib/types'
import { render } from './testUtils'

const mockRefresh = vi.fn(async () => {})

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'me' },
    refresh: mockRefresh,
    activeOrganizationId: 'org-1',
    activeOrganization: {
      organization_id: 'org-1',
      organization_name: 'Acme',
      is_program_manager: true,
    },
  }),
}))

function person(id: string, name: string, roles: OrgRole[]): OrgMemberRead {
  return {
    user_id: id,
    full_name: name,
    email: `${id}@acme.com`,
    granted_at: '2026-09-01T00:00:00+00:00',
    last_login_at: null,
    roles,
    tags: [],
    disabled: false,
  }
}

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function list(items: OrgMemberRead[]) {
  const counts: Record<string, number> = {}
  for (const item of items) for (const role of item.roles) counts[role] = (counts[role] ?? 0) + 1
  return json(200, { items, total: items.length, limit: 20, offset: 0, role_counts: counts })
}

const me = person('me', 'Ada Lovelace', ['program_manager', 'planner'])
const bea = person('bea', 'Bea Watcher', ['observer'])

type Handler = () => Response
/** Routes fetch by "METHOD /path" (query ignored); arrays serve in turn,
 * repeating the last. */
function stubApi(routes: Record<string, Handler | Handler[]>) {
  const counters: Record<string, number> = {}
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '').split('?')[0]}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    const handlers = Array.isArray(route) ? route : [route]
    const index = Math.min(counters[key] ?? 0, handlers.length - 1)
    counters[key] = (counters[key] ?? 0) + 1
    return handlers[index]()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const noTags = () => json(200, { items: [], total: 0, limit: 200, offset: 0 })

function renderSection() {
  render(
    <MemoryRouter initialEntries={['/admin/users-and-roles']}>
      <Routes>
        <Route path="/admin/users-and-roles" element={<AdminUsersAndRolesSection />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const mark = (role: string, name: string) => screen.queryByRole('img', { name: `${role}: ${name}` })
const noExercises = () => json(200, { items: [] })

describe('AdminUsersAndRolesSection', () => {
  it('shows a read-only matrix: people as rows, roles as columns, with the counts', async () => {
    stubApi({
      'GET /organizations/org-1/members': () => list([me, bea]),
      'GET /organizations/org-1/tags': noTags,
    })

    renderSection()

    expect(await screen.findByRole('rowheader', { name: /Ada Lovelace/ })).toBeInTheDocument()
    expect(screen.getByText('2 people')).toBeInTheDocument()
    expect(mark('Program Manager', 'Ada Lovelace')).toBeInTheDocument()
    expect(mark('Exercise Planning Team', 'Ada Lovelace')).toBeInTheDocument()
    expect(mark('Observer', 'Ada Lovelace')).not.toBeInTheDocument()
    expect(mark('Observer', 'Bea Watcher')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers.slice(-3)).toEqual(['Last login', 'Tags', 'Actions'])
  })

  it('grants and revokes in the editor, warning about the exercises it reaches', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/members': () => list([me, bea]),
      'GET /organizations/org-1/tags': noTags,
      'GET /organizations/org-1/members/bea/exercises': () =>
        json(200, {
          items: [
            {
              ttx_id: 't1',
              code: 'TTX-2026-01',
              name: 'Drill',
              role: 'observer',
              plans: false,
              controls: false,
              facilitates: false,
              is_lead: false,
            },
          ],
        }),
      'POST /organizations/org-1/evaluators': () => json(201, { user_id: 'bea' }),
      'DELETE /organizations/org-1/observers/bea': () => json(204, null),
    })
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Bea Watcher' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Evaluator/ }))
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Observer/ }))
    expect(
      await dialog.findByText('Removing Observer also takes them off: TTX-2026-01 Drill.'),
    ).toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/organizations/org-1/observers/bea',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/organizations/org-1/evaluators',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('asks for the full name before taking Program Manager away, never from the last one', async () => {
    const grace = person('grace', 'Grace Hopper', ['program_manager'])
    stubApi({
      'GET /organizations/org-1/members': () => list([me, grace]),
      'GET /organizations/org-1/tags': noTags,
      'GET /organizations/org-1/members/grace/exercises': noExercises,
    })
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Grace Hopper' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Exercise Program Manager/ }))
    const save = dialog.getByRole('button', { name: 'Save' })
    expect(save).toBeDisabled()
    fireEvent.change(dialog.getByLabelText('Type Grace Hopper to confirm'), {
      target: { value: 'Grace Hopper' },
    })
    expect(save).toBeEnabled()
  })

  it('disables someone still on exercises instead of deleting them', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/members': [
        () => list([me, bea]),
        () => list([me, { ...bea, disabled: true }]),
      ],
      'GET /organizations/org-1/tags': noTags,
      'GET /organizations/org-1/members/bea/exercises': () =>
        json(200, {
          items: [
            {
              ttx_id: 't1',
              code: 'TTX-2026-01',
              name: 'Drill',
              role: 'observer',
              plans: false,
              controls: false,
              facilitates: false,
              is_lead: false,
            },
          ],
        }),
      'DELETE /organizations/org-1/members/bea': () =>
        json(200, { status: 'disabled', exercises: ['TTX-2026-01'] }),
    })
    renderSection()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove Bea Watcher from the organization' }),
    )
    const dialog = within(screen.getByRole('dialog'))
    expect(await dialog.findByText('TTX-2026-01 Drill')).toBeInTheDocument()
    fireEvent.change(dialog.getByLabelText('Type Bea Watcher to confirm'), {
      target: { value: 'Bea Watcher' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Disable access' }))

    expect(await screen.findByText("Bea Watcher's access disabled")).toBeInTheDocument()
    expect(await screen.findByText('Disabled')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/organizations/org-1/members/bea',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('says someone still on exercises is already disabled, with nothing to submit', async () => {
    stubApi({
      'GET /organizations/org-1/members': () => list([me, { ...bea, disabled: true }]),
      'GET /organizations/org-1/tags': noTags,
      'GET /organizations/org-1/members/bea/exercises': () =>
        json(200, {
          items: [
            {
              ttx_id: 't1',
              code: 'TTX-2026-01',
              name: 'Drill',
              role: 'observer',
              plans: false,
              controls: false,
              facilitates: false,
              is_lead: false,
            },
          ],
        }),
    })
    renderSection()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove Bea Watcher from the organization' }),
    )
    const dialog = within(screen.getByRole('dialog'))
    expect(await dialog.findByText(/access to Acme is already disabled/)).toBeInTheDocument()
    expect(dialog.queryByRole('button', { name: 'Disable access' })).not.toBeInTheDocument()
    expect(dialog.queryByLabelText('Type Bea Watcher to confirm')).not.toBeInTheDocument()
    fireEvent.click(dialog.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('filters by access status', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/members': () => list([me]),
      'GET /organizations/org-1/tags': noTags,
    })
    renderSection()

    fireEvent.change(await screen.findByLabelText('Access'), { target: { value: 'disabled' } })

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/members\?.*status=disabled/),
        expect.anything(),
      ),
    )
  })

  it('adds a person with several roles at once', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/members': () => list([me]),
      'GET /organizations/org-1/tags': noTags,
      'POST /organizations/org-1/planners': () => json(201, { user_id: 'new' }),
      'POST /organizations/org-1/observers': () => json(201, { user_id: 'new' }),
    })
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: 'Add person' }))
    fireEvent.change(screen.getByLabelText('Email of an existing account'), {
      target: { value: 'new@acme.com' },
    })
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Exercise Planning Team/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /^Observer/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByText('2 roles granted')).toBeInTheDocument()
    const posts = fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')
    expect(posts.map(([url]) => url)).toEqual([
      '/api/v1/organizations/org-1/planners',
      '/api/v1/organizations/org-1/observers',
    ])
  })

  it('reports the role that could not be granted', async () => {
    stubApi({
      'GET /organizations/org-1/members': () => list([me]),
      'GET /organizations/org-1/tags': noTags,
      'POST /organizations/org-1/program-managers': () =>
        json(403, {
          success: false,
          error: { code: 'DOMAIN_NOT_ALLOWED', message: "This user's email domain isn't allowed." },
        }),
    })
    renderSection()

    fireEvent.click(await screen.findByRole('button', { name: 'Add person' }))
    fireEvent.change(screen.getByLabelText('Email of an existing account'), {
      target: { value: 'out@else.com' },
    })
    fireEvent.click(screen.getByRole('checkbox', { name: /Program Manager/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(
      await screen.findByText("Program Manager: This user's email domain isn't allowed."),
    ).toBeInTheDocument()
  })
})
