import { useTranslation } from 'react-i18next'

import type { TTXRead } from '../../lib/types'

/** Where an exercise's session stands, for a list of exercises: in play
 * (live or paused), over, or still to come -- with its planned day once
 * the session plan is ready. Read from the exercise list, so it is as
 * fresh as the last time the list loaded. */
export function SessionStanding({ ttx }: { ttx: Pick<TTXRead, 'run_state' | 'session_date'> }) {
  const { t, i18n } = useTranslation()
  const state = ttx.run_state ?? 'not_started'
  if (state === 'live' || state === 'paused') {
    return (
      <span className="inline-flex h-6 items-center gap-1.5 rounded-xs border border-success/50 px-2 text-xs font-medium whitespace-nowrap text-success-fg">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
        {t(`execution.sessionState.${state}`)}
      </span>
    )
  }
  if (state !== 'not_started') {
    return (
      <span className="text-sm whitespace-nowrap text-paper-ink/70 dark:text-fg-muted">
        {t(`execution.sessionState.${state}`)}
      </span>
    )
  }
  if (!ttx.session_date) {
    return (
      <span className="text-sm whitespace-nowrap text-paper-ink/70 dark:text-fg-muted">
        {t('execution.sessionState.notStarted')}
      </span>
    )
  }
  // A calendar day, not an instant: built from its parts so no time zone
  // moves it.
  const [year, month, day] = ttx.session_date.split('-').map(Number)
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
    new Date(year, month - 1, day),
  )
  return (
    <span className="text-sm whitespace-nowrap">
      {t('execution.sessionState.plannedFor', { date })}
    </span>
  )
}
