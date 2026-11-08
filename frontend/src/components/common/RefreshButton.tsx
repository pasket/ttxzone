import { btnNeutralIconGhost } from '../../lib/buttonStyles'

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`h-4 w-4 ${spinning ? 'animate-spin motion-reduce:animate-none' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  )
}

/** Icon-only reload trigger for a block's header, same shape as the table
 * row actions (`EditButton`): `aria-label` doubles as the tooltip, and the
 * glyph spins while `refreshing`. */
export function RefreshButton({
  label,
  onClick,
  refreshing = false,
  className = '',
}: {
  label: string
  onClick: () => void
  refreshing?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      aria-busy={refreshing}
      aria-label={label}
      title={label}
      className={`${btnNeutralIconGhost} ${className}`}
    >
      <RefreshIcon spinning={refreshing} />
    </button>
  )
}
