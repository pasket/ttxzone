import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useActiveSections } from '../../hooks/useActiveSections'
import { useDocumentAttention } from '../../hooks/useDocumentAttention'
import { useAuth } from '../../hooks/useAuth'
import { AcronymText } from '../common/AcronymText'
import { FoldIcon } from '../common/FoldIcon'
import { foldToggle } from '../../lib/buttonStyles'
import type { SectionDef, SectionGroup } from '../../lib/navSections'

import { SectionIcon } from './SectionIcon'

/** Consecutive sections of the same group, in menu order. */
function groupSections(sections: SectionDef[]): { group?: SectionGroup; sections: SectionDef[] }[] {
  const blocks: { group?: SectionGroup; sections: SectionDef[] }[] = []
  for (const s of sections) {
    const last = blocks[blocks.length - 1]
    if (last && last.group === s.group) last.sections.push(s)
    else blocks.push({ group: s.group, sections: [s] })
  }
  return blocks
}

function hrefFor(module: string, base: string, s: { path: string; orgScoped?: boolean }) {
  return s.orgScoped ? `/${module}/${s.path}` : `${base}/${s.path}`
}

/** What a section menu shows: its sections, the one the URL is on, and
 * where each links to. */
interface SectionMenu {
  sections: SectionDef[]
  activeSection: string | undefined
  linkTo: (s: SectionDef) => string
  /** By section key: the issues to fix there before it moves on (Creator). */
  pending?: Partial<Record<string, number>>
}

/** The active module's sections, as the menus link them. */
function useModuleMenu(): SectionMenu {
  const { sections, base, activeSection, module } = useActiveSections()
  const { activeTtxId } = useAuth()
  const pending = useDocumentAttention(module === 'creator' ? activeTtxId : null)
  return { sections, activeSection, linkTo: (s) => hrefFor(module, base, s), pending }
}

/** Desktop Primary Menu of the active module. */
export function PrimaryNav({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return <SectionNav collapsed={collapsed} onToggle={onToggle} {...useModuleMenu()} />
}

/** Desktop section menu -- a module's Primary Menu, or Platform's, which
 * sits above every organization. Folded (`collapsed`) it shrinks to an
 * icon rail so the page gets the width back (the layout widens its
 * content cap by the same amount); each link keeps its name as
 * accessible name and tooltip. */
export function SectionNav({
  collapsed,
  onToggle,
  sections,
  activeSection,
  linkTo,
  pending = {},
}: SectionMenu & { collapsed: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const active = sections.find((s) => s.path === activeSection)
  const blocks = groupSections(sections)
  const toggleLabel = collapsed ? t('nav.expandMenu') : t('nav.collapseMenu')
  // The rail's 40px inner width fits the 20px icon only with tighter padding.
  const itemLayout = collapsed ? 'justify-center px-2' : 'gap-3 px-3'

  return (
    <nav
      id="primary-nav"
      aria-label="Primary"
      className={`hidden shrink-0 flex-col gap-1 border-r border-paper-line p-3 transition-[width] duration-150 motion-reduce:transition-none lg:flex dark:border-line ${
        collapsed ? 'w-16' : 'w-[216px]'
      }`}
    >
      {blocks.map((block, index) => (
        // Blocks follow each other with a hairline between them, no
        // heading: the exercise's own sections first, then what the
        // organization's exercises share (Creator -> Library).
        <div key={block.group ?? index} className="flex flex-col gap-1">
          {index > 0 && (
            <hr aria-hidden="true" className="my-2 border-paper-line dark:border-line" />
          )}
          {block.sections.map((s) => {
            const isActive = s === active
            const label = t(s.titleKey)
            const waiting = pending[s.key] ?? 0
            const waitingText = waiting > 0 ? t('nav.toFix', { count: waiting }) : ''
            return (
              <Link
                key={s.key}
                to={linkTo(s)}
                aria-current={isActive ? 'page' : undefined}
                title={
                  collapsed
                    ? [label, waitingText].filter(Boolean).join(' · ')
                    : waitingText || undefined
                }
                className={`relative -ml-px flex items-center ${itemLayout} rounded-md border-l-2 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${
                  isActive
                    ? 'border-accent bg-accent/10 font-semibold text-accent-fg'
                    : 'border-transparent text-paper-ink/70 hover:bg-hover dark:text-fg-nav'
                }`}
              >
                <SectionIcon sectionKey={s.key} />
                <span className={collapsed ? 'sr-only' : 'min-w-0'}>
                  <AcronymText text={label} plain />
                </span>
                {waiting > 0 && <span className="sr-only">{waitingText}</span>}
                {waiting > 0 &&
                  (collapsed ? (
                    <span
                      aria-hidden="true"
                      className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-paper-ink/60 dark:bg-fg-muted"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="ml-auto rounded-full border border-paper-line px-1.5 text-xs font-normal tabular-nums text-paper-ink/70 dark:border-line dark:text-fg-muted"
                    >
                      {waiting}
                    </span>
                  ))}
              </Link>
            )
          })}
        </div>
      ))}
      {/* Window chrome, not a destination: icon-only, muted, under a
       * hairline at the column's foot, pinned to the viewport bottom while
       * the column (as tall as the page) runs below it. */}
      <div
        className={`sticky bottom-0 mt-auto flex border-t border-paper-line bg-paper pt-2 dark:border-line dark:bg-ink ${
          collapsed ? 'justify-center' : 'justify-end'
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-controls="primary-nav"
          aria-label={toggleLabel}
          title={toggleLabel}
          className={foldToggle}
        >
          <FoldIcon collapsed={collapsed} />
        </button>
      </div>
    </nav>
  )
}

export function MobileBottomNav() {
  return <MobileSectionNav {...useModuleMenu()} />
}

export function MobileSectionNav({ sections, activeSection, linkTo, pending = {} }: SectionMenu) {
  const { t } = useTranslation()

  return (
    <nav
      aria-label="Primary mobile"
      className="fixed inset-x-0 bottom-0 z-10 flex border-t pb-[env(safe-area-inset-bottom)] border-paper-line bg-paper-surface lg:hidden dark:border-line dark:bg-surface"
    >
      {sections.map((s) => {
        const active = s.path === activeSection
        return (
          <Link
            key={s.key}
            to={linkTo(s)}
            aria-current={active ? 'page' : undefined}
            className={`flex-1 py-3 text-center text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-fg ${
              active ? 'text-accent-fg' : 'text-paper-ink/60 dark:text-fg-nav'
            }`}
          >
            <AcronymText text={t(s.titleKey)} plain />
            {(pending[s.key] ?? 0) > 0 && (
              <>
                <span aria-hidden="true"> · {pending[s.key]}</span>
                <span className="sr-only">{t('nav.toFix', { count: pending[s.key] ?? 0 })}</span>
              </>
            )}
          </Link>
        )
      })}
    </nav>
  )
}
