import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useParams } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useEditModeParam } from '../../hooks/useEditModeParam'
import { useToast } from '../../hooks/useToast'
import { btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { initials } from '../../lib/initials'
import { ttxOptionsForModule } from '../../lib/moduleAccess'
import type { TTXRead, TTXTagListResponse } from '../../lib/types'
import { DuplicateIcon } from '../common/DuplicateIcon'
import { PencilIcon } from '../common/EditButton'
import { DuplicateExerciseModal } from '../common/ExercisePortfolio'
import { FormattedText } from '../common/FormattedText'
import { SectionHeader } from '../common/SectionHeader'
import { FlagIcon } from '../common/LeadPlannerBadge'
import { TagChip } from '../common/TagChip'
import { TlpBadge } from '../common/TlpBadge'
import { panelClass, textFaint, textPrimary, textSecondary } from '../dashboard/styles'
import { CreatorExerciseDashboard } from './CreatorExerciseDashboard'
import { ExerciseRoomsPanel } from './ExerciseRoomsPanel'
import { ExerciseTeamPanel } from './ExerciseTeamPanel'
import { ProposalsPanel } from '../assistant/ProposalsPanel'
import { exerciseRow } from '../../lib/proposals'
import { ExerciseForm } from './ExerciseForm'

/** The exercise page's identity panel: image, name, description, creation
 * date and tags, plus the Edit and Duplicate actions (omitted while
 * editing, so the band stays as read-only context above the form). */
function ExerciseIdentityBand({
  exercise,
  editButtonRef,
  onEdit,
  onDuplicate,
}: {
  exercise: TTXRead
  editButtonRef?: React.Ref<HTMLButtonElement>
  onEdit?: () => void
  onDuplicate?: () => void
}) {
  const { t, i18n } = useTranslation()
  return (
    <section
      aria-label={exercise.name}
      className={`${panelClass} flex flex-col gap-5 p-5 sm:flex-row sm:items-start sm:justify-between`}
    >
      {/* Takes the width up to the Edit action: the description reads
          across the panel instead of in a narrow column. */}
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {exercise.image_url ? (
          <img
            width={48}
            height={48}
            src={exercise.image_url}
            alt=""
            className="h-12 w-12 shrink-0 rounded-md border border-paper-line object-cover dark:border-line"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-paper-line bg-hover text-sm font-semibold dark:border-line ${textSecondary}`}
          >
            {initials(exercise.name)}
          </span>
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <p
              translate="no"
              className={`text-xl font-semibold tracking-tight wrap-anywhere ${textPrimary}`}
            >
              {exercise.name}
            </p>
            {exercise.description && (
              <FormattedText
                text={exercise.description}
                className={`text-sm wrap-anywhere ${textSecondary}`}
              />
            )}
          </div>
          <dl className="flex flex-wrap gap-x-10 gap-y-3">
            <div className="space-y-1">
              <dt className={`text-xs ${textFaint}`}>{t('creator.needs.codeLabel')}</dt>
              <dd translate="no" className={`font-mono text-sm ${textPrimary}`}>
                {exercise.code}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className={`text-xs ${textFaint}`}>{t('creator.needs.identity.needsForm')}</dt>
              <dd className="flex items-center gap-2">
                <TlpBadge tlp={exercise.tlp} />
                <Link to={`/creator/${exercise.id}/needs`} className={`text-sm ${linkAccent}`}>
                  {t(`creator.needs.status.${exercise.needs_form_status}`)}
                </Link>
              </dd>
            </div>
            {exercise.lead_planner && (
              <div className="space-y-1">
                <dt className={`text-xs ${textFaint}`}>{t('creator.planningTeam.leadBadge')}</dt>
                <dd
                  title={t('creator.planningTeam.leadDescription')}
                  className={`flex items-center gap-1.5 text-sm ${textPrimary}`}
                >
                  <span className="text-accent-fg">
                    <FlagIcon filled className="h-3.5 w-3.5" />
                  </span>
                  {exercise.lead_planner.full_name}
                </dd>
              </div>
            )}
            <div className="space-y-1">
              <dt className={`text-xs ${textFaint}`}>{t('creator.exercise.createdLabel')}</dt>
              <dd className={`text-sm tabular-nums ${textPrimary}`}>
                {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(
                  new Date(exercise.created_at),
                )}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className={`text-xs ${textFaint}`}>{t('creator.exercises.tagsLabel')}</dt>
              <dd className="flex min-h-5 flex-wrap gap-1.5">
                {exercise.tags.length === 0 && (
                  <span className={`text-sm ${textFaint}`}>{t('creator.exercise.noTags')}</span>
                )}
                {exercise.tags.map((tag) => (
                  <TagChip
                    key={tag.id}
                    name={tag.name}
                    color={tag.color}
                    customHex={tag.custom_hex}
                  />
                ))}
              </dd>
            </div>
          </dl>
        </div>
      </div>
      {(onEdit || onDuplicate) && (
        <div className="flex shrink-0 items-center gap-2">
          {onDuplicate && (
            <button
              type="button"
              onClick={onDuplicate}
              className={`${btnSecondary} inline-flex h-9 items-center gap-2 py-0`}
            >
              <DuplicateIcon />
              {t('creator.exercise.duplicate')}
            </button>
          )}
          {onEdit && (
            <button
              ref={editButtonRef}
              type="button"
              onClick={onEdit}
              className={`${btnSecondary} inline-flex h-9 items-center gap-2 py-0`}
            >
              <PencilIcon />
              {t('creator.exercise.edit')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

/** Creator -> Exercise: the profile of the exercise selected in the
 * ContextBar (never a list -- the bar already picks the one exercise in
 * play, mirroring Admin -> Organization). View mode is the identity band +
 * the exercise's dashboard. Edit swaps the dashboard for, in order: the
 * exercise form (details + which tags it carries, one Save), then the
 * panels that apply immediately -- its planning team and Evaluators. The
 * exercise's tags themselves are managed in the Library. Creating another
 * exercise is its own page. */
export function CreatorExerciseSection() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const { ttxList, refresh, activeOrganizationId, activeOrganization } = useAuth()
  const { ttxId } = useParams<{ ttxId?: string }>()
  const exercise = ttxOptionsForModule('creator', ttxList).find((ttx) => ttx.id === ttxId)
  const [duplicating, setDuplicating] = useState(false)
  // The presentation an accepted AI proposal opens the edit form with.
  const [proposed, setProposed] = useState<Partial<ReturnType<typeof exerciseRow>> | null>(null)

  const { editing, openEditing, closeEditing } = useEditModeParam()
  // The exercise's own tags, shared by the form's checkboxes and the
  // planning team members' tag picker. Only fetched while editing.
  const tagsResource = useApiResource<TTXTagListResponse>(
    editing && ttxId ? `/ttx/${ttxId}/tags?limit=200&offset=0&sort_by=name&sort_dir=asc` : null,
  )
  const availableTags = tagsResource.data?.items
  const editTriggerRef = useRef<HTMLButtonElement>(null)
  const wasEditingRef = useRef(false)

  // The Edit trigger unmounts while the form is open, so returning focus
  // to it must wait until `editing` has actually flipped back to false.
  useEffect(() => {
    if (!editing && wasEditingRef.current) editTriggerRef.current?.focus()
    wasEditingRef.current = editing
  }, [editing])

  // Not (or no longer) an exercise this user manages: let RequireTtxParam
  // pick one again.
  if (!exercise || !activeOrganizationId) return <Navigate to="/creator" replace />

  const title = t('creator.exercise.title')

  if (editing) {
    return (
      <div className="space-y-6">
        <SectionHeader title={title} />
        <ExerciseIdentityBand exercise={exercise} />
        <ExerciseForm
          exercise={exercise}
          proposed={proposed ?? undefined}
          organizationId={activeOrganizationId}
          availableTags={availableTags}
          tagsHint={
            <>
              {t('creator.exercise.tagsHint')}{' '}
              <Link to={`/creator/${exercise.id}/library/tags?tab=exercise`} className={linkAccent}>
                {t('common.manageTags')}
              </Link>
            </>
          }
          onCancel={() => {
            setProposed(null)
            closeEditing()
          }}
          onSaved={async () => {
            setProposed(null)
            // The band and the ContextBar read the exercise off ttxList.
            await refresh()
            closeEditing()
            showToast(t('common.toast.savedSuccess'))
          }}
        />
        {/* Below the form's commit point on purpose: these apply at once. */}
        <ExerciseTeamPanel ttx={exercise} availableTags={availableTags ?? []} />
        <ExerciseRoomsPanel ttx={exercise} />
      </div>
    )
  }

  return (
    <CreatorExerciseDashboard
      ttxId={exercise.id}
      title={title}
      summary={
        <>
          <ExerciseIdentityBand
            exercise={exercise}
            editButtonRef={editTriggerRef}
            onEdit={exercise.archived_at ? undefined : openEditing}
            onDuplicate={
              // A copy is a new exercise: it takes the org-scoped Planner grant too.
              exercise.plans && activeOrganization?.is_planner
                ? () => setDuplicating(true)
                : undefined
            }
          />
          {duplicating && (
            <DuplicateExerciseModal exercise={exercise} onClose={() => setDuplicating(false)} />
          )}
          {!exercise.archived_at && (
            <ProposalsPanel<ReturnType<typeof exerciseRow>>
              ttxId={exercise.id}
              targets={['ttx_meta']}
              draftRows={{ ttx_meta: [exerciseRow(exercise)] }}
              savedRows={{ ttx_meta: [exerciseRow(exercise)] }}
              codeOf={(id) => (id === exercise.id ? exercise.code : undefined)}
              merge={(group) => ({
                patch: Object.assign({}, ...group.map((p) => p.patch)),
                keys: Object.fromEntries(group.map((p) => [p.id, exercise.id])),
                conflicts: [],
                missing: [],
              })}
              apply={(patch) => {
                // Accepting opens the edit form with it, to review and save.
                setProposed(patch)
                openEditing()
              }}
              disabledReason={null}
              autoApply={['ttx_meta']}
            />
          )}
        </>
      }
    />
  )
}
