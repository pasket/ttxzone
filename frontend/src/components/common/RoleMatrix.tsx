import type { ContextRole } from '../../lib/moduleAccess'
import { panelTh } from '../../lib/panelStyles'
import { AcronymText } from './AcronymText'
import { RoleIcon } from './RoleIcon'

/** A role column header of a people x roles matrix: icon and holder count
 * on one line, the long name below (two lines at most), its one-line
 * description on hover. */
export function RoleColumnHeader({
  icon,
  count,
  label,
  hint,
}: {
  icon: ContextRole
  count: number
  label: string
  hint: string
}) {
  return (
    <th scope="col" title={hint} className={`${panelTh} w-32 text-center align-bottom`}>
      <span className="flex flex-col items-center gap-1">
        <span className="inline-flex items-center gap-1.5 font-normal text-paper-ink/60 dark:text-fg-muted">
          <RoleIcon role={icon} />
          <span className="font-mono text-xs">{count}</span>
        </span>
        <span className="text-balance">
          <AcronymText text={label} />
        </span>
      </span>
    </th>
  )
}

/** A read-only matrix cell: an accent check when the person holds the
 * role, a faint dot when not. The label (role and person) is for screen
 * readers; changes happen in the person's editor. */
export function RoleMark({ held, label }: { held: boolean; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      aria-hidden={!held}
      className="inline-flex h-6 w-6 items-center justify-center"
    >
      {held ? (
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-accent-fg"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m5 12.5 4.5 4.5L19 7.5" />
        </svg>
      ) : (
        <span className="h-1 w-1 rounded-full bg-paper-ink/25 dark:bg-fg-faint" />
      )}
    </span>
  )
}
