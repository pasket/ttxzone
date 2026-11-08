import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatStopwatch, injectElapsedSeconds } from '../../lib/run'
import type { RunRead } from '../../lib/types'

/** The time since the last inject was released, pauses left out: a quiet
 * readout, frozen while paused or over (`withIcon`: a stopwatch before
 * it). The Controller resets it from the control panel. Null before any
 * inject. */
export function InjectTimer({ run, withIcon = true }: { run: RunRead; withIcon?: boolean }) {
  const { t } = useTranslation()
  // Ticks every second while live (never read during render).
  const [now, setNow] = useState(() => Date.now())
  const live = run.state === 'live'
  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [live])

  const seconds = injectElapsedSeconds(run, now)
  if (seconds === null) return null
  return (
    <span className="inline-flex items-center gap-2 text-sm text-paper-ink/60 dark:text-fg-muted">
      {withIcon && (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2 2M9 2h6" />
        </svg>
      )}
      <span
        role="timer"
        aria-label={t('playground.injectTimer')}
        translate="no"
        className={`font-mono tabular-nums ${live ? '' : 'opacity-70'}`}
      >
        {formatStopwatch(seconds)}
      </span>
    </span>
  )
}
