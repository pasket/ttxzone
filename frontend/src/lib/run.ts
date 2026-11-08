import { clockAt } from './msel'
import type { RunControlInject, RunInject, RunQuestionPlace, RunRead, RunRooms } from './types'

/** Where the fiction stands: day and wall-clock time of the scenario at
 * the current inject (the incident start before any) -- "Day 2 · 13:25"
 * is { day: 2, time: '13:25' } -- and, when the scene has a date, that
 * day's date ("YYYY-MM-DD"). Null without an incident start. */
export function scenarioClock(
  run: RunRead,
): { day: number; time: string; date: string | null } | null {
  if (!run.incident_start) return null
  const current = run.injects[run.injects.length - 1]
  const minutes = current?.scenario_minute ?? 0
  const [hours, mins] = run.incident_start.split(':').map(Number)
  const total = hours * 60 + mins + minutes
  const day = Math.floor(total / 1440) + 1
  let date: string | null = null
  if (run.incident_date) {
    const at = new Date(`${run.incident_date}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() + day - 1)
    date = at.toISOString().slice(0, 10)
  }
  return { day, time: clockAt(run.incident_start.slice(0, 5), minutes), date }
}

/** Whole minutes of session since it started, up to `now` (its end, or
 * the pause it's in), leaving the pauses out. */
export function sessionElapsed(run: RunRead, now: number): number | null {
  if (!run.started_at) return null
  const end = run.ended_at
    ? Date.parse(run.ended_at)
    : run.paused_at
      ? Date.parse(run.paused_at)
      : now
  const ms = end - Date.parse(run.started_at) - run.paused_seconds * 1000
  return Math.max(0, Math.floor(ms / 60000))
}

/** Whole seconds since the last inject was released (or the Controller
 * reset the count), up to `now` (its end, or the pause it's in), leaving
 * pauses out like T+. Null before any inject. */
export function injectElapsedSeconds(run: RunRead, now: number): number | null {
  if (!run.inject_timer_at) return null
  const end = run.ended_at
    ? Date.parse(run.ended_at)
    : run.paused_at
      ? Date.parse(run.paused_at)
      : now
  const paused = run.paused_seconds - (run.inject_timer_paused_seconds ?? 0)
  const ms = end - Date.parse(run.inject_timer_at) - paused * 1000
  return Math.max(0, Math.floor(ms / 1000))
}

/** "04:07" for 247 seconds; "1:02:05" past an hour. */
export function formatStopwatch(seconds: number): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const hours = Math.floor(seconds / 3600)
  const rest = `${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`
  return hours ? `${hours}:${rest}` : rest
}

/** Where the exercise stands on its schedule, in session minutes: `point`
 * is the due minute of the latest delivered inject that has one (0 before
 * any), `clock` the session's elapsed time, and `drift` how far the clock
 * is past the next pending mandatory inject (positive: behind) or behind
 * the point (negative: ahead); 0 on time. Null before the start. */
export function storylineProgress(
  run: RunRead,
  injects: RunControlInject[],
  now: number,
): { point: number; clock: number; drift: number } | null {
  const clock = sessionElapsed(run, now)
  if (clock === null) return null
  const due = (inject: RunControlInject) => inject.due_minute ?? inject.offset_minutes
  const byCode = new Map(injects.map((inject) => [inject.code, inject]))
  let point = 0
  for (const delivered of [...run.injects].reverse()) {
    const at = byCode.get(delivered.code)
    if (at && due(at) !== null) {
      point = due(at) as number
      break
    }
  }
  const next = injects
    .filter((inject) => inject.state === 'pending' && inject.kind === 'mandatory')
    .map(due)
    .filter((minute): minute is number => minute !== null && minute > point)
  const nextAt = next.length ? Math.min(...next) : null
  const drift =
    nextAt !== null && clock > nextAt ? clock - nextAt : point > clock ? clock - point : 0
  return { point, clock, drift }
}

/** Rooms: the delivered injects played in a room (aimed at it, or at all
 * rooms), oldest first. */
export function roomInjects(injects: RunInject[], roomCode: string): RunInject[] {
  return injects.filter((i) => !i.room_codes?.length || i.room_codes.includes(roomCode))
}

/** A place's injects: a room's, the main room's, or all without rooms. */
export function injectsAt(run: RunRead, where: string | null): RunInject[] {
  if (!run.rooms || where === null) return run.injects
  return where === 'main' ? mainInjects(run.injects, run.rooms) : roomInjects(run.injects, where)
}

/** The inject in play in a place: the latest there; in the main room, the
 * one on its screen. */
export function inPlayAt(run: RunRead, where: string | null): RunInject | undefined {
  const injects = injectsAt(run, where)
  const projected = where === 'main' ? run.rooms?.main_projected : null
  return injects.find((i) => i.code === projected) ?? injects[injects.length - 1]
}

/** Injects with the key questions put in one place only: in rooms each
 * asks its own. */
export function questionsOf(injects: RunInject[], where: string | null): RunInject[] {
  if (where === null) return injects
  return injects.map((inject) => ({
    ...inject,
    questions: inject.questions.filter((q) => !q.room_code || q.room_code === where),
  }))
}

/** Which of a phase's key questions were asked and covered in a place. */
export function phaseQuestions(
  phase: {
    released_questions: number[]
    covered_questions: number[]
    question_places?: RunQuestionPlace[]
  },
  where: string | null,
): { asked: Set<number>; covered: Set<number> } {
  const place = where === null ? phase : phase.question_places?.find((p) => p.room_code === where)
  return {
    asked: new Set(place?.released_questions ?? []),
    covered: new Set(place?.covered_questions ?? []),
  }
}

/** The Controller's closing message, delivered as the last inject. */
export const ENDEX_CODE = 'ENDEX'

/** Rooms: the injects the main room has had on its screen, in the order
 * they were first projected, then ENDEX once it's out (it reaches every
 * room). */
export function mainInjects(injects: RunInject[], rooms: RunRooms): RunInject[] {
  const byCode = new Map(injects.map((i) => [i.code, i]))
  const endex = byCode.get(ENDEX_CODE)
  return [
    ...rooms.main_history.flatMap((code) => byCode.get(code) ?? []),
    ...(endex ? [endex] : []),
  ]
}

const dueOf = (inject: RunControlInject) =>
  inject.due_minute ?? inject.offset_minutes ?? Number.MAX_SAFE_INTEGER

/** A row of the Controller's Next band: `lane` 0 is the storyline, 1..n
 * a branch shown in the window. A branch carries the inject it hangs from
 * and where the storyline resumes (a later inject, else null). */
export interface SequenceNext {
  inject: RunControlInject
  parallel: boolean
  lane: number
  from: string | null
  rejoin: string | null
}

/** Rows in the Next band; open branches always show, the storyline fills
 * the rest with at least two (the next one and one to jump to). */
const NEXT_ROWS = 3
const MIN_STORYLINE = 2

/** The Controller's window on the sequence: the inject delivered before
 * the one in play (`previous`, to step back to), the one in play
 * (`inPlay`, the latest delivered -- a re-sent one is the latest again),
 * and what can go out `next`, in T+ order as the storyline map lays it
 * out: the open branches -- pending contingents hanging from the one in
 * play, and every one suggested by a missed action -- and the pending
 * mandatory injects due from the one in play on. Mandatory ones jumped
 * over stay pending, out of the window (the MSEL list still has them).
 * `parallel`: due the same minute as another one shown. */
export function controlSequence(
  run: RunRead,
  control: NonNullable<RunRead['control']>,
): {
  previous: RunInject | null
  inPlay: RunInject | null
  next: SequenceNext[]
} {
  const { injects } = control
  const inPlay = run.injects[run.injects.length - 1] ?? null
  const previous = run.injects[run.injects.length - 2] ?? null
  const playing = inPlay && injects.find((inject) => inject.code === inPlay.code)
  const from = playing && dueOf(playing) !== Number.MAX_SAFE_INTEGER ? dueOf(playing) : null
  const pending = injects
    .filter((inject) => inject.state === 'pending')
    .sort((a, b) => dueOf(a) - dueOf(b))

  // Where each contingent sits on the map: its fork and its way back.
  const mselInjects = control.msel?.injects ?? []
  const codeOf = new Map(mselInjects.map((inject) => [inject.id, inject.code]))
  const branchOf = new Map(
    mselInjects
      .filter((inject) => inject.kind === 'contingent')
      .map((inject) => [
        inject.code,
        {
          from: (inject.branch_from_id && codeOf.get(inject.branch_from_id)) || null,
          rejoin: (inject.rejoin_inject_id && codeOf.get(inject.rejoin_inject_id)) || null,
        },
      ]),
  )
  const branches = pending.filter(
    (inject) =>
      inject.kind === 'contingent' &&
      (inject.suggested || (inPlay !== null && branchOf.get(inject.code)?.from === inPlay.code)),
  )
  const storyline = pending
    .filter(
      (inject) =>
        inject.kind === 'mandatory' &&
        !inject.suggested &&
        (from === null || dueOf(inject) >= from),
    )
    .slice(0, Math.max(MIN_STORYLINE, NEXT_ROWS - branches.length))
  const shown = [...branches, ...storyline].sort((a, b) => dueOf(a) - dueOf(b))
  const next = shown.map((inject) => {
    const branch = inject.kind === 'contingent' ? branchOf.get(inject.code) : undefined
    const back = branch?.rejoin ? injects.find((other) => other.code === branch.rejoin) : undefined
    return {
      inject,
      parallel:
        dueOf(inject) !== Number.MAX_SAFE_INTEGER &&
        shown.some((other) => other !== inject && dueOf(other) === dueOf(inject)),
      lane: inject.kind === 'contingent' ? branches.indexOf(inject) + 1 : 0,
      from: branch?.from ?? null,
      // A way back that isn't later than the branch is no way back (M17).
      rejoin: back && dueOf(back) > dueOf(inject) ? back.code : null,
    }
  })
  return { previous, inPlay, next }
}

/** The pending mandatory injects a release of `inject` goes ahead of:
 * due before it. They stay pending. */
export function jumpedOver(
  injects: RunControlInject[],
  inject: RunControlInject,
): RunControlInject[] {
  return injects
    .filter(
      (other) =>
        other.state === 'pending' && other.kind === 'mandatory' && dueOf(other) < dueOf(inject),
    )
    .sort((a, b) => dueOf(a) - dueOf(b))
}

/** The injects on the stage, oldest first: every delivered one without
 * rooms; in rooms, the place in view (`where`: a room's code or `main`). */
export function stageInjects(run: RunRead, where: string | null): RunInject[] {
  if (!run.rooms || where === null) return run.injects
  return where === 'main' ? mainInjects(run.injects, run.rooms) : roomInjects(run.injects, where)
}

/** Each inject's place in the story as the viewer lives it (#1, #2, ...),
 * in release order: a Player numbers only what reaches them -- their room's
 * injects and the main room's screen -- so they never see a gap, and an
 * inject keeps its number wherever it shows. A re-sent inject is the latest
 * again. */
export function injectSequence(run: RunRead): Map<string, number> {
  const rooms = run.rooms
  const own = rooms?.me?.room_code ?? null
  const seen = rooms?.me
    ? run.injects.filter(
        (i) =>
          i.code === ENDEX_CODE ||
          rooms.main_history.includes(i.code) ||
          (own !== null && roomInjects([i], own).length > 0),
      )
    : run.injects
  return new Map(seen.map((inject, index) => [inject.code, index + 1]))
}
