import { Navigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { ttxOptionsForModule } from '../../lib/moduleAccess'

/** Creator -> Exercise with no exercise selected (/creator/exercise).
 * Someone who manages an exercise is sent on to that exercise's page;
 * anyone else to Creator -> Exercises, where exercises are created. */
export function CreatorNoExerciseSection() {
  const { ttxList, activeTtxId } = useAuth()
  const options = ttxOptionsForModule('creator', ttxList)

  if (options.length > 0) {
    const target = options.find((ttx) => ttx.id === activeTtxId) ?? options[0]
    return <Navigate to={`/creator/${target.id}/exercise`} replace />
  }
  return <Navigate to="/creator/exercises" replace />
}
