import type { ReactNode } from 'react'

/** A choice between a few options, all in view: each a bordered card with
 * a radio, its label and a one-line hint; the chosen one in the accent
 * (border and tint) as well as the filled radio, so it reads at a glance.
 * A fieldset + legend; `id` goes on the fieldset (a summary can focus
 * it). */
export function RadioCards<T extends string>({
  id,
  name,
  legend,
  options,
  value,
  onChange,
  columns = 2,
  hideLegend = false,
}: {
  id: string
  name: string
  legend: ReactNode
  options: readonly { value: T; label: string; hint: string }[]
  value: T
  onChange: (value: T) => void
  columns?: 2 | 3
  /** The legend for screen readers only, when a heading above says it. */
  hideLegend?: boolean
}) {
  return (
    <fieldset id={id} tabIndex={-1} className="space-y-1.5">
      <legend className={hideLegend ? 'sr-only' : 'text-sm font-medium'}>{legend}</legend>
      <div className={`grid gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {options.map((option) => {
          const chosen = option.value === value
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2.5 rounded-sm border p-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent-fg ${
                chosen
                  ? 'border-accent bg-accent/10'
                  : 'border-paper-line hover:bg-hover dark:border-line'
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={chosen}
                onChange={() => onChange(option.value)}
                className="mt-0.5 accent-accent-fg"
              />
              <span>
                <span className="block font-medium">{option.label}</span>
                <span className="block text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
                  {option.hint}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
