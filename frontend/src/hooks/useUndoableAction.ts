import { useToast } from './useToast'

const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), select, [tabindex="0"]'

function focusables(root: Element): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

function focusContainer(container: Element | null) {
  if (!(container instanceof HTMLElement)) return
  if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1')
  container.focus()
}

/** Keeps keyboard focus in place across a row removal: the triggering
 * button's row is about to unmount, which would drop focus to <body>.
 * Captured *before* onRemove; the returned callbacks run after React's
 * next commit (a zero-delay timeout) -- `afterRemove` focuses the same
 * control in the next row (else the previous one, else the list's panel),
 * `afterRestore` the same control in the row brought back by Undo. */
function trackRowFocus() {
  const active = document.activeElement
  const row = active instanceof HTMLElement ? active.closest('tr, li') : null
  if (!active || !row?.parentElement) return { afterRemove() {}, afterRestore() {} }
  const list = row.parentElement
  const rowIndex = Array.from(list.children).indexOf(row)
  const controlIndex = Math.max(0, focusables(row).indexOf(active as HTMLElement))
  const container = row.closest('section, [role="region"], table')
  const next = row.nextElementSibling
  const previous = row.previousElementSibling

  function focusIn(target: Element | null | undefined) {
    if (!target?.isConnected) return false
    const controls = focusables(target)
    const control = controls[controlIndex] ?? controls[0]
    if (!control) return false
    control.focus()
    return true
  }

  return {
    afterRemove() {
      setTimeout(() => {
        if (!focusIn(next) && !focusIn(previous)) focusContainer(container)
      }, 0)
    },
    afterRestore() {
      setTimeout(() => {
        if (list.isConnected) focusIn(list.children[rowIndex])
      }, 0)
    },
  }
}

/** Gmail-style "deleted, Undo" pattern for a destructive row action:
 * `onRemove` fires immediately (optimistic), the real network call
 * (`onCommit`) is deferred until `delayMs` elapses, and clicking the
 * toast's Undo button cancels the pending commit and calls `onRestore`
 * instead. None of this app's destructive actions has a true compensating
 * "undo" API server-side (see CLAUDE.md: reject/approve both 409 once
 * decided, leaving a TTX is a hard delete) -- deferring the commit itself
 * is what makes Undo actually safe for all of them, not a server-side
 * rollback. If the page is closed/reloaded inside the grace window, the
 * pending commit is simply never sent (accepted trade-off, not replayed). */
export function useUndoableAction() {
  const { showToast } = useToast()

  return function runUndoable({
    message,
    undoLabel,
    onRemove,
    onRestore,
    onCommit,
    delayMs = 5000,
  }: {
    message: string
    undoLabel: string
    onRemove: () => void
    onRestore: () => void
    onCommit: () => Promise<void>
    delayMs?: number
  }) {
    const focus = trackRowFocus()
    onRemove()
    focus.afterRemove()
    const timer = setTimeout(() => {
      void onCommit()
    }, delayMs)

    showToast(message, {
      action: {
        label: undoLabel,
        onAction: () => {
          clearTimeout(timer)
          onRestore()
          focus.afterRestore()
        },
      },
      duration: delayMs,
    })
  }
}
