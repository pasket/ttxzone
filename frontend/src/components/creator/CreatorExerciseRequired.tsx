import { useTranslation } from 'react-i18next'
import { Navigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { ttxOptionsForModule } from '../../lib/moduleAccess'

/** Creator -> Needs analysis / MSEL / Session plan with no exercise in
 * the URL (/creator/needs, /creator/msel, /creator/conduct-prep -- where the Primary Menu points while
 * there's no exercise in context). With an exercise to work on, it opens
 * that section of the active one; with none, it says so, the way
 * Invitations does (no second menu level; the ContextBar offers
 * "+ Create exercise"). */
export function CreatorExerciseRequired({
  section,
}: {
  section: 'needs' | 'msel' | 'conduct-prep'
}) {
  const { t } = useTranslation()
  const { ttxList, activeTtxId } = useAuth()
  const options = ttxOptionsForModule('creator', ttxList)

  if (options.length > 0) {
    const target = options.find((ttx) => ttx.id === activeTtxId) ?? options[0]
    return <Navigate to={`/creator/${target.id}/${section}`} replace />
  }
  return (
    <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
      {t(
        section === 'needs'
          ? 'creator.needs.noTtxMessage'
          : section === 'msel'
            ? 'creator.msel.noTtxMessage'
            : 'creator.conductPrep.noTtxMessage',
      )}
    </p>
  )
}
