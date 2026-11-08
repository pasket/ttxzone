import { useTranslation } from 'react-i18next'

import type { LibraryLevel } from '../../lib/libraryLevels'

/** A library item's name (or an inject's title) with the container it
 * lives in in front -- "Organization · Ransomware_copy" -- the same
 * "level · name" reading as "Copied from" above it, so a copy says where
 * it came from and where it now is. The level is fixed text; only the
 * name is editable. */
export function ContainerNameInput({
  id,
  level,
  value,
  onChange,
  maxLength,
  autoFocus,
}: {
  id: string
  /** The library level the item belongs to (where a copy went). */
  level: LibraryLevel
  value: string
  onChange: (value: string) => void
  maxLength: number
  autoFocus?: boolean
}) {
  const { t } = useTranslation()
  const prefixId = `${id}-container`
  return (
    <div className="flex w-full items-stretch rounded-sm border border-paper-line bg-field text-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-fg dark:border-line">
      <span
        id={prefixId}
        className="flex shrink-0 items-center rounded-l-sm border-r border-paper-line bg-paper-line/40 px-3 whitespace-nowrap text-paper-ink/70 dark:border-line dark:bg-surface dark:text-fg-disabled"
      >
        {t(`templates.actors.origins.${level}.label`)}
        <span aria-hidden="true">&nbsp;·</span>
      </span>
      <input
        id={id}
        name={id}
        autoComplete="off"
        value={value}
        maxLength={maxLength}
        required
        autoFocus={autoFocus}
        aria-describedby={prefixId}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 rounded-r-sm bg-transparent px-3 py-2 text-paper-ink outline-none dark:text-fg"
      />
    </div>
  )
}
