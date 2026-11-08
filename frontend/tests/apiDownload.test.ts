import { afterEach, describe, expect, it, vi } from 'vitest'

import { apiDownload, ApiError, SESSION_EXPIRED_EVENT } from '../src/lib/api'
import { setReauthenticationHandler } from '../src/lib/reauthentication'

afterEach(() => {
  vi.restoreAllMocks()
  setReauthenticationHandler(null)
})

describe('apiDownload', () => {
  it('saves the file under the name the server gives it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="TTX-2026-01_msel_v1_AMBER.pdf"',
        }),
        blob: async () => new Blob(['%PDF']),
      })),
    )
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      expect(this.download).toBe('TTX-2026-01_msel_v1_AMBER.pdf')
      expect(this.href).toBe('blob:x')
    })

    await apiDownload('/ttx/t/msel/export/msel.pdf?lang=en')
    expect(click).toHaveBeenCalledOnce()
  })

  it('sends an expired session to sign in instead of saving the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({
          success: false,
          error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
        }),
      })),
    )
    const expired = vi.fn()
    window.addEventListener(SESSION_EXPIRED_EVENT, expired)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click')

    await expect(apiDownload('/ttx/t/needs-form/pdf')).rejects.toBeInstanceOf(ApiError)
    expect(expired).toHaveBeenCalledOnce()
    expect(click).not.toHaveBeenCalled()
    window.removeEventListener(SESSION_EXPIRED_EVENT, expired)
  })

  it('asks for a recent sign-in when the download needs one, then fetches it again', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: async () => ({
          success: false,
          error: { code: 'REAUTHENTICATION_REQUIRED', message: 'Confirm it’s you.', ttx_id: null },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          'Content-Disposition': 'attachment; filename="legal_acceptances_20261026.csv"',
        }),
        blob: async () => new Blob(['csv']),
      })
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: () => {} })
    const handler = vi.fn(async () => true)
    setReauthenticationHandler(handler)
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await apiDownload('/instance/legal/acceptances.csv')
    expect(handler).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(click).toHaveBeenCalledOnce()
  })
})
