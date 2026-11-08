import type { LibraryItemState } from './types'

/** Organization library items a picker may offer: never a disabled one
 * (deleted while still in use -- see LibraryDeleteDialog). */
export function enabledOnly<T extends LibraryItemState>(items: T[]): T[] {
  return items.filter((item) => !item.disabled_at)
}
