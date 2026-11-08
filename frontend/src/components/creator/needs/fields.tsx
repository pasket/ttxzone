import { Fragment, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { inputBase, optionalSuffix } from '../../../lib/buttonStyles'
import { useAutoGrow } from '../../../hooks/useAutoGrow'
import { AcronymText } from '../../common/AcronymText'

const invalidClass = 'border-danger dark:border-danger'
const hintClass = 'text-xs text-paper-ink/60 dark:text-fg-faint'

/** Label + control + hint, with the app-wide "(optional)" suffix. */
export function Field({
  id,
  label,
  optional = false,
  hint,
  children,
}: {
  id: string
  label: string
  optional?: boolean
  hint?: string
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium">
        <AcronymText text={label} />
        {optional && (
          <>
            {' '}
            <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
          </>
        )}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className={hintClass}>
          <AcronymText text={hint} />
        </p>
      )}
    </div>
  )
}

export function TextInput({
  id,
  value,
  onChange,
  invalid,
  hint,
  ...rest
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  hint?: boolean
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'id'>) {
  return (
    <input
      id={id}
      name={id}
      autoComplete="off"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      aria-describedby={hint ? `${id}-hint` : undefined}
      className={`${inputBase} ${invalid ? invalidClass : ''}`}
      {...rest}
    />
  )
}

/** A text box that grows with what's written -- from `rows` lines up to
 * most of the screen, then scrolls -- so a long text is read and edited
 * whole, never through a three-line slot. */
export function TextArea({
  id,
  value,
  onChange,
  invalid,
  rows = 3,
  placeholder,
  maxLength = 5000,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
  rows?: number
  placeholder?: string
  maxLength?: number
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useAutoGrow(ref, value)

  return (
    <textarea
      ref={ref}
      id={id}
      name={id}
      autoComplete="off"
      value={value}
      rows={rows}
      maxLength={maxLength}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={`${inputBase} max-h-[60vh] resize-none leading-relaxed ${invalid ? invalidClass : ''}`}
    />
  )
}

export function Select<T extends string>({
  id,
  value,
  options,
  onChange,
  invalid,
  placeholder,
  hint,
}: {
  id: string
  value: T | null
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  invalid?: boolean
  /** The Field around it shows a hint: describe the select with it. */
  hint?: boolean
  /** Shown as a disabled first option while nothing is chosen. */
  placeholder?: string
}) {
  return (
    <select
      id={id}
      name={id}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value as T)}
      aria-invalid={invalid || undefined}
      aria-describedby={hint ? `${id}-hint` : undefined}
      className={`${inputBase} ${invalid ? invalidClass : ''}`}
    >
      {value === null && (
        <option value="" disabled>
          {placeholder ?? ''}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

/** A multi-select as a checkbox list (fieldset + legend). `max` disables
 * the unchecked boxes once reached, so a limit is never exceeded. */
export function CheckboxGroup<T extends string>({
  id,
  legend,
  options,
  selected,
  onChange,
  max,
  hint,
  invalid,
  optional = false,
  columns = 1,
  legendHidden = false,
}: {
  id: string
  /** Hidden (screen readers only) when the surrounding group's heading
   * already says the same, so it isn't read twice on screen. */
  legend: string
  legendHidden?: boolean
  /** `group` starts a labelled sub-list whenever it changes from the
   * previous option's; `badge` is a short neutral tag after the label;
   * `code` names a coded row ("OBJ-01 | statement", lib/codeRef.ts). */
  options: readonly {
    value: T
    label: string
    code?: string
    description?: string
    group?: string
    badge?: string
  }[]
  selected: readonly T[]
  onChange: (next: T[]) => void
  max?: number
  hint?: string
  invalid?: boolean
  optional?: boolean
  /** Two columns from `sm:` on, for a long list of short options. */
  columns?: 1 | 2
}) {
  const { t } = useTranslation()
  const full = max !== undefined && selected.length >= max
  function toggle(value: T) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : // Keep the options' own order, not the click order.
          options.map((o) => o.value).filter((v) => v === value || selected.includes(v)),
    )
  }
  return (
    <fieldset
      id={id}
      tabIndex={-1}
      aria-invalid={invalid || undefined}
      className="min-w-0 space-y-2"
    >
      <legend className={legendHidden ? 'sr-only' : 'text-sm font-medium'}>
        <AcronymText text={legend} />
        {optional && (
          <>
            {' '}
            <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
          </>
        )}
      </legend>
      {hint && <p className={hintClass}>{hint}</p>}
      <div
        className={`${columns === 2 ? 'grid gap-x-6 gap-y-2 sm:grid-cols-2' : 'space-y-2'} ${
          invalid ? 'rounded-sm border border-danger p-2' : ''
        }`}
      >
        {options.map((option, index) => {
          const checked = selected.includes(option.value)
          const heading =
            option.group !== undefined && option.group !== options[index - 1]?.group
              ? option.group
              : null
          return (
            <Fragment key={option.value}>
              {heading && (
                <p
                  aria-hidden="true"
                  className="pt-2 text-xs font-medium tracking-wide text-paper-ink/60 uppercase first:pt-0 sm:col-span-full dark:text-fg-faint"
                >
                  {heading}
                </p>
              )}
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name={id}
                  value={option.value}
                  checked={checked}
                  disabled={!checked && full}
                  onChange={() => toggle(option.value)}
                  className="mt-0.5 accent-accent-fg"
                />
                <span>
                  <span className="block">
                    {option.code && (
                      <>
                        <span translate="no" className="tabular-nums">
                          {option.code}
                        </span>
                        <span
                          aria-hidden="true"
                          className="mx-1.5 text-paper-ink/35 dark:text-fg-faint"
                        >
                          |
                        </span>
                        <span className="sr-only">, </span>
                      </>
                    )}
                    <AcronymText text={option.label} />
                    {option.group && (
                      // The heading is visual; screen readers get the group here.
                      <span className="sr-only">, {option.group}</span>
                    )}
                    {option.badge && (
                      <span className="ml-2 inline-flex h-5 items-center rounded-xs border border-paper-line px-1.5 align-middle text-xs font-medium text-paper-ink/70 dark:border-line dark:text-fg-muted">
                        {option.badge}
                      </span>
                    )}
                  </span>
                  {option.description && (
                    // One reference per line when it lists coded rows.
                    <span className={`${hintClass} whitespace-pre-line`}>
                      <AcronymText text={option.description} />
                    </span>
                  )}
                </span>
              </label>
            </Fragment>
          )
        })}
      </div>
    </fieldset>
  )
}

/** A list of short strings (areas, third parties) as removable chips plus
 * an input that adds on Enter. */
export function ListInput({
  id,
  label,
  values,
  onChange,
  placeholder,
  invalid,
  optional = false,
  hint,
}: {
  id: string
  label: string
  values: string[]
  onChange: (next: string[]) => void
  placeholder?: string
  invalid?: boolean
  optional?: boolean
  /** What the list is for, in front of how to add to it. */
  hint?: string
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  function add() {
    const value = text.trim()
    if (value && !values.includes(value)) onChange([...values, value])
    setText('')
  }
  return (
    <Field
      id={id}
      label={label}
      optional={optional}
      hint={[hint, t('creator.needs.hints.listInputHelp')].filter(Boolean).join(' ')}
    >
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <li
              key={value}
              className="inline-flex max-w-full items-start gap-1 rounded-xs border border-paper-line py-0.5 pl-2 pr-1 text-sm dark:border-line"
            >
              {/* Wraps: a long key question stays readable whole. */}
              <span className="min-w-0 break-words">{value}</span>
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={t('creator.needs.actions.removeItem', { item: value })}
                className="rounded-xs px-1 text-paper-ink/60 hover:text-danger-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted"
              >
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <TextInput
        id={id}
        value={text}
        onChange={setText}
        invalid={invalid}
        hint
        maxLength={255}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            add()
          }
        }}
        onBlur={add}
      />
    </Field>
  )
}
