import { describe, expect, it, vi } from 'vitest'

import { loadAuthSnapshot } from '../src/lib/authStore'

function json(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as Response
}

const exercise = (n: number) => ({
  id: `ttx-${n}`,
  name: `Drill ${n}`,
  description: null,
  organization_id: 'org-1',
  created_by_id: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  role: 'player',
  tags: [],
})

describe('loadAuthSnapshot', () => {
  it('reads every exercise, not only the first page', async () => {
    const all = Array.from({ length: 450 }, (_, i) => exercise(i))
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost')
      if (url.pathname.endsWith('/auth/me')) {
        return json({
          id: 'u1',
          email: 'p@acme.com',
          full_name: 'Pat',
          totp_enabled: false,
          legal_acceptance_pending: [],
          is_program_manager: false,
          is_planner: false,
        })
      }
      if (url.pathname.endsWith('/ttx')) {
        const limit = Number(url.searchParams.get('limit'))
        const offset = Number(url.searchParams.get('offset'))
        return json({ items: all.slice(offset, offset + limit), total: all.length, limit, offset })
      }
      return json({ items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)

    const snapshot = await loadAuthSnapshot()

    expect(snapshot.ttxList.map((t) => t.id)).toEqual(all.map((t) => t.id))
    const pages = fetchMock.mock.calls.filter(([input]) => String(input).includes('/ttx?'))
    expect(pages).toHaveLength(3)
  })
})
