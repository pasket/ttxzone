import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { ApiError } from '../../lib/api'
import type { EEGRead } from '../../lib/types'
import { EegView } from '../common/EegView'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { TlpBadge } from '../common/TlpBadge'
import { HelpText } from '../common/HelpText'

/** Execution -> Evaluation: the Evaluator's workspace (Control ->
 * Evaluation shows it to Controllers too). The definitive EEGs of the
 * ready conduct prep -- or, until it's ready, the draft derived from the
 * approved needs analysis and the MSEL, said so. Read-only for now:
 * rating each objective arrives with the conduct phase, when there's a
 * session and its log to rate. Carries the needs analysis's TLP label. */
export function ExecutionEvaluationSection() {
  const { t } = useTranslation()
  const { ttxId } = useParams<{ ttxId: string }>()
  const { data, error, refetch } = useApiResource<EEGRead>(`/ttx/${ttxId}/eeg`)
  const notApproved = error instanceof ApiError && error.code === 'NEEDS_FORM_NOT_APPROVED'

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader title={t('execution.evaluation.title')} />
        {data && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span translate="no" className="font-mono">
              {data.exercise_code}
            </span>
            <span aria-hidden="true" className="text-paper-ink/30 dark:text-fg-faint">
              ·
            </span>
            <span>{data.exercise_name}</span>
            <TlpBadge tlp={data.tlp} />
          </div>
        )}
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          <HelpText id="execution.evaluation.intro" text={t('execution.evaluation.intro')} />
        </p>
      </div>

      {notApproved ? (
        <Panel title={t('execution.evaluation.notApprovedTitle')} className="max-w-2xl">
          <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
            {t('execution.evaluation.notApprovedBody')}
          </p>
        </Panel>
      ) : error && !data ? (
        <p role="alert" className="text-sm text-danger-fg">
          {t('execution.evaluation.loadError')}{' '}
          <button type="button" onClick={refetch} className="underline">
            {t('creator.needs.retry')}
          </button>
        </p>
      ) : data ? (
        <div className="space-y-4">
          {data.source !== 'plan' ? (
            <div
              role="status"
              className="rounded-sm border border-inactive-1/60 bg-inactive-1/10 p-4 text-sm"
            >
              <p className="font-semibold">{t('execution.evaluation.derivedTitle')}</p>
              <p className="text-paper-ink/70 dark:text-fg-muted">
                {t('execution.evaluation.derivedBody')}
              </p>
            </div>
          ) : data.plan_reopened ? (
            <div
              role="status"
              className="rounded-sm border border-paper-line bg-hover/40 p-4 text-sm dark:border-line"
            >
              {t('execution.evaluation.planReopened', { version: data.plan_version ?? '' })}
            </div>
          ) : null}
          <Panel
            title={
              <HelpText
                id="execution.evaluation.eegTitle"
                text={t('execution.evaluation.eegTitle')}
              />
            }
            description={
              <HelpText
                id="execution.evaluation.eegDescription"
                text={
                  data.source === 'plan'
                    ? t('execution.evaluation.planDescription', {
                        version: data.plan_version ?? '',
                        lead: data.lead_evaluator ?? '—',
                      })
                    : t('execution.evaluation.eegDescription', {
                        version: data.needs_form_version,
                      })
                }
              />
            }
          >
            <EegView eeg={data} />
          </Panel>
        </div>
      ) : null}
    </div>
  )
}
