import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { claudeDesktopConfig, mcpServerUrl } from '../../lib/assistant'
import { panelFormActions } from '../../lib/panelStyles'
import type {
  PersonalAccessToken,
  PersonalAccessTokenCreated,
  PersonalAccessTokenListResponse,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { IconButton } from '../common/IconButton'
import { Panel } from '../common/Panel'

const TOKEN_PLACEHOLDER = 'YOUR_TOKEN'

function CopyButton({ text }: { text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={btnSecondary}
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => setCopied(true))
      }}
    >
      {copied ? t('account.assistant.copied') : t('account.assistant.copy')}
    </button>
  )
}

/** Preferences -> AI assistant (listed while the deployment has it on):
 * the responsible-use notice, which must be acknowledged to create a
 * token; the token itself, shown once; the account's tokens, revocable;
 * and the configuration that connects Claude Desktop. */
export function AccountSettingsAssistant() {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const runUndoable = useUndoableAction()
  const list = useApiResource<PersonalAccessTokenListResponse>('/auth/tokens')
  const [items, setItems] = useState<PersonalAccessToken[] | null>(null)
  const [name, setName] = useState('')
  const [days, setDays] = useState(30)
  const [acknowledged, setAcknowledged] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<PersonalAccessTokenCreated | null>(null)

  const data = list.data
  const shown = items ?? data?.items ?? []
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const activeCount = shown.filter((token) => !token.expired).length
  const atLimit = data !== null && data !== undefined && activeCount >= data.max_active

  if (list.loading && !data) return <ButtonSpinner />
  if (list.error) return <p className="text-sm text-danger-fg">{t('auth.common.genericError')}</p>
  if (data && !data.enabled) {
    return (
      <Panel title={t('account.settings.assistantTitle')}>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{t('account.assistant.off')}</p>
      </Panel>
    )
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    if (!data) return
    setError(null)
    setSubmitting(true)
    try {
      const token = await apiFetch<PersonalAccessTokenCreated>('/auth/tokens', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          expires_in_days: days,
          acknowledge: acknowledged,
          disclaimer_version: data.disclaimer_version,
        }),
      })
      setCreated(token)
      setItems([token, ...shown])
      setName('')
      setAcknowledged(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  function revoke(token: PersonalAccessToken) {
    runUndoable({
      message: t('account.assistant.revoked'),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setItems(shown.filter((item) => item.id !== token.id)),
      onRestore: () => setItems((prev) => [token, ...(prev ?? [])]),
      onCommit: async () => {
        try {
          await apiFetch(`/auth/tokens/${token.id}`, { method: 'DELETE' })
        } catch (err) {
          setItems((prev) => [token, ...(prev ?? [])])
          showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
            variant: 'error',
          })
        }
      },
    })
  }

  const url = mcpServerUrl()
  const config = claudeDesktopConfig(url, created?.token ?? TOKEN_PLACEHOLDER)

  return (
    <div className="max-w-3xl space-y-6">
      {created ? (
        <Panel
          title={t('account.assistant.createdTitle')}
          description={t('account.assistant.createdDescription')}
          footer={
            <div className={panelFormActions}>
              <button type="button" className={btnPrimary} onClick={() => setCreated(null)}>
                {t('account.assistant.done')}
              </button>
            </div>
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <code
              translate="no"
              className="min-w-0 flex-1 break-all rounded-sm border border-panel-line bg-field px-3 py-2 font-mono text-sm"
            >
              {created.token}
            </code>
            <CopyButton text={created.token} />
          </div>
        </Panel>
      ) : (
        <form onSubmit={handleCreate}>
          <Panel
            title={t('account.assistant.createTitle')}
            description={t('account.assistant.createDescription')}
            footer={
              <div className={panelFormActions}>
                <button
                  type="submit"
                  className={btnPrimary}
                  disabled={submitting || !acknowledged || !name.trim() || atLimit}
                >
                  {submitting ? <ButtonSpinner /> : t('account.assistant.create')}
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <div
                role="note"
                aria-labelledby="assistant-notice-title"
                className="space-y-1 rounded-sm border border-panel-line p-4 text-sm"
              >
                <h3 id="assistant-notice-title" className="font-semibold">
                  {t('account.assistant.noticeTitle')}
                </h3>
                <p className="text-paper-ink/70 dark:text-fg-muted">
                  {t('account.assistant.notice')}
                </p>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>{t('account.assistant.acknowledge')}</span>
              </label>
              <div className="grid max-w-2xl gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-1.5">
                  <label className="block text-sm" htmlFor="assistant-token-name">
                    {t('account.assistant.nameLabel')}
                  </label>
                  <input
                    id="assistant-token-name"
                    name="token-name"
                    autoComplete="off"
                    maxLength={80}
                    placeholder={t('account.assistant.namePlaceholder')}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputBase}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm" htmlFor="assistant-token-expiry">
                    {t('account.assistant.expiryLabel')}
                  </label>
                  <select
                    id="assistant-token-expiry"
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
                    className={inputBase}
                  >
                    {(data?.expiry_days_choices ?? [7, 30, 90]).map((choice) => (
                      <option key={choice} value={choice}>
                        {t('account.assistant.days', { count: choice })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {atLimit && (
                <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                  {t('account.assistant.limitReached', { count: data?.max_active ?? 0 })}
                </p>
              )}
              {error && (
                <p className="text-sm text-danger-fg" aria-live="polite">
                  {error}
                </p>
              )}
            </div>
          </Panel>
        </form>
      )}

      <Panel
        title={t('account.assistant.listTitle')}
        description={
          <HelpText
            id="account.assistant.listDescription"
            text={t('account.assistant.listDescription')}
          />
        }
      >
        {shown.length === 0 ? (
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t('account.assistant.empty')}
          </p>
        ) : (
          <ul className="divide-y divide-panel-line">
            {shown.map((token) => (
              <li
                key={token.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0"
              >
                <div className="min-w-0 text-sm">
                  <p className="truncate font-medium">{token.name}</p>
                  <p className="text-paper-ink/60 dark:text-fg-muted">
                    {[
                      `${t('account.assistant.prefix')} ${token.prefix}…`,
                      t('account.assistant.createdAt', {
                        date: date.format(new Date(token.created_at)),
                      }),
                      token.expired
                        ? t('account.assistant.expired')
                        : t('account.assistant.expiresAt', {
                            date: date.format(new Date(token.expires_at)),
                          }),
                      token.last_used_at
                        ? t('account.assistant.lastUsed', {
                            date: date.format(new Date(token.last_used_at)),
                          })
                        : t('account.assistant.neverUsed'),
                    ].join(' · ')}
                  </p>
                </div>
                <IconButton
                  label={t('account.assistant.revokeLabel', { name: token.name })}
                  onClick={() => revoke(token)}
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={t('account.assistant.setupTitle')}
        description={t('account.assistant.setupDescription')}
      >
        <div className="space-y-3">
          <pre
            translate="no"
            className="overflow-x-auto rounded-sm border border-panel-line bg-field p-3 font-mono text-xs"
          >
            {config}
          </pre>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {t('account.assistant.setupUrl', { url })}
            </p>
            <CopyButton text={config} />
          </div>
        </div>
      </Panel>
    </div>
  )
}
