import { btnDangerIconGhost } from '../../lib/buttonStyles'

function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
    </svg>
  )
}

/** Icon-only destructive row trigger -- shared shape for every
 * Revoke/Remove/Reject/Leave button. `label` is the accessible name
 * (aria-label) and native hover tooltip (title), since there's no visible
 * text to read it from. Single click fires `onClick` directly -- no
 * built-in confirm step; callers pair this with useUndoableAction's
 * optimistic-remove + Undo toast instead of a confirm-before-delete
 * dialog. */
export function IconButton({
  label,
  onClick,
  disabled,
  className,
}: {
  label: string
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={className ?? btnDangerIconGhost}
    >
      <TrashIcon />
    </button>
  )
}
