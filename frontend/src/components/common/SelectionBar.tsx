import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { linkAccent } from '../../lib/buttonStyles'
import { panelDivider } from '../../lib/panelStyles'

// As tall idle as with its buttons, so the first tick moves nothing.
const bar = 'flex min-h-16 flex-wrap items-center gap-2 border-b px-5 py-2.5'

/** A list's row above the table for acting on several rows: how many are
 * ticked, what can be done to all of them (`children`: buttons), and a way
 * to untick them. While none is, it stays in place saying how it works:
 * appearing on the first tick would push the rows down under the pointer,
 * and the next click would land on the wrong row. Shared by every list
 * with actions on several rows. */
export function SelectionBar({
  label,
  count,
  onClear,
  children,
}: {
  /** The group's accessible name: what the actions act on. */
  label: string
  count: number
  onClear: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  if (count === 0) {
    return (
      <p className={`${bar} text-sm text-paper-ink/70 dark:text-fg-muted ${panelDivider}`}>
        {t('common.selection.none')}
      </p>
    )
  }
  return (
    <div role="group" aria-label={label} className={`${bar} ${panelDivider}`}>
      <span role="status" className="text-sm font-medium text-paper-ink dark:text-fg">
        {t('common.selection.selected', { count })}
      </span>
      {children}
      <button type="button" onClick={onClear} className={`text-sm ${linkAccent}`}>
        {t('common.selection.clear')}
      </button>
    </div>
  )
}

/** A row's (or the page's) tick box. The label is the target: 32px around
 * a 16px box. `some` without `checked` draws the page box as mixed. */
export function SelectBox({
  label,
  checked,
  some = false,
  disabled = false,
  onChange,
}: {
  label: string
  checked: boolean
  some?: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="-m-2 inline-flex cursor-pointer p-2">
      <input
        type="checkbox"
        checked={checked}
        ref={(input) => {
          if (input) input.indeterminate = some && !checked
        }}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
        className="h-4 w-4 accent-accent-fg"
      />
    </label>
  )
}
