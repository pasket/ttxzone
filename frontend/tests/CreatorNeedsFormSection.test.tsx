import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreatorDesignGate } from '../src/components/creator/CreatorDesignGate'
import { CreatorNeedsFormSection } from '../src/components/creator/needs/CreatorNeedsFormSection'
import { TlpBadge } from '../src/components/common/TlpBadge'
import { draftFromForm, payloadFromDraft } from '../src/lib/needsForm'
import { traceabilityRows } from '../src/lib/needsFormOutputs'
import { splitAcronyms } from '../src/lib/glossary'
import type { NeedsForm, RegulatoryFramework } from '../src/lib/types'
import { render } from './testUtils'

let mockTtxList: Record<string, unknown>[] = []
const refresh = vi.fn(async () => {})
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ ttxList: mockTtxList, refresh }),
}))

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function apiError(status: number, code: string, message = 'Nope') {
  return json(status, { success: false, error: { code, message, ttx_id: null } })
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

function framework(overrides: Partial<RegulatoryFramework> & { id: string }): RegulatoryFramework {
  return {
    label_en: overrides.id,
    label_es: overrides.id,
    jurisdiction: 'EU',
    name_en: `${overrides.id} full name`,
    name_es: `${overrides.id} nombre completo`,
    scope_en: 'Who it applies to',
    scope_es: 'A quién aplica',
    requires_exercises: true,
    binding: true,
    rationale_en: `Why ${overrides.id}`,
    rationale_es: `Por qué ${overrides.id}`,
    rationale_reference: 'Art. 1',
    ...overrides,
  }
}

const catalog = {
  items: [
    {
      id: 'NIS2-23',
      framework: 'NIS2',
      reference: 'Art. 23',
      description_en: 'Incident reporting',
      description_es: 'Notificación de incidentes',
      notifications: [
        {
          recipient_en: 'CSIRT or competent authority',
          recipient_es: 'CSIRT o autoridad competente',
          stage_en: 'Early warning',
          stage_es: 'Alerta temprana',
          deadline_en: '24 h',
          deadline_es: '24 h',
          clock_en: 'Awareness of the significant incident',
          clock_es: 'Conocimiento del incidente significativo',
        },
      ],
    },
  ],
  frameworks: [
    framework({
      id: 'NIS2',
      requires_exercises: false,
      rationale_en: 'The 72 h notification clock.',
    }),
    framework({
      id: 'SEC',
      jurisdiction: 'US',
      rationale_en: 'Disclose a material incident within 4 business days.',
      rationale_reference: 'Form 8-K Item 1.05',
    }),
    framework({ id: 'PCI_DSS', label_en: 'PCI DSS', jurisdiction: 'GLOBAL', binding: false }),
  ],
}

function needsForm(overrides: Partial<NeedsForm> = {}): NeedsForm {
  return {
    id: 'form-1',
    ttx_id: 'ttx-1',
    exercise_code: 'TTX-2026-01',
    status: 'draft',
    version: 1,
    revision: 3,
    tlp: 'amber',
    document_date: '2026-09-27',
    design_lead: 'Ada',
    sponsor_name: '',
    sponsor_role: '',
    sponsor_motivation: '',
    findings_closure_commitment: false,
    findings_owner: '',
    aar_recipient: null,
    aar_recipient_other: '',
    triggers: [],
    regulatory_frameworks: [],
    regulatory_framework_other: '',
    trigger_other: '',
    capabilities: ['regulatory_notification'],
    levels: [],
    participating_areas: [],
    third_parties: [],
    perimeter: '',
    out_of_scope: '',
    date_window_start: null,
    date_window_end: null,
    max_duration_hours: null,
    key_participants_availability: '',
    confidentiality_restrictions: '',
    budget_and_external_support: '',
    stop_exercise_keyword: '',
    needs: [
      {
        id: 'need-1',
        code: 'NEED-01',
        source: 'previous_aar',
        title: 'Slow early warning',
        finding: 'Early warning took three hours.',
        affected_capability: 'regulatory_notification',
        priority: 'high',
      },
    ],
    objectives: [
      {
        id: 'obj-1',
        code: 'OBJ-01',
        statement: 'Decide on the NIS2 early warning within 60 minutes.',
        capability: 'regulatory_notification',
        linked_need_ids: ['need-1'],
        success_criterion: 'Documented decision in 60 minutes.',
        achieve_at_least: null,
        time_box_minutes: null,
        achieved_note: '',
        partially_achieved: '',
        not_achieved: '',
        evidence: '',
        regulatory_requirement_ids: ['NIS2-23'],
      },
    ],
    risks: [{ id: 'risk-1', risk: 'Scenario leak', mitigation: 'Need to know.', owner: '' }],
    approvals: [],
    updated_at: '2026-09-27T10:00:00+00:00',
    renumberable: [],
    validation: {
      ready: [
        { code: 'OUT_OF_SCOPE_REQUIRED', section: 6, field: 'out_of_scope', item_id: null },
        { code: 'OBJECTIVE_NOT_MEASURABLE', section: 5, field: 'evidence', item_id: 'obj-1' },
      ],
      approved: [
        {
          code: 'APPROVALS_MISSING',
          section: 9,
          field: 'approvals',
          item_id: 'sponsor',
        },
      ],
      warnings: [],
    },
    ...overrides,
  }
}

function renderPage(entry = '/creator/ttx-1/needs') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/creator/:ttxId/:section" element={<CreatorNeedsFormSection />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreatorNeedsFormSection', () => {
  beforeEach(() => {
    refresh.mockClear()
  })

  it('lays the scope out as level, scope and participants', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=scope')
    for (const name of [/^1\s*Level/, /^2\s*Scope/, /^3\s*Participants/]) {
      expect(await screen.findByRole('region', { name })).toBeInTheDocument()
    }
    const participants = screen.getByRole('region', { name: /Participants/ })
    // Why the areas matter, where they're named; third parties optional.
    expect(participants).toHaveTextContent('These are the recipients of your injects')
    expect(participants).toHaveTextContent('They can receive injects too.')
  })

  it('offers to close the gaps in the needs’ codes, by creation date, with an Undo', async () => {
    const gapped = needsForm({ renumberable: ['needs'] })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, gapped)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/renumber': [
        json(200, { form: needsForm(), previous: { 'need-1': 'NEED-02' } }),
      ],
    })
    renderPage('/creator/ttx-1/needs?step=needs')

    const button = await screen.findByRole('button', { name: 'Renumber by creation date' })
    expect(button).toHaveAttribute('title', expect.stringContaining('closes the gaps'))
    fireEvent.click(button)

    expect(await screen.findByText('Codes renumbered in order.')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/renumber'))
    expect(JSON.parse(call![1]!.body as string)).toMatchObject({ kind: 'needs' })
    // No gaps left: the button goes.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Renumber by creation date' })).toBeNull(),
    )
  })

  it('guides how to word a need, with examples that can start an empty one', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=needs')

    fireEvent.click(await screen.findByRole('button', { name: 'Add need' }))
    const dialog = within(await screen.findByRole('dialog'))
    // A title first, then the description.
    const title = dialog.getByLabelText('Title')
    const finding = dialog.getByLabelText('Description (finding or gap)')
    expect(title).toHaveAttribute('placeholder', 'e.g. Clear escalation paths…')
    expect(dialog.getByText(/What happens today and why it matters/)).toBeInTheDocument()

    fireEvent.click(dialog.getByRole('button', { name: /See examples/ }))
    fireEvent.click(dialog.getByRole('button', { name: /^Third-party risk\./ }))
    expect(title).toHaveValue('Third-party risk')
    expect(finding).toHaveValue(
      'Handling a crisis that starts in a supplier and is outside our direct control.',
    )
    // Once written, the examples are only to read.
    expect(dialog.getByRole('button', { name: /^Cross-border coordination\./ })).toBeDisabled()
  })

  it('takes a warning fixed in another section to where it is fixed', async () => {
    const base = needsForm()
    const form = needsForm({
      needs: [
        ...base.needs,
        {
          id: 'need-2',
          code: 'NEED-02',
          source: 'risk_analysis',
          title: 'Clear escalation paths',
          finding: 'Nobody knows when to escalate.',
          affected_capability: 'regulatory_notification',
          priority: 'high',
        },
      ],
      validation: {
        ...base.validation,
        warnings: [
          { code: 'HIGH_NEED_WITHOUT_OBJECTIVE', section: 3, field: 'needs', item_id: 'need-2' },
        ],
      },
    })
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, form)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [json(200, form.validation)],
    })
    renderPage('/creator/ttx-1/needs?step=needs')

    // Warned where the need is; fixed in Objectives, one click away.
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Fixed in Objectives: create an objective that answers it',
      }),
    )
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByRole('checkbox', { name: /NEED-02/ })).toBeChecked()
    expect(dialog.getByRole('checkbox', { name: /NEED-01/ })).not.toBeChecked()
  })

  it('groups the needs table, and lists Capabilities to evaluate before the needs', async () => {
    const base = needsForm()
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(
          200,
          needsForm({
            needs: [
              ...base.needs,
              {
                id: 'need-2',
                code: 'NEED-02',
                source: 'risk_analysis',
                title: 'Clear escalation paths',
                finding: '',
                affected_capability: 'regulatory_notification',
                priority: 'low',
              },
            ],
          }),
        ),
      ],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=needs')

    const steps = within(await screen.findByRole('navigation', { name: /sections/i }))
    const names = steps.getAllByRole('link').map((link) => link.textContent ?? '')
    const at = (label: string) => names.findIndex((name) => name.startsWith(label))
    expect(at('Triggers')).toBeLessThan(at('Capabilities to evaluate'))
    expect(at('Capabilities to evaluate')).toBeLessThan(at('Identified needs'))

    // Grouped by capability from the start, each group by code; no sort menu.
    const groupBy = within(screen.getByRole('group', { name: 'Group by' }))
    expect(groupBy.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Capability',
      'Priority',
    ])
    expect(groupBy.getByRole('button', { name: 'Capability' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.queryByRole('group', { name: 'Sort by' })).toBeNull()
    expect(screen.queryByRole('columnheader', { name: 'Affected capability' })).toBeNull()

    fireEvent.click(groupBy.getByRole('button', { name: 'Priority' }))
    const groups = screen.getAllByRole('rowheader').map((cell) => cell.textContent)
    expect(groups[0]).toMatch(/^High/)
    expect(groups[1]).toMatch(/^Low/)
    // Grouped by priority: no priority column.
    expect(screen.queryByRole('columnheader', { name: 'Priority' })).toBeNull()
  })

  it('shows the code, version, status, TLP and the validation summary', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Needs analysis' })).toBeInTheDocument()
    expect(screen.getAllByText('TTX-2026-01').length).toBeGreaterThan(0)
    expect(screen.getByText('v1')).toBeInTheDocument()
    // The header badge and the status track both say where it's at.
    expect(screen.getAllByText('Draft')).toHaveLength(2)
    const track = within(screen.getByRole('region', { name: 'Status' }))
    expect(track.getByText('Draft').closest('li')).toHaveAttribute('aria-current', 'step')
    expect(screen.getAllByText('TLP:AMBER').length).toBeGreaterThan(0)
    const summary = screen.getByRole('region', { name: 'Validation' })
    expect(within(summary).getByText(/Say what is out of scope/)).toBeInTheDocument()
    expect(
      within(summary).getByRole('button', { name: /OBJ-01 \|.*: Evidence to collect is missing/ }),
    ).toBeInTheDocument()
    expect(within(summary).getByText(/Sponsor approval not recorded/)).toBeInTheDocument()
  })

  it('offers the PDF, in the language of the app, once sections 0-8 are complete', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(
          200,
          needsForm({
            validation: {
              ready: [],
              approved: [
                { code: 'APPROVALS_MISSING', section: 9, field: 'approvals', item_id: 'sponsor' },
              ],
              warnings: [],
            },
          }),
        ),
      ],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage()

    // Missing approvals don't block it: they're what the PDF is signed for.
    expect(await screen.findByRole('link', { name: 'Download as Markdown' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/needs-form/export.md?lang=en',
    )
    expect(await screen.findByRole('link', { name: 'Download PDF' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/needs-form/pdf?lang=en',
    )
  })

  it('downloads a marked draft while required items are missing', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage()

    const link = await screen.findByRole('link', { name: 'Download draft PDF' })
    expect(link).toHaveAttribute('href', '/api/v1/ttx/ttx-1/needs-form/pdf?lang=en')
    // It says how much is missing and leads to the first of it.
    expect(link).toHaveAccessibleDescription(
      /^2 items missing: it downloads as a draft\.\s+Go to the first$/,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go to the first' }))
    // Objectives come before Scope on screen: the objective opens, on its field.
    expect(await screen.findByRole('dialog', { name: /^Edit OBJ-01\b/ })).toBeInTheDocument()
  })

  it('saves the draft by itself a moment after an edit', async () => {
    const saved = needsForm({ revision: 4, sponsor_name: 'Sponsor Example' })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [json(200, needsForm().validation)],
      'PUT /ttx/ttx-1/needs-form': [json(200, saved)],
    })
    renderPage('/creator/ttx-1/needs?step=sponsorship')

    expect(await screen.findByText('All changes saved')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Sponsor name'), {
      target: { value: 'Sponsor Example' },
    })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument(), {
      timeout: 3000,
    })
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    const body = JSON.parse(put[1]!.body as string)
    expect(body.revision).toBe(3)
    expect(body.sponsor_name).toBe('Sponsor Example')
    expect(body.objectives[0]).toMatchObject({ id: 'obj-1', linked_need_keys: ['need-1'] })
    expect(screen.getByLabelText('Sponsor name')).toHaveValue('Sponsor Example')
    // No Save/Discard buttons: the draft saves itself.
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument()
  })

  it('names a need created on the page by its code once saved, never by its id', async () => {
    const base = needsForm()
    const saved = needsForm({
      revision: 4,
      needs: [
        ...base.needs,
        {
          id: '51c543c5-135d-49e8-8fb6-c068e0b67c51',
          code: 'NEED-02',
          source: 'risk_analysis',
          title: 'Clear escalation paths',
          finding: 'Escalation paths unclear',
          affected_capability: 'regulatory_notification',
          priority: 'high',
        },
      ],
      validation: {
        ...base.validation,
        warnings: [
          {
            code: 'HIGH_NEED_WITHOUT_OBJECTIVE',
            section: 3,
            field: 'needs',
            item_id: '51c543c5-135d-49e8-8fb6-c068e0b67c51',
          },
        ],
      },
    })
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, base)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [json(200, base.validation)],
      'PUT /ttx/ttx-1/needs-form': [json(200, saved)],
    })
    renderPage('/creator/ttx-1/needs?step=needs')

    fireEvent.click(await screen.findByRole('button', { name: 'Add need' }))
    const dialog = within(await screen.findByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Title'), {
      target: { value: 'Clear escalation paths' },
    })
    fireEvent.change(dialog.getByLabelText('Description (finding or gap)'), {
      target: { value: 'Escalation paths unclear' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Done' }))

    await waitFor(() => expect(screen.getByText('All changes saved')).toBeInTheDocument(), {
      timeout: 3000,
    })
    const warnings = await screen.findAllByText(/is high priority, but no objective answers it/)
    for (const warning of warnings) {
      // Named by code and title, not by the description.
      expect(warning.textContent).toContain('NEED-02 | Clear escalation paths')
      expect(warning.textContent).not.toContain('51c543c5')
    }
    // The table reads code and title first, the description under them.
    const row = screen.getByRole('row', { name: /NEED-02/ })
    expect(within(row).getByText('Clear escalation paths')).toBeInTheDocument()
    expect(within(row).getByText('Escalation paths unclear')).toBeInTheDocument()
  })

  it('asks before the first edit of an approved form, then saves it as a new version', async () => {
    const approved = needsForm({ status: 'approved' })
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, approved)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [json(200, approved.validation)],
      'PUT /ttx/ttx-1/needs-form': [
        json(200, needsForm({ version: 2, revision: 4, design_lead: 'Grace' })),
      ],
    })
    renderPage('/creator/ttx-1/needs?step=document')

    fireEvent.change(await screen.findByLabelText('Design lead'), { target: { value: 'Grace' } })
    const dialog = screen.getByRole('dialog', { name: 'Withdraw the approval?' })
    expect(within(dialog).getByText(/back to draft as version 2/)).toBeInTheDocument()
    // Not applied until confirmed.
    expect(screen.getByLabelText('Design lead')).toHaveValue('Ada')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit and withdraw approval' }))

    expect(screen.getByLabelText('Design lead')).toHaveValue('Grace')
    await waitFor(() => expect(screen.getByText('v2')).toBeInTheDocument(), { timeout: 3000 })
    await waitFor(() => expect(refresh).toHaveBeenCalled())
  })

  it('drops the edit when the user keeps the approval', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm({ status: 'approved' }))],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=document')

    fireEvent.change(await screen.findByLabelText('Design lead'), { target: { value: 'Grace' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Design lead')).toHaveValue('Ada')
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('offers a reload when someone else saved first', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [json(200, needsForm().validation)],
      'PUT /ttx/ttx-1/needs-form': [apiError(409, 'NEEDS_FORM_STALE')],
    })
    renderPage('/creator/ttx-1/needs?step=document')

    fireEvent.change(await screen.findByLabelText('Design lead'), { target: { value: 'Grace' } })

    expect(
      await screen.findByText(
        'Someone else saved this form since you opened it.',
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByLabelText('Design lead')).toHaveValue('Grace')
  })

  it('moves between sections with Previous/Next, keeping the draft', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=sponsorship')

    fireEvent.change(await screen.findByLabelText('Sponsor name'), {
      target: { value: 'Sponsor Example' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByRole('heading', { name: 'Triggers' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }))

    expect(await screen.findByLabelText('Sponsor name')).toHaveValue('Sponsor Example')
  })

  it('does not autosave a draft the backend would refuse', async () => {
    const form = needsForm()
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, form)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [
        json(200, {
          ...form.validation,
          ready: [
            {
              code: 'OBJECTIVE_CAPABILITY_NOT_SELECTED',
              section: 5,
              field: 'capability',
              item_id: 'obj-1',
            },
          ],
        }),
      ],
    })
    renderPage('/creator/ttx-1/needs?step=capabilities')

    const used = await screen.findByRole('checkbox', { name: /Regulatory notification/ })
    expect(used).toBeEnabled()
    fireEvent.click(used)

    expect(
      await screen.findByText(/Not saved: fix the issues/, {}, { timeout: 3000 }),
    ).toBeInTheDocument()
    await new Promise((resolve) => setTimeout(resolve, 1000))
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false)
  })

  it('keeps the objective example inside the step description, folded on Show less', async () => {
    window.localStorage.clear()
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    const example = await screen.findByText(/an NIS2 early warning is due within 60 minutes/)
    expect(screen.queryByText('See an example')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(example).not.toBeInTheDocument()
  })

  it('groups the objectives by capability, or by the need they answer', async () => {
    const form = needsForm()
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(
          200,
          needsForm({
            needs: [
              ...form.needs,
              {
                id: 'need-2',
                code: 'NEED-02',
                source: 'risk_analysis',
                title: 'No press holding line',
                finding: 'Nobody owns the holding statement.',
                affected_capability: 'regulatory_notification',
                priority: 'low',
              },
            ],
          }),
        ),
      ],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    const [table] = await screen.findAllByRole('table')
    expect(within(table).getByRole('rowheader', { name: /Regulatory notification/ })).toBeTruthy()
    expect(within(table).queryByRole('columnheader', { name: 'Capability' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Need it answers' }))
    expect(within(table).getByRole('rowheader', { name: /NEED-01/ })).toBeTruthy()
    expect(within(table).getByRole('rowheader', { name: /NEED-02/ })).toBeTruthy()
    expect(within(table).getByText('No objective answers this need yet.')).toBeInTheDocument()
    expect(within(table).queryByRole('columnheader', { name: 'Needs it answers' })).toBeNull()
    expect(within(table).getByRole('columnheader', { name: 'Capability' })).toBeInTheDocument()
  })

  it('derives the expected notifications from the requirements the objectives cite', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    const reference = await screen.findByRole('region', { name: 'Expected notifications' })
    expect(within(reference).getByText('1 regime')).toBeInTheDocument()
    expect(within(reference).getByRole('rowheader', { name: /NIS2 Art\. 23/ })).toBeTruthy()
    expect(within(reference).getByText('Early warning')).toBeInTheDocument()
    expect(within(reference).getByText('24 h')).toBeInTheDocument()
    // Removing the objective that cites it removes the reference: nothing
    // is kept of its own.
    fireEvent.click(screen.getByRole('button', { name: /^Remove objective OBJ-01/ }))
    await waitFor(() =>
      expect(screen.queryByRole('region', { name: 'Expected notifications' })).toBeNull(),
    )
  })

  it('names a framework an objective cites in Regulations in one click', async () => {
    const form = needsForm({
      regulatory_frameworks: [],
      validation: {
        ...needsForm().validation,
        warnings: [
          {
            code: 'OBJECTIVE_FRAMEWORK_NOT_NAMED',
            section: 2,
            field: 'regulatory_frameworks',
            item_id: 'NIS2',
          },
        ],
      },
    })
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, form)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [json(200, form.validation)],
    })
    renderPage('/creator/ttx-1/needs?step=triggers')

    // In the summary and in the section's own list.
    expect(
      (await screen.findAllByText(/“NIS2” is cited by an objective but isn't named/)).length,
    ).toBeGreaterThan(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Name NIS2 in Regulations' })[0])

    expect(await screen.findByRole('checkbox', { name: /^NIS2/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Regulatory/ })).toBeChecked()
  })

  it('writes the success criterion as conditions, one per row', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    fireEvent.click(await screen.findByRole('button', { name: /^Edit objective OBJ-01\b/ }))
    const dialog = await screen.findByRole('dialog')
    const first = within(dialog).getByRole('textbox', { name: 'Condition 1' })
    fireEvent.keyDown(first, { key: 'Enter' })
    const second = within(dialog).getByRole('textbox', { name: 'Condition 2' })
    await waitFor(() => expect(second).toHaveFocus())
    fireEvent.change(second, { target: { value: 'Owner named by role' } })

    // Two conditions: the rule can ask for only some of them.
    fireEvent.click(within(dialog).getByRole('button', { name: 'At least…' }))
    expect(within(dialog).getByRole('combobox', { name: 'How many conditions' })).toHaveValue('1')
    // The evaluator view is folded until asked for, then live.
    expect(within(dialog).queryByRole('region', { name: 'Evaluator view' })).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Evaluator view' }))
    const preview = within(dialog).getByRole('region', { name: 'Evaluator view' })
    expect(
      within(preview).getByText('Achieved with at least 1 of 2 conditions'),
    ).toBeInTheDocument()
    expect(within(preview).getByText('Owner named by role')).toBeInTheDocument()
    // Escape folds it first; the dialog stays.
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(within(dialog).queryByRole('region', { name: 'Evaluator view' })).toBeNull()
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    // Backspace on an empty row removes it.
    fireEvent.change(second, { target: { value: '' } })
    fireEvent.keyDown(within(dialog).getByRole('textbox', { name: 'Condition 2' }), {
      key: 'Backspace',
    })
    expect(within(dialog).queryByRole('textbox', { name: 'Condition 2' })).toBeNull()
  })

  it('offers to split a row that lists several conditions and to move a rating level', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    fireEvent.click(await screen.findByRole('button', { name: /^Edit objective OBJ-01\b/ }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Condition 1' }), {
      target: {
        value:
          'Achieved if, within 15 minutes of the leak: (1) a decision is taken, (2) its owner is named, and (3) the criteria are stated.\nPartially achieved: no owner named.',
      },
    })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Split into 3 rows' }))
    expect(within(dialog).getByRole('textbox', { name: 'Condition 1' })).toHaveValue(
      'A decision is taken',
    )
    expect(within(dialog).getByRole('textbox', { name: 'Condition 3' })).toHaveValue(
      'The criteria are stated',
    )
    expect(within(dialog).getByRole('spinbutton', { name: /Time box/ })).toHaveValue(15)

    // The lead-in went to the note on "achieved"; the level line goes to
    // its own level, without its prefix.
    expect(within(dialog).getByRole('textbox', { name: /^Achieved/ })).toHaveValue(
      'Achieved if, within 15 minutes of the leak:',
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move to Partially achieved' }))
    expect(within(dialog).getByText('Achieved when all 3 conditions are met')).toBeInTheDocument()
    expect(within(dialog).queryByRole('textbox', { name: 'Condition 4' })).toBeNull()
    expect(within(dialog).getByRole('textbox', { name: /^Partially achieved/ })).toHaveValue(
      'No owner named.',
    )
  })

  it('names an objective by its title and keeps the statement whole under it', async () => {
    const form = needsForm()
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(
          200,
          needsForm({
            objectives: [{ ...form.objectives[0], title: 'NIS2 early-warning decision' }],
          }),
        ),
      ],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    const [table] = await screen.findAllByRole('table')
    expect(within(table).getByText('NIS2 early-warning decision')).toBeInTheDocument()
    expect(
      within(table).getByText('Decide on the NIS2 early warning within 60 minutes.'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Edit objective OBJ-01\b/ }))
    expect(
      await screen.findByRole('dialog', { name: 'Edit OBJ-01 | NIS2 early-warning decision' }),
    ).toBeInTheDocument()
  })

  it('asks before discarding the edits of a row dialog', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    fireEvent.click(await screen.findByRole('button', { name: /^Edit objective OBJ-01\b/ }))
    const dialog = await screen.findByRole('dialog')
    const statement = within(dialog).getByRole('textbox', { name: 'Statement' })
    fireEvent.change(statement, { target: { value: 'A long statement written with care' } })

    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(within(dialog).getByText('Discard your changes?')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }))
    expect(statement).toHaveValue('A long statement written with care')

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('suggests the capability of the first need ticked in a new objective', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(
          200,
          needsForm({ capabilities: ['cross_unit_coordination', 'regulatory_notification'] }),
        ),
      ],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    fireEvent.click(await screen.findByRole('button', { name: 'Add objective' }))
    const dialog = await screen.findByRole('dialog')
    const capability = within(dialog).getByRole('combobox', { name: /Capability/ })
    expect(capability).toHaveValue('cross_unit_coordination')

    fireEvent.click(within(dialog).getByRole('checkbox', { name: /NEED-01/ }))
    expect(capability).toHaveValue('regulatory_notification')
    // Each block names what it's for, and the buttons stay at hand.
    for (const name of ['Why', 'What', "How it's measured", 'Regulatory requirements']) {
      expect(within(dialog).getByRole('heading', { name })).toBeInTheDocument()
    }
    expect(within(dialog).getByText('0 selected')).toBeInTheDocument()
  })

  it('lists first the requirements of the frameworks named in Triggers', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(200, needsForm({ triggers: ['regulatory'], regulatory_frameworks: ['SEC'] })),
      ],
      'GET /regulatory-requirements': [
        json(200, {
          ...catalog,
          items: [
            ...catalog.items,
            {
              id: 'SEC-105',
              framework: 'SEC',
              reference: 'Item 1.05',
              description_en: 'Material incident disclosure',
              description_es: 'Divulgación de incidentes materiales',
              notifications: [],
            },
            {
              id: 'PCI-12',
              framework: 'PCI_DSS',
              reference: 'Req. 12.10',
              description_en: 'Incident response plan',
              description_es: 'Plan de respuesta a incidentes',
              notifications: [],
            },
          ],
        }),
      ],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    fireEvent.click(await screen.findByRole('button', { name: /^Edit objective OBJ-01\b/ }))
    const dialog = await screen.findByRole('dialog')
    // SEC is named; NIS2 stays because the objective already cites it.
    expect(within(dialog).getByRole('checkbox', { name: /Item 1\.05/ })).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: /Art\. 23/ })).toBeChecked()
    expect(within(dialog).queryByRole('checkbox', { name: /Req\. 12\.10/ })).toBeNull()
    expect(within(dialog).getByText('1 selected')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'All' }))
    expect(within(dialog).getByRole('checkbox', { name: /Req\. 12\.10/ })).toBeInTheDocument()

    // The search runs over framework, reference and text, ignoring accents.
    const search = within(dialog).getByRole('searchbox', { name: /Search framework/ })
    fireEvent.change(search, { target: { value: 'response plan' } })
    expect(within(dialog).getAllByRole('checkbox')).toHaveLength(2) // need + PCI
    expect(within(dialog).getByRole('checkbox', { name: /Req\. 12\.10/ })).toBeInTheDocument()
    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(within(dialog).getByText('No requirement matches “zzz”.')).toBeInTheDocument()

    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Selected (1)' }))
    expect(within(dialog).getByRole('checkbox', { name: /Art\. 23/ })).toBeChecked()
    expect(within(dialog).queryByRole('checkbox', { name: /Item 1\.05/ })).toBeNull()
  })

  it("lists the section's own issues at its top, each leading to its row", async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=objectives')

    const issues = await screen.findByRole('status', { name: '1 thing to fix in this section' })
    fireEvent.click(
      within(issues).getByRole('button', {
        name: /OBJ-01 \|.*: Evidence to collect is missing\.$/,
      }),
    )

    expect(await screen.findByRole('dialog', { name: /^Edit OBJ-01\b/ })).toBeInTheDocument()
  })

  it('re-validates the draft as the user edits, before it is even saved', async () => {
    const form = needsForm()
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, form)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [
        json(200, {
          ...form.validation,
          ready: form.validation.ready.filter((issue) => issue.code !== 'OUT_OF_SCOPE_REQUIRED'),
        }),
      ],
    })
    renderPage('/creator/ttx-1/needs?step=scope')

    expect(await screen.findByRole('status', { name: /thing to fix/ })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Out of scope'), {
      target: { value: 'OT recovery.' },
    })

    await waitFor(() =>
      expect(screen.queryByRole('status', { name: /thing to fix/ })).not.toBeInTheDocument(),
    )
    const summary = screen.getByRole('region', { name: 'Validation' })
    expect(within(summary).queryByText(/Say what is out of scope/)).not.toBeInTheDocument()
    const check = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/validate'))!
    expect(JSON.parse(check[1]!.body as string).out_of_scope).toBe('OT recovery.')
  })

  it('takes the user to the field a summary entry points at', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage()

    const summary = await screen.findByRole('region', { name: 'Validation' })
    fireEvent.click(within(summary).getByRole('button', { name: /Say what is out of scope/ }))

    const outOfScope = await screen.findByLabelText('Out of scope')
    await waitFor(() => expect(outOfScope).toHaveFocus())
  })

  it('still goes to the field when the entry is clicked the moment it appears', async () => {
    // A click that lands between the page's first paint and its first
    // effects (a slow machine, or a quick user): the pending focus must
    // survive until the section it belongs to has rendered.
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    const clicked = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        const entry = [...document.querySelectorAll('button')].find((button) =>
          button.textContent?.includes('Say what is out of scope'),
        )
        if (!entry) return
        observer.disconnect()
        entry.click() // synchronously, before React flushes the mount effects
        resolve()
      })
      observer.observe(document.body, { childList: true, subtree: true })
    })
    renderPage()
    await clicked

    const outOfScope = await screen.findByLabelText('Out of scope')
    await waitFor(() => expect(outOfScope).toHaveFocus())
  })

  it('opens the row a summary entry points at, focused on the field', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage()

    const summary = await screen.findByRole('region', { name: 'Validation' })
    fireEvent.click(within(summary).getByRole('button', { name: /OBJ-01 \|.*: Evidence/ }))

    const dialog = await screen.findByRole('dialog', { name: /^Edit OBJ-01\b/ })
    await waitFor(() =>
      expect(within(dialog).getByRole('textbox', { name: 'Evidence 1' })).toHaveFocus(),
    )
  })

  it('keeps submitting disabled until the saved form is valid', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=approval')

    expect(await screen.findByRole('button', { name: 'Submit for approval' })).toBeDisabled()
    expect(screen.getByText('Fix the issues in the validation summary first.')).toBeInTheDocument()
  })

  it('submits a valid form for approval', async () => {
    const valid = needsForm({ validation: { ready: [], approved: [], warnings: [] } })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, valid)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/transitions': [
        json(200, { ...valid, status: 'ready_for_approval' }),
      ],
    })
    renderPage('/creator/ttx-1/needs?step=approval')

    fireEvent.click(await screen.findByRole('button', { name: 'Submit for approval' }))

    expect(await screen.findByText('Needs analysis submitted for approval')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toEqual({ to: 'ready_for_approval' })
    expect(screen.getByText('Record an approval')).toBeInTheDocument()
  })
})

describe('approval evidence', () => {
  const approval = {
    id: 'appr-1',
    version: 1,
    approver_kind: 'sponsor' as const,
    approver_name: 'Sponsor Example',
    approver_role: '',
    approved_on: '2026-09-27',
    recorded_by_name: 'Ada',
    recorded_at: '2026-09-27T10:00:00+00:00',
    evidence: [],
  }
  const signed = {
    id: 'ev-1',
    filename: 'signed.pdf',
    content_type: 'application/pdf',
    size_bytes: 2048,
    uploaded_by_name: 'Ada',
    uploaded_at: '2026-09-27T10:05:00+00:00',
  }
  const valid = { ready: [], approved: [], warnings: [] }

  it('records an approval and uploads the chosen evidence to it', async () => {
    const ready = needsForm({ status: 'ready_for_approval', validation: valid })
    const withApproval = { ...ready, approvals: [approval] }
    const withEvidence = { ...ready, approvals: [{ ...approval, evidence: [signed] }] }
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, ready)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/approvals': [json(201, withApproval)],
      'POST /ttx/ttx-1/needs-form/approvals/appr-1/evidence': [json(201, withEvidence)],
    })
    renderPage('/creator/ttx-1/needs?step=approval')

    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Sponsor Example' },
    })
    const file = new File(['%PDF-1.7'], 'signed.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/^Evidence/), { target: { files: [file] } })
    fireEvent.click(screen.getByRole('button', { name: 'Record approval' }))

    const link = await screen.findByRole('link', { name: 'signed.pdf' })
    expect(link).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/needs-form/approvals/appr-1/evidence/ev-1',
    )
    const upload = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/evidence'))!
    expect((upload[1]!.body as FormData).get('file')).toBe(file)
    expect(screen.getByRole('button', { name: 'Remove signed.pdf' })).toBeInTheDocument()
  })

  it('still takes evidence once approved, but no longer lets it be removed', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(
          200,
          needsForm({
            status: 'approved',
            validation: valid,
            approvals: [{ ...approval, evidence: [signed] }],
          }),
        ),
      ],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=approval')

    expect(await screen.findByRole('link', { name: 'signed.pdf' })).toBeInTheDocument()
    expect(screen.getByText('Attach evidence')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove signed.pdf' })).not.toBeInTheDocument()
  })
})

describe('acronyms', () => {
  it('groups the regulations and explains only the ticked ones', async () => {
    const form = needsForm({ triggers: ['regulatory'], regulatory_frameworks: ['SEC'] })
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, form)],
      'GET /regulatory-requirements': [json(200, catalog)],
      'POST /ttx/ttx-1/needs-form/validate': [json(200, form.validation)],
      'PUT /ttx/ttx-1/needs-form': [json(200, form)],
    })
    renderPage('/creator/ttx-1/needs?step=triggers')

    const regulations = await screen.findByRole('group', { name: 'Regulations' })
    expect(within(regulations).getByText('United States', { selector: 'p' })).toBeInTheDocument()
    expect(within(regulations).getAllByText('Requires exercises')).toHaveLength(2)
    // The description runs through AcronymText, so compare the whole text.
    expect(regulations).toHaveTextContent(
      'PCI_DSS full name · Who it applies to · Contractual standard',
    )

    const why = screen.getByRole('region', { name: 'Why train them with a tabletop exercise' })
    expect(within(why).getByText(/within 4 business days/)).toBeInTheDocument()
    expect(within(why).getByText('Form 8-K Item 1.05')).toBeInTheDocument()
    expect(within(why).queryByText(/72 h notification clock/)).not.toBeInTheDocument()

    expect(screen.queryByLabelText('Other regulation')).not.toBeInTheDocument()
    fireEvent.click(within(regulations).getByRole('checkbox', { name: /^Other/ }))
    fireEvent.change(screen.getByLabelText('Other regulation'), {
      target: { value: 'Law 8/2011' },
    })
    await waitFor(() => {
      const check = fetchMock.mock.calls.findLast(([url]) => String(url).endsWith('/validate'))
      expect(JSON.parse(check![1]!.body as string)).toMatchObject({
        regulatory_frameworks: ['SEC', 'OTHER'],
        regulatory_framework_other: 'Law 8/2011',
      })
    })
  })

  it('shows approval as pending, not done, while the form awaits it', async () => {
    const clean = { ready: [], approved: [], warnings: [] }
    stubApi({
      'GET /ttx/ttx-1/needs-form': [
        json(200, needsForm({ status: 'ready_for_approval', validation: clean })),
      ],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage()

    const steps = await screen.findByRole('navigation', { name: /sections/i })
    expect(within(steps).getByRole('link', { name: /Approval/ })).toHaveTextContent('Pending')
    const summary = screen.getByRole('region', { name: 'Validation' })
    expect(within(summary).getByText(/One step left: record the approvals/)).toBeInTheDocument()
  })

  it('marks acronyms up with their expansion', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, needsForm())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=sponsorship')

    const abbr = (await screen.findAllByText('AAR')).find((node) => node.tagName === 'ABBR')!
    expect(abbr).toHaveAttribute('title', 'After-Action Report')
  })

  it('only matches whole, upper-case words', () => {
    expect(splitAcronyms('IT/OT, not it; NIS2 and ENS.')).toEqual([
      { term: 'IT' },
      '/',
      { term: 'OT' },
      ', not it; ',
      { term: 'NIS2' },
      ' and ',
      { term: 'ENS' },
      '.',
    ])
  })

  it('leaves the product name alone', () => {
    expect(splitAcronyms('TTX-Zone runs a TTX.')).toEqual([
      'TTX-Zone runs a ',
      { term: 'TTX' },
      '.',
    ])
  })
})

describe('needs form draft', () => {
  it('sends new rows without ids and links them by key', () => {
    const draft = draftFromForm(needsForm())
    draft.needs.push({
      id: null,
      key: 'new-7',
      code: '',
      source: 'threat_intel',
      title: 'New campaign',
      finding: 'New campaign',
      affected_capability: 'regulatory_notification',
      priority: 'low',
    })
    draft.objectives[0].linked_need_keys = ['need-1', 'new-7']
    draft.max_duration_hours = ' 4 '

    const payload = payloadFromDraft(draft, 3)

    expect(payload.needs[1]).toEqual({
      id: null,
      key: 'new-7',
      source: 'threat_intel',
      title: 'New campaign',
      finding: 'New campaign',
      affected_capability: 'regulatory_notification',
      priority: 'low',
    })
    expect(payload.objectives[0].linked_need_keys).toEqual(['need-1', 'new-7'])
    expect(payload.max_duration_hours).toBe(4)
    expect(payload.date_window_start).toBeNull()
  })
})

describe('CreatorDesignGate', () => {
  function renderGate() {
    render(
      <MemoryRouter initialEntries={['/creator/ttx-1/timeline']}>
        <Routes>
          <Route
            path="/creator/:ttxId/:section"
            element={
              <CreatorDesignGate>
                <p>Timeline editor</p>
              </CreatorDesignGate>
            }
          />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('explains the gate and links to the needs analysis until it is approved', () => {
    mockTtxList = [{ id: 'ttx-1', needs_form_status: 'draft' }]
    renderGate()

    expect(screen.getByText('Approve the needs analysis first')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the needs analysis' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/needs',
    )
    expect(screen.queryByText('Timeline editor')).not.toBeInTheDocument()
  })

  it('lets the section through once the form is approved', () => {
    mockTtxList = [{ id: 'ttx-1', needs_form_status: 'approved' }]
    renderGate()

    expect(screen.getByText('Timeline editor')).toBeInTheDocument()
  })
})

describe('TlpBadge', () => {
  it('shows the TLP label as text, so it reads without colour', () => {
    render(<TlpBadge tlp="amber_strict" />)
    expect(screen.getByText('TLP:AMBER+STRICT')).toBeInTheDocument()
  })
})

describe('needs form outputs', () => {
  const withOrphan = () =>
    needsForm({
      needs: [
        ...needsForm().needs,
        {
          id: 'need-2',
          code: 'NEED-02',
          source: 'incident_history',
          title: 'Phishing near miss',
          finding: 'Phishing near miss.',
          affected_capability: 'regulatory_notification',
          priority: 'high',
        },
      ],
    })

  it('builds one matrix row per linked need, then the orphan HIGH needs', () => {
    const rows = traceabilityRows(withOrphan(), catalog)

    expect(rows.map((row) => [row.needCode, row.objective?.code ?? null])).toEqual([
      ['NEED-01', 'OBJ-01'],
      ['NEED-02', null],
    ])
    expect(rows[0].objective?.requirements).toEqual(['NIS2 Art. 23'])
  })

  it('flags the orphan need in the matrix step', async () => {
    stubApi({
      'GET /ttx/ttx-1/needs-form': [json(200, withOrphan())],
      'GET /regulatory-requirements': [json(200, catalog)],
    })
    renderPage('/creator/ttx-1/needs?step=traceability')

    expect(
      await screen.findByText('No objective answers this high-priority need.'),
    ).toBeInTheDocument()
    expect(screen.queryByText('All changes saved')).not.toBeInTheDocument()
  })
})
