import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import {
  actionsCellClass,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputCompact,
  linkAccent,
  optionalSuffix,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../lib/buttonStyles'
import { codeRefText } from '../../lib/codeRef'
import {
  panelActionsTh,
  panelDivider,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import { filterAndSortPeople, PEOPLE_SORT_OPTIONS } from '../../lib/peopleTable'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type { RoomPlayerRead, RoomRead, RoomsRead, TTXRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { EditButton } from '../common/EditButton'
import { IconButton } from '../common/IconButton'
import { LastLogin } from '../common/LastLogin'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'
import { Switch } from '../common/Switch'
import { TableToolbar } from '../common/TableToolbar'

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

type Filter = 'all' | 'unseated'

/** Creator -> Exercise -> Edit: whether the exercise is played in several
 * rooms at once, which ones, and where each Player sits. Off by default --
 * then it's one switch and a line, nothing else. On: the rooms (the main
 * room is always there, where the Controller projects an inject for
 * everyone), then the Players, seated one by one with each row's select
 * or several at once by ticking them, and the team members who follow the
 * session with the room their view opens on. Everything applies at once. While
 * the MSEL is ready or the session has started the rooms can't be added,
 * removed or turned off; renaming them and seating Players still can. */
export function ExerciseRoomsPanel({ ttx }: { ttx: TTXRead }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const base = `/ttx/${ttx.id}/rooms`
  const { data: fetched, error, refetch } = useApiResource<RoomsRead>(base)
  // The answer of the last change, until the next fetch catches up.
  const [latest, setLatest] = useState<RoomsRead | null>(null)
  const data = latest ?? fetched
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<RoomRead | 'new' | null>(null)
  const [removing, setRemoving] = useState<RoomRead | null>(null)
  const hintId = useId()

  async function change(path: string, method: string, body?: unknown, toast?: string) {
    setBusy(true)
    try {
      const result = await apiFetch<RoomsRead>(`${base}${path}`, {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      setLatest(result)
      refetch()
      showToast(toast ?? t('common.toast.savedSuccess'))
      return true
    } catch (err) {
      showToast(errorText(err, t('auth.common.genericError')), { variant: 'error' })
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!data) {
    return error ? (
      <Panel title={t('creator.rooms.title')}>
        <p role="alert" className="text-sm text-danger-fg">
          {t('creator.rooms.loadError')}
        </p>
      </Panel>
    ) : null
  }

  const locked = data.structure_locked
  const seat = (assignments: { user_id: string; room_id: string | null }[]) =>
    change('/assignments', 'PUT', { assignments })

  return (
    <>
      <Panel
        title={t('creator.rooms.title')}
        meta={
          data.uses_rooms
            ? t('creator.rooms.summary', {
                rooms: t('creator.rooms.roomCount', { count: data.rooms.length }),
                players: t('creator.rooms.playerCount', { count: data.players.length }),
              })
            : undefined
        }
        flush
      >
        <div className="space-y-2 px-5 py-4">
          <Switch
            checked={data.uses_rooms}
            disabled={busy || locked}
            describedBy={hintId}
            onChange={(uses_rooms) => void change('/settings', 'PUT', { uses_rooms })}
          >
            {t('creator.rooms.switch')}
          </Switch>
          <p id={hintId} className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.rooms.intro')}
            {!data.uses_rooms &&
              data.rooms.length > 0 &&
              ` ${t('creator.rooms.keptWhenOff', { count: data.rooms.length })}`}
          </p>
          {locked && (
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('creator.rooms.locked')}
            </p>
          )}
        </div>

        {data.uses_rooms && (
          <>
            <RoomList
              rooms={data.rooms}
              locked={locked}
              onAdd={() => setEditing('new')}
              onEdit={setEditing}
              onRemove={setRemoving}
            />
            <PlayerSeats data={data} busy={busy} onSeat={seat} />
            <TeamRooms data={data} busy={busy} onSeat={seat} />
          </>
        )}
      </Panel>

      {editing && (
        <RoomDialog
          room={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (name, description) => {
            const ok =
              editing === 'new'
                ? await change('', 'POST', { name, description }, t('creator.rooms.addedToast'))
                : await change(`/${editing.id}`, 'PATCH', { name, description })
            if (ok) setEditing(null)
          }}
        />
      )}
      {removing && (
        <RemoveRoomDialog
          room={removing}
          busy={busy}
          onClose={() => setRemoving(null)}
          onRemove={async () => {
            if (
              await change(`/${removing.id}`, 'DELETE', undefined, t('creator.rooms.removedToast'))
            )
              setRemoving(null)
          }}
        />
      )}
    </>
  )
}

function RoomList({
  rooms,
  locked,
  onAdd,
  onEdit,
  onRemove,
}: {
  rooms: RoomRead[]
  locked: boolean
  onAdd: () => void
  onEdit: (room: RoomRead) => void
  onRemove: (room: RoomRead) => void
}) {
  const { t } = useTranslation()
  return (
    <div className={`border-t ${panelDivider}`}>
      <ul className={panelTbody}>
        <li className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
          <span className="font-semibold text-paper-ink dark:text-fg">
            {t('creator.rooms.mainRoom')}
          </span>
          <span className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('creator.rooms.mainRoomHint')}
          </span>
        </li>
        {rooms.map((room) => (
          <li key={room.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
            <div className="min-w-0 flex-1">
              <CodeRef code={room.code} title={room.name} strong />
              {room.description && (
                <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{room.description}</p>
              )}
            </div>
            <span className="text-sm tabular-nums text-paper-ink/70 dark:text-fg-muted">
              {t('creator.rooms.playerCount', { count: room.player_count })}
            </span>
            <div className={actionsCellClass}>
              <EditButton
                label={t('creator.rooms.editLabel', { name: room.name })}
                onClick={() => onEdit(room)}
              />
              <IconButton
                label={
                  locked
                    ? t('creator.rooms.removeLocked')
                    : t('creator.rooms.removeLabel', { name: room.name })
                }
                disabled={locked}
                onClick={() => onRemove(room)}
              />
            </div>
          </li>
        ))}
      </ul>
      {rooms.length === 0 && (
        <p className="px-5 pb-1 text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('creator.rooms.noRooms')}
        </p>
      )}
      <div className="px-5 py-3">
        <button type="button" onClick={onAdd} disabled={locked} className={btnSecondary}>
          <span aria-hidden="true">+ </span>
          {t('creator.rooms.addButton')}
        </button>
      </div>
    </div>
  )
}

/** The Players and their room: a select per row, or tick several and seat
 * them together. No dragging. */
function PlayerSeats({
  data,
  busy,
  onSeat,
}: {
  data: RoomsRead
  busy: boolean
  onSeat: (assignments: { user_id: string; room_id: string | null }[]) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const { sortDir, setSortDir, sortBy, setSortBy, search, setSearch } = useTableUrlState(
    'rooms_',
    PEOPLE_SORT_OPTIONS,
  )
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [target, setTarget] = useState('')
  const headingId = useId()
  const unseated = data.players.filter((p) => p.room_id === null).length
  const visible = filterAndSortPeople(
    filter === 'unseated' ? data.players.filter((p) => p.room_id === null) : data.players,
    { search, sortBy, sortDir, grantedAt: (p) => p.joined_at },
  )
  // A Player who left stays out of the selection.
  const chosen = data.players.filter((p) => selected.has(p.user_id))
  const allVisible = visible.length > 0 && visible.every((p) => selected.has(p.user_id))

  function toggle(ids: string[], on: boolean) {
    setSelected((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  async function seatChosen(roomId: string | null) {
    if (await onSeat(chosen.map((p) => ({ user_id: p.user_id, room_id: roomId })))) {
      setSelected(new Set())
      setTarget('')
    }
  }

  const roomLabel = (room: RoomRead) => codeRefText(room.code, room.name)

  return (
    <section aria-labelledby={headingId} className={`border-t ${panelDivider}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
        <h3 id={headingId} className="text-sm font-semibold text-paper-ink dark:text-fg">
          {t('creator.rooms.playersTitle')}
        </h3>
        {data.players.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <div
              role="radiogroup"
              aria-label={t('creator.rooms.filterLabel')}
              className={segmentedControl}
            >
              {(['all', 'unseated'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={filter === value}
                  onClick={() => setFilter(value)}
                  className={filter === value ? segmentedOptionActive : segmentedOptionIdle}
                >
                  {value === 'all'
                    ? t('creator.rooms.filterAll', { count: data.players.length })
                    : t('creator.rooms.filterUnseated', { count: unseated })}
                </button>
              ))}
            </div>
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              sortOptions={PEOPLE_SORT_OPTIONS}
            />
          </div>
        )}
      </div>

      {data.players.length === 0 && (
        <p className="px-5 pb-4 text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('creator.rooms.noPlayers')}{' '}
          <Link to="/creator/players/invitations" className={linkAccent}>
            {t('creator.rooms.goToInvitations')}
          </Link>
        </p>
      )}

      {chosen.length > 0 && (
        <div
          role="group"
          aria-label={t('creator.rooms.bulkLabel')}
          className={`flex flex-wrap items-center gap-2 border-t px-5 py-2.5 ${panelDivider}`}
        >
          <span className="text-sm font-medium text-paper-ink dark:text-fg">
            {t('creator.rooms.selected', { count: chosen.length })}
          </span>
          <label htmlFor="rooms-bulk-target" className="sr-only">
            {t('creator.rooms.bulkTarget')}
          </label>
          <select
            id="rooms-bulk-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className={`${inputCompact} w-auto max-w-56`}
          >
            <option value="">{t('creator.rooms.bulkTarget')}</option>
            {data.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {roomLabel(room)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !target}
            onClick={() => void seatChosen(target)}
            className={btnPrimary}
          >
            {t('creator.rooms.bulkApply')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void seatChosen(null)}
            className={btnSecondary}
          >
            {t('creator.rooms.bulkUnseat')}
          </button>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className={`text-sm ${linkAccent}`}
          >
            {t('creator.rooms.clearSelection')}
          </button>
        </div>
      )}

      {data.players.length > 0 && visible.length === 0 && (
        <p className="px-5 py-8 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
          {search
            ? t('common.toolbar.noSearchResults', { query: search })
            : t('creator.rooms.everyoneSeated')}
        </p>
      )}

      {visible.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left">
            <thead>
              <tr className={panelTableHeadRow}>
                <th scope="col" className={`${panelTh} w-10`}>
                  <input
                    type="checkbox"
                    checked={allVisible}
                    onChange={(e) =>
                      toggle(
                        visible.map((p) => p.user_id),
                        e.target.checked,
                      )
                    }
                    aria-label={t('creator.rooms.selectAll')}
                    className="h-4 w-4 accent-accent-fg"
                  />
                </th>
                <th scope="col" className={panelTh}>
                  {t('creator.rooms.columns.player')}
                </th>
                <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                  {t('common.lastLogin.column')}
                </th>
                <th scope="col" className={`${panelActionsTh} w-64 text-left`}>
                  {t('creator.rooms.columns.room')}
                </th>
              </tr>
            </thead>
            <tbody className={panelTbody}>
              {visible.map((player) => (
                <PlayerRow
                  key={player.user_id}
                  player={player}
                  rooms={data.rooms}
                  checked={selected.has(player.user_id)}
                  busy={busy}
                  onCheck={(on) => toggle([player.user_id], on)}
                  onSeat={(roomId) => void onSeat([{ user_id: player.user_id, room_id: roomId }])}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** The team members who follow the session (Controllers, Facilitators,
 * Evaluators, Observers) and the room their view opens on: a default
 * only -- nobody is moved, and in the session they still look at any
 * room. */
function TeamRooms({
  data,
  busy,
  onSeat,
}: {
  data: RoomsRead
  busy: boolean
  onSeat: (assignments: { user_id: string; room_id: string | null }[]) => Promise<boolean>
}) {
  const { t } = useTranslation()
  const headingId = useId()
  const hintId = useId()
  const team = data.team ?? []
  return (
    <section aria-labelledby={headingId} className={`border-t ${panelDivider}`}>
      <div className="space-y-1 px-5 py-3">
        <h3 id={headingId} className="text-sm font-semibold text-paper-ink dark:text-fg">
          {t('creator.rooms.teamTitle')}
        </h3>
        <p id={hintId} className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('creator.rooms.teamHint')}
        </p>
      </div>
      {team.length === 0 ? (
        <p className="px-5 pb-4 text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('creator.rooms.teamEmpty')}
        </p>
      ) : (
        <table className="w-full text-left" aria-describedby={hintId}>
          <thead>
            <tr className={panelTableHeadRow}>
              <th className={panelTh}>{t('creator.rooms.teamColumns.person')}</th>
              <th className={panelTh}>{t('creator.rooms.teamColumns.follows')}</th>
              <th className={panelTh}>{t('creator.rooms.teamColumns.room')}</th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {team.map((member) => {
              const selectId = `room-default-${member.user_id}`
              return (
                <tr key={member.user_id} className={panelTr}>
                  <th scope="row" className={`${panelTd} text-left font-normal`}>
                    <span className="block font-semibold text-paper-ink dark:text-fg">
                      {member.full_name}
                    </span>
                    <span className="block text-sm text-paper-ink/70 dark:text-fg-muted">
                      {member.email}
                    </span>
                  </th>
                  <td className={`${panelTd} text-sm`}>
                    {member.roles.map((role) => t(CONTEXT_ROLE_LABEL_KEYS[role])).join(' · ')}
                  </td>
                  <td className={panelTd}>
                    <label htmlFor={selectId} className="sr-only">
                      {t('creator.rooms.defaultRoomLabel', { name: member.full_name })}
                    </label>
                    <select
                      id={selectId}
                      value={member.room_id ?? ''}
                      disabled={busy}
                      onChange={(e) =>
                        void onSeat([{ user_id: member.user_id, room_id: e.target.value || null }])
                      }
                      className={inputCompact}
                    >
                      <option value="">{t('creator.rooms.noDefaultRoom')}</option>
                      {data.rooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {codeRefText(room.code, room.name)}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </section>
  )
}

function PlayerRow({
  player,
  rooms,
  checked,
  busy,
  onCheck,
  onSeat,
}: {
  player: RoomPlayerRead
  rooms: RoomRead[]
  checked: boolean
  busy: boolean
  onCheck: (on: boolean) => void
  onSeat: (roomId: string | null) => void
}) {
  const { t } = useTranslation()
  const selectId = `room-seat-${player.user_id}`
  return (
    <tr className={panelTr}>
      <td className={panelTd}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheck(e.target.checked)}
          aria-label={t('creator.rooms.selectPlayer', { name: player.full_name })}
          className="h-4 w-4 accent-accent-fg"
        />
      </td>
      <th scope="row" className={`${panelTd} text-left font-normal`}>
        <span className="block font-semibold text-paper-ink dark:text-fg">{player.full_name}</span>
        <span className="block text-sm text-paper-ink/70 dark:text-fg-muted">{player.email}</span>
      </th>
      <td className={panelTd}>
        <LastLogin value={player.last_login_at} />
      </td>
      <td className={panelTd}>
        <label htmlFor={selectId} className="sr-only">
          {t('creator.rooms.seatLabel', { name: player.full_name })}
        </label>
        <select
          id={selectId}
          value={player.room_id ?? ''}
          disabled={busy}
          onChange={(e) => onSeat(e.target.value || null)}
          className={inputCompact}
        >
          <option value="">{t('creator.rooms.noRoom')}</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {codeRefText(room.code, room.name)}
            </option>
          ))}
        </select>
      </td>
    </tr>
  )
}

function RoomDialog({
  room,
  onClose,
  onSave,
}: {
  room: RoomRead | null
  onClose: () => void
  onSave: (name: string, description: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [name, setName] = useState(room?.name ?? '')
  const [description, setDescription] = useState(room?.description ?? '')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    await onSave(name.trim(), description.trim())
    setBusy(false)
  }

  return (
    <Modal titleId="room-dialog-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h2 id="room-dialog-title" className="text-balance text-lg font-semibold tracking-tight">
          {room ? t('creator.rooms.editTitle', { name: room.name }) : t('creator.rooms.addTitle')}
        </h2>
        <div className="space-y-1.5">
          <label htmlFor="room-name" className="block text-sm font-medium">
            {t('creator.rooms.nameLabel')}
          </label>
          <input
            id="room-name"
            name="name"
            autoComplete="off"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('creator.rooms.namePlaceholder')}
            className={inputBase}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="room-description" className="block text-sm font-medium">
            {t('creator.rooms.descriptionLabel')}{' '}
            <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
          </label>
          <input
            id="room-description"
            name="description"
            autoComplete="off"
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('creator.rooms.descriptionPlaceholder')}
            className={inputBase}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={busy || !name.trim()} className={`flex-1 ${btnPrimary}`}>
            {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

function RemoveRoomDialog({
  room,
  busy,
  onClose,
  onRemove,
}: {
  room: RoomRead
  busy: boolean
  onClose: () => void
  onRemove: () => Promise<void>
}) {
  const { t } = useTranslation()
  return (
    <Modal titleId="room-remove-title" onClose={onClose}>
      <div className="w-full max-w-sm space-y-3">
        <h2
          id="room-remove-title"
          className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
        >
          {t('creator.rooms.removeTitle', { name: room.name })}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('creator.rooms.removeWarning', { count: room.player_count })}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onRemove()}
            className={`flex-1 ${btnDanger}`}
          >
            {busy ? <ButtonSpinner /> : t('creator.rooms.removeSubmit')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
