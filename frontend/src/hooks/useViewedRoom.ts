import { useSearchParams } from 'react-router-dom'

import type { RunRooms } from '../lib/types'

/** The room the team is looking at in a session played in rooms (`?room=`:
 * a room's code or `main`; by default the team member's own room, set in
 * Creator -> Exercise -> Rooms, else the first room), and how to change it.
 * A Player has no choice: the Controller decides where they are. */
export function useViewedRoom(rooms: RunRooms | null | undefined) {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('room')
  const codes = rooms?.rooms.map((r) => r.code) ?? []
  const viewed =
    requested === 'main' || (requested && codes.includes(requested))
      ? requested
      : rooms?.default_room_code && codes.includes(rooms.default_room_code)
        ? rooms.default_room_code
        : (codes[0] ?? 'main')
  function view(next: string) {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev)
        params.set('room', next)
        return params
      },
      { replace: true },
    )
  }
  return { viewed, view }
}

/** Where the stage is: a Player's own location (their room, or `main`
 * once brought there or without a seat), else the room picked; null
 * without rooms. */
export function useStageRoom(rooms: RunRooms | null | undefined): string | null {
  const { viewed } = useViewedRoom(rooms)
  if (!rooms) return null
  if (rooms.me) return rooms.me.location === 'main' ? 'main' : (rooms.me.room_code ?? 'main')
  return viewed
}
