import { useParams } from 'react-router-dom'

import { currentContextRole, type ContextRole, type ModuleName } from '../lib/moduleAccess'
import { useAuth } from './useAuth'

/** The role the user acts as on this screen: fixed by module for
 * Admin/Creator; in Execution, their role on the exercise in the URL (or
 * the active one on an org-scoped route). Null while it can't be told. */
export function useActingRole(module: ModuleName): ContextRole | null {
  const { ttxId } = useParams<{ ttxId?: string }>()
  const { ttxList, activeTtx, executionRole } = useAuth()
  const ttx = (ttxId ? ttxList.find((item) => item.id === ttxId) : undefined) ?? activeTtx
  return currentContextRole(module, ttx ?? null, executionRole)
}
