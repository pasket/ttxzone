import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useDiscardGuard } from '../../hooks/useDiscardGuard'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase, linkAccent } from '../../lib/buttonStyles'
import { codeRefText } from '../../lib/codeRef'
import { panelFormActions } from '../../lib/panelStyles'
import type { AssistantRequest, AssistantRequestList, InstancePolicy } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { DiscardConfirm } from '../common/DiscardConfirm'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'

export type RequestSection = 'needs' | 'msel' | 'conduct-prep'

export interface RequestRow {
  id: string
  code: string
  title: string
}

/** What the person asks the AI assistant for from this page: about the
 * document or one of its saved rows, with a note. Nothing runs here: their
 * own AI client reads the open ones the next time they work with it, and
 * its proposals come back to the panel above. Shown only where the
 * assistant is on. */
export function AssistantRequestsPanel({
  ttxId,
  section,
  rows,
}: {
  ttxId: string
  section: RequestSection
  /** The page's saved coded rows a request can be about. */
  rows: RequestRow[]
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const policy = useApiResource<InstancePolicy>('/instance/policy')
  const enabled = policy.data?.assistant_enabled === true
  const list = useApiResource<AssistantRequestList>(
    enabled ? `/ttx/${ttxId}/assistant/requests` : null,
  )
  const [asking, setAsking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!enabled || !list.data) return null
  const mine = list.data.items.filter((request) => request.section === section)
  const titleOf = (request: AssistantRequest) =>
    rows.find((row) => row.id === request.row_id)?.title ?? ''

  async function withdraw(request: AssistantRequest) {
    setError(null)
    try {
      await apiFetch(`/ttx/${ttxId}/assistant/requests/${request.id}`, { method: 'DELETE' })
      list.refetch()
      showToast(t('assistant.requests.withdrawn'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    }
  }

  return (
    <Panel
      title={t('assistant.requests.title')}
      meta={mine.length > 0 ? t('assistant.requests.count', { count: mine.length }) : undefined}
      description={t('assistant.requests.description')}
      aside={
        <button type="button" className={btnSecondary} onClick={() => setAsking(true)}>
          + {t('assistant.requests.ask')}
        </button>
      }
    >
      {mine.length === 0 ? (
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('assistant.requests.empty')}
        </p>
      ) : (
        <ul className="divide-y divide-panel-line">
          {mine.map((request) => (
            <li
              key={request.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="text-paper-ink/70 dark:text-fg-muted">
                  {request.row_code ? (
                    <CodeRef code={request.row_code} title={titleOf(request)} />
                  ) : (
                    t('assistant.requests.wholeDocument')
                  )}
                </p>
                <p className="break-words text-pretty">{request.note}</p>
              </div>
              <button
                type="button"
                className={`${linkAccent} text-[13px]`}
                onClick={() => void withdraw(request)}
              >
                {t('assistant.requests.withdraw')}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="mt-2 text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      {asking && (
        <AskDialog
          ttxId={ttxId}
          section={section}
          rows={rows}
          onClose={() => setAsking(false)}
          onAsked={() => {
            list.refetch()
            showToast(t('assistant.requests.asked'))
          }}
        />
      )}
    </Panel>
  )
}

function AskDialog({
  ttxId,
  section,
  rows,
  onClose,
  onAsked,
}: {
  ttxId: string
  section: RequestSection
  rows: RequestRow[]
  onClose: () => void
  onAsked: () => void
}) {
  const { t } = useTranslation()
  const guard = useDiscardGuard(onClose)
  const [rowId, setRowId] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await apiFetch(`/ttx/${ttxId}/assistant/requests`, {
        method: 'POST',
        body: JSON.stringify({ section, row_id: rowId || null, note: note.trim() }),
      })
      onAsked()
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="assistant-ask-title" onClose={guard.requestClose} size="lg">
      <form onSubmit={submit} onChange={guard.touch} className="space-y-4">
        <h2 id="assistant-ask-title" className="text-balance text-lg font-semibold tracking-tight">
          {t('assistant.requests.dialogTitle')}
        </h2>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t('assistant.requests.dialogHint')}
        </p>
        {rows.length > 0 && (
          <label className="block space-y-1.5 text-sm">
            <span>{t('assistant.requests.about')}</span>
            <select className={inputBase} value={rowId} onChange={(e) => setRowId(e.target.value)}>
              <option value="">{t('assistant.requests.wholeDocument')}</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {codeRefText(row.code, row.title)}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block space-y-1.5 text-sm">
          <span>{t('assistant.requests.note')}</span>
          <textarea
            className={inputBase}
            rows={4}
            required
            maxLength={1000}
            value={note}
            placeholder={t('assistant.requests.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        {guard.confirming ? (
          <DiscardConfirm onKeep={guard.keep} onDiscard={guard.discard} />
        ) : (
          <div className={panelFormActions}>
            <button type="button" onClick={guard.requestClose} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button type="submit" disabled={busy || !note.trim()} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('assistant.requests.submit')}
            </button>
          </div>
        )}
      </form>
    </Modal>
  )
}
