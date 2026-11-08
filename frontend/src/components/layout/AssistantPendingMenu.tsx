import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useAssistantPending } from '../../hooks/useAssistantPending'
import { useAuth } from '../../hooks/useAuth'
import { useDisclosureMenu } from '../../hooks/useDisclosureMenu'
import { floatingSurface } from '../../lib/buttonStyles'
import { SECTION_TITLE_KEYS, type ProposalSection } from '../../lib/proposalLabels'
import { SectionIcon } from './SectionIcon'

const itemClass =
  'flex items-center justify-between gap-3 rounded-xs px-3 py-2 text-sm hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg'

/** The AI assistant's proposals waiting for the person on the exercise in
 * context, in the header beside the glossary: how many, and where -- each
 * section a link. Shown only while some wait. */
export function AssistantPendingMenu() {
  const { t } = useTranslation()
  const { activeTtxId } = useAuth()
  const counts = useAssistantPending(activeTtxId)
  const menuRef = useDisclosureMenu()
  const entries = (Object.entries(counts) as [ProposalSection, number][]).filter(
    ([, count]) => count > 0,
  )
  const total = entries.reduce((sum, [, count]) => sum + count, 0)
  if (!activeTtxId || total === 0) return null
  const label = t('assistant.headerPending', { count: total })

  return (
    <details ref={menuRef} className="relative">
      <summary
        aria-label={label}
        title={label}
        className="flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-sm px-2 text-sm font-medium text-accent-fg hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
      >
        <SectionIcon sectionKey="assistant" />
        <span aria-hidden="true" className="tabular-nums">
          {total}
        </span>
      </summary>
      <div className={`absolute right-0 z-40 mt-1 w-72 p-1 ${floatingSurface}`}>
        <p
          id="assistant-pending-where"
          className="px-3 pt-2 pb-1 text-xs text-paper-ink/60 dark:text-fg-faint"
        >
          {t('assistant.headerWhere')}
        </p>
        <ul aria-labelledby="assistant-pending-where" className="space-y-0.5">
          {entries.map(([section, count]) => (
            <li key={section}>
              <Link to={`/creator/${activeTtxId}/${section}`} className={itemClass}>
                <span>{t(SECTION_TITLE_KEYS[section])}</span>
                <span className="tabular-nums text-paper-ink/70 dark:text-fg-muted">{count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
