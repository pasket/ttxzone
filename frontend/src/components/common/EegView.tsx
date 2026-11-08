import { useTranslation } from 'react-i18next'

import { CodeRef } from './CodeRef'
import { NotificationReference } from './NotificationReference'
import { RatingLevels } from './RatingLevels'
import { formatOffset } from '../../lib/msel'
import { objectiveName } from '../../lib/needsForm'
import type { EEGObjective, EEGPoint, EEGRead } from '../../lib/types'

const mutedClass = 'text-xs text-paper-ink/60 dark:text-fg-faint'

/** The Exercise Evaluation Guide (EEG), read-only: per objective, the
 * observation points an evaluator checks, the evidence to collect and the
 * P/S/M/U rating scale, plus the MSEL's expected actions that evaluate each
 * objective. Shared by the needs analysis's EEG draft (Planner
 * preview) and Execution -> Evaluation (the Evaluator's workspace). A
 * definitive EEG (the ready conduct prep's) shows its own points instead,
 * each with the levels it adjusts, and who evaluates it. */
export function EegView({ eeg }: { eeg: EEGRead }) {
  const { t } = useTranslation()
  if (eeg.objectives.length === 0) {
    return <p className="py-8 text-center text-sm">{t('creator.needs.outputs.empty')}</p>
  }
  return (
    <div className="space-y-4">
      <dl className="grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[auto_1fr]">
        {eeg.rating_scale.map((rating) => (
          <div key={rating} className="contents">
            <dt className="font-medium">{t(`creator.needs.outputs.ratings.${rating}`)}</dt>
            <dd className={mutedClass}>{t(`creator.needs.outputs.ratingDefinitions.${rating}`)}</dd>
          </div>
        ))}
      </dl>
      {eeg.objectives.map((objective) => (
        <article
          key={objective.id}
          aria-labelledby={`eeg-${objective.id}`}
          className="space-y-3 rounded-sm border border-paper-line p-4 dark:border-line"
        >
          <header className="space-y-1">
            <p className={mutedClass}>{t(`creator.needs.capabilities.${objective.capability}`)}</p>
            <h3 id={`eeg-${objective.id}`} className="text-sm font-semibold text-pretty">
              <span translate="no" className="font-mono">
                {objective.code}
              </span>
              <span
                aria-hidden="true"
                className="mx-1.5 font-normal text-paper-ink/35 dark:text-fg-faint"
              >
                |
              </span>
              <span className="sr-only">, </span>
              {objectiveName(objective)}
            </h3>
            {/* The whole statement: it's what Evaluators rate against. */}
            {objective.title?.trim() && (
              <p className="text-sm text-pretty">{objective.statement}</p>
            )}
          </header>
          {(objective.evaluators ?? []).length > 0 && (
            <p className={mutedClass}>
              {t('execution.evaluation.evaluatedBy', {
                names: objective.evaluators!.join(', '),
              })}
            </p>
          )}
          {objective.points && objective.points.length > 0 ? (
            <PlanPoints points={objective.points} />
          ) : (
            <div className="space-y-1.5">
              <h4 className="text-balance text-xs font-medium">
                {t('creator.needs.outputs.observationPoints')}
              </h4>
              <ul className="space-y-1 text-sm">
                {objective.observation_points.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-3 w-3 shrink-0 rounded-xs border border-paper-line dark:border-line"
                    />
                    {point}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!objective.points?.length && (objective.expected_actions ?? []).length > 0 && (
            <div className="space-y-1.5">
              <h4 className="text-balance text-xs font-medium">
                {t('creator.msel.fields.expected_actions')}
              </h4>
              <ul className="space-y-1 text-sm">
                {objective.expected_actions!.map((action) => (
                  <li key={action.code} className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-3 w-3 shrink-0 rounded-xs border border-paper-line dark:border-line"
                    />
                    <span>
                      {action.description}
                      {/* Which inject it answers. */}
                      <span className={`block ${mutedClass}`}>
                        <CodeRef code={action.inject_code} title={action.inject_title} />
                      </span>
                      {(action.responsible_role || action.expected_within_minutes) && (
                        <span className={`block ${mutedClass}`}>
                          {[
                            action.responsible_role,
                            action.expected_within_minutes
                              ? t('creator.msel.eeg.within', {
                                  minutes: action.expected_within_minutes,
                                })
                              : '',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Measurement objective={objective} />
          <RatingLevels
            // A plan's points also hold expected actions and notifications:
            // the rule counts the criterion's conditions only.
            conditions={
              objective.points?.length
                ? objective.points.filter((point) => point.kind === 'criterion').length
                : objective.observation_points.length
            }
            achieveAtLeast={objective.achieve_at_least}
            achievedNote={objective.achieved_note}
            partiallyAchieved={objective.partially_achieved}
            notAchieved={objective.not_achieved}
          />
        </article>
      ))}
      {(eeg.notifications ?? []).length > 0 && (
        <div className="pt-2">
          <NotificationReference variant="observe" notifications={eeg.notifications!} />
        </div>
      )}
    </div>
  )
}

/** The time box, the phases it's due by the end of, and what to collect, as a checklist (how it's rated is
 * RatingLevels, under it). */
function Measurement({ objective }: { objective: EEGObjective }) {
  const { t } = useTranslation()
  const evidence = objective.evidence_items ?? (objective.evidence ? [objective.evidence] : [])
  return (
    <div className="space-y-3">
      {objective.time_box_minutes ? (
        <p className={mutedClass}>
          {t('creator.needs.measure.within', { minutes: objective.time_box_minutes })}
        </p>
      ) : null}
      {(objective.due_phases ?? []).length > 0 && (
        <p className={mutedClass}>
          {t('creator.needs.measure.due')}{' '}
          {objective.due_phases!.map((phase, index) => (
            <span key={phase.code}>
              {index > 0 && ', '}
              <CodeRef code={phase.code} title={phase.name} /> ({formatOffset(phase.end_offset)})
            </span>
          ))}
        </p>
      )}
      <div className="space-y-1.5">
        <h4 className="text-balance text-xs font-medium">{t('creator.needs.fields.evidence')}</h4>
        {evidence.length === 0 ? (
          <p className="text-sm">—</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {evidence.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span
                  aria-hidden="true"
                  className="mt-1 h-3 w-3 shrink-0 rounded-xs border border-paper-line dark:border-line"
                />
                {item}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

const LEVELS = ['P', 'S', 'M', 'U'] as const

/** A definitive EEG's points: each to tick, where it comes from, and the
 * rating levels it adjusts from the common scale. */
function PlanPoints({ points }: { points: EEGPoint[] }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <h4 className="text-balance text-xs font-medium">
        {t('creator.needs.outputs.observationPoints')}
      </h4>
      <ul className="space-y-3 text-sm">
        {points.map((point) => (
          <li key={point.id} className="space-y-1.5">
            <p className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className="mt-1 h-3 w-3 shrink-0 rounded-xs border border-paper-line dark:border-line"
              />
              <span>
                {point.text}
                {point.inject_code && (
                  <span className={`block ${mutedClass}`}>
                    <CodeRef code={point.inject_code} title={point.inject_title} />
                    {point.expected_within_minutes
                      ? ` · ${t('creator.msel.eeg.within', { minutes: point.expected_within_minutes })}`
                      : ''}
                  </span>
                )}
              </span>
            </p>
            {/* Only the levels this point adjusts: the rest are the
                common scale, above. */}
            <dl className="ml-5 grid gap-x-3 gap-y-0.5 text-xs sm:grid-cols-[auto_1fr]">
              {LEVELS.filter((level) => point.criteria[level]?.trim()).map((level) => (
                <div key={level} className="contents">
                  <dt translate="no" className="font-mono font-medium">
                    {level}
                  </dt>
                  <dd className="text-paper-ink/70 dark:text-fg-muted">{point.criteria[level]}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </div>
  )
}
