import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

import { btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { textFaint, textPrimary } from './styles'

/** Page frame shared by every dashboard: back link, title, freshness
 * line + refresh, an optional `summary` block (e.g. the entity's identity
 * panel), then a 12-column grid (single column below `lg:`).
 * Children are KpiStrip/ChartPanel blocks; ChartPanel's `span` picks its
 * width, and a full-width child should carry `lg:col-span-12` itself. */
export function DashboardPage({
  title,
  back,
  summary,
  actions,
  updatedLabel,
  onRefresh,
  refreshLabel,
  refreshing = false,
  children,
}: {
  title: string
  back?: { to: string; label: string }
  /** Full-width block between the title row and the grid. */
  summary?: ReactNode
  /** Page-level actions at the start of the title row's right side. */
  actions?: ReactNode
  /** Already-formatted "Updated 14:05" line; omitted while loading. */
  updatedLabel?: string
  onRefresh?: () => void
  refreshLabel?: string
  refreshing?: boolean
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        {back && (
          <Link to={back.to} className={`self-start text-sm ${linkAccent}`}>
            {back.label}
          </Link>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={`text-2xl font-bold tracking-tight text-balance ${textPrimary}`}>
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            {actions}
            {updatedLabel && <span className={`text-sm ${textFaint}`}>{updatedLabel}</span>}
            {onRefresh && refreshLabel && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={refreshing}
                className={btnSecondary}
              >
                {refreshing ? <ButtonSpinner /> : refreshLabel}
              </button>
            )}
          </div>
        </div>
      </header>
      {summary}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">{children}</div>
    </div>
  )
}
