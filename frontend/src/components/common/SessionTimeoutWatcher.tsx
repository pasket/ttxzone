import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch } from '../../lib/api'
import { btnPrimary, btnSecondary } from '../../lib/buttonStyles'
import { lastActivity, subscribeActivity } from '../../lib/sessionActivity'
import { Modal } from './Modal'

const SECOND = 1000
const MINUTE = 60 * SECOND
/** The idle warning shows this long before the soft timeout. */
export const IDLE_WARNING_MS = 2 * MINUTE
/** The hard timeout is announced this long before it. */
export const ABSOLUTE_NOTICE_MS = 10 * MINUTE
/** The server records activity at most once a minute, so its idle clock
 * may have started up to this much before the client's: the client ends
 * the session that much earlier, never later. */
const SERVER_TOUCH_MARGIN_MS = MINUTE

function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** The session policy's client side: warns before the soft timeout
 * (inactivity) with a chance to stay signed in, announces the hard
 * timeout (absolute) ahead of time, and ends the session when either is
 * reached -- /login then says it expired and returns to the page. */
export function SessionTimeoutWatcher() {
  const { t, i18n } = useTranslation()
  const { status, user, expireSession, logout } = useAuth()
  const activityAt = useSyncExternalStore(subscribeActivity, lastActivity)
  const [now, setNow] = useState<number | null>(null)
  const [noticeDismissedFor, setNoticeDismissedFor] = useState<string | null>(null)
  const expiringRef = useRef(false)

  const session = user?.session
  const signedIn =
    status === 'ready' ||
    status === 'needs-mfa-enrollment' ||
    status === 'needs-legal-acceptance' ||
    status === 'needs-password-change' ||
    status === 'needs-email-verification'

  useEffect(() => {
    if (!signedIn || !session) return
    expiringRef.current = false
    const timer = window.setInterval(() => setNow(Date.now()), SECOND)
    return () => window.clearInterval(timer)
  }, [signedIn, session])

  const idleDeadline = session
    ? activityAt + session.idle_timeout_minutes * MINUTE - SERVER_TOUCH_MARGIN_MS
    : Infinity
  const absoluteDeadline = session ? Date.parse(session.absolute_expires_at) : Infinity
  const expired = now !== null && now >= Math.min(idleDeadline, absoluteDeadline)

  useEffect(() => {
    if (!signedIn || !expired || expiringRef.current) return
    expiringRef.current = true
    void expireSession()
  }, [signedIn, expired, expireSession])

  if (!signedIn || !session || now === null || expired) return null

  const idleWarning = idleDeadline <= absoluteDeadline && now >= idleDeadline - IDLE_WARNING_MS
  if (idleWarning) {
    return (
      <Modal titleId="session-idle-title" onClose={() => void apiFetch('/auth/me')}>
        <div className="w-full max-w-sm space-y-3" role="alertdialog" aria-live="assertive">
          <h2 id="session-idle-title" className="text-balance text-lg font-semibold tracking-tight">
            {t('auth.session.idleTitle')}
          </h2>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('auth.session.idleBody', { time: formatCountdown(idleDeadline - now) })}
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => void logout()} className={btnSecondary}>
              {t('auth.session.signOut')}
            </button>
            <button type="button" onClick={() => void apiFetch('/auth/me')} className={btnPrimary}>
              {t('auth.session.stay')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  const absoluteNotice =
    now >= absoluteDeadline - ABSOLUTE_NOTICE_MS &&
    noticeDismissedFor !== session.absolute_expires_at
  if (absoluteNotice) {
    const dismiss = () => setNoticeDismissedFor(session.absolute_expires_at)
    const time = new Intl.DateTimeFormat(i18n.language, { timeStyle: 'short' }).format(
      new Date(absoluteDeadline),
    )
    return (
      <Modal titleId="session-absolute-title" onClose={dismiss}>
        <div className="w-full max-w-sm space-y-3">
          <h2
            id="session-absolute-title"
            className="text-balance text-lg font-semibold tracking-tight"
          >
            {t('auth.session.absoluteTitle')}
          </h2>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('auth.session.absoluteBody', { time })}
          </p>
          <div className="flex justify-end">
            <button type="button" onClick={dismiss} className={btnPrimary}>
              {t('auth.session.gotIt')}
            </button>
          </div>
        </div>
      </Modal>
    )
  }

  return null
}
