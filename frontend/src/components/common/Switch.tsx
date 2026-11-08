import type { ReactNode } from 'react'

/** An on/off setting that applies as it's flipped: a `role="switch"`
 * button with its label beside the track. `tone` is the "on" colour --
 * `accent` for a mode that's active, `success` for something done (an
 * inject validated). */
export function Switch({
  checked,
  onChange,
  disabled = false,
  tone = 'accent',
  describedBy,
  id,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  tone?: 'accent' | 'success'
  describedBy?: string
  id?: string
  children: ReactNode
}) {
  const on = tone === 'success' ? 'bg-success' : 'bg-accent'
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="group inline-flex items-center gap-2 rounded-sm text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span
        aria-hidden="true"
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${
          checked ? on : 'bg-paper-line dark:bg-line'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform motion-reduce:transition-none ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </span>
      {children}
    </button>
  )
}
