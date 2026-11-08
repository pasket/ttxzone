import type { ReactNode } from 'react'

import { inputBase } from '../../../lib/buttonStyles'

const invalidClass = 'border-danger dark:border-danger'

/** A native date (or time) input that stores null when cleared. */
export function DateInput({
  id,
  value,
  onChange,
  invalid,
  type = 'date',
  disabled,
  describedBy,
}: {
  id: string
  value: string | null
  onChange: (value: string | null) => void
  invalid?: boolean
  type?: 'date' | 'time'
  disabled?: boolean
  describedBy?: string
}) {
  return (
    <input
      autoComplete="off"
      id={id}
      name={id}
      type={type}
      value={type === 'time' ? (value ?? '').slice(0, 5) : (value ?? '')}
      disabled={disabled}
      onChange={(e) =>
        onChange(
          e.target.value ? (type === 'time' ? `${e.target.value}:00` : e.target.value) : null,
        )
      }
      aria-invalid={invalid || undefined}
      aria-describedby={describedBy}
      className={`${inputBase} ${invalid ? invalidClass : ''}`}
    />
  )
}

/** A checkbox with its label on one line. */
export function Checkbox({
  id,
  checked,
  onChange,
  disabled,
  invalid,
  children,
}: {
  id: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  invalid?: boolean
  children: ReactNode
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalid || undefined}
        className="h-4 w-4 accent-accent-fg"
      />
      <span className={invalid ? 'text-danger-fg' : undefined}>{children}</span>
    </label>
  )
}

/** A hint under a group of fields: muted, small. */
export function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
      {children}
    </p>
  )
}
