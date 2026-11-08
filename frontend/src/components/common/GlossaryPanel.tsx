import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { inputBase } from '../../lib/buttonStyles'
import { GLOSSARY_TERMS, splitAcronyms } from '../../lib/glossary'
import type { GlossaryTerm } from '../../lib/glossary'

type TermEntry = { expansion: string; description: string }

function CloseIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

/** The glossary terms that appear in the page's main content, in glossary
 * order. Re-read whenever that content changes (sections load their data
 * after the panel may already be open). */
function useTermsOnPage(): Set<GlossaryTerm> {
  const [terms, setTerms] = useState<Set<GlossaryTerm>>(() => new Set())
  useEffect(() => {
    const main = document.getElementById('main-content')
    if (!main) return
    let frame = 0
    function read() {
      frame = 0
      const found = new Set<GlossaryTerm>()
      for (const part of splitAcronyms(main!.textContent ?? '')) {
        if (typeof part !== 'string') found.add(part.term)
      }
      setTerms((previous) =>
        previous.size === found.size && [...found].every((term) => previous.has(term))
          ? previous
          : found,
      )
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(read)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(main, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])
  return terms
}

/** App-wide glossary: a non-modal side panel opened from the header's "?"
 * button (or the "?" key) by every role. Non-modal on purpose -- the page
 * stays visible and usable beside it, since the point is to read a
 * definition while looking at the field or document that uses the term.
 * Terms found in the page's main content are listed first. */
export function GlossaryPanel({
  id,
  highlight,
  onClose,
}: {
  id: string
  /** A term to scroll to and mark on open (e.g. from `?glossary=EEG`). */
  highlight?: GlossaryTerm | null
  onClose: () => void
}) {
  const { t } = useTranslation()
  const entries = t('glossary.terms', { returnObjects: true }) as Record<string, TermEntry>
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const onPage = useTermsOnPage()

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  // The page's content usually loads after the panel opens, moving the
  // highlighted term into "On this page": scroll to it again only when it
  // changes group, so later content updates never yank the list.
  const highlightOnPage = highlight !== null && highlight !== undefined && onPage.has(highlight)
  useEffect(() => {
    if (!highlight) return
    listRef.current
      ?.querySelector(`[data-term="${highlight}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [highlight, highlightOnPage])

  const normalized = query.trim().toLowerCase()
  const matches = useMemo(
    () =>
      GLOSSARY_TERMS.filter((term) => {
        if (!normalized) return true
        const entry = entries[term]
        return [term, entry?.expansion ?? '', entry?.description ?? ''].some((text) =>
          text.toLowerCase().includes(normalized),
        )
      }),
    [entries, normalized],
  )

  const groups: { key: string; label: string; terms: GlossaryTerm[] }[] = normalized
    ? [{ key: 'results', label: t('glossary.results'), terms: matches }]
    : [
        {
          key: 'page',
          label: t('glossary.onThisPage'),
          terms: GLOSSARY_TERMS.filter((term) => onPage.has(term)),
        },
        {
          key: 'all',
          label: t('glossary.allTerms'),
          terms: GLOSSARY_TERMS.filter((term) => !onPage.has(term)),
        },
      ]

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <div
      id={id}
      role="dialog"
      aria-labelledby={`${id}-title`}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-40 flex flex-col border-paper-line bg-paper-surface-raised text-paper-ink shadow-lg shadow-black/10 sm:top-20 sm:left-auto sm:w-96 sm:border-t sm:border-l dark:border-line dark:bg-surface-raised dark:text-fg dark:shadow-none"
    >
      <div className="flex items-center justify-between gap-2 border-b border-paper-line px-4 py-3 dark:border-line">
        <h2 id={`${id}-title`} className="text-balance text-base font-semibold tracking-tight">
          {t('glossary.title')}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('glossary.close')}
          title={t('glossary.close')}
          className="flex h-8 w-8 items-center justify-center rounded-sm text-paper-ink/70 hover:bg-hover hover:text-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-muted dark:hover:text-fg"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="space-y-1.5 border-b border-paper-line px-4 py-3 dark:border-line">
        <label htmlFor={`${id}-search`} className="sr-only">
          {t('glossary.searchLabel')}
        </label>
        <input
          ref={searchRef}
          id={`${id}-search`}
          name={`${id}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('glossary.searchPlaceholder')}
          autoComplete="off"
          spellCheck={false}
          className={inputBase}
        />
        <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{t('glossary.shortcutHint')}</p>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
        {normalized && matches.length === 0 ? (
          <p
            role="status"
            className="py-6 text-center text-sm text-paper-ink/70 dark:text-fg-muted"
          >
            {t('glossary.noResults', { query: query.trim() })}
          </p>
        ) : (
          groups
            .filter((group) => group.terms.length > 0)
            .map((group) => (
              <section key={group.key} aria-labelledby={`${id}-${group.key}`}>
                <h3
                  id={`${id}-${group.key}`}
                  className="text-balance pt-4 pb-1 text-xs font-medium tracking-wide text-paper-ink/60 uppercase dark:text-fg-faint"
                >
                  {group.label}
                </h3>
                <dl className="divide-y divide-paper-line dark:divide-line">
                  {group.terms.map((term) => (
                    <div
                      key={term}
                      data-term={term}
                      className={`space-y-0.5 py-2.5 ${
                        term === highlight
                          ? '-mx-2 rounded-sm border-l-2 border-accent bg-hover px-2'
                          : ''
                      }`}
                    >
                      <dt translate="no" className="font-mono text-sm font-semibold">
                        {term}
                      </dt>
                      <dd className="space-y-0.5">
                        <p className="text-sm font-medium">{entries[term]?.expansion}</p>
                        <p className="text-xs text-pretty text-paper-ink/70 dark:text-fg-muted">
                          {entries[term]?.description}
                        </p>
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))
        )}
      </div>
    </div>
  )
}
