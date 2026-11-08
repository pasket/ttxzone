import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { linkAccent } from '../../lib/buttonStyles'
import { LEGAL_TITLE_KEYS } from '../../lib/legal'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import type { LegalAcceptance, LegalDocumentKind, LegalDocumentListResponse } from '../../lib/types'
import { LegalDocumentDialog } from '../common/LegalDocumentDialog'
import { Panel } from '../common/Panel'

/** Preferences -> Privacy: which versions of the deployment's terms of
 * service and privacy policy this account accepted, and when, with the
 * current version of each to read. Nothing while the operator has
 * published nothing and the account accepted nothing. */
export function AccountLegalPanel() {
  const { t, i18n } = useTranslation()
  const published = useApiResource<LegalDocumentListResponse>('/legal')
  const accepted = useApiResource<{ items: LegalAcceptance[] }>('/auth/legal/acceptances')
  const [reading, setReading] = useState<LegalDocumentKind | null>(null)

  const documents = published.data?.items ?? []
  const acceptances = accepted.data?.items ?? []
  if (documents.length === 0 && acceptances.length === 0) return null
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeStyle: 'short' })

  return (
    <Panel title={t('legal.account.title')} description={t('legal.account.description')} flush>
      {documents.length > 0 && (
        <ul className="space-y-1 px-5 py-4 text-sm">
          {documents.map((document) => (
            <li key={document.kind} className="flex flex-wrap items-baseline gap-x-2">
              <button
                type="button"
                onClick={() => setReading(document.kind)}
                className={`font-medium underline-offset-2 hover:underline ${linkAccent}`}
              >
                {t(LEGAL_TITLE_KEYS[document.kind])}
              </button>
              <span className="text-paper-ink/60 dark:text-fg-muted">
                {t('legal.account.current', { version: document.version })}
              </span>
            </li>
          ))}
        </ul>
      )}
      {acceptances.length === 0 ? (
        <p className="border-t border-panel-line px-5 py-4 text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('legal.account.noneAccepted')}
        </p>
      ) : (
        <table className="w-full border-t border-panel-line text-left text-sm">
          <caption className="sr-only">{t('legal.account.history')}</caption>
          <thead>
            <tr className={panelTableHeadRow}>
              <th scope="col" className={panelTh}>
                {t('legal.account.columns.document')}
              </th>
              <th scope="col" className={panelTh}>
                {t('legal.account.columns.version')}
              </th>
              <th scope="col" className={panelTh}>
                {t('legal.account.columns.accepted')}
              </th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {acceptances.map((acceptance) => (
              <tr key={`${acceptance.kind}-${acceptance.version}`} className={panelTr}>
                <td className={panelTd}>{t(LEGAL_TITLE_KEYS[acceptance.kind])}</td>
                <td className={`${panelTd} tabular-nums`}>{acceptance.version}</td>
                <td className={panelTd}>{date.format(new Date(acceptance.accepted_at))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {reading && <LegalDocumentDialog kind={reading} onClose={() => setReading(null)} />}
    </Panel>
  )
}
