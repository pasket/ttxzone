import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../../hooks/useApiResource'
import type { DesignGapKind, DesignReview } from '../../../lib/types'
import { CodeRefList } from '../../common/CodeRef'

const mutedClass = 'text-sm text-paper-ink/70 dark:text-fg-muted'

const GAP_KEYS = {
  need_without_objective: 'creator.msel.designReview.gaps.need_without_objective',
  objective_without_phase: 'creator.msel.designReview.gaps.objective_without_phase',
  objective_without_inject: 'creator.msel.designReview.gaps.objective_without_inject',
  objective_without_expected_action:
    'creator.msel.designReview.gaps.objective_without_expected_action',
  objective_without_observation_point:
    'creator.msel.designReview.gaps.objective_without_observation_point',
  inject_without_objective: 'creator.msel.designReview.gaps.inject_without_objective',
  inject_without_expected_action: 'creator.msel.designReview.gaps.inject_without_expected_action',
  phase_without_inject: 'creator.msel.designReview.gaps.phase_without_inject',
} as const satisfies Record<DesignGapKind, string>

/** The saved design read as one chain (GET /ttx/{id}/design-review): the
 * links it lacks from needs to observation points, the stretches of the
 * session with no timed inject, and the threat actors' techniques no
 * inject uses. What the Coverage tab and the load table above don't show.
 * Read when the tab opens; remounted (`key`) when the MSEL is saved. */
export function DesignReviewGroup({ ttxId }: { ttxId: string }) {
  const { t } = useTranslation()
  const { data, loading } = useApiResource<DesignReview>(`/ttx/${ttxId}/design-review`)
  if (!data) {
    return loading ? (
      <p className={mutedClass} role="status">
        {t('creator.msel.designReview.loading')}
      </p>
    ) : null
  }
  const kinds = [...new Set(data.gaps.map((gap) => gap.kind))]
  const quiet = data.pace?.quiet_stretches ?? []
  const threats = data.threat_actors.filter((actor) => actor.techniques > 0)
  return (
    <div className="space-y-5 text-sm">
      <section className="space-y-2">
        <h4 className="font-medium">{t('creator.msel.designReview.chain')}</h4>
        {kinds.length === 0 ? (
          <p className={mutedClass}>{t('creator.msel.designReview.noGaps')}</p>
        ) : (
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[minmax(14rem,auto)_1fr]">
            {kinds.map((kind) => (
              <div key={kind} className="contents">
                <dt>{t(GAP_KEYS[kind])}</dt>
                <dd className="min-w-0">
                  <CodeRefList
                    wrap
                    items={data.gaps
                      .filter((gap) => gap.kind === kind)
                      .map((gap) => ({ key: gap.code, code: gap.code, title: gap.title }))}
                  />
                </dd>
              </div>
            ))}
          </dl>
        )}
        {!data.has_session_plan && (
          <p className={mutedClass}>{t('creator.msel.designReview.noSessionPlan')}</p>
        )}
      </section>

      <section className="space-y-2">
        <h4 className="font-medium">{t('creator.msel.designReview.pace')}</h4>
        {quiet.length === 0 ? (
          <p className={mutedClass}>{t('creator.msel.designReview.noQuiet')}</p>
        ) : (
          <>
            <p className={mutedClass}>
              {t('creator.msel.designReview.quietHint', {
                count: data.pace?.quiet_threshold_minutes ?? 0,
              })}
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {quiet.map((stretch) => (
                <li key={stretch.from_minute} className="tabular-nums">
                  {t('creator.msel.designReview.quietStretch', {
                    from: stretch.from_minute,
                    to: stretch.to_minute,
                    count: stretch.to_minute - stretch.from_minute,
                  })}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {threats.length > 0 && (
        <section className="space-y-2">
          <h4 className="font-medium">{t('creator.msel.designReview.techniques')}</h4>
          <ul className="space-y-1">
            {threats.map((actor) => (
              <li key={actor.code}>
                <CodeRefList items={[{ key: actor.code, code: actor.code, title: actor.name }]} />
                <span className={`block tabular-nums ${mutedClass}`}>
                  {t('creator.msel.designReview.techniquesUsed', {
                    used: actor.used,
                    count: actor.techniques,
                  })}
                  {actor.unused.length > 0 && (
                    <>
                      {' '}
                      {t('creator.msel.designReview.unused')}{' '}
                      <span translate="no">{actor.unused.join(', ')}</span>
                      {actor.techniques - actor.used > actor.unused.length && '…'}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
