import { fireEvent, screen, waitFor, within } from '@testing-library/react'

import { render } from './testUtils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { AdminOrganizationProfileSection } from '../src/components/admin/AdminOrganizationProfileSection'

function renderSection() {
  return render(
    <MemoryRouter initialEntries={['/admin/organization']}>
      <Routes>
        <Route path="/admin/organization" element={<AdminOrganizationProfileSection />} />
        <Route path="/" element={<p>Home</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

// The dashboard (view mode) does its own fetching and has its own test file
// -- stub it so these tests' fetch mocks only cover the profile's own
// requests.
vi.mock('../src/components/admin/AdminOrganizationDashboard', () => ({
  AdminOrganizationDashboard: ({ title, summary }: { title: string; summary: React.ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {summary}
      <p>Dashboard panels</p>
    </div>
  ),
}))

const mockRefresh = vi.fn(async () => {})
// The component reads the org straight off useAuth().activeOrganization
// (the ContextBar's selection); each test sets it before rendering.
let mockActiveOrganization: Record<string, unknown> | null = null

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ refresh: mockRefresh, activeOrganization: mockActiveOrganization }),
}))

function orgSummary(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: 'org-1',
    organization_name: 'Acme',
    domain: 'acme.com',
    alias: null,
    logo_url: null,
    is_program_manager: true,
    is_planner: false,
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function tag(id: string, name: string, applied: boolean) {
  return { id, name, color: 'slate', applied, created_at: '2026-01-01T00:00:00Z' }
}

function tagsResponse(items: unknown[] = []) {
  return jsonResponse(200, { items, total: items.length, limit: 200, offset: 0 })
}

function orgProfileResponse(overrides: Record<string, unknown> = {}) {
  return jsonResponse(200, {
    id: 'org-1',
    name: 'Acme',
    domain: 'acme.com',
    alias: null,
    tax_id: null,
    subscription_tier: 'free',
    description: null,
    logo_url: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  })
}

type Handler = () => Response | Promise<Response>

/** Route fetch calls by "METHOD /path" (query string ignored) so tests
 * don't depend on the order parent/child effects fire their requests.
 * A route mapped to an array serves its responses in turn, repeating the
 * last one. */
function stubApi(routes: Record<string, Handler | Handler[]>) {
  const counters: Record<string, number> = {}
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = url.replace('/api/v1', '').split('?')[0]
    const key = `${init?.method ?? 'GET'} ${path}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    const handlers = Array.isArray(route) ? route : [route]
    const index = Math.min(counters[key] ?? 0, handlers.length - 1)
    counters[key] = (counters[key] ?? 0) + 1
    return handlers[index]()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function callsTo(fetchMock: ReturnType<typeof stubApi>, method: string, path: string) {
  return fetchMock.mock.calls.filter(
    ([url, init]) => (init?.method ?? 'GET') === method && String(url).split('?')[0].endsWith(path),
  )
}

describe('AdminOrganizationProfileSection', () => {
  beforeEach(() => {
    mockRefresh.mockClear()
    mockActiveOrganization = orgSummary()
  })

  it('renders the profile title, the active org identity and the dashboard -- no table', async () => {
    stubApi({ 'GET /organizations/org-1/tags': () => tagsResponse() })

    renderSection()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Organization profile' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByText('acme.com')).toBeInTheDocument()
    expect(screen.getByText('Dashboard panels')).toBeInTheDocument()
    expect(await screen.findByText('No tags')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('shows how many Exercise Program Managers the organization has', async () => {
    const admin = (id: string) => ({
      user_id: id,
      email: `${id}@acme.com`,
      full_name: id,
      granted_at: '2026-09-01T00:00:00',
      tags: [],
    })
    stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'GET /organizations/org-1/program-managers': () =>
        jsonResponse(200, { items: [admin('ada'), admin('grace')] }),
    })

    renderSection()

    const band = screen.getByRole('region', { name: 'Acme' })
    const label = within(band).getByText('Exercise Program Managers')
    expect(await within(label.parentElement as HTMLElement).findByText('2')).toBeInTheDocument()
  })

  it('shows the alias next to the name and initials when there is no logo', () => {
    mockActiveOrganization = orgSummary({ organization_name: 'Acme Corp', alias: 'ACME' })
    stubApi({ 'GET /organizations/org-1/tags': () => tagsResponse() })

    renderSection()

    expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    expect(screen.getByText('ACME')).toBeInTheDocument()
    expect(screen.getByText('AC')).toBeInTheDocument()
  })

  it('renders nothing when the active organization is not Exercise Program Manager-managed', () => {
    mockActiveOrganization = orgSummary({ is_program_manager: false, is_planner: true })
    const fetchMock = stubApi({})

    renderSection()

    expect(screen.queryByText('Organization profile')).not.toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows only applied organization tags as chips, not unapplied ones', async () => {
    stubApi({
      'GET /organizations/org-1/tags': () =>
        tagsResponse([tag('t1', 'Pilot', true), tag('t2', 'Draft', false)]),
    })

    renderSection()

    expect(await screen.findByText('Pilot')).toBeInTheDocument()
    expect(screen.queryByText('Draft')).not.toBeInTheDocument()
  })

  it('keeps the identity band when the tags fetch fails', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/tags': () =>
        jsonResponse(500, { error: { code: 'INTERNAL_ERROR', message: 'boom' } }),
    })

    renderSection()

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.getByText('Acme')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit profile' })).toBeInTheDocument()
  })

  it('opens the pre-filled edit form via Edit profile and saves a PATCH plus the tag-apply PUT', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'GET /organizations/org-1': () => orgProfileResponse(),
      'PATCH /organizations/org-1': () => orgProfileResponse({ alias: 'The Acme Team' }),
      'PUT /organizations/org-1/tags/apply': () => tagsResponse(),
    })

    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))

    expect(await screen.findByRole('heading', { name: 'Edit profile' })).toBeInTheDocument()
    expect(screen.queryByText('Dashboard panels')).not.toBeInTheDocument()
    // The identity band stays as read-only context (domain is shown there,
    // not as a disabled input) and its actions are hidden; name is editable.
    expect(screen.getByText('acme.com')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Acme')
    // Focus moves in an effect after the form commits, not in the same tick.
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus())
    expect(screen.queryByLabelText('Domain')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit profile' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Acme' })).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Alias (optional)'), {
      target: { value: 'The Acme Team' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(callsTo(fetchMock, 'PUT', '/organizations/org-1/tags/apply')).toHaveLength(1),
    )
    expect(callsTo(fetchMock, 'PATCH', '/organizations/org-1')[0][1]).toEqual(
      expect.objectContaining({
        body: JSON.stringify({
          name: 'Acme',
          description: null,
          tax_id: null,
          alias: 'The Acme Team',
        }),
      }),
    )
    expect(callsTo(fetchMock, 'PUT', '/organizations/org-1/tags/apply')[0][1]).toEqual(
      expect.objectContaining({ body: JSON.stringify({ tag_ids: [] }) }),
    )
    expect(mockRefresh).toHaveBeenCalled()

    // Save closes the form and returns to the dashboard, focus back on Edit.
    expect(await screen.findByText('Dashboard panels')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit profile' })).toHaveFocus()
    expect(await screen.findByText('Changes saved successfully')).toBeInTheDocument()
  })

  it('shows a spinner and disables the button while a profile edit is saving', async () => {
    let resolveSave: (value: Response) => void = () => {}
    const savePromise = new Promise<Response>((resolve) => {
      resolveSave = resolve
    })
    stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'GET /organizations/org-1': () => orgProfileResponse(),
      'PATCH /organizations/org-1': () => savePromise,
      'PUT /organizations/org-1/tags/apply': () => tagsResponse(),
    })

    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    await screen.findByRole('heading', { name: 'Edit profile' })

    const saveButton = screen.getByRole('button', { name: 'Save changes' })
    fireEvent.click(saveButton)

    expect(saveButton).toBeDisabled()
    expect(saveButton.querySelector('svg')).toBeInTheDocument()

    resolveSave(orgProfileResponse())
    expect(await screen.findByText('Dashboard panels')).toBeInTheDocument()
  })

  it('returns to the dashboard on Cancel without saving, focus back on Edit profile', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'GET /organizations/org-1': () => orgProfileResponse(),
    })

    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    await screen.findByRole('heading', { name: 'Edit profile' })

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('heading', { name: 'Edit profile' })).not.toBeInTheDocument()
    expect(await screen.findByText('Dashboard panels')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit profile' })).toHaveFocus()
    expect(callsTo(fetchMock, 'PATCH', '/organizations/org-1')).toHaveLength(0)
  })

  it('starts an unapplied tag unchecked, and only applies it once Save is pressed', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/tags': [
        () => tagsResponse([tag('tag-1', 'Draft', false), tag('tag-2', 'VIP', true)]),
        () => tagsResponse([tag('tag-1', 'Draft', true), tag('tag-2', 'VIP', true)]),
      ],
      'GET /organizations/org-1': () => orgProfileResponse(),
      'PATCH /organizations/org-1': () => orgProfileResponse(),
      'PUT /organizations/org-1/tags/apply': () =>
        tagsResponse([tag('tag-1', 'Draft', true), tag('tag-2', 'VIP', true)]),
    })

    renderSection()

    await screen.findByText('VIP')
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    await screen.findByRole('heading', { name: 'Edit profile' })

    // Creating tags happens in the Library; the form only assigns them.
    expect(screen.getByRole('link', { name: 'Manage tags in the Library' })).toHaveAttribute(
      'href',
      '/admin/library/tags?tab=organization',
    )
    expect(screen.getByRole('checkbox', { name: /Draft/ })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /VIP/ })).toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: /Draft/ }))
    expect(callsTo(fetchMock, 'PUT', '/organizations/org-1/tags/apply')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(callsTo(fetchMock, 'PUT', '/organizations/org-1/tags/apply')[0]?.[1]).toEqual(
        expect.objectContaining({ body: JSON.stringify({ tag_ids: ['tag-2', 'tag-1'] }) }),
      ),
    )
    // The band refetches the org's tags and now shows Draft as applied.
    expect(await screen.findByText('Draft')).toBeInTheDocument()
  })

  it('stages a new logo until Save, then uploads it after the profile PATCH and tag PUT', async () => {
    const createObjectURL = vi.fn(() => 'blob:preview')
    const revokeObjectURL = vi.fn()
    // jsdom has no object URLs; stub a URL subclass (not a mutation of the
    // real global, which would leak into other tests).
    vi.stubGlobal(
      'URL',
      class extends URL {
        static createObjectURL = createObjectURL
        static revokeObjectURL = revokeObjectURL
      },
    )
    const fetchMock = stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'GET /organizations/org-1': () => orgProfileResponse(),
      'PATCH /organizations/org-1': () => orgProfileResponse(),
      'PUT /organizations/org-1/tags/apply': () => tagsResponse(),
      'POST /organizations/org-1/logo': () => orgProfileResponse({ logo_url: '/logo.png' }),
    })

    const { container } = renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    await screen.findByRole('heading', { name: 'Edit profile' })

    const file = new File(['png'], 'logo.png', { type: 'image/png' })
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [file] } })

    // Picking a file only previews it -- nothing is uploaded yet.
    expect(createObjectURL).toHaveBeenCalledWith(file)
    expect(callsTo(fetchMock, 'POST', '/organizations/org-1/logo')).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(callsTo(fetchMock, 'POST', '/organizations/org-1/logo')).toHaveLength(1),
    )
    const order = fetchMock.mock.calls
      .map(([, init]) => init?.method ?? 'GET')
      .filter((method) => method !== 'GET')
    expect(order).toEqual(['PATCH', 'PUT', 'POST'])
    expect(await screen.findByText('Dashboard panels')).toBeInTheDocument()
  })

  it('discards a staged logo removal on Cancel', async () => {
    mockActiveOrganization = orgSummary({ logo_url: '/logo.png' })
    const fetchMock = stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'GET /organizations/org-1': () => orgProfileResponse({ logo_url: '/logo.png' }),
    })

    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }))
    await screen.findByRole('heading', { name: 'Edit profile' })

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByText('Dashboard panels')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'DELETE', '/organizations/org-1/logo')).toHaveLength(0)
  })

  it('opens the delete modal, keeps submit disabled until the typed name matches, then deletes and goes home', async () => {
    const fetchMock = stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'DELETE /organizations/org-1': () => jsonResponse(204, undefined),
    })

    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Acme' }))

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Delete organization' })).toBeInTheDocument()

    const submitButton = screen.getByRole('button', { name: 'Delete organization' })
    expect(submitButton).toBeDisabled()

    const confirmInput = screen.getByLabelText('Type “Acme” to confirm')
    fireEvent.change(confirmInput, { target: { value: 'not-acme' } })
    expect(submitButton).toBeDisabled()

    fireEvent.change(confirmInput, { target: { value: 'Acme' } })
    expect(submitButton).not.toBeDisabled()

    fireEvent.click(submitButton)

    expect(await screen.findByText('Home')).toBeInTheDocument()
    const deletes = callsTo(fetchMock, 'DELETE', '/organizations/org-1')
    expect(deletes).toHaveLength(1)
    // The typed name goes to the server, which checks it too.
    expect(JSON.parse(String(deletes[0][1]?.body))).toEqual({ confirmation: 'Acme' })
    expect(mockRefresh).toHaveBeenCalled()
    expect(screen.getByText('Changes saved successfully')).toBeInTheDocument()
  })

  it('shows a spinner and disables the submit button while a delete is in flight', async () => {
    let resolveDelete: (value: Response) => void = () => {}
    const deletePromise = new Promise<Response>((resolve) => {
      resolveDelete = resolve
    })
    stubApi({
      'GET /organizations/org-1/tags': () => tagsResponse(),
      'DELETE /organizations/org-1': () => deletePromise,
    })

    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Acme' }))
    fireEvent.change(screen.getByLabelText('Type “Acme” to confirm'), {
      target: { value: 'Acme' },
    })
    const submitButton = screen.getByRole('button', { name: 'Delete organization' })
    fireEvent.click(submitButton)

    expect(submitButton).toBeDisabled()
    expect(submitButton.querySelector('svg')).toBeInTheDocument()

    resolveDelete(jsonResponse(204, undefined))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('closes the delete modal on Cancel without deleting', async () => {
    const fetchMock = stubApi({ 'GET /organizations/org-1/tags': () => tagsResponse() })

    renderSection()

    fireEvent.click(screen.getByRole('button', { name: 'Delete Acme' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(callsTo(fetchMock, 'DELETE', '/organizations/org-1')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Delete Acme' })).toHaveFocus()
  })
})
