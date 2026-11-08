import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ExerciseTeamPanel } from '../src/components/creator/ExerciseTeamPanel'
import type { ExercisePersonRead, TTXRead } from '../src/lib/types'
import { render } from './testUtils'

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'me' }, refresh: vi.fn(async () => {}) }),
}))

const drill = { id: 'ttx-1', name: 'Ransomware drill' } as TTXRead

function tag(id: string, name: string) {
  return { id, name, color: 'violet', custom_hex: null, created_at: '', applied: true }
}

function person(
  id: string,
  name: string,
  fields: Partial<ExercisePersonRead> = {},
): ExercisePersonRead {
  return {
    user_id: id,
    email: `${id}@acme.com`,
    full_name: name,
    added_at: '2026-09-01T00:00:00+00:00',
    last_login_at: null,
    role: 'planner',
    plans: true,
    controls: false,
    facilitates: false,
    evaluates: false,
    observes: false,
    is_lead: false,
    leads: false,
    grants: ['planner'],
    org_tags: [],
    tags: [],
    ...fields,
  } as ExercisePersonRead
}

const me = person('me', 'Cara Creator', { controls: true, is_lead: true })
const max = person('max', 'Max Manager', { grants: ['planner', 'observer'] })
const wanda = person('wanda', 'Wanda Watcher', {
  role: 'observer',
  plans: false,
  grants: ['observer'],
  org_tags: [tag('o1', 'Auditor')] as ExercisePersonRead['org_tags'],
  tags: [tag('t1', 'Day 1')] as ExercisePersonRead['tags'],
})

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

function renderPanel() {
  render(
    <MemoryRouter>
      <ExerciseTeamPanel ttx={drill} availableTags={[]} />
    </MemoryRouter>,
  )
}

const mark = (role: string, name: string) => screen.queryByRole('img', { name: `${role}: ${name}` })

describe('ExerciseTeamPanel', () => {
  it('shows everyone but the Players as a read-only matrix, org tags first', async () => {
    stubApi({
      'GET /ttx/ttx-1/people': [json(200, { items: [me, max, wanda] })],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
    })

    renderPanel()

    expect(await screen.findByText('3 people on Ransomware drill')).toBeInTheDocument()
    expect(mark('Planner', 'Cara Creator')).toBeInTheDocument()
    expect(mark('Controller', 'Cara Creator')).toBeInTheDocument()
    expect(mark('Controller', 'Max Manager')).not.toBeInTheDocument()
    expect(mark('Observer', 'Wanda Watcher')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    const row = screen.getByRole('row', { name: /Wanda Watcher/ })
    expect(
      within(row)
        .getAllByText(/Auditor|Day 1/)
        .map((el) => el.textContent),
    ).toEqual(['Auditor', 'Day 1'])
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent)
    expect(headers.slice(-3)).toEqual(['Last login', 'Tags', 'Actions'])
  })

  it("edits someone's role within what the organization granted them", async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/people': [json(200, { items: [me, max] })],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
      'PUT /ttx/ttx-1/people/max/role': [json(204, null)],
    })
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Max Manager' }))
    const dialog = within(screen.getByRole('dialog'))
    // One checkbox per matrix column; no Evaluator grant: locked, and said once.
    expect(dialog.getByRole('checkbox', { name: /^Evaluator/ })).toBeDisabled()
    expect(dialog.getByText(/No grant in the organization for: Evaluator\./)).toBeInTheDocument()
    // A Facilitator is a Controller.
    expect(dialog.getByRole('checkbox', { name: /^Facilitator/ })).toBeDisabled()
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Controller/ }))
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Facilitator/ }))
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/people/max/role',
        expect.objectContaining({ method: 'PUT' }),
      ),
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string)).toEqual({
      role: 'planner',
      plans: true,
      controls: true,
      facilitates: true,
      evaluates: false,
      observes: false,
    })
  })

  it('makes a team member also the Evaluator, from their org grant', async () => {
    const cole = person('cole', 'Cole Controller', {
      plans: false,
      controls: true,
      grants: ['planner', 'evaluator'],
    })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/people': [
        json(200, { items: [me, cole] }),
        json(200, { items: [me, { ...cole, evaluates: true }] }),
      ],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
      'PUT /ttx/ttx-1/people/cole/role': [json(204, null)],
    })
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Cole Controller' }))
    const dialog = within(screen.getByRole('dialog'))
    // No Observer grant: locked.
    expect(dialog.getByRole('checkbox', { name: /^Observer/ })).toBeDisabled()
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Evaluator/ }))
    // Observer and Evaluator are distinct: one or the other.
    expect(dialog.getByRole('checkbox', { name: /^Observer/ })).not.toBeChecked()
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/people/cole/role',
        expect.objectContaining({ method: 'PUT' }),
      ),
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string)).toMatchObject({
      role: 'planner',
      controls: true,
      evaluates: true,
      observes: false,
    })
    // On the matrix: Controller and Evaluator, and can lead the evaluation.
    expect(
      await screen.findByRole('img', { name: 'Evaluator: Cole Controller' }),
    ).toBeInTheDocument()
    expect(mark('Controller', 'Cole Controller')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Make Cole Controller the Lead Evaluator' }),
    ).toBeInTheDocument()
  })

  it('makes an Evaluator the Lead Evaluator', async () => {
    const eve = person('eve', 'Eve Evaluator', {
      role: 'evaluator',
      plans: false,
      grants: ['evaluator'],
    })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/people': [
        json(200, { items: [me, eve] }),
        json(200, { items: [me, { ...eve, leads: true }] }),
      ],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
      'PUT /ttx/ttx-1/evaluators/lead': [json(204, null)],
    })
    renderPanel()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Make Eve Evaluator the Lead Evaluator' }),
    )

    expect(await screen.findByText('Lead Evaluator')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string)).toEqual({ user_id: 'eve' })
    expect(
      screen.queryByRole('button', { name: 'Make Eve Evaluator the Lead Evaluator' }),
    ).not.toBeInTheDocument()
  })

  it('saves an Evaluator-only person as an Evaluator, and needs at least one role', async () => {
    const eve = person('eve', 'Eve Evaluator', {
      role: 'evaluator',
      plans: false,
      grants: ['evaluator', 'observer'],
    })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/people': [json(200, { items: [me, eve] })],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
      'PUT /ttx/ttx-1/people/eve/role': [json(204, null)],
    })
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Edit Eve Evaluator' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('checkbox', { name: /^Evaluator/ })).toBeChecked()
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Evaluator/ }))
    expect(dialog.getByText('Pick at least one role.')).toBeInTheDocument()
    expect(dialog.getByRole('button', { name: 'Save' })).toBeDisabled()

    // Ticking one of Observer / Evaluator unticks the other.
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Evaluator/ }))
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Observer/ }))
    expect(dialog.getByRole('checkbox', { name: /^Evaluator/ })).not.toBeChecked()
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/people/eve/role',
        expect.objectContaining({ method: 'PUT' }),
      ),
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string)).toMatchObject({ role: 'observer', plans: false })
  })

  it('names the Lead Planner and the Lead Evaluator from the editor', async () => {
    const eve = person('eve', 'Eve Evaluator', {
      plans: true,
      evaluates: true,
      grants: ['planner', 'evaluator'],
    })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/people': [json(200, { items: [me, eve] })],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
      'PUT /ttx/ttx-1/planning-team/lead': [json(204, null)],
      'PUT /ttx/ttx-1/evaluators/lead': [json(204, null)],
    })
    renderPanel()

    // The current Lead Planner can't untick it: someone else is made lead.
    fireEvent.click(await screen.findByRole('button', { name: 'Edit Cara Creator' }))
    let dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByRole('checkbox', { name: /^Lead Planner/ })).toBeChecked()
    expect(dialog.getByRole('checkbox', { name: /^Lead Planner/ })).toBeDisabled()
    fireEvent.click(dialog.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit Eve Evaluator' }))
    dialog = within(screen.getByRole('dialog'))
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Lead Planner/ }))
    fireEvent.click(dialog.getByRole('checkbox', { name: /^Lead Evaluator/ }))
    fireEvent.click(dialog.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/evaluators/lead',
        expect.objectContaining({ method: 'PUT' }),
      ),
    )
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/ttx-1/planning-team/lead',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ user_id: 'eve' }) }),
    )
    // Only the lead changed: the role itself isn't re-saved.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/people/eve/role'))).toBe(
      false,
    )
  })

  it("won't take the only Controller off the team", async () => {
    stubApi({
      'GET /ttx/ttx-1/people': [json(200, { items: [me, max] })],
      'GET /ttx/ttx-1/people/candidates': [json(200, { items: [] })],
    })
    renderPanel()

    fireEvent.click(
      await screen.findByRole('button', { name: 'Remove Cara Creator from this exercise' }),
    )

    expect(
      within(screen.getByRole('dialog')).getByText(
        'The only Controller of this exercise. Make someone else a Controller first.',
      ),
    ).toBeInTheDocument()
  })

  it('adds someone the organization authorized, as what they may be', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/people': [json(200, { items: [me] })],
      'GET /ttx/ttx-1/people/candidates': [
        json(200, {
          items: [
            { user_id: 'wanda', email: 'wanda@acme.com', full_name: 'Wanda', grants: ['observer'] },
          ],
        }),
      ],
      'POST /ttx/ttx-1/people': [json(201, { user_id: 'wanda' })],
    })
    renderPanel()

    fireEvent.click(await screen.findByRole('button', { name: 'Add person' }))
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'wanda' } })
    expect(screen.getByRole('checkbox', { name: /^Observer/ })).toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/people',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({
      email: 'wanda@acme.com',
      role: 'observer',
      plans: false,
      controls: false,
      facilitates: false,
    })
  })
})
