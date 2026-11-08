import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import type { RetestedAction } from '../../lib/types'
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-panel-line text-left text-xs">
            <th className="px-3 py-2">{t('aar.retests.from')}</th>
            <th className="px-3 py-2">{t('aar.columns.action')}</th>
            <th className="px-3 py-2">{t('aar.retests.objective')}</th>
            <th className="px-3 py-2">{t('aar.columns.status')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={`${item.source_ttx_id}-${item.code}`}
              className="border-b border-panel-line align-top"
            >
              <td className="px-3 py-2">
                <CodeRef code={item.source_ttx_code} title={item.source_ttx_name} wrap />
              </td>
              <td className="px-3 py-2">
                <CodeRef code={item.code} title={item.action || item.finding} wrap />
                {item.finding && item.action && (
                  <p className={`text-xs ${muted}`}>{item.finding}</p>
                )}
              </td>
              <td className="px-3 py-2">
                {item.objective_code ? (
                  <CodeRef code={item.objective_code} title={item.objective_title ?? ''} wrap />
                ) : (
                  <span className={muted}>{t('aar.retest.wholeExercise')}</span>
                )}
              </td>
              <td className="px-3 py-2">{t(`aar.status.${item.status}`)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
