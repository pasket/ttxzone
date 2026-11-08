import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreatorDesignGate } from '../src/components/creator/CreatorDesignGate'
import { CreatorMselSection } from '../src/components/creator/msel/CreatorMselSection'
import {
  draftFromMsel,
  clockAt,
  formatOffset,
  formatIncident,
  formatClock,
  formatOffsetAt,
  incidentMinutesAt,
  newMselKey,
  payloadFromDraft,
  reconcileSaved,
  type MselDraft,
} from '../src/lib/msel'
import type { AttackCatalog, AttackRef, Msel } from '../src/lib/types'
import { render } from './testUtils'

let mockTtxList: Record<string, unknown>[] = []
let mockProgramManager = false
const refresh = vi.fn(async () => {})
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    ttxList: mockTtxList,
    refresh,
    user: { id: 'me', full_name: 'Ada Planner' },
    activeOrganizationId: 'org-1',
    activeOrganization: { id: 'org-1', is_program_manager: mockProgramManager },
  }),
}))

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

const catalog: AttackCatalog = {
  version: '19.2',
  released: '2026-08-05',
  latest_version: '19.2',
  copyright: 'Copyright 2015-2026, The MITRE Corporation.',
  domains: [
    {
      domain: 'enterprise',
      name: 'Enterprise',
      tactics: [
        { id: 'TA0001', name: 'Initial Access' },
        { id: 'TA0005', name: 'Stealth' },
        { id: 'TA0040', name: 'Impact' },
      ],
      techniques: [
        { id: 'T1486', name: 'Data Encrypted for Impact', tactics: ['TA0040'], parent: null },
        { id: 'T1566', name: 'Phishing', tactics: ['TA0001'], parent: null },
        { id: 'T1566.001', name: 'Spearphishing Attachment', tactics: ['TA0001'], parent: 'T1566' },
        { id: 'T1078', name: 'Valid Accounts', tactics: ['TA0001', 'TA0005'], parent: null },
      ],
    },
    {
      domain: 'ics',
      name: 'ICS',
      tactics: [{ id: 'TA0105', name: 'Impact' }],
      techniques: [
        { id: 'T0826', name: 'Loss of Availability', tactics: ['TA0105'], parent: null },
      ],
    },
  ],
}

const encryption: AttackRef = {
  domain: 'enterprise',
  tactic_id: 'TA0040',
  technique_id: 'T1486',
  tactic_name: 'Impact',
  technique_name: 'Data Encrypted for Impact',
}

const cleanReport = { ready: [], approved: [], warnings: [] }

function msel(overrides: Partial<Msel> = {}): Msel {
  return {
    id: 'msel-1',
    ttx_id: 'ttx-1',
    exercise_code: 'TTX-2026-01',
    status: 'draft',
    version: 1,
    revision: 2,
    needs_form_version: 1,
    editable: true,
    renumberable: [],
    needs: {
      status: 'approved',
      version: 1,
      tlp: 'amber',
      participating_areas: ['Crisis Committee', 'SOC'],
      max_duration_hours: 4,
      objectives: [
        {
          id: 'obj-1',
          code: 'OBJ-01',
          statement: 'Decide on the early warning within 60 minutes.',
          capability: 'regulatory_notification',
        },
        {
          id: 'obj-2',
          code: 'OBJ-02',
          statement: 'Agree whether to isolate the control centre.',
          capability: 'cross_unit_coordination',
        },
      ],
    },
    title: 'Operation Dark Grid',
    summary: 'Ransomware on a Monday morning.',
    attack_version: '19.2',
    threat_actors: [
      {
        id: 'thr-1',
        code: 'THR-01',
        name: 'Nebula affiliate',
        mitre_group_id: null,
        aliases: [],
        description: 'Buys access, then encrypts.',
        techniques: [
          {
            domain: 'enterprise',
            technique_id: 'T1486',
            technique_name: 'Data Encrypted for Impact',
            tactic_ids: ['TA0040'],
          },
          {
            domain: 'enterprise',
            technique_id: 'T1566.001',
            technique_name: 'Phishing: Spearphishing Attachment',
            tactic_ids: ['TA0001'],
          },
        ],
        origin: 'exercise',
        origin_id: null,
        origin_name: null,
      },
    ],
    attack_techniques: [encryption],
    exercise_start: '09:30:00',
    duration_minutes: 180,
    time_compression: 20,
    actors: [
      { id: 'act-1', code: 'ACT-01', name: 'SOC', type: 'soc', played_by: '' },
      { id: 'act-2', code: 'ACT-02', name: 'Media', type: 'media', played_by: 'Controller' },
    ],
    phases: [
      {
        id: 'ph-1',
        code: 'PH-01',
        name: 'Detection',
        start_offset: 0,
        end_offset: 90,
        incident_jump_minutes: 0,
        situation_update: '',
        key_questions: [],
        objective_ids: ['obj-1'],
      },
      {
        id: 'ph-2',
        code: 'PH-02',
        name: 'Escalation',
        start_offset: 90,
        end_offset: 180,
        incident_jump_minutes: 0,
        situation_update: '',
        key_questions: [],
        objective_ids: ['obj-1', 'obj-2'],
      },
    ],
    injects: [
      {
        id: 'inj-1',
        code: 'INJ-01',
        phase_id: 'ph-1',
        kind: 'mandatory',
        title: 'Ransom note found',
        content: 'Your files are encrypted.',
        offset_minutes: 20,
        trigger_condition: '',
        contingent_purpose: '',
        branch_from_id: null,
        branch_action_id: null,
        rejoin_inject_id: null,
        simulated_actor_id: 'act-1',
        attack_attribution: 'threat_actor',
        threat_actor_id: 'thr-1',
        recipients: ['SOC'],
        delivery_method: 'email',
        attachment_notes: [],
        attack_techniques: [encryption],
        facilitator_notes: 'Watch who escalates.',
        review_status: 'validated',
        validated_by: 'Controller',
        objective_ids: ['obj-1'],
        expected_actions: [
          {
            id: 'act-a1',
            code: 'INJ-01-A1',
            description: 'SOC escalates to the crisis committee',
            responsible_role: 'SOC',
            expected_within_minutes: 15,
            objective_ids: ['obj-1'],
          },
        ],
      },
      {
        id: 'inj-2',
        code: 'INJ-C01',
        // In the phase of the inject it branches off (INJ-01).
        phase_id: 'ph-1',
        kind: 'contingent',
        title: 'Journalist calls',
        content: 'We hear there was an attack.',
        offset_minutes: null,
        trigger_condition: 'No statement by T+100',
        contingent_purpose: 'Pressure',
        // Fires if the SOC hasn't escalated INJ-01 within 15 minutes.
        branch_from_id: 'inj-1',
        branch_action_id: 'act-a1',
        rejoin_inject_id: null,
        simulated_actor_id: 'act-2',
        recipients: ['Crisis Committee'],
        delivery_method: 'phone',
        attachment_notes: [],
        attack_techniques: [],
        facilitator_notes: '',
        review_status: 'draft',
        validated_by: '',
        objective_ids: ['obj-1'],
        expected_actions: [
          {
            id: 'act-b1',
            code: 'INJ-C01-A1',
            description: 'Committee approves a holding statement',
            responsible_role: 'Crisis Committee',
            expected_within_minutes: null,
            objective_ids: ['obj-1'],
          },
        ],
      },
    ],
    updated_at: '2026-09-28T10:00:00+00:00',
    validation: {
      ready: [
        {
          code: 'OBJECTIVE_NOT_COVERED',
          section: 5,
          field: 'objectives',
          item_id: 'obj-2',
        },
      ],
      approved: [],
      warnings: [
        {
          code: 'PHASE_WITHOUT_MANDATORY',
          section: 2,
          field: 'injects',
          item_id: 'ph-1',
        },
      ],
    },
    ...overrides,
  }
}

function LocationProbe() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname + location.search}</p>
}

function renderPage(entry = '/creator/ttx-1/msel') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route
          path="/creator/:ttxId/:section"
          element={
            <>
              <CreatorMselSection />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreatorMselSection', () => {
  beforeEach(() => {
    refresh.mockClear()
    mockProgramManager = false
  })

  it('shows the header, the tab states and the validation summary', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()

    expect(await screen.findByText('TTX-2026-01')).toBeInTheDocument()
    expect(screen.getByText('Version 1')).toBeInTheDocument()
    // The header badge and the status track both say where it's at.
    expect(screen.getAllByText('Draft')).toHaveLength(2)
    const track = within(screen.getByRole('region', { name: 'Status' }))
    expect(track.getByText('Draft').closest('li')).toHaveAttribute('aria-current', 'step')
    const tabs = within(screen.getByRole('navigation', { name: 'MSEL sections' }))
    expect(tabs.getByRole('link', { name: /Coverage/ })).toHaveAccessibleName(/1 issue/)
    // The badge says on hover that it counts what's left to fix.
    expect(tabs.getByTitle('1 issue to fix')).toHaveTextContent('1')
    expect(tabs.getByRole('link', { name: /Scenario/ })).toHaveAccessibleName(/Complete/)
    expect(
      screen.getByRole('button', { name: /OBJ-02 \|.*: no mandatory inject evaluates it/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /PH-01 \| Detection has no mandatory inject/ }),
    ).toBeInTheDocument()
  })

  it('offers compression presets and shows what the session adds up to', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage()

    const compression = await screen.findByLabelText('Each minute of session represents')
    expect(compression).toHaveAccessibleDescription(
      'How far scenario time moves on for each minute of session.',
    )
    // The fixture's 20 isn't a preset: it stays selectable instead of changing.
    expect(compression).toHaveValue('20')
    expect(within(compression).getByRole('option', { name: '1 hour' })).toBeInTheDocument()
    expect(within(compression).getByRole('option', { name: '20 min' })).toBeInTheDocument()
    const meeting = screen.getByText('Session', { selector: 'dt' }).nextElementSibling
    const incident = screen.getByText('Scenario', { selector: 'dt' }).nextElementSibling
    expect(meeting).toHaveTextContent('3 h')
    expect(incident).toHaveTextContent('2 d 12 h')

    fireEvent.change(compression, { target: { value: '60' } })
    expect(incident).toHaveTextContent('7 d 12 h')
  })

  it('says a check that fails leaves the changes unsaved', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [
        json(500, { success: false, error: { code: 'INTERNAL', message: 'Boom', ttx_id: null } }),
      ],
    })
    renderPage('/creator/ttx-1/msel?tab=scenario')
    fireEvent.change(await screen.findByLabelText('Scenario title'), {
      target: { value: 'A new title' },
    })
    // Without a check the draft can't save: said, not left silent.
    expect(await screen.findByText(/^Couldn.t save/)).toBeInTheDocument()
  })

  it('shows the pinned ATT&CK release with the threat actors, and no ATT&CK list in Coverage', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=threats')
    // Threat actors: the release they and the injects refer to, no list.
    expect(await screen.findByText(/MITRE ATT&CK v19\.2, released August 2026/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /ATT&CK techniques/ })).toBeNull()

    // ATT&CK is set up in earlier tabs: Coverage doesn't list it again.
    fireEvent.click(screen.getByRole('link', { name: /^Coverage/ }))
    await screen.findByRole('heading', { name: /Coverage/, level: 2 })
    expect(screen.queryByRole('region', { name: /ATT&CK techniques/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /T1486 Data Encrypted for Impact/ })).toBeNull()
  })

  it('groups the phases by objective, and the grouping stays in the Phases tab', async () => {
    const base = msel()
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(200, {
          ...base,
          needs: {
            ...base.needs,
            objectives: [
              ...base.needs.objectives,
              {
                id: 'obj-3',
                code: 'OBJ-03',
                statement: 'Hold a press line.',
                capability: 'internal_external_comms',
              },
            ],
          },
        }),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')
    await screen.findByRole('button', { name: 'Edit phase PH-01' })
    // In session order: an Objectives column, no group headings.
    expect(screen.getByRole('columnheader', { name: 'Objectives' })).toBeInTheDocument()
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Objective' }))
    expect(screen.getByTestId('location')).toHaveTextContent('group=objective')
    expect(screen.queryByRole('columnheader', { name: 'Objectives' })).toBeNull()
    const groups = screen.getAllByRole('rowgroup').slice(1)
    expect(groups).toHaveLength(3)
    // PH-02 works OBJ-01 and OBJ-02: it shows under both.
    expect(within(groups[0]).getAllByRole('button', { name: /^Edit phase/ })).toHaveLength(2)
    expect(within(groups[1]).getByRole('button', { name: 'Edit phase PH-02' })).toBeInTheDocument()
    expect(within(groups[2]).getByText('No phase works on this objective yet.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: /^Injects/ }))
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('tab=injects'))
    expect(screen.getByTestId('location')).not.toHaveTextContent('group=')
  })

  it('shows a phase with no inject in Injects, filtered on that phase', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')
    await screen.findByRole('button', { name: 'Edit phase PH-01' })
    // Nothing to do about it in Phases: no note there.
    expect(screen.queryByRole('status', { name: 'Worth reviewing in this section' })).toBeNull()

    fireEvent.click(screen.getByRole('link', { name: /^Injects/ }))
    const review = await screen.findByRole('status', { name: 'Worth reviewing in this section' })
    fireEvent.click(
      within(review).getByRole('button', { name: 'PH-01 | Detection has no mandatory inject.' }),
    )
    // Filtered on that phase: said as a chip.
    const chips = await screen.findByRole('list', { name: 'Filters in force' })
    expect(chips).toHaveTextContent('Phase: PH-01 | Detection')
  })

  it('gives the threat actors their own tab, second', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            validation: {
              ready: [
                {
                  code: 'MSEL_INCOMPLETE',
                  section: 4,
                  field: 'threat_actor_name',
                  item_id: 'thr-1',
                },
              ],
              approved: [],
              warnings: [],
            },
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()
    const tabs = within(await screen.findByRole('navigation', { name: 'MSEL sections' }))
    expect(
      tabs.getAllByRole('link').map((link) => link.querySelector('span')?.textContent),
    ).toEqual(['Scenario', 'Threat actors', 'Phases', 'Injects', 'Coverage', 'Review'])
    // Scenario is general parameters only.
    expect(screen.queryByRole('button', { name: 'New unknown actor' })).toBeNull()

    // A nameless actor's entry opens the Threat actors tab.
    const summary = within(
      (await screen.findByRole('heading', { name: 'Validation' })).closest('section')!,
    )
    fireEvent.click(summary.getAllByRole('button')[0])
    expect(screen.getByTestId('location')).toHaveTextContent('tab=threats')
  })

  it('marks a tab with only warnings with an amber tick', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    const tabs = within(await screen.findByRole('navigation', { name: 'MSEL sections' }))
    const injects = tabs.getByRole('link', { name: /Injects/ })
    expect(within(injects).getByTitle(/worth reviewing/)).toHaveClass('text-inactive-1')
    expect(within(injects).getByTitle(/worth reviewing/)).toHaveTextContent('✓')
  })

  it('walks through the inject in five steps, each saying where it stands', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    const rail = within(dialog).getByRole('navigation', { name: 'Inject sections' })
    const step = (name: RegExp) => within(rail).getByRole('button', { name })
    expect(step(/Context/)).toHaveAttribute('aria-current', 'step')
    expect(step(/Context/)).toHaveAccessibleName('1 Context (current step)')
    expect(step(/Source and audience/)).toHaveAccessibleName('2 Source and audience (complete)')
    expect(step(/Whose activity/)).toHaveAccessibleName('4 Whose activity (complete)')

    // Emptying the title is flagged on the rail once the step is left.
    fireEvent.change(within(dialog).getByLabelText('Title'), { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next: Source and audience' }))
    expect(step(/Source and audience/)).toHaveAttribute('aria-current', 'step')
    expect(step(/Context/)).toHaveAccessibleName('1 Context (to complete)')
    expect(within(dialog).getByRole('heading', { name: /Source and audience/ })).toHaveFocus()

    // A step says why it isn't complete: an expected action left empty.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next: Evaluation' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add expected action' }))
    expect(
      within(dialog).getByText('Expected action 2 has no description: write it or remove the row.'),
    ).toBeInTheDocument()
  })

  it('lets each expected action say which of the inject’s objectives it evidences', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    const rail = within(dialog).getByRole('navigation', { name: 'Inject sections' })
    fireEvent.click(within(rail).getByRole('button', { name: /Evaluation/ }))
    // One objective: nothing to choose per action.
    expect(
      within(dialog).queryByRole('group', { name: 'Objectives action 1 evidences' }),
    ).toBeNull()

    const objectives = within(dialog).getByRole('group', { name: 'Objectives' })
    fireEvent.click(within(objectives).getByRole('button', { name: /OBJ-02/ }))
    const evidences = within(dialog).getByRole('group', { name: 'Objectives action 1 evidences' })
    // A new objective of the inject is evidenced by every action at first.
    expect(within(evidences).getByRole('button', { name: /OBJ-01/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(evidences).getByRole('button', { name: /OBJ-02/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.click(within(evidences).getByRole('button', { name: /OBJ-01/ }))

    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      const sent = JSON.parse(check![1]!.body as string).injects[0]
      expect(sent.objective_ids).toEqual(['obj-1', 'obj-2'])
      expect(sent.expected_actions[0].objective_ids).toEqual(['obj-2'])
    })
  })

  it('writes every change into the MSEL as it goes, and closes', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Ransom note, second copy' },
    })
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).injects[0].title).toBe(
        'Ransom note, second copy',
      )
    })
    // Nothing to cancel: it's already in. Close.
    expect(within(dialog).queryByRole('button', { name: 'Cancel' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close the inject' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('aims an inject at rooms when the exercise is played in rooms', async () => {
    const rooms = [
      { id: 'r1', code: 'RM-01', name: 'Blue' },
      { id: 'r2', code: 'RM-02', name: 'Red' },
    ]
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel({ uses_rooms: true, rooms }))],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel({ uses_rooms: true, rooms }))],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    const panel = within(await screen.findByRole('region', { name: 'Injects' }))
    // The table says where each inject is played; grouping by room is offered.
    expect(panel.getAllByText('All rooms').length).toBeGreaterThan(0)
    expect(
      within(panel.getByRole('group', { name: 'Group by' })).getByRole('button', { name: 'Room' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = within(screen.getByRole('dialog', { name: /^Inject INJ-01\b/ }))
    fireEvent.click(dialog.getByRole('button', { name: 'Next: Source and audience' }))
    const field = within(dialog.getByRole('group', { name: 'Rooms' }))
    expect(field.getByRole('button', { name: 'All rooms' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(field.getByRole('button', { name: /RM-02/ }))
    // A room replaces "All rooms"; the last one off is all rooms again.
    expect(field.getByRole('button', { name: 'All rooms' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).injects[0].room_ids).toEqual(['r2'])
    })
    fireEvent.click(field.getByRole('button', { name: /RM-02/ }))
    expect(field.getByRole('button', { name: 'All rooms' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows nothing about rooms when the exercise is played at one table', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    const panel = within(await screen.findByRole('region', { name: 'Injects' }))
    await panel.findByText('Ransom note found')
    expect(panel.queryByText('All rooms')).toBeNull()
    expect(
      within(panel.getByRole('group', { name: 'Group by' })).queryByRole('button', {
        name: 'Room',
      }),
    ).toBeNull()
  })

  it('marks each inject’s review with a tick or a cross', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    const validated = await screen.findByTitle('Validated')
    expect(validated).toHaveClass('text-success-fg')
    expect(screen.getByTitle('Draft')).toHaveClass('text-danger-fg')
  })

  it('lets a contingent inject branch off only an inject of its phase', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-C01' }))
    const dialog = screen.getByRole('dialog', { name: /^Inject INJ-C01\b/ })
    const branchesOff = within(dialog).getByLabelText(/Branches off/) as HTMLSelectElement
    // Required (no "none"), and only PH-01's injects: INJ-01.
    expect([...branchesOff.options].map((o) => o.textContent)).toEqual([
      'INJ-01 | T+00:20 · Ransom note found',
    ])
    // Back at INJ-01 itself would not be later than where it leaves.
    const back = within(dialog).getByLabelText(/Back to the storyline at/) as HTMLSelectElement
    expect([...back.options].map((o) => o.textContent)).not.toContain(
      'INJ-01 | T+00:20 · Ransom note found',
    )
  })

  it('says who validated an inject and lets another planner take it over', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    // Validated by someone else: said, with the override.
    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    let dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^5 Review/ }))
    expect(dialog).toHaveTextContent('Validated by Controller')
    fireEvent.click(within(dialog).getByRole('button', { name: /Override validation/ }))
    // Now it's the user's: still said, no override to offer.
    expect(dialog).toHaveTextContent('Validated by Ada Planner')
    expect(within(dialog).queryByRole('button', { name: /Override validation/ })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    // Validating a draft inject records the user doing it -- a switch,
    // once the first three steps are complete.
    fireEvent.click(screen.getByRole('button', { name: 'Edit inject INJ-C01' }))
    dialog = screen.getByRole('dialog', { name: /^Inject INJ-C01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^5 Review/ }))
    expect(dialog).not.toHaveTextContent('Validated by')
    const toggle = within(dialog).getByRole('switch', { name: 'Validated' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(dialog).toHaveTextContent('Validated by Ada Planner')
  })

  it('keeps validation off until the first three steps are complete', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-C01' }))
    const dialog = screen.getByRole('dialog', { name: /^Inject INJ-C01\b/ })
    fireEvent.change(within(dialog).getByLabelText('Inject text'), { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: /^5 Review/ }))
    expect(within(dialog).getByRole('switch', { name: 'Validated' })).toBeDisabled()
    expect(dialog).toHaveTextContent('Complete these steps to validate it: Context.')
  })

  it('times an inject from its phase’s start, and keeps that when it changes phase', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    const time = within(dialog).getByLabelText(/Session time \(minutes after the phase starts\)/)
    // INJ-01 is at T+00:20, in PH-01 (from T+00:00).
    expect(time).toHaveValue(20)
    // Where it lands, in the session and in the scenario (20 min a minute).
    expect(dialog).toHaveTextContent('T+00:20 in the session · +6 h 40 min in the scenario.')
    // PH-02 starts at T+01:30: 20 minutes into it.
    fireEvent.change(within(dialog).getByLabelText('Phase'), { target: { value: 'ph-2' } })
    expect(time).toHaveValue(20)
    expect(dialog).toHaveTextContent('T+01:50 in the session')
    fireEvent.change(time, { target: { value: '5' } })
    expect(dialog).toHaveTextContent('T+01:35 in the session')
  })

  it('attributes an inject’s techniques to a threat actor, its profile first', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^4 Whose activity/ }))
    expect(within(dialog).getByRole('radio', { name: /^A threat actor/ })).toBeChecked()
    expect(within(dialog).getByLabelText('Threat actor')).toHaveDisplayValue(
      'THR-01 | Nebula affiliate',
    )
    const choose = within(dialog).getByRole('button', { name: 'Choose techniques' })
    await waitFor(() => expect(choose).toBeEnabled())
    fireEvent.click(choose)

    const picker = screen.getByRole('dialog', { name: 'Choose ATT&CK techniques' })
    // The actor's tactics and techniques only, at first; no marks needed.
    const onlyTactics = within(picker).getByRole('checkbox', {
      name: 'Only Nebula affiliate’s tactics',
    })
    const onlyTechniques = within(picker).getByRole('checkbox', {
      name: 'Only Nebula affiliate’s techniques (2)',
    })
    expect(onlyTactics).toBeChecked()
    expect(onlyTechniques).toBeChecked()
    expect(picker).not.toHaveTextContent('★')
    const tactics = within(picker).getByRole('navigation', { name: 'Tactics' })
    // Tactics none of its techniques serve aren't listed.
    expect(within(tactics).queryByRole('button', { name: /Stealth/ })).toBeNull()
    fireEvent.click(within(tactics).getByRole('button', { name: /Initial Access/ }))
    expect(within(picker).queryByRole('checkbox', { name: /T1078 Valid Accounts/ })).toBeNull()
    // Its sub-technique stands on its own row, its parent isn't the actor's.
    expect(within(picker).queryByRole('checkbox', { name: /^T1566 Phishing$/ })).toBeNull()
    fireEvent.click(within(picker).getByRole('checkbox', { name: /Spearphishing Attachment/ }))
    // Every tactic, still only its techniques: one with none can't be opened.
    fireEvent.click(onlyTactics)
    expect(within(tactics).getByRole('button', { name: /Stealth/ })).toBeDisabled()
    // The whole matrix is one more click away.
    fireEvent.click(onlyTechniques)
    expect(within(tactics).getByRole('button', { name: /Stealth/ })).toBeEnabled()
    fireEvent.click(within(picker).getByRole('checkbox', { name: /T1566 Phishing/ }))
    expect(
      within(picker).getByRole('checkbox', { name: /T1078 Valid Accounts/ }),
    ).toBeInTheDocument()
    expect(within(picker).getByText('3 techniques selected')).toBeInTheDocument()
    fireEvent.click(within(picker).getByRole('button', { name: 'Apply' }))

    // T1566 itself isn't in the actor's profile: said next to it.
    const phishing = within(dialog)
      .getByRole('link', { name: /^T1566 Phishing/ })
      .closest('li')!
    expect(phishing).toHaveTextContent('not among Nebula affiliate’s scenario techniques')
    // One click puts it in the actor's profile, and the flag goes.
    fireEvent.click(
      within(phishing).getByRole('button', { name: 'Add to the scenario’s techniques' }),
    )
    expect(
      within(dialog)
        .getByRole('link', { name: /^T1566 Phishing/ })
        .closest('li'),
    ).not.toHaveTextContent('not among Nebula affiliate’s scenario techniques')

    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      const inject = JSON.parse(check![1]!.body as string).injects[0]
      expect(inject).toMatchObject({
        attack_attribution: 'threat_actor',
        threat_actor_key: 'thr-1',
      })
      expect(inject.attack_techniques).toEqual([
        { domain: 'enterprise', tactic_id: 'TA0040', technique_id: 'T1486' },
        { domain: 'enterprise', tactic_id: 'TA0001', technique_id: 'T1566.001' },
        { domain: 'enterprise', tactic_id: 'TA0001', technique_id: 'T1566' },
      ])
    })
  })

  it('makes an inject noise, or takes its ATT&CK away', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    let dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^4 Whose activity/ }))
    // An attack first (a threat actor, noise), then a parallel event.
    expect(
      within(dialog)
        .getAllByRole('radio')
        .map((radio) => radio.getAttribute('value')),
    ).toEqual(['threat_actor', 'noise', 'none'])
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Noise/ }))
    expect(dialog).toHaveTextContent('MITRE ATT&CK techniques (optional)')
    // Noise keeps the techniques, but no threat actor.
    expect(within(dialog).queryByLabelText('Threat actor')).toBeNull()
    expect(within(dialog).getByRole('link', { name: /T1486/ })).toBeInTheDocument()
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).injects[0]).toMatchObject({
        attack_attribution: 'noise',
        threat_actor_key: null,
      })
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close the inject' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit inject INJ-01' }))
    dialog = screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^4 Whose activity/ }))
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Not an attack/ }))
    expect(within(dialog).queryByRole('button', { name: 'Choose techniques' })).toBeNull()
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).injects[0]).toMatchObject({
        attack_attribution: null,
        attack_techniques: [],
      })
    })
  })

  it('lists the scenario’s threat actors and adds one from the library', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'GET /threat-actor-catalog': [
        json(200, {
          attack_version: '19.2',
          released: '2026-08-05',
          copyright: 'Copyright 2015-2026, The MITRE Corporation.',
          items: [
            {
              id: 'G0034',
              name: 'Sandworm Team',
              aliases: ['ELECTRUM'],
              techniques: [
                { domain: 'enterprise', technique_id: 'T1566.001' },
                // Not in the MSEL's release: left out of the copy.
                { domain: 'enterprise', technique_id: 'T9999' },
              ],
            },
          ],
        }),
      ],
      // Moved onto the MSEL's release by the backend: T9999 isn't in it.
      'POST /attack/19.2/threat-actor': [
        json(200, {
          mitre_group_id: 'G0034',
          techniques: [
            {
              domain: 'enterprise',
              technique_id: 'T1566.001',
              technique_name: 'Phishing: Spearphishing Attachment',
              tactic_ids: ['TA0001'],
            },
          ],
          conversion: { replaced: [], removed: ['T9999'] },
        }),
      ],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=threats')

    const section = await screen.findByRole('region', { name: 'Threat actors' })
    expect(within(section).getByText('Nebula affiliate')).toBeInTheDocument()
    // The scenario's techniques, folded, with what the injects already
    // exercise marked (an unknown actor: no MITRE total to compare with).
    expect(within(section).getByText('2 techniques')).toBeInTheDocument()
    expect(within(section).getByText('1 exercised')).toBeInTheDocument()
    expect(within(section).getByText('1 inject')).toBeInTheDocument()
    fireEvent.click(within(section).getByText('Show the scenario’s techniques'))
    const exercised = (await within(section).findByText('T1486')).closest('a')!
    expect(exercised).toHaveTextContent('exercised by an inject')

    fireEvent.click(within(section).getByRole('button', { name: 'Add from the library' }))
    const picker = screen.getByRole('dialog', { name: 'Add threat actors from the library' })
    fireEvent.change(within(picker).getByRole('searchbox'), { target: { value: 'electrum' } })
    fireEvent.click(
      await within(picker).findByRole('button', { name: 'Add Sandworm Team to the scenario' }),
    )
    fireEvent.click(within(picker).getByRole('button', { name: 'Done' }))

    expect(await within(section).findByText('Sandworm Team')).toBeInTheDocument()
    expect(screen.getByText('1 removed: T9999.')).toBeInTheDocument()
    // Out of the techniques MITRE documents for the group.
    expect(await within(section).findByText('1 of 2 techniques')).toBeInTheDocument()
    // It's the exercise's own copy: no origin badge on the card; its form
    // says what it was copied from, and that it hasn't changed since.
    expect(within(section).queryByText('TTX-Zone')).toBeNull()
    fireEvent.click(within(section).getByRole('button', { name: 'Edit Sandworm Team' }))
    const form = screen.getByRole('dialog', { name: 'Edit Sandworm Team' })
    expect(within(form).getByDisplayValue('TTX-Zone · Sandworm Team')).toBeInTheDocument()
    expect(within(form).getByText('Not modified since it was copied.')).toBeInTheDocument()
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).threat_actors.at(-1)).toMatchObject({
        name: 'Sandworm Team',
        mitre_group_id: 'G0034',
        origin: 'system',
        origin_id: 'G0034',
        techniques: [{ domain: 'enterprise', technique_id: 'T1566.001' }],
      })
    })
  })

  it('offers the newer ATT&CK release and reports what the upgrade changed', async () => {
    const upgraded = msel({ attack_version: '20.0', revision: 3 })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, { ...catalog, latest_version: '20.0' })],
      'GET /attack/20.0': [json(200, { ...catalog, version: '20.0', latest_version: '20.0' })],
      'POST /ttx/ttx-1/msel/attack-upgrade': [
        json(200, {
          msel: upgraded,
          replaced: [{ from_id: 'T1566', to_id: 'T1566.001' }],
          removed: ['T1490'],
        }),
      ],
    })
    renderPage('/creator/ttx-1/msel?tab=threats')

    expect(await screen.findByText('ATT&CK v20.0 is available')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update to v20.0' }))

    expect(
      await screen.findByText(
        'Updated to ATT&CK v20.0. 1 replaced: T1566 → T1566.001. 1 removed: T1490.',
      ),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/msel/attack-upgrade'),
      expect.objectContaining({ method: 'POST' }),
    )
    await waitFor(() =>
      expect(screen.queryByText('ATT&CK v20.0 is available')).not.toBeInTheDocument(),
    )
  })

  it('renumbers the phases in session order, and Undo puts the codes back', async () => {
    const gapped = msel({
      renumberable: ['phases'],
      phases: msel().phases.map((phase, index) => ({ ...phase, code: `PH-0${index + 2}` })),
    })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, gapped)],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/renumber': [
        json(200, { msel: msel(), previous: { 'ph-1': 'PH-02', 'ph-2': 'PH-03' } }),
        json(200, { msel: gapped, previous: { 'ph-1': 'PH-01', 'ph-2': 'PH-02' } }),
      ],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')

    // The code doesn't say where it falls in the session: the row does.
    expect(await screen.findByText('1 of 2 in the session')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reset phase codes to session order' }))

    expect(await screen.findByText('Codes renumbered in order.')).toBeInTheDocument()
    expect(screen.queryByText('1 of 2 in the session')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset phase codes to session order' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByText('Previous codes restored.')).toBeInTheDocument()
    const posts = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/msel/renumber'))
    expect(JSON.parse(posts[0][1]!.body as string)).toEqual({ kind: 'phases', codes: null })
    expect(JSON.parse(posts[1][1]!.body as string)).toEqual({
      kind: 'phases',
      codes: { 'ph-1': 'PH-02', 'ph-2': 'PH-03' },
    })
  })

  it('asks before renumbering an MSEL that was ready, naming its frozen versions', async () => {
    const gapped = msel({
      renumberable: ['phases'],
      frozen_versions: [
        { version: 1, ready_at: '2026-11-01T09:00:00Z', ready_by: 'Ana Planner', sessions: 2 },
      ],
      phases: msel().phases.map((phase, index) => ({ ...phase, code: `PH-1${index + 5}` })),
    })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, gapped)],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/renumber': [
        json(200, { msel: msel(), previous: { 'ph-1': 'PH-15', 'ph-2': 'PH-16' } }),
      ],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reset phase codes to session order' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Reset the phase codes of an MSEL that was ready before?'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/Version 1, ready on .* by Ana Planner/)).toBeInTheDocument()
    expect(within(dialog).getByText(/2 sessions played/)).toBeInTheDocument()
    expect(within(dialog).getByText(/the link between them is lost/)).toBeInTheDocument()
    const posts = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/msel/renumber'))
    expect(posts()).toHaveLength(0)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset codes anyway' }))
    expect(await screen.findByText('Codes renumbered in order.')).toBeInTheDocument()
    expect(JSON.parse(posts()[0][1]!.body as string)).toEqual({
      kind: 'phases',
      codes: null,
      confirm_frozen: true,
    })
  })

  it('asks the same before resetting the inject codes of an MSEL that was ready', async () => {
    const ready = msel({
      renumberable: ['injects'],
      frozen_versions: [
        { version: 2, ready_at: '2026-11-02T09:00:00Z', ready_by: 'Ana Planner', sessions: 0 },
      ],
    })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, ready)],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/renumber': [json(200, { msel: msel(), previous: {} })],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(
      await screen.findByRole('button', { name: 'Reset inject codes to storyline order' }),
    )
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText('Reset the inject codes of an MSEL that was ready before?'),
    ).toBeInTheDocument()
    expect(within(dialog).getByText(/Version 2, ready on .* by Ana Planner/)).toBeInTheDocument()
    expect(within(dialog).queryByText(/sessions? played/)).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reset codes anyway' }))
    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/msel/renumber'))
      expect(JSON.parse(posts[0][1]!.body as string)).toEqual({
        kind: 'injects',
        codes: null,
        confirm_frozen: true,
      })
    })
  })

  it('takes the session length in hours and saves it in minutes', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage()

    const hours = await screen.findByLabelText('Session length (hours)')
    expect(hours).toHaveValue('3')
    fireEvent.change(hours, { target: { value: '2,5' } })
    expect(hours).toHaveValue('2,5')
    expect(screen.getByText('Session', { selector: 'dt' }).nextElementSibling).toHaveTextContent(
      '2 h 30 min',
    )
    // Not a number: the keystroke is ignored.
    fireEvent.change(hours, { target: { value: '2,5h' } })
    expect(hours).toHaveValue('2,5')

    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).duration_minutes).toBe(150)
    })
  })

  it('suggests a phase per capability the objectives evaluate, with an Undo', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel({ phases: [], injects: [] }))],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')

    expect(
      await screen.findByText(/You need at least 2 so the scenario can evolve/),
    ).toBeInTheDocument()
    // Said before it's done: crisis moments, in the order a crisis goes through.
    expect(
      screen.getByText(/Coordinating across the group → Regulatory pressure\./),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Use suggested phases' }))

    for (const name of ['Coordinating across the group', 'Regulatory pressure']) {
      expect(screen.getByRole('cell', { name: new RegExp(name) })).toBeInTheDocument()
    }
    // The 3-hour session split evenly.
    expect(screen.getByText('T+00:00 – T+01:30')).toBeInTheDocument()
    expect(screen.getByText('T+01:30 – T+03:00')).toBeInTheDocument()
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      const phases = JSON.parse(check![1]!.body as string).phases
      expect(phases).toHaveLength(2)
      // Each with the objectives of its capability, and questions to adapt.
      expect(phases[0].objective_ids).toEqual(['obj-2'])
      expect(phases[1].objective_ids).toEqual(['obj-1'])
      expect(phases[1].key_questions).toContain(
        'Which notifications apply, and what is the deadline for each?',
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(await screen.findByRole('button', { name: 'Use suggested phases' })).toBeInTheDocument()
  })

  it('suggests the usual arc of an incident when the objectives evaluate one capability', async () => {
    const base = msel()
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            phases: [],
            injects: [],
            needs: { ...base.needs, objectives: [base.needs.objectives[0]] },
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')

    fireEvent.click(await screen.findByRole('button', { name: 'Use suggested phases' }))
    for (const name of ['Detection', 'Escalation', 'Response', 'Recovery']) {
      expect(screen.getByRole('cell', { name: new RegExp(name) })).toBeInTheDocument()
    }
    expect(screen.getByText('T+02:15 – T+03:00')).toBeInTheDocument()
  })

  it('adds a sender from the library inside the inject dialog', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'GET /actor-catalog': [
        json(200, {
          items: [
            {
              id: 'cyber-insurer',
              type: 'other',
              name_en: 'Cyber insurer',
              name_es: 'Aseguradora de ciberriesgo',
              description_en: 'The insurer.',
              description_es: 'La aseguradora.',
              channel: 'phone',
              default: false,
            },
          ],
        }),
      ],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = await screen.findByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^2 Source and audience/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add from the library' }))
    const picker = screen.getByRole('dialog', { name: 'Add actors from the library' })
    fireEvent.click(
      await within(picker).findByRole('button', { name: 'Add Cyber insurer to this exercise' }),
    )
    // Escape closes the picker, not the inject dialog it was opened from.
    fireEvent.keyDown(picker, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Add actors from the library' })).toBeNull()
    expect(screen.getByRole('dialog', { name: /^Inject INJ-01\b/ })).toBeInTheDocument()

    // The copy is the inject's sender now, with its usual channel.
    const sender = within(dialog).getByLabelText('Source') as HTMLSelectElement
    expect(sender.selectedOptions[0]).toHaveTextContent('Cyber insurer')
    // Into the MSEL at once: the cast gains the copy, the inject sends it.
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      const payload = JSON.parse(check![1]!.body as string)
      const added = payload.actors.at(-1)
      expect(payload.injects[0]).toMatchObject({ actor_key: added.key, delivery_method: 'phone' })
      expect(added).toMatchObject({
        name: 'Cyber insurer',
        channel: 'phone',
        origin: 'system',
        origin_id: 'cyber-insurer',
      })
    })
  })

  it("saves the inject's sender to the organization's library for a Program Manager", async () => {
    mockProgramManager = true
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /organizations/org-1/actors': [
        json(201, {
          id: 'org-actor-9',
          name: 'SOC',
          type: 'soc',
          description: '',
          channel: null,
          origin: 'exercise',
          origin_id: 'act-1',
          origin_name: 'SOC',
          created_at: '2026-10-25T10:00:00+00:00',
          updated_at: '2026-10-25T10:00:00+00:00',
        }),
      ],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = await screen.findByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^2 Source and audience/ }))
    fireEvent.click(
      within(dialog).getByRole('button', { name: "Save to the organization's library" }),
    )

    expect(await screen.findByText("SOC saved to the organization's library")).toBeInTheDocument()
    const [, post] = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/organizations/org-1/actors'),
    )!
    expect(JSON.parse(post!.body as string)).toMatchObject({ name: 'SOC', origin: 'exercise' })
    // The exercise's actor is a copy of the library one now (the autosave
    // keeps it), so the link is gone.
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      const payload = JSON.parse(check![1]!.body as string)
      expect(payload.actors[0]).toMatchObject({
        id: 'act-1',
        origin: 'organization',
        origin_id: 'org-actor-9',
      })
    })
    expect(
      within(dialog).queryByRole('button', { name: "Save to the organization's library" }),
    ).toBeNull()
  })

  it('labels a discussion inject in the list instead of leaving its objectives blank', async () => {
    const base = msel()
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            injects: base.injects.map((inject) =>
              inject.id === 'inj-2'
                ? { ...inject, code: 'DSC-02', format: 'discussion', objective_ids: [] }
                : inject,
            ),
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    const row = (await screen.findByRole('button', { name: 'Edit inject DSC-02' })).closest('tr')!
    expect(within(row).getByText('Discussion (not scored)')).toBeInTheDocument()
  })

  it('offers no save to the library to an Exercise Planner who is not a Program Manager', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(await screen.findByRole('button', { name: 'Edit inject INJ-01' }))
    const dialog = await screen.findByRole('dialog', { name: /^Inject INJ-01\b/ })
    fireEvent.click(within(dialog).getByRole('button', { name: /^2 Source and audience/ }))
    expect(within(dialog).getByRole('button', { name: 'Add from the library' })).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: "Save to the organization's library" }),
    ).toBeNull()
  })

  it('saves the draft by itself once the dry run clears it', async () => {
    const saved = msel({ revision: 3, title: 'Operation Dark Grid II' })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, saved)],
    })
    renderPage()

    fireEvent.change(await screen.findByLabelText('Scenario title'), {
      target: { value: 'Operation Dark Grid II' },
    })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument(), {
      timeout: 3000,
    })
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    const body = JSON.parse(put[1]!.body as string)
    expect(body.revision).toBe(2)
    expect(body.title).toBe('Operation Dark Grid II')
    expect(body.injects[0]).toMatchObject({
      id: 'inj-1',
      phase_key: 'ph-1',
      actor_key: 'act-1',
      expected_actions: [{ id: 'act-a1' }],
    })
  })

  it('holds the save while a removed inject can be brought back, and Undo restores it', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    fireEvent.click(await screen.findByRole('button', { name: 'Remove inject INJ-01' }))
    expect(screen.queryByRole('button', { name: 'Remove inject INJ-01' })).not.toBeInTheDocument()
    expect(screen.getByText('Inject INJ-01 removed')).toBeInTheDocument()

    // Past the dry run and the autosave delay: still nothing saved.
    await new Promise((resolve) => setTimeout(resolve, 1500))
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByRole('button', { name: 'Remove inject INJ-01' })).toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })

  it('does not autosave a draft the backend would refuse', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [
        json(200, {
          ...cleanReport,
          ready: [
            { code: 'UNKNOWN_OBJECTIVE', section: 3, field: 'objective_ids', item_id: 'inj-1' },
          ],
        }),
      ],
    })
    renderPage()

    fireEvent.change(await screen.findByLabelText('Scenario title'), {
      target: { value: 'Changed' },
    })

    expect(
      await screen.findByText(/Not saved: fix the issues/, {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('opens the inject the URL names, once', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects&inject=inj-1')

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByDisplayValue('Ransom note found')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('location')).not.toHaveTextContent('inject='))
  })

  it('keeps the inject filters in the URL', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')

    // The Injects tab's own list (the storyline strip above names injects too).
    const panel = within(await screen.findByRole('region', { name: 'Injects' }))
    expect(await panel.findByText('Ransom note found')).toBeInTheDocument()
    expect(panel.getByText('Journalist calls')).toBeInTheDocument()

    // The filters wait behind their button.
    expect(panel.queryByLabelText('Type')).toBeNull()
    fireEvent.click(panel.getByRole('button', { name: /^Filters/ }))
    fireEvent.change(panel.getByLabelText('Type'), { target: { value: 'contingent' } })

    expect(screen.getByTestId('location')).toHaveTextContent('kind=contingent')
    expect(panel.queryByText('Ransom note found')).not.toBeInTheDocument()
    expect(panel.getByText('Journalist calls')).toBeInTheDocument()
    expect(panel.getByText('1 inject', { selector: 'p' })).toBeInTheDocument()
    expect(panel.getByRole('button', { name: /^Filters/ })).toHaveTextContent('1')
    expect(panel.getByRole('list', { name: 'Filters in force' })).toHaveTextContent(
      'Type: Contingent',
    )

    // Clearing takes every filter away at once.
    fireEvent.change(panel.getByLabelText('Review'), { target: { value: 'draft' } })
    expect(screen.getByTestId('location')).toHaveTextContent('review=draft')
    fireEvent.click(panel.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByTestId('location')).not.toHaveTextContent('kind=')
    expect(screen.getByTestId('location')).not.toHaveTextContent('review=')
    expect(panel.getByText('Ransom note found')).toBeInTheDocument()
  })

  it('groups the injects by phase, objective, type or recipient', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=injects')
    const panel = within(await screen.findByRole('region', { name: 'Injects' }))
    const headings = () =>
      panel.getAllByRole('rowheader').map((cell) => cell.textContent?.replace(/\s+/g, ' '))
    await panel.findByText('Ransom note found')
    expect(headings()[0]).toMatch(/^PH-01\|, Detection/)

    fireEvent.click(
      within(panel.getByRole('group', { name: 'Group by' })).getByRole('button', { name: 'Type' }),
    )
    expect(screen.getByTestId('location')).toHaveTextContent('group=kind')
    expect(headings().map((h) => h?.replace(/\d+ injects?$/, ''))).toEqual([
      'Mandatory',
      'Contingent',
    ])
    // Each row says which objectives it evaluates, and its kind as a mark
    // (no Time or Type column).
    const row = panel.getByText('Ransom note found').closest('tr')!
    expect(row).toHaveTextContent('OBJ-01')
    expect(within(row).getByTitle('Mandatory')).toBeInTheDocument()
    expect(panel.queryByRole('columnheader', { name: 'Time' })).toBeNull()
    expect(panel.queryByRole('columnheader', { name: 'Type' })).toBeNull()
    // Grouped by objective, the Objectives column goes.
    fireEvent.click(
      within(panel.getByRole('group', { name: 'Group by' })).getByRole('button', {
        name: 'Objective',
      }),
    )
    expect(panel.queryByRole('columnheader', { name: 'Objectives' })).toBeNull()
  })

  it('still goes to the field when the entry is clicked the moment it appears', async () => {
    // A click between the page's first paint and its first effects must
    // not lose the focus to the tab being left (see the needs analysis).
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            validation: {
              ready: [{ code: 'MSEL_INCOMPLETE', section: 1, field: 'summary', item_id: null }],
              approved: [],
              warnings: [],
            },
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    const clicked = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        const entry = [...document.querySelectorAll('button')].find((button) =>
          button.textContent?.includes('Summary for Players is missing'),
        )
        if (!entry) return
        observer.disconnect()
        entry.click() // synchronously, before React flushes the mount effects
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    renderPage('/creator/ttx-1/msel?tab=review')
    await clicked

    const summary = await screen.findByLabelText('Summary for Players')
    await waitFor(() => expect(summary).toHaveFocus())
  })

  it('formats the Summary for Players: bold, italic and lists, with a preview', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=scenario')

    const summary = (await screen.findByLabelText('Summary for Players')) as HTMLTextAreaElement
    fireEvent.change(summary, { target: { value: 'A quiet Sunday' } })
    summary.setSelectionRange(2, 7)
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(summary).toHaveValue('A **quiet** Sunday')

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByText('quiet').tagName).toBe('STRONG')
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).summary).toBe('A **quiet** Sunday')
    })
  })

  it('opens the inject a summary entry points at, focused on the field', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            validation: {
              ready: [
                {
                  code: 'RECIPIENT_NOT_IN_SCOPE',
                  section: 3,
                  field: 'recipients',
                  item_id: 'inj-1',
                },
              ],
              approved: [],
              warnings: [],
            },
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()

    const summary = within(
      (await screen.findByRole('heading', { name: 'Validation' })).closest('section')!,
    )
    fireEvent.click(
      summary.getByRole('button', { name: /INJ-01 \|.*: an area in its audience isn/ }),
    )

    // Opened on the step that holds the field, focused on it.
    const dialog = await screen.findByRole('dialog', { name: /^Inject INJ-01\b/ })
    expect(within(dialog).getByRole('button', { name: /^2 Source and audience/ })).toHaveAttribute(
      'aria-current',
      'step',
    )
    expect(within(dialog).getByRole('group', { name: 'Audience' })).toHaveFocus()
    expect(screen.getByTestId('location')).toHaveTextContent('tab=injects')
  })

  it('marks objectives the injects leave uncovered', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=coverage')

    const table = await screen.findByRole('table')
    const row = within(table).getByText('OBJ-02').closest('tr')!
    expect(row).toHaveTextContent('No mandatory inject evaluates this objective.')
    expect(row.className).toContain('text-danger-fg')
    const covered = within(table).getByText('OBJ-01').closest('tr')!
    expect(covered).toHaveTextContent('2 inj. · 2 act.')
    expect(covered.className).not.toContain('text-danger-fg')
  })

  it('is read-only while the needs analysis is revised', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({ editable: false, needs: { ...msel().needs, status: 'draft', version: 2 } }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()

    expect(
      await screen.findByText('Read-only until the needs analysis is approved'),
    ).toBeInTheDocument()
    expect(screen.getByText(/Version 2 of the needs analysis is back in draft/)).toBeInTheDocument()
    expect(screen.getByLabelText('Scenario title')).toBeDisabled()
    expect(screen.queryByText('All changes saved')).not.toBeInTheDocument()
  })

  it('says inside an inject why it can’t be validated while read-only', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            editable: false,
            needs: { ...msel().needs, status: 'draft', version: 1 },
            validation: {
              ready: [],
              approved: [
                {
                  code: 'INJECT_NOT_VALIDATED',
                  section: 3,
                  field: 'review_status',
                  item_id: 'inj-1',
                },
              ],
              warnings: [],
            },
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()

    const summary = within(
      (await screen.findByRole('heading', { name: 'Validation' })).closest('section')!,
    )
    fireEvent.click(summary.getByRole('button', { name: /INJ-01 \|.*: not validated yet/ }))
    const dialog = await screen.findByRole('dialog', { name: /^Inject INJ-01\b/ })
    const notice = within(dialog).getByRole('status')
    expect(notice).toHaveTextContent('Read-only until the needs analysis is approved')
    expect(within(notice).getByRole('link', { name: 'Go to the approval' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/needs?step=approval',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: /Review/ }))
    expect(within(dialog).getByRole('switch', { name: 'Validated' })).toBeDisabled()
    expect(
      within(dialog).getByText('Can’t be validated while the MSEL is read-only.'),
    ).toBeInTheDocument()
  })

  it('says when the needs analysis only lacks its approval, and links to it', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            editable: false,
            needs: { ...msel().needs, status: 'ready_for_approval', version: 3 },
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()

    expect(
      await screen.findByText(
        /Version 3 of the needs analysis is ready for approval but not approved yet/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the approval' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/needs?step=approval',
    )
  })

  it('asks to confirm a new needs version, then acknowledges it', async () => {
    const synced = msel({ needs_form_version: 2, needs: { ...msel().needs, version: 2 } })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel({ needs: { ...msel().needs, version: 2 } }))],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/acknowledge-needs-version': [json(200, synced)],
    })
    // Said in Review only, where it's confirmed -- not on every tab.
    renderPage()
    await screen.findByRole('heading', { name: 'Validation' })
    expect(screen.queryByText('The needs analysis changed')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: /^Review/ }))

    expect(await screen.findByText('The needs analysis changed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'I’ve reviewed it' }))

    await waitFor(() =>
      expect(screen.queryByText('The needs analysis changed')).not.toBeInTheDocument(),
    )
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes('acknowledge-needs-version')),
    ).toBe(true)
  })

  it('lists three threat actors as rows, each opening its own techniques', async () => {
    const base = msel()
    const [actor] = base.threat_actors
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(200, {
          ...base,
          threat_actors: [
            actor,
            { ...actor, id: 'thr-2', code: 'THR-02', name: 'Second crew' },
            { ...actor, id: 'thr-3', code: 'THR-03', name: 'Third crew' },
          ],
        }),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=threats')

    const section = await screen.findByRole('region', { name: 'Threat actors' })
    const rows = ['Nebula affiliate', 'Second crew', 'Third crew'].map((name) =>
      within(section).getByText(name).closest('li')!,
    )
    expect(new Set(rows.map((row) => row.parentElement)).size).toBe(1)
    fireEvent.click(within(rows[1]).getByText('Show the scenario’s techniques'))
    expect(rows.map((row) => row.querySelector('details')!.open)).toEqual([false, true, false])
  })

  it('starts an actor with no scenario techniques small, with a call to choose them', async () => {
    const base = msel()
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(200, msel({ threat_actors: [{ ...base.threat_actors[0], techniques: [] }] })),
      ],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=threats')
    const section = await screen.findByRole('region', { name: 'Threat actors' })
    expect(within(section).getByText(/No techniques chosen yet\./)).toBeInTheDocument()
    // ATT&CK labels the injects: no way from here to turn tactics into phases.
    expect(screen.queryByRole('button', { name: /Propagate/ })).toBeNull()

    const choose = within(section).getByRole('button', {
      name: 'Choose Nebula affiliate’s techniques for the scenario',
    })
    await waitFor(() => expect(choose).toBeEnabled())
    fireEvent.click(choose)
    const picker = screen.getByRole('dialog', { name: 'Techniques of Nebula affiliate' })
    expect(within(picker).queryByRole('checkbox', { checked: true })).toBeNull()
    fireEvent.click(within(picker).getByRole('checkbox', { name: /T1566 Phishing/ }))
    fireEvent.click(within(picker).getByRole('button', { name: 'Apply' }))

    expect(await within(section).findByText('1 technique')).toBeInTheDocument()
  })

  it('ticks Review in green once the MSEL is ready', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel({ status: 'ready', validation: cleanReport }))],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()
    const tabs = within(await screen.findByRole('navigation', { name: 'MSEL sections' }))
    const review = tabs.getByRole('link', { name: /^Review/ })
    expect(review).toHaveTextContent('✓')
    expect(review.querySelector('.text-success-fg')).not.toBeNull()
  })

  it('says what blocks the next step only while the button is disabled', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=review')

    expect(await screen.findByRole('button', { name: 'Submit for review' })).toBeDisabled()
    expect(screen.getByText(/Submitting needs every issue fixed/)).toBeInTheDocument()
    expect(screen.queryByText(/No blocking issues/)).not.toBeInTheDocument()
  })

  it('says who marked the MSEL ready', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(
          200,
          msel({
            status: 'ready',
            validation: cleanReport,
            ready_by: 'Ada Manager',
            ready_by_id: 'u1',
            ready_at: '2026-10-03T08:00:00+00:00',
          }),
        ),
      ],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/msel?tab=review')

    expect(await screen.findByText(/Marked ready by Ada Manager/)).toBeInTheDocument()
  })

  it('submits a valid MSEL for review', async () => {
    const valid = msel({ validation: cleanReport })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, valid)],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/transitions': [json(200, { ...valid, status: 'in_review' })],
    })
    renderPage('/creator/ttx-1/msel?tab=review')

    // Nothing blocks it: says so instead of the requirement.
    expect(
      await screen.findByText(
        /No blocking issues and every mandatory inject is validated: you can submit/,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Submitting needs every issue fixed/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))

    expect(await screen.findByText('MSEL submitted for review')).toBeInTheDocument()
    expect(await screen.findByText(/you can mark it as ready/)).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('transitions'))!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ to: 'in_review' })
    expect(refresh).toHaveBeenCalled()
  })
})

/** A new inject opens on what it is. */
async function chooseFormat(name: RegExp) {
  const chooser = await screen.findByRole('dialog', { name: 'What do you want to add?' })
  fireEvent.click(within(chooser).getByRole('button', { name }))
}

describe('the storyline strip', () => {
  function stub(overrides: Partial<Msel> = {}) {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel(overrides))],
      'GET /attack/19.2': [json(200, catalog)],
    })
  }
  const strip = () => screen.findByRole('region', { name: 'Storyline' })
  const branchLabel =
    'INJ-C01, contingent: branches off INJ-01, doesn’t come back. Journalist calls'

  it('says where two phases overlap, in the warning and on the map', async () => {
    const base = msel()
    stub({
      phases: [
        { ...base.phases[0], end_offset: 105 },
        { ...base.phases[1], start_offset: 85, end_offset: 160 },
      ],
      validation: {
        ready: [],
        approved: [],
        warnings: [
          { code: 'PHASES_OVERLAP', section: 2, field: 'start_offset', item_id: 'ph-2' },
          { code: 'SESSION_END_UNCOVERED', section: 2, field: 'end_offset', item_id: 'ph-2' },
        ],
      },
    })
    renderPage('/creator/ttx-1/msel?tab=phases')

    const region = await strip()
    expect(
      within(region).getByText(
        'PH-01 | Detection and PH-02 | Escalation overlap from T+01:25 to T+01:45',
      ),
    ).toBeInTheDocument()
    const review = screen.getByRole('status', { name: 'Worth reviewing in this section' })
    // Both about PH-02: grouped under it, each line without its name.
    expect(review).toHaveTextContent('PH-02 | Escalation (2)')
    expect(review).toHaveTextContent(
      'Starts at T+01:25, but PH-01 | Detection runs until T+01:45: both phases take the same 20 min of session.',
    )
    expect(review).toHaveTextContent(
      'The last phase, ends at T+02:40 and the session at T+03:00: the last 20 min have no phase.',
    )
  })

  it('unfolds when going to Phases with none yet, without remembering it', async () => {
    localStorage.setItem('ttx_msel_storyline_strip', 'closed')
    stub({ phases: [], injects: [] })
    renderPage('/creator/ttx-1/msel?tab=scenario')

    const region = await strip()
    expect(within(region).getByRole('button', { name: 'Show' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'MSEL sections' })).getByRole('link', {
        name: /^Phases/,
      }),
    )
    expect(await within(region).findByRole('button', { name: 'Hide' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(localStorage.getItem('ttx_msel_storyline_strip')).toBe('closed')
    localStorage.removeItem('ttx_msel_storyline_strip')
  })

  it('sits above every tab, drawing the branches with their names', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=phases')

    const region = await strip()
    expect(region).toHaveTextContent('1 mandatory inject · 1 branch')
    expect(region).toHaveTextContent('INJ-01')
    // Code + the first 8 characters of the title; the rest is in its label.
    expect(region).toHaveTextContent('INJ-01 Ransom n…')
    expect(region).toHaveTextContent('INJ-C01 Journali…')
    expect(region).not.toHaveTextContent('Journalist calls')
    expect(within(region).getByLabelText(branchLabel)).toBeInTheDocument()
  })

  it("opens a mark's inject right there, from its menu", async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=scenario')

    const region = await strip()
    fireEvent.click(within(region).getByLabelText(branchLabel))
    fireEvent.click(within(region).getByRole('button', { name: 'Open INJ-C01' }))

    expect(await screen.findByRole('dialog', { name: /^Inject INJ-C01\b/ })).toBeInTheDocument()
    expect(screen.getByLabelText(/Branches off/)).toHaveValue('inj-1')
    expect(screen.getByLabelText(/Fires if not observed/)).toHaveValue('act-a1')
    // Still on the tab it was opened from.
    expect(screen.getByTestId('location')).toHaveTextContent('tab=scenario')
  })

  it('drags a mandatory inject along the storyline, with an Undo', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    // The drawing spans 0-1000 px for the 180-minute session.
    const box = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 1000, height: 100 } as DOMRect)
    renderPage('/creator/ttx-1/msel?tab=scenario')
    const region = await strip()
    const mark = within(region).getByLabelText(/^INJ-01 at /)

    // A press without moving is still a click: the menu opens.
    fireEvent.pointerDown(mark, { button: 0, pointerId: 1, clientX: 111, clientY: 60 })
    fireEvent.pointerUp(mark, { button: 0, pointerId: 1, clientX: 111, clientY: 60 })
    fireEvent.click(mark)
    expect(within(region).getByRole('button', { name: 'Open INJ-01' })).toBeInTheDocument()
    fireEvent.click(mark)

    // Dragged to x=500: T+01:30, which PH-02 holds.
    fireEvent.pointerDown(mark, { button: 0, pointerId: 1, clientX: 111, clientY: 60 })
    fireEvent.pointerMove(mark, { pointerId: 1, clientX: 500, clientY: 60 })
    fireEvent.pointerUp(mark, { pointerId: 1, clientX: 500, clientY: 60 })
    expect(await screen.findByText('INJ-01 moved. Its times are updated.')).toBeInTheDocument()
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).injects[0]).toMatchObject({
        offset_minutes: 90,
        phase_key: 'ph-2',
      })
    })
    box.mockRestore()
  })

  it('edits the phase boxes on the map, in the Phases tab only', async () => {
    const base = msel()
    const fetchMock = stubApi({
      // PH-02 ends at T+02:30: half an hour of session is free.
      'GET /ttx/ttx-1/msel': [
        json(200, msel({ phases: [base.phases[0], { ...base.phases[1], end_offset: 150 }] })),
      ],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    const box = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 1800, height: 100 } as DOMRect)
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()

    // Each phase has a grip on each edge, each at its own place.
    const grips = region.querySelectorAll<HTMLElement>('.cursor-ew-resize')
    expect(grips).toHaveLength(4)
    const lefts = [...grips].map((grip) => grip.style.left)
    expect(lefts.every(Boolean)).toBe(true)
    expect(new Set(lefts).size).toBe(4)

    // The name row opens its menu: PH-01 has injects, so it can't go.
    const ph1 = within(region).getByLabelText(/^Phase PH-01 \| Detection/)
    fireEvent.click(ph1)
    const menu = within(ph1.closest('details')!)
    expect(menu.getByRole('button', { name: /^Delete phase/ })).toBeDisabled()
    fireEvent.click(menu.getByRole('button', { name: 'Edit phase…' }))
    expect(await screen.findByRole('dialog', { name: /^Phase PH-01\b/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    // Free session time offers a new phase there.
    fireEvent.click(
      within(region).getByRole('button', { name: 'New phase from T+02:30 to T+03:00' }),
    )
    const dialog = await screen.findByRole('dialog', { name: 'New phase' })
    expect(within(dialog).getByLabelText(/Session starts at/)).toHaveValue(150)
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    // 1800 px for 180 min: dragging PH-02's name 150 px moves it 15 min, to
    // start at T+01:45.
    const ph2 = within(region).getByLabelText(/^Phase PH-02 \| Escalation/)
    fireEvent.pointerDown(ph2, { button: 0, pointerId: 1, clientX: 900, clientY: 5 })
    fireEvent.pointerMove(ph2, { pointerId: 1, clientX: 1050, clientY: 5 })
    fireEvent.pointerUp(ph2, { pointerId: 1, clientX: 1050, clientY: 5 })
    expect(
      await screen.findByText('PH-02 | Escalation moved, with its injects.'),
    ).toBeInTheDocument()
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).phases[1]).toMatchObject({
        start_offset: 105,
        end_offset: 165,
      })
    })
    box.mockRestore()
  })

  it('undoes phase changes step by step, back to the original', async () => {
    const base = msel()
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [
        json(200, msel({ phases: [base.phases[0], { ...base.phases[1], end_offset: 150 }] })),
      ],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    const box = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 1800, height: 100 } as DOMRect)
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()
    // The boxes say they can be edited here.
    expect(within(region).getByText('Editing phases')).toBeInTheDocument()
    expect(region.querySelectorAll('[data-editable="true"]')).toHaveLength(2)
    const undo = () => within(region).getByRole('button', { name: /^Undo the last phase change/ })
    const revert = () => within(region).getByRole('button', { name: 'Revert to original' })
    expect(undo()).toBeDisabled()
    expect(revert()).toBeDisabled()

    const drag = (from: number) => {
      const ph2 = within(region).getByLabelText(/^Phase PH-02 \| Escalation/)
      fireEvent.pointerDown(ph2, { button: 0, pointerId: 1, clientX: from, clientY: 5 })
      fireEvent.pointerMove(ph2, { pointerId: 1, clientX: from + 150, clientY: 5 })
      fireEvent.pointerUp(ph2, { pointerId: 1, clientX: from + 150, clientY: 5 })
    }
    const lastPhase2 = () => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      return JSON.parse(check![1]!.body as string).phases[1]
    }
    drag(900)
    drag(1050)
    expect(undo()).toHaveAccessibleName('Undo the last phase change (2 steps)')
    await waitFor(() => expect(lastPhase2()).toMatchObject({ start_offset: 120 }))

    fireEvent.click(undo())
    expect(await screen.findByText('Phase change undone')).toBeInTheDocument()
    expect(undo()).toHaveAccessibleName('Undo the last phase change (1 step)')
    await waitFor(() => expect(lastPhase2()).toMatchObject({ start_offset: 105 }))

    // Back to how the phases were when the tab was opened, once confirmed.
    fireEvent.click(revert())
    const dialog = await screen.findByRole('dialog', { name: 'Revert the phases?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revert to original' }))
    expect(await screen.findByText('Phases put back as they were')).toBeInTheDocument()
    expect(undo()).toBeDisabled()
    expect(revert()).toBeDisabled()
    box.mockRestore()
  })

  it('forgets the phase history when leaving the Phases tab', async () => {
    const base = msel()
    stubApi({
      'GET /ttx/ttx-1/msel': [
        json(200, msel({ phases: [base.phases[0], { ...base.phases[1], end_offset: 150 }] })),
      ],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    const box = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ left: 0, top: 0, width: 1800, height: 100 } as DOMRect)
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()
    const ph2 = within(region).getByLabelText(/^Phase PH-02 \| Escalation/)
    fireEvent.pointerDown(ph2, { button: 0, pointerId: 1, clientX: 900, clientY: 5 })
    fireEvent.pointerMove(ph2, { pointerId: 1, clientX: 1000, clientY: 5 })
    fireEvent.pointerUp(ph2, { pointerId: 1, clientX: 1000, clientY: 5 })
    expect(
      within(region).getByRole('button', { name: /^Undo the last phase change/ }),
    ).toBeEnabled()

    // The draft is unsaved for a moment: leaving the tab asks first.
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('link', { name: /^Injects/ }))
    await waitFor(() => expect(within(region).queryByText('Editing phases')).toBeNull())
    expect(region.querySelector('[data-editable="true"]')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: /^Phases/ }))
    expect(
      await within(region).findByRole('button', { name: /^Undo the last phase change/ }),
    ).toBeDisabled()
    confirm.mockRestore()
    box.mockRestore()
  })

  it('leaves the phase boxes alone outside the Phases tab', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=injects')
    const region = await strip()
    expect(within(region).queryByLabelText(/^Phase PH-01/)).toBeNull()
  })

  it('starts a branch from a mark, added once it has a title', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=scenario')
    const region = await strip()
    const branches = () => within(region).getAllByLabelText(/, contingent: branches off/).length
    const branchFromFirst = () => {
      fireEvent.click(
        within(region).getByLabelText('INJ-01 at scenario +6 h 40 min: Ransom note found'),
      )
      fireEvent.click(within(region).getByRole('button', { name: 'New branch from INJ-01' }))
    }

    branchFromFirst()
    await chooseFormat(/^Inject/)
    let dialog = await screen.findByRole('dialog', { name: 'New inject' })
    expect(within(dialog).getByRole('radio', { name: /^Contingent/ })).toBeChecked()
    expect(within(dialog).getByLabelText(/Branches off/)).toHaveValue('inj-1')
    // Closed with nothing typed: nothing added.
    fireEvent.click(within(dialog).getByRole('button', { name: /^5 Review/ }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(branches()).toBe(1)

    branchFromFirst()
    await chooseFormat(/^Inject/)
    dialog = await screen.findByRole('dialog', { name: 'New inject' })
    fireEvent.change(within(dialog).getByLabelText('Title'), {
      target: { value: 'Journalist calls back' },
    })
    await waitFor(() => expect(branches()).toBe(2))
    // A new inject can be discarded again.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard inject' }))
    await waitFor(() => expect(branches()).toBe(1))
  })

  it('keeps how-to in a "?" note rather than on screen', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=scenario')

    const region = await strip()
    const note = 'Click the storyline to add an inject at that time.'
    expect(within(region).getByText(new RegExp(note))).not.toBeVisible()
    fireEvent.click(within(region).getByLabelText('How to edit the storyline'))
    expect(within(region).getByText(new RegExp(note))).toBeVisible()
  })

  it('adds a mandatory inject from its button', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=scenario')

    fireEvent.click(within(await strip()).getByRole('button', { name: 'Add an inject' }))
    await chooseFormat(/^Inject/)

    const dialog = await screen.findByRole('dialog', { name: 'New inject' })
    expect(within(dialog).getByRole('radio', { name: /^Mandatory/ })).toBeChecked()
  })

  it('asks what a new inject is, and a poll gets its own steps', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=scenario')

    fireEvent.click(within(await strip()).getByRole('button', { name: 'Add an inject' }))
    await chooseFormat(/^Poll/)

    const dialog = await screen.findByRole('dialog', { name: 'New inject' })
    const steps = within(dialog).getByRole('navigation', { name: 'Inject sections' })
    expect(within(steps).queryByRole('button', { name: /Evaluation/ })).toBeNull()
    expect(within(steps).queryByRole('button', { name: /Source and audience/ })).toBeNull()
    expect(within(dialog).getByLabelText(/Context for the table/)).toBeInTheDocument()

    fireEvent.click(within(steps).getByRole('button', { name: /^2 Question and options/ }))
    expect(within(dialog).getByLabelText('Question')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Option A')).toBeInTheDocument()
    expect(within(dialog).getByLabelText('Option B')).toBeInTheDocument()
    expect(within(dialog).getByText('Write the question.')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add option' }))
    fireEvent.change(within(dialog).getByLabelText('Option C'), { target: { value: 'Wait' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move option C up' }))
    expect(within(dialog).getByLabelText('Option B')).toHaveValue('Wait')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove option C' }))
    expect(within(dialog).queryByLabelText('Option C')).toBeNull()
    // Two options is the least a poll takes.
    expect(within(dialog).getByRole('button', { name: 'Remove option B' })).toBeDisabled()
  })

  it('renames the Evaluation step of a discussion inject', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=scenario')

    fireEvent.click(within(await strip()).getByRole('button', { name: 'Add an inject' }))
    await chooseFormat(/^Discussion/)

    const dialog = await screen.findByRole('dialog', { name: 'New inject' })
    fireEvent.click(within(dialog).getByRole('button', { name: /^3 Discussion points/ }))
    expect(within(dialog).queryByRole('group', { name: 'Objectives' })).toBeNull()
  })

  it('sends the old storyline map tab to Injects', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=timeline')
    expect(await screen.findByRole('region', { name: 'Injects' })).toBeInTheDocument()
  })

  it("dims what the Injects tab's filters leave out", async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=injects&kind=contingent')

    const region = await strip()
    const mark = (label: string | RegExp) => within(region).getByLabelText(label).closest('details')
    expect(mark('INJ-01 at scenario +6 h 40 min: Ransom note found')).toHaveAttribute(
      'data-dimmed',
      'true',
    )
    expect(mark(/^INJ-C01, contingent/)).not.toHaveAttribute('data-dimmed', 'true')
  })

  it('folds with its chevron, and remembers it in this browser', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=phases')

    const region = await strip()
    fireEvent.click(within(region).getByRole('button', { name: 'Hide' }))
    expect(within(region).getByRole('button', { name: 'Show' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(localStorage.getItem('ttx_msel_storyline_strip')).toBe('closed')
    localStorage.removeItem('ttx_msel_storyline_strip')
  })

  it('is pinned to the top of the screen by default; unpinning is remembered', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()
    expect(region).toHaveClass('sticky', 'top-0')
    expect(within(region).getByRole('button', { name: 'Unpin' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // Maximized it lies over the page instead; restored, it's pinned again.
    fireEvent.click(within(region).getByRole('button', { name: 'Maximize' }))
    expect(region).toHaveClass('fixed')
    expect(region).not.toHaveClass('sticky')
    fireEvent.click(within(region).getByRole('button', { name: 'Restore' }))
    expect(region).toHaveClass('sticky')

    fireEvent.click(within(region).getByRole('button', { name: 'Unpin' }))
    expect(region).not.toHaveClass('sticky')
    expect(localStorage.getItem('ttx_msel_storyline_pinned')).toBe('unpinned')
    fireEvent.click(within(region).getByRole('button', { name: 'Pin to the top' }))
    expect(region).toHaveClass('sticky')
    expect(localStorage.getItem('ttx_msel_storyline_pinned')).toBe('pinned')
    localStorage.removeItem('ttx_msel_storyline_pinned')
  })

  it('maximizes over the page and comes back exactly as it was', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()
    // Folded first: maximizing shows it anyway, restoring folds it again.
    fireEvent.click(within(region).getByRole('button', { name: 'Hide' }))

    fireEvent.click(within(region).getByRole('button', { name: 'Maximize' }))

    expect(region).toHaveClass('fixed')
    expect(within(region).getByLabelText(/^INJ-C01, contingent/)).toBeVisible()
    // Room for longer titles.
    expect(region).toHaveTextContent('INJ-C01 Journalist calls')
    expect(document.body.style.overflow).toBe('hidden')
    // Focus moves into it, and Tab past its last control wraps inside it.
    expect(region).toHaveFocus()
    const controls = region.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    )
    controls[controls.length - 1].focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(controls[0]).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(region).not.toHaveClass('fixed')
    expect(within(region).getByRole('button', { name: 'Show' })).toBeInTheDocument()
    // Back on the button that maximized it.
    expect(within(region).getByRole('button', { name: 'Maximize' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    localStorage.removeItem('ttx_msel_storyline_strip')
  })

  it('fixes an overlap in one click, with an Undo', async () => {
    const base = msel()
    const overlapping = msel({
      phases: [
        { ...base.phases[0], end_offset: 105 },
        { ...base.phases[1], start_offset: 85, end_offset: 160 },
      ],
      validation: {
        ready: [],
        approved: [],
        warnings: [{ code: 'PHASES_OVERLAP', section: 2, field: 'start_offset', item_id: 'ph-2' }],
      },
    })
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, overlapping)],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, overlapping)],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')
    const row = async () => screen.findByRole('row', { name: /Escalation/ })

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Start PH-02 | Escalation at T+01:45, when PH-01 | Detection ends (the later phases move too)',
      }),
    )
    expect(await row()).toHaveTextContent('T+01:45 – T+03:00')
    const toast = await screen.findByText(/^Done: Start PH-02 \| Escalation at T\+01:45/)
    fireEvent.click(
      within(toast.closest('[role="status"]') as HTMLElement).getByRole('button', { name: 'Undo' }),
    )
    expect(await row()).toHaveTextContent('T+01:25 – T+02:40')
  })

  it('asks whether the later phases move when a phase grows', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')
    fireEvent.click(await screen.findByRole('button', { name: 'Edit phase PH-01' }))
    const dialog = screen.getByRole('dialog', { name: /^Phase PH-01\b/ })
    fireEvent.change(within(dialog).getByLabelText(/Session duration/), {
      target: { value: '60' },
    })
    // Pushed by default: PH-02 moves back 30 min with its injects.
    expect(within(dialog).getByRole('radio', { name: /Move them with this phase/ })).toBeChecked()
    expect(dialog).toHaveTextContent('This phase moves −30 min with its injects:')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('row', { name: /Escalation/ })).toHaveTextContent(
      'T+01:00 – T+02:30',
    )
  })

  it('jumps scenario time forward as a phase opens', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
      'POST /ttx/ttx-1/msel/validate': [json(200, cleanReport)],
      'PUT /ttx/ttx-1/msel': [json(200, msel())],
    })
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()

    // The phase at T+0 opens the incident: nothing to jump from.
    fireEvent.click(await screen.findByRole('button', { name: 'Edit phase PH-01' }))
    let dialog = screen.getByRole('dialog', { name: /^Phase PH-01\b/ })
    expect(within(dialog).queryByLabelText(/Scenario time jump before this phase/)).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))

    fireEvent.click(screen.getByRole('button', { name: 'Edit phase PH-02' }))
    dialog = screen.getByRole('dialog', { name: /^Phase PH-02\b/ })
    fireEvent.change(within(dialog).getByLabelText(/Scenario time jump before this phase/), {
      target: { value: '48' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }))

    // In the phases table and on the phase's band in the storyline.
    expect(
      within(screen.getByRole('row', { name: /Escalation/ })).getByText(
        '2 d later in the scenario',
      ),
    ).toBeInTheDocument()
    // On the band, and on the storyline's "⋯" break where the phase opens.
    expect(within(region).getAllByText('2 d later in the scenario')).toHaveLength(2)
    // At 20 min a minute: INJ-01 (T+00:20) is 6 h 40 min in; past PH-02's
    // start (T+01:30) the 2 days count too -- PH-02 opens 30 h + 2 d in,
    // labelled on the axis, and T+02:05 is 41 h 40 min + 2 d.
    expect(region).toHaveTextContent('+6 h 40 min')
    expect(region).toHaveTextContent('+3 d 6 h')
    expect(region).toHaveTextContent('+4 d 12 h')
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string).phases[1].incident_jump_minutes).toBe(2880)
    })
  })

  it('reads in incident time, with the time of day once the scenario has a start', async () => {
    stub({ incident_start: '06:45:00' })
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()
    // The axis times the start, the end and each inject -- INJ-01 at T+00:20
    // is 6 h 40 min into a scenario that starts at 06:45.
    expect(region).toHaveTextContent('+06:45 am')
    expect(region).toHaveTextContent('+6 h 40 min1:25 pm')
    expect(region).not.toHaveTextContent('(1:25 pm)')
    expect(region).toHaveTextContent('+2 d 12 h6:45 pm')
    expect(
      within(region).getByLabelText('INJ-01 at scenario +6 h 40 min · 1:25 pm: Ransom note found'),
    ).toBeInTheDocument()
    // Session time is for running the session: hidden by default.
    expect(region).not.toHaveTextContent('T+00:20')
  })

  it('shows the legend by default, and hides it on request', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()
    const toggle = within(region).getByRole('button', { name: 'Hide the legend' })
    // On: the accent, on a tint.
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveClass('text-accent-fg')
    expect(region).toHaveTextContent('Mandatory inject (the storyline)')

    fireEvent.click(toggle)

    expect(region).not.toHaveTextContent('Mandatory inject (the storyline)')
    expect(within(region).getByRole('button', { name: 'Show the legend' })).not.toHaveClass(
      'text-accent-fg',
    )
    expect(localStorage.getItem('ttx_msel_storyline_legend')).toBe('hidden')
    localStorage.removeItem('ttx_msel_storyline_legend')
  })

  it('shows session time on request, and remembers it in this browser', async () => {
    stub()
    renderPage('/creator/ttx-1/msel?tab=phases')
    const region = await strip()
    expect(region).not.toHaveTextContent('T+00:20')

    fireEvent.click(within(region).getByRole('button', { name: 'Show session time' }))

    // Under INJ-01: scenario time, then T+ and the meeting's clock (09:30 + 20).
    expect(region).toHaveTextContent('+6 h 40 minT+00:209:50 am')
    expect(
      within(region).getByLabelText(
        'INJ-01 at scenario +6 h 40 min · T+00:20 · 9:50 am: Ransom note found',
      ),
    ).toBeInTheDocument()
    expect(localStorage.getItem('ttx_msel_storyline_session')).toBe('shown')
    fireEvent.click(within(region).getByRole('button', { name: 'Hide session time' }))
    expect(region).not.toHaveTextContent('T+00:20')
    localStorage.removeItem('ttx_msel_storyline_session')
  })

  it('says what to do next while there is nothing to draw', async () => {
    stub({ duration_minutes: null })
    renderPage('/creator/ttx-1/msel?tab=scenario')

    expect(await strip()).toHaveTextContent(
      'Set the session duration in Scenario to draw the storyline.',
    )
  })
})

describe('MSEL downloads', () => {
  it('offers the full MSEL once it has no errors, and points to the session documents', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel({ validation: cleanReport }))],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()

    expect(await screen.findByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/msel/export/msel.pdf?lang=en',
    )
    expect(
      screen.getByRole('link', {
        name: 'SitMan, guides, inject cards and EEGs: in the Session plan →',
      }),
    ).toHaveAttribute('href', '/creator/ttx-1/conduct-prep?step=documents')
  })

  it('keeps the downloads disabled while the MSEL has errors', async () => {
    stubApi({
      'GET /ttx/ttx-1/msel': [json(200, msel())],
      'GET /attack/19.2': [json(200, catalog)],
    })
    renderPage()

    expect(await screen.findByRole('button', { name: 'Download PDF' })).toBeDisabled()
    expect(screen.getByText('Fix the MSEL’s issues first.')).toBeInTheDocument()
  })
})

describe('MSEL draft', () => {
  it('sends new rows without ids and links them by key', () => {
    const draft = draftFromMsel(msel())
    const phaseKey = newMselKey()
    draft.phases.push({ ...draft.phases[0], id: null, key: phaseKey, code: '' })
    draft.injects.push({
      ...draft.injects[0],
      id: null,
      key: newMselKey(),
      code: '',
      phase_key: phaseKey,
      expected_actions: [],
    })

    const payload = payloadFromDraft(draft, 2)

    expect(payload.phases[2]).toMatchObject({ id: null, key: phaseKey })
    expect(payload.injects[2]).toMatchObject({ id: null, phase_key: phaseKey })
    expect(payload.exercise_start).toBe('09:30')
    expect('code' in payload.injects[0]).toBe(false)
  })

  it('keeps the sent keys after a save, with the ids the server gave', () => {
    const sent = draftFromMsel(msel())
    sent.phases[0] = { ...sent.phases[0], key: 'new-9' }
    sent.injects[0] = { ...sent.injects[0], phase_key: 'new-9' }

    const saved = reconcileSaved(sent, msel())

    expect(saved.phases[0]).toMatchObject({ id: 'ph-1', key: 'new-9' })
    expect(saved.injects[0].phase_key).toBe('new-9')
  })

  it('names branches by the keys the page uses once a save lands', () => {
    const sent = draftFromMsel(msel())
    sent.injects[0] = {
      ...sent.injects[0],
      key: 'new-1',
      expected_actions: [{ ...sent.injects[0].expected_actions[0], key: 'new-2' }],
    }
    sent.injects[1] = { ...sent.injects[1], branch_from_key: 'new-1', branch_action_key: 'new-2' }

    const saved = reconcileSaved(sent, msel())

    expect(saved.injects[1]).toMatchObject({ branch_from_key: 'new-1', branch_action_key: 'new-2' })
    expect(payloadFromDraft(saved, 3).injects[0].expected_actions[0].key).toBe('new-2')
  })

  it('formats offsets on the session clock', () => {
    expect(formatOffset(65)).toBe('T+01:05')
    expect(formatOffset(0)).toBe('T+00:00')
    expect(clockAt('09:30', 35)).toBe('10:05')
    expect(clockAt('23:30', 45)).toBe('00:15')
    expect(formatOffsetAt(35, '09:30')).toBe('T+00:35 · 10:05 am')
    expect(formatClock('00:15')).toBe('12:15 am')
    expect(formatClock('12:00')).toBe('12:00 pm')
    expect(formatClock('18:45')).toBe('6:45 pm')
    expect(formatOffsetAt(35, '')).toBe('T+00:35')
    // A 24-hour locale keeps the clock as it is.
    expect(formatClock('18:45', 'es')).toBe('18:45')
    expect(formatOffsetAt(35, '09:30', 'es')).toBe('T+00:35 · 10:05')
    // Incident time: the compression, plus each started phase's time jump
    // (none for a phase at T+0).
    const phases = [
      { start_offset: 0, incident_jump_minutes: 600 },
      { start_offset: 60, incident_jump_minutes: 720 },
    ] as MselDraft['phases']
    expect(incidentMinutesAt({ phases, time_compression: 20 }, 30)).toBe(600)
    expect(incidentMinutesAt({ phases, time_compression: 20 }, 60)).toBe(1200 + 720)
    expect(formatIncident(400)).toBe('+6 h 40 min')
    expect(formatIncident(1920)).toBe('+1 d 8 h')
    expect(formatIncident(0)).toBe('+0')
    expect(formatOffset(null)).toBe('—')
  })
})

describe('CreatorDesignGate and the MSEL', () => {
  it('lets an existing MSEL through while the needs analysis is revised', () => {
    mockTtxList = [{ id: 'ttx-1', needs_form_status: 'draft', msel_status: 'ready' }]
    render(
      <MemoryRouter initialEntries={['/creator/ttx-1/msel']}>
        <Routes>
          <Route
            path="/creator/:ttxId/:section"
            element={
              <CreatorDesignGate>
                <p>MSEL editor</p>
              </CreatorDesignGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('MSEL editor')).toBeInTheDocument()
  })
})
