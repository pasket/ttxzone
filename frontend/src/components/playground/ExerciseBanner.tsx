import { useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

import type { RunRead } from '../../lib/types'
import { RealWorldDialog } from './RealWorldDialog'

/** The band that tells everyone this is an exercise, and how to halt it
 * for a real incident -- always on screen, never folded. While the session
 * runs, REAL WORLD is a button anyone may press; once pressed (or the
 * session stopped) the band turns red and says so. After ENDEX it says the
 * play is over. On a projector it runs edge to edge (`className`) with
 * the way out at its end (`aside`). */
export function ExerciseBanner({
  ttxId,
  run,
  apply,
  className = 'rounded-sm',
  aside,
}: {
  ttxId: string
  run: RunRead
  apply: (next: RunRead) => void
  className?: string
  aside?: ReactNode
}) {
  const { t } = useTranslation()
  const [asking, setAsking] = useState(false)
  const keyword = run.stop_keyword.trim() || 'REAL WORLD'
  const realWorld = run.state === 'paused' && Boolean(run.real_world_at)
  // Once ENDEX is out the play is over: nothing left to halt.
  const endex = run.state === 'live' && Boolean(run.endex_released_at)
  const running = (run.state === 'live' || run.state === 'paused') && !endex
  const alarm = realWorld || run.state === 'stopped'
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 text-sm font-semibold tracking-wide ${className} ${
        alarm ? 'bg-danger text-white' : 'bg-paper-ink text-paper dark:bg-fg dark:text-ink'
      }`}
    >
      <span className="uppercase">
        {realWorld
          ? t('playground.realWorld.banner')
          : endex
            ? t('playground.endexBanner')
            : t('playground.banner')}
      </span>
      {running && !realWorld ? (
        <span className="flex items-center gap-2 font-normal">
          {t('playground.realWorld.press')}
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="rounded-sm border border-current px-2 py-0.5 font-mono font-semibold hover:bg-danger hover:text-white focus-visible:ring-2 focus-visible:ring-accent-fg focus-visible:outline-none"
            translate="no"
          >
            {keyword}
          </button>
        </span>
      ) : (
        !realWorld &&
        !endex &&
        run.stop_keyword && (
          <span className="font-normal">
            {t('playground.stopKeyword')}{' '}
            <strong translate="no" className="font-mono font-semibold">
              «{run.stop_keyword}»
            </strong>
          </span>
        )
      )}
      {aside}
      {/* On the body: the band sits in a sticky header, whose stacking
          context would leave the dialog under a pinned storyline. In the
          browser's full screen only that element shows: there instead. */}
      {asking &&
        createPortal(
          <RealWorldDialog
            ttxId={ttxId}
            keyword={keyword}
            onClose={() => setAsking(false)}
            apply={apply}
          />,
          document.fullscreenElement ?? document.body,
        )}
    </div>
  )
}
