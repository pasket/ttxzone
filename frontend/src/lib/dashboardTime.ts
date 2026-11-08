import type { TFunction } from 'i18next'

const DAY_MS = 24 * 60 * 60 * 1000

/** Backend timestamps are aware UTC ("...+00:00") since the SQLModel
 * UTCDateTime migration; an offset-less value is still read as UTC, never
 * as local time, to stay safe with any older payload. */
export function parseUtc(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}

/** "YYYY-MM-DD" as a local calendar date (not UTC midnight, which shows
 * the previous day west of Greenwich). */
export function parseDay(value: string): Date {
  return new Date(`${value}T00:00:00`)
}

/** Context line under a "Pending requests" KPI. Measured against the
 * snapshot's own `generated_at` (not Date.now()), so the figure matches
 * the rest of the data and render stays pure. */
export function pendingKpiContext(
  t: TFunction,
  generatedAt: string,
  oldestPendingAt: string | null,
): string {
  if (!oldestPendingAt) return t('dashboard.pending.none')
  const days = Math.floor(
    (parseUtc(generatedAt).getTime() - parseUtc(oldestPendingAt).getTime()) / DAY_MS,
  )
  return days < 1
    ? t('dashboard.pending.oldestToday')
    : t('dashboard.pending.oldest', { count: days })
}
