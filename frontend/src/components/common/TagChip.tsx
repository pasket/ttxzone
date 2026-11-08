import { tagColorProps } from '../../lib/tagColors'
import type { TagColor } from '../../lib/tagColors'

/** One tag rendered as a small colored chip -- static (never clickable;
 * this pass has no click-to-filter behavior, see the spec's Out of
 * scope), truncates rather than wrapping to a second line per the
 * compact-label-overflow rule every other chip in this app already
 * follows (ContextBar's segments, badgeNeutral). `title` gives the full
 * name back on hover/focus for anything long enough to truncate.
 * `customHex` is only meaningful (and only ever non-null) when
 * color === 'custom' -- see tagColorProps. */
export function TagChip({
  name,
  color,
  customHex,
}: {
  name: string
  color: TagColor
  customHex?: string | null
}) {
  const { className, style } = tagColorProps(color, customHex ?? null)
  return (
    <span
      title={name}
      style={style}
      className={`inline-block max-w-[8rem] truncate rounded-md align-bottom border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {name}
    </span>
  )
}
