import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ActorLibrary } from '../src/components/templates/ActorLibrary'
import { render } from './testUtils'
import { libraryPermissions } from '../src/lib/libraryLevels'

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

const catalog = {
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
}

const regulator = {
  id: 'org-actor-1',
  name: 'Regional CERT',
  type: 'csirt',
  description: 'Our sector CERT.',
  channel: 'email',
  origin: null,
  origin_id: null,
  created_at: '2026-09-29T10:00:00+00:00',
  updated_at: '2026-09-29T10:00:00+00:00',
}

const soc = {
  id: 'act-1',
  code: 'ACT-01',
  name: 'SOC',
  type: 'soc',
  description: '',
  channel: 'chat',
  origin: 'system',
  origin_id: 'soc',
  origin_name: 'SOC',
  played_by: 'Controller',
  in_use: true,
}

function renderLibrary(
  ttxId: string | null,
  entry = '/creator/ttx-1/library',
  programManager = false,
) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ActorLibrary
        organizationId="org-1"
        ttxId={ttxId}
        permissions={libraryPermissions(entry.startsWith('/creator'), programManager)}
      />
    </MemoryRouter>,
  )
}

describe('ActorLibrary', () => {
  it("saves an exercise actor to the organization's library for a Program Manager", async () => {
    const own = { ...soc, id: 'act-2', code: 'ACT-02', name: 'Plant manager', origin: 'exercise' }
    const fromOrganization = {
      ...soc,
      name: 'Regional CERT',
      origin: 'organization',
      origin_id: 'org-actor-1',
      origin_name: 'Regional CERT',
    }
    const fetchMock = stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [json(200, { items: [] })],
      'GET /ttx/ttx-1/actors': [json(200, { items: [fromOrganization, own] })],
      'POST /organizations/org-1/actors': [
        json(201, { ...regulator, id: 'org-actor-9', name: 'Plant manager' }),
      ],
      'PATCH /ttx/ttx-1/actors/act-2': [json(200, own)],
    })
    renderLibrary('ttx-1', '/creator/ttx-1/library?tab=exercise', true)

    expect(await screen.findByText('Plant manager')).toBeInTheDocument()
    // Already a copy of an organization actor: nothing to save.
    expect(
      screen.queryByRole('button', { name: "Save Regional CERT to the organization's library" }),
    ).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: "Save Plant manager to the organization's library" }),
    )

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/actors/act-2',
        expect.objectContaining({ method: 'PATCH' }),
      ),
    )
    const [, post] = fetchMock.mock.calls.find(([url, init]) => {
      return url === '/api/v1/organizations/org-1/actors' && init?.method === 'POST'
    })!
    // The same actor, not a `_copy`, copied from the exercise.
    expect(JSON.parse(post!.body as string)).toMatchObject({
      name: 'Plant manager',
      origin: 'exercise',
      origin_id: 'act-2',
    })
    const [, patch] = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    // The exercise's actor is now a copy of the library one.
    expect(JSON.parse(patch!.body as string)).toMatchObject({
      origin: 'organization',
      origin_id: 'org-actor-9',
      origin_name: 'Plant manager',
      played_by: 'Controller',
    })
    expect(
      await screen.findByText("Plant manager saved to the organization's library"),
    ).toBeInTheDocument()
  })

  it('offers no save to the library to an Exercise Planner who is not a Program Manager', async () => {
    stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [json(200, { items: [] })],
      'GET /ttx/ttx-1/actors': [json(200, { items: [{ ...soc, origin: 'exercise' }] })],
    })
    renderLibrary('ttx-1', '/creator/ttx-1/library?tab=exercise')

    expect(await screen.findByRole('button', { name: 'Edit SOC' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /organization's library/ })).toBeNull()
  })

  it('views a TTX-Zone actor read-only, as the catalog item itself', async () => {
    stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [json(200, { items: [] })],
    })
    renderLibrary(null, '/admin/library')
    fireEvent.click(await screen.findByRole('button', { name: 'View Cyber insurer' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Cyber insurer')
    expect(within(dialog).queryByText('Copied from')).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Save/ })).not.toBeInTheDocument()
  })

  it('duplicates a TTX-Zone actor into the organization, remembering its origin', async () => {
    const fetchMock = stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [json(200, { items: [] })],
      'POST /organizations/org-1/actors': [json(201, regulator)],
    })
    renderLibrary(null, '/admin/library')

    // Admin: no exercise in context, so two levels only.
    const levels = await screen.findByRole('group', { name: 'Library level' })
    expect(
      within(levels)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['TTX-Zone', 'My organization'])
    expect(await screen.findByText('Cyber insurer')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Duplicate Cyber insurer'))
    expect(screen.queryByRole('button', { name: /To this exercise/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'To my organization' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/organizations/org-1/actors',
        expect.objectContaining({
          method: 'POST',
          // A duplicate: `_copy` suffix, and what it was copied from.
          body: JSON.stringify({
            name: 'Cyber insurer_copy',
            type: 'other',
            description: 'The insurer.',
            channel: 'phone',
            origin: 'system',
            origin_id: 'cyber-insurer',
            origin_name: 'Cyber insurer',
          }),
        }),
      ),
    )
    expect(
      await screen.findByText("Cyber insurer_copy copied to your organization's library"),
    ).toBeInTheDocument()
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Regional CERT')
    expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription('Organization')
  })

  it("creates the organization's own actors", async () => {
    const fetchMock = stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [
        json(200, { items: [] }),
        json(200, { items: [regulator] }),
      ],
      'POST /organizations/org-1/actors': [json(201, regulator)],
    })
    renderLibrary(null, '/admin/library?tab=organization')

    expect(await screen.findByText(/No actors of your own yet/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'New actor' }))
    const dialog = screen.getByRole('dialog', { name: 'New actor' })
    fireEvent.change(within(dialog).getByLabelText('Name'), {
      target: { value: 'Regional CERT' },
    })
    // A ticket and a security tool are usual channels too.
    const channel = within(dialog).getByLabelText(/Usual channel/)
    expect(within(channel).getByRole('option', { name: 'Ticket' })).toBeInTheDocument()
    fireEvent.change(channel, { target: { value: 'security_tool' } })
    expect(channel).toHaveDisplayValue('Cybersecurity tool')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Regional CERT')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({
      name: 'Regional CERT',
      channel: 'security_tool',
    })
  })

  it('disables an actor still in use, listing the impact, and re-enables it', async () => {
    const usage = {
      exercises: [{ ttx_id: 'ttx-1', name: 'Ransomware drill', copies: 2 }],
      injects: [{ id: 'inj-9', title: 'Regulator asks for an update' }],
      memberships: 0,
      allowed_domains: 0,
      applied_to_organization: false,
      total: 2,
    }
    const disabled = { ...regulator, disabled_at: '2026-10-03T08:00:00+00:00', usage_count: 2 }
    const fetchMock = stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [
        json(200, { items: [{ ...regulator, usage_count: 2 }] }),
        json(200, { items: [disabled] }),
        json(200, { items: [regulator] }),
      ],
      'GET /organizations/org-1/actors/org-actor-1/usage': [json(200, usage)],
      'DELETE /organizations/org-1/actors/org-actor-1': [json(200, { result: 'disabled', usage })],
      'POST /organizations/org-1/actors/org-actor-1/enable': [json(200, regulator)],
    })
    renderLibrary(null, '/admin/library?tab=organization')

    fireEvent.click(await screen.findByLabelText('Delete Regional CERT'))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('Ransomware drill')).toBeInTheDocument()
    expect(within(dialog).getByText(/2 copies/)).toBeInTheDocument()
    expect(within(dialog).getByText('Regulator asks for an update')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Disable' }))

    expect(
      await screen.findByText('Regional CERT is still in use: disabled instead of deleted'),
    ).toBeInTheDocument()
    expect(await screen.findByText('Disabled')).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('Re-enable Regional CERT'))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/organizations/org-1/actors/org-actor-1/enable',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    await waitFor(() => expect(screen.queryByText('Disabled')).not.toBeInTheDocument())
  })

  it('in Creator, only copies the organization’s actors into the exercise', async () => {
    stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [json(200, { items: [regulator] })],
      'GET /ttx/ttx-1/actors': [json(200, { items: [soc] })],
    })
    renderLibrary('ttx-1', '/creator/ttx-1/library?tab=organization')

    expect(await screen.findByText('Regional CERT')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New actor' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Edit Regional CERT')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Delete Regional CERT')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Duplicate Regional CERT'))
    expect(screen.queryByRole('button', { name: 'To my organization' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'To this exercise' })).toBeInTheDocument()

    fireEvent.click(screen.getByLabelText('View Regional CERT'))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByLabelText('Name')).toBeDisabled()
    expect(within(dialog).queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  })

  it('explains when the organization library is closed to the user', async () => {
    stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [apiError(403, 'FORBIDDEN')],
      'GET /ttx/ttx-1/actors': [json(200, { items: [soc] })],
    })
    renderLibrary('ttx-1', '/creator/ttx-1/library?tab=organization')

    expect(
      await screen.findByText(/Only your organization's Program Managers and Exercise Planners/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New actor' })).not.toBeInTheDocument()
  })

  it("manages the exercise's cast, whatever the state of its needs analysis", async () => {
    const fetchMock = stubApi({
      'GET /actor-catalog': [json(200, catalog)],
      'GET /organizations/org-1/actors': [json(200, { items: [] })],
      // No MSEL involved: the cast has its own endpoint.
      'GET /ttx/ttx-1/actors': [json(200, { items: [soc] })],
      'POST /ttx/ttx-1/actors': [json(201, soc)],
    })
    renderLibrary('ttx-1')

    fireEvent.click(await screen.findByLabelText('Duplicate Cyber insurer'))
    fireEvent.click(screen.getByRole('button', { name: 'To this exercise' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/actors',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body as string)).toMatchObject({
      name: 'Cyber insurer_copy',
      origin_name: 'Cyber insurer',
    })

    fireEvent.click(screen.getByRole('button', { name: 'This exercise' }))
    const row = await screen.findByRole('row', { name: /Controller/ })
    expect(within(row).getByText('TTX-Zone')).toBeInTheDocument()
    // An actor that sends injects can't leave the cast.
    expect(
      within(row).getByRole('button', {
        name: 'SOC sends injects in this exercise: give them another source first',
      }),
    ).toBeDisabled()

    // Its form says, read-only, what it was copied from.
    fireEvent.click(within(row).getByRole('button', { name: 'Edit SOC' }))
    const dialog = screen.getByRole('dialog', { name: 'Edit SOC' })
    expect(within(dialog).getByLabelText('Copied from')).toHaveValue('TTX-Zone · SOC')
    expect(within(dialog).getByLabelText('Copied from')).toHaveAttribute('readonly')
  })
})
