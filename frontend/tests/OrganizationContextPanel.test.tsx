import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrganizationContextPanel } from '../src/components/admin/OrganizationContextPanel'
import { render } from './testUtils'

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const SAVED = {
  sector: 'Electricity distribution',
  size: '',
  regulators: '',
  technologies: '',
  critical_assets: '',
}

describe('OrganizationContextPanel', () => {
  it('loads the context, saves it whole and says where it goes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(SAVED))
      .mockResolvedValueOnce(respond({ ...SAVED, technologies: 'SCADA on an OT network' }))
    vi.stubGlobal('fetch', fetchMock)

    render(<OrganizationContextPanel organizationId="org-1" />)

    const sector = await screen.findByDisplayValue('Electricity distribution')
    expect(sector).toHaveAccessibleName(/^Sector/)
    expect(screen.getByText(/AI client reads it/)).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Save context' })
    // Nothing changed yet.
    expect(save).toBeDisabled()

    fireEvent.change(screen.getByLabelText(/^Technologies/), {
      target: { value: 'SCADA on an OT network' },
    })
    fireEvent.click(save)

    expect(await screen.findByText('Context saved')).toBeInTheDocument()
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toMatch(/\/organizations\/org-1\/context$/)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ ...SAVED, technologies: 'SCADA on an OT network' })
    await waitFor(() => expect(save).toBeDisabled())
  })
})
