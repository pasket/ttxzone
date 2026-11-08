import { useTranslation } from 'react-i18next'

import { useStageRoom, useViewedRoom } from '../../hooks/useViewedRoom'
import {
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../lib/buttonStyles'
import { injectSequence, mainInjects, questionsOf, roomInjects } from '../../lib/run'
import type { RunInject, RunRead, RunRooms } from '../../lib/types'
import { InjectHistory, InjectStage, type StageView } from './InjectStage'
import { InjectTimer } from './InjectTimer'

/** Rooms, in the sticky band (bare: it sits at the right of the presence
 * strip): a Player reads where they are (the Controller decides it, and a
 * change is announced); everyone else picks the room to look at -- the main
 * room or any team's -- seeing exactly what its Players see. Nothing
 * without rooms. */
export function RoomBar({ run }: { run: RunRead }) {
  const { t } = useTranslation()
  const rooms = run.rooms
  const { viewed, view } = useViewedRoom(rooms)
  if (!rooms || run.state === 'not_started') return null

  if (rooms.me) {
    const inMain = rooms.me.location === 'main'
    const where = inMain
      ? t('playground.rooms.mainRoom')
      : t('playground.rooms.roomName', { code: rooms.me.room_code, name: rooms.me.room_name })
    return (
      <p aria-live="polite" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
          {t('playground.rooms.youAreIn', { where })}
        </span>
        <span className="text-paper-ink/70 dark:text-fg-muted">
          {!rooms.me.room_code
            ? t('playground.rooms.noSeat')
            : inMain
              ? t('playground.rooms.broughtToMain')
              : ''}
        </span>
      </p>
    )
  }

  const here = (room: RunRooms['rooms'][number]) => room.players - room.in_main
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span id="room-switch-label" className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('playground.rooms.view')}
      </span>
      <div className="max-w-full overflow-x-auto">
        <div role="radiogroup" aria-labelledby="room-switch-label" className={segmentedControl}>
          {[
            {
              key: 'main',
              label: t('playground.rooms.mainRoom'),
              count: rooms.in_main,
            },
            ...rooms.rooms.map((room) => ({
              key: room.code,
              label: t('playground.rooms.roomName', { code: room.code, name: room.name }),
              count: here(room),
            })),
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={viewed === option.key}
              onClick={() => view(option.key)}
              className={`${viewed === option.key ? segmentedOptionActive : segmentedOptionIdle} whitespace-nowrap`}
            >
              {option.label}
              <span className="ml-1.5 text-xs tabular-nums text-paper-ink/60 dark:text-fg-muted">
                <span className="sr-only">{t('playground.rooms.playersHere')}: </span>
                {option.count}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** The stage of a session: without rooms, every delivered inject; in
 * rooms, the room in view (a Player's own location, else the one picked)
 * -- a team room's injects, or the main room's screen -- with the other
 * place a Player belongs to folded below. */
export function RoomStage({ ttxId, run, view }: { ttxId: string; run: RunRead; view?: StageView }) {
  const { t } = useTranslation()
  const rooms = run.rooms
  view ??= { sequence: injectSequence(run), showCodes: true, reviewing: null, onReview: () => {} }
  const where = useStageRoom(rooms)
  // The time since the last inject, on the latest released one -- none
  // once ENDEX is out: the play is over.
  const latest = run.endex_released_at ? undefined : run.injects[run.injects.length - 1]
  const timer = latest && {
    code: latest.code,
    node: <InjectTimer run={run} />,
  }
  const shared = { ttxId, phases: run.phases, timer, view }
  if (!rooms) return <InjectStage {...shared} injects={run.injects} />

  const own = rooms.me?.room_code ?? null
  const main = mainInjects(run.injects, rooms)
  const roomName = (code: string) => rooms.rooms.find((r) => r.code === code)?.name ?? code

  const mainStage = (
    <InjectStage
      {...shared}
      injects={questionsOf(main, 'main')}
      currentCode={rooms.main_projected}
      currentLabel={t('playground.rooms.onScreen')}
      emptyText={t('playground.rooms.nothingOnScreen')}
    />
  )
  const roomStage = (code: string) => (
    <InjectStage
      {...shared}
      injects={questionsOf(roomInjects(run.injects, code), code)}
      currentLabel={t('playground.rooms.inRoom', { name: roomName(code) })}
    />
  )
  // A Player's other place, to look back on.
  const folded = (injects: RunInject[], heading: string) =>
    rooms.me && injects.length > 0 ? (
      <details className="rounded-sm border border-panel-line">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">{heading}</summary>
        <div className="p-4 pt-0">
          <InjectHistory ttxId={ttxId} injects={[...injects].reverse()} heading="" view={view} />
        </div>
      </details>
    ) : null

  if (where === 'main' || where === null) {
    return (
      <div className="space-y-4">
        {mainStage}
        {own &&
          folded(
            roomInjects(run.injects, own),
            t('playground.rooms.otherRoom', {
              name: roomName(own),
              count: roomInjects(run.injects, own).length,
            }),
          )}
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {roomStage(where)}
      {folded(main, t('playground.rooms.otherMain', { count: main.length }))}
    </div>
  )
}
