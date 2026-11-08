import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { SortBy, SortDir } from '../lib/types'

const DEFAULT_SORT_DIR: SortDir = 'desc'
const DEFAULT_SORT_BY: SortBy = 'created_at'
/** What every table sorts by unless it passes its own list -- also what
 * TableToolbar offers by default. */
export const DEFAULT_SORT_OPTIONS: readonly SortBy[] = ['created_at', 'name']

function readPage(searchParams: URLSearchParams, key: string) {
  const raw = Number(searchParams.get(key))
  return Number.isInteger(raw) && raw > 1 ? raw : 1
}

/** A table's page / sort / search state, kept in the URL query string
 * (`?page=2&sort=name&dir=asc&q=acme`) so it survives a reload and can be
 * deep-linked or shared. Defaults are left out of the URL to keep it clean.
 * `prefix` namespaces the keys when one page holds several tables (e.g.
 * EnrollmentsSection's `pending_`/`enrolled_`). `sortOptions` is what this
 * table can sort by: a `?sort=` outside it (e.g. `last_login` pasted onto a
 * table without that column) falls back to the default instead of reaching
 * an endpoint that would reject it.
 *
 * Changing sort or search also resets the page to 1 in the same URL
 * update -- two back-to-back setSearchParams calls would each start from
 * the same stale location and the second would drop the first's change.
 * Updates replace the history entry, so Back leaves the page instead of
 * stepping through every keystroke. Pair with usePageFallback below. */
export function useTableUrlState(
  prefix = '',
  sortOptions: readonly SortBy[] = DEFAULT_SORT_OPTIONS,
) {
  const [searchParams, setSearchParams] = useSearchParams()
  const keys = {
    page: `${prefix}page`,
    sortBy: `${prefix}sort`,
    sortDir: `${prefix}dir`,
    search: `${prefix}q`,
  }

  const page = readPage(searchParams, keys.page)
  const sortDir: SortDir = searchParams.get(keys.sortDir) === 'asc' ? 'asc' : DEFAULT_SORT_DIR
  const rawSortBy = searchParams.get(keys.sortBy)
  const sortBy: SortBy = sortOptions.find((option) => option === rawSortBy) ?? DEFAULT_SORT_BY
  const search = searchParams.get(keys.search) ?? ''

  function update(changes: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [key, value] of Object.entries(changes)) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        return next
      },
      { replace: true },
    )
  }

  return {
    page,
    sortDir,
    sortBy,
    search,
    setPage: (value: number) => update({ [keys.page]: value > 1 ? String(value) : null }),
    setSortDir: (value: SortDir) =>
      update({
        [keys.sortDir]: value === DEFAULT_SORT_DIR ? null : value,
        [keys.page]: null,
      }),
    setSortBy: (value: SortBy) =>
      update({
        [keys.sortBy]: value === DEFAULT_SORT_BY ? null : value,
        [keys.page]: null,
      }),
    setSearch: (value: string) =>
      update({ [keys.search]: value === '' ? null : value, [keys.page]: null }),
  }
}

/** Falls back to page 1 when the URL asks for a page the list doesn't have
 * -- e.g. `?page=3` kept across a ContextBar exercise/organization switch
 * into a smaller list, a stale shared link, or the last row of a page just
 * removed -- instead of showing an empty table with no pagination to get
 * out of it. Separate from useTableUrlState because the total is often
 * only known after that hook's search/sort values have been used (a
 * client-side filter, or the fetch they drive). `ready` must stay false
 * until `total` describes the current list, so a deep link isn't reset
 * before its first fetch lands. */
export function usePageFallback({
  prefix = '',
  total,
  pageSize,
  ready,
}: {
  prefix?: string
  total: number
  pageSize: number
  ready: boolean
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const key = `${prefix}page`
  const page = readPage(searchParams, key)
  const outOfRange = ready && page > 1 && (page - 1) * pageSize >= total

  useEffect(() => {
    if (!outOfRange) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete(key)
        return next
      },
      { replace: true },
    )
  }, [outOfRange, key, setSearchParams])
}
