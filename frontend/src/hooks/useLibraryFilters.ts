import { useSearchParams } from 'react-router-dom'

/** A library table's filters, kept in the URL query (`?q=` and one key per
 * select) so a reload or a link keeps them; empty values are left out. */
export function useLibraryFilters<K extends string>(keys: readonly K[]) {
  const [searchParams, setSearchParams] = useSearchParams()
  const values = Object.fromEntries(
    ['q', ...keys].map((key) => [key, searchParams.get(key) ?? '']),
  ) as Record<'q' | K, string>
  const set = (changes: Partial<Record<'q' | K, string | null>>) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous)
        for (const [key, value] of Object.entries(changes)) {
          if (value) next.set(key, value as string)
          else next.delete(key)
        }
        return next
      },
      { replace: true },
    )
  const all = ['q', ...keys] as ('q' | K)[]
  return {
    values,
    set,
    clear: () => set(Object.fromEntries(all.map((key) => [key, null])) as never),
    active: all.some((key) => values[key]),
    query: values.q.trim().toLowerCase(),
  }
}
