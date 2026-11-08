import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

const MANDATORY_BANNER =
  'Two-factor authentication is required for your role before you can continue.'

function mockEnrollUri() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      provisioning_uri: 'otpauth://totp/ttx-zone:owner@acme.com?secret=ABC',
    }),
  } as Response
}

function mockTtxList(items: Record<string, unknown>[] = []) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items, total: items.length, limit: 50, offset: 0 }),
  } as Response
}

describe('mandatory TOTP gate', () => {
  it('redirects a Exercise Program Manager without TOTP enrolled away from a module route', async () => {
    window.history.pushState({}, '', '/admin')

    const fetchMock = vi
      .fn()
      // GET /auth/me -- Exercise Program Manager, not yet enrolled
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-1',
          email: 'owner@acme.com',
          full_name: 'Owner',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: true,
          is_planner: false,
          mfa_mandated: true,
        }),
      } as Response)
      // GET /ttx -- always fetched now, regardless of the mandate outcome
      .mockResolvedValueOnce(mockTtxList())
      // POST /auth/totp/enroll -- TotpEnrollment's own effect fires next
      .mockResolvedValueOnce(mockEnrollUri())
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText(MANDATORY_BANNER)).toBeInTheDocument()
  })

  it('redirects an org-scoped Planner without TOTP enrolled away from a module route', async () => {
    window.history.pushState({}, '', '/creator')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-2',
          email: 'eval@acme.com',
          full_name: 'Eval',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: true,
          mfa_mandated: true,
        }),
      } as Response)
      .mockResolvedValueOnce(mockTtxList())
      .mockResolvedValueOnce(mockEnrollUri())
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText(MANDATORY_BANNER)).toBeInTheDocument()
  })

  it('redirects a per-TTX Planner without TOTP enrolled, even without org-scoped membership', async () => {
    window.history.pushState({}, '', '/creator/ttx-1')

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'user-3',
          email: 'invited-eval@acme.com',
          full_name: 'Invited Eval',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
          mfa_mandated: true,
        }),
      } as Response)
      .mockResolvedValueOnce(
        mockTtxList([
          {
            id: 'ttx-1',
            name: 'Ransomware Drill',
            description: null,
            organization_id: 'org-1',
            created_by_id: 'user-1',
            created_at: '2026-01-01T00:00:00Z',
            role: 'planner',
            plans: true,
            controls: true,
          },
        ]),
      )
      .mockResolvedValueOnce(mockEnrollUri())
    vi.stubGlobal('fetch', fetchMock)

    render(<App />)

    expect(await screen.findByText(MANDATORY_BANNER)).toBeInTheDocument()
  })
})
