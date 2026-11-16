import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { usePlaceName } from '../../hooks/usePlaceName'
import { useStageRoom } from '../../hooks/useViewedRoom'
import { ApiError, apiFetch } from '../../lib/api'
import {
  inputBase,
  linkAccent,
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../lib/buttonStyles'
import { inPlayAt } from '../../lib/run'
import type { RatingLevel, RunEvaluation, RunPoint, RunRead } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'
import { Panel } from '../common/Panel'
import { DecisionItem } from './DecisionLog'

const LEVELS: RatingLevel[] = ['P', 'S', 'M', 'U']
const MARK_KEYS = {
  observed: 'playground.control.marks.observed',
  partial: 'playground.control.marks.partial',
  not_observed: 'playground.control.marks.notObserved',
} as const

/** The Evaluator's live EEG: the observation points they rate (those of
 * the inject in play first, or all of theirs), each with what every level
 * means for it, what the Controller saw of its expected action, a P/S/M/U
 * pick and why. Refreshed as the session moves; ratings can still be
 * written once it's over. */
export function EvaluationPanel({ ttxId, run }: { ttxId: string; run: RunRead }) {
  const { t } = useTranslation()
  const [evaluation, setEvaluation] = useState<RunEvaluation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [scope, setScope] = useState<'inPlay' | 'all'>('inPlay')
  const started = run.state !== 'not_started'
  // In rooms each place is rated on its own: the one in view.
  const where = useStageRoom(run.rooms)
  const place = usePlaceName(run)(where)

  useEffect(() => {
    if (!started) return
    let cancelled = false
    async function load() {
      try {
        const scope = where ? `?room=${where}` : ''
        const result = await apiFetch<RunEvaluation>(`/ttx/${ttxId}/run/evaluation${scope}`)
        if (!cancelled) setEvaluation(result)
      } catch (err) {
        if (!cancelled) setError(err instanceof ApiError ? err.message : String(err))
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [ttxId, started, run.seq, where])

  async function rate(point: RunPoint, level: RatingLevel | null, rationale: string) {
    setError(null)
    try {
      setEvaluation(
        await apiFetch<RunEvaluation>(`/ttx/${ttxId}/run/ratings/${point.id}`, {
          method: 'PUT',
          body: JSON.stringify({ level, rationale, room_code: where ?? undefined }),
        }),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    }
  }

  const inPlay = inPlayAt(run, where)?.code ?? null
  const shown = (evaluation?.objectives ?? [])
    .map((objective) => ({
      ...objective,
      points:
        scope === 'all'
          ? objective.points
          : objective.points.filter((p) => p.inject_code === inPlay),
    }))
    .filter((objective) => objective.points.length > 0)

  // What the table decided on what is rated: the evidence for the points.
  const decided = (run.decisions ?? []).filter(
    (decision) =>
      (where === null || decision.room_code === where) &&
      (scope === 'all' || decision.inject_code === inPlay),
  )

  return (
    <Panel
      title={t('playground.evaluation.title')}
      meta={
        evaluation
          ? [
              place,
              t('playground.evaluation.progress', {
                rated: evaluation.rated,
                total: evaluation.total,
              }),
            ]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
    >
      {!started ? (
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.evaluation.notStarted')}
        </p>
      ) : !evaluation ? (
        <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
          {error ?? t('common.loading')}
        </p>
      ) : (
        <div className="space-y-4">
          <div
            role="progressbar"
            aria-label={t('playground.evaluation.progressLabel')}
            aria-valuemin={0}
            aria-valuemax={evaluation.total}
            aria-valuenow={evaluation.rated}
            className="h-1.5 overflow-hidden rounded-full bg-paper-line dark:bg-line"
          >
            <div
              className="h-full bg-success"
              style={{
                width: `${evaluation.total ? (evaluation.rated / evaluation.total) * 100 : 0}%`,
              }}
            />
          </div>
          <div
            className={segmentedControl}
            role="group"
            aria-label={t('playground.evaluation.scope')}
          >
            {(['inPlay', 'all'] as const).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={scope === key}
                onClick={() => setScope(key)}
                className={scope === key ? segmentedOptionActive : segmentedOptionIdle}
              >
                {key === 'inPlay'
                  ? t('playground.evaluation.inPlay', { code: inPlay ?? '—' })
                  : t('playground.evaluation.all')}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
          {shown.length === 0 ? (
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t(
                scope === 'inPlay'
                  ? 'playground.evaluation.noneInPlay'
                  : 'playground.evaluation.noneAssigned',
              )}{' '}
              {scope === 'inPlay' && (
                <button type="button" onClick={() => setScope('all')} className={linkAccent}>
                  {t('playground.evaluation.showAll')}
                </button>
              )}
            </p>
          ) : (
            shown.map((objective) => (
              <ObjectivePoints
                key={`${scope}-${objective.id}`}
                code={objective.code}
                title={objective.title || objective.statement}
                rated={objective.points.filter((point) => point.rating).length}
                total={objective.points.length}
                foldable={scope === 'all'}
              >
                {objective.points.map((point) => (
                  <PointRow key={`${where}-${point.id}`} point={point} onRate={rate} />
                ))}
              </ObjectivePoints>
            ))
          )}
          {decided.length > 0 && (
            <section aria-label={t('playground.evaluation.decisions')} className="space-y-2">
              <h3 className="text-sm font-semibold">{t('playground.evaluation.decisions')}</h3>
              <ul className="space-y-2">
                {decided.map((decision) => (
                  <li key={decision.id}>
                    <DecisionItem run={run} decision={decision} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Panel>
  )
}

/** An objective's points. With all of an Evaluator's points on screen each
 * objective folds, saying how many of its points are rated: open while
 * some are left (as it was when the list opened -- rating the last one
 * doesn't shut it under the hand). */
function ObjectivePoints({
  code,
  title,
  rated,
  total,
  foldable,
  children,
}: {
  code: string
  title: string
  rated: number
  total: number
  foldable: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(rated < total)
  const heading = <CodeRef variant="stacked" wrap strong code={code} title={title} />
  if (!foldable) {
    return (
      <section aria-label={code} className="space-y-3">
        <h3 className="text-sm font-semibold">{heading}</h3>
        {children}
      </section>
    )
  }
  return (
    <section aria-label={code}>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
        <summary className="flex cursor-pointer items-start justify-between gap-3 rounded-sm py-1 focus-visible:outline-2 focus-visible:outline-accent-fg">
          <h3 className="min-w-0 text-sm font-semibold">{heading}</h3>
          <span className="shrink-0 text-xs text-paper-ink/70 tabular-nums dark:text-fg-muted">
            {t('playground.evaluation.progress', { rated, total })}
          </span>
        </summary>
        <div className="mt-3 space-y-3">{children}</div>
      </details>
    </section>
  )
}

function PointRow({
  point,
  onRate,
}: {
  point: RunPoint
  onRate: (point: RunPoint, level: RatingLevel | null, rationale: string) => Promise<void>
}) {
  const { t } = useTranslation()
  const [rationale, setRationale] = useState(point.rating?.rationale ?? '')
  const level = point.rating?.level ?? null
  const meaning = (l: RatingLevel) =>
    point.criteria[l]?.trim() || t(`creator.needs.outputs.ratings.${l}`)

  return (
    <div className="space-y-2 rounded-sm border border-panel-line p-3">
      <p className="text-sm">{point.text}</p>
      {(point.inject_code || point.responsible_role) && (
        <p className="text-xs text-paper-ink/60 dark:text-fg-muted">
          {[
            point.action_code || point.inject_code,
            point.responsible_role,
            point.expected_within_minutes !== null &&
              t('playground.control.within', { minutes: point.expected_within_minutes }),
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      )}
      {point.action_mark && (
        <p className="text-xs">
          {t('playground.evaluation.controllerSaw')}{' '}
          <strong>{t(MARK_KEYS[point.action_mark])}</strong>
          {point.action_note && ` — ${point.action_note}`}
        </p>
      )}
      <div
        role="radiogroup"
        aria-label={t('playground.evaluation.rateOf', { point: point.text })}
        className="flex gap-1.5"
      >
        {LEVELS.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={level === l}
            title={meaning(l)}
            onClick={() => void onRate(point, level === l ? null : l, rationale)}
            className={`h-8 w-10 rounded-sm border font-mono text-sm font-semibold ${
              level === l
                ? 'border-accent bg-accent text-ink'
                : 'border-panel-line hover:border-accent'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      {level && <p className="text-xs text-paper-ink/70 dark:text-fg-muted">{meaning(level)}</p>}
      <label className="sr-only" htmlFor={`why-${point.id}`}>
        {t('playground.evaluation.whyOf', { point: point.text })}
      </label>
      <textarea
        name={`why-${point.id}`}
        autoComplete="off"
        id={`why-${point.id}`}
        value={rationale}
        rows={2}
        maxLength={5000}
        placeholder={t('playground.evaluation.whyPlaceholder')}
        onChange={(e) => setRationale(e.target.value)}
        onBlur={() => {
          if (level && rationale.trim() !== (point.rating?.rationale ?? ''))
            void onRate(point, level, rationale)
        }}
        className={inputBase}
      />
    </div>
  )
}
