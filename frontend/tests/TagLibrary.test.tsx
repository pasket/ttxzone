import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { TagLibrary } from '../src/components/templates/TagLibrary'
import { asTagDuplicate, tagFromSystem } from '../src/lib/tagLibrary'
import type { SystemTag } from '../src/lib/types'
import { render } from './testUtils'
import { libraryPermissions } from '../src/lib/libraryLevels'

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

const nis2: SystemTag = {
  id: 'nis2',
  group: 'regulation',
  color: 'slate',
  name_en: 'NIS2',
  name_es: 'NIS2',
  description_en: 'Evidence for the NIS2 directive.',
  description_es: 'Evidencia para la directiva NIS2.',
}
const ransomware: SystemTag = {
  id: 'ransomware',
  group: 'threat',
  color: 'rose',
  name_en: 'Ransomware',
  name_es: 'Ransomware',
  description_en: 'Encryption and extortion.',
  description_es: 'Cifrado y extorsión.',
}
const catalog = { items: [nis2, ransomware] }

const orgTag = {
  id: 'org-tag-1',
  name: 'Subsidiary',
  color: 'sand',
  custom_hex: null,
  applied: false,
  origin: null,
  origin_id: null,
  origin_name: null,
  created_at: '2026-09-30T10:00:00+00:00',
}

const page = (items: unknown[]) => ({ items, total: items.length, limit: 200, offset: 0 })

function renderLibrary(ttxId: string | null, entry: string) {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <TagLibrary
        organizationId="org-1"
        ttxId={ttxId}
        permissions={libraryPermissions(entry.startsWith('/creator'))}
      />
    </MemoryRouter>,
  )
}

describe('TagLibrary', () => {
  it('lists TTX-Zone tags by group and duplicates one into the organization', async () => {
    const fetchMock = stubApi({
      'GET /tag-catalog': [json(200, catalog)],
      'GET /organizations/org-1/tags': [json(200, page([]))],
      'POST /organizations/org-1/tags': [json(201, orgTag)],
    })
    renderLibrary(null, '/admin/library/tags')

    const levels = await screen.findByRole('group', { name: 'Library level' })
    expect(
      within(levels)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['TTX-Zone', 'My organization'])
    // Groups in their fixed order, whatever order the catalog lists them in.
    const groups = await screen.findAllByRole('columnheader', { name: /Threat|Regulation/ })
    expect(groups.map((g) => g.textContent)).toEqual(['Threat', 'Regulation'])
    expect(screen.getByText('Evidence for the NIS2 directive.')).toBeInTheDocument()

    const menu = screen.getByLabelText('Duplicate NIS2').closest('details')!
    fireEvent.click(screen.getByLabelText('Duplicate NIS2'))
    fireEvent.click(within(menu).getByRole('button', { name: 'To my organization' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/organizations/org-1/tags',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            name: 'NIS2_copy',
            color: 'slate',
            custom_hex: null,
            origin: 'system',
            origin_id: 'nis2',
            origin_name: 'NIS2',
          }),
        }),
      ),
    )
    // The copy opens for editing right away, on its level, its name
    // prefixed with where it now lives.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Name')).toHaveValue('Subsidiary')
    expect(within(dialog).getByLabelText('Name')).toHaveAccessibleDescription('Organization')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'My organization' })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    )
  })

  it("manages the exercise's own tags and shows what they were copied from", async () => {
    const copied = { ...orgTag, id: 'ttx-tag-1', origin: 'organization', origin_name: 'Sub' }
    const fetchMock = stubApi({
      'GET /tag-catalog': [json(200, catalog)],
      'GET /organizations/org-1/tags': [json(200, page([orgTag]))],
      'GET /ttx/ttx-1/tags': [json(200, page([copied])), json(200, page([]))],
      'DELETE /ttx/ttx-1/tags/ttx-tag-1': [json(204, null)],
    })
    renderLibrary('ttx-1', '/creator/ttx-1/library/tags?tab=exercise')

    expect(await screen.findByText('Subsidiary')).toBeInTheDocument()
    expect(
      within(screen.getByRole('row', { name: /Subsidiary/ })).getByText('Organization'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit Subsidiary' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByLabelText('Copied from')).toHaveValue('Organization · Sub')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'Delete Subsidiary' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/tags/ttx-tag-1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    )
    expect(await screen.findByText(/No tags in this exercise yet/)).toBeInTheDocument()
  })
})

describe('tag duplicates', () => {
  it('shortens a long name so the `_copy` suffix still fits', () => {
    const long = { ...ransomware, name_en: 'Legal & compliance team' }
    const copy = asTagDuplicate(tagFromSystem(long, false))
    expect(copy.name).toBe('Legal & compliance_copy')
    expect(copy.name.length).toBeLessThanOrEqual(24)
    expect(copy.origin_name).toBe('Legal & compliance team')
  })
})
