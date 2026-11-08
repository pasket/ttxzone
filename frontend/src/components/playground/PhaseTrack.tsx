import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatOffset } from '../../lib/msel'
import { scenarioClock, sessionElapsed } from '../../lib/run'
import type { RunInject, RunRead } from '../../lib/types'
import type { StageView } from './InjectStage'

const CHIP: Record<'done' | 'current' | 'upcoming', string> = {
  done: 'border-success bg-success text-white',
  current: 'border-accent bg-accent text-ink',
  upcoming: 'border-paper-line text-paper-ink/60 dark:border-line dark:text-fg-muted',
}
const HEADLINE: Record<'done' | 'current' | 'upcoming', string> = {
  done: 'text-success-fg',
  current: 'text-accent-fg',
  upcoming: '',
}

/** Where the exercise stands: the scenario's day and time with the
 * session's planned start and elapsed T+, then one column per phase -- its
 * chip, done (✓, name), the current one, and the ones still ahead,
 * nameless; its own headline; and the injects on the stage delivered in
 * it, numbered in the order they reached the viewer, to follow the story
 * and pick one to read again on the stage. Names wrap to two lines. Colour
 * carries state only. The strip keeps the current phase in view. */
export function PhaseTrack({
  run,
  injects = run.injects,
  inPlayCode = injects[injects.length - 1]?.code ?? null,
  view,
}: {
  run: RunRead
  /** The injects on the stage (rooms: the place in view). */
  injects?: RunInject[]
  inPlayCode?: string | null
  view?: StageView
}) {
  const { t, i18n } = useTranslation()
  // A clock for T+, ticking twice a minute (never read during render).
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (run.state !== 'live') return
    const timer = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(timer)
  }, [run.state])

  // Scroll the strip (never the page) so the current phase shows, at the
  // right edge when it's past it, keeping the ones before it in view.
  const strip = useRef<HTMLOListElement>(null)
  const currentCode = run.phases.find((phase) => phase.state === 'current')?.code
  useEffect(() => {
    const ol = strip.current
    const li = ol?.querySelector<HTMLElement>('[aria-current="step"]')
    if (!ol || !li) return
    const end = li.offsetLeft + li.offsetWidth
    if (li.offsetLeft < ol.scrollLeft || end > ol.scrollLeft + ol.clientWidth) {
      ol.scrollLeft = Math.max(0, end - ol.clientWidth)
    }
  }, [currentCode])

  const clock = scenarioClock(run)
  const elapsed = sessionElapsed(run, now)
  // Each phase's injects; one without a phase (ENDEX) closes the last
  // phase that has begun.
  const begun = run.phases.filter((phase) => phase.state !== 'upcoming')
  const lastBegun = begun[begun.length - 1]?.code
  const byPhase = new Map<string, RunInject[]>()
  for (const inject of injects) {
    const code = run.phases.some((p) => p.code === inject.phase_code)
      ? inject.phase_code
      : lastBegun
    if (code) byPhase.set(code, [...(byPhase.get(code) ?? []), inject])
  }

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-panel-line bg-panel p-4 lg:flex-row lg:items-start">
      <div className="shrink-0 lg:w-56">
        <p className="font-mono text-xl font-semibold" translate="no">
          {clock
            ? clock.date
              ? `${new Intl.DateTimeFormat(i18n.language, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  timeZone: 'UTC',
                }).format(new Date(`${clock.date}T00:00:00Z`))} · ${clock.time}`
              : t('playground.scenarioClock', clock)
            : '—'}
        </p>
        <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
          {[
            run.session_time && t('playground.sessionAt', { time: run.session_time.slice(0, 5) }),
            elapsed !== null && formatOffset(elapsed),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <ol
        ref={strip}
        aria-label={t('playground.phases')}
        // It scrolls, and nothing inside it can take the focus before the start.
        tabIndex={0}
        className="relative flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1"
      >
        {run.phases.map((phase) => {
          const name = phase.name ?? t('playground.phaseNumber', { number: phase.number })
          const rows = byPhase.get(phase.code) ?? []
          return (
            <li
              key={phase.code}
              aria-current={phase.state === 'current' ? 'step' : undefined}
              className="flex min-w-40 flex-1 flex-col gap-1"
            >
              <span
                className={`flex h-12 items-center rounded-sm border px-2.5 text-left text-sm leading-snug font-medium ${CHIP[phase.state]}`}
              >
                {/* Two lines at most (the chip's height): the rest is
                    clamped, the whole name in the tooltip and the DOM. */}
                <span className="line-clamp-2 min-w-0 break-words" title={name}>
                  {phase.state === 'done' && (
                    <span aria-hidden="true" className="mr-1">
                      ✓
                    </span>
                  )}
                  {name}
                </span>
                {phase.state === 'done' && (
                  <span className="sr-only">({t('playground.phaseDone')})</span>
                )}
              </span>
              {phase.headline && (
                <span
                  className={`line-clamp-2 text-xs leading-snug ${HEADLINE[phase.state]}`}
                  title={phase.headline}
                >
                  {phase.headline}
                </span>
              )}
              {rows.length > 0 && (
                <PhaseInjects
                  phaseName={name}
                  injects={rows}
                  inPlayCode={inPlayCode}
                  sequence={view?.sequence}
                  shownCode={view ? (view.reviewing ?? inPlayCode) : null}
                  onPick={view && ((code) => view.onReview(code === inPlayCode ? null : code))}
                />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** A phase's delivered injects, oldest first, in a short list of its own
 * that scrolls (kept at its newest): `#N` and the title on one line, the
 * one in play dotted, the one on the stage marked. Each is a button to put
 * it on the stage when the viewer can pick (`onPick`). */
function PhaseInjects({
  phaseName,
  injects,
  inPlayCode,
  sequence,
  shownCode,
  onPick,
}: {
  phaseName: string
  injects: RunInject[]
  inPlayCode: string | null
  sequence?: Map<string, number>
  shownCode: string | null
  onPick?: (code: string) => void
}) {
  const { t } = useTranslation()
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [injects.length])

  return (
    <ol
      ref={list}
      aria-label={t('playground.track.injects', { phase: phaseName })}
      className="max-h-[4.75rem] space-y-0.5 overflow-y-auto"
    >
      {injects.map((inject, index) => {
        const seq = sequence?.get(inject.code) ?? index + 1
        const shown = inject.code === shownCode
        const content = (
          <>
            <span className="shrink-0 font-mono text-paper-ink/70 tabular-nums dark:text-fg-muted">
              {t('playground.seq', { seq })}
            </span>
            <span className="min-w-0 flex-1 truncate">{inject.title}</span>
            {inject.code === inPlayCode && (
              <>
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span className="sr-only">({t('playground.track.inPlay')})</span>
              </>
            )}
          </>
        )
        const row = `flex min-h-6 w-full items-center gap-1.5 rounded-xs px-1.5 py-0.5 text-left text-xs leading-snug ${
          shown ? 'bg-paper-line font-medium dark:bg-line' : ''
        }`
        return (
          <li key={inject.code}>
            {onPick ? (
              <button
                type="button"
                onClick={() => onPick(inject.code)}
                aria-current={shown ? 'true' : undefined}
                title={inject.title}
                className={`${row} cursor-pointer hover:bg-hover focus-visible:outline-2 focus-visible:outline-accent-fg`}
              >
                {content}
              </button>
            ) : (
              <span className={row} title={inject.title}>
                {content}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}
