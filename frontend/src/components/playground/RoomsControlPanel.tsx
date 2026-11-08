import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnPrimary, btnSecondary, inputCompact } from '../../lib/buttonStyles'
import { codeRefText } from '../../lib/codeRef'
import type { RunRead, RunRoomPlayer, RunRooms } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'
import type { ControlAct } from './ControlCenterPanel'

const small = `${btnSecondary} h-7 px-2 text-xs`

/** The Controller's rooms: what the main room has on its screen (stop it;
 * an inject is put there from the queue), and who is where -- everyone, a
 * room or one Player brought to the main room or sent back to their own.
 * Players without a room are always in the main room; they're seated
 * here mid-session. */
export function RoomsControlPanel({
  run,
  rooms,
  pending,
  act,
}: {
  run: RunRead
  rooms: RunRooms
  pending: string | null
  act: ControlAct
}) {
  const { t } = useTranslation()
  const [seating, setSeating] = useState(false)
  const players = rooms.players ?? []
  const unseated = players.filter((p) => p.room_code === null)
  const projected = run.injects.find((i) => i.code === rooms.main_projected)
  const busy = pending !== null
  const move = (key: string, body: Record<string, unknown>) => void act(key, '/players/move', body)

  return (
    <Panel title={t('playground.control.rooms.title')}>
      <div className="space-y-4">
        <section aria-labelledby="rooms-main" className="space-y-2">
          <h3 id="rooms-main" className="text-sm font-semibold">
            {t('playground.rooms.mainRoom')}
            <span className="ml-2 font-normal text-paper-ink/70 dark:text-fg-muted">
              {t('playground.control.rooms.here', { count: rooms.in_main })}
            </span>
          </h3>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-panel-line p-3 text-sm">
            {projected ? (
              <>
                <span className="min-w-0">
                  <span className="text-paper-ink/70 dark:text-fg-muted">
                    {t('playground.control.rooms.onScreen')}{' '}
                  </span>
                  <CodeRef code={projected.code} title={projected.title} />
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act('project', '/main/project', { code: null })}
                  className={small}
                >
                  {pending === 'project' ? (
                    <ButtonSpinner />
                  ) : (
                    t('playground.control.rooms.stopProjecting')
                  )}
                </button>
              </>
            ) : (
              <span className="text-paper-ink/70 dark:text-fg-muted">
                {t('playground.control.rooms.nothingOnScreen')}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => move('all-main', { to: 'main' })}
              className={btnSecondary}
            >
              {pending === 'all-main' ? <ButtonSpinner /> : t('playground.control.rooms.allToMain')}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => move('all-room', { to: 'room' })}
              className={btnSecondary}
            >
              {pending === 'all-room' ? (
                <ButtonSpinner />
              ) : (
                t('playground.control.rooms.allToRooms')
              )}
            </button>
          </div>
        </section>

        <ul className="divide-y divide-panel-line border-y border-panel-line">
          {rooms.rooms.map((room) => {
            const seated = players.filter((p) => p.room_code === room.code)
            const inRoom = room.players - room.in_main
            return (
              <li key={room.code} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1 text-sm">
                    <CodeRef code={room.code} title={room.name} strong />
                    <span className="block text-xs text-paper-ink/70 dark:text-fg-muted">
                      {t('playground.control.rooms.split', { room: inRoom, main: room.in_main })}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy || inRoom === 0}
                    onClick={() => move(`main-${room.code}`, { to: 'main', room_code: room.code })}
                    aria-label={t('playground.control.rooms.roomToMainLabel', { name: room.name })}
                    className={small}
                  >
                    {t('playground.control.rooms.toMain')}
                  </button>
                  <button
                    type="button"
                    disabled={busy || room.in_main === 0}
                    onClick={() => move(`room-${room.code}`, { to: 'room', room_code: room.code })}
                    aria-label={t('playground.control.rooms.roomBackLabel', { name: room.name })}
                    className={small}
                  >
                    {t('playground.control.rooms.toRoom')}
                  </button>
                </div>
                {seated.length > 0 && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-xs text-paper-ink/70 dark:text-fg-muted">
                      {t('playground.control.rooms.whoIsWhere', { count: seated.length })}
                    </summary>
                    <ul className="mt-2 space-y-1">
                      {seated.map((player) => (
                        <PlayerRow
                          key={player.user_id}
                          player={player}
                          busy={busy}
                          onMove={(to) =>
                            move(`player-${player.user_id}`, { to, user_ids: [player.user_id] })
                          }
                        />
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            )
          })}
        </ul>

        {unseated.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="text-paper-ink/70 dark:text-fg-muted">
              {t('playground.control.rooms.unseated', { count: unseated.length })}
            </p>
            <button type="button" onClick={() => setSeating(true)} className={small}>
              {t('playground.control.rooms.seat')}
            </button>
          </div>
        )}
      </div>

      {seating && (
        <SeatDialog
          players={unseated}
          rooms={rooms}
          pending={pending === 'seats'}
          onClose={() => setSeating(false)}
          onSeat={async (assignments) => {
            if (await act('seats', '/seats', { assignments }, 'PUT')) setSeating(false)
          }}
        />
      )}
    </Panel>
  )
}

function PlayerRow({
  player,
  busy,
  onMove,
}: {
  player: RunRoomPlayer
  busy: boolean
  onMove: (to: 'main' | 'room') => void
}) {
  const { t } = useTranslation()
  const inMain = player.location === 'main'
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="min-w-0 truncate">
        {player.name}
        <span className="ml-2 text-xs text-paper-ink/60 dark:text-fg-muted">
          {inMain ? t('playground.rooms.mainRoom') : t('playground.control.rooms.inTheirRoom')}
        </span>
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onMove(inMain ? 'room' : 'main')}
        aria-label={t(
          inMain
            ? 'playground.control.rooms.playerBackLabel'
            : 'playground.control.rooms.playerToMainLabel',
          { name: player.name },
        )}
        className={small}
      >
        {inMain ? t('playground.control.rooms.toRoom') : t('playground.control.rooms.toMain')}
      </button>
    </li>
  )
}

/** Seat the Players who have no room yet (a late one, say). */
function SeatDialog({
  players,
  rooms,
  pending,
  onClose,
  onSeat,
}: {
  players: RunRoomPlayer[]
  rooms: RunRooms
  pending: boolean
  onClose: () => void
  onSeat: (assignments: { user_id: string; room_code: string }[]) => Promise<void>
}) {
  const { t } = useTranslation()
  const [seats, setSeats] = useState<Record<string, string>>({})
  const chosen = Object.entries(seats)
    .filter(([, code]) => code)
    .map(([user_id, room_code]) => ({ user_id, room_code }))
  return (
    <Modal titleId="run-seat-title" onClose={onClose}>
      <div className="w-full max-w-sm space-y-4">
        <h2 id="run-seat-title" className="text-lg font-semibold tracking-tight">
          {t('playground.control.rooms.seatTitle')}
        </h2>
        <ul className="space-y-2">
          {players.map((player) => (
            <li key={player.user_id} className="flex items-center justify-between gap-3 text-sm">
              <label htmlFor={`run-seat-${player.user_id}`} className="min-w-0 truncate">
                {player.name}
              </label>
              <select
                id={`run-seat-${player.user_id}`}
                value={seats[player.user_id] ?? ''}
                onChange={(e) => setSeats({ ...seats, [player.user_id]: e.target.value })}
                className={`${inputCompact} w-44`}
              >
                <option value="">{t('playground.control.rooms.chooseRoom')}</option>
                {rooms.rooms.map((room) => (
                  <option key={room.code} value={room.code}>
                    {codeRefText(room.code, room.name)}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || chosen.length === 0}
            onClick={() => void onSeat(chosen)}
            className={`flex-1 ${btnPrimary}`}
          >
            {pending ? <ButtonSpinner /> : t('playground.control.rooms.seatSubmit')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
