import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStorylineFrame } from '../../hooks/useStorylineFrame'
import { draftFromMsel, incidentMinutesAt } from '../../lib/msel'
import { storylineProgress } from '../../lib/run'
import { storylineMap } from '../../lib/storylineMap'
import type { RunRead } from '../../lib/types'
import { StorylineFrame } from '../creator/msel/StorylineFrame'
import { StorylineGraph } from '../creator/msel/StorylineGraph'

/** Folded, unpinned and without session time until the viewer asks for
 * them, but with the legend (it says what the paler lines and labels
 * mean); their choices are remembered in this browser only. */
const STORAGE = {
  open: 'ttx_control_storyline_strip',
  pinned: 'ttx_control_storyline_pinned',
  session: 'ttx_control_storyline_session',
  legend: 'ttx_control_storyline_legend',
}
const DEFAULTS = { open: false, pinned: false, session: false, legend: true }

/** The original storyline for the Controller, across the whole page above
 * the exercise band, the stage and the control panel -- every inject, the ones delivered in
 * full ink and the rest muted -- with a line where the exercise stands (the latest
 * delivered inject), the session's clock as a fainter dashed one, and how
 * far off schedule that leaves it. The MSEL strip's frame: legend, session
 * time, maximize, pin (the Playground's header then sticks below it) and
 * fold. */
export function ControlStoryline({
  run,
  control,
}: {
  run: RunRead
  control: NonNullable<RunRead['control']>
}) {
  const { t } = useTranslation()
  const frame = useStorylineFrame(STORAGE, DEFAULTS)
  const draft = useMemo(() => draftFromMsel(control.msel), [control.msel])
  const map = useMemo(() => storylineMap(draft), [draft])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (run.state !== 'live') return
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [run.state])

  const released = new Set(control.injects.filter((i) => i.state === 'released').map((i) => i.code))
  const highlight = new Set(
    control.msel.injects.filter((i) => released.has(i.code)).map((i) => i.id),
  )
  const progress = storylineProgress(run, control.injects, now)
  const running = run.state === 'live' || run.state === 'paused'
  // After ENDEX the line reaches the end, even with phases left unplayed.
  const finished = Boolean(run.endex_released_at)

  return (
    <StorylineFrame
      frame={frame}
      title={t('playground.control.storyline')}
      summary={
        progress && running
          ? progress.drift > 0
            ? t('playground.control.storylineDrift.behind', { minutes: progress.drift })
            : progress.drift < 0
              ? t('playground.control.storylineDrift.ahead', { minutes: -progress.drift })
              : t('playground.control.storylineDrift.onTime')
          : undefined
      }
      hasMap
      offsetVar="--playground-top-offset"
      legendExtra={
        <>
          {/* What has and hasn't been run through differs by its line
              (solid, or paler and dotted) and an inject's label tone (the
              map's nodes are alike), so the legend shows both. */}
          <li className="flex items-center gap-1.5 text-paper-ink/80 dark:text-fg-muted">
            <span aria-hidden="true" className="h-0.5 w-4 bg-accent" />
            {t('playground.control.storylineLegend.delivered')}
          </li>
          <li className="flex items-center gap-1.5 text-paper-ink/45 dark:text-fg-faint">
            <span
              aria-hidden="true"
              className="w-4 border-t-2 border-dotted border-[color-mix(in_srgb,var(--color-accent)_40%,var(--color-panel))]"
            />
            {t('playground.control.storylineLegend.pending')}
          </li>
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={`h-3 w-px ${finished ? 'bg-success' : 'bg-playhead'}`}
            />
            {finished
              ? t('playground.control.storylineLegend.finished')
              : t('playground.control.storylineLegend.now')}
          </li>
          {running && !finished && (
            <li className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="h-3 border-l border-dashed border-paper-ink/40 dark:border-fg/40"
              />
              {t('playground.control.storylineLegend.clock')}
            </li>
          )}
        </>
      }
    >
      {({ maximized, showSession }) => (
        <StorylineGraph
          map={map}
          phases={draft.phases}
          markActions={() => []}
          highlight={highlight}
          size={maximized ? 'large' : 'normal'}
          startTime={draft.exercise_start}
          incidentAt={(minutes) => incidentMinutesAt(draft, minutes)}
          incidentStart={draft.incident_start}
          showSession={showSession}
          now={progress?.point ?? null}
          clock={running && !finished ? (progress?.clock ?? null) : null}
          finished={finished}
          fadeUntraversed
        />
      )}
    </StorylineFrame>
  )
}
