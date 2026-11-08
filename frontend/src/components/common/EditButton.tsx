import { forwardRef } from 'react'

import { btnNeutralIconGhost } from '../../lib/buttonStyles'

export function PencilIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

/** Icon-only row trigger for entering a row's edit state -- same shape as
 * `IconButton` (aria-label doubles as the accessible name and hover
 * tooltip, no visible text) but neutral instead of danger, and forwards a
 * ref so a caller can return keyboard focus to it once the edit form
 * closes, mirroring `CollapsibleFormSection`'s own trigger-focus pattern. */
export const EditButton = forwardRef<
  HTMLButtonElement,
  {
    label: string
    onClick: () => void
    disabled?: boolean
    /** So a validation summary can focus it. */
    id?: string
  }
>(function EditButton({ label, onClick, disabled, id }, ref) {
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={btnNeutralIconGhost}
    >
      <PencilIcon />
    </button>
  )
})
