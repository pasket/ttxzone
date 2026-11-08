import { useTranslation } from 'react-i18next'

import type { ContextRole } from '../../lib/moduleAccess'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import { RoleIcon } from './RoleIcon'

/** A role as an identity marker -- the Facilitator next to a planning and
 * control team member's name, who someone takes part as on the Player
 * landing. Same look as the Lead Planner badge: icon *and* text, brand
 * accent tint (an identity, not a status). */
export function RoleBadge({
  role,
  title,
  className = 'ml-2',
}: {
  role: ContextRole
  title?: string
  /** Spacing from what precedes it (a name, a title). */
  className?: string
}) {
  const { t } = useTranslation()
  return (
    <span
      title={title}
      className={`${className} inline-flex h-5 items-center gap-1 rounded-xs bg-accent/10 px-1.5 align-middle text-xs font-medium whitespace-nowrap text-accent-fg`}
    >
      <RoleIcon role={role} />
      {t(CONTEXT_ROLE_LABEL_KEYS[role])}
    </span>
  )
}
