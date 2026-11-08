import { Link } from 'react-router-dom'

// No negative margin to overlap the baseline: the list scrolls sideways, and
// overflow-x forces overflow-y too, so a link 1px taller than the list would
// show a vertical scrollbar. The baseline is an inset shadow instead, painted
// under the links' own bottom border; the focus ring is inset so it isn't clipped.
const base =
  'shrink-0 border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-fg'

/** A page's own sub-pages as a row of tabs under its title (Library's
 * kinds, Players' pending requests): links, so each keeps its URL. A
 * `count` shows as a neutral pill after the label (what waits there). */
export function PageTabs({
  label,
  items,
}: {
  label: string
  items: { key: string; to: string; label: string; current: boolean; count?: number }[]
}) {
  return (
    <nav aria-label={label}>
      <ul className="flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-paper-line)] dark:shadow-[inset_0_-1px_0_var(--color-line)]">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.to}
              aria-current={item.current ? 'page' : undefined}
              className={`${base} block ${
                item.current
                  ? 'border-accent font-semibold text-accent-fg'
                  : 'border-transparent text-paper-ink/70 hover:text-paper-ink dark:text-fg-nav dark:hover:text-fg'
              }`}
            >
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className="ml-1.5 rounded-full bg-paper-line px-1.5 py-0.5 text-xs font-medium text-paper-ink tabular-nums dark:bg-line dark:text-fg">
                  {item.count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
