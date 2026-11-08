import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatRelativeTime, inactivityLevel } from '../../lib/lastLogin'
import type { InactivityLevel } from '../../lib/lastLogin'

type StaleLevel = Exclude<InactivityLevel, 'recent'>

// Tinted chip (text + 12% background of the same token), never a solid
// fill -- same treatment as TagChip, so it reads as status, not a button.
const STALE_CLASS: Record<StaleLevel, string> = {
  over3Months: 'bg-inactive-1/12 text-inactive-1',
  over6Months: 'bg-inactive-2/12 text-inactive-2',
  over12Months: 'bg-inactive-3/12 text-inactive-3',
}

const STALE_LABEL_KEY = {
  over3Months: 'common.lastLogin.over3Months',
  over6Months: 'common.lastLogin.over6Months',
  over12Months: 'common.lastLogin.over12Months',
} as const

/** One icon shape per level (clock -> triangle -> solid octagon), so the
 * escalation still reads without color (WCAG 1.4.1) and for color-blind
 * viewers. */
function StaleIcon({ level }: { level: StaleLevel }) {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {level === 'over3Months' && (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </>
      )}
      {level === 'over6Months' && (
        <>
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          <path d="M12 9v4M12 17h.01" />
        </>
      )}
      {level === 'over12Months' && (
        <>
          {/* Solid, not outlined: at 14px an outlined octagon reads as the
              level-1 circle. The mark is cut out in the panel color. */}
          <path d="M7.9 2h8.2L22 7.9v8.2L16.1 22H7.9L2 16.1V7.9Z" fill="currentColor" />
          <path d="M12 7.5v5M12 16.5h.01" stroke="var(--color-panel)" strokeWidth={2.5} />
        </>
      )}
    </svg>
  )
}

/** "Last login" table cell: relative time ("4 months ago"), with the exact
 * date on hover. Past 3 / 6 / 12 months without a login it becomes an
 * escalating warning chip whose meaning is also spelled out for screen
 * readers. `null` = no login recorded. */
export function LastLogin({ value }: { value: string | null }) {
  const { t, i18n } = useTranslation()
  // One reference time per mount keeps every row consistent and render pure.
  const [now] = useState(() => new Date())

  if (!value) {
    return (
      <span className="text-sm text-paper-ink/60 dark:text-fg-faint">
        {t('common.lastLogin.never')}
      </span>
    )
  }

  const date = new Date(value)
  const relative = formatRelativeTime(date, now, i18n.language)
  const exact = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
  const level = inactivityLevel(date, now)

  if (level === 'recent') {
    return (
      <time
        dateTime={value}
        title={exact}
        className="whitespace-nowrap text-sm text-paper-ink/70 dark:text-fg-muted"
      >
        {relative}
      </time>
    )
  }

  const warning = t(STALE_LABEL_KEY[level])
  return (
    <span
      title={`${warning} · ${exact}`}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xs px-1.5 py-0.5 text-xs font-medium ${STALE_CLASS[level]}`}
    >
      <StaleIcon level={level} />
      <time dateTime={value}>{relative}</time>
      <span className="sr-only">({warning})</span>
    </span>
  )
}
