import type { TagColor } from './tagColors'
import type { OrganizationTag, SystemTag, TagOrigin, TTXTag } from './types'

/** The most a tag's name can hold (the chip's width). */
export const TAG_NAME_MAX = 24

/** What a tag is, at any level of the library: what the form edits and
 * what a copy carries over (plus where it came from). */
export interface TagFields extends TagOrigin {
  name: string
  color: TagColor
  custom_hex: string | null
}

export function emptyTagFields(): TagFields {
  return {
    name: '',
    color: 'violet',
    custom_hex: null,
    origin: null,
    origin_id: null,
    origin_name: null,
  }
}

/** A copy of a TTX-Zone tag, in the UI language. */
export function tagFromSystem(tag: SystemTag, spanish: boolean): TagFields {
  const name = spanish ? tag.name_es : tag.name_en
  return {
    name,
    color: tag.color,
    custom_hex: null,
    origin: 'system',
    origin_id: tag.id,
    origin_name: name,
  }
}

export function tagFromLevel(
  tag: OrganizationTag | TTXTag,
  level: 'organization' | 'exercise',
): TagFields {
  return {
    name: tag.name,
    color: tag.color,
    custom_hex: tag.custom_hex,
    origin: level,
    origin_id: tag.id,
    origin_name: tag.name,
  }
}

/** A duplicate: the same tag under the `_copy` suffix, so it never reads
 * as the original -- shortened first when the name would no longer fit. */
export function asTagDuplicate(fields: TagFields): TagFields {
  const suffix = '_copy'
  return {
    ...fields,
    name: `${fields.name.slice(0, TAG_NAME_MAX - suffix.length).trimEnd()}${suffix}`,
  }
}
