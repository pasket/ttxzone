import { useCallback, useEffect, useState } from 'react'

import { ApiError, apiFetch } from '../lib/api'
import { BACKGROUND_REQUEST_HEADER } from '../lib/sessionActivity'

export interface ApiResource<T> {
  data: T | null
  /** True on the first load and on every refetch. */
  loading: boolean
  error: ApiError | Error | null
  refetch: () => void
}

/** GET `path` and keep it in state. A `null` path means "not ready to
 * fetch yet" and does nothing. The fetch + `cancelled` guard live inline
 * in the effect (not in a memoized helper), per this project's
 * set-state-in-effect ESLint rule -- see AuthProvider for the reference
 * shape. `refetch` bumps a counter the effect depends on. Previous data
 * stays visible during a refetch so the page doesn't flash back to
 * skeletons. */
export function useApiResource<T>(
  path: string | null,
  { background = false }: { background?: boolean } = {},
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(path !== null)
  const [error, setError] = useState<ApiError | Error | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (path === null) return
    let cancelled = false
    async function load(target: string) {
      setLoading(true)
      setError(null)
      try {
        const result = await apiFetch<T>(
          target,
          background ? { headers: { [BACKGROUND_REQUEST_HEADER]: '1' } } : {},
        )
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load(path)
    return () => {
      cancelled = true
    }
  }, [path, tick, background])

  const refetch = useCallback(() => setTick((value) => value + 1), [])

  return { data, loading, error, refetch }
}
