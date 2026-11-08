import { useEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useParams } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { ttxOptionsForModule } from '../../lib/moduleAccess'

/** Creator/Control/Execution are TTX-scoped -- entering via a bare
 * /creator, /control or /playground link (e.g. the Primary Menu) redirects to the first
 * qualifying TTX so the URL always holds an active ttx_id once inside. */
export function RequireTtxParam({
  module,
  children,
}: {
  module: 'creator' | 'control' | 'playground'
  children: ReactNode
}) {
  const { t } = useTranslation()
  const { ttxList, activeTtxId, followTtx } = useAuth()
  const { ttxId } = useParams<{ ttxId?: string }>()

  // The URL's exercise is the context: opened from a link, a bookmark or a
  // reload, it may belong to another org than the active one.
  useEffect(() => {
    if (ttxId && ttxId !== activeTtxId) followTtx(ttxId)
  }, [ttxId, activeTtxId, followTtx])

  if (ttxId) return <>{children}</>

  const options = ttxOptionsForModule(module, ttxList)
  // A Planner with no exercise yet gets the organization overview.
  if (options.length === 0 && module === 'creator') {
    return <Navigate to="/creator/exercise" replace />
  }
  if (options.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-paper-ink/60 dark:text-fg-muted">
        {t('nav.noTtxAvailable')}
      </div>
    )
  }

  return <Navigate to={`/${module}/${options[0].id}`} replace />
}
