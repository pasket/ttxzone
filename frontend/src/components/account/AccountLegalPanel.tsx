import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { LEGAL_TITLE_KEYS } from '../../lib/legal'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import type { LegalAcceptance, LegalDocumentKind, LegalDocumentListResponse } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { LegalDocumentDialog } from '../common/LegalDocumentDialog'
import { Panel } from '../common/Panel'

/** Preferences -> Privacy: which versions of the deployment's terms of
 * service and privacy policy this account accepted, and when, with the
 * current version of each to read -- and to accept, one at a time, when
 * it's pending (where `LegalPendingBanner` links). Nothing while the
 * operator has published nothing and the account accepted nothing. */
export function AccountLegalPanel() {
  const { t, i18n } = useTranslation()
  const published = useApiResource<LegalDocumentListResponse>('/legal')
  const accepted = useApiResource<{ items: LegalAcceptance[] }>('/auth/legal/acceptances')
  const [reading, setReading] = useState<LegalDocumentKind | null>(null)
  const { user, refresh, syncUser } = useAuth()
  const { showToast } = useToast()
  const [accepting, setAccepting] = useState<LegalDocumentKind | null>(null)
  const [error, setError] = useState('')

  const pending = user?.legal_acceptance_pending ?? []
  const pendingVersion = (kind: LegalDocumentKind) =>
    pending.find((document) => document.kind === kind)?.version

  async function accept(kind: LegalDocumentKind, version: number) {
    setAccepting(kind)
    setError('')
    try {
      await apiFetch('/auth/legal/accept', {
        method: 'POST',
        body: JSON.stringify({ acceptances: [{ kind, version }] }),
      })
      showToast(t('legal.account.accepted', { title: t(LEGAL_TITLE_KEYS[kind]) }))
      accepted.refetch()
      // The last one pending: back to full access (an account held at the
      // acceptance screen since sign-in loads its exercises now).
      if (pending.every((document) => document.kind === kind)) await refresh()
      else await syncUser()
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LEGAL_VERSION_OUTDATED') {
        // Published again meanwhile: offer the newer version.
        setError(t('legal.consent.outdatedError'))
        await syncUser().catch(() => undefined)
        published.refetch()
      } else {
        setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      }
    } finally {
      setAccepting(null)
    }
  }

  const documents = published.data?.items ?? []
  const acceptances = accepted.data?.items ?? []
  if (documents.length === 0 && acceptances.length === 0) return null
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long', timeStyle: 'short' })

  return (
    <Panel title={t('legal.account.title')} description={t('legal.account.description')} flush>
      {documents.length > 0 && (
        <ul className="space-y-2 px-5 py-4 text-sm">
          {documents.map((document) => {
            const pendingAt = pendingVersion(document.kind)
            return (
              <li key={document.kind} className="flex flex-wrap items-center gap-x-2 gap-y-2">
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
                {pendingAt !== undefined && (
                  <>
                    <span className="whitespace-nowrap rounded-full border border-paper-line px-2 py-0.5 text-xs font-medium text-paper-ink/80 dark:border-line dark:text-fg-muted">
                      {t('legal.account.pending')}
                    </span>
                    <button
                      type="button"
                      onClick={() => void accept(document.kind, pendingAt)}
                      disabled={accepting !== null}
                      className={`${btnSecondary} ml-auto`}
                    >
                      {accepting === document.kind ? (
                        <ButtonSpinner />
                      ) : (
                        t('legal.account.accept', { version: pendingAt })
                      )}
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {error && (
        <p className="px-5 pb-4 text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
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
