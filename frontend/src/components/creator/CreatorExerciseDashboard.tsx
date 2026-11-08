import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { formatNumber, REQUEST_OUTCOME_COLORS } from '../../lib/chartTheme'
import { parseUtc, pendingKpiContext } from '../../lib/dashboardTime'
import { ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type { TTXDashboard } from '../../lib/types'
import {
  AccessRequestsPanel,
  DashboardLoadError,
  WeeklyJoinsPanel,
} from '../common/DashboardActivityPanels'
import { ChartPanel } from '../dashboard/ChartPanel'
import { DashboardPage } from '../dashboard/DashboardPage'
import { DataTable } from '../dashboard/DataTable'
import { KpiStrip } from '../dashboard/KpiStrip'
import { StackedBarList } from '../dashboard/StackedBarList'

const INVITATION_LIMIT = 8

const STATUS_LABEL_KEYS = {
  active: 'creator.dashboard.invitations.statusActive',
  revoked: 'creator.dashboard.invitations.statusRevoked',
  expired: 'creator.dashboard.invitations.statusExpired',
} as const

/** Creator -> Exercise's dashboard: the active exercise's aggregates from
 * one GET, mapped onto the generic dashboard primitives. Same shape as
 * AdminOrganizationDashboard; the caller passes the title, the identity
 * `summary` above the grid and any page-level `actions`. */
export function CreatorExerciseDashboard({
  ttxId,
  title,
  summary,
  actions,
}: {
  ttxId: string
  title: string
  summary?: ReactNode
  actions?: ReactNode
}) {
  const { t, i18n } = useTranslation()
  const { data, loading, error, refetch } = useApiResource<TTXDashboard>(`/ttx/${ttxId}/dashboard`)

  const locale = i18n.language
  const fmt = (value: number) => formatNumber(value, locale)
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })

  if (error && !data) {
    return (
      <DashboardPage title={title} summary={summary} actions={actions}>
        <DashboardLoadError onRetry={refetch} />
      </DashboardPage>
    )
  }

  const kpis = data?.kpis
  const invitations = data?.invitation_breakdown ?? []
  const invitationLabel = (item: TTXDashboard['invitation_breakdown'][number]) =>
    item.description ||
    t('creator.dashboard.invitations.untitled', {
      role: t(ROLE_LABEL_KEYS[item.role]),
      date: dateFmt.format(parseUtc(item.created_at)),
    })
  const outcomeSeries = (['approved', 'pending', 'rejected'] as const).map((key) => ({
    key,
    label: t(`dashboard.requests.${key}`),
    color: REQUEST_OUTCOME_COLORS[key],
  }))

  return (
    <DashboardPage
      title={title}
      summary={summary}
      actions={actions}
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
          loading={!kpis}
          items={[
            {
              id: 'players',
              label: t('creator.dashboard.kpis.players'),
              value: kpis ? fmt(kpis.players) : '',
              context: data
                ? t('creator.dashboard.kpis.activeInvitations', {
                    count: data.invitations.active,
                  })
                : undefined,
            },
            {
              id: 'managers',
              label: t('creator.dashboard.kpis.planners'),
              value: kpis ? fmt(kpis.planners) : '',
              context: kpis
                ? kpis.planners > 1
                  ? t('creator.dashboard.kpis.coPlanners', { count: kpis.planners - 1 })
                  : t('creator.dashboard.kpis.noCoPlanners')
                : undefined,
            },
            {
              id: 'injects',
              label: t('creator.dashboard.kpis.injects'),
              value: kpis ? fmt(kpis.injects) : '',
              context: kpis
                ? kpis.injects === 0
                  ? t('creator.dashboard.kpis.noInjects')
                  : t('creator.dashboard.kpis.injectsContext')
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

      <ChartPanel
        span="wide"
        title={t('creator.dashboard.invitations.title')}
        description={t('creator.dashboard.invitations.description')}
        status={!data ? 'loading' : invitations.length === 0 ? 'empty' : 'ready'}
        emptyMessage={t('creator.dashboard.invitations.empty')}
        viewLabels={{ chart: t('dashboard.viewChart'), table: t('dashboard.viewTable') }}
        table={
          <DataTable
            caption={t('creator.dashboard.invitations.tableCaption')}
            rows={invitations}
            rowKey={(row) => row.token_id}
            columns={[
              {
                key: 'invitation',
                header: t('creator.dashboard.invitations.columnInvitation'),
                render: invitationLabel,
              },
              {
                key: 'role',
                header: t('creator.dashboard.invitations.columnRole'),
                render: (row) => t(ROLE_LABEL_KEYS[row.role]),
              },
              {
                key: 'status',
                header: t('creator.dashboard.invitations.columnStatus'),
                render: (row) => t(STATUS_LABEL_KEYS[row.status]),
              },
              {
                key: 'redemptions',
                header: t('dashboard.requests.redemptions'),
                align: 'right',
                render: (row) => fmt(row.redemptions),
              },
              ...outcomeSeries.map((s) => ({
                key: s.key,
                header: s.label,
                align: 'right' as const,
                render: (row: TTXDashboard['invitation_breakdown'][number]) => fmt(row[s.key]),
              })),
            ]}
          />
        }
      >
        <StackedBarList
          items={invitations.map((item) => ({
            id: item.token_id,
            label: invitationLabel(item),
            values: [item.approved, item.pending, item.rejected],
          }))}
          series={outcomeSeries}
          formatValue={fmt}
          totalLabel={t('creator.dashboard.invitations.total')}
          limit={INVITATION_LIMIT}
          showAllLabel={t('creator.dashboard.invitations.showAll', { count: invitations.length })}
          showLessLabel={t('creator.dashboard.invitations.showLess')}
        />
      </ChartPanel>

      <AccessRequestsPanel requests={data?.access_requests} invitations={data?.invitations} />

      <WeeklyJoinsPanel weeks={data?.weekly_joins ?? []} loading={!data} />
    </DashboardPage>
  )
}
