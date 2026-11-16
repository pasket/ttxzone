import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { inputCompact, linkAccent } from '../../lib/buttonStyles'
import { panelDivider } from '../../lib/panelStyles'

/** A list's filters: one row under the panel's header (where the search
 * and the sort live), each control under its visible label, so a picked
 * value still says what it filters. A list without filters has no row. */
export function FilterRow({
  label,
  children,
  onClear,
}: {
  /** The group's name for assistive tech ("Filters"). */
  label: string
  children: ReactNode
  /** Shown while a filter is on: back to the whole list. */
  onClear?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      role="group"
      aria-label={label}
      className={`flex flex-wrap items-end gap-x-3 gap-y-2 border-b px-5 py-2.5 ${panelDivider}`}
    >
      {children}
      {onClear && (
        <button type="button" onClick={onClear} className={`pb-1.5 text-sm ${linkAccent}`}>
          {t('common.filters.clear')}
        </button>
      )}
    </div>
  )
}

export const filterLabelClass = 'block text-xs text-paper-ink/60 dark:text-fg-muted'

/** One filter of a `FilterRow`: a labelled select. With `allLabel` its
 * first option is "all" (no filter, `null`); `children` replaces
 * `options` for a select with option groups. */
export function FilterSelect({
  id,
  label,
  value,
  allLabel,
  options = [],
  children,
  onChange,
  wide = false,
}: {
  id: string
  label: string
  value: string | null
  allLabel?: string
  options?: { value: string; label: string }[]
  children?: ReactNode
  onChange: (next: string | null) => void
  wide?: boolean
}) {
  return (
    <div className={`space-y-1 ${wide ? 'w-60' : 'w-48'}`}>
      <label htmlFor={id} className={filterLabelClass}>
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${inputCompact} text-sm`}
      >
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {children ??
          options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
      </select>
    </div>
  )
}
