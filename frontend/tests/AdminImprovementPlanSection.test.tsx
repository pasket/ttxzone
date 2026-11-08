import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdminImprovementPlanSection } from '../src/components/admin/AdminImprovementPlanSection'
import { render } from './testUtils'

vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ activeOrganizationId: 'org-1' }) }))

const plan = {
  items: [
    {
      ttx_id: 'ttx-1',
      ttx_code: 'TTX-2026-01',
      ttx_name: 'Ransomware drill',
      report_status: 'final',
      code: 'IP-01',
      objective_code: 'OBJ-01',
      finding: 'Call tree outdated',
      action: 'Update the call tree',
      owner: 'Laura',
      owner_area: 'Legal',
      due_date: '2026-01-01',
      status: 'open',
      overdue: true,
    },
  ],
  total: 1,
  open: 1,
  overdue: 1,
}

describe('Admin improvement plan', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("lists the organization's actions and filters them", async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => plan }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<AdminImprovementPlanSection />)

    expect(await screen.findByText('1 open · 1 overdue')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Laura · Legal')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'After-action report (PDF)' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/aar/export.pdf?lang=en',
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'Overdue only' }))
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_progress' } })
    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        '/api/v1/organizations/org-1/improvement-plan?limit=50&offset=0&status=in_progress&overdue=true',
        expect.anything(),
      ),
    )
  })
})
