import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import type { RetestedAction } from '../../lib/types'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import { CodeRef } from '../common/CodeRef'
import { Panel } from '../common/Panel'

const muted = 'text-paper-ink/70 dark:text-fg-muted'

/** The improvement actions of earlier exercises this one re-tests, each
 * with the objective that tests it -- read-only: their status is followed
 * up in their own report (or Admin -> Improvement plan). Nothing when
 * there are none, or the caller can't read them. */
export function RetestsPanel({ ttxId }: { ttxId: string }) {
  const { t } = useTranslation()
  const { data } = useApiResource<RetestedAction[]>(`/ttx/${ttxId}/retests`)
  if (!data || data.length === 0) return null
  return (
    <Panel title={t('aar.retests.title')} description={t('aar.retests.intro')} flush>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead>
            <tr className={panelTableHeadRow}>
              <th className={panelTh}>{t('aar.retests.from')}</th>
              <th className={panelTh}>{t('aar.columns.action')}</th>
              <th className={panelTh}>{t('aar.retests.objective')}</th>
              <th className={panelTh}>{t('aar.columns.status')}</th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {data.map((item) => (
              <tr key={`${item.source_ttx_id}-${item.code}`} className={`${panelTr} align-top`}>
                <td className={panelTd}>
                  <CodeRef code={item.source_ttx_code} title={item.source_ttx_name} wrap />
                </td>
                <td className={panelTd}>
                  <CodeRef code={item.code} title={item.action || item.finding} wrap />
                  {item.finding && item.action && (
                    <p className={`text-xs ${muted}`}>{item.finding}</p>
                  )}
                </td>
                <td className={panelTd}>
                  {item.objective_code ? (
                    <CodeRef code={item.objective_code} title={item.objective_title ?? ''} wrap />
                  ) : (
                    <span className={muted}>{t('aar.retest.wholeExercise')}</span>
                  )}
                </td>
                <td className={panelTd}>{t(`aar.status.${item.status}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
