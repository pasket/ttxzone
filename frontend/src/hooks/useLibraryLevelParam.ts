import { useSearchParams } from 'react-router-dom'

import type { LibraryLevel } from '../lib/libraryLevels'

/** A template library's level, kept in `?tab=` (TTX-Zone, the default,
 * is omitted). A level the page doesn't offer falls back to TTX-Zone. */
export function useLibraryLevelParam(
  levels: LibraryLevel[],
): [LibraryLevel, (level: LibraryLevel) => void] {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const level = levels.includes(requested as LibraryLevel) ? (requested as LibraryLevel) : 'system'
  const setLevel = (next: LibraryLevel) =>
    setSearchParams(
      (previous) => {
        const params = new URLSearchParams(previous)
        if (next === 'system') params.delete('tab')
        else params.set('tab', next)
        return params
      },
      { replace: true },
    )
  return [level, setLevel]
}
