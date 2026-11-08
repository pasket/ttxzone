import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ThreatActorLibrary } from '../src/components/templates/ThreatActorLibrary'
import { matchesGroup, techniquesByTactic } from '../src/lib/threatActors'
import type { AttackCatalog } from '../src/lib/types'
import { render } from './testUtils'
import { libraryPermissions } from '../src/lib/libraryLevels'

const mockAuth = { activeTtx: { id: 'ttx-1', needs_form_status: 'approved' } }
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

const attack: AttackCatalog = {
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
        { id: 'TA0011', name: 'Command and Control' },
      ],
      techniques: [
        { id: 'T1566', name: 'Phishing', tactics: ['TA0001'], parent: null },
        { id: 'T1566.001', name: 'Spearphishing Attachment', tactics: ['TA0001'], parent: 'T1566' },
        { id: 'T1071', name: 'Application Layer Protocol', tactics: ['TA0011'], parent: null },
        { id: 'T1078', name: 'Valid Accounts', tactics: ['TA0001', 'TA0011'], parent: null },
      ],
    },
  ],
}

const groups = {
  attack_version: '19.2',
  released: '2026-08-05',
  copyright: 'Copyright 2015-2026, The MITRE Corporation.',
  items: [
    {
      id: 'G0007',
      name: 'APT28',
      aliases: ['Fancy Bear', 'Sofacy'],
      techniques: [
        { domain: 'enterprise', technique_id: 'T1566.001' },
        { domain: 'enterprise', technique_id: 'T1071' },
      ],
    },
    { id: 'G0034', name: 'Sandworm Team', aliases: ['ELECTRUM'], techniques: [] },
  ],
}

const copied = {
  id: 'ta-1',
  name: 'APT28_copy',
  mitre_group_id: 'G0007',
  aliases: ['Fancy Bear', 'Sofacy'],
  description: '',
  attack_version: '19.2',
  techniques: [
    {
      domain: 'enterprise',
      technique_id: 'T1566.001',
      technique_name: 'Phishing: Spearphishing Attachment',
      tactic_ids: ['TA0001'],
    },
    {
      domain: 'enterprise',
      technique_id: 'T1071',
      technique_name: 'Application Layer Protocol',
      tactic_ids: ['TA0011'],
    },
  ],
  origin: 'system',
  origin_id: 'G0007',
  origin_name: 'APT28',
  created_at: '2026-10-01T10:00:00+00:00',
  updated_at: '2026-10-01T10:00:00+00:00',
}

function renderLibrary(search = '', ttxId: string | null = null) {
  return render(
    <MemoryRouter initialEntries={[`/admin/library/threats${search}`]}>
      <ThreatActorLibrary
        organizationId="org-1"
        ttxId={ttxId}
        permissions={libraryPermissions(ttxId !== null)}
      />
    </MemoryRouter>,
  )
}

const scenario = {
  editable: true,
  attack_version: '19.2',
  threat_actors: [
    {
      id: 'thr-1',
      code: 'THR-01',
      name: 'Nebula affiliate',
      mitre_group_id: null,
      aliases: [],
      description: '',
      techniques: [],
      origin: 'exercise',
      origin_id: null,
      origin_name: null,
    },
  ],
  injects: [{ id: 'inj-1', threat_actor_id: 'thr-1' }],
}

describe('threat actor helpers', () => {
  it('finds a group by id, name or associated group', () => {
    const apt28 = groups.items[0] as never
    expect(matchesGroup(apt28, 'g0007')).toBe(true)
    expect(matchesGroup(apt28, 'fancy')).toBe(true)
    expect(matchesGroup(apt28, 'sandworm')).toBe(false)
  })

  it('groups a profile by tactic, in matrix order, with sub-technique names', () => {
    const grouped = techniquesByTactic(groups.items[0].techniques as never, attack)
    expect(grouped.map((g) => g.tacticName)).toEqual(['Initial Access', 'Command and Control'])
    expect(grouped[0].techniques).toEqual([
      { id: 'T1566.001', name: 'Phishing: Spearphishing Attachment' },
    ])
  })
})

describe('ThreatActorLibrary', () => {
  it('lists MITRE groups, searchable by an associated group', async () => {
    stubApi({
      'GET /threat-actor-catalog': [json(200, groups)],
      'GET /organizations/org-1/threat-actors': [json(200, { items: [] })],
    })
    renderLibrary()

    expect(await screen.findByRole('cell', { name: /APT28/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'G0034' })).toHaveAttribute(
      'href',
      'https://attack.mitre.org/versions/v19/groups/G0034/',
    )
    expect(screen.getByText(/The MITRE Corporation/)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'electrum' } })
    expect(screen.queryByRole('cell', { name: /APT28/ })).toBeNull()
    expect(screen.getByRole('cell', { name: /Sandworm Team/ })).toBeInTheDocument()
  })

  it('shows a group’s techniques by tactic, read-only', async () => {
    stubApi({
      'GET /threat-actor-catalog': [json(200, groups)],
      'GET /organizations/org-1/threat-actors': [json(200, { items: [] })],
      'GET /attack/19.2': [json(200, attack)],
    })
    renderLibrary()

    fireEvent.click(await screen.findByRole('button', { name: 'View APT28' }))

    const dialog = screen.getByRole('dialog', { name: 'G0007 · APT28' })
    expect(await within(dialog).findByText('Initial Access')).toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: /T1566.001/ })).toHaveAttribute(
      'href',
      'https://attack.mitre.org/versions/v19/techniques/T1566/001/',
    )
    expect(within(dialog).getByText('Fancy Bear, Sofacy', { exact: false })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: 'Save' })).toBeNull()
  })

  it('duplicates a MITRE group with no techniques; its picker filters on MITRE’s, none ticked', async () => {
    const fetchMock = stubApi({
      'GET /threat-actor-catalog': [json(200, groups)],
      'GET /organizations/org-1/threat-actors': [
        json(200, { items: [] }),
        json(200, { items: [{ ...copied, techniques: [] }] }),
      ],
      'POST /organizations/org-1/threat-actors': [json(201, { ...copied, techniques: [] })],
      'GET /attack/19.2': [json(200, attack)],
    })
    renderLibrary()

    const menu = (await screen.findByLabelText('Duplicate APT28')).closest('details')!
    fireEvent.click(within(menu).getByRole('button', { name: 'To my organization' }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(JSON.parse(post![1]!.body as string)).toMatchObject({
        name: 'APT28_copy',
        mitre_group_id: 'G0007',
        origin: 'system',
        origin_id: 'G0007',
        techniques: [],
      })
    })
    const dialog = await screen.findByRole('dialog', { name: 'Edit APT28_copy' })
    expect(within(dialog).getByDisplayValue('TTX-Zone · APT28')).toBeInTheDocument()

    const choose = within(dialog).getByRole('button', { name: 'Choose techniques' })
    await waitFor(() => expect(choose).toBeEnabled())
    fireEvent.click(choose)
    const picker = await screen.findByRole('dialog', { name: 'Techniques of APT28_copy' })
    const onlyTechniques = await within(picker).findByRole('checkbox', {
      name: 'Only APT28_copy’s techniques (2)',
    })
    expect(onlyTechniques).toBeChecked()
    const spearphishing = within(picker).getByRole('checkbox', {
      name: /Spearphishing Attachment/,
    })
    expect(spearphishing).not.toBeChecked()
    expect(within(picker).getByText('0 techniques selected')).toBeInTheDocument()

    // A technique serving two tactics is found once, with both tactics.
    fireEvent.click(onlyTechniques)
    fireEvent.change(within(picker).getByRole('searchbox'), { target: { value: 'T1078' } })
    const valid = within(picker).getAllByRole('checkbox', { name: /Valid Accounts/ })
    expect(valid).toHaveLength(1)
    expect(within(picker).getByText('Initial Access · Command and Control')).toBeInTheDocument()
    fireEvent.click(valid[0])
    expect(within(picker).getByText('1 technique selected')).toBeInTheDocument()
  })

  it('creates an unknown actor with no techniques', async () => {
    const fetchMock = stubApi({
      'GET /threat-actor-catalog': [json(200, groups)],
      'GET /organizations/org-1/threat-actors': [json(200, { items: [] })],
      'POST /organizations/org-1/threat-actors': [
        json(201, { ...copied, id: 'ta-2', name: 'Unknown actor A', mitre_group_id: null }),
      ],
      'GET /attack/19.2': [json(200, attack)],
    })
    renderLibrary('?tab=organization')

    fireEvent.click(await screen.findByRole('button', { name: 'New unknown actor' }))
    const dialog = screen.getByRole('dialog', { name: 'New unknown actor' })
    expect(within(dialog).getByText(/No techniques/)).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Unknown actor A' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
      expect(JSON.parse(post![1]!.body as string)).toMatchObject({
        name: 'Unknown actor A',
        mitre_group_id: null,
        attack_version: '19.2',
        techniques: [],
      })
    })
  })

  it('adds a MITRE group to the exercise’s scenario, and lists and removes its threat actors', async () => {
    const fetchMock = stubApi({
      'GET /threat-actor-catalog': [json(200, groups)],
      'GET /organizations/org-1/threat-actors': [json(200, { items: [] })],
      'GET /ttx/ttx-1/msel': [
        json(200, scenario),
        json(200, {
          ...scenario,
          threat_actors: [
            ...scenario.threat_actors,
            { ...scenario.threat_actors[0], id: 'thr-2', code: 'THR-02', name: 'APT28' },
          ],
        }),
      ],
      'POST /ttx/ttx-1/msel/threat-actors': [
        json(201, {
          actor: {
            ...scenario.threat_actors[0],
            id: 'thr-2',
            name: 'APT28',
            mitre_group_id: 'G0007',
          },
          conversion: { replaced: [], removed: [] },
        }),
      ],
      'DELETE /ttx/ttx-1/msel/threat-actors/thr-1': [json(204, null)],
    })
    renderLibrary('', 'ttx-1')

    const menu = (await screen.findByLabelText('Duplicate APT28')).closest('details')!
    await waitFor(() =>
      expect(within(menu).getByRole('button', { name: 'To this exercise' })).toBeInTheDocument(),
    )
    fireEvent.click(within(menu).getByRole('button', { name: 'To this exercise' }))

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
      // A use, not a duplicate: its own name, no `_copy`.
      expect(JSON.parse(post![1]!.body as string)).toMatchObject({
        name: 'APT28',
        mitre_group_id: 'G0007',
        origin: 'system',
      })
    })
    expect(await screen.findByRole('cell', { name: /THR-02 APT28/ })).toBeInTheDocument()
    const nebula = screen.getByRole('row', { name: /THR-01 Nebula affiliate/ })
    expect(
      within(nebula).getByRole('link', { name: 'Edit Nebula affiliate in the MSEL' }),
    ).toHaveAttribute('href', '/creator/ttx-1/msel?tab=threats')

    fireEvent.click(
      within(nebula).getByRole('button', { name: 'Remove Nebula affiliate from the scenario' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, init]) =>
            init?.method === 'DELETE' && String(url).endsWith('/msel/threat-actors/thr-1'),
        ),
      ).toBe(true),
    )
  })

  it('brings the organization’s threat actors up to the latest ATT&CK release', async () => {
    const outdated = { ...copied, attack_version: '18.1' }
    const fetchMock = stubApi({
      'GET /threat-actor-catalog': [json(200, groups)],
      'GET /attack': [json(200, { versions: ['18.1', '19.2'], latest_version: '19.2' })],
      'GET /attack/19.2': [json(200, attack)],
      'GET /organizations/org-1/threat-actors': [
        json(200, { items: [outdated] }),
        json(200, { items: [copied] }),
      ],
      'POST /organizations/org-1/threat-actors/attack-upgrade': [
        json(200, {
          attack_version: '19.2',
          upgraded: 1,
          conversion: { replaced: [{ from_id: 'T1566', to_id: 'T1566.001' }], removed: [] },
        }),
      ],
    })
    renderLibrary('?tab=organization')

    expect(
      await screen.findByText('1 item uses an older ATT&CK release than v19.2'),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Update to v19.2' }))

    expect(
      await screen.findByText('1 item updated to ATT&CK v19.2. 1 replaced: T1566 → T1566.001.'),
    ).toBeInTheDocument()
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          init?.method === 'POST' && String(url).endsWith('/threat-actors/attack-upgrade'),
      ),
    ).toBe(true)
    await waitFor(() => expect(screen.queryByText(/older ATT&CK release/)).not.toBeInTheDocument())
  })
})
