import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { apiFetch } from '../../lib/api'
import { formatSpan } from '../../lib/msel'
import type { RunSummary } from '../../lib/types'
import { Panel } from '../common/Panel'
import { FeedbackResults } from './FeedbackResults'
import { RunDownloads } from './RunDownloads'

const muted = 'text-paper-ink/60 dark:text-fg-muted'
const heading = 'text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-muted'
const LEVELS = ['P', 'S', 'M', 'U'] as const

/** One key figure: the number large, what it counts under it, and only the
 * parts of the breakdown that aren't zero. */
function Figure({ value, label, detail }: { value: ReactNode; label: string; detail: string[] }) {
  return (
    <div className="flex flex-col rounded-sm border border-panel-line px-3 py-2.5">
      <dt className="order-2 text-xs">{label}</dt>
      <dd className="order-1 font-mono text-xl font-semibold tabular-nums">{value}</dd>
      {detail.length > 0 && (
        <dd className={`order-3 mt-0.5 text-xs ${muted}`}>{detail.join(' · ')}</dd>
      )}
    </div>
  )
}

/** A thin bar filled to `share` (0..1). */
function Bar({ share, className }: { share: number; className: string }) {
  return (
    <div
      aria-hidden="true"
      className="h-1.5 overflow-hidden rounded-full bg-paper-line dark:bg-line"
    >
      <div className={`h-full ${className}`} style={{ width: `${Math.min(1, share) * 100}%` }} />
    </div>
  )
}

/** How the session went, read top-down: the key figures (mandatory injects
 * out, expected actions marked, key questions asked, the team's notes),
 * the evaluation (ratings by level, each Evaluator's progress), what was
 * skipped and why, the participants' feedback once it's over, and the
 * dated steps after it (the plan's calendar). The exports sit in the
 * footer. For the Controllers, Planners and Lead Evaluator; renders
 * nothing for anyone else. */
export function SessionSummaryPanel({ ttxId, seq }: { ttxId: string; seq: number }) {
  const { t, i18n } = useTranslation()
  const [summary, setSummary] = useState<RunSummary | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await apiFetch<RunSummary>(`/ttx/${ttxId}/run/summary`)
        if (!cancelled) setSummary(result)
      } catch {
        if (!cancelled) setSummary(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId, seq])

  if (!summary) return null
  const mandatory = summary.injects.filter((i) => i.kind === 'mandatory')
  const of = (rows: RunSummary['injects'], state: string) =>
    rows.filter((i) => i.state === state).length
  const contingent = summary.injects.filter((i) => i.kind === 'contingent')
  const skipped = summary.injects.filter((i) => i.state === 'skipped')
  const fired = of(contingent, 'released')
  const notReached = of(mandatory, 'pending')
  const { observed, partial, not_observed: missed, unmarked } = summary.actions
  const marked = observed + partial + missed
  const rated = LEVELS.reduce((sum, level) => sum + summary.levels[level], 0)
  const nonZero = (parts: [number, string][]) =>
    parts.filter(([n]) => n > 0).map(([, text]) => text)
  const day = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'UTC' })

  return (
    <Panel
      title={t('playground.summary.title')}
      meta={t('playground.summary.playedFor', { time: formatSpan(summary.played_minutes) })}
      footer={<RunDownloads ttxId={ttxId} />}
    >
      <div className="@container space-y-6 text-sm">
        {summary.stop_reason && (
          <p className="text-danger-fg">
            {t('playground.state.stopped')}: {summary.stop_reason}
          </p>
        )}

        <dl className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
          <Figure
            value={`${of(mandatory, 'released')}/${mandatory.length}`}
            label={t('playground.summary.injectsOut')}
            detail={nonZero([
              [fired, t('playground.summary.contingentFired', { count: fired })],
              [skipped.length, t('playground.summary.skippedCount', { count: skipped.length })],
              [notReached, t('playground.summary.notReached', { count: notReached })],
            ])}
          />
          <Figure
            value={`${marked}/${marked + unmarked}`}
            label={t('playground.summary.actionsMarked')}
            detail={nonZero([
              [observed, t('playground.summary.observed', { count: observed })],
              [partial, t('playground.summary.partial', { count: partial })],
              [missed, t('playground.summary.missed', { count: missed })],
            ])}
          />
          <Figure
            value={summary.questions_asked}
            label={t('playground.summary.questions')}
            detail={nonZero([
              [
                summary.questions_covered,
                t('playground.summary.covered', { count: summary.questions_covered }),
              ],
            ])}
          />
          <Figure
            value={summary.team_notes}
            label={t('playground.summary.teamNotes')}
            detail={[]}
          />
        </dl>

        {(rated > 0 || summary.ratings.length > 0) && (
          <section aria-label={t('playground.summary.evaluation')} className="space-y-3">
            <h3 className={heading}>{t('playground.summary.evaluation')}</h3>
            {rated > 0 && (
              <ul className="grid grid-cols-2 gap-x-4 gap-y-3 @lg:grid-cols-4">
                {LEVELS.map((level) => (
                  <li key={level} className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span translate="no" className="font-mono font-semibold">
                        {level}
                      </span>
                      <span className="font-mono tabular-nums">{summary.levels[level]}</span>
                    </div>
                    <Bar share={summary.levels[level] / rated} className="bg-accent" />
                    <p
                      className={`text-xs ${muted}`}
                      title={t(`creator.needs.outputs.ratings.${level}`)}
                    >
                      {t(`playground.summary.levelNames.${level}`)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {summary.ratings.length > 0 && (
              <div className="space-y-2">
                <p className={`text-xs ${muted}`}>{t('playground.summary.byEvaluator')}</p>
                <ul aria-label={t('playground.summary.byEvaluator')} className="space-y-2">
                  {summary.ratings.map((evaluator) => (
                    <li
                      key={evaluator.name}
                      className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3"
                    >
                      <span className="truncate" title={evaluator.name}>
                        {evaluator.name}
                      </span>
                      <Bar
                        share={evaluator.total ? evaluator.rated / evaluator.total : 0}
                        className="bg-success"
                      />
                      <span className={`font-mono text-xs tabular-nums ${muted}`}>
                        <span aria-hidden="true">
                          {evaluator.rated}/{evaluator.total}
                        </span>
                        <span className="sr-only">
                          {t('playground.evaluation.progress', {
                            rated: evaluator.rated,
                            total: evaluator.total,
                          })}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {skipped.length > 0 && (
          <section aria-label={t('playground.summary.skipped')} className="space-y-2">
            <h3 className={heading}>{t('playground.summary.skipped')}</h3>
            <ul className="space-y-1">
              {skipped.map((inject) => (
                <li key={inject.code}>
                  <span translate="no" className="font-mono">
                    {inject.code}
                  </span>{' '}
                  {inject.title}
                  {inject.reason && <span className={muted}> — {inject.reason}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {(summary.state === 'ended' || summary.state === 'stopped') && (
          <FeedbackResults ttxId={ttxId} seq={seq} />
        )}

        {summary.milestones.length > 0 && (
          <section aria-label={t('playground.summary.next')} className="space-y-2">
            <h3 className={heading}>{t('playground.summary.next')}</h3>
            <ol className="space-y-1.5">
              {summary.milestones.map((milestone) => (
                <li key={milestone.key} className="flex gap-3">
                  <span className={`w-28 shrink-0 tabular-nums ${muted}`}>
                    {day.format(new Date(milestone.on))}
                  </span>
                  <span>{t(`playground.summary.milestones.${milestone.key}`)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </Panel>
  )
}
