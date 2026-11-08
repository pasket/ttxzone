import type { CSSProperties } from 'react'

/** Fixed palette shared by both tag pools -- mirrors backend
 * app/models/tag_color.py's TagColor enum exactly (lowercase values).
 * 'custom' is the escape hatch (see tagColorProps below): a tag with
 * color 'custom' carries its real color in a sibling `custom_hex` field
 * ("#RRGGBB") instead of one of these fixed, pre-vetted swatches. */
export type TagColor =
  | 'violet'
  | 'indigo'
  | 'fuchsia'
  | 'rose'
  | 'plum'
  | 'slate'
  | 'sand'
  | 'moss'
  | 'teal'
  | 'lime'
  | 'graphite'
  | 'custom'

export const TAG_COLORS: TagColor[] = [
  'violet',
  'indigo',
  'fuchsia',
  'rose',
  'plum',
  'slate',
  'sand',
  'moss',
  'teal',
  'lime',
  'graphite',
  'custom',
]

type NamedTagColor = Exclude<TagColor, 'custom'>

/** Border+text classes for one chip -- tinted background via the same
 * color at low opacity, never a solid fill, and the text in the swatch's
 * `-fg` shade, which index.css keeps readable on that tint in each theme.
 * No entry for 'custom' --
 * that color has no fixed token, see tagColorProps. */
export const TAG_COLOR_SWATCH_CLASS: Record<NamedTagColor, string> = {
  violet: 'border-tag-violet/50 bg-tag-violet/10 text-tag-violet-fg',
  indigo: 'border-tag-indigo/50 bg-tag-indigo/10 text-tag-indigo-fg',
  fuchsia: 'border-tag-fuchsia/50 bg-tag-fuchsia/10 text-tag-fuchsia-fg',
  rose: 'border-tag-rose/50 bg-tag-rose/10 text-tag-rose-fg',
  plum: 'border-tag-plum/50 bg-tag-plum/10 text-tag-plum-fg',
  slate: 'border-tag-slate/50 bg-tag-slate/10 text-tag-slate-fg',
  sand: 'border-tag-sand/50 bg-tag-sand/10 text-tag-sand-fg',
  moss: 'border-tag-moss/50 bg-tag-moss/10 text-tag-moss-fg',
  teal: 'border-tag-teal/50 bg-tag-teal/10 text-tag-teal-fg',
  lime: 'border-tag-lime/50 bg-tag-lime/10 text-tag-lime-fg',
  graphite: 'border-tag-graphite/50 bg-tag-graphite/10 text-tag-graphite-fg',
}

/** Color -> i18n key, same lookup-object pattern as roleLabels.ts's
 * ROLE_LABEL_KEYS -- i18next's typed resources reject a dynamic
 * template-literal key (``t(`common.tagColors.${c}`)``), so the color
 * `<select>`s look each option's label up through this map instead.
 * `as const` (not a `Record<TagColor, string>` annotation) keeps the
 * values literal so `t()` still accepts them as real typed keys. */
export const TAG_COLOR_LABEL_KEYS = {
  violet: 'common.tagColors.violet',
  indigo: 'common.tagColors.indigo',
  fuchsia: 'common.tagColors.fuchsia',
  rose: 'common.tagColors.rose',
  plum: 'common.tagColors.plum',
  slate: 'common.tagColors.slate',
  sand: 'common.tagColors.sand',
  moss: 'common.tagColors.moss',
  teal: 'common.tagColors.teal',
  lime: 'common.tagColors.lime',
  graphite: 'common.tagColors.graphite',
  custom: 'common.tagColors.custom',
} as const satisfies Record<TagColor, string>

/** Renders any tag's color as a className (for the 11 fixed swatches) or
 * an inline style (for 'custom', which has no fixed token -- the color
 * comes straight from the tag's own custom_hex at render time, with no
 * contrast guarantee; that's an explicit, opt-in tradeoff for picking an
 * arbitrary color, unlike the fixed swatches which were chosen to stay
 * legible against both themes). Every chip-shaped consumer (TagChip,
 * TagAssignmentField, the Tagging screens' live preview swatch) goes
 * through this instead of indexing TAG_COLOR_SWATCH_CLASS directly, so
 * 'custom' never needs special-casing at each call site. */
export function tagColorProps(
  color: TagColor,
  customHex: string | null,
): { className: string; style?: CSSProperties } {
  if (color === 'custom') {
    if (customHex) {
      return {
        className: 'border',
        style: {
          borderColor: `${customHex}80`,
          backgroundColor: `${customHex}1a`,
          color: customHex,
        },
      }
    }
    // Defensive fallback -- the backend never persists color='custom'
    // without a valid custom_hex, but an in-progress edit (before the
    // hex field has a valid value yet) can transiently hit this.
    return { className: TAG_COLOR_SWATCH_CLASS.slate }
  }
  return { className: TAG_COLOR_SWATCH_CLASS[color] }
}

/** "#RRGGBB" only -- mirrors backend CUSTOM_HEX_PATTERN
 * (app/models/tag_color.py) exactly. */
export const CUSTOM_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/
