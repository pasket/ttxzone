import { inputBase } from '../../lib/buttonStyles'
import { VariableText } from './VariableText'

/** One input per {variable} a template uses, to write the exercise's own
 * value into its text when it's copied (an inject, a whole scenario).
 * Blank ones stay as {variable}, to complete later. */
export function VariableFields({
  legend,
  hint,
  variables,
  values,
  onChange,
  countLabel,
}: {
  legend: string
  hint: string
  variables: string[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  /** How often each variable is used, shown after it (optional). */
  countLabel?: (name: string) => string
}) {
  if (variables.length === 0) return null
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold tracking-tight">{legend}</legend>
      <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">{hint}</p>
      {variables.map((name) => (
        <label key={name} className="grid items-center gap-2 text-sm sm:grid-cols-[12rem_1fr]">
          <span>
            <VariableText text={`{${name}}`} />
            {countLabel && (
              <span className="ml-1.5 text-xs text-paper-ink/60 dark:text-fg-faint">
                {countLabel(name)}
              </span>
            )}
          </span>
          <input
            name={name}
            autoComplete="off"
            spellCheck={false}
            value={values[name] ?? ''}
            maxLength={255}
            onChange={(event) => onChange({ ...values, [name]: event.target.value })}
            className={inputBase}
          />
        </label>
      ))}
    </fieldset>
  )
}
