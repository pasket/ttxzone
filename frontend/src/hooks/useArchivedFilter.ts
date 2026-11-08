import { useSearchParams } from 'react-router-dom'

/** Which exercises a list shows: the active ones (the default), the
 * archived ones, or all; kept in the URL (`archived`). */
export type ArchivedFilter = 'active' | 'archived' | 'all'

export function useArchivedFilter(): [ArchivedFilter, (value: ArchivedFilter) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const raw = searchParams.get('archived')
  const value: ArchivedFilter = raw === 'archived' || raw === 'all' ? raw : 'active'
  function set(next: ArchivedFilter) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        if (next === 'active') params.delete('archived')
        else params.set('archived', next)
        params.delete('page')
        return params
      },
      { replace: true },
    )
  }
  return [value, set]
}

/** `GET /ttx`'s `archived` query value for a filter (none: all). */
export function archivedParam(filter: ArchivedFilter): string | null {
  return filter === 'all' ? null : String(filter === 'archived')
}
