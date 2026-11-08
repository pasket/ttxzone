import { useTranslation } from 'react-i18next'

import { btnSecondary, inputCompact } from '../../lib/buttonStyles'
import { libraryEmptyClass } from '../../lib/libraryLevels'

export interface LibrarySelectFilter {
  key: string
  label: string
  /** The first option, matching everything. */
  allLabel: string
  options: { value: string; label: string }[]
}

/** The filter row every library table opens with: a free-text search and
 * the selects that matter for that kind, on one line under the panel's
 * header (Library -> Injects' layout). */
export function LibraryFilterBar({
  legend,
  searchLabel,
  searchPlaceholder,
  selects,
  values,
  onChange,
}: {
  legend: string
  searchLabel: string
  searchPlaceholder: string
  selects: LibrarySelectFilter[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  return (
    <fieldset className="flex flex-wrap items-end gap-3 border-b border-panel-line px-5 py-3">
      <legend className="sr-only">{legend}</legend>
      <label className="min-w-48 flex-1 space-y-1 text-xs font-medium">
        <span className="block">{searchLabel}</span>
        <input
          type="search"
          name="q"
          autoComplete="off"
          spellCheck={false}
          value={values.q ?? ''}
          onChange={(event) => onChange('q', event.target.value)}
          placeholder={searchPlaceholder}
          className={inputCompact}
        />
      </label>
      {selects.map((select) => (
        <label key={select.key} className="space-y-1 text-xs font-medium">
          <span className="block">{select.label}</span>
          <select
            name={select.key}
            value={values[select.key] ?? ''}
            onChange={(event) => onChange(select.key, event.target.value)}
            className={inputCompact}
          >
            <option value="">{select.allLabel}</option>
            {select.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </fieldset>
  )
}

/** "12 injects": how many rows the filters leave, next to the panel's
 * actions. */
export function LibraryCount({ text }: { text: string }) {
  return <span className="text-sm text-paper-ink/60 dark:text-fg-faint">{text}</span>
}

/** Nothing matches the filters -- with a way back. */
export function LibraryNoMatches({ active, onClear }: { active: boolean; onClear: () => void }) {
  const { t } = useTranslation()
  return (
    <div className={`${libraryEmptyClass} space-y-3`}>
      <p>{t('templates.noMatches')}</p>
      {active && (
        <button type="button" onClick={onClear} className={btnSecondary}>
          {t('templates.clearFilters')}
        </button>
      )}
    </div>
  )
}

/** A panel's right-hand side: the count, then the level's own action. */
export function LibraryAside({ count, action }: { count?: string; action?: React.ReactNode }) {
  if (!count && !action) return null
  return (
    <div className="flex flex-wrap items-center gap-3">
      {count && <LibraryCount text={count} />}
      {action}
    </div>
  )
}
