/** The fold toggle's glyph: an arrow against a bar that stands for the
 * edge the column folds into. `side` is that edge -- the Primary Menu folds
 * left, the Playground's role panel right (the same drawing, mirrored), the
 * projected storyline down (turned) --
 * so the arrow points towards the edge to fold and away from it to unfold. */
export function FoldIcon({
  collapsed,
  side = 'left',
}: {
  collapsed: boolean
  side?: 'left' | 'right' | 'bottom'
}) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 ${
        side === 'right' ? '-scale-x-100' : side === 'bottom' ? '-rotate-90' : ''
      }`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4v16" />
      <path d={collapsed ? 'M10 8l4 4-4 4M14 12H8' : 'M16 8l-4 4 4 4M12 12h8'} />
    </svg>
  )
}
