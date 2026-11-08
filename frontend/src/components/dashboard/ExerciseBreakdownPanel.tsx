import { useTranslation } from 'react-i18next'

import { formatNumber, seriesColor } from '../../lib/chartTheme'
import { parseUtc } from '../../lib/dashboardTime'
import type { OrganizationDashboard } from '../../lib/types'
import { ChartPanel } from './ChartPanel'
import { DataTable } from './DataTable'
import { StackedBarList } from './StackedBarList'

const ATTENDANCE_LIMIT = 10

/** Attendees per exercise -- Players and planners as stacked bars, with a
 * table view adding injects, pending requests and creation date. Shared
 * by the Program Manager's dashboard (every exercise of the organization)
 * and Creator -> Exercises (the Planner's own); `title`/`description`/
 * `empty` say which. */
export function ExerciseBreakdownPanel({
  exercises,
  loading,
  title,
  description,
  empty,
}: {
  exercises: OrganizationDashboard['exercises']
  loading: boolean
  title: string
  description: string
  empty: string
}) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language
  const fmt = (value: number) => formatNumber(value, locale)
  const dateFmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
  const series = [
    { key: 'players', label: t('admin.dashboard.attendance.players'), color: seriesColor(0) },
    { key: 'planners', label: t('admin.dashboard.attendance.planners'), color: seriesColor(1) },
  ]

  return (
    <ChartPanel
      span="wide"
      title={title}
      description={description}
      status={loading ? 'loading' : exercises.length === 0 ? 'empty' : 'ready'}
      emptyMessage={empty}
      viewLabels={{
        chart: t('dashboard.viewChart'),
        table: t('dashboard.viewTable'),
      }}
      table={
        <DataTable
          caption={t('admin.dashboard.attendance.tableCaption')}
          rows={exercises}
          rowKey={(row) => row.ttx_id}
          columns={[
            {
              key: 'name',
              header: t('admin.dashboard.attendance.columnExercise'),
              render: (row) => row.name,
            },
            {
              key: 'players',
              header: t('admin.dashboard.attendance.players'),
              align: 'right',
              render: (row) => fmt(row.players),
            },
            {
              key: 'planners',
              header: t('admin.dashboard.attendance.planners'),
              align: 'right',
              render: (row) => fmt(row.planners),
            },
            {
              key: 'injects',
              header: t('admin.dashboard.attendance.columnInjects'),
              align: 'right',
              render: (row) => fmt(row.injects),
            },
            {
              key: 'pending',
              header: t('admin.dashboard.attendance.columnPending'),
              align: 'right',
              render: (row) => fmt(row.pending_requests),
            },
            {
              key: 'created',
              header: t('admin.dashboard.attendance.columnCreated'),
              align: 'right',
              render: (row) => dateFmt.format(parseUtc(row.created_at)),
            },
          ]}
        />
      }
    >
      <StackedBarList
        items={exercises.map((e) => ({
          id: e.ttx_id,
          label: e.name,
          values: [e.players, e.planners],
        }))}
        series={series}
        formatValue={fmt}
        totalLabel={t('admin.dashboard.attendance.total')}
        limit={ATTENDANCE_LIMIT}
        showAllLabel={t('admin.dashboard.attendance.showAll', { count: exercises.length })}
        showLessLabel={t('admin.dashboard.attendance.showLess')}
      />
    </ChartPanel>
  )
}
