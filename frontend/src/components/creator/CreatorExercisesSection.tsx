import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { btnPrimary, btnSecondary } from '../../lib/buttonStyles'
import { formatNumber } from '../../lib/chartTheme'
import { parseUtc } from '../../lib/dashboardTime'
import { ttxOptionsForModule } from '../../lib/moduleAccess'
import type { PlannerOverview, TTXRead } from '../../lib/types'
import {
  AccessRequestsPanel,
  DashboardLoadError,
  WeeklyJoinsPanel,
} from '../common/DashboardActivityPanels'
import {
  ArchiveExerciseModal,
  DeleteExerciseModal,
  DuplicateExerciseButton,
  DuplicateExerciseModal,
  ExerciseList,
} from '../common/ExercisePortfolio'
import { DashboardPage } from '../dashboard/DashboardPage'
import { ExerciseBreakdownPanel } from '../dashboard/ExerciseBreakdownPanel'
import { KpiStrip } from '../dashboard/KpiStrip'

const mutedClass = 'text-sm text-pretty text-paper-ink/70 dark:text-fg-muted'

/** Creator -> Exercises (/creator/exercises): the organization's side of
 * the Creator, outside the exercise picked in the ContextBar -- the
 * exercises this Planner works on (open one, create one, duplicate one
 * they plan, delete one: its Lead Planner or a Program Manager), over the
 * organization's overview. */
export function CreatorExercisesSection() {
  const { t } = useTranslation()
  const { ttxList, activeOrganization } = useAuth()
  const exercises = ttxOptionsForModule('creator', ttxList)
  const [deleting, setDeleting] = useState<TTXRead | null>(null)
  const [duplicating, setDuplicating] = useState<TTXRead | null>(null)
  const [archiving, setArchiving] = useState<TTXRead | null>(null)
  // A copy is a new exercise: it takes the org-scoped Planner grant too.
  const canDuplicate = (ttx: TTXRead) => ttx.plans && !!activeOrganization?.is_planner

  const actions = (
    <Link to="/creator/exercises/new" className={btnPrimary}>
      <span aria-hidden="true">+ </span>
      {t('creator.exercises.new')}
    </Link>
  )
  const list = (
    <ExerciseList
      exercises={exercises}
      onDelete={setDeleting}
      onArchive={setArchiving}
      action={(ttx) =>
        canDuplicate(ttx) && <DuplicateExerciseButton exercise={ttx} onDuplicate={setDuplicating} />
      }
      title={t('creator.exercises.listTitle')}
      description={t('creator.exercises.intro', {
        organization: activeOrganization?.organization_name ?? '',
      })}
      empty={
        <>
          <p className={mutedClass}>{t('creator.exercises.empty')}</p>
          <Link to="/creator/exercises/new" className={btnSecondary}>
            {t('creator.exercises.new')}
          </Link>
        </>
      }
    />
  )
  const dialog = (
    <>
      {deleting && <DeleteExerciseModal exercise={deleting} onClose={() => setDeleting(null)} />}
      {archiving && (
        <ArchiveExerciseModal exercise={archiving} onClose={() => setArchiving(null)} />
      )}
      {duplicating && (
        <DuplicateExerciseModal exercise={duplicating} onClose={() => setDuplicating(null)} />
      )}
    </>
  )

  // The organization-wide overview needs an org-scoped Planner membership.
  if (!activeOrganization?.is_planner) {
    return (
      <DashboardPage title={t('creator.exercises.title')} actions={actions} summary={list}>
        {null}
        {dialog}
      </DashboardPage>
    )
  }
  return (
    <>
      <OrganizationOverview
        organizationId={activeOrganization.organization_id}
        actions={actions}
        summary={list}
      />
      {dialog}
    </>
  )
}

/** The organization's exercises at a glance (an org-scoped Planner's
 * view): how many there are and which are theirs, then the Program
 * Manager's panels over the Planner's own exercises -- attendees per
 * exercise, access requests and invitations, new access per week. */
function OrganizationOverview({
  organizationId,
  actions,
  summary,
}: {
  organizationId: string
  actions: React.ReactNode
  summary: React.ReactNode
}) {
  const { t, i18n } = useTranslation()
  const { data, loading, error, refetch } = useApiResource<PlannerOverview>(
    `/organizations/${organizationId}/planner-overview`,
  )
  const locale = i18n.language
  const fmt = (value: number) => formatNumber(value, locale)
  const title = t('creator.exercises.title')

  if (error && !data) {
    return (
      <DashboardPage title={title} actions={actions} summary={summary}>
        <DashboardLoadError onRetry={refetch} />
      </DashboardPage>
    )
  }

  return (
    <DashboardPage
      title={title}
      actions={actions}
      summary={summary}
      updatedLabel={
        data && !loading
          ? t('dashboard.updated', {
              time: new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
                parseUtc(data.generated_at),
              ),
            })
          : undefined
      }
      onRefresh={refetch}
      refreshLabel={t('dashboard.refresh')}
      refreshing={loading && data !== null}
    >
      <div className="lg:col-span-12">
        <KpiStrip
          loading={!data}
          items={[
            {
              id: 'exercises',
              label: t('creator.overview.kpis.exercises'),
              value: data ? fmt(data.exercises) : '',
              context: data
                ? t('creator.overview.kpis.recentExercises', {
                    count: data.exercises_last_30_days,
                  })
                : undefined,
            },
            {
              id: 'owned',
              label: t('creator.overview.kpis.owned'),
              value: data ? fmt(data.owned_by_you) : '',
              context: data ? t('creator.overview.kpis.ownedContext') : undefined,
            },
            {
              id: 'coPlanned',
              label: t('creator.overview.kpis.coPlanned'),
              value: data ? fmt(data.co_planned_by_you) : '',
              context: data ? t('creator.overview.kpis.coPlannedContext') : undefined,
            },
            {
              id: 'players',
              label: t('creator.overview.kpis.players'),
              value: data ? fmt(data.unique_players) : '',
              context: data ? t('creator.overview.kpis.playersContext') : undefined,
            },
            {
              id: 'planners',
              label: t('creator.overview.kpis.planners'),
              value: data ? fmt(data.planners) : '',
              context: data ? t('creator.overview.kpis.plannersContext') : undefined,
            },
          ]}
        />
      </div>

      <ExerciseBreakdownPanel
        exercises={data?.my_exercises ?? []}
        loading={!data}
        title={t('creator.overview.breakdown.title')}
        description={t('creator.overview.breakdown.description')}
        empty={t('creator.overview.breakdown.empty')}
      />

      <AccessRequestsPanel requests={data?.access_requests} invitations={data?.invitations} />

      <WeeklyJoinsPanel weeks={data?.weekly_joins ?? []} loading={!data} />
    </DashboardPage>
  )
}
