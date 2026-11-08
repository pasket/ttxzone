import { useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { DEFAULT_SORT_OPTIONS } from '../../hooks/useTableUrlState'
import type { SortBy, SortDir } from '../../lib/types'

const iconButton =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-paper-line bg-transparent text-paper-ink/70 transition-colors hover:border-accent hover:text-accent-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:border-line dark:text-fg-muted dark:hover:border-accent dark:hover:text-accent-fg'

function SortDirIcon({ sortDir }: { sortDir: SortDir }) {
  return (
    <svg
      className={`h-4 w-4 transition-transform motion-reduce:transition-none ${sortDir === 'asc' ? 'rotate-180' : ''}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  )
}

function AlphaIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <text x="2" y="12" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">
        A
      </text>
      <text x="12" y="21" fontSize="10" fontWeight="700" fill="currentColor" stroke="none">
        Z
      </text>
    </svg>
  )
}

function LoginIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 12l5 5 9-10" />
    </svg>
  )
}

function SortFieldIcon({ sortBy }: { sortBy: SortBy }) {
  if (sortBy === 'name') return <AlphaIcon />
  if (sortBy === 'last_login') return <LoginIcon />
  return <ClockIcon />
}

const SORT_FIELD_LABEL_KEY = {
  created_at: 'common.toolbar.sortFields.created_at',
  name: 'common.toolbar.sortFields.name',
  last_login: 'common.toolbar.sortFields.last_login',
} as const

/** The sort-field control: an icon button showing the current field,
 * opening a small menu of radio items that names every option up front --
 * clearer than the old one-button toggle, which only revealed the other
 * field on hover.
 * Keyboard: Arrow/Home/End move, Enter/Space pick, Escape or Tab close and
 * return focus to the trigger -- same shape as Header's avatar menu. */
function SortFieldMenu({
  sortBy,
  sortOptions,
  sortLabels,
  onSortByChange,
}: {
  sortBy: SortBy
  sortOptions: readonly SortBy[]
  sortLabels: Partial<Record<SortBy, string>>
  onSortByChange: (by: SortBy) => void
}) {
  const { t } = useTranslation()
  const menuId = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  function close() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleMenuKeyDown(event: React.KeyboardEvent) {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [],
    )
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') items[(index + 1) % items.length]?.focus()
    else if (event.key === 'ArrowUp') items[(index - 1 + items.length) % items.length]?.focus()
    else if (event.key === 'Home') items[0]?.focus()
    else if (event.key === 'End') items[items.length - 1]?.focus()
    else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      close()
      return
    } else return
    event.preventDefault()
  }

  const fieldName = (field: SortBy) => sortLabels[field] ?? t(SORT_FIELD_LABEL_KEY[field])
  const label = t('common.toolbar.sortByCurrent', { field: fieldName(sortBy) })

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        className={iconButton}
      >
        <SortFieldIcon sortBy={sortBy} />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('common.toolbar.sortBy')}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 z-20 mt-2 w-48 rounded-sm border border-paper-line bg-paper-surface-raised py-1 shadow-lg shadow-black/10 dark:border-line dark:bg-surface-raised dark:shadow-none"
        >
          <p className="px-3 pt-1 pb-1.5 text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('common.toolbar.sortBy')}
          </p>
          {sortOptions.map((option) => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === sortBy}
              tabIndex={-1}
              onClick={() => {
                if (option !== sortBy) onSortByChange(option)
                close()
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-paper-ink hover:bg-hover focus-visible:bg-hover focus-visible:outline-none dark:text-fg"
            >
              <span className="text-paper-ink/60 dark:text-fg-muted">
                <SortFieldIcon sortBy={option} />
              </span>
              <span className="flex-1">{fieldName(option)}</span>
              {option === sortBy && (
                <span className="text-accent-fg">
                  <CheckIcon />
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SearchIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

/** Compact table toolbar: sort-direction toggle, sort-field menu
 * (SortFieldMenu -- every table picks its field from it), and a debounced
 * search input. Replaces SortToggle's two
 * full-size text buttons, which read as too visually heavy for a secondary
 * list control -- matches the h-9 w-9 ghost-at-rest icon convention already
 * used by IconButton and CollapsibleFormSection's trigger. Purely
 * controlled: every screen that uses this owns sortDir/sortBy/search state
 * itself (server-paginated screens thread them into their fetch's query
 * string; EnrollmentsSection's two lists filter/sort them client-side) --
 * this component only renders the controls and reports changes.
 * `sortOptions` lists the fields the table can sort by (default: date and
 * name), picked from SortFieldMenu; `sortLabels` renames a field where the
 * generic label doesn't fit that table (e.g. "name" sorts invitations by
 * description, allowed domains by domain). */
export function TableToolbar({
  sortDir,
  sortBy,
  onSortDirChange,
  onSortByChange,
  search,
  onSearchChange,
  sortOptions = DEFAULT_SORT_OPTIONS,
  sortLabels = {},
}: {
  sortDir: SortDir
  sortBy: SortBy
  onSortDirChange: (dir: SortDir) => void
  onSortByChange: (by: SortBy) => void
  search: string
  onSearchChange: (q: string) => void
  sortOptions?: readonly SortBy[]
  sortLabels?: Partial<Record<SortBy, string>>
}) {
  const { t } = useTranslation()
  const searchInputId = useId()
  const [rawSearch, setRawSearch] = useState(search)

  // Mirror an externally-driven `search` change back into the uncommitted
  // input (React's documented "adjust state during render" pattern) so the
  // two can never drift apart and make the debounce below echo a stale
  // local value back at the parent.
  const [lastSearch, setLastSearch] = useState(search)
  if (search !== lastSearch) {
    setLastSearch(search)
    setRawSearch(search)
  }

  // onSearchChange is deliberately kept OUT of the debounce effect's
  // dependency array, via a ref: five of the six screens using this toolbar
  // pass a plain (non-memoized) handler, so a new identity on every parent
  // re-render would tear down and re-arm the 300ms timer indefinitely and
  // eventually fire it for a value the user never typed. Every such handler
  // does `setSearch(v); setPage(1)`, so that spuriously reset pagination.
  // A shared component's own re-render side effect must not depend on all
  // six consumers memoizing their callbacks correctly.
  const onSearchChangeRef = useRef(onSearchChange)
  useEffect(() => {
    onSearchChangeRef.current = onSearchChange
  })

  // The `rawSearch === search` guard means a call is only ever scheduled for
  // a value the parent has not already committed -- which also covers the
  // mount-time case, since rawSearch is seeded from search.
  useEffect(() => {
    if (rawSearch === search) return
    const timer = setTimeout(() => onSearchChangeRef.current(rawSearch), 300)
    return () => clearTimeout(timer)
  }, [rawSearch, search])

  // Labels name what the click will do, not the current state.
  const dirLabel = {
    created_at:
      sortDir === 'desc' ? t('common.toolbar.setOldestFirst') : t('common.toolbar.setNewestFirst'),
    name: sortDir === 'desc' ? t('common.toolbar.setAToZ') : t('common.toolbar.setZToA'),
    last_login:
      sortDir === 'desc'
        ? t('common.toolbar.setLeastRecentLoginFirst')
        : t('common.toolbar.setMostRecentLoginFirst'),
  }[sortBy]

  return (
    <div className="inline-flex items-center gap-2">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2 text-paper-ink/40 dark:text-fg-faint">
          <SearchIcon />
        </span>
        <label htmlFor={searchInputId} className="sr-only">
          {t('common.toolbar.searchLabel')}
        </label>
        <input
          name="q"
          autoComplete="off"
          id={searchInputId}
          type="search"
          value={rawSearch}
          onChange={(e) => setRawSearch(e.target.value)}
          placeholder={t('common.toolbar.searchPlaceholder')}
          // Mirrors the backend's own `q` cap (Query(None, max_length=200)
          // on all five paginated list endpoints) client-side, the same way
          // CreatorInvitationsSection caps its expires_at input -- without
          // it a longer query reaches the API as an uncaught 422.
          maxLength={200}
          className="w-40 rounded-sm border border-paper-line bg-field py-1.5 pl-8 pr-2 text-sm text-paper-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent-fg dark:border-line dark:text-fg sm:w-56"
        />
      </div>
      <SortFieldMenu
        sortBy={sortBy}
        sortOptions={sortOptions}
        sortLabels={sortLabels}
        onSortByChange={onSortByChange}
      />
      <button
        type="button"
        onClick={() => onSortDirChange(sortDir === 'desc' ? 'asc' : 'desc')}
        aria-label={dirLabel}
        title={dirLabel}
        className={iconButton}
      >
        <SortDirIcon sortDir={sortDir} />
      </button>
    </div>
  )
}
