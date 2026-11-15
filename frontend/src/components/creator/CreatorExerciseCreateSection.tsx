import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { linkAccent } from '../../lib/buttonStyles'
import { ttxOptionsForModule } from '../../lib/moduleAccess'
import type { ScenarioSource } from '../../lib/scenarios'
import { SectionHeader } from '../common/SectionHeader'
import { ScenarioApplyDialog } from '../templates/ScenarioDialogs'
import { TemplatePickerDialog } from '../templates/TemplatePickerDialog'
import { ExerciseForm } from './ExerciseForm'

/** Creator -> New exercise (/creator/exercises/new): the create form on
 * its own page, reached from the Exercise page's "New exercise" action or
 * the ContextBar when there's no exercise yet. On save the new exercise
 * becomes the active one and its page opens. A quieter way in: start from
 * an exercise template (the Library's, or a .ttx.md file), checked and
 * created by `ScenarioApplyDialog`. */
export function CreatorExerciseCreateSection() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { ttxList, refresh, activeOrganizationId, setActiveTtxId } = useAuth()
  const hasExercises = ttxOptionsForModule('creator', ttxList).length > 0
  const [picking, setPicking] = useState(false)
  /** On its way into a new exercise: a library template, or a file
   * (`library` undefined). */
  const [starting, setStarting] = useState<{ library?: ScenarioSource } | null>(null)

  if (!activeOrganizationId) return null

  return (
    <div className="space-y-6">
      <SectionHeader title={t('creator.exercise.newExercise')} />
      <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
        {t('creator.exercise.fromTemplate.intro')}{' '}
        <button
          type="button"
          onClick={() => setPicking(true)}
          className={`font-medium underline-offset-2 hover:underline ${linkAccent}`}
        >
          {t('creator.exercise.fromTemplate.choose')}
        </button>
        <span aria-hidden="true"> · </span>
        <button
          type="button"
          onClick={() => setStarting({})}
          className={`font-medium underline-offset-2 hover:underline ${linkAccent}`}
        >
          {t('creator.exercise.fromTemplate.import')}
        </button>
      </p>
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
      {picking && (
        <TemplatePickerDialog
          organizationId={activeOrganizationId}
          onPick={(library) => {
            setPicking(false)
            setStarting({ library })
          }}
          onClose={() => setPicking(false)}
        />
      )}
      {starting && (
        <ScenarioApplyDialog
          organizationId={activeOrganizationId}
          ttxId={null}
          library={starting.library}
          onClose={() => setStarting(null)}
        />
      )}
    </div>
  )
}
