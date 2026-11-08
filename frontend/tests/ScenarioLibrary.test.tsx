import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ScenarioLibrary } from '../src/components/templates/ScenarioLibrary'
import { libraryPermissions } from '../src/lib/libraryLevels'
import { render } from './testUtils'

const mockAuth = {
  activeTtx: { id: 'ttx-1', name: 'Q4 drill' },
  activeOrganization: { organization_name: 'Acme Energy', alias: 'ACME' },
  ttxList: [{ id: 'ttx-1', code: 'TTX-2026-01', name: 'Q4 drill' }],
  refresh: vi.fn(async () => {}),
  setActiveTtxId: vi.fn(),
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

const counts = {
  needs: 3,
  objectives: 3,
  phases: 3,
  injects: 6,
  actors: 5,
  threat_actors: 1,
  tags: 3,
  images: 0,
}
const ransomware = {
  id: 'ransomware',
  name: 'Ransomware with double extortion',
  description: 'A criminal group encrypts the core systems.',
  language: 'en',
  languages: ['en', 'es'],
  format_version: 1,
  attack_version: '19.2',
  counts,
  origin: null,
  origin_id: null,
  origin_name: null,
  disabled_at: null,
  usage_count: 0,
  created_at: null,
  updated_at: null,
}
const ours = {
  ...ransomware,
  id: 'org-sc-1',
  name: 'Our ransomware',
  languages: ['en'],
  origin: 'system',
}
const empty = { ...counts, needs: 0, objectives: 0, phases: 0, injects: 0, actors: 4, tags: 0 }

function renderLibrary(entry: string) {
  const creator = entry.startsWith('/creator')
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ScenarioLibrary
        organizationId="org-1"
        ttxId={creator ? 'ttx-1' : null}
        permissions={libraryPermissions(creator)}
      />
    </MemoryRouter>,
  )
}

const routes = (extra: Record<string, Response[]> = {}) =>
  stubApi({
    'GET /scenario-catalog': [json(200, { items: [ransomware] })],
    'GET /organizations/org-1/scenarios': [json(200, { items: [ours] })],
    'GET /ttx/ttx-1/scenario': [json(200, { ...empty, played: false })],
    ...extra,
  })

describe('ScenarioLibrary', () => {
  it('in Admin, duplicates a TTX-Zone scenario into the organization only', async () => {
    const fetchMock = routes({
      'POST /organizations/org-1/scenarios': [json(201, { ...ours, name: 'Ransomware_copy' })],
    })
    renderLibrary('/admin/library/scenarios')

    fireEvent.click(await screen.findByLabelText('Duplicate Ransomware with double extortion'))
    expect(screen.queryByRole('button', { name: 'Replace this exercise…' })).not.toBeInTheDocument()
    // The library holds one language: it's picked here, not by the profile.
    fireEvent.click(screen.getByRole('button', { name: 'To my organization · Spanish' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/organizations/org-1/scenarios',
        expect.objectContaining({
          method: 'POST',
          body: '{"system_id":"ransomware","language":"es"}',
        }),
      ),
    )
    // The copy opens for editing right away.
    expect(await screen.findByRole('dialog', { name: 'Edit Ransomware_copy' })).toBeInTheDocument()
  })

  it('shows the languages a scenario exists in, not the reader’s', async () => {
    routes()
    renderLibrary('/admin/library/scenarios')

    expect(await screen.findByRole('columnheader', { name: 'Available in' })).toBeInTheDocument()
    expect(await screen.findByRole('cell', { name: 'English, Spanish' })).toBeInTheDocument()
  })

  it('copies a TTX-Zone scenario in the exercise’s language, or the one chosen', async () => {
    mockAuth.ttxList = [{ ...mockAuth.ttxList[0], content_language: 'es' }]
    const fetchMock = routes({
      'POST /ttx/ttx-1/scenario/apply': [
        json(200, { ok: true, errors: [], warnings: [], counts, replaces: empty, variables: [] }),
      ],
    })
    renderLibrary('/creator/ttx-1/library/scenarios')

    fireEvent.click(await screen.findByLabelText('Duplicate Ransomware with double extortion'))
    fireEvent.click(screen.getByRole('button', { name: 'Replace this exercise…' }))
    const dialog = await screen.findByRole('dialog')
    const sent = () => fetchMock.mock.calls.at(-1)?.[1]?.body
    await waitFor(() =>
      expect(sent()).toBe('{"source":"system","id":"ransomware","language":"es"}'),
    )
    await within(dialog).findByText(/No errors found/)

    fireEvent.change(within(dialog).getByLabelText('Language of the copy'), {
      target: { value: 'en' },
    })
    await waitFor(() =>
      expect(sent()).toBe('{"source":"system","id":"ransomware","language":"en"}'),
    )
    expect(await within(dialog).findByText(/No errors found/)).toBeInTheDocument()
    mockAuth.ttxList = [{ id: 'ttx-1', code: 'TTX-2026-01', name: 'Q4 drill' }]
  })

  it('says which exercise it speaks about and what each action does to it', async () => {
    routes()
    renderLibrary('/creator/ttx-1/library/scenarios?tab=exercise')

    expect(await screen.findByRole('heading', { name: 'Q4 drill' })).toBeInTheDocument()
    expect(await screen.findByRole('link', { name: 'Export file' })).toBeInTheDocument()
    expect(screen.getByText(/Deletes what “Q4 drill” has designed/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace from a file' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Create from a file' })).toBeEnabled()
    // Saving to the organization is a Program Manager's.
    expect(
      screen.queryByRole('button', { name: 'Save to my organization' }),
    ).not.toBeInTheDocument()
  })

  it('a played exercise can’t be replaced, and says so before any file', async () => {
    routes({ 'GET /ttx/ttx-1/scenario': [json(200, { ...empty, played: true })] })
    renderLibrary('/creator/ttx-1/library/scenarios?tab=exercise')

    expect(await screen.findByRole('button', { name: 'Replace from a file' })).toBeDisabled()
    expect(screen.getByText(/its sessions keep the design they ran/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create from a file' })).toBeEnabled()
  })

  it('a Program Manager saves the exercise to the organization from here', async () => {
    const fetchMock = routes({
      'POST /organizations/org-1/scenarios': [json(201, ours)],
    })
    render(
      <MemoryRouter initialEntries={['/creator/ttx-1/library/scenarios?tab=exercise']}>
        <ScenarioLibrary
          organizationId="org-1"
          ttxId="ttx-1"
          permissions={{ ...libraryPermissions(true), saveToOrganization: true }}
        />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Save to my organization' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/organizations/org-1/scenarios',
        expect.objectContaining({ method: 'POST', body: '{"ttx_id":"ttx-1"}' }),
      ),
    )
  })

  it('makes a new exercise from a scenario without touching the one in context', async () => {
    const report = { ok: true, errors: [], warnings: [], name: 'Ransomware', counts, variables: [] }
    const fetchMock = routes({
      'POST /organizations/org-1/exercises/from-scenario': [
        json(200, { ...report, language: 'en', replaces: null }),
        json(201, { ...report, language: 'en', replaces: null, ttx_id: 'ttx-2' }),
      ],
    })
    renderLibrary('/creator/ttx-1/library/scenarios')

    fireEvent.click(await screen.findByLabelText('Duplicate Ransomware with double extortion'))
    fireEvent.click(screen.getByRole('button', { name: 'To a new exercise' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Scenario: Ransomware · English')).toBeInTheDocument()
    // Nothing is lost: no warning, no name to type.
    expect(within(dialog).queryByText(/This replaces everything/)).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create exercise' }))

    await waitFor(() => expect(mockAuth.setActiveTtxId).toHaveBeenCalledWith('ttx-2'))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/organizations/org-1/exercises/from-scenario?dry_run=false',
      expect.objectContaining({ method: 'POST' }),
    )
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/scenario/apply'))).toBe(
      false,
    )
  })

  it('in Admin, manages the organization’s scenarios', async () => {
    routes()
    renderLibrary('/admin/library/scenarios?tab=organization')

    expect(await screen.findByText('Our ransomware')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add from a file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /From an exercise/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Export Our ransomware')).toBeInTheDocument()
    expect(screen.getByLabelText('Edit Our ransomware')).toBeInTheDocument()
    expect(screen.getByLabelText('Delete Our ransomware')).toBeInTheDocument()
  })

  it('in Creator, the organization’s scenarios are only copied onto the exercise', async () => {
    routes()
    renderLibrary('/creator/ttx-1/library/scenarios?tab=organization')

    expect(await screen.findByText('Our ransomware')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add from a file' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Edit Our ransomware')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Export Our ransomware')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Duplicate Our ransomware'))
    expect(screen.queryByRole('button', { name: 'To my organization' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replace this exercise…' })).toBeInTheDocument()
  })

  it('checks first, warns, and overwrites only once the exercise name is typed', async () => {
    const fetchMock = routes({
      'POST /ttx/ttx-1/scenario/apply': [
        json(200, {
          ok: true,
          errors: [],
          warnings: [],
          name: 'Our ransomware',
          counts,
          replaces: empty,
        }),
        json(200, {
          ok: true,
          errors: [],
          warnings: [],
          name: 'Our ransomware',
          counts,
          replaces: empty,
        }),
      ],
    })
    renderLibrary('/creator/ttx-1/library/scenarios?tab=organization')

    fireEvent.click(await screen.findByLabelText('Duplicate Our ransomware'))
    fireEvent.click(screen.getByRole('button', { name: 'Replace this exercise…' }))
    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/No errors found/)).toBeInTheDocument()
    expect(
      within(dialog).getByText(/This replaces everything “Q4 drill” has designed/),
    ).toBeInTheDocument()
    const overwrite = within(dialog).getByRole('button', { name: 'Replace exercise' })
    expect(overwrite).toBeDisabled()
    // Only the dry run so far.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('dry_run=false'))).toEqual(
      [],
    )

    fireEvent.change(within(dialog).getByLabelText('Type “Q4 drill” to confirm'), {
      target: { value: 'Q4 drill' },
    })
    fireEvent.click(overwrite)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/scenario/apply?dry_run=false',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    await waitFor(() => expect(mockAuth.refresh).toHaveBeenCalled())
  })

  it('a file with errors stops at the check', async () => {
    const fetchMock = routes({
      'POST /ttx/ttx-1/scenario/import': [
        json(200, {
          ok: false,
          errors: [
            {
              path: 'msel.injects[0].phase_code',
              code: 'SCENARIO_UNKNOWN_REFERENCE',
              message: 'INJ-01 names PH-99, which isn’t a phase of the scenario.',
            },
          ],
          warnings: [],
          name: null,
          counts: null,
          replaces: null,
        }),
      ],
    })
    renderLibrary('/creator/ttx-1/library/scenarios?tab=exercise')

    fireEvent.click(await screen.findByRole('button', { name: 'Replace from a file' }))
    const dialog = screen.getByRole('dialog')
    const file = new File(['---'], 'shared.ttx.md', { type: 'text/markdown' })
    fireEvent.change(within(dialog).getByLabelText('Scenario file (.ttx.md)'), {
      target: { files: [file] },
    })

    expect(await within(dialog).findByText(/which isn’t a phase/)).toBeInTheDocument()
    expect(within(dialog).getByText('msel.injects[0].phase_code')).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Replace exercise' }),
    ).not.toBeInTheDocument()
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('dry_run=false'))).toEqual(
      [],
    )
  })

  it('offers the scenario’s placeholders, proposes the organization, and sends the values', async () => {
    const check = {
      ok: true,
      errors: [],
      warnings: [],
      name: 'Our ransomware',
      counts,
      replaces: empty,
      variables: [
        { name: 'country_1', count: 1 },
        { name: 'supplier', count: 12 },
        { name: 'group_name', count: 12 },
      ],
    }
    const fetchMock = routes({
      'POST /ttx/ttx-1/scenario/apply': [json(200, check), json(200, check)],
    })
    renderLibrary('/creator/ttx-1/library/scenarios?tab=organization')

    fireEvent.click(await screen.findByLabelText('Duplicate Our ransomware'))
    fireEvent.click(screen.getByRole('button', { name: 'Replace this exercise…' }))
    const dialog = await screen.findByRole('dialog')
    const group = await within(dialog).findByRole('textbox', { name: /\{group_name\}/ })
    expect(group).toHaveValue('Acme Energy')
    expect(within(dialog).getAllByText('used 12 times')).toHaveLength(2)
    // Most used first (the exercise's core), ties alphabetically.
    expect(
      within(dialog)
        .getAllByRole('textbox')
        .map((input) => input.getAttribute('name'))
        .filter((name) => ['group_name', 'supplier', 'country_1'].includes(name ?? '')),
    ).toEqual(['group_name', 'supplier', 'country_1'])
    fireEvent.change(within(dialog).getByRole('textbox', { name: /\{country_1\}/ }), {
      target: { value: 'Freedonia' },
    })
    fireEvent.change(within(dialog).getByLabelText('Type “Q4 drill” to confirm'), {
      target: { value: 'Q4 drill' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace exercise' }))

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([url]) => String(url).includes('dry_run=false'))
      expect(JSON.parse(String(call?.[1]?.body)).variables).toEqual({
        group_name: 'Acme Energy',
        supplier: '',
        country_1: 'Freedonia',
      })
    })
  })
})
