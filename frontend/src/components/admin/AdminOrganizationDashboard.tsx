import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { formatNumber } from '../../lib/chartTheme'
import { parseUtc, pendingKpiContext } from '../../lib/dashboardTime'
import type { OrganizationDashboard } from '../../lib/types'
import {
  AccessRequestsPanel,
  DashboardLoadError,
  WeeklyJoinsPanel,
} from '../common/DashboardActivityPanels'
import { DashboardPage } from '../dashboard/DashboardPage'
import { ExerciseBreakdownPanel } from '../dashboard/ExerciseBreakdownPanel'
import { KpiStrip } from '../dashboard/KpiStrip'

/** Admin -> Organization profile's dashboard. Composes the generic
 * dashboard primitives from one aggregate GET; every panel shares that
 * request's loading state. The caller owns authorization (it only renders
 * this for an organization the user is Program Manager of) and passes the page
 * title plus the `summary` block shown above the grid. */
export function AdminOrganizationDashboard({
  organizationId,
  title,
  summary,
}: {
  organizationId: string
  title: string
  summary?: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const { data, loading, error, refetch } = useApiResource<OrganizationDashboard>(
    `/organizations/${organizationId}/dashboard`,
  )

  const locale = i18n.language
  const fmt = (value: number) => formatNumber(value, locale)
  const updatedLabel =
    data && !loading
      ? t('dashboard.updated', {
          time: new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(
            parseUtc(data.generated_at),
          ),
        })
      : undefined

  if (error && !data) {
    return (
      <DashboardPage title={title} summary={summary}>
        <DashboardLoadError onRetry={refetch} />
      </DashboardPage>
    )
  }

  const kpis = data?.kpis
  const exercises = data?.exercises ?? []

  return (
    <DashboardPage
      title={title}
      summary={summary}
      updatedLabel={updatedLabel}
      onRefresh={refetch}
      refreshLabel={t('dashboard.refresh')}
      refreshing={loading && data !== null}
    >
      <div className="lg:col-span-12">
        <KpiStrip
          loading={!kpis}
          items={[
            {
              id: 'managers',
              label: t('admin.dashboard.kpis.planners'),
              value: kpis ? fmt(kpis.planners) : '',
              context: kpis
                ? kpis.exercise_only_planners > 0
                  ? t('admin.dashboard.kpis.exerciseOnlyPlanners', {
                      count: kpis.exercise_only_planners,
                    })
                  : t('admin.dashboard.kpis.noExerciseOnlyPlanners')
                : undefined,
            },
            {
              id: 'exercises',
              label: t('admin.dashboard.kpis.exercises'),
              value: kpis ? fmt(kpis.exercises) : '',
              context: kpis
                ? t('admin.dashboard.kpis.recentExercises', {
                    count: kpis.exercises_last_30_days,
                  })
                : undefined,
            },
            {
              id: 'players',
              label: t('admin.dashboard.kpis.players'),
              value: kpis ? fmt(kpis.unique_players) : '',
              context: kpis
                ? kpis.unique_players === 0
                  ? t('admin.dashboard.kpis.noPlayers')
                  : t('admin.dashboard.kpis.playersAverage', {
                      average: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
                        exercises.reduce((sum, e) => sum + e.players, 0) /
                          Math.max(1, exercises.length),
                      ),
                    })
                : undefined,
            },
            {
              id: 'improvement',
              label: t('admin.dashboard.kpis.improvement'),
              value: kpis ? fmt(kpis.improvement_open) : '',
              context: kpis
                ? t('admin.dashboard.kpis.improvementOverdue', {
                    count: kpis.improvement_overdue,
                  })
                : undefined,
            },
            {
              id: 'pending',
              label: t('dashboard.pending.title'),
              value: kpis ? fmt(kpis.pending_requests) : '',
              context: data
                ? pendingKpiContext(t, data.generated_at, data.kpis.oldest_pending_request_at)
                : undefined,
            },
          ]}
        />
      </div>

      <ExerciseBreakdownPanel
        exercises={exercises}
        loading={!data}
        title={t('admin.dashboard.attendance.title')}
        description={t('admin.dashboard.attendance.description')}
        empty={t('admin.dashboard.attendance.empty')}
      />

      <AccessRequestsPanel requests={data?.access_requests} invitations={data?.invitations} />

      <WeeklyJoinsPanel weeks={data?.weekly_joins ?? []} loading={!data} />
    </DashboardPage>
  )
}
