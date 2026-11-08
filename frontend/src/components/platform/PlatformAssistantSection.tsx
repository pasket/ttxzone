import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { apiFetch } from '../../lib/api'
import { inputCompact } from '../../lib/buttonStyles'
import { panelTableHeadRow, panelTbody, panelTd, panelTh, panelTr } from '../../lib/panelStyles'
import type { AssistantCallListResponse, AssistantSettings } from '../../lib/types'
import { CodeRef } from '../common/CodeRef'
import { HelpText } from '../common/HelpText'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { Switch } from '../common/Switch'
import { badgeBase, useErrorMessage } from './platformCommon'

/** Platform -> AI assistant: whether accounts may connect an AI client
 * with a personal access token (read-only while ASSISTANT_ENABLED pins
 * it), what that means for the deployment's data, and how many tokens are
 * active. The switch applies as it's flipped (with step-up). */
export function PlatformAssistantSection() {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const resource = useApiResource<AssistantSettings>('/instance/assistant')
  const [saved, setSaved] = useState<AssistantSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const current = saved ?? resource.data

  async function toggle(enabled: boolean) {
    setSaving(true)
    setError(null)
    try {
      setSaved(
        await apiFetch<AssistantSettings>('/instance/assistant', {
          method: 'PUT',
          body: JSON.stringify({ enabled }),
        }),
      )
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title={t('platform.sections.assistant')} />
      {resource.error && (
        <p className="text-sm text-danger-fg" role="alert">
          {resource.error.message}
        </p>
      )}
      {current && (
        <Panel
          title={t('platform.assistant.title')}
          description={
            <HelpText
              id="platform.assistant.description"
              text={t(
                current.pinned_by_env
                  ? 'platform.assistant.pinned'
                  : 'platform.assistant.description',
              )}
            />
          }
          aside={
            <span className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {t('platform.assistant.activeTokens', { count: current.active_tokens })}
            </span>
          }
        >
          <div className="space-y-4">
            <Switch
              checked={current.enabled}
              disabled={current.pinned_by_env || saving}
              describedBy="platform-assistant-notice"
              onChange={(enabled) => void toggle(enabled)}
            >
              {t('platform.assistant.switchLabel')}
            </Switch>
            <div id="platform-assistant-notice" className="space-y-1 text-sm">
              <h3 className="font-semibold">{t('platform.assistant.operatorNoticeTitle')}</h3>
              <p className="text-paper-ink/70 dark:text-fg-muted">
                <HelpText
                  id="platform.assistant.operatorNotice"
                  text={t('platform.assistant.operatorNotice')}
                />
              </p>
            </div>
            {error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error}
              </p>
            )}
          </div>
        </Panel>
      )}
      {current && <RecentUsePanel />}
    </div>
  )
}

const failedBadge = 'bg-danger/10 text-danger-fg'
const okBadge = 'bg-paper-line/60 text-paper-ink/70 dark:bg-line dark:text-fg-muted'

/** The latest tool calls on the MCP endpoint, newest first: who, through
 * which token, which tool, about which exercise, how it ended and how long
 * it took. What was asked or answered isn't kept, so it can't show. */
function RecentUsePanel() {
  const { t, i18n } = useTranslation()
  const [userId, setUserId] = useState('')
  const query = userId ? `?user_id=${encodeURIComponent(userId)}` : ''
  const calls = useApiResource<AssistantCallListResponse>(`/instance/assistant/calls${query}`)
  const items = calls.data?.items ?? []
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })

  return (
    <Panel
      title={t('platform.assistant.recent.title')}
      meta={calls.data ? t('platform.assistant.recent.count', { count: items.length }) : undefined}
      description={
        calls.data
          ? t('platform.assistant.recent.description', { count: calls.data.retention_days })
          : undefined
      }
      aside={
        <div className="w-56">
          <label className="sr-only" htmlFor="platform-assistant-caller">
            {t('platform.assistant.recent.filterLabel')}
          </label>
          <select
            id="platform-assistant-caller"
            name="caller"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className={`${inputCompact} text-sm`}
          >
            <option value="">{t('platform.assistant.recent.everyone')}</option>
            {(calls.data?.callers ?? []).map((caller) => (
              <option key={caller.user_id} value={caller.user_id}>
                {caller.name}
              </option>
            ))}
          </select>
        </div>
      }
      flush
    >
      {calls.error ? (
        <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
          {calls.error.message}
        </p>
      ) : items.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
          {calls.loading ? t('common.loading') : t('platform.assistant.recent.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto" aria-busy={calls.loading}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={panelTableHeadRow}>
                <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                  {t('platform.assistant.recent.columns.when')}
                </th>
                <th scope="col" className={panelTh}>
                  {t('platform.assistant.recent.columns.who')}
                </th>
                <th scope="col" className={panelTh}>
                  {t('platform.assistant.recent.columns.tool')}
                </th>
                <th scope="col" className={panelTh}>
                  {t('platform.assistant.recent.columns.exercise')}
                </th>
                <th scope="col" className={panelTh}>
                  {t('platform.assistant.recent.columns.outcome')}
                </th>
                <th scope="col" className={`${panelTh} text-right`}>
                  {t('platform.assistant.recent.columns.duration')}
                </th>
              </tr>
            </thead>
            <tbody className={panelTbody}>
              {items.map((item) => (
                <tr key={item.id} className={panelTr}>
                  <td className={`${panelTd} whitespace-nowrap tabular-nums`}>
                    <time dateTime={item.created_at}>
                      {dateFormat.format(new Date(item.created_at))}
                    </time>
                  </td>
                  <td className={panelTd}>
                    <span className="block">{item.user_name}</span>
                    <span className="block text-xs text-paper-ink/60 dark:text-fg-muted">
                      {t('platform.assistant.recent.token', {
                        name: item.token_name,
                        prefix: item.token_prefix,
                      })}
                    </span>
                  </td>
                  <td className={`${panelTd} font-mono text-xs`}>{item.tool}</td>
                  <td className={panelTd}>
                    {item.ttx_code ? (
                      <>
                        <CodeRef code={item.ttx_code} title={item.ttx_name ?? ''} wrap />
                        <span className="block text-xs text-paper-ink/60 dark:text-fg-muted">
                          {item.organization_name}
                        </span>
                      </>
                    ) : (
                      <span className="text-paper-ink/60 dark:text-fg-muted">—</span>
                    )}
                  </td>
                  <td className={panelTd}>
                    <span
                      className={`${badgeBase} ml-0 ${item.outcome === 'ok' ? okBadge : failedBadge}`}
                    >
                      {item.outcome === 'ok' ? t('platform.assistant.recent.ok') : item.outcome}
                    </span>
                  </td>
                  <td className={`${panelTd} text-right tabular-nums`}>
                    {t('platform.assistant.recent.ms', { count: item.duration_ms })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
