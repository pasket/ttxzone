import { vi } from 'vitest'

/** Queue one JSON response for the next fetch() call. Defaults to an
 * unauthenticated error envelope matching the backend's unified error
 * shape, so AuthProvider's mount-time /auth/me settles to 'anonymous'
 * unless a test queues something else first. */
export function mockFetchOnce(
  status = 401,
  body: unknown = {
    error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
  },
) {
  const fetchMock = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
