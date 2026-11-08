import { btnNeutralIconGhost } from '../../lib/buttonStyles'

export function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/** Icon-only row trigger that opens an item read-only -- `EditButton`'s
 * shape for whoever may look but not change (a TTX-Zone item, or an
 * organization item seen from Creator). */
export function ViewButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={btnNeutralIconGhost}
    >
      <EyeIcon />
    </button>
  )
}
