import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useUndoableAction } from './useUndoableAction'

/** Puts a row back where it was, unless it's already there. */
export function restoreRow<T extends { key: string }>(
  list: readonly T[],
  row: T,
  index: number,
): T[] {
  if (list.some((item) => item.key === row.key)) return [...list]
  const next = [...list]
  next.splice(Math.min(index, next.length), 0, row)
  return next
}

/** Undo for a row removed from an autosaved draft (the needs analysis,
 * the MSEL). The row leaves the draft at once -- the live report and the
 * tables follow -- but `holding` stays true until the Undo window closes,
 * and the page keeps autosave off meanwhile: once saved, a row's id is
 * gone server-side and couldn't be put back. Undo re-inserts the row into
 * the *current* draft, so edits made during the window survive. */
export function useUndoableRowRemoval<D>(apply: (change: (draft: D) => D) => void) {
  const { t } = useTranslation()
  const runUndoable = useUndoableAction()
  const [pending, setPending] = useState(0)
  const release = () => setPending((count) => Math.max(0, count - 1))

  function remove(message: string, without: (draft: D) => D, restore: (draft: D) => D) {
    runUndoable({
      message,
      undoLabel: t('common.toast.undo'),
      onRemove: () => {
        setPending((count) => count + 1)
        apply(without)
      },
      onRestore: () => {
        apply(restore)
        release()
      },
      onCommit: async () => release(),
    })
  }

  return { remove, holding: pending > 0 }
}
