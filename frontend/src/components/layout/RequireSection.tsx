import type { ReactNode } from 'react'
import { Navigate, useParams } from 'react-router-dom'

import { useActingRole } from '../../hooks/useActingRole'
import type { ModuleName } from '../../lib/moduleAccess'
import { sectionsForRole, type SectionDef } from '../../lib/navSections'

/** Ensures the Primary Menu's active in-module section is always present
 * in the URL -- entering via a bare `/admin` or `/creator/:ttxId` (e.g. the
 * small module-switch links, or the post-login default redirect) lands on
 * the module's first section instead of a section-less route -- the
 * first one the acting role may see. */
export function RequireSection({
  module,
  sections,
  children,
}: {
  module: ModuleName
  sections: SectionDef[]
  children: ReactNode
}) {
  const { ttxId, section } = useParams<{ ttxId?: string; section?: string }>()
  // Only the acting role's sections: a Player sent to /evaluation lands
  // on their first section.
  const allowed = sectionsForRole(sections, useActingRole(module))

  if (section && allowed.some((s) => s.path === section)) {
    return <>{children}</>
  }

  const base = ttxId ? `/${module}/${ttxId}` : `/${module}`
  return <Navigate to={`${base}/${(allowed[0] ?? sections[0]).path}`} replace />
}
