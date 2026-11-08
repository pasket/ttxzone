import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { currentModuleFromPath, getVisibleModules } from '../../lib/moduleAccess'

/** Keeps a typed or bookmarked URL out of a module the user can't see in
 * the active organization (e.g. a Program Manager opening /creator/...):
 * the shell would otherwise label them with a role they don't hold and
 * offer actions the backend refuses. Redirects to `/`, where Home()
 * resolves the right landing route. Same visibility rule as the menus. */
export function RequireModule({ children }: { children: ReactNode }) {
  const { activeOrganization, ttxList } = useAuth()
  const { pathname } = useLocation()

  const visible = getVisibleModules(activeOrganization, ttxList)
  if (!visible[currentModuleFromPath(pathname)]) return <Navigate to="/" replace />
  return <>{children}</>
}
