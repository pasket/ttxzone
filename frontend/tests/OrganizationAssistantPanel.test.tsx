import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrganizationAssistantPanel } from '../src/components/admin/OrganizationAssistantPanel'
import { render } from './testUtils'

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('OrganizationAssistantPanel', () => {
  it('loads the roles, saves the choice and says when the instance has it off', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ roles: ['planner'], instance_enabled: false }))
      .mockResolvedValueOnce(respond({ roles: ['planner', 'controller'], instance_enabled: false }))
    vi.stubGlobal('fetch', fetchMock)

    render(<OrganizationAssistantPanel organizationId="org-1" />)

    const planner = await screen.findByRole('checkbox', { name: /^Exercise Planners/ })
    await waitFor(() => expect(planner).toBeChecked())
    expect(screen.getByText(/turned off for this TTX-Zone/)).toBeInTheDocument()
    const save = screen.getByRole('button', { name: 'Save roles' })
    expect(save).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /^Controllers and Facilitators/ }))
    fireEvent.click(save)

    expect(await screen.findByText('AI assistant roles saved')).toBeInTheDocument()
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toMatch(/\/organizations\/org-1\/assistant$/)
    expect(JSON.parse(init.body)).toEqual({ roles: ['planner', 'controller'] })
    await waitFor(() => expect(save).toBeDisabled())
  })
})
