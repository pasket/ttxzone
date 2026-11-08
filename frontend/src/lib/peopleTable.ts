import type { SortBy, SortDir } from './types'

/** The people tables that sort by last login (Admin -> Planners /
 * Program Managers, Creator -> Exercise -> planning team). */
export const PEOPLE_SORT_OPTIONS: readonly SortBy[] = ['created_at', 'name', 'last_login']

interface PersonRow {
  full_name: string
  email: string
  last_login_at: string | null
}

/** Client-side counterpart of the Planners endpoint's `q`/`sort_by`/
 * `sort_dir`, for the unpaginated lists (Program Managers, planning team):
 * search matches name or email, case-insensitively; a never-logged-in row
 * counts as the least recent login (last when most-recent-first, first
 * when least-recent-first), same as the backend. `grantedAt` is the row's
 * "date added" (granted_at / added_at). Returns a new array. */
export function filterAndSortPeople<T extends PersonRow>(
  items: readonly T[],
  {
    search,
    sortBy,
    sortDir,
    grantedAt,
  }: { search: string; sortBy: SortBy; sortDir: SortDir; grantedAt: (item: T) => string },
): T[] {
  const query = search.trim().toLowerCase()
  const filtered = query
    ? items.filter(
        (item) =>
          item.full_name.toLowerCase().includes(query) || item.email.toLowerCase().includes(query),
      )
    : [...items]

  const direction = sortDir === 'asc' ? 1 : -1
  return filtered.sort((a, b) => {
    if (sortBy === 'name') return direction * a.full_name.localeCompare(b.full_name)
    if (sortBy === 'last_login') {
      if (a.last_login_at === b.last_login_at) return 0
      if (a.last_login_at === null) return -direction
      if (b.last_login_at === null) return direction
      return direction * (Date.parse(a.last_login_at) - Date.parse(b.last_login_at))
    }
    return direction * (Date.parse(grantedAt(a)) - Date.parse(grantedAt(b)))
  })
}
