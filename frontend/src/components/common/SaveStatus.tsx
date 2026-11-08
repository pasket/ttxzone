import type { SaveState } from '../../hooks/useAutosavedDocument'

export interface SaveStatusLabels {
  saving: string
  saved: string
  pending: string
  blocked: string
  error: string
}

/** Where an autosaved document is at, next to its section title;
 * announced politely. */
export function SaveStatus({
  state,
  dirty,
  blocked,
  labels,
}: {
  state: SaveState
  dirty: boolean
  blocked: boolean
  labels: SaveStatusLabels
}) {
  const text =
    state === 'saving'
      ? labels.saving
      : state === 'error' && dirty
        ? labels.error
        : blocked && dirty
          ? labels.blocked
          : dirty
            ? labels.pending
            : labels.saved
  const tone =
    (state === 'error' || blocked) && dirty
      ? 'text-danger-fg'
      : 'text-paper-ink/60 dark:text-fg-faint'
  return (
    <p role="status" aria-live="polite" className={`max-w-56 text-right text-xs ${tone}`}>
      {!dirty && state !== 'saving' && <span aria-hidden="true">✓ </span>}
      {text}
    </p>
  )
}
