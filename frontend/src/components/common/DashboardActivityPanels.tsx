import { useTranslation } from 'react-i18next'

import {
  formatNumber,
  formatPercent,
  REQUEST_OUTCOME_COLORS,
  seriesColor,
} from '../../lib/chartTheme'
import { parseDay } from '../../lib/dashboardTime'
import { ChartPanel } from '../dashboard/ChartPanel'
import { GroupedColumnSeries } from '../dashboard/GroupedColumnSeries'
import { ProportionBar } from '../dashboard/ProportionBar'
import { textFaint, textPrimary } from '../dashboard/styles'

/** Domain panels shared by the Admin (organization) and Creator (exercise)
 * dashboards -- both payloads carry the same access-request, invitation
 * and weekly-join blocks, only over a different set of exercises. The
 * generic primitives stay in components/dashboard/ (props only, no i18n);
 * these map the shared payload blocks onto them. */

export interface AccessRequestCounts {
  approved: number
  pending: number
  rejected: number
}

export interface InvitationCounts {
  active: number
  revoked: number
  expired: number
  redemptions: number
}

/** "Page failed to load" panel shown in place of the whole grid. */
export function DashboardLoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <ChartPanel
      title={t('dashboard.loadErrorTitle')}
      status="error"
      errorMessage={t('dashboard.loadError')}
      onRetry={onRetry}
      retryLabel={t('dashboard.retry')}
      bodyClassName=""
    >
      {null}
    </ChartPanel>
  )
}

export function AccessRequestsPanel({
  requests,
  invitations,
  span = 'narrow',
}: {
  requests: AccessRequestCounts | undefined
  invitations: InvitationCounts | undefined
  span?: 'full' | 'wide' | 'narrow'
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const fmt = (value: number) => formatNumber(value, locale)
  const total = requests ? requests.approved + requests.pending + requests.rejected : 0

  return (
    <ChartPanel
      span={span}
      title={t('dashboard.requests.title')}
      description={t('dashboard.requests.description')}
      status={
        !requests || !invitations
          ? 'loading'
          : total === 0 && invitations.active === 0
            ? 'empty'
            : 'ready'
      }
      emptyMessage={t('dashboard.requests.empty')}
    >
      {requests && invitations && (
        <div className="flex flex-col gap-6">
          {total > 0 ? (
            <ProportionBar
              ariaLabel={t('dashboard.requests.ariaLabel', {
                approved: requests.approved,
                pending: requests.pending,
                rejected: requests.rejected,
              })}
              formatValue={fmt}
              formatShare={(share) => formatPercent(share, locale)}
              segments={(['approved', 'pending', 'rejected'] as const).map((key) => ({
                key,
                label: t(`dashboard.requests.${key}`),
                value: requests[key],
                color: REQUEST_OUTCOME_COLORS[key],
              }))}
            />
          ) : (
            <p className={`text-sm ${textFaint}`}>{t('dashboard.requests.empty')}</p>
          )}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-paper-line pt-4 dark:border-line">
            {[
              {
                key: 'active',
                label: t('dashboard.requests.activeInvitations'),
                value: invitations.active,
              },
              {
                key: 'revoked',
                label: t('dashboard.requests.revokedInvitations'),
                value: invitations.revoked,
              },
              {
                key: 'expired',
                label: t('dashboard.requests.expiredInvitations'),
                value: invitations.expired,
              },
              {
                key: 'redemptions',
                label: t('dashboard.requests.redemptions'),
                value: invitations.redemptions,
              },
            ].map((stat) => (
              <div key={stat.key} className="flex flex-col">
                <dt className={`text-xs ${textFaint}`}>{stat.label}</dt>
                <dd className={`text-base font-semibold tabular-nums ${textPrimary}`}>
                  {fmt(stat.value)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </ChartPanel>
  )
}

export function WeeklyJoinsPanel({
  weeks,
  loading,
}: {
  /** Always 12 zero-filled Monday-keyed weeks once loaded. */
  weeks: { week_start: string; players: number; team: number }[]
  loading: boolean
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const tickFmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const series = [
    { key: 'players', label: t('dashboard.joins.players'), color: seriesColor(0) },
    { key: 'team', label: t('dashboard.joins.team'), color: seriesColor(1) },
  ]

  return (
    <ChartPanel
      title={t('dashboard.joins.title')}
      description={t('dashboard.joins.description')}
      status={
        loading ? 'loading' : weeks.every((w) => w.players + w.team === 0) ? 'empty' : 'ready'
      }
      emptyMessage={t('dashboard.joins.empty')}
    >
      <GroupedColumnSeries
        series={series}
        totalLabel={t('dashboard.joins.total')}
        formatValue={(value) => formatNumber(value, locale)}
        points={weeks.map((w) => ({
          key: w.week_start,
          tickLabel: tickFmt.format(parseDay(w.week_start)),
          label: t('dashboard.joins.weekOf', { date: dateFmt.format(parseDay(w.week_start)) }),
          values: [w.players, w.team],
        }))}
      />
    </ChartPanel>
  )
}
