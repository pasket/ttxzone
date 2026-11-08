import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'

import { render } from './testUtils'
import { describe, expect, it, vi } from 'vitest'

import { AdminDomainAllowlistSection } from '../src/components/admin/AdminDomainAllowlistSection'

// Requests target the organization selected in the context bar.
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ activeOrganizationId: 'org-1' }),
}))

const BOTH = { allows_program_manager: true, allows_planner: true }
const MANAGERS_ONLY = { allows_program_manager: false, allows_planner: true }

function listResponse(items: Record<string, unknown>[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total: items.length, limit: 10, offset: 0 }),
  } as Response
}

// The component also fetches the org's available tags once, alongside the
// domain list, via a separate effect on mount -- every test's fetch mock
// queue below reserves one slot for this call right after the initial
// list load, same convention as AdminPlannersSection's own tests.
function mockTagList(items: Record<string, unknown>[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total: items.length, limit: 200, offset: 0 }),
  } as Response
}

describe('AdminDomainAllowlistSection', () => {
  it('lists configured domains and adds a new one', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        listResponse([{ id: 1, domain: 'acme.com', ...BOTH, tags: [], created_at: '2026-01-01' }]),
      )
      .mockResolvedValueOnce(mockTagList())
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 2,
          domain: 'acme.es',
          ...MANAGERS_ONLY,
          tags: [],
          created_at: '2026-01-02',
        }),
      } as Response)
      .mockResolvedValueOnce(
        listResponse([
          { id: 2, domain: 'acme.es', ...MANAGERS_ONLY, tags: [], created_at: '2026-01-02' },
          { id: 1, domain: 'acme.com', ...BOTH, tags: [], created_at: '2026-01-01' },
        ]),
      )
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminDomainAllowlistSection />)

    expect(await screen.findByText('acme.com')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }))
    expect(screen.getByLabelText('Domain')).toHaveFocus()
    fireEvent.change(screen.getByLabelText('Domain'), {
      target: { value: 'acme.es' },
    })
    // New domains default to Planners only; Exercise Program Manager is opt-in.
    expect(screen.getByRole('checkbox', { name: 'Exercise Planning Team' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Exercise Program Managers' })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }))

    expect(await screen.findByText('acme.es')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/organizations/org-1/allowed-domains'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          domain: 'acme.es',
          allows_program_manager: false,
          allows_planner: true,
        }),
      }),
    )
    // "Applies to" column.
    expect(
      within(screen.getAllByRole('row')[1]).getByText('Exercise Planning Team'),
    ).toBeInTheDocument()
    expect(
      within(screen.getAllByRole('row')[2]).getByText(
        'Exercise Planning Team, Exercise Program Managers',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Domain')).not.toBeInTheDocument()
    // Focus returns to the trigger once it remounts -- regression test for
    // a bug where an imperative .focus() call fired before the button had
    // actually remounted, silently doing nothing.
    expect(screen.getByRole('button', { name: 'Add domain' })).toHaveFocus()
  })

  it('removes a domain after the undo grace period, and not before', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        listResponse([{ id: 1, domain: 'acme.com', tags: [], created_at: '2026-01-01' }]),
      )
      .mockResolvedValueOnce(mockTagList())
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => undefined } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminDomainAllowlistSection />)
    await screen.findByText('acme.com')

    // Switch to fake timers only now -- the click below schedules the
    // deferred commit's setTimeout, which needs to be a fake timer for
    // advanceTimersByTimeAsync to control it. Everything before this point
    // (the initial mount fetches) resolves via real Promise microtasks,
    // not timers, so it's unaffected either way.
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))

    // Optimistic: gone immediately, no DELETE fired yet.
    expect(screen.queryByText('acme.com')).not.toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(5000)

    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/organizations/org-1/allowed-domains/1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('undo restores the domain and never calls the API', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        listResponse([{ id: 1, domain: 'acme.com', tags: [], created_at: '2026-01-01' }]),
      )
      .mockResolvedValueOnce(mockTagList())
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminDomainAllowlistSection />)
    await screen.findByText('acme.com')

    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.queryByText('acme.com')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }))
    expect(screen.getByText('acme.com')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(5000)
    // Only the initial list + tags fetches -- the deferred DELETE was
    // cancelled.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shows the empty-state message when there are none', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(listResponse([])).mockResolvedValueOnce(mockTagList()),
    )

    render(<AdminDomainAllowlistSection />)

    expect(
      await screen.findByText(
        'No domains configured -- no one can join the Exercise Planning Team or be made Exercise Program Manager until you add one.',
      ),
    ).toBeInTheDocument()
  })

  it('sends sort_by and q on the list request once the toolbar changes them', async () => {
    const fetchMock = vi.fn().mockResolvedValue(listResponse([]))
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminDomainAllowlistSection />)
    await screen.findByText(
      'No domains configured -- no one can join the Exercise Planning Team or be made Exercise Program Manager until you add one.',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sort by: Date added' }))
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Domain' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.stringContaining('sort_by=name'),
        expect.anything(),
      ),
    )

    await act(async () => {
      vi.useFakeTimers()
      fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'acme' } })
      await vi.advanceTimersByTimeAsync(300)
      vi.useRealTimers()
    })

    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('q=acme'), expect.anything())
  })

  it('edits what a domain applies to and its tags in one save', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        listResponse([
          {
            id: 1,
            domain: 'acme.com',
            ...BOTH,
            tags: [
              { id: 'tag-1', name: 'VIP', color: 'indigo', created_at: '2026-01-01T00:00:00Z' },
            ],
            created_at: '2026-01-01',
          },
        ]),
      )
      .mockResolvedValueOnce(
        mockTagList([
          { id: 'tag-1', name: 'VIP', color: 'indigo', created_at: '2026-01-01T00:00:00Z' },
          { id: 'tag-2', name: 'Legal', color: 'slate', created_at: '2026-01-01T00:00:00Z' },
        ]),
      )
      // PATCH scopes, then PUT tags (which returns the final row).
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 1,
          domain: 'acme.com',
          ...MANAGERS_ONLY,
          tags: [],
          created_at: '2026-01-01',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 1,
          domain: 'acme.com',
          ...MANAGERS_ONLY,
          tags: [
            { id: 'tag-2', name: 'Legal', color: 'slate', created_at: '2026-01-01T00:00:00Z' },
          ],
          created_at: '2026-01-01',
        }),
      } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminDomainAllowlistSection />)
    await screen.findByText('acme.com')

    fireEvent.click(screen.getByRole('button', { name: 'Edit domain acme.com' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Exercise Program Managers' })).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exercise Program Managers' }))
    expect(screen.getByRole('checkbox', { name: /VIP/ })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /Legal/ })).not.toBeChecked()

    fireEvent.click(screen.getByRole('checkbox', { name: /VIP/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Legal/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      expect.stringMatching(/\/organizations\/org-1\/allowed-domains\/1$/),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ allows_program_manager: false, allows_planner: true }),
      }),
    )
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/organizations/org-1/allowed-domains/1/tags'),
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ tag_ids: ['tag-2'] }) }),
    )

    // Row's chips update immediately from the PUT response, no re-fetch.
    const row = within(screen.getAllByRole('row')[1])
    expect(row.getByText('Legal')).toBeInTheDocument()
    expect(row.queryByText('VIP')).not.toBeInTheDocument()
    expect(row.getByText('Exercise Planning Team')).toBeInTheDocument()

    // Focus returns to this row's trigger once the modal unmounts.
    expect(screen.getByRole('button', { name: 'Edit domain acme.com' })).toHaveFocus()
  })

  it('requires at least one scope before adding', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(listResponse([])).mockResolvedValueOnce(mockTagList()),
    )
    render(<AdminDomainAllowlistSection />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add domain' }))
    fireEvent.change(screen.getByLabelText('Domain'), { target: { value: 'acme.es' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exercise Planning Team' }))

    expect(screen.getByText('Select at least one.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add domain' })).toBeDisabled()
  })
})
