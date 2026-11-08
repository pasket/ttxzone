import { describe, expect, it, vi } from 'vitest'

import { apiFetch } from '../src/lib/api'
import { DATA_CHANGED_EVENT } from '../src/lib/attention'
import { BACKGROUND_REQUEST_HEADER } from '../src/lib/sessionActivity'

function respond(status = 200, body: unknown = {}) {
  return { ok: status < 300, status, json: async () => body } as Response
}

describe('apiFetch tells the page when a write went through', () => {
  it('only after its own writes, never after reads, background calls or failures', async () => {
    const heard = vi.fn()
    window.addEventListener(DATA_CHANGED_EVENT, heard)
    const fetchMock = vi.fn().mockResolvedValue(respond())
    vi.stubGlobal('fetch', fetchMock)

    await apiFetch('/things')
    expect(heard).not.toHaveBeenCalled()
    await apiFetch('/things', { method: 'POST', body: '{}' })
    expect(heard).toHaveBeenCalledTimes(1)
    await apiFetch('/things', {
      method: 'POST',
      headers: { [BACKGROUND_REQUEST_HEADER]: '1' },
    })
    expect(heard).toHaveBeenCalledTimes(1)
    fetchMock.mockResolvedValueOnce(
      respond(409, { success: false, error: { code: 'X', message: 'No', ttx_id: null } }),
    )
    await expect(apiFetch('/things', { method: 'PUT', body: '{}' })).rejects.toThrow()
    expect(heard).toHaveBeenCalledTimes(1)
    window.removeEventListener(DATA_CHANGED_EVENT, heard)
  })
})
