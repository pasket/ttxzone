import { btnNeutralIconGhost } from '../../lib/buttonStyles'
import { ButtonSpinner } from './ButtonSpinner'

/** A stack of books with a plus: into the library. */
function SaveToLibraryIcon() {
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
      <path d="M4 4v16M9 4v16M14 4l3.5 10" />
      <path d="M18 17v5M15.5 19.5h5" />
    </svg>
  )
}

/** Icon-only row trigger that saves an exercise's item to the
 * organization's library -- same shape as `EditButton`; the spinner
 * stands in for the icon while the save is in flight. */
export function SaveToLibraryButton({
  label,
  onClick,
  pending = false,
}: {
  label: string
  onClick: () => void
  pending?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      title={label}
      className={btnNeutralIconGhost}
    >
      {pending ? <ButtonSpinner /> : <SaveToLibraryIcon />}
    </button>
  )
}
