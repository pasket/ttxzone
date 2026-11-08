import { useState } from 'react'

import { tagColorProps } from '../../lib/tagColors'
import type { AssignableTag } from '../../lib/types'

/** Checkbox list of a tag pool (TTX tags, Organization tags, ...) with
 * per-item selected state -- embedded directly inside an existing edit
 * form (Exercises, Planners), or wrapped in Modal where the tag
 * assignment is the only editable thing on the row (Invitations).
 * Controlled, no internal state: the caller owns `selectedTagIds` and
 * gets a full next-Set back on every toggle, matching the backend's
 * full-replace assignment semantics (e.g. TTXTagAssignmentRequest).
 * A disabled tag is only listed where it was already assigned on open:
 * it can be removed, never added. */
export function TagAssignmentField({
  availableTags,
  selectedTagIds,
  onChange,
}: {
  availableTags: AssignableTag[]
  selectedTagIds: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const [assignedOnOpen] = useState(selectedTagIds)
  const tags = availableTags.filter((tag) => !tag.disabled_at || assignedOnOpen.has(tag.id))

  function toggle(tagId: string) {
    const next = new Set(selectedTagIds)
    if (next.has(tagId)) next.delete(tagId)
    else next.add(tagId)
    onChange(next)
  }

  if (tags.length === 0) return null

  return (
    <div className="space-y-1.5">
      {tags.map((tag) => {
        const { className, style } = tagColorProps(tag.color, tag.custom_hex)
        return (
          <label key={tag.id} className="flex items-center gap-2 text-sm">
            <input
              name="tag_ids"
              type="checkbox"
              checked={selectedTagIds.has(tag.id)}
              onChange={() => toggle(tag.id)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
            />
            <span
              style={style}
              className={`inline-flex max-w-[8rem] items-center truncate rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}
            >
              {tag.name}
            </span>
          </label>
        )
      })}
    </div>
  )
}
