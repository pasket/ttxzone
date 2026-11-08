import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InjectLibrary } from '../src/components/templates/InjectLibrary'
import { render } from './testUtils'
import { libraryPermissions } from '../src/lib/libraryLevels'

const mockAuth = {
  activeTtx: { id: 'ttx-1', needs_form_status: 'approved' },
  activeOrganization: { organization_name: 'Acme Energy', alias: 'ACME' },
  ttxList: [{ id: 'ttx-1', content_language: 'en' as string | null }],
}
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => mockAuth }))

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

function body(fetchMock: ReturnType<typeof stubApi>, key: string) {
  const call = fetchMock.mock.calls.find(
    ([url, init]) => `${init?.method ?? 'GET'} ${String(url).replace('/api/v1', '')}` === key,
  )
  return JSON.parse(String(call?.[1]?.body))
}

const ransom = {
  id: 'INJ-RAN-02',
  title: { es: 'Nota de rescate con cuenta atrás', en: 'Ransom note with a countdown' },
  content: {
    es: 'El grupo {attacker_group} exige {ransom_amount} a {organization}.',
    en: 'The {attacker_group} group demands {ransom_amount} from {organization}.',
  },
  kind: 'mandatory',
  contingent_for: null,
  trigger: null,
  purpose: null,
  actor: 'threat-actor',
  delivery_method: 'document',
  recipients: [{ es: 'Comité de crisis', en: 'Crisis committee' }],
  expected_actions: [
    {
      description: { es: 'Denuncia ante la policía', en: 'Reports to the police' },
      responsible_role: { es: 'Legal', en: 'Legal' },
      within_minutes: 240,
    },
  ],
  attachments: [],
  key_question: { es: '¿Abrimos el chat?', en: "Do we open the attacker's chat?" },
  facilitator_notes: null,
  families: ['ransomware'],
  stage: 'escalation',
  capabilities: ['crisis_decision_making'],
  audience: 'mixed',
  attack: [
    {
      domain: 'enterprise',
      tactic_id: 'TA0040',
      tactic_name: 'Impact',
      technique_id: 'T1486',
      technique_name: 'Data Encrypted for Impact',
    },
  ],
  frameworks: [],
  variables: ['attacker_group', 'organization', 'ransom_amount'],
  format: 'inject',
  poll_question: '',
  poll_options: [],
  poll_outcomes: [],
  variable_defaults: {
    attacker_group: { es: 'Nébula', en: 'Nebula' },
    ransom_amount: { es: '4,5 millones de dólares', en: 'USD 4.5 million' },
  },
}

const ransomImage = {
  index: 0,
  caption: { es: 'Nota de rescate ficticia', en: 'Fictitious ransom note' },
  width: 1280,
  height: 720,
}
const catalog = { attack_version: '19.2', items: [{ ...ransom, images: [ransomImage] }] }
const systemActors = {
  items: [
    {
      id: 'threat-actor',
      type: 'threat_actor',
      name_en: 'Fictitious threat actor',
      name_es: 'Actor de amenaza ficticio',
      description_en: '',
      description_es: '',
      channel: 'document',
      default: true,
    },
  ],
}

const libraryInject = {
  id: 'lib-1',
  language: 'en',
  title: 'Board asks for a briefing',
  content: 'The chair wants an update.',
  kind: 'mandatory',
  trigger_condition: '',
  contingent_purpose: '',
  actor_name: 'Board chair',
  actor_type: 'internal',
  actor_origin: null,
  actor_origin_id: null,
  delivery_method: 'phone',
  recipients: [],
  expected_actions: [],
  attachment_notes: [],
  key_question: '',
  facilitator_notes: '',
  families: [],
  stage: 'response',
  audience: 'executive',
  capabilities: [],
  attack_version: '19.2',
  attack: [],
  frameworks: [],
  format: 'inject',
  poll_question: '',
  poll_options: [],
  poll_outcomes: [],
  variable_defaults: {},
  origin: null,
  origin_id: null,
  origin_name: null,
  created_at: '2026-09-29T10:00:00+00:00',
  updated_at: '2026-09-29T10:00:00+00:00',
}

const msel = {
  editable: true,
  time_compression: 60,
  attack_version: '19.2',
  needs: {
    objectives: [
      {
        id: 'obj-1',
        code: 'OBJ-01',
        statement: 'Decide on containment',
        capability: 'crisis_decision_making',
      },
      {
        id: 'obj-2',
        code: 'OBJ-02',
        statement: 'Notify the regulator',
        capability: 'regulatory_notification',
      },
    ],
  },
  phases: [
    { id: 'ph-1', code: 'PH-01', name: 'Detection', start_offset: 0, end_offset: 45 },
    { id: 'ph-2', code: 'PH-02', name: 'Escalation', start_offset: 45, end_offset: 90 },
    { id: 'ph-3', code: 'PH-03', name: 'Recovery', start_offset: 90, end_offset: 180 },
  ],
  actors: [{ id: 'act-1', name: 'SOC', type: 'soc', origin: 'system', origin_id: 'soc' }],
  injects: [
    {
      id: 'inj-1',
      code: 'INJ-01',
      phase_id: 'ph-1',
      kind: 'mandatory',
      title: 'SOC alert',
      content: 'Mass file renames.',
      offset_minutes: 0,
      trigger_condition: '',
      contingent_purpose: '',
      simulated_actor_id: 'act-1',
      recipients: ['SOC'],
      delivery_method: 'chat',
      attachment_notes: [],
      attack_techniques: [],
      facilitator_notes: '',
      review_status: 'draft',
      validated_by: '',
      origin: null,
      objective_ids: ['obj-1'],
      expected_actions: [
        {
          id: 'a-1',
          code: 'INJ-01-A1',
          description: 'Escalates',
          responsible_role: 'SOC',
          expected_within_minutes: 10,
        },
      ],
    },
  ],
}

const freeUsage = {
  exercises: [],
  injects: [],
  memberships: 0,
  allowed_domains: 0,
  applied_to_organization: false,
  total: 0,
}

function baseRoutes(extra: Record<string, Response[]> = {}) {
  return stubApi({
    'GET /inject-catalog': [json(200, catalog)],
    'GET /actor-catalog': [json(200, systemActors)],
    'GET /organizations/org-1/actors': [json(200, { items: [] })],
    'GET /organizations/org-1/injects': [json(200, { items: [libraryInject] })],
    'GET /ttx/ttx-1/msel': [json(200, msel)],
    ...extra,
  })
}

function renderLibrary(entry = '/creator/ttx-1/library/injects') {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <InjectLibrary
        organizationId="org-1"
        ttxId={entry.startsWith('/creator') ? 'ttx-1' : null}
        permissions={libraryPermissions(entry.startsWith('/creator'))}
      />
    </MemoryRouter>,
  )
}

describe('InjectLibrary', () => {
  beforeEach(() => {
    mockAuth.activeTtx = { id: 'ttx-1', needs_form_status: 'approved' }
    mockAuth.ttxList = [{ id: 'ttx-1', content_language: 'en' }]
  })

  it('duplicates a TTX-Zone inject into the organization, remembering its origin', async () => {
    const fetchMock = baseRoutes({
      'POST /organizations/org-1/injects': [json(201, { ...libraryInject, id: 'lib-2' })],
    })
    renderLibrary('/admin/library/injects')

    await screen.findByText('INJ-RAN-02')
    await screen.findByText('Fictitious threat actor')
    expect(screen.getByRole('columnheader', { name: 'Available in' })).toBeInTheDocument()
    expect(screen.getAllByRole('cell', { name: 'English, Spanish' }).length).toBeGreaterThan(0)
    fireEvent.click(screen.getByLabelText('Duplicate Ransom note with a countdown'))
    fireEvent.click(screen.getByRole('button', { name: 'To my organization · English' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-1/injects'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const sent = body(fetchMock, 'POST /organizations/org-1/injects')
    expect(sent.title).toBe('Ransom note with a countdown_copy')
    expect(sent.language).toBe('en')
    expect([sent.origin, sent.origin_id]).toEqual(['system', 'INJ-RAN-02'])
    expect([sent.actor_name, sent.actor_origin_id]).toEqual([
      'Fictitious threat actor',
      'threat-actor',
    ])
    expect(sent.variable_defaults.ransom_amount).toBe('USD 4.5 million')
    expect(await screen.findByText(/copied to your organization/)).toBeInTheDocument()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Title')).toHaveAccessibleDescription('Organization')
  })

  it('adds a TTX-Zone inject to the MSEL with its phase, objectives and scenario details', async () => {
    const after = {
      ...msel,
      injects: [...msel.injects, { ...msel.injects[0], id: 'inj-2', code: 'INJ-02' }],
    }
    const fetchMock = baseRoutes({
      'POST /ttx/ttx-1/msel/injects': [
        json(201, { msel: after, conversion: { replaced: [], removed: [] } }),
      ],
    })
    renderLibrary()

    await screen.findByText('INJ-RAN-02')
    fireEvent.click(screen.getByLabelText('Duplicate Ransom note with a countdown'))
    fireEvent.click(screen.getByRole('button', { name: 'To this exercise' }))

    const dialog = await screen.findByRole('dialog')
    // Escalation stage -> the second phase, as it opens: 0 minutes into it,
    // T+00:45 in the session.
    expect(await within(dialog).findByLabelText('Phase')).toHaveValue('ph-2')
    expect(within(dialog).getByLabelText('Minutes after the phase starts')).toHaveValue(0)
    expect(dialog).toHaveTextContent('In the session: T+00:45.')
    // Proposed by capability.
    expect(within(dialog).getByRole('checkbox', { name: /OBJ-01/ })).toBeChecked()
    expect(within(dialog).getByRole('checkbox', { name: /OBJ-02/ })).not.toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add to the MSEL' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const sent = body(fetchMock, 'POST /ttx/ttx-1/msel/injects')
    expect(sent.content).toBe('The Nebula group demands USD 4.5 million from Acme Energy.')
    expect(sent.phase_id).toBe('ph-2')
    expect(sent.objective_ids).toEqual(['obj-1'])
    // 240 scenario minutes at 60 per session minute.
    expect(sent.expected_actions[0].expected_within_minutes).toBe(4)
    expect(sent.facilitator_notes).toBe("Key question: Do we open the attacker's chat?")
    expect(sent.sender).toMatchObject({ origin: 'system', origin_id: 'threat-actor' })
    expect(await screen.findByText(/added to the MSEL as INJ-02/)).toBeInTheDocument()
  })

  it('creates, edits and deletes the organization’s own injects', async () => {
    const fetchMock = baseRoutes({
      'POST /organizations/org-1/injects': [json(201, { ...libraryInject, id: 'lib-2' })],
      'PATCH /organizations/org-1/injects/lib-1': [json(200, libraryInject)],
      'GET /organizations/org-1/injects/lib-1/usage': [json(200, freeUsage)],
      'DELETE /organizations/org-1/injects/lib-1': [
        json(200, { result: 'deleted', usage: freeUsage }),
      ],
    })
    renderLibrary('/admin/library/injects?tab=organization')

    expect(await screen.findByText('Board asks for a briefing')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'New inject' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Regulator calls' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(body(fetchMock, 'POST /organizations/org-1/injects').title).toBe('Regulator calls'),
    )

    fireEvent.click(await screen.findByLabelText('Edit Board asks for a briefing'))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Board chair calls' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() =>
      expect(body(fetchMock, 'PATCH /organizations/org-1/injects/lib-1').title).toBe(
        'Board chair calls',
      ),
    )

    // Nothing uses it: deleted for good.
    fireEvent.click(await screen.findByLabelText('Delete Board asks for a briefing'))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText(/Nothing uses it/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/organizations/org-1/injects/lib-1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })

  it('lists the MSEL’s injects, editing them in the MSEL and deleting them here', async () => {
    const fetchMock = baseRoutes({ 'DELETE /ttx/ttx-1/msel/injects/inj-1': [json(204, null)] })
    renderLibrary('/creator/ttx-1/library/injects?tab=exercise')

    expect(await screen.findByText('INJ-01')).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'PH-01 Detection' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit SOC alert in the MSEL' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/msel?tab=injects&inject=inj-1',
    )

    fireEvent.click(screen.getByLabelText('Delete SOC alert'))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('The MSEL goes back to draft.')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/ttx/ttx-1/msel/injects/inj-1'),
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
  })

  it('in Creator, only copies the organization’s injects into the exercise', async () => {
    baseRoutes()
    renderLibrary('/creator/ttx-1/library/injects?tab=organization')

    expect(await screen.findByText('Board asks for a briefing')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New inject' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Edit Board asks for a briefing')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Duplicate Board asks for a briefing'))
    expect(screen.queryByRole('button', { name: 'To my organization' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'To this exercise' })).toBeInTheDocument()

    // Read-only view: no Save.
    fireEvent.click(screen.getByLabelText('View Board asks for a briefing'))
    expect(screen.getByLabelText('Title')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('copies a TTX-Zone inject in the exercise’s language, whatever the UI’s', async () => {
    mockAuth.ttxList = [{ id: 'ttx-1', content_language: 'es' }]
    const fetchMock = baseRoutes({
      'POST /ttx/ttx-1/msel/injects': [
        json(201, { msel, conversion: { replaced: [], removed: [] } }),
      ],
    })
    renderLibrary()

    await screen.findByText('INJ-RAN-02')
    fireEvent.click(screen.getByLabelText('Duplicate Ransom note with a countdown'))
    fireEvent.click(screen.getByRole('button', { name: 'To this exercise' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveTextContent(/is written in/)
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Add to the MSEL' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const sent = body(fetchMock, 'POST /ttx/ttx-1/msel/injects')
    expect(sent.title).toBe('Nota de rescate con cuenta atrás')
    expect(sent.content).toBe('El grupo Nébula exige 4,5 millones de dólares a Acme Energy.')
    // Its illustration comes along in the same language.
    expect(sent.language).toBe('es')
  })

  it('marks the injects that come with images and shows them in the detail', async () => {
    baseRoutes()
    renderLibrary('/admin/library/injects')

    const code = await screen.findByText('INJ-RAN-02')
    const row = code.closest('tr') as HTMLElement
    expect(within(row).getByTitle('1 image')).toHaveTextContent('1')
    fireEvent.click(within(row).getByLabelText(/^View INJ-RAN-02/))

    const dialog = await screen.findByRole('dialog')
    const image = within(dialog).getByRole('img', { name: 'Fictitious ransom note' })
    expect(image).toHaveAttribute('src', '/api/v1/inject-catalog/INJ-RAN-02/images/0?lang=en')
  })

  it('shows each organization inject’s language and says when it isn’t the exercise’s', async () => {
    mockAuth.ttxList = [{ id: 'ttx-1', content_language: 'es' }]
    baseRoutes()
    renderLibrary('/creator/ttx-1/library/injects?tab=organization')

    const row = (await screen.findByText('Board asks for a briefing')).closest('tr')!
    expect(within(row).getByText('English')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Duplicate Board asks for a briefing'))
    fireEvent.click(screen.getByRole('button', { name: 'To this exercise' }))
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent(
      'This inject is written in English and this exercise in Spanish: adapt its text in the MSEL if needed.',
    )
  })

  it('never duplicates an MSEL inject from Creator', async () => {
    baseRoutes()
    renderLibrary('/creator/ttx-1/library/injects?tab=exercise')

    expect(await screen.findByText('SOC alert')).toBeInTheDocument()
    expect(screen.queryByLabelText('Duplicate SOC alert')).not.toBeInTheDocument()
  })
})
