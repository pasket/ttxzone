import { useTranslation } from 'react-i18next'

import { CodeRef } from '../../common/CodeRef'
import { useApiResource } from '../../../hooks/useApiResource'
import { traceabilityRows } from '../../../lib/needsFormOutputs'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../../lib/panelStyles'
import type { EEGRead, NeedsForm, RegulatoryCatalog } from '../../../lib/types'
import { EegView } from '../../common/EegView'
import { objectiveName } from '../../../lib/needsForm'

const mutedClass = 'text-xs text-paper-ink/60 dark:text-fg-faint'

function SavedStateNote({ dirty }: { dirty: boolean }) {
  const { t } = useTranslation()
  if (!dirty) return null
  return <p className={mutedClass}>{t('creator.needs.outputs.savedOnly')}</p>
}

/** Read-only: need → capability → objective → requirement, from the saved
 * form. HIGH needs no objective answers are flagged in their own rows. */
export function TraceabilityStep({
  form,
  catalog,
  dirty,
}: {
  form: NeedsForm
  catalog: RegulatoryCatalog | null
  dirty: boolean
}) {
  const { t, i18n } = useTranslation()
  const rows = traceabilityRows(form, catalog, i18n.language.startsWith('es'))
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm">{t('creator.needs.outputs.empty')}</p>
  }
  return (
    <div className="space-y-3">
      <SavedStateNote dirty={dirty} />
      <div className="-mx-5 overflow-x-auto">
        <table className="w-full text-left">
          <caption className="sr-only">{t('creator.needs.steps.traceability')}</caption>
          <thead>
            <tr className={panelTableHeadRow}>
              <th className={panelTh}>{t('creator.needs.outputs.need')}</th>
              <th className={panelTh}>{t('creator.needs.fields.capability')}</th>
              <th className={panelTh}>{t('creator.needs.table.objective')}</th>
              <th className={panelTh}>{t('creator.needs.fields.success_criterion')}</th>
              <th className={panelTh}>{t('creator.needs.fields.evidence')}</th>
              <th className={panelTh}>{t('creator.needs.outputs.requirements')}</th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {rows.map((row) => (
              <tr key={row.key} className={panelTr}>
                <td className={`${panelTd} align-top text-sm`}>
                  <CodeRef variant="stacked" code={row.needCode} title={row.needTitle} />
                  <span className={`block ${mutedClass}`}>
                    {t(`creator.needs.priorities.${row.priority}`)}
                  </span>
                </td>
                {row.objective ? (
                  <>
                    <td className={`${panelTd} align-top text-sm`}>
                      {t(`creator.needs.capabilities.${row.objective.capability}`)}
                    </td>
                    <td className={`${panelTd} align-top text-sm`}>
                      <CodeRef
                        variant="stacked"
                        code={row.objective.code}
                        title={objectiveName(row.objective)}
                      />
                    </td>
                    <td className={`${panelTd} align-top text-sm`}>
                      {row.objective.successCriterion || '—'}
                    </td>
                    <td className={`${panelTd} align-top text-sm`}>
                      {row.objective.evidence || '—'}
                    </td>
                    <td className={`${panelTd} align-top text-sm`}>
                      {/* One per line, never a comma list. */}
                      {row.objective.requirements.length > 0 ? (
                        <ul className="space-y-0.5">
                          {row.objective.requirements.map((requirement) => (
                            <li key={requirement} className="whitespace-nowrap">
                              {requirement}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        '—'
                      )}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className={`${panelTd} align-top text-sm`}>
                    <span className="font-medium text-danger-fg">
                      {t('creator.needs.outputs.orphan')}
                    </span>
                    <span className={`block ${mutedClass}`}>{row.needTitle}</span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/** Read-only preview of the Exercise Evaluation Guide, from the backend
 * (GET /ttx/{id}/eeg -- the one place observation points are derived):
 * what the exercise's Evaluators will see once the form is approved. */
export function EegStep({ ttxId, dirty }: { ttxId: string; dirty: boolean }) {
  const { t } = useTranslation()
  const { data, error, refetch } = useApiResource<EEGRead>(`/ttx/${ttxId}/eeg`)
  if (error && !data) {
    return (
      <p role="alert" className="text-sm text-danger-fg">
        {t('creator.needs.loadError')}{' '}
        <button type="button" onClick={refetch} className="underline">
          {t('creator.needs.retry')}
        </button>
      </p>
    )
  }
  if (!data) return null
  return (
    <div className="space-y-4">
      <SavedStateNote dirty={dirty} />
      <EegView eeg={data} />
    </div>
  )
}
