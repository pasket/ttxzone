import type { ReactNode, Ref } from 'react'

/** Single, app-wide section-header shape: large bold title left, optional
 * action (a compact create-button, typically) at the far right. Reused by
 * CollapsibleFormSection's `sectionTitle` branch and by any screen whose
 * heading has no associated form to collapse. It is the page's title, so
 * it renders an h1 by default (Panel titles below it are h2); `level={2}`
 * is for the rare use nested inside a page that already has its own h1. */
export function SectionHeader({
  title,
  action,
  level = 1,
  headingRef,
}: {
  title: ReactNode
  action?: ReactNode
  level?: 1 | 2
  /** For a page that moves the focus to its title once it changes under
   * the user (a document just started): the heading then takes focus. */
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const Heading = level === 1 ? 'h1' : 'h2'
  return (
    <div className="flex items-center justify-between gap-4">
      <Heading
        ref={headingRef}
        tabIndex={headingRef ? -1 : undefined}
        className="text-2xl font-bold tracking-tight text-balance text-paper-ink focus:outline-none dark:text-fg"
      >
        {title}
      </Heading>
      {action}
    </div>
  )
}
