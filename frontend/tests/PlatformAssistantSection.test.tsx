import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PlatformAssistantSection } from '../src/components/platform/PlatformAssistantSection'
import type { AssistantCallListResponse, AssistantSettings } from '../src/lib/types'
import { render } from './testUtils'

function respond(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

const OFF: AssistantSettings = {
  enabled: false,
  pinned_by_env: false,
  disclaimer_version: '1',
  active_tokens: 0,
}

const NO_CALLS: AssistantCallListResponse = { items: [], callers: [], retention_days: 90 }

/** Answers by URL: the settings, their update, the recent calls. */
function server(settings: AssistantSettings, calls = NO_CALLS) {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes('/instance/assistant/calls')) return respond(calls)
    if (init?.method === 'PUT') return respond({ ...settings, ...JSON.parse(String(init.body)) })
    return respond(settings)
  })
}

describe('PlatformAssistantSection', () => {
  it('turns the assistant on as the switch flips', async () => {
    const fetchMock = server(OFF)
    vi.stubGlobal('fetch', fetchMock)

    render(<PlatformAssistantSection />)

    const toggle = await screen.findByRole('switch', { name: 'Allow the AI assistant' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByText('0 active tokens')).toBeInTheDocument()
    fireEvent.click(toggle)

    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'))
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(put?.[0]).toMatch(/\/instance\/assistant$/)
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ enabled: true })
  })

  it('is read-only while the configuration pins it', async () => {
    vi.stubGlobal('fetch', server({ ...OFF, enabled: true, pinned_by_env: true }))

    render(<PlatformAssistantSection />)

    expect(await screen.findByRole('switch', { name: 'Allow the AI assistant' })).toBeDisabled()
    expect(screen.getByText(/ASSISTANT_ENABLED/)).toBeInTheDocument()
  })

  it('lists the recent calls and filters them by person', async () => {
    const calls: AssistantCallListResponse = {
      items: [
        {
          id: 'c1',
          created_at: '2026-11-02T10:00:00Z',
          user_id: 'u1',
          user_name: 'Ana Ruiz',
          user_email: 'ana@acme.com',
          token_name: 'Laptop',
          token_prefix: 'ttxz_abcd',
          tool: 'get_msel',
          ttx_id: 't1',
          ttx_code: 'TTX-2026-01',
          ttx_name: 'Ransomware drill',
          organization_name: 'Acme',
          outcome: 'TTX_ACCESS_DENIED',
          duration_ms: 12,
        },
      ],
      callers: [{ user_id: 'u1', name: 'Ana Ruiz', email: 'ana@acme.com' }],
      retention_days: 90,
    }
    const fetchMock = server({ ...OFF, enabled: true }, calls)
    vi.stubGlobal('fetch', fetchMock)

    render(<PlatformAssistantSection />)

    expect(await screen.findByText('get_msel')).toBeInTheDocument()
    expect(screen.getByText('TTX_ACCESS_DENIED')).toBeInTheDocument()
    expect(screen.getByText('Token Laptop (ttxz_abcd…)')).toBeInTheDocument()
    expect(screen.getByText('Acme')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Person'), { target: { value: 'u1' } })

    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([url]) => String(url).includes('user_id=u1'))).toBe(true),
    )
  })
})
