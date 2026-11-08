import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { badgeNeutral, btnDangerGhost, btnSecondary } from '../../lib/buttonStyles'
import { formatRelativeTime } from '../../lib/lastLogin'
import type { UserSessionListResponse } from '../../lib/types'
import { describeUserAgent } from '../../lib/userAgent'
import { ButtonSpinner } from '../common/ButtonSpinner'

/** Preferences -> Security: the browsers signed in to this account, with
 * a way to sign any other one out (or all of them) -- e.g. a shared
 * computer, or a device that's gone. */
export function ActiveSessions() {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const { refresh } = useAuth()
  const { data, loading, error, refetch } =
    useApiResource<UserSessionListResponse>('/auth/sessions')
  const [pending, setPending] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function signOut(id: string | 'others', current = false) {
    setPending(id)
    setActionError(null)
    try {
      await apiFetch(id === 'others' ? '/auth/sessions' : `/auth/sessions/${id}`, {
        method: 'DELETE',
      })
      showToast(t('account.sessions.signedOut'))
      if (current) await refresh()
      else refetch()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setPending(null)
    }
  }

  if (loading && !data) return <ButtonSpinner />
  if (error) return <p className="text-sm text-danger-fg">{t('auth.common.genericError')}</p>

  const items = data?.items ?? []
  // "Now" is the latest activity the server saw -- this very session's,
  // a moment ago -- so render stays pure (no Date.now()).
  const now = new Date(Math.max(0, ...items.map((s) => Date.parse(s.last_seen_at))))
  const others = items.filter((s) => !s.current)

  return (
    <div className="space-y-4">
      <ul className="divide-y divide-panel-line">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
            <div className="min-w-0 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <span className="truncate">
                  {describeUserAgent(item.user_agent) ?? t('account.sessions.unknownDevice')}
                </span>
                {item.current && (
                  <span className={badgeNeutral}>{t('account.sessions.thisDevice')}</span>
                )}
              </p>
              <p className="text-paper-ink/60 dark:text-fg-muted">
                {[
                  item.ip_address,
                  item.current
                    ? t('account.sessions.activeNow')
                    : t('account.sessions.lastActive', {
                        time: formatRelativeTime(new Date(item.last_seen_at), now, i18n.language),
                      }),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
            <button
              type="button"
              className={btnDangerGhost}
              disabled={pending !== null}
              onClick={() => void signOut(item.id, item.current)}
            >
              {pending === item.id ? <ButtonSpinner /> : t('account.sessions.signOut')}
            </button>
          </li>
        ))}
      </ul>
      {actionError && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {actionError}
        </p>
      )}
      {others.length > 0 && (
        <button
          type="button"
          className={btnSecondary}
          disabled={pending !== null}
          onClick={() => void signOut('others')}
        >
          {pending === 'others' ? <ButtonSpinner /> : t('account.sessions.signOutOthers')}
        </button>
      )}
    </div>
  )
}
