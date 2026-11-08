import type { Ref, ReactNode } from 'react'

import { btnPrimary, btnPrimaryIcon } from '../../lib/buttonStyles'
import { SectionHeader } from './SectionHeader'

function PlusIcon() {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

/** List-first, form-on-demand: collapsed by default to a single trigger
 * button, expands to the caller's form when opened. Fully controlled (no
 * internal state) so a caller like CreatorExercisesSection can drive
 * `open` from its own edit-mode logic (opening pre-populated when the
 * user clicks Edit on a row, not just from the trigger). Purely a
 * show/hide switch -- the open form brings its own container (callers wrap
 * it in a common/Panel with a Cancel/Save footer), so this adds none.
 *
 * `sectionTitle` is opt-in: without it, behavior is unchanged (a lone
 * full-width trigger button, as AdminPlannersSection/CreatorInvitationsSection
 * still use it). With it, the trigger becomes a compact "+ label" button
 * sharing one header row with the title -- title as the visual anchor on
 * the left, action at the far right, only while collapsed. */
export function CollapsibleFormSection({
  open,
  onOpenChange,
  triggerLabel,
  triggerTooltip,
  children,
  sectionTitle,
  sectionDescription,
  triggerRef,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerLabel: string
  /** Full-phrase accessible name + hover tooltip for the compact
   * `sectionTitle` trigger, e.g. "Add domain" when `triggerLabel` is just
   * the short visible "Add" -- falls back to `triggerLabel` itself so the
   * plain (no-sectionTitle) trigger below, whose full text is already
   * visible, needs no separate tooltip. Ignored on that branch. */
  triggerTooltip?: string
  children: ReactNode
  sectionTitle?: ReactNode
  /** A short plain-language explanation under the title (what this group
   * of people is for), shown whether or not the form is open. */
  sectionDescription?: ReactNode
  /** Forwarded to the trigger button so a caller can return keyboard focus
   * to it once the form closes -- the button unmounts while `open`, so a
   * plain captured DOM node would go stale across the remount; a ref
   * object stays current because React re-attaches it on every mount. */
  triggerRef?: Ref<HTMLButtonElement>
}) {
  if (sectionTitle !== undefined) {
    return (
      <div className="space-y-4">
        <SectionHeader
          title={sectionTitle}
          action={
            !open && (
              <button
                ref={triggerRef}
                type="button"
                onClick={() => onOpenChange(true)}
                aria-label={triggerTooltip ?? triggerLabel}
                title={triggerTooltip ?? triggerLabel}
                className={btnPrimaryIcon}
              >
                <PlusIcon />
              </button>
            )
          }
        />
        {sectionDescription && (
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {sectionDescription}
          </p>
        )}
        {open && children}
      </div>
    )
  }

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        onClick={() => onOpenChange(true)}
        className={`w-full max-w-sm ${btnPrimary}`}
      >
        {triggerLabel}
      </button>
    )
  }
  return <>{children}</>
}
