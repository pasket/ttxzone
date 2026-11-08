/** Shared className strings for the button/input/link treatments defined
 * in the "TTX-Zone Style Guide" design-canvas artifact -- plain constants,
 * not a <Button> component, so every call site stays a regular
 * <button className={...}> with no JSX/structural change. */

// disabled:bg-surface/text-fg-disabled have no light-mode equivalent of
// their own (bg-surface/fg-disabled are dark-only-looking tokens with a
// single global value, not redefined under .dark) -- applying them
// unprefixed made every disabled control render with a near-black box in
// light mode too. Light gets its own muted pair (paper-line/paper-ink at
// reduced opacity, verified >=4.5:1 contrast); dark keeps the original.
// focus-visible:ring-2 (no offset -- these buttons render against too many
// different background tokens, paper-surface/ink/surface-raised, to pick
// one universally-correct offset color) is the one non-negotiable a11y
// requirement every button variant shares; outline-none only ever pairs
// with this replacement, never used bare.
const base =
  'rounded-sm px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-not-allowed disabled:bg-paper-line disabled:text-paper-ink/70 dark:disabled:bg-surface dark:disabled:text-fg-disabled'

export const btnPrimary = `${base} bg-cta text-ink hover:bg-cta-hover disabled:hover:bg-paper-line dark:disabled:hover:bg-surface`

export const btnSecondary = `${base} border border-paper-line bg-transparent text-paper-ink hover:border-accent hover:text-accent-fg dark:border-line dark:text-fg disabled:border-paper-line disabled:hover:border-paper-line disabled:hover:text-paper-ink/70 dark:disabled:border-line dark:disabled:hover:border-line dark:disabled:hover:text-fg-disabled`

export const btnDanger = `${base} bg-danger text-white hover:bg-danger-hover`

/** Compact variant of `base` for row-level actions inside a list (Revoke,
 * Remove, Leave) -- style guide's "high-density compact actions" rule:
 * tighter padding than a standalone form button (px-3/py-1.5 vs px-4/py-2.5)
 * so a row of these doesn't read as heavier than the row's own content. */
const compactBase =
  'rounded-sm px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-not-allowed disabled:bg-paper-line disabled:text-paper-ink/70 dark:disabled:bg-surface dark:disabled:text-fg-disabled'

/** Row-level destructive trigger (ConfirmButton's resting state) -- ghost/
 * outline at rest, solid danger only on hover/focus, per the style guide's
 * "subtle danger hierarchy" rule: a list full of solid-red buttons reads as
 * alarming noise before the user has done anything destructive. Only the
 * resting trigger gets this treatment; the actual Confirm click (below)
 * stays solid since the user has already committed to the action. */
export const btnDangerGhost = `${compactBase} border border-danger/50 bg-transparent text-danger-fg hover:border-danger hover:bg-danger hover:text-white disabled:border-paper-line disabled:hover:border-paper-line disabled:hover:bg-transparent disabled:hover:text-paper-ink/70 dark:disabled:border-line dark:disabled:hover:border-line dark:disabled:hover:bg-transparent dark:disabled:hover:text-fg-disabled`

/** Compact solid danger -- same size as `btnDangerGhost` so the trigger ->
 * Confirm/Cancel swap doesn't jump in height, but solid since this is the
 * actual committed action, not a resting-state list button. */
export const btnDangerCompact = `${compactBase} bg-danger text-white hover:bg-danger-hover`

/** Fixed-size square base for an icon-only button (ConfirmButton's resting
 * trigger) -- flex-centers its one icon child. Deliberately separate from
 * `compactBase`: that one sizes around a text label via padding, which
 * doesn't combine cleanly with a fixed h/w square (no vertical centering,
 * risk of the icon overflowing the box at some zoom levels). h-9/w-9 (36px)
 * comfortably clears the WCAG 2.2 24x24 CSS px minimum target size. */
// No disabled colours here, unlike `base`: a ghost has no background to lose,
// so a fill made a disabled icon the heaviest control in its row, and a shared
// grey glyph made the same trash icon red in one row and grey in the next. Each
// variant says how it looks disabled: `iconDisabledMuted`, or for the danger
// ghost a faded red. Only `btnPrimaryIcon`, filled at rest, greys out its fill.
const iconBase =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-not-allowed'
const iconDisabledMuted = 'disabled:text-paper-ink/70 dark:disabled:text-fg-disabled'

/** Icon-only counterpart to `btnDangerGhost`, but deliberately quieter at
 * rest than `btnNeutralIconGhost` -- see the comment on the class string
 * below. Same solid-danger hover/focus fill as `btnDangerGhost`. */
// Resting state deliberately quieter than btnNeutralIconGhost's solid
// gray via a dampened border only (border-danger/30, vs. that button's
// full-opacity border) -- Delete/Revoke is the secondary action in every
// Edit+Delete pair and must recede below Edit at rest, not compete with
// it. The glyph itself stays full-opacity text-danger-fg (~4.0:1 contrast on
// both ink and paper-surface backgrounds) -- a translucent glyph (e.g.
// text-danger-fg/60) would drop below the WCAG 1.4.11 non-text-contrast floor of
// 3:1 for a graphical control, which is what --color-danger is darkened for. Hover stays
// full-strength (solid red fill, unchanged) so the destructive affordance
// is still unambiguous once actually engaged. Disabled, it stays red but
// faded (WCAG exempts inactive controls from that floor): a trash icon reads
// the same everywhere, and only its strength says whether it can be used.
export const btnDangerIconGhost = `${iconBase} border border-danger/30 bg-transparent text-danger-fg hover:border-danger hover:bg-danger hover:text-white disabled:border-danger/15 disabled:text-danger-fg/50 disabled:hover:border-danger/15 disabled:hover:bg-transparent disabled:hover:text-danger-fg/50`

/** Icon-only neutral counterpart, same shape as `btnDangerIconGhost` but
 * without the danger coloring -- for a row-level Edit trigger sharing an
 * Actions column with a Revoke/Remove/Leave `IconButton`. */
export const btnNeutralIconGhost = `${iconBase} ${iconDisabledMuted} border border-paper-line text-paper-ink hover:border-accent hover:text-accent-fg dark:border-line dark:text-fg disabled:border-paper-line disabled:hover:border-paper-line disabled:hover:text-paper-ink/70 dark:disabled:border-line dark:disabled:hover:border-line dark:disabled:hover:text-fg-disabled`

/** `btnNeutralIconGhost` lit in the branch colour: the Control center's
 * actions on a contingent inject, matching its mark on the storyline. */
export const btnBranchIconGhost = btnNeutralIconGhost.replace(
  'hover:border-accent hover:text-accent-fg',
  'hover:border-chart-2 hover:text-chart-2',
)

/** `btnNeutralIconGhost` without the frame, for an inline helper that sits
 * next to the value it acts on (copy a token) rather than in an Actions
 * column: only the icon shows until hover. */
export const btnNeutralIconBare = `${iconBase} ${iconDisabledMuted} text-paper-ink/70 hover:bg-hover hover:text-accent-fg dark:text-fg-muted dark:hover:text-accent-fg`

/** A column's fold toggle (Primary Menu, the Playground's role panel):
 * window chrome rather than an action, so icon-only and muted at rest. */
export const foldToggle =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-paper-ink/60 hover:bg-hover hover:text-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted dark:hover:text-fg'

/** Icon-only counterpart to `btnPrimary` -- for a section-header "+
 * create" trigger sharing a row with the section title. Solid CTA color
 * at rest (not ghost, unlike the neutral/danger icon buttons) -- this is
 * still the one deliberately eye-catching action per the design system's
 * "--color-cta reserved for the primary CTA" rule, just icon-sized now
 * for consistency with the row-level icon actions next to it. */
export const btnPrimaryIcon = `${iconBase} ${iconDisabledMuted} bg-cta text-ink hover:bg-cta-hover disabled:bg-paper-line disabled:hover:bg-paper-line dark:disabled:bg-surface dark:disabled:hover:bg-surface`

/** Explicit colors for a native <select>'s popup options -- a transparent
 * select leaves them to the OS, which on Windows dark mode renders light
 * text on a light list. */
export const nativeOptionColors =
  '[&>option]:bg-panel [&>option]:text-paper-ink dark:[&>option]:text-fg'

/** Shared text-input treatment -- bg/border swap per theme, accent border
 * on focus per the style guide's "focus" input state. Also used by form
 * <select>s, which is what the option colors are for. */
const fieldBase = `w-full rounded-sm border border-paper-line bg-field text-sm text-paper-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-fg disabled:cursor-not-allowed disabled:opacity-60 dark:border-line dark:text-fg ${nativeOptionColors}`

export const inputBase = `${fieldBase} px-3 py-2`

/** inputBase at control height (32px, like the ContextBar and toolbars),
 * for filter rows. Its own padding, not inputBase plus overrides: Tailwind
 * orders utilities by value, not by class order, so `py-0` after inputBase's
 * `py-2` loses and the text gets clipped. */
export const inputCompact = `${fieldBase} h-8 px-2.5 py-0`

/** Same shape as inputBase, but visually muted for a field that carries the
 * `disabled` attribute -- inputBase alone has no disabled-state styling, so
 * a disabled field would look identical to an editable one. Light
 * gets its own muted pair rather than reusing dark-only bg-surface/
 * fg-disabled unprefixed, which rendered as a near-black, barely-legible
 * box in light mode (bg-surface has a single global value, not redefined
 * under .dark, so an unprefixed class applies in both themes). */
export const inputDisabled = `${inputBase} cursor-not-allowed bg-paper-line text-paper-ink/70 dark:bg-surface dark:text-fg-disabled`

export const linkAccent = 'text-accent-fg hover:text-accent-fg-hover'

/** A floating menu or popover (dropdowns, `<details>` menus, help notes):
 * the raised surface of each theme with its text colour. `surface-raised`
 * alone is the dark one, unreadable on the light theme. */
export const floatingSurface =
  'rounded-sm border border-paper-line bg-paper-surface-raised text-paper-ink shadow-lg shadow-black/10 dark:border-line dark:bg-surface-raised dark:text-fg'

/** Shared shape for a table's trailing Actions column, always the last
 * column: header right-aligned with a fixed width sized for exactly two
 * h-9 w-9 icon buttons (Edit + Delete) plus their gap, so the column never
 * jitters in width between a row showing one button and one showing two,
 * or between tables that only ever have one. `actionsCellClass` is the
 * matching cell-content wrapper. Only for an Actions column holding
 * icon-only buttons -- a column with a full-width text button (e.g.
 * Access Requests' Approve) doesn't fit this fixed width and stays
 * auto-sized, right-aligned by its own flex wrapper instead. */
export const actionsHeaderClass = 'w-24 pb-2 text-right font-medium'
/** Same as `actionsHeaderClass`, sized for three `h-9 w-9` icon buttons. */
export const actionsHeaderWideClass = 'w-36 pb-2 text-right font-medium'
export const actionsCellClass = 'flex justify-end gap-2'
/** The same in a library table, whose rows repeat these icons dozens of
 * times: they stay visible and keep their size and colour, but only show
 * their frame on hover or focus, so the rows read as text. */
export const libraryActionsCellClass =
  'flex justify-end gap-1 [&_:is(a,button,summary):not(:hover,:focus-visible)]:border-transparent'

/** Muted "(optional)" suffix next to a field's label -- smaller and
 * secondary-colored on purpose so it never competes with the label. */
export const optionalSuffix = 'text-xs font-normal text-paper-ink/60 dark:text-fg-faint'

/* ContextBar styles. The bar has two groups with deliberately different
 * treatments:
 * - Scope (left, Organization / Exercise) reads as a breadcrumb trail of
 *   plain text: a pickable segment shows a border only on hover/focus, so
 *   the trail never looks like a row of boxes.
 * - Mode (right, Role + the Planner's Design | Execution switch) is
 *   state, so it gets a visible shape: a pill for Role, a segmented
 *   control for View.
 * Every interactive target is h-8 (32px), above the 24px WCAG minimum. */

const breadcrumbBase =
  'inline-flex h-8 min-w-0 max-w-[28rem] items-center gap-1.5 rounded-sm px-1.5 text-sm font-medium text-paper-ink dark:text-fg'

/** A scope segment with a single option -- plain text, no affordance. */
export const breadcrumbStatic = breadcrumbBase

/** Wraps a scope <select> (plus an optional logo/image) -- transparent
 * border at rest, visible on hover, accent on keyboard focus. */
export const breadcrumbSelectWrapper = `${breadcrumbBase} border border-transparent hover:border-paper-line focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-fg dark:hover:border-line dark:focus-within:border-accent`

/** The "/" between scope segments. */
export const breadcrumbSeparator = 'shrink-0 select-none text-paper-ink/30 dark:text-fg-faint'

// inline-flex so the pill can hold a leading icon plus a text node; the
// text child needs its own `truncate min-w-0`, the icon `shrink-0`.
const contextChip =
  'inline-flex h-8 max-w-[11rem] shrink-0 items-center gap-1.5 rounded-full border border-paper-line px-3 text-sm font-medium dark:border-line'

/** Wraps the Role <select> in the same pill as the static Role badge --
 * the border/hover/focus treatment lives here so the role icon can sit
 * inside the same box. */
export const chipSelectWrapper = `${contextChip} text-paper-ink hover:border-accent focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-fg dark:text-fg dark:hover:border-accent`

/** A <select> inside a wrapper above -- borderless, transparent, truncating.
 * outline-none is safe here only because the wrapper draws the focus ring
 * (focus-within). */
export const selectCompact = `min-w-0 flex-1 cursor-pointer truncate bg-transparent text-paper-ink outline-none dark:text-fg ${nativeOptionColors}`

/** Read-only Role pill (the user holds a single role). */
export const badgeNeutral = `${contextChip} text-paper-ink/80 dark:text-fg-nav`

/** Two-option mode switch (Design | Execution) -- one click, no dropdown. */
export const segmentedControl =
  'inline-flex h-8 shrink-0 items-center gap-0.5 rounded-full border border-paper-line p-0.5 dark:border-line'

const segmentedOptionBase =
  'h-full rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg motion-reduce:transition-none'

export const segmentedOptionActive = `${segmentedOptionBase} bg-paper-line text-paper-ink dark:bg-line dark:text-fg`

export const segmentedOptionIdle = `${segmentedOptionBase} text-paper-ink/60 hover:text-paper-ink dark:text-fg-muted dark:hover:text-fg`
