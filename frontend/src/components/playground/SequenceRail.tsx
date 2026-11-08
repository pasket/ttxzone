import type { CSSProperties } from 'react'

import type { InjectKind } from '../../lib/types'

/** Width of one lane of the rail, in px. */
const LANE = 14
/** Where a row's mark sits, from the row's top: the middle of its first
 * line (the row's 6px padding plus half the 36px icon button). */
export const RAIL_NODE_Y = 24

/** One segment of a lane's line within a row: from the top edge or the
 * mark's level, to the mark's level, the bottom edge, or a short stub
 * under the mark (a branch whose way back isn't in the window). */
export interface RailLine {
  lane: number
  from: 'top' | 'node'
  to: 'node' | 'bottom' | 'stub'
  /** No way back, as the storyline map dashes it. */
  dashed?: boolean
}

export interface RailRow {
  node?: { lane: number; kind: InjectKind; muted?: boolean }
  lines?: RailLine[]
  /** Branch lanes leaving the storyline at the mark's level (the fork). */
  forks?: number[]
  /** Branch lanes coming back into the storyline at the mark's level. */
  joins?: number[]
}

const center = (lane: number) => lane * LANE + LANE / 2
const width = (lane: number) => (lane === 0 ? 2 : 1.5)
// Whole class names, so Tailwind sees them.
const fill = (lane: number) => (lane === 0 ? 'bg-accent' : 'bg-chart-2')
const stroke = (lane: number) => (lane === 0 ? 'border-accent' : 'border-chart-2')

/** The sequence window's gutter: a small vertical git graph in the
 * storyline map's colours -- the storyline in the accent with its
 * mandatory injects as dots, each branch on a lane of its own in the
 * branch colour with its contingent inject as a diamond, forking off and
 * rejoining with a rounded corner. Decorative: the rows say it in words. */
export function SequenceRail({
  lanes,
  row,
  nodeY = RAIL_NODE_Y,
}: {
  lanes: number
  row: RailRow
  nodeY?: number
}) {
  const line = ({ lane, from, to, dashed }: RailLine) => {
    const top = from === 'top' ? 0 : nodeY
    const style: CSSProperties = {
      left: center(lane) - width(lane) / 2,
      top,
      ...(to === 'bottom' ? { bottom: 0 } : { height: (to === 'node' ? nodeY : nodeY + 10) - top }),
      ...(dashed
        ? { borderLeftWidth: width(lane), borderLeftStyle: 'dashed' }
        : { width: width(lane) }),
    }
    return (
      <span
        key={`${lane}-${from}-${to}`}
        className={`absolute ${dashed ? stroke(lane) : fill(lane)}`}
        style={style}
      />
    )
  }
  // A rounded corner between the storyline and a branch lane: over and
  // down to the bottom (a fork), or down from the top and over (a join).
  const corner = (lane: number, kind: 'fork' | 'join') => (
    <span
      key={`${kind}-${lane}`}
      className={`absolute border-chart-2 ${
        kind === 'fork' ? 'rounded-tr-md border-t border-r' : 'rounded-br-md border-r border-b'
      }`}
      style={{
        left: center(0),
        width: center(lane) - center(0) + width(lane) / 2,
        ...(kind === 'fork' ? { top: nodeY, bottom: 0 } : { top: 0, height: nodeY }),
        borderTopWidth: kind === 'fork' ? width(lane) : 0,
        borderBottomWidth: kind === 'join' ? width(lane) : 0,
        borderRightWidth: width(lane),
      }}
    />
  )
  const node = row.node
  return (
    <span
      aria-hidden="true"
      className="relative shrink-0 self-stretch"
      style={{ width: lanes * LANE }}
    >
      {row.lines?.map(line)}
      {row.forks?.map((lane) => corner(lane, 'fork'))}
      {row.joins?.map((lane) => corner(lane, 'join'))}
      {node && (
        <span
          className={`absolute -translate-x-1/2 -translate-y-1/2 border-2 border-panel ${
            node.kind === 'mandatory'
              ? 'h-3 w-3 rounded-full bg-accent'
              : 'h-3 w-3 rotate-45 rounded-[2px] bg-chart-2'
          } ${node.muted ? 'opacity-50' : ''}`}
          style={{ left: center(node.lane), top: nodeY }}
        />
      )}
    </span>
  )
}
