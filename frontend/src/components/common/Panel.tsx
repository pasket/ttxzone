import { Children, useId, type ReactNode } from 'react'

import { panelClass, panelDivider } from '../../lib/panelStyles'

/** One object on the page -- a list, a form, a settings group -- as a
 * tonally lifted, hairline-bordered surface split into up to three bands:
 *
 * - header: `title` + `description` on the left (or just `meta`, e.g. a
 *   list's item count, when the page title outside already names it),
 *   `aside` on the right (a status badge, a list's search/sort toolbar);
 * - body: padded by default, `flush` for a table that runs edge to edge;
 * - footer: `footer` (a form's Cancel/Save row, a list's pagination).
 *
 * Renders a <section> labelled by its title when it has one; pass
 * `label` for an untitled panel so it still gets an accessible name. */
export function Panel({
  eyebrow,
  title,
  description,
  meta,
  aside,
  footer,
  flush = false,
  label,
  className = '',
  titleClassName = 'text-base',
  children,
}: {
  /** A line above the title (outside the heading): e.g. a record's number
   * with controls to step to its neighbours. */
  eyebrow?: ReactNode
  title?: ReactNode
  description?: ReactNode
  meta?: ReactNode
  aside?: ReactNode
  footer?: ReactNode
  flush?: boolean
  label?: string
  className?: string
  /** The title's size (and anything else that sets it apart). */
  titleClassName?: string
  children: ReactNode
}) {
  const headingId = useId()
  const hasHeader = title !== undefined || meta !== undefined || aside !== undefined

  return (
    <section
      aria-labelledby={title !== undefined ? headingId : undefined}
      aria-label={title === undefined ? label : undefined}
      className={`${panelClass} ${className}`}
    >
      {hasHeader && (
        <header className={`space-y-1 border-b px-5 py-4 ${panelDivider}`}>
          {/* Title (or meta) and aside share the top row; the description
              runs underneath across the whole panel, not beside the aside. */}
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1 space-y-1">
              {eyebrow !== undefined && <div>{eyebrow}</div>}
              {title !== undefined && (
                <h2
                  id={headingId}
                  className={`${titleClassName} font-semibold text-balance text-paper-ink dark:text-fg`}
                >
                  {title}
                </h2>
              )}
              {meta !== undefined && (
                <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{meta}</p>
              )}
            </div>
            {aside !== undefined && <div className="max-w-full shrink-0">{aside}</div>}
          </div>
          {description !== undefined && (
            // A div: a description can hold more than a sentence (RoleGuide).
            <div className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
              {description}
            </div>
          )}
        </header>
      )}
      {/* A body with nothing in it (`{open && …}` while closed) would
          leave an empty padded band between header and footer. */}
      {Children.toArray(children).length > 0 && (
        <div className={flush ? '' : 'space-y-5 px-5 py-5'}>{children}</div>
      )}
      {footer !== undefined && (
        <footer className={`border-t px-5 py-3 ${panelDivider}`}>{footer}</footer>
      )}
    </section>
  )
}
