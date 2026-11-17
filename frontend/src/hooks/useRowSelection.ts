import { useCallback, useState } from 'react'

/** The rows ticked in a list, by id, kept with what a confirmation needs
 * to name them (so a selection survives a page or a search that no longer
 * shows the row). Presentation state only: it never outlives the page. */
export function useRowSelection<T>(idOf: (row: T) => string) {
  const [selected, setSelected] = useState<ReadonlyMap<string, T>>(new Map())

  const toggle = useCallback(
    (rows: T[], on: boolean) => {
      setSelected((current) => {
        const next = new Map(current)
        for (const row of rows) {
          if (on) next.set(idOf(row), row)
          else next.delete(idOf(row))
        }
        return next
      })
    },
    [idOf],
  )
  const clear = useCallback(() => setSelected(new Map()), [])
  /** Drop the rows an action took away. */
  const forget = useCallback((ids: Iterable<string>) => {
    setSelected((current) => {
      const next = new Map(current)
      for (const id of ids) next.delete(id)
      return next
    })
  }, [])

  return {
    selected,
    rows: [...selected.values()],
    has: (row: T) => selected.has(idOf(row)),
    /** Where the "select the page" box stands for the rows on show. */
    page: (shown: T[]) => {
      const on = shown.filter((row) => selected.has(idOf(row))).length
      return { all: shown.length > 0 && on === shown.length, some: on > 0 }
    },
    toggle,
    clear,
    forget,
  }
}
