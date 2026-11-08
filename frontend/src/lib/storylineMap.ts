import {
  branchesFrom,
  branchForkTime,
  emptyInjectDraft,
  validRejoin,
  type ActionDraft,
  type InjectDraft,
  type MselDraft,
  type PhaseDraft,
} from './msel'

/** A mandatory inject on the storyline, at its T+. */
export interface StorylineStop {
  inject: InjectDraft
  time: number
}

/** A contingent inject that branches off the storyline: where it leaves
 * (the inject it hangs from, at `fromTime`, on `fromLane`), where it sits
 * (`time`, on its own `lane`) and where it comes back (`rejoin`, if the
 * storyline resumes at a later mandatory inject). */
export interface StorylineBranch {
  inject: InjectDraft
  from: InjectDraft
  /** The expected action of `from` whose absence fires it, if any. */
  action: ActionDraft | null
  fromTime: number
  /** 0 is the storyline itself; branches are 1, 2, ... */
  fromLane: number
  time: number
  lane: number
  rejoin: StorylineStop | null
}

export interface StorylineMap {
  duration: number
  stops: StorylineStop[]
  branches: StorylineBranch[]
  /** Contingent injects that hang from nothing on the map (not anchored, a
   * loop, or hanging from an inject that isn't there). */
  loose: InjectDraft[]
  lanes: number
}

/** Minutes after the fork a branch sits at when nothing says better. */
const DEFAULT_BRANCH_DELAY = 10

/** Lays the MSEL out as a storyline map: mandatory injects along T+, each
 * contingent inject on a lane of its own below, from the point it hangs
 * from to the point where the storyline resumes. A branch sits at its
 * check minute (`fires_at_minute` into its phase); otherwise at its
 * trigger action's deadline (`expected_within_minutes` after the fork);
 * otherwise halfway to where it comes back; otherwise a little after the
 * fork. Lanes are reused once a branch has come back, like a git graph. */
export function storylineMap(draft: MselDraft): StorylineMap {
  const duration = draft.duration_minutes ?? 0
  const clamp = (minutes: number) => Math.min(duration, Math.max(0, minutes))
  const byKey = new Map(draft.injects.map((inject) => [inject.key, inject]))

  const stops = draft.injects
    .filter((i) => i.kind === 'mandatory' && i.offset_minutes !== null)
    .map((inject) => ({ inject, time: clamp(inject.offset_minutes ?? 0) }))
    .sort((a, b) => a.time - b.time)
  const stopOf = new Map(stops.map((stop) => [stop.inject.key, stop]))

  // Where each contingent inject sits in time, following contingent
  // parents up to the storyline; null when it can't reach it.
  const placed = new Map<string, { time: number } | null>()
  function place(inject: InjectDraft, seen: Set<string>): { time: number } | null {
    if (placed.has(inject.key)) return placed.get(inject.key) ?? null
    if (seen.has(inject.key)) return null
    const parent = inject.branch_from_key ? byKey.get(inject.branch_from_key) : undefined
    let forkTime: number | null = null
    if (parent?.kind === 'mandatory') forkTime = stopOf.get(parent.key)?.time ?? null
    else if (parent) forkTime = place(parent, new Set([...seen, inject.key]))?.time ?? null
    if (forkTime === null) {
      placed.set(inject.key, null)
      return null
    }
    const action = parent?.expected_actions.find((a) => a.key === inject.branch_action_key)
    const rejoin = inject.rejoin_key ? stopOf.get(inject.rejoin_key) : undefined
    const phase = draft.phases.find((p) => p.key === inject.phase_key)
    const time =
      phase && inject.fires_at_minute !== null
        ? phase.start_offset + inject.fires_at_minute
        : action?.expected_within_minutes != null
          ? forkTime + action.expected_within_minutes
          : rejoin && rejoin.time > forkTime
            ? (forkTime + rejoin.time) / 2
            : forkTime + DEFAULT_BRANCH_DELAY
    const result = { time: clamp(time) }
    placed.set(inject.key, result)
    return result
  }

  const contingent = draft.injects.filter((i) => i.kind === 'contingent')
  const anchored = contingent
    .map((inject) => ({ inject, at: place(inject, new Set()) }))
    .filter((row): row is { inject: InjectDraft; at: { time: number } } => row.at !== null)
  const loose = contingent.filter((inject) => !placed.get(inject.key))

  // Parents before children, then by time: a branch's lane is known when
  // one hanging from it is laid out.
  const depth = (inject: InjectDraft): number => {
    const parent = inject.branch_from_key ? byKey.get(inject.branch_from_key) : undefined
    return parent?.kind === 'contingent' ? 1 + depth(parent) : 0
  }
  anchored.sort((a, b) => depth(a.inject) - depth(b.inject) || a.at.time - b.at.time)

  const laneEnds: number[] = [] // per lane (index 0 = lane 1), when it's free again
  const laneOf = new Map<string, number>()
  const branches: StorylineBranch[] = []
  for (const { inject, at } of anchored) {
    const from = byKey.get(inject.branch_from_key ?? '') as InjectDraft
    const fromLane = from.kind === 'mandatory' ? 0 : (laneOf.get(from.key) ?? 0)
    // Where it leaves from: the stop's time, or the parent branch's own.
    const parentTime =
      from.kind === 'mandatory'
        ? (stopOf.get(from.key)?.time ?? 0)
        : (placed.get(from.key)?.time ?? at.time)
    const rejoinStop = inject.rejoin_key ? (stopOf.get(inject.rejoin_key) ?? null) : null
    // A way back that isn't later than the branch is drawn as no way back
    // (the report flags it, M17).
    const rejoin = rejoinStop && rejoinStop.time >= at.time ? rejoinStop : null
    const busyUntil = rejoin?.time ?? at.time
    let lane = laneEnds.findIndex((end) => end < parentTime)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = busyUntil
    laneOf.set(inject.key, lane + 1)
    branches.push({
      inject,
      from,
      action: from.expected_actions.find((a) => a.key === inject.branch_action_key) ?? null,
      fromTime: parentTime,
      fromLane,
      time: at.time,
      lane: lane + 1,
      rejoin,
    })
  }

  return { duration, stops, branches, loose, lanes: laneEnds.length }
}

/** Minutes a click on the storyline snaps to. */
export const STOP_SNAP_MINUTES = 5

/** A new mandatory inject at `minutes` of the session (snapped, within the
 * session), in the phase that holds that time -- what clicking the
 * storyline creates. */
export function newStopAt(draft: MselDraft, minutes: number): InjectDraft {
  const duration = draft.duration_minutes ?? 0
  const time = Math.min(
    duration,
    Math.max(0, Math.round(minutes / STOP_SNAP_MINUTES) * STOP_SNAP_MINUTES),
  )
  const phase =
    draft.phases.find((p) => p.start_offset <= time && time < p.end_offset) ??
    draft.phases.find((p) => p.start_offset <= time && time <= p.end_offset)
  return emptyInjectDraft(draft, {
    kind: 'mandatory',
    offset_minutes: time,
    ...(phase ? { phase_key: phase.key } : {}),
  })
}

/** A drag on the storyline the map can't honour: a branch dropped on a
 * line of another phase, or moved in time with no trigger action to time
 * it by. */
export type MoveRefusal = 'otherPhase' | 'noTriggerAction'

export type MoveResult = { draft: MselDraft; refused: null } | { draft: null; refused: MoveRefusal }

const snapToSession = (draft: MselDraft, minutes: number) =>
  Math.min(
    draft.duration_minutes ?? 0,
    Math.max(0, Math.round(minutes / STOP_SNAP_MINUTES) * STOP_SNAP_MINUTES),
  )

/** A mandatory inject dragged along the storyline: its new time (snapped,
 * within the session) and the phase that holds it, if any. */
export function moveStop(draft: MselDraft, key: string, minutes: number): MselDraft {
  const time = snapToSession(draft, minutes)
  const phase =
    draft.phases.find((p) => p.start_offset <= time && time < p.end_offset) ??
    draft.phases.find((p) => p.start_offset <= time && time <= p.end_offset)
  return {
    ...draft,
    injects: draft.injects.map((inject) =>
      inject.key === key
        ? { ...inject, offset_minutes: time, ...(phase ? { phase_key: phase.key } : {}) }
        : inject,
    ),
  }
}

/** A contingent inject dragged on the map, dropped at `minutes` on line
 * `lane` (0 the storyline, n a branch's lane). On another line it branches
 * off that line's latest mark at or before the drop -- only one of its own
 * phase (else refused), never one hanging from it -- losing a trigger
 * action that belonged to the old branch point. In time, it moves its
 * check minute when it has one (kept inside its phase), else its trigger
 * action's window ("expected within") to the drop; with neither it can't
 * be timed (refused, unless it changed line). A way back
 * that no longer comes later is cleared. */
export function moveBranch(
  draft: MselDraft,
  key: string,
  minutes: number,
  lane: number,
): MoveResult {
  const inject = draft.injects.find((i) => i.key === key)
  if (!inject) return { draft: null, refused: 'otherPhase' }
  const map = storylineMap(draft)
  const time = snapToSession(draft, minutes)
  const marks =
    lane === 0
      ? map.stops.map((stop) => ({ inject: stop.inject, time: stop.time }))
      : map.branches.filter((b) => b.lane === lane).map((b) => ({ inject: b.inject, time: b.time }))
  const target = marks
    .filter(
      (mark) =>
        mark.time <= time && mark.inject.key !== key && !branchesFrom(draft, mark.inject, inject),
    )
    .sort((a, b) => b.time - a.time)[0]?.inject

  let next = inject
  let moved = false
  if (target && target.key !== inject.branch_from_key) {
    if (target.phase_key !== inject.phase_key) return { draft: null, refused: 'otherPhase' }
    next = { ...next, branch_from_key: target.key, branch_action_key: null }
    moved = true
  }
  let injects = draft.injects.map((i) => (i.key === key ? next : i))

  // Its time is its check minute; else its trigger action's window, on the
  // inject it branches off.
  const parent = injects.find((i) => i.key === next.branch_from_key)
  const action = parent?.expected_actions.find((a) => a.key === next.branch_action_key)
  const phase = draft.phases.find((p) => p.key === next.phase_key)
  if (phase && next.fires_at_minute !== null) {
    const length = phase.end_offset - phase.start_offset
    const minute = Math.min(length, Math.max(0, time - phase.start_offset))
    injects = injects.map((i) => (i.key === key ? { ...i, fires_at_minute: minute } : i))
  } else if (parent && action) {
    const fork = branchForkTime({ injects }, next) ?? 0
    const within = Math.max(1, time - fork)
    injects = injects.map((i) =>
      i.key === parent.key
        ? {
            ...i,
            expected_actions: i.expected_actions.map((a) =>
              a.key === action.key ? { ...a, expected_within_minutes: within } : a,
            ),
          }
        : i,
    )
  } else if (!moved) {
    return { draft: null, refused: 'noTriggerAction' }
  }

  const back = injects.find((i) => i.key === next.rejoin_key)
  if (back && !validRejoin({ injects }, next, back)) {
    injects = injects.map((i) => (i.key === key ? { ...i, rejoin_key: null } : i))
  }
  return { draft: { ...draft, injects }, refused: null }
}

/** A new contingent inject branching off `parent`: in its phase, about its
 * objectives, coming back at the next mandatory inject after the point it
 * leaves from (the user picks the trigger action). */
export function newBranchFrom(draft: MselDraft, parent: InjectDraft): InjectDraft {
  const map = storylineMap(draft)
  const forkTime =
    parent.kind === 'mandatory'
      ? (parent.offset_minutes ?? 0)
      : (map.branches.find((b) => b.inject.key === parent.key)?.time ?? null)
  const rejoin = forkTime === null ? null : (map.stops.find((stop) => stop.time > forkTime) ?? null)
  return emptyInjectDraft(draft, {
    kind: 'contingent',
    phase_key: parent.phase_key,
    objective_ids: [...parent.objective_ids],
    branch_from_key: parent.key,
    rejoin_key: rejoin?.inject.key ?? null,
  })
}

/** The stretches of the session no phase holds (before the first, between
 * two, after the last), in order -- the map draws them as "No phase". */
export function uncoveredSpans(
  phases: Pick<PhaseDraft, 'start_offset' | 'end_offset'>[],
  duration: number,
): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = []
  let reached = 0
  for (const phase of [...phases].sort((a, b) => a.start_offset - b.start_offset)) {
    const start = Math.min(phase.start_offset, duration)
    if (start > reached) spans.push({ start: reached, end: start })
    reached = Math.max(reached, Math.min(phase.end_offset, duration))
  }
  if (duration > reached) spans.push({ start: reached, end: duration })
  return spans
}

/** The storyline cut where the exercise has and hasn't run through it, in
 * order and covering the whole session: past `now`, and where a delivered
 * branch took the play off the storyline -- from its fork to its rejoin,
 * when no mandatory inject between them was delivered too (then the
 * storyline ran alongside it). `delivered` says whether an inject went
 * out. */
export function storylineRuns(
  map: Pick<StorylineMap, 'duration' | 'stops' | 'branches'>,
  delivered: (inject: InjectDraft) => boolean,
  now: number,
): { start: number; end: number; run: boolean }[] {
  const off: { start: number; end: number }[] = [{ start: Math.max(0, now), end: map.duration }]
  for (const branch of map.branches) {
    if (!branch.rejoin || !delivered(branch.inject)) continue
    const start = branch.fromTime
    const end = Math.min(branch.rejoin.time, now)
    const alongside = map.stops.some(
      (stop) => stop.time > start && stop.time < branch.rejoin!.time && delivered(stop.inject),
    )
    if (!alongside && end > start) off.push({ start, end })
  }
  off.sort((a, b) => a.start - b.start)
  const parts: { start: number; end: number; run: boolean }[] = []
  let reached = 0
  for (const span of off) {
    const start = Math.max(span.start, reached)
    const end = Math.min(span.end, map.duration)
    if (end <= start) continue
    if (start > reached) parts.push({ start: reached, end: start, run: true })
    parts.push({ start, end, run: false })
    reached = end
  }
  if (map.duration > reached) parts.push({ start: reached, end: map.duration, run: true })
  // Neighbours of the same kind as one part.
  return parts.reduce<typeof parts>((merged, part) => {
    const last = merged[merged.length - 1]
    if (last && last.run === part.run && last.end === part.start) last.end = part.end
    else merged.push({ ...part })
    return merged
  }, [])
}

export interface AxisTick {
  minutes: number
  /** The session's start or end, a mandatory inject's time, a contingent
   * inject's, where a phase opens, or a filler where the storyline would
   * otherwise go long without a time. */
  kind: 'edge' | 'stop' | 'branch' | 'phase' | 'fill'
}

/** Where the storyline map's axis says the time, in order of priority: the
 * start and the end of the session, under each mandatory inject (`stops`,
 * in session minutes), under each contingent inject (`branches`), where
 * each phase opens (`phases`, labelled from there rightwards) and -- where two of those are further apart
 * than `fillGap` (a fraction of the session) -- evenly between them, on
 * 5-minute marks. A label closer than `minGap` to one already placed is
 * left out (the higher priority wins, then the earlier time), so labels
 * never overlap. */
export function axisTicks(
  duration: number,
  stops: number[],
  {
    minGap,
    fillGap,
    branches = [],
    phases = [],
  }: { minGap: number; fillGap: number; branches?: number[]; phases?: number[] },
): AxisTick[] {
  if (duration <= 0) return []
  const min = minGap * duration
  const ticks: AxisTick[] = [
    { minutes: 0, kind: 'edge' },
    { minutes: duration, kind: 'edge' },
  ]
  // Where each label's middle is: a phase's start is labelled from where
  // the phase opens rightwards (aligned with its box), so its middle sits
  // half a label further on; every other label is centred on its time.
  const middle = (tick: AxisTick) => tick.minutes + (tick.kind === 'phase' ? min / 2 : 0)
  const clear = (minutes: number, kind: AxisTick['kind'] = 'fill') =>
    ticks.every((tick) => Math.abs(middle(tick) - middle({ minutes, kind })) >= min)
  const groups: [AxisTick['kind'], number[]][] = [
    ['stop', stops],
    ['branch', branches],
    ['phase', phases],
  ]
  for (const [kind, times] of groups) {
    for (const minutes of [...new Set(times.map(Math.round))].sort((a, b) => a - b)) {
      if (minutes > 0 && minutes < duration && clear(minutes, kind)) ticks.push({ minutes, kind })
    }
  }
  const placed = [...ticks].sort((a, b) => a.minutes - b.minutes)
  for (let i = 0; i < placed.length - 1; i += 1) {
    const from = placed[i].minutes
    const gap = placed[i + 1].minutes - from
    const parts = Math.ceil(gap / (fillGap * duration))
    for (let part = 1; part < parts; part += 1) {
      const minutes = Math.round((from + (gap * part) / parts) / 5) * 5
      if (clear(minutes)) ticks.push({ minutes, kind: 'fill' })
    }
  }
  return ticks.sort((a, b) => a.minutes - b.minutes)
}
