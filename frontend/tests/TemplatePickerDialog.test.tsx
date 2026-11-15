import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CreatorExerciseCreateSection } from '../src/components/creator/CreatorExerciseCreateSection'
import { render } from './testUtils'

const mockAuth = {
  activeTtx: null,
  activeOrganizationId: 'org-1',
  activeOrganization: { organization_name: 'Acme Energy', alias: 'ACME' },
  ttxList: [],
  refresh: vi.fn(async () => {}),
  setActiveTtxId: vi.fn(),
}
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => mockAuth }))

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
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
const template = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  description: `${name}, described.`,
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
  ...extra,
})

function stubApi() {
  const report = { ok: true, errors: [], warnings: [], name: 'Ransomware', counts, variables: [] }
  const fromScenario = [
    json(200, { ...report, language: 'en', replaces: null }),
    json(201, { ...report, language: 'en', replaces: null, ttx_id: 'ttx-2' }),
  ]
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('/api/v1', '').split('?')[0]
    if (path === '/scenario-catalog') {
      return json(200, { items: [template('ransomware', 'Ransomware with double extortion')] })
    }
    if (path === '/organizations/org-1/scenarios') {
      return json(200, {
        items: [
          template('org-1', 'Our phishing drill', { languages: ['en'] }),
          template('org-2', 'Retired drill', { disabled_at: '2026-10-01T00:00:00Z' }),
        ],
      })
    }
    if (path === '/organizations/org-1/exercises/from-scenario' && init?.method === 'POST') {
      return fromScenario.length > 1 ? fromScenario.shift()! : fromScenario[0]
    }
    // The form's own lookups (language options, tags…): nothing.
    return json(200, { items: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('New exercise from an exercise template', () => {
  it('offers it as a secondary way in, next to the form', () => {
    stubApi()
    render(<CreatorExerciseCreateSection />)
    expect(screen.getByText(/Or start from an exercise template/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Choose from the library' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Import a .ttx.md file' })).toBeInTheDocument()
    // The form stays the main path.
    expect(screen.getByRole('button', { name: 'Create exercise' })).toBeInTheDocument()
  })

  it('lists TTX-Zone’s and the organization’s templates, searchable, leaving out disabled ones', async () => {
    stubApi()
    render(<CreatorExerciseCreateSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose from the library' }))

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Ransomware with double extortion')).toBeInTheDocument()
    expect(await within(dialog).findByText('Our phishing drill')).toBeInTheDocument()
    expect(within(dialog).queryByText('Retired drill')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: 'TTX-Zone' })).toBeInTheDocument()
    expect(within(dialog).getByRole('region', { name: 'My organization' })).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Search'), { target: { value: 'phishing' } })
    expect(within(dialog).queryByText('Ransomware with double extortion')).not.toBeInTheDocument()
    expect(within(dialog).getByText('Our phishing drill')).toBeInTheDocument()

    fireEvent.change(within(dialog).getByLabelText('Search'), {
      target: { value: 'nothing like it' },
    })
    expect(within(dialog).getByText('No exercise templates match.')).toBeInTheDocument()
  })

  it('creates the exercise from the template picked', async () => {
    const fetchMock = stubApi()
    render(<CreatorExerciseCreateSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Choose from the library' }))
    const picker = await screen.findByRole('dialog')
    fireEvent.click(
      await within(picker).findByRole('button', { name: 'Use Ransomware with double extortion' }),
    )

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText(/Template: Ransomware/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create exercise' }))

    await waitFor(() => expect(mockAuth.setActiveTtxId).toHaveBeenCalledWith('ttx-2'))
    const created = fetchMock.mock.calls.find(([url]) =>
      String(url).endsWith('/exercises/from-scenario?dry_run=false'),
    )
    expect(JSON.parse(String(created?.[1]?.body))).toMatchObject({
      source: 'system',
      id: 'ransomware',
    })
  })
})
