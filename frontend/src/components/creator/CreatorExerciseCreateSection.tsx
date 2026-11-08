import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { ttxOptionsForModule } from '../../lib/moduleAccess'
import { SectionHeader } from '../common/SectionHeader'
import { ExerciseForm } from './ExerciseForm'

/** Creator -> New exercise (/creator/exercises/new): the create form on
 * its own page, reached from the Exercise page's "New exercise" action or
 * the ContextBar when there's no exercise yet. On save the new exercise
 * becomes the active one and its page opens. */
export function CreatorExerciseCreateSection() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { ttxList, refresh, activeOrganizationId, setActiveTtxId } = useAuth()
  const hasExercises = ttxOptionsForModule('creator', ttxList).length > 0

  if (!activeOrganizationId) return null

  return (
    <div className="space-y-6">
      <SectionHeader title={t('creator.exercise.newExercise')} />
      <ExerciseForm
        organizationId={activeOrganizationId}
        // A new exercise has no tags of its own yet: they're copied or
        // created in the Library once it exists.
        availableTags={undefined}
        // A first exercise has nothing to go back to.
        onCancel={hasExercises ? () => navigate(-1) : undefined}
        onSaved={async (created) => {
          await refresh()
          setActiveTtxId(created.id)
          showToast(t('common.toast.savedSuccess'))
          // The needs form is the first design step (ISO 22398): start there.
          navigate(`/creator/${created.id}/needs`)
        }}
      />
    </div>
  )
}
