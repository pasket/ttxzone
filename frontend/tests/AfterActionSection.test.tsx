import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AfterActionSection } from '../src/components/aar/AfterActionSection'
import type { AarPreview, AarRead } from '../src/lib/types'
import { render } from './testUtils'

const report = (changes: Partial<AarRead> = {}): AarRead => ({
  id: 'r1',
  ttx_id: 'ttx-1',
  status: 'draft',
  version: 1,
  revision: 3,
  executive_summary: 'Ransomware drill',
  scenario_summary: '',
  conclusions: '',
  objectives: [
    {
      id: 'o1',
      objective_code: 'OBJ-01',
      title: 'Escalate in time',
      overall: 'M',
      strengths: '- Convened quickly',
      improvements: '- Nobody called the regulator — late (Eva)',
      analysis: '',
      session_ratings: [
        { point: 'Calls the regulator', level: 'M', rationale: 'Late', evaluator: 'Eva' },
      ],
    },
  ],
  actions: [
    {
      id: 'a1',
      code: 'IP-01',
      objective_code: 'OBJ-01',
      finding: 'Call tree outdated',
      action: 'Update the call tree',
      owner: 'Laura',
      owner_area: 'Legal',
      due_date: '2026-01-01',
      status: 'open',
      status_note: '',
      overdue: true,
    },
  ],
  finalized_by: '',
  finalized_at: null,
  updated_at: '',
  can_edit: true,
  run_id: 'run-1',
  can_see_session: false,
  runs: [
    { id: 'run-1', number: 1, current: true, status: 'ended', started_at: '2026-10-20T09:00:00Z' },
  ],
  ...changes,
})

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response
const error = (code: string, status: number) =>
  json({ success: false, error: { code, message: code, ttx_id: null } }, status)

describe('The after-action report', () => {
  afterEach(() => vi.unstubAllGlobals())

  const preview = (changes: Partial<AarPreview> = {}): AarPreview => ({
    session_started: true,
    can_edit: true,
    objectives: [{ code: 'OBJ-01', title: 'Escalate in time' }],
    runs: [
      {
        id: 'run-1',
        number: 1,
        current: true,
        status: 'ended',
        started_at: '2026-10-20T09:00:00Z',
      },
    ],
    ...changes,
  })
  // The exercise re-tests nothing from earlier ones (RetestsPanel).
  const withRetests =
    (mock: (url: string, init?: RequestInit) => Promise<Response>) =>
    (url: string, init?: RequestInit) =>
      url.endsWith('/retests') ? Promise.resolve(json([])) : mock(url, init)
  const before = (body: AarPreview, created?: AarRead) =>
    vi.fn(async (url: string, init?: RequestInit) =>
      init?.method === 'POST' && created
        ? json(created, 201)
        : url.endsWith('/aar/preview')
          ? json(body)
          : error('AAR_NOT_STARTED', 404),
    )

  describe('AI proposals', () => {
    const proposal = (changes: object = {}) => ({
      id: 'p1',
      batch_id: 'b1',
      target: 'aar_text',
      operation: 'update',
      target_id: 'r1',
      base: { conclusions: '' },
      patch: { conclusions: 'Containment was late' },
      depends_on: [],
      summary: 'What the table did',
      issues: [],
      evidence: [
        { kind: 'inject', ref: 'INJ-02', label: 'Ransom note' },
        { kind: 'decision', ref: 'd1', label: 'Isolate the servers' },
      ],
      status: 'pending',
      applied_row_id: null,
      created_at: '2026-11-05T10:00:00Z',
      decided_at: null,
      outdated: false,
      ...changes,
    })
    const server = (body: AarRead, items: object[]) => {
      const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith('/applied')) return json(proposal({ status: 'accepted' }))
        if (url.includes('/assistant/proposals')) return json({ items })
        if (init?.method === 'PUT') {
          const sent = JSON.parse(init.body as string)
          return json({
            ...body,
            ...sent,
            revision: body.revision + 1,
            actions: sent.actions.map((action: object, at: number) => ({
              ...action,
              id: `saved-${at}`,
              code: `IP-0${at + 1}`,
            })),
            objectives: body.objectives,
          })
        }
        return json(body)
      })
      vi.stubGlobal('fetch', withRetests(fetchMock))
      return fetchMock
    }
    const applied = (fetchMock: ReturnType<typeof server>) =>
      fetchMock.mock.calls.filter(([url]) => url.endsWith('/applied'))

    it('shows what each rests on, and saves one accepted', async () => {
      const fetchMock = server(report(), [proposal()])
      render(<AfterActionSection ttxId="ttx-1" />)
      expect(await screen.findByText('Based on')).toBeInTheDocument()
      expect(screen.getByText('INJ-02')).toBeInTheDocument()
      expect(screen.getByText('Isolate the servers')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      await waitFor(() => expect(applied(fetchMock)).toHaveLength(1), { timeout: 3000 })
      expect(JSON.parse(applied(fetchMock)[0][1]?.body as string)).toEqual({ row_id: 'r1' })
      const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
      expect(JSON.parse(put?.[1]?.body as string).conclusions).toBe('Containment was late')
    })

    it('marks a new action applied with the row the server gave it', async () => {
      const fetchMock = server(report(), [
        proposal({
          target: 'aar_action',
          operation: 'create',
          target_id: null,
          base: null,
          patch: { objective_code: 'OBJ-01', finding: 'Slow', action: 'Rehearse' },
        }),
      ])
      render(<AfterActionSection ttxId="ttx-1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
      await waitFor(() => expect(applied(fetchMock)).toHaveLength(1), { timeout: 3000 })
      expect(JSON.parse(applied(fetchMock)[0][1]?.body as string)).toEqual({ row_id: 'saved-1' })
    })

    it('asks before a proposal reopens a final report', async () => {
      const fetchMock = server(report({ status: 'final', finalized_by: 'Eva' }), [proposal()])
      render(<AfterActionSection ttxId="ttx-1" />)
      fireEvent.click(await screen.findByRole('button', { name: 'Accept' }))
      const dialog = await screen.findByRole('dialog', { name: 'Reopen the report?' })
      expect(within(dialog).getByText(/version 2/)).toBeInTheDocument()

      // Cancelling leaves it pending and the report untouched.
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
      expect(await screen.findByRole('button', { name: 'Accept' })).toBeEnabled()
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)

      fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
      fireEvent.click(await screen.findByRole('button', { name: 'Accept and reopen' }))
      await waitFor(
        () => expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
        { timeout: 3000 },
      )
    })

    it('stays away from someone who only reads the report', async () => {
      const fetchMock = server(report({ can_edit: false }), [proposal()])
      render(<AfterActionSection ttxId="ttx-1" />)
      expect(await screen.findByText('Update the call tree')).toBeInTheDocument()
      expect(screen.queryByText('AI proposals')).toBeNull()
      expect(fetchMock.mock.calls.some(([url]) => url.includes('/assistant/'))).toBe(false)
    })
  })

  it('is started from the session', async () => {
    const fetchMock = before(preview(), report())
    vi.stubGlobal('fetch', withRetests(fetchMock))
    render(<AfterActionSection ttxId="ttx-1" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Start the report from the session' }),
    )
    expect(await screen.findByText('Update the call tree')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/ttx-1/aar',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('is started from the session chosen, an archived one too', async () => {
    const fetchMock = before(
      preview({
        runs: [
          {
            id: 'run-2',
            number: 2,
            current: true,
            status: 'live',
            started_at: '2026-10-27T09:00:00Z',
          },
          {
            id: 'run-1',
            number: 1,
            current: false,
            status: 'ended',
            started_at: '2026-10-20T09:00:00Z',
          },
        ],
      }),
      report(),
    )
    vi.stubGlobal('fetch', withRetests(fetchMock))
    render(<AfterActionSection ttxId="ttx-1" />)

    const select = await screen.findByLabelText('Session the report is written from')
    expect(select).toHaveValue('run-2')
    fireEvent.change(select, { target: { value: 'run-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start the report from the session' }))

    expect(await screen.findByText('Update the call tree')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ run_id: 'run-1' })
  })

  it('previews what it will hold before the session', async () => {
    vi.stubGlobal('fetch', withRetests(before(preview({ session_started: false }))))
    render(<AfterActionSection ttxId="ttx-1" />)
    expect(await screen.findByRole('region', { name: 'OBJ-01' })).toBeInTheDocument()
    expect(screen.getByText('Escalate in time', { exact: false })).toBeInTheDocument()
    expect(screen.getAllByText('Filled from the session').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Written by you').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Start the report from the session' })).toBeDisabled()
    expect(screen.getByText('Available once the session has started.')).toBeInTheDocument()
  })

  it('offers no start to those who only read it', async () => {
    vi.stubGlobal('fetch', withRetests(before(preview({ can_edit: false }))))
    render(<AfterActionSection ttxId="ttx-1" />)
    expect(await screen.findByText("How it's filled")).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Start the report from the session' }),
    ).not.toBeInTheDocument()
  })

  it('saves itself, flags overdue actions and adds one from an area for improvement', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? json(report({ revision: 4 })) : json(report()),
    )
    vi.stubGlobal('fetch', withRetests(fetchMock))
    render(<AfterActionSection ttxId="ttx-1" />)

    expect(await screen.findByText('Overdue')).toBeInTheDocument()
    fireEvent.change(screen.getAllByRole('textbox', { name: 'Conclusions' })[0], {
      target: { value: 'A good first run' },
    })
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/aar',
          expect.objectContaining({ method: 'PUT' }),
        ),
      { timeout: 3000 },
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    const body = JSON.parse(put[1]!.body as string)
    expect(body.revision).toBe(3)
    expect(body.conclusions).toBe('A good first run')

    fireEvent.click(screen.getByRole('button', { name: 'Add an action for this area' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Objective')).toHaveValue('OBJ-01')
    expect(within(dialog).getByLabelText('Area for improvement')).toHaveValue(
      'Nobody called the regulator — late (Eva)',
    )
  })

  it('follows an action up without reopening the report', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? json(report({ status: 'final', revision: 5 }))
        : json(report({ status: 'final', finalized_by: 'Ada' })),
    )
    vi.stubGlobal('fetch', withRetests(fetchMock))
    render(<AfterActionSection ttxId="ttx-1" />)
    expect(await screen.findByText('Final — version 1, by Ada.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status of IP-01'), { target: { value: 'done' } })
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/aar/actions/IP-01',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
  })

  it("keeps the session's feedback and team notes at hand, from the run it starts from", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('/run/meters')) return json([])
      if (url.includes('/run/feedback/results')) {
        return json({
          responses: 2,
          players: 2,
          team: 0,
          minimum: 3,
          shown: false,
          statements: [],
          answers: {},
          open_questions: [],
        })
      }
      if (url.includes('/run/notes/team')) {
        return json({
          items: [
            {
              author: 'Olga',
              role: 'observer',
              inject_code: 'INJ-06',
              text: 'Nobody took the spokesperson role',
              updated_at: '',
            },
          ],
        })
      }
      return json(report({ can_see_session: true }))
    })
    vi.stubGlobal('fetch', withRetests(fetchMock))
    render(<AfterActionSection ttxId="ttx-1" />)

    expect(await screen.findByRole('heading', { name: 'From the session' })).toBeInTheDocument()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/run/feedback/results?run=run-1'),
        expect.anything(),
      ),
    )
    fireEvent.click(screen.getByText("The team's notes"))
    expect(await screen.findByText('Nobody took the spokesperson role')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/run/notes/team?run=run-1'),
      expect.anything(),
    )
  })

  it('shows nothing of the session to a reader off the team', async () => {
    vi.stubGlobal('fetch', withRetests(vi.fn(async () => json(report({ can_edit: false })))))
    render(<AfterActionSection ttxId="ttx-1" />)
    expect(await screen.findByText('Read-only')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'From the session' })).not.toBeInTheDocument()
  })

  it('moves to another session, keeping what is written', async () => {
    const runs: AarRead['runs'] = [
      {
        id: 'run-2',
        number: 2,
        current: true,
        status: 'ended',
        started_at: '2026-10-27T09:00:00Z',
      },
      {
        id: 'run-1',
        number: 1,
        current: false,
        status: 'ended',
        started_at: '2026-10-20T09:00:00Z',
      },
    ]
    const fetchMock = vi.fn(async (url: string) =>
      url.endsWith('/aar/run')
        ? json(report({ runs, run_id: 'run-2', revision: 4 }))
        : json(report({ runs })),
    )
    vi.stubGlobal('fetch', withRetests(fetchMock))
    render(<AfterActionSection ttxId="ttx-1" />)

    const select = await screen.findByLabelText('Session the report is written from')
    expect(select).toHaveValue('run-1')
    const change = screen.getByRole('button', { name: 'Change session' })
    expect(change).toBeDisabled()
    fireEvent.change(select, { target: { value: 'run-2' } })
    fireEvent.click(change)

    await waitFor(() =>
      expect(screen.getByLabelText('Session the report is written from')).toHaveValue('run-2'),
    )
    const post = fetchMock.mock.calls.find(([url]) => url.endsWith('/aar/run'))!
    expect(post[1]?.method).toBe('POST')
    expect(JSON.parse(String(post[1]?.body))).toEqual({ run_id: 'run-2', revision: 3 })
  })

  it('is read-only for its readers', async () => {
    vi.stubGlobal('fetch', withRetests(vi.fn(async () => json(report({ can_edit: false })))))
    render(<AfterActionSection ttxId="ttx-1" />)
    expect(await screen.findByText('Read-only')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New action' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark as final' })).not.toBeInTheDocument()
    expect(screen.getByText(/^Written from: Session 1 \(current\)/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Change session' })).not.toBeInTheDocument()
  })

  it('links an action to the later exercise that re-tests it, and lists what this one re-tests', async () => {
    const action = report().actions[0]
    const linked = report({
      can_follow_up: true,
      actions: [
        {
          ...action,
          retest: {
            ttx_id: 'ttx-2',
            ttx_code: 'TTX-2026-02',
            ttx_name: 'Ransomware drill II',
            objective_id: 'obj-9',
            objective_code: 'OBJ-01',
            objective_title: 'Contain it',
          },
        },
      ],
    })
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/retests'))
        return json([
          {
            source_ttx_id: 'ttx-0',
            source_ttx_code: 'TTX-2025-07',
            source_ttx_name: 'Last year',
            code: 'IP-04',
            finding: '',
            action: 'Rehearse the call tree',
            status: 'open',
            objective_id: null,
            objective_code: null,
            objective_title: null,
          },
        ])
      if (url.endsWith('/retest-candidates'))
        return json([
          {
            ttx_id: 'ttx-2',
            ttx_code: 'TTX-2026-02',
            ttx_name: 'Ransomware drill II',
            archived: false,
            objectives: [{ id: 'obj-9', code: 'OBJ-01', title: 'Contain it' }],
          },
        ])
      if (init?.method === 'PATCH') return json(linked)
      return json(report({ can_follow_up: true }))
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<AfterActionSection ttxId="ttx-1" />)

    expect(await screen.findByText('Improvement actions re-tested here')).toBeInTheDocument()
    expect(screen.getByText('Rehearse the call tree')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(`Where ${action.code} is re-tested`))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(await within(dialog).findByLabelText('Exercise'), {
      target: { value: 'ttx-2' },
    })
    fireEvent.change(within(dialog).getByLabelText('Objective'), { target: { value: 'obj-9' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/v1/ttx/ttx-1/aar/actions/${action.code}`,
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"retest_ttx_id":"ttx-2","retest_objective_id":"obj-9"'),
        }),
      ),
    )
    expect(await screen.findByText('Ransomware drill II')).toBeInTheDocument()
  })
})
