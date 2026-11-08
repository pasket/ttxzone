/** "Last login" helpers for the people tables (Admin -> Planners /
 * Program Managers, Creator -> Exercise -> planning team). Pure: `now` is
 * always passed in, never read here. */

/** How long an account has gone without logging in. Thresholds are
 * calendar months, not 30-day blocks, so "over 3 months" matches what an
 * admin reads on a calendar. */
export type InactivityLevel = 'recent' | 'over3Months' | 'over6Months' | 'over12Months'

function monthsBefore(now: Date, months: number): Date {
  const date = new Date(now)
  date.setMonth(date.getMonth() - months)
  return date
}

export function inactivityLevel(lastLogin: Date, now: Date): InactivityLevel {
  if (lastLogin < monthsBefore(now, 12)) return 'over12Months'
  if (lastLogin < monthsBefore(now, 6)) return 'over6Months'
  if (lastLogin < monthsBefore(now, 3)) return 'over3Months'
  return 'recent'
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "5 minutes ago", "yesterday", "4 months ago", "2 years ago" in `locale`. */
export function formatRelativeTime(date: Date, now: Date, locale: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const elapsed = Math.max(0, now.getTime() - date.getTime())
  if (elapsed < HOUR) return rtf.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return rtf.format(-Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < 30 * DAY) return rtf.format(-Math.floor(elapsed / DAY), 'day')
  const months =
    (now.getFullYear() - date.getFullYear()) * 12 +
    (now.getMonth() - date.getMonth()) -
    (now.getDate() < date.getDate() ? 1 : 0)
  if (months < 12) return rtf.format(-Math.max(1, months), 'month')
  // "1 year ago", not "last year" -- which reads as the previous calendar
  // year and hides how stale the account really is.
  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(
    -Math.floor(months / 12),
    'year',
  )
}
