/** Shared class strings for dashboard surfaces. The panel surface itself
 * lives in lib/panelStyles.ts, shared with every non-dashboard panel. */
export { panelClass } from '../../lib/panelStyles'

export const textPrimary = 'text-paper-ink dark:text-fg'
export const textSecondary = 'text-paper-ink/70 dark:text-fg-muted'
export const textFaint = 'text-paper-ink/60 dark:text-fg-faint'

/** Placeholder block for loading states -- sized by the caller so the
 * final content lands in the same box (no layout shift). */
export const skeletonClass =
  'animate-pulse rounded bg-paper-line motion-reduce:animate-none dark:bg-line'
