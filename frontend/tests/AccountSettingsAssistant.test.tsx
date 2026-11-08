import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AccountSettingsAssistant } from '../src/components/account/AccountSettingsAssistant'
import { claudeDesktopConfig } from '../src/lib/assistant'
import type { PersonalAccessTokenCreated, PersonalAccessTokenListResponse } from '../src/lib/types'
import { render } from './testUtils'

function respond(body: unknown, status = 200) {
  return { ok: status < 300, status, json: async () => body } as Response
}

const EMPTY: PersonalAccessTokenListResponse = {
  items: [],
  enabled: true,
  disclaimer_version: '1',
  max_active: 5,
  expiry_days_choices: [7, 30, 90],
}

const CREATED: PersonalAccessTokenCreated = {
  id: 'token-1',
  name: 'Claude Desktop',
  prefix: 'ttxz_abcd',
  created_at: '2026-11-01T10:00:00Z',
  expires_at: '2026-12-01T10:00:00Z',
  last_used_at: null,
  expired: false,
  token: 'ttxz_abcdSECRET',
}

describe('AccountSettingsAssistant', () => {
  it('needs the notice acknowledged and shows the token once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(EMPTY))
      .mockResolvedValueOnce(respond(CREATED, 201))
    vi.stubGlobal('fetch', fetchMock)

    render(<AccountSettingsAssistant />)

    const create = await screen.findByRole('button', { name: 'Create token' })
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Claude Desktop' } })
    expect(create).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: "I've read and understand this notice" }))
    expect(create).toBeEnabled()
    fireEvent.click(create)

    expect(await screen.findByText('ttxz_abcdSECRET')).toBeInTheDocument()
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toMatch(/\/auth\/tokens$/)
    expect(JSON.parse(init.body)).toEqual({
      name: 'Claude Desktop',
      expires_in_days: 30,
      acknowledge: true,
      disclaimer_version: '1',
    })
    // The configuration carries the new token while it's on screen.
    expect(screen.getByText(/"TTX_ZONE_AUTH": "Bearer ttxz_abcdSECRET"/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.queryByText('ttxz_abcdSECRET')).not.toBeInTheDocument())
    expect(screen.queryByText(/ttxz_abcdSECRET/)).not.toBeInTheDocument()
    expect(screen.getByText('Claude Desktop')).toBeInTheDocument()
    expect(screen.getByText(/Bearer YOUR_TOKEN/)).toBeInTheDocument()
  })

  it('says so when the assistant is off', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respond({ ...EMPTY, enabled: false })))

    render(<AccountSettingsAssistant />)

    expect(
      await screen.findByText('The AI assistant is turned off on this server.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create token' })).not.toBeInTheDocument()
  })
})

describe('claudeDesktopConfig', () => {
  it('runs mcp-remote with the token in a header, plain http only for localhost', () => {
    const local = JSON.parse(claudeDesktopConfig('http://localhost:5173/api/v1/mcp', 'T'))
    const lan = JSON.parse(claudeDesktopConfig('http://ttx.lan/api/v1/mcp', 'T'))

    expect(local.mcpServers['ttx-zone']).toEqual({
      command: 'npx',
      args: [
        '-y',
        'mcp-remote',
        'http://localhost:5173/api/v1/mcp',
        '--header',
        'Authorization:${TTX_ZONE_AUTH}',
      ],
      env: { TTX_ZONE_AUTH: 'Bearer T' },
    })
    expect(lan.mcpServers['ttx-zone'].args).toContain('--allow-http')
  })
})
