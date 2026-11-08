import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { CreatorConductPrepSection } from '../src/components/creator/conduct/CreatorConductPrepSection'
import { adoptSavedIds, draftFromPrep, newPoint, payloadFromDraft } from '../src/lib/conductPrep'
import type { ConductPrep, ValidationReport } from '../src/lib/types'
import { render } from './testUtils'

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ ttxList: [], refresh: vi.fn(async () => {}), user: { id: 'me' } }),
}))

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

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

const clean: ValidationReport = { ready: [], approved: [], warnings: [] }

function prep(fields: Partial<ConductPrep> = {}): ConductPrep {
  return {
    id: 'cp-1',
    ttx_id: 'ttx-1',
    exercise_code: 'TTX-2026-01',
    status: 'draft',
    version: 1,
    revision: 3,
    editable: true,
    seeded_needs_form_version: 1,
    seeded_msel_version: 1,
    drift: { needs_changed: false, msel_changed: false },
    context: {
      tlp: 'amber',
      needs_form_status: 'approved',
      needs_form_version: 1,
      date_window_start: '2026-11-02',
      date_window_end: '2026-11-20',
      max_duration_hours: 4,
      stop_exercise_keyword: 'BLUE SKY',
      participating_areas: ['SOC', 'OT Operations'],
      msel_status: 'ready',
      msel_ready_version: 1,
      msel_exercise_start: '09:30:00',
      msel_duration_minutes: 180,
      mandatory_injects: 13,
      mandatory_injects_validated: 12,
      lead_evaluator: { user_id: 'eva', full_name: 'Eva Luator' },
      exercise_evaluators: [{ user_id: 'eva', full_name: 'Eva Luator' }],
      team_members: [{ user_id: 'me', full_name: 'Ada Planner' }],
      exercise_controllers: [{ user_id: 'me', full_name: 'Ada Planner' }],
      phases: [],
      injects: [{ id: 'inj-1', code: 'INJ-01', title: 'SOC alert' }],
      exercise_players: [
        {
          user_id: 'carla',
          full_name: 'Carla CEO',
          email: 'carla@acme.com',
          invited_at: '2026-10-03T09:00:00+00:00',
          joined_at: '2026-10-03T10:00:00+00:00',
        },
      ],
      pending_access_requests: 1,
    },
    eeg: [
      {
        id: 'eeg-1',
        objective_id: 'obj-1',
        code: 'OBJ-01',
        statement: 'Decide the early warning',
        capability: 'detection',
        orphaned: false,
        points: [
          {
            id: 'pt-1',
            kind: 'expected_action',
            text: 'Committee records the decision',
            criteria_p: '',
            criteria_s: '',
            criteria_m: '',
            criteria_u: '',
            source_text: 'Committee records the decision',
            source_action_id: 'a-1',
            source_action_code: 'INJ-01-A1',
            source_inject_code: 'INJ-01',
            source_inject_title: 'SOC alert',
            responsible_role: 'Crisis Committee',
            expected_within_minutes: 15,
            source_status: 'current',
          },
        ],
      },
    ],
    evaluators: [],
    data_collection_methods: [],
    data_collection_other: '',
    log_keeper_id: null,
    briefing_date: null,
    briefing_checklist: [],
    briefing_notes: '',
    briefed_controller_ids: [],
    hot_wash_days: 0,
    debrief_days: 0,
    ratings_due_days: 3,
    draft_aar_days: 14,
    after_action_meeting_days: 21,
    fpm_date: null,
    fpm_done: false,
    fpm_attendees: '',
    fpm_notes: '',
    fpm_msel_version: null,
    dry_run_date: null,
    dry_run_done: false,
    findings: [],
    session_date: null,
    session_time: '09:30:00',
    timezone: '',
    session_starts_at: null,
    modality: null,
    venue: '',
    room: '',
    meeting_link: '',
    session_notes: '',
    invitation_text: '',
    invitation_sent_on: null,
    logistics_checklist: [],
    attendees: [],
    documents_reviewed: [],
    stop_procedure: 'Say the keyword aloud.',
    updated_at: '2026-10-04T10:00:00Z',
    ready_by: '',
    ready_by_id: null,
    ready_at: null,
    validation: {
      ready: [
        {
          code: 'OBJECTIVE_WITHOUT_EVALUATOR',
          section: 1,
          field: 'evaluators',
          item_id: 'eeg-1',
        },
        { code: 'INJECTS_NOT_VALIDATED', section: 2, field: 'msel', item_id: null },
      ],
      approved: [],
      // Worth a look, never blocking: the meeting is optional.
      warnings: [{ code: 'FPM_NOT_DONE', section: 2, field: 'fpm_done', item_id: null }],
    },
    ...fields,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderPage(entry = '/creator/ttx-1/conduct-prep') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/creator/:ttxId/:section"
          element={
            <>
              <CreatorConductPrepSection />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreatorConductPrepSection', () => {
  it('shows the steps with what blocks each and the seeded EEG', async () => {
    stubApi({ 'GET /ttx/ttx-1/conduct-prep': [json(200, prep())] })
    renderPage()

    expect(await screen.findByText('TTX-2026-01')).toBeInTheDocument()
    const steps = within(screen.getByRole('navigation', { name: 'Session plan steps' }))
    expect(steps.getByRole('link', { name: /Evaluation plan/ })).toHaveAccessibleName(/1 issue/)
    expect(steps.getByRole('link', { name: /Design validation/ })).toHaveAccessibleName(/1 issue/)
    expect(steps.getByRole('link', { name: /^Session/ })).toHaveAccessibleName(/Complete/)
    expect(steps.getAllByRole('link')).toHaveLength(5)
    // A seeded point's text is read-only here, edited at its source.
    expect(screen.getByText('Committee records the decision')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Committee records the decision')).toBeNull()
    // The points' sources, named once in the group's hint.
    expect(screen.getByRole('link', { name: 'MSEL' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/msel?tab=injects',
    )
    expect(screen.getByRole('link', { name: 'needs analysis' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/needs?step=objectives',
    )
    // The common scale as a strip; its definitions behind a disclosure
    // (open the first time).
    const scale = within(screen.getByRole('region', { name: 'Common scale' }))
    expect(scale.getAllByText('With some challenges')).not.toHaveLength(0)
    expect(scale.getByText(/Done and achieved, with room to be more effective/)).toBeInTheDocument()
    fireEvent.click(scale.getByRole('button', { name: /Hide definitions/ }))
    expect(scale.queryByText(/Done and achieved/)).toBeNull()
    // Each point: its source and the scale chip, which opens the adjustment.
    const row = screen.getByText('Committee records the decision').closest('li')!
    expect(within(row).getByText('INJ-01')).toBeInTheDocument()
    expect(within(row).getByText('Crisis Committee · within 15 min')).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/^Done as expected and on time/)).toBeNull()
    const chip = within(row).getByRole('button', { name: 'Common scale' })
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(chip)
    expect(chip).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByPlaceholderText(/^Done as expected and on time/)).toBeInTheDocument()
    // A seeded point is removed at its source; an own point here.
    expect(within(row).queryByRole('button', { name: /Remove/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '+ Add own point' }))
    const own = screen.getByPlaceholderText(
      'e.g. The committee records the notification decision with its rationale…',
    )
    expect(own).toHaveFocus()
    expect(screen.getByRole('button', { name: 'Remove this own point' })).toBeInTheDocument()
    fireEvent.change(own, { target: { value: 'Spokesperson named' } })
    expect(
      screen.getByRole('button', { name: 'Remove own point “Spokesperson named”' }),
    ).toBeInTheDocument()
    expect(
      screen.getAllByRole('button', { name: /OBJ-01 \| Decide the early warning: assign/ }),
    ).not.toHaveLength(0)
  })

  it('explains the evaluation plan in a guide under its description', async () => {
    stubApi({ 'GET /ttx/ttx-1/conduct-prep': [json(200, prep())] })
    renderPage()

    // Open the first time: the three blocks and the rating scale.
    expect(await screen.findByText('1. What is observed — the definitive EEGs')).toBeInTheDocument()
    expect(screen.getByText('2. Who observes — Evaluator assignments')).toBeInTheDocument()
    expect(screen.getByText('3. How data is collected')).toBeInTheDocument()
    expect(screen.getByText(/^Unable to be performed — /)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Show less' })[0])
    expect(screen.queryByText('3. How data is collected')).toBeNull()
  })

  it('marks a point whose scale is adjusted on its chip', async () => {
    const adjusted = prep()
    adjusted.eeg[0].points[0].criteria_p = 'Records it within 15 min'
    stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, adjusted)],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
    })
    renderPage()

    // The chip shows the adjusted level at a glance; the text is one click away.
    const chip = await screen.findByRole('button', { name: 'Scale adjusted in P' })
    fireEvent.click(chip)
    expect(screen.getByDisplayValue('Records it within 15 min')).toBeInTheDocument()
  })

  it('explains each calendar milestone and keeps it as days after the session', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep({ session_date: '2026-11-10' }))],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
      'PUT /ttx/ttx-1/conduct-prep': [json(200, prep({ revision: 4 }))],
    })
    renderPage('/creator/ttx-1/conduct-prep?step=documents')

    const meeting = await screen.findByLabelText('After Action Meeting')
    expect(meeting).toHaveValue(21)
    expect(
      screen.getByText(/validate the draft and agree the improvement plan/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Dec 1, 2026/)).toBeInTheDocument()
    expect(screen.getAllByText('days after: the session day itself')).toHaveLength(2)

    fireEvent.change(meeting, { target: { value: '30' } })
    expect(screen.getByText(/Dec 10, 2026/)).toBeInTheDocument()
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/conduct-prep',
          expect.objectContaining({ method: 'PUT' }),
        ),
      { timeout: 3000 },
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string).after_action_meeting_days).toBe(30)
  })

  it('assigns Evaluators to objectives in a coverage matrix; attendance is in the briefing', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep())],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
      'PUT /ttx/ttx-1/conduct-prep': [json(200, prep({ revision: 4 }))],
    })
    renderPage()

    // Objective rows × Evaluator columns; nobody covers OBJ-01 yet.
    const cell = await screen.findByRole('checkbox', { name: 'OBJ-01: Eva Luator' })
    const row = screen.getByRole('row', { name: /OBJ-01/ })
    expect(within(row).getByText('No evaluator')).toBeInTheDocument()
    expect(screen.queryByText(/Area of expertise/)).toBeNull()

    fireEvent.click(cell)
    expect(within(row).getByText('Covered')).toBeInTheDocument()
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/conduct-prep',
          expect.objectContaining({ method: 'PUT' }),
        ),
      { timeout: 3000 },
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string).evaluators).toEqual([
      { id: null, user_id: 'eva', areas: [], briefed: false, objective_ids: ['eeg-1'] },
    ])
  })

  it('keeps the session, its convocation and decision makers in one step', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep())],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
      'PUT /ttx/ttx-1/conduct-prep': [json(200, prep({ revision: 4 }))],
    })
    // The session step.
    renderPage('/creator/ttx-1/conduct-prep?step=session')

    const steps = within(await screen.findByRole('navigation', { name: 'Session plan steps' }))
    expect(steps.getByRole('link', { name: /^Session/ })).toHaveAttribute('aria-current', 'step')
    // Whatever the modality: complementary information.
    fireEvent.change(screen.getByLabelText(/Complementary information/), {
      target: { value: 'Parking at gate B' },
    })
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/conduct-prep',
          expect.objectContaining({ method: 'PUT' }),
        ),
      { timeout: 3000 },
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string).session_notes).toBe('Parking at gate B')

    // The convocation is optional: folded while empty, open on demand.
    const heading = screen.getByRole('heading', { name: /Convocation and key decision makers/ })
    expect(heading).toHaveTextContent('(optional)')
    const group = heading.closest('details')!
    expect(group.open).toBe(false)
    fireEvent.click(heading.closest('summary')!)
    expect(group.open).toBe(true)
    expect(screen.getByLabelText(/Invitation text/)).toBeInTheDocument()
    expect(screen.getByText('Players with access (1)')).toBeInTheDocument()
  })

  it('briefs Controllers and Evaluators in Logistics', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep())],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
      'PUT /ttx/ttx-1/conduct-prep': [json(200, prep({ revision: 4 }))],
    })
    renderPage('/creator/ttx-1/conduct-prep?step=session')

    expect(
      await screen.findByRole('heading', { name: /Controller and evaluator briefing/ }),
    ).toBeInTheDocument()
    const attended = within(screen.getByRole('group', { name: 'Attended the briefing' }))
    expect(attended.getByText('Controllers')).toBeInTheDocument()
    expect(attended.getByLabelText(/Eva Luator/)).not.toBeChecked()
    fireEvent.click(attended.getByLabelText('Ada Planner'))
    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/conduct-prep',
          expect.objectContaining({ method: 'PUT' }),
        ),
      { timeout: 3000 },
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(put[1]!.body as string).briefed_controller_ids).toEqual(['me'])
  })

  it('picks decision makers among the Players who joined, or adds them by hand', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep())],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
      'PUT /ttx/ttx-1/conduct-prep': [json(200, prep({ revision: 4 }))],
    })
    renderPage('/creator/ttx-1/conduct-prep?step=session')

    // Who has access, and when they used the invitation.
    expect(await screen.findByText('Players with access (1)')).toBeInTheDocument()
    expect(screen.getByText(/Used the invitation on Oct 3, 2026/)).toBeInTheDocument()
    expect(screen.getByText(/1 request waiting for approval/)).toBeInTheDocument()
    expect(screen.queryByText(/Exercise risk/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add Carla CEO as a decision maker' }))
    expect(screen.getByText('Player · access since Oct 3, 2026')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add Carla CEO as a decision maker' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '+ Add decision maker by hand' }))
    expect(screen.getByText('No access to TTX-Zone (added by hand)')).toBeInTheDocument()
    // Not confirmed: the decision for if they don't come, inline.
    const substitute = screen.getAllByRole('radio', { name: 'Someone stands in' })[1]
    fireEvent.click(substitute)
    expect(screen.getByPlaceholderText('Who stands in…')).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: /Not confirmed/ })[0])
    expect(screen.getAllByRole('button', { name: /Confirmed/ })[0]).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/conduct-prep',
          expect.objectContaining({ method: 'PUT' }),
        ),
      { timeout: 3000 },
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    const attendees = JSON.parse(put[1]!.body as string).attendees
    expect(attendees[0]).toMatchObject({ user_id: 'carla', name: 'Carla CEO' })
    expect(attendees.some((a: { user_id: string | null }) => a.user_id === null)).toBe(true)
  })

  it('links an issue fixed in the MSEL to the MSEL', async () => {
    stubApi({
      'GET /ttx/ttx-1/conduct-prep': [
        json(
          200,
          prep({
            validation: {
              ready: [{ code: 'MSEL_NOT_READY', section: 2, field: 'msel', item_id: null }],
              approved: [],
              warnings: [],
            },
          }),
        ),
      ],
    })
    renderPage('/creator/ttx-1/conduct-prep?step=validation')

    fireEvent.click(await screen.findByRole('button', { name: 'Fixed in the MSEL: mark it ready' }))
    expect(screen.getByTestId('location')).toHaveTextContent('/creator/ttx-1/msel?tab=review')
  })

  it('opens a folded optional group when one of its issues is picked', async () => {
    stubApi({ 'GET /ttx/ttx-1/conduct-prep': [json(200, prep())] })
    renderPage('/creator/ttx-1/conduct-prep?step=validation')

    const heading = await screen.findByRole('heading', { name: /Final Planning Meeting/ })
    const group = heading.closest('details')!
    expect(group.open).toBe(false)
    const panel = screen
      .getByRole('heading', { level: 2, name: 'Design validation' })
      .closest('section')!
    fireEvent.click(
      within(panel).getByRole('button', { name: /No Final Planning Meeting recorded/ }),
    )
    expect(group.open).toBe(true)
    expect(document.getElementById('cp-fpm_done')).toHaveFocus()
  })

  it('records design findings with the review that found them', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep())],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
      'PUT /ttx/ttx-1/conduct-prep': [json(200, prep({ revision: 4 }))],
    })
    renderPage('/creator/ttx-1/conduct-prep?step=validation')

    const group = await screen.findByRole('region', { name: /Design findings/ })
    fireEvent.click(within(group).getByRole('button', { name: '+ Add finding' }))
    fireEvent.change(within(group).getByLabelText('Found in'), {
      target: { value: 'design_review' },
    })

    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      const sent = JSON.parse(check![1]!.body as string)
      expect(sent.findings[0]).toMatchObject({
        found_in: 'design_review',
        kind: 'ambiguous_inject',
      })
    })
  })

  it('autosaves an edit after the dry run', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep())],
      'POST /ttx/ttx-1/conduct-prep/validate': [json(200, clean)],
      'PUT /ttx/ttx-1/conduct-prep': [json(200, prep({ revision: 4 }))],
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Common scale' }))
    fireEvent.change(screen.getByPlaceholderText(/^Done as expected and on time/), {
      target: { value: 'Records it within 15 min' },
    })

    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/conduct-prep',
          expect.objectContaining({ method: 'PUT' }),
        ),
      { timeout: 3000 },
    )
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    const body = JSON.parse(put[1]!.body as string)
    expect(body.revision).toBe(3)
    expect(body.eeg[0].points[0]).toMatchObject({
      id: 'pt-1',
      criteria_p: 'Records it within 15 min',
    })
  })

  it('updates drifted EEGs from their sources', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [
        json(200, prep({ drift: { needs_changed: false, msel_changed: true } })),
      ],
      'POST /ttx/ttx-1/conduct-prep/eeg/reseed': [json(200, prep({ seeded_msel_version: 2 }))],
    })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Update the EEGs' }))

    expect(
      await screen.findByText('EEGs updated from the needs analysis and the MSEL'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/ttx-1/conduct-prep/eeg/reseed',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(screen.queryByRole('button', { name: 'Update the EEGs' })).not.toBeInTheDocument()
  })

  it('marks a plan with nothing blocking ready', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep({ validation: clean }))],
      'POST /ttx/ttx-1/conduct-prep/transitions': [
        json(200, prep({ validation: clean, status: 'ready', ready_by: 'Ada Planner' })),
      ],
    })
    renderPage('/creator/ttx-1/conduct-prep?step=review')

    fireEvent.click(await screen.findByRole('button', { name: 'Mark ready' }))

    expect(await screen.findByText('Plan marked ready')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({ to: 'ready' })
  })

  it('says a ready plan is ready, not that it can be marked ready', async () => {
    stubApi({
      'GET /ttx/ttx-1/conduct-prep': [json(200, prep({ validation: clean, status: 'ready' }))],
    })
    renderPage()

    expect(await screen.findByText('No issues. The plan is ready.')).toBeInTheDocument()
    expect(screen.queryByText('Nothing blocks it: the plan can be marked ready.')).toBeNull()
  })

  it('offers the session documents, one per audience', async () => {
    stubApi({ 'GET /ttx/ttx-1/conduct-prep': [json(200, prep())] })
    renderPage()

    fireEvent.click(await screen.findByText('Download documents'))
    const menu = within(screen.getByRole('list', { name: 'Session documents' }))
    expect(menu.getAllByRole('link')).toHaveLength(6)
    expect(menu.getByRole('link', { name: /Situation Manual \(SitMan\)/ })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/conduct-prep/export/sitman.pdf?lang=en',
    )
  })

  it('asks before editing a ready plan', async () => {
    stubApi({ 'GET /ttx/ttx-1/conduct-prep': [json(200, prep({ status: 'ready' }))] })
    renderPage()

    fireEvent.click(await screen.findByRole('button', { name: 'Common scale' }))
    fireEvent.change(screen.getByPlaceholderText(/^Done as expected and on time/), {
      target: { value: 'Records it within 15 min' },
    })

    expect(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Edit as version 2' }),
    ).toBeInTheDocument()
  })

  it('points to the needs analysis while it is not approved', async () => {
    stubApi({
      'GET /ttx/ttx-1/conduct-prep': [
        json(409, {
          success: false,
          error: { code: 'NEEDS_FORM_NOT_APPROVED', message: 'Approve it first.' },
        }),
      ],
    })
    renderPage()

    expect(await screen.findByRole('link', { name: 'Go to the needs analysis' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/needs?step=approval',
    )
  })
})

describe('conduct prep drafts', () => {
  it('sends only what a save takes, and new rows adopt their saved ids', () => {
    const draft = draftFromPrep(prep())
    const point = newPoint()
    draft.eeg[0].points.push({ ...point, text: 'Spokesperson named' })
    const payload = payloadFromDraft(draft, 7)
    expect(payload.revision).toBe(7)
    expect(payload.eeg[0].points[1]).toEqual({
      id: null,
      text: 'Spokesperson named',
      criteria_p: '',
      criteria_s: '',
      criteria_m: '',
      criteria_u: '',
    })

    const saved = draftFromPrep(prep())
    saved.eeg[0].points.push({ ...saved.eeg[0].points[0], id: 'pt-2', text: 'Spokesperson named' })
    const current = { ...draft, briefing_notes: 'typed meanwhile' }
    const adopted = adoptSavedIds(current, draft, saved)
    expect(adopted.eeg[0].points[1].id).toBe('pt-2')
    expect(adopted.briefing_notes).toBe('typed meanwhile')
  })
})
