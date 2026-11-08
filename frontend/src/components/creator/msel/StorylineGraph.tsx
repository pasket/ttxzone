import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'

import { floatingSurface } from '../../../lib/buttonStyles'
import { codeRefText } from '../../../lib/codeRef'
import { useDisclosureMenu } from '../../../hooks/useDisclosureMenu'
import { useElementWidth } from '../../../hooks/useElementWidth'
import type { InjectDraft, PhaseDraft } from '../../../lib/msel'
import {
  clockAt,
  formatClock,
  formatIncident,
  formatOffset,
  formatOffsetAt,
  formatSpan,
} from '../../../lib/msel'
import {
  axisTicks,
  STOP_SNAP_MINUTES,
  storylineRuns,
  uncoveredSpans,
  type StorylineBranch,
  type StorylineMap,
} from '../../../lib/storylineMap'

/** SVG user units across the session (stretched to the width). */
const WIDTH = 1000
/** Width of one character of the axis' 10px monospace labels. */
const AXIS_CHAR_PX = 6.2
/** Each phase is a box of its own: the panel shows through a thin seam
 * between two consecutive phases (just enough that their hairline borders
 * don't touch), and through a wider gap (not to scale)
 * where the scenario lapses as a phase opens with a time jump. */
const SEAM_PX = 2
const LAPSE_PX = 16
/** A line the exercise hasn't run through: its colour mixed into the
 * panel -- paler but solid, never transparent (it would read as sitting
 * behind the phase boxes) -- and dotted; a branch with no way back keeps
 * its dash between the dots. */
const FADED_STROKE = {
  accent: 'stroke-[color-mix(in_srgb,var(--color-accent)_40%,var(--color-panel))]',
  branch: 'stroke-[color-mix(in_srgb,var(--color-chart-2)_40%,var(--color-panel))]',
  dots: '1 3',
  dashDots: '4 3 1 3',
}
/** How far a branch's departure and rejoin slant sideways. */
const BRANCH_SLANT_PX = 10

/** Room above the storyline (phase names, then the stops' labels, tilted
 * 20° up from the mark), the height of each lane (its branch's label sits
 * just above the lane's line, never on it), and how much of a branch's
 * title its label shows (after the code): the strip, and the strip
 * maximized. */
const SIZES = {
  normal: { top: 49, lane: 26, titleChars: 8, text: 'text-[10px]', fillGap: 0.3 },
  // Maximized: a much taller drawing (room above the storyline and each
  // lane), so branches and labels breathe.
  large: { top: 141, lane: 87, titleChars: 30, text: 'text-xs', fillGap: 0.2 },
} as const

/** What a press on the map may drag: an inject's mark, or (Phases tab) a
 * phase box -- whole, or one of its edges. */
type DragTarget =
  | { type: 'inject'; inject: InjectDraft; kind: 'stop' | 'branch' }
  | { type: 'phase'; phase: PhaseDraft; mode: 'move' | 'start' | 'end' }

/** The Phases tab's handles on the map's phase boxes. */
export interface PhaseEditing {
  onEdit: (phase: PhaseDraft) => void
  onDelete: (phase: PhaseDraft) => void
  /** Why a phase can't be deleted (it has injects), or null. */
  deleteBlockedBy: (phase: PhaseDraft) => string | null
  onResize: (phase: PhaseDraft, edge: 'start' | 'end', minutes: number) => void
  onMoveBox: (phase: PhaseDraft, start: number) => void
  onCreate: (start: number, end: number) => void
}

/** "Second wor…": the first characters of a title, marked when cut. */
function shortTitle(title: string, chars: number): string {
  const trimmed = title.trim()
  return trimmed.length > chars ? `${trimmed.slice(0, chars).trimEnd()}…` : trimmed
}

/** One action of a mark's menu (open, branch off). */
export interface MarkAction {
  label: string
  onSelect: () => void
  /** Why it can't be done now (the item is then disabled and says so). */
  blockedBy?: string | null
}

const menuItemClass =
  'block w-full rounded-xs px-3 py-2 text-left text-sm hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg'

/** A mark that opens a small menu instead of acting at once: a <details>
 * disclosure (one tab stop, Escape and click-outside via
 * useDisclosureMenu), like the library's Duplicate menu. Raised while
 * open, so neighbouring labels don't cover the menu. */
function MarkMenu({
  label,
  className,
  style,
  summaryClassName,
  actions,
  drag,
  dimmed = false,
  children,
}: {
  label: string
  className: string
  style: CSSProperties
  summaryClassName: string
  actions: MarkAction[]
  /** Pointer handlers that let the mark be dragged (a click still opens
   * the menu). */
  drag?: HTMLAttributes<HTMLElement>
  /** Left out by a filter, or not delivered yet: drawn faded. */
  dimmed?: boolean
  children?: ReactNode
}) {
  const ref = useDisclosureMenu()
  return (
    <details
      ref={ref}
      className={`open:z-30 ${className}`}
      style={style}
      data-dimmed={dimmed ? 'true' : undefined}
    >
      <summary
        aria-label={label}
        title={label}
        className={`list-none [&::-webkit-details-marker]:hidden ${summaryClassName}`}
        {...drag}
      >
        {children}
      </summary>
      <ul className={`absolute left-0 top-full z-30 mt-2 w-60 space-y-0.5 p-1 ${floatingSurface}`}>
        {actions.map((action) => (
          <li key={action.label}>
            <button
              type="button"
              className={`${menuItemClass} disabled:cursor-not-allowed disabled:opacity-50`}
              disabled={Boolean(action.blockedBy)}
              title={action.blockedBy ?? undefined}
              onClick={action.onSelect}
            >
              {action.label}
              {action.blockedBy && (
                <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
                  {action.blockedBy}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}

/** The storyline map drawing (the strip above the MSEL tabs): phase
 * bands, the storyline -- mandatory injects at their T+, their codes above
 * -- and each contingent inject on a lane below with its code and title,
 * from the inject it hangs from to where the storyline resumes, like a git
 * graph. Each mark opens a menu of `markActions` (open it, branch off it);
 * with `onAddAt`, pointing at the storyline shows where a mandatory inject
 * would go and clicking adds it there. `highlight` dims every inject not
 * in it (the Injects tab's filters); `emphasizePhases` brings the phase
 * bands forward (the Phases tab). `now` draws where a running session
 * stands (the control center); with `fadeUntraversed` the lines the
 * exercise hasn't run through are drawn paler. */
export function StorylineGraph({
  map,
  phases,
  markActions,
  onAddAt,
  onMove,
  phaseEditing,
  highlight = null,
  emphasizePhases = false,
  size = 'normal',
  startTime = '',
  incidentAt = (minutes) => minutes,
  incidentStart = '',
  showSession = false,
  now = null,
  clock = null,
  finished = false,
  fadeUntraversed = false,
}: {
  map: StorylineMap
  phases: PhaseDraft[]
  markActions: (inject: InjectDraft) => MarkAction[]
  onAddAt?: (minutes: number) => void
  /** Dragging a mark: where it was dropped (session minutes, and the line --
   * 0 the storyline, n a branch's lane). Without it, marks don't drag. */
  onMove?: (inject: InjectDraft, minutes: number, lane: number) => void
  /** The Phases tab only: phase boxes can be opened (edit, delete), moved
   * whole, stretched by their edges, and created on free session time. */
  phaseEditing?: PhaseEditing
  highlight?: Set<string> | null
  emphasizePhases?: boolean
  size?: keyof typeof SIZES
  /** The meeting's start ("HH:MM", "" if not set), shown with T+ when
   * `showSession`. */
  startTime?: string
  /** Incident time elapsed at a session minute (compression plus phase
   * time jumps): what the axis and the marks read in. */
  incidentAt?: (minutes: number) => number
  /** When the incident starts inside the fiction ("HH:MM", "" if not
   * set): the axis then reads the scene's clock ("Day 2 · 14:00"). */
  incidentStart?: string
  /** Also show session time (T+ and the meeting's clock) -- for running
   * the session; injects are scheduled in it. */
  showSession?: boolean
  /** A session minute to mark with a "now" line, while one runs: where the
   * exercise stands. */
  now?: number | null
  /** The session's clock, a fainter dashed line (drawn where it differs
   * from `now`). */
  clock?: number | null
  /** ENDEX is out: it closes the storyline as its last inject would, so
   * the "now" line reaches the end in the success colour and the storyline
   * up to there counts as run through (undelivered branches stay faded). */
  finished?: boolean
  /** The control center: what the exercise hasn't run through is drawn
   * paler (still solid) and dotted -- the storyline past `now` (all of it
   * before the first inject goes out) and where a delivered branch took
   * the play off it (`storylineRuns`), and the branch of every dimmed
   * inject (not delivered). */
  fadeUntraversed?: boolean
}) {
  const { t, i18n } = useTranslation()
  const { top: TOP, lane: LANE, titleChars, text, fillGap } = SIZES[size]
  const [axisRef, axisWidth] = useElementWidth<HTMLDivElement>()
  // Where a click on the storyline would add a mandatory inject (pointer only).
  const [addAt, setAddAt] = useState<number | null>(null)
  // A mark being dragged: where it would land, while the pointer moves. A
  // press only becomes a drag past a few pixels, so a click still opens the
  // mark's menu; the click that ends a drag is swallowed.
  const drawingRef = useRef<HTMLDivElement>(null)
  const pressRef = useRef<{
    target: DragTarget
    x: number
    y: number
    /** Session minutes under the pointer when pressed (moving a box keeps
     * the grab point). */
    minutes: number
    active: boolean
  } | null>(null)
  const justDraggedRef = useRef(false)
  const [drag, setDrag] = useState<{
    target: DragTarget
    minutes: number
    lane: number
    /** A phase box being moved: its start, where the pointer is. */
    shift: number
  } | null>(null)
  // Escape drops the drag where it started.
  useEffect(() => {
    if (!drag) return
    const cancel = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      pressRef.current = null
      justDraggedRef.current = true
      setDrag(null)
    }
    window.addEventListener('keydown', cancel, true)
    return () => window.removeEventListener('keydown', cancel, true)
  }, [drag])
  const pending = t('creator.msel.table.pendingCode')
  const code = (inject: InjectDraft) => inject.code || pending
  const pct = (minutes: number) => `${(Math.min(minutes, map.duration) / map.duration) * 100}%`
  const x = (minutes: number) => (minutes / map.duration) * WIDTH
  const laneY = (lane: number) => TOP + LANE / 2 + lane * LANE
  const height = TOP + (map.lanes + 1) * LANE + 3
  // Where the pointer is on the drawing: session minutes (snapped) and line.
  const dropAt = (event: ReactPointerEvent) => {
    const box = drawingRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return { minutes: 0, lane: 0 }
    const raw = ((event.clientX - box.left) / box.width) * map.duration
    const minutes = Math.min(
      map.duration,
      Math.max(0, Math.round(raw / STOP_SNAP_MINUTES) * STOP_SNAP_MINUTES),
    )
    const lane = Math.round((event.clientY - box.top - (TOP + LANE / 2)) / LANE)
    return { minutes, lane: Math.min(map.lanes, Math.max(0, lane)) }
  }
  // A press becomes a drag past 4 px; the drop is reported to the owner of
  // what was dragged (an inject mark, a phase box or one of its edges).
  const enabled = (target: DragTarget) =>
    target.type === 'inject' ? Boolean(onMove) : Boolean(phaseEditing)
  const dragProps = (target: DragTarget) =>
    enabled(target)
      ? {
          onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
            if (event.button !== 0) return
            event.stopPropagation()
            event.currentTarget.setPointerCapture?.(event.pointerId)
            pressRef.current = {
              target,
              x: event.clientX,
              y: event.clientY,
              minutes: dropAt(event).minutes,
              active: false,
            }
          },
          onPointerMove: (event: ReactPointerEvent<HTMLElement>) => {
            const press = pressRef.current
            if (!press) return
            if (!press.active && Math.hypot(event.clientX - press.x, event.clientY - press.y) < 4)
              return
            press.active = true
            const at = dropAt(event)
            setDrag({ target, ...at, shift: at.minutes - press.minutes })
          },
          onPointerUp: (event: ReactPointerEvent<HTMLElement>) => {
            const press = pressRef.current
            pressRef.current = null
            if (!press?.active) return
            justDraggedRef.current = true
            const { minutes, lane } = dropAt(event)
            setDrag(null)
            if (target.type === 'inject') {
              onMove?.(target.inject, minutes, target.kind === 'stop' ? 0 : lane)
            } else if (target.mode === 'move') {
              phaseEditing?.onMoveBox(
                target.phase,
                target.phase.start_offset + minutes - press.minutes,
              )
            } else {
              phaseEditing?.onResize(target.phase, target.mode, minutes)
            }
          },
          onPointerCancel: () => {
            pressRef.current = null
            setDrag(null)
          },
          onClickCapture: (event: React.MouseEvent) => {
            if (!justDraggedRef.current) return
            justDraggedRef.current = false
            event.preventDefault()
            event.stopPropagation()
          },
          style: { touchAction: 'none' as const },
        }
      : undefined
  // Incident first (scene clock, elapsed); session time below, if shown.
  const axisLines = (incidentStart ? 2 : 1) + (showSession ? (startTime ? 2 : 1) : 0)
  // Session minutes where a phase opens with a time jump (a lapse).
  const jumpsAt = new Set(
    phases
      .filter((phase) => phase.start_offset > 0 && phase.incident_jump_minutes > 0)
      .map((phase) => phase.start_offset),
  )
  // Where two phases share session time (in session order: each phase
  // against the one before it reaching furthest).
  const phaseOverlaps: {
    first: string
    second: string
    start: number
    end: number
    label: string
  }[] = []
  let reaching: PhaseDraft | null = null
  for (const phase of [...phases].sort(
    (a, b) => a.start_offset - b.start_offset || a.end_offset - b.end_offset,
  )) {
    if (reaching && phase.start_offset < reaching.end_offset) {
      const end = Math.min(reaching.end_offset, phase.end_offset)
      phaseOverlaps.push({
        first: reaching.key,
        second: phase.key,
        start: phase.start_offset,
        end,
        label: t('creator.msel.map.overlap', {
          first: codeRefText(reaching.code, reaching.name, pending),
          second: codeRefText(phase.code, phase.name, pending),
          from: formatOffset(phase.start_offset),
          to: formatOffset(end),
        }),
      })
    }
    if (!reaching || phase.end_offset > reaching.end_offset) reaching = phase
  }
  const startsAt = new Set(phases.map((phase) => phase.start_offset))
  const endsAt = new Set(phases.map((phase) => phase.end_offset))
  // A box from `start` to `end` of the session, drawn short of its
  // neighbours: half a seam, or half a lapse gap where a time jump opens
  // (or a stretch of session no phase holds); flush with the drawing's ends.
  const inset = (minutes: number, side: 'start' | 'end') =>
    minutes <= 0 || minutes >= map.duration
      ? 0
      : (jumpsAt.has(minutes) || (side === 'start' ? !endsAt.has(minutes) : !startsAt.has(minutes))
          ? LAPSE_PX
          : SEAM_PX) / 2
  const boxStyle = (start: number, end: number): CSSProperties => {
    const from = inset(start, 'start')
    const to = inset(end, 'end')
    return {
      left: `calc(${pct(start)} + ${from}px)`,
      width: `calc(${pct(end)} - ${pct(start)} - ${from + to}px)`,
    }
  }
  // A dimmed inject (filtered out, or not delivered yet) keeps its node and
  // its branch as they are: only its label's text is muted -- a solid
  // colour, never transparency, which reads as the mark sitting behind a
  // frosted phase box.
  const dimmed = (inject: InjectDraft) => highlight !== null && !highlight.has(inject.key)
  // Every inject's node: the same diamond, in its line's colour (accent on
  // the storyline, the branch colour on a lane).
  const node = 'h-2.5 w-2.5 shrink-0 rotate-45 rounded-[2px] border-2 border-panel'
  // Every inject's label (code, then the start of the title), alike on the
  // storyline and on a lane.
  const labelText = (inject: InjectDraft) =>
    `${text} leading-none whitespace-nowrap ${
      dimmed(inject)
        ? 'text-paper-ink/45 dark:text-fg-faint'
        : 'text-paper-ink/80 dark:text-fg-muted'
    }`
  const labelContent = (inject: InjectDraft) => (
    <>
      <span translate="no" className="font-mono">
        {code(inject)}
      </span>{' '}
      {shortTitle(inject.title, titleChars)}
    </>
  )
  // A label's chip takes the phase box's tint (solid), so it hides what runs
  // under it without leaving a white patch on the box.
  const chip =
    phases.length === 0
      ? 'bg-panel'
      : phaseEditing || emphasizePhases
        ? 'bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-panel))]'
        : 'bg-[color-mix(in_srgb,var(--color-accent)_5%,var(--color-panel))]'

  // The time of day in the scene ("10:30 am"), or "" without a scenario
  // start.
  const sceneTime = (minutes: number) =>
    incidentStart ? formatClock(clockAt(incidentStart, incidentAt(minutes)), i18n.language) : ''
  // "scenario +3 d 18 h · 10:30 am" -- the time of day only with a scenario
  // start; then, when session time is shown, "· T+01:00 · 10:30".
  const timeLabel = (minutes: number | null) => {
    if (minutes === null) return formatOffset(null)
    const elapsed = formatIncident(incidentAt(minutes))
    const incident = t('creator.msel.map.incidentAt', {
      span: incidentStart ? `${elapsed} · ${sceneTime(minutes)}` : elapsed,
    })
    return showSession
      ? `${incident} · ${formatOffsetAt(minutes, startTime, i18n.language)}`
      : incident
  }
  // What the axis says at a time: scenario time (elapsed, then the time of
  // day in the scene) and, when shown, session time (T+, then the clock).
  const axisLabel = (minutes: number) => [
    formatIncident(incidentAt(minutes)),
    ...(incidentStart ? [sceneTime(minutes)] : []),
    ...(showSession ? [formatOffset(minutes)] : []),
    ...(showSession && startTime ? [formatClock(clockAt(startTime, minutes), i18n.language)] : []),
  ]
  // The axis times the session's start and end, each inject (right under
  // it: mandatory first, then contingent) and, where there's room, where
  // each phase opens, with fillers only where they're far apart -- as close
  // as their labels allow without overlapping (measured; 9% unmeasured).
  const stopTimes = map.stops.map((stop) => stop.time)
  const branchTimes = map.branches.map((branch) => branch.time)
  const phaseStarts = phases.map((phase) => phase.start_offset)
  const longest = Math.max(
    ...[0, map.duration, ...stopTimes, ...branchTimes, ...phaseStarts].flatMap((minutes) =>
      axisLabel(Math.round(minutes)).map((line) => line.length),
    ),
  )
  const ticks = axisTicks(map.duration, stopTimes, {
    minGap: axisWidth ? (longest * AXIS_CHAR_PX + 12) / axisWidth : 0.09,
    fillGap,
    branches: branchTimes,
    phases: phaseStarts,
  })
  const stopLabel = (inject: InjectDraft) =>
    t('creator.msel.map.stop', {
      code: code(inject),
      time: timeLabel(inject.offset_minutes),
      title: inject.title || '—',
    })
  const branchLabel = (branch: StorylineBranch) =>
    t('creator.msel.map.branch', {
      code: code(branch.inject),
      from: code(branch.from),
      rejoin: branch.rejoin
        ? t('creator.msel.map.rejoinsAt', { code: code(branch.rejoin.inject) })
        : t('creator.msel.map.noRejoin'),
      title: branch.inject.title || '—',
    })
  // A branch leaves its inject and rejoins the storyline on a short
  // diagonal, not straight down: injects often sit where a phase opens, and
  // a vertical there would run along the box's border (or the seam between
  // two boxes) and vanish into it. BRANCH_SLANT_PX on screen, in user units
  // (the drawing is stretched to its width; none until measured).
  const slant = axisWidth ? (BRANCH_SLANT_PX / axisWidth) * WIDTH : 0
  const branchPath = (branch: StorylineBranch) => {
    const fromX = x(branch.fromTime)
    const toX = x(branch.time)
    const y = laneY(branch.lane)
    const path = [
      `M ${fromX} ${laneY(branch.fromLane)}`,
      `L ${fromX + Math.min(slant, Math.max(0, toX - fromX))} ${y}`,
      `L ${toX} ${y}`,
    ]
    if (branch.rejoin) {
      const backX = x(branch.rejoin.time)
      path.push(
        `L ${backX - Math.min(slant, Math.max(0, backX - toX))} ${y}`,
        `L ${backX} ${laneY(0)}`,
      )
    }
    return path.join(' ')
  }

  return (
    <div className="space-y-1">
      <div
        ref={drawingRef}
        // Framed only while there's no phase: then each phase is its box.
        // No text selection while something is dragged across the drawing.
        // Layers are set by z-index, never left to DOM order, so no phase
        // box ever covers a branch or a label: boxes 0, the storyline and
        // branches 1, lapses and the add affordance 2, marks and their
        // labels 3, the now/clock lines and phase grips 10, an open menu or
        // a drag ghost 30+.
        className={`relative isolate rounded-sm ${
          phases.length === 0 ? 'border border-paper-line dark:border-line' : ''
        } ${drag ? 'cursor-grabbing select-none' : ''}`}
        style={{ height }}
      >
        {/* Ink, not the accent the phase boxes use; inside the drawing's
            own stacking context, so a sticky header still covers it. */}
        {clock !== null && clock !== now && (
          <div
            data-testid="storyline-clock"
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 z-10 -ml-px border-l border-dashed border-paper-ink/40 dark:border-fg/40"
            style={{ left: pct(clock) }}
          />
        )}
        {/* A hairline with a soft halo of its colour: the playhead's while
            the play runs, green once it's over. */}
        {now !== null && (
          <div
            data-testid="storyline-now"
            data-finished={finished ? 'true' : undefined}
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 z-10 w-px ${
              finished
                ? '-ml-px bg-success ring-2 ring-success/25'
                : 'bg-playhead ring-2 ring-playhead/25'
            }`}
            style={{ left: pct(finished ? map.duration : now) }}
          >
            <span
              className={`absolute -top-1 -left-[3.5px] h-2 w-2 rounded-full ${
                finished ? 'bg-success' : 'bg-playhead'
              }`}
            />
          </div>
        )}
        {phases.map((phase) => (
          <div
            key={phase.key}
            data-editable={phaseEditing ? 'true' : undefined}
            className={`absolute inset-y-0 z-0 rounded-sm px-1.5 pt-1 ${text} leading-none ${
              // The same boxes on every tab; Phases brings them forward,
              // and while they can be edited there a dashed border says so.
              phaseEditing
                ? 'border border-dashed border-accent bg-accent/10'
                : emphasizePhases
                  ? 'border-[0.5px] border-accent bg-accent/10'
                  : 'border-[0.5px] border-accent/60 bg-accent/5'
            }`}
            style={boxStyle(phase.start_offset, phase.end_offset)}
          >
            <span className="block truncate font-medium text-paper-ink dark:text-fg">
              {phaseEditing && (
                <span aria-hidden="true" className="mr-1 text-accent-fg">
                  ⠿
                </span>
              )}
              {phase.name || phase.code || pending}
            </span>
            {/* A jump forward in the incident as the phase opens. */}
            {phase.start_offset > 0 && phase.incident_jump_minutes > 0 && (
              <span
                title={t('creator.msel.phaseJump', {
                  span: formatSpan(phase.incident_jump_minutes),
                })}
                className="mt-0.5 block truncate italic text-paper-ink/60 dark:text-fg-faint"
              >
                <span aria-hidden="true">⏩ </span>+{formatSpan(phase.incident_jump_minutes)}
                <span className="sr-only">
                  {t('creator.msel.phaseJump', {
                    span: formatSpan(phase.incident_jump_minutes),
                  })}
                </span>
              </span>
            )}
          </div>
        ))}
        {/* Session time two phases both claim: hatched in amber over the
            boxes, so an overlap the report warns about shows where it is
            (otherwise the later box just hides the earlier one's end). */}
        {phaseOverlaps.map((overlap) => (
          <div
            key={`${overlap.first}-${overlap.second}`}
            title={overlap.label}
            className="absolute inset-y-0 z-0 rounded-sm border-[0.5px] border-inactive-1 bg-[repeating-linear-gradient(45deg,var(--color-inactive-1)_0_1px,transparent_1px_5px)]"
            style={{
              left: pct(overlap.start),
              width: `calc(${pct(overlap.end)} - ${pct(overlap.start)})`,
            }}
          >
            <span className="sr-only">{overlap.label}</span>
          </div>
        ))}
        {/* Session time no phase holds. Before the first phase or after
            the last: hatched, so it doesn't look like a phase. Between two
            phases it's a lapse, drawn with the time jumps below. */}
        {uncoveredSpans(phases, map.duration).map((span) => {
          const label = t('creator.msel.map.noPhase', {
            from: timeLabel(span.start),
            to: timeLabel(span.end),
          })
          const between = span.start > 0 && span.end < map.duration
          return between ? null : (
            <div
              key={span.start}
              title={label}
              className={`absolute inset-y-0 z-0 rounded-sm border-[0.5px] border-dashed border-inactive-1/60 bg-[repeating-linear-gradient(135deg,var(--color-inactive-1)_0_1px,transparent_1px_7px)] px-1.5 pt-1 ${text} leading-none`}
              style={boxStyle(span.start, span.end)}
            >
              <span
                aria-hidden="true"
                className="block truncate text-paper-ink/60 dark:text-fg-faint"
              >
                {t('creator.msel.map.noPhaseShort')}
              </span>
              <span className="sr-only">{label}</span>
            </div>
          )
        })}
        <svg
          aria-hidden="true"
          className="absolute inset-0 z-[1] h-full w-full"
          viewBox={`0 0 ${WIDTH} ${height}`}
          preserveAspectRatio="none"
        >
          {/* The storyline, faded where the exercise hasn't run through it
              (the control center). */}
          {(fadeUntraversed
            ? storylineRuns(map, (inject) => !dimmed(inject), finished ? map.duration : (now ?? 0))
            : [{ start: 0, end: map.duration, run: true }]
          ).map((part) => (
            <path
              key={part.start}
              d={`M ${x(part.start)} ${laneY(0)} L ${x(part.end)} ${laneY(0)}`}
              data-faded={part.run ? undefined : 'true'}
              className={part.run ? 'stroke-accent' : FADED_STROKE.accent}
              strokeWidth={2}
              strokeDasharray={part.run ? undefined : FADED_STROKE.dots}
              strokeLinecap={part.run ? undefined : 'round'}
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
          ))}
          {map.branches.map((branch) => (
            <path
              key={branch.inject.key}
              d={branchPath(branch)}
              data-faded={fadeUntraversed && dimmed(branch.inject) ? 'true' : undefined}
              className={
                fadeUntraversed && dimmed(branch.inject) ? FADED_STROKE.branch : 'stroke-chart-2'
              }
              strokeWidth={1.5}
              strokeDasharray={
                fadeUntraversed && dimmed(branch.inject)
                  ? branch.rejoin
                    ? FADED_STROKE.dots
                    : FADED_STROKE.dashDots
                  : branch.rejoin
                    ? undefined
                    : '4 3'
              }
              strokeLinecap={fadeUntraversed && dimmed(branch.inject) ? 'round' : undefined}
              vectorEffect="non-scaling-stroke"
              fill="none"
            />
          ))}
        </svg>
        {/* A lapse in the scenario belongs to no phase: the panel shows
            between the boxes and the storyline breaks into "⋯". As a phase opens with a time
            jump the session carries straight on, so the gap is narrow and
            not to scale; session left between two phases (before Phases
            turns it into scenario time) keeps its width. */}
        {[
          ...phases
            .filter((phase) => phase.start_offset > 0 && phase.incident_jump_minutes > 0)
            .map((phase) => ({
              key: `jump-${phase.key}`,
              label: t('creator.msel.phaseJump', {
                span: formatSpan(phase.incident_jump_minutes),
              }),
              from: pct(phase.start_offset),
              to: pct(phase.start_offset),
            })),
          ...uncoveredSpans(phases, map.duration)
            .filter((span) => span.start > 0 && span.end < map.duration)
            .map((span) => ({
              key: `gap-${span.start}`,
              label: t('creator.msel.map.noPhase', {
                from: timeLabel(span.start),
                to: timeLabel(span.end),
              }),
              from: pct(span.start),
              to: pct(span.end),
            })),
        ].map((lapse) => (
          // The gap between the boxes is the panel already: this only
          // breaks the storyline across it.
          <span
            key={lapse.key}
            title={lapse.label}
            className="absolute z-[2] flex -translate-y-1/2 items-center justify-center bg-panel font-semibold leading-none text-accent-fg"
            style={{
              left: `calc(${lapse.from} - ${LAPSE_PX / 2}px)`,
              width: `calc(${lapse.to} - ${lapse.from} + ${LAPSE_PX}px)`,
              top: laneY(0),
              height: 10,
            }}
          >
            <span aria-hidden="true">⋯</span>
            <span className="sr-only">{lapse.label}</span>
          </span>
        ))}
        {onAddAt && (
          // Pointer-only affordance (the strip has a button for keyboards):
          // below the marks, so pointing at a mark still hits the mark.
          <div
            aria-hidden="true"
            className="absolute inset-x-0 z-[2] cursor-copy"
            style={{ top: laneY(0) - 9, height: 18 }}
            onMouseMove={(event) => {
              const box = event.currentTarget.getBoundingClientRect()
              const minutes = ((event.clientX - box.left) / box.width) * map.duration
              setAddAt(
                Math.min(
                  map.duration,
                  Math.max(0, Math.round(minutes / STOP_SNAP_MINUTES) * STOP_SNAP_MINUTES),
                ),
              )
            }}
            onMouseLeave={() => setAddAt(null)}
            onClick={() => addAt !== null && onAddAt(addAt)}
          >
            {addAt !== null && (
              <span
                className="pointer-events-none absolute flex -translate-x-1/2 items-center gap-1"
                style={{ left: pct(addAt), top: 2 }}
              >
                <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-dashed border-accent bg-panel text-[10px] leading-none text-accent-fg">
                  +
                </span>
                <span className="rounded-xs bg-panel/90 px-1 font-mono text-[10px] text-accent-fg">
                  {timeLabel(addAt)}
                </span>
              </span>
            )}
          </div>
        )}
        {phaseEditing && (
          <>
            {/* Each phase box: its name row opens a menu (edit, delete) and
                drags the box whole; its edges stretch it. */}
            {phases.map((phase) => {
              const name = codeRefText(phase.code, phase.name, pending)
              return (
                <Fragment key={`edit-${phase.key}`}>
                  <MarkMenu
                    label={t('creator.msel.map.phaseMenu.label', { phase: name })}
                    className="absolute top-0 z-[3]"
                    style={{ ...boxStyle(phase.start_offset, phase.end_offset), height: 14 }}
                    summaryClassName="block h-full w-full cursor-grab rounded-t-sm hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg active:cursor-grabbing"
                    actions={[
                      {
                        label: t('creator.msel.map.phaseMenu.edit'),
                        onSelect: () => phaseEditing.onEdit(phase),
                      },
                      {
                        label: t('creator.msel.map.phaseMenu.delete'),
                        onSelect: () => phaseEditing.onDelete(phase),
                        blockedBy: phaseEditing.deleteBlockedBy(phase),
                      },
                    ]}
                    drag={dragProps({ type: 'phase', phase, mode: 'move' })}
                  />
                  {(['start', 'end'] as const).map((edge) => (
                    <span
                      key={edge}
                      aria-hidden="true"
                      title={t(`creator.msel.map.phaseMenu.${edge}Edge`, { phase: name })}
                      // A grip bar on each edge: always shown, it reads as a
                      // handle before the pointer finds it.
                      className="absolute inset-y-0 z-10 flex w-1.5 cursor-ew-resize items-center justify-center hover:bg-accent/40"
                      {...dragProps({ type: 'phase', phase, mode: edge })}
                      // After the drag props: their style (touch-action
                      // only) would otherwise replace the grip's position.
                      style={{
                        left:
                          edge === 'start'
                            ? `calc(${pct(phase.start_offset)} + ${inset(phase.start_offset, 'start')}px)`
                            : `calc(${pct(phase.end_offset)} - ${inset(phase.end_offset, 'end')}px - 6px)`,
                        touchAction: 'none',
                      }}
                    >
                      <span className="h-4 w-0.5 rounded-full bg-accent" />
                    </span>
                  ))}
                </Fragment>
              )
            })}
            {/* Session time no phase holds: a new phase there. */}
            {uncoveredSpans(phases, map.duration).map((span) => (
              <button
                key={`new-${span.start}`}
                type="button"
                onClick={() => phaseEditing.onCreate(span.start, span.end)}
                aria-label={t('creator.msel.map.newPhaseHere', {
                  from: formatOffset(span.start),
                  to: formatOffset(span.end),
                })}
                title={t('creator.msel.map.newPhaseHere', {
                  from: formatOffset(span.start),
                  to: formatOffset(span.end),
                })}
                className={`absolute top-0 z-10 flex h-3.5 items-center justify-center overflow-hidden rounded-sm border border-dashed border-accent/60 bg-panel/80 ${text} leading-none text-accent-fg hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg`}
                style={boxStyle(span.start, span.end)}
              >
                <span aria-hidden="true" className="truncate px-1">
                  + {t('creator.msel.map.newPhaseShort')}
                </span>
              </button>
            ))}
          </>
        )}
        {map.stops.map((stop) => (
          <MarkMenu
            key={stop.inject.key}
            label={stopLabel(stop.inject)}
            className="absolute z-[3] flex -translate-x-1/2 -translate-y-1/2"
            style={{ left: pct(stop.time), top: laneY(0) }}
            dimmed={dimmed(stop.inject)}
            // The pseudo-element widens the hit area to 24px (WCAG 2.5.8)
            // without changing how the mark looks.
            summaryClassName={`group relative flex ${onMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} items-center rounded-xs before:absolute before:-inset-2 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg focus-visible:ring-offset-2`}
            actions={markActions(stop.inject)}
            drag={dragProps({ type: 'inject', inject: stop.inject, kind: 'stop' })}
          >
            <span aria-hidden="true" className={`${node} bg-accent group-hover:bg-cta`} />
            {/* The code and the start of the title above the storyline (the
                whole of it is in the mark's label); its time is on the axis,
                right under it. */}
            <span
              aria-hidden="true"
              // From the mark rightwards, tilted up: it never spills past
              // the drawing's left edge, and neighbours overlap less.
              className={`pointer-events-none absolute bottom-full left-1/2 mb-1 origin-bottom-left -rotate-[20deg] rounded-xs ${chip} px-1 ${labelText(stop.inject)}`}
            >
              {labelContent(stop.inject)}
            </span>
          </MarkMenu>
        ))}
        {map.branches.map((branch) => (
          <MarkMenu
            key={branch.inject.key}
            label={branchLabel(branch)}
            className="absolute z-[3] -translate-y-1/2"
            style={{ left: `calc(${pct(branch.time)} - 5px)`, top: laneY(branch.lane) }}
            dimmed={dimmed(branch.inject)}
            summaryClassName={`group relative flex ${onMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} items-center rounded-xs before:absolute before:-inset-1.5 before:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg`}
            actions={markActions(branch.inject)}
            drag={dragProps({ type: 'inject', inject: branch.inject, kind: 'branch' })}
          >
            <span aria-hidden="true" className={`${node} bg-chart-2 group-hover:brightness-110`} />
            {/* Code and the start of the title, just above the lane's line
                so the branch's path never runs through it; the whole of it
                is in the mark's label and tooltip. */}
            <span
              aria-hidden="true"
              className={`absolute bottom-full left-0 mb-0.5 rounded-xs ${chip} px-1 ${labelText(branch.inject)}`}
            >
              {labelContent(branch.inject)}
            </span>
          </MarkMenu>
        ))}
        {/* Where a dragged mark would land: its line, and a ghost of it with
            the time it would take. */}
        {drag?.target.type === 'inject' && (
          <>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 h-0.5 bg-accent/40"
              style={{ top: laneY(drag.target.kind === 'stop' ? 0 : drag.lane) - 1 }}
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-40 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1"
              style={{
                left: pct(drag.minutes),
                top: laneY(drag.target.kind === 'stop' ? 0 : drag.lane),
              }}
            >
              <span className="h-3 w-3 rotate-45 rounded-[2px] border-2 border-dashed border-accent bg-panel" />
              <span className="rounded-xs bg-panel/90 px-1 font-mono text-[10px] whitespace-nowrap text-accent-fg">
                <span translate="no">{code(drag.target.inject)}</span> · {timeLabel(drag.minutes)}
              </span>
            </span>
          </>
        )}
        {/* A phase box being moved or stretched: a dashed ghost of where it
            would sit, with its session band. */}
        {drag?.target.type === 'phase' &&
          (() => {
            const { phase, mode } = drag.target
            const length = phase.end_offset - phase.start_offset
            const start =
              mode === 'move'
                ? Math.min(
                    Math.max(0, map.duration - length),
                    Math.max(0, phase.start_offset + drag.shift),
                  )
                : mode === 'start'
                  ? Math.min(drag.minutes, phase.end_offset - 5)
                  : phase.start_offset
            const end =
              mode === 'move'
                ? start + length
                : mode === 'end'
                  ? Math.max(drag.minutes, phase.start_offset + 5)
                  : phase.end_offset
            return (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 z-40 rounded-sm border-2 border-dashed border-accent bg-accent/10"
                style={{ left: pct(start), width: `calc(${pct(end)} - ${pct(start)})` }}
              >
                <span className="absolute top-1 left-1 rounded-xs bg-panel/90 px-1 font-mono text-[10px] whitespace-nowrap text-accent-fg">
                  {formatOffset(start)} – {formatOffset(end)}
                </span>
              </div>
            )
          })()}
      </div>
      <div
        ref={axisRef}
        translate="no"
        className="relative font-mono text-[10px] tabular-nums text-paper-ink/60 dark:text-fg-faint"
        style={{ height: axisLines * 12 + 4 }}
      >
        {ticks.map(({ minutes, kind }) => (
          <span
            key={minutes}
            // The first and last labels align to the drawing's edges
            // instead of spilling past them; a phase's start, to its box's
            // left edge, like its name above.
            className={`absolute whitespace-nowrap ${
              minutes === 0 || kind === 'phase'
                ? 'text-left'
                : minutes >= map.duration
                  ? '-translate-x-full text-right'
                  : '-translate-x-1/2 text-center'
            } ${kind === 'fill' ? 'opacity-60' : ''}`}
            style={{
              left:
                kind === 'phase'
                  ? `calc(${pct(minutes)} + ${inset(minutes, 'start')}px)`
                  : pct(minutes),
            }}
            aria-hidden="true"
          >
            {axisLabel(minutes).map((line, index) => (
              <span
                key={index}
                className={`block ${
                  index === 0
                    ? 'italic text-paper-ink/80 dark:text-fg-muted'
                    : incidentStart && index === 1
                      ? ''
                      : 'opacity-70'
                }`}
              >
                {line}
              </span>
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}
