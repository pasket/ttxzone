import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { IMPROVEMENT_STATUSES } from '../../lib/aar'
import { useApiDownload } from '../../hooks/useApiDownload'
import { API_BASE, apiFetch } from '../../lib/api'
import { inputCompact, linkAccent } from '../../lib/buttonStyles'
import type { ImprovementPlanList, ImprovementStatus } from '../../lib/types'
import { RetestDialog } from '../aar/RetestDialog'
import { RetestRefCell } from '../aar/RetestRefCell'
import { CodeRef } from '../common/CodeRef'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'

const PAGE_SIZE = 50
const muted = 'text-paper-ink/60 dark:text-fg-muted'

/** Admin -> Improvement plan: every action of the organization's
 * after-action reports, soonest due first -- filtered by status, overdue
 * or text, or whether a later exercise re-tests it -- each with its
 * exercise's report as PDF and where it's re-tested (which they link
 * here). For the Program Managers, who follow the plan across exercises. */
export function AdminImprovementPlanSection() {
  const { t, i18n } = useTranslation()
  const { activeOrganizationId } = useAuth()
  const download = useApiDownload()
  const reportPath = (ttxId: string) =>
    `/ttx/${ttxId}/aar/export.pdf?lang=${i18n.language.slice(0, 2)}`
  const [status, setStatus] = useState<ImprovementStatus | ''>('')
  const [overdue, setOverdue] = useState(false)
  const [retest, setRetest] = useState<'' | 'linked' | 'unlinked'>('')
  const [retesting, setRetesting] = useState<ImprovementPlanList['items'][number] | null>(null)
  const [reload, setReload] = useState(0)
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ImprovementPlanList | null>(null)

  useEffect(() => {
    if (!activeOrganizationId) return
    let cancelled = false
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
    })
    if (status) params.set('status', status)
    if (overdue) params.set('overdue', 'true')
    if (retest) params.set('retest', retest)
    if (q.trim()) params.set('q', q.trim())
    async function load() {
      try {
        const result = await apiFetch<ImprovementPlanList>(
          `/organizations/${activeOrganizationId}/improvement-plan?${params}`,
        )
        if (!cancelled) setData(result)
      } catch {
        if (!cancelled) setData(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [activeOrganizationId, status, overdue, retest, q, page, reload])
  const planPath = `/organizations/${activeOrganizationId}/improvement-plan`

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  return (
    <div className="space-y-4">
      <SectionHeader title={t('admin.improvementPlan.title')} />
      <p className={`text-sm ${muted}`}>
        {data
          ? t('admin.improvementPlan.counts', { open: data.open, overdue: data.overdue })
          : t('common.loading')}
      </p>
      <Panel
        flush
        title={t('admin.improvementPlan.count', { count: data?.total ?? 0 })}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="plan-status">
              {t('admin.improvementPlan.status')}
            </label>
            <select
              id="plan-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as ImprovementStatus | '')
                setPage(1)
              }}
              className={`${inputCompact} w-auto max-w-56`}
            >
              <option value="">{t('admin.improvementPlan.anyStatus')}</option>
              {IMPROVEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`aar.status.${s}`)}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="plan-retest">
              {t('admin.improvementPlan.retestFilter')}
            </label>
            <select
              id="plan-retest"
              value={retest}
              onChange={(e) => {
                setRetest(e.target.value as '' | 'linked' | 'unlinked')
                setPage(1)
              }}
              className={`${inputCompact} w-auto max-w-56`}
            >
              <option value="">{t('admin.improvementPlan.anyRetest')}</option>
              <option value="linked">{t('admin.improvementPlan.retestLinked')}</option>
              <option value="unlinked">{t('admin.improvementPlan.retestUnlinked')}</option>
            </select>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={overdue}
                onChange={(e) => {
                  setOverdue(e.target.checked)
                  setPage(1)
                }}
              />
              {t('admin.improvementPlan.overdueOnly')}
            </label>
            <label className="sr-only" htmlFor="plan-search">
              {t('admin.improvementPlan.search')}
            </label>
            <input
              name="plan-search"
              autoComplete="off"
              id="plan-search"
              type="search"
              value={q}
              placeholder={t('admin.improvementPlan.searchPlaceholder')}
              onChange={(e) => {
                setQ(e.target.value)
                setPage(1)
              }}
              className={`${inputCompact} max-w-48`}
            />
          </div>
        }
        footer={
          totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          ) : undefined
        }
      >
        {!data || data.items.length === 0 ? (
          <p className={`p-6 text-center text-sm ${muted}`}>{t('admin.improvementPlan.empty')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-panel-line text-left text-xs">
                <th className="px-3 py-2">{t('admin.improvementPlan.exercise')}</th>
                <th className="px-3 py-2">{t('aar.columns.action')}</th>
                <th className="px-3 py-2">{t('aar.columns.owner')}</th>
                <th className="px-3 py-2">{t('aar.columns.due')}</th>
                <th className="px-3 py-2">{t('aar.columns.status')}</th>
                <th className="px-3 py-2">{t('aar.columns.retest')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-panel-line align-top">
                  <td className="px-3 py-2">
                    <CodeRef code={item.ttx_code} title={item.ttx_name} wrap />
                    <a
                      href={`${API_BASE}${reportPath(item.ttx_id)}`}
                      download
                      onClick={download(reportPath(item.ttx_id))}
                      className={`block text-xs ${linkAccent}`}
                    >
                      {t('admin.improvementPlan.report')}
                    </a>
                  </td>
                  <td className="px-3 py-2">
                    <CodeRef code={item.code} title={item.action || item.finding} wrap />
                  </td>
                  <td className="px-3 py-2">
                    {[item.owner, item.owner_area].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-3 py-2">
                    {item.due_date ?? '—'}
                    {item.overdue && (
                      <span className="ml-1 rounded-xs bg-danger/10 px-1 text-xs text-danger-fg">
                        {t('aar.overdue')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">{t(`aar.status.${item.status}`)}</td>
                  <td className="px-3 py-2">
                    <RetestRefCell retest={item.retest} />
                    <button
                      type="button"
                      onClick={() => setRetesting(item)}
                      className={`block text-xs ${linkAccent}`}
                      aria-label={t('aar.retest.changeLabel', { code: item.code })}
                    >
                      {item.retest ? t('aar.retest.change') : t('aar.retest.link')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {retesting && (
        <RetestDialog
          code={retesting.code}
          current={retesting.retest}
          candidatesPath={`${planPath}/${retesting.id}/retest-candidates`}
          onClose={() => setRetesting(null)}
          onSave={async (retestTtxId, retestObjectiveId) => {
            await apiFetch(`${planPath}/${retesting.id}/retest`, {
              method: 'PUT',
              body: JSON.stringify({
                retest_ttx_id: retestTtxId,
                retest_objective_id: retestObjectiveId,
              }),
            })
            setReload((n) => n + 1)
          }}
        />
      )}
    </div>
  )
}
