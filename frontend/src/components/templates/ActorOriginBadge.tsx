import { useTranslation } from 'react-i18next'

import type { ActorOrigin } from '../../lib/types'

function LockIcon() {
  return (
    <svg
      className="h-3 w-3"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

/** Which level of the library an actor (or inject) belongs to -- or, for
 * a copy in an exercise, came from. Neutral chips with text -- never
 * colour alone; TTX-Zone's carries a lock: read-only, duplicate to change
 * it. `kind` picks the hint's wording. */
export function ActorOriginBadge({
  origin,
  kind = 'actors',
}: {
  origin: ActorOrigin | null
  kind?: 'actors' | 'threats' | 'injects' | 'tags' | 'scenarios'
}) {
  const { t } = useTranslation()
  const level = origin ?? 'organization'
  return (
    <span
      title={t(`templates.${kind}.origins.${level}.hint`)}
      className="inline-flex h-5 items-center gap-1 rounded-xs border border-paper-line px-1.5 text-xs font-medium whitespace-nowrap text-paper-ink/70 dark:border-line dark:text-fg-muted"
    >
      {level === 'system' && <LockIcon />}
      {t(`templates.actors.origins.${level}.label`)}
    </span>
  )
}
