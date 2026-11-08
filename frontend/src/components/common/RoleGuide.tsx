import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { linkAccent } from '../../lib/buttonStyles'
import { markSeen, rememberChoice, startsOpen } from '../../lib/helpText'
import type { ContextRole } from '../../lib/moduleAccess'
import { AcronymText } from './AcronymText'
import { RoleIcon } from './RoleIcon'

export interface RoleGuideItem {
  role: ContextRole
  name: string
  description: string
}

/** A section's description when it explains several roles: one intro
 * sentence, then the roles as a two-column list (icon and name | what they
 * do) behind "Show more" -- open the first time the viewer meets it,
 * folded afterwards unless they open it again (same memory as HelpText,
 * keyed by `id`). */
export function RoleGuide({
  id,
  intro,
  items,
  footnote,
}: {
  id: string
  intro: string
  items: RoleGuideItem[]
  footnote?: string
}) {
  const { t } = useTranslation()
  const listId = useId()
  const [open, setOpen] = useState(() => startsOpen(id))

  useEffect(() => {
    if (open) markSeen(id)
  }, [id, open])

  function toggle() {
    rememberChoice(id, !open)
    setOpen(!open)
  }

  return (
    <div className="space-y-3 text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
      <p>
        <AcronymText text={intro} />{' '}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={listId}
          onClick={toggle}
          className={`${linkAccent} inline-flex items-center gap-0.5 rounded-xs text-[0.8125rem] whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg`}
        >
          {open ? t('common.help.less') : t('common.help.more')}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-3 w-3 transition-transform motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </p>
      {open && (
        <div id={listId} className="space-y-2">
          <dl className="grid max-w-4xl grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[minmax(10rem,auto)_1fr]">
            {items.map((item) => (
              <div key={item.role} className="contents">
                <dt className="inline-flex items-start gap-1.5 font-medium text-paper-ink dark:text-fg">
                  <span className="mt-0.5">
                    <RoleIcon role={item.role} />
                  </span>
                  <span>
                    <AcronymText text={item.name} />
                  </span>
                </dt>
                <dd className="mb-1 sm:mb-0">
                  <AcronymText text={item.description} />
                </dd>
              </div>
            ))}
          </dl>
          {footnote && <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{footnote}</p>}
        </div>
      )}
    </div>
  )
}
