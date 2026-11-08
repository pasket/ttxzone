import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { linkAccent } from '../../lib/buttonStyles'

/** The periodic reconfirmation's grace period: the account was sent a link
 * to confirm its address again and keeps working until the deadline,
 * after which only the confirmation screen is open. One line under the
 * header, with a way to get a new link; nothing otherwise. */
export function EmailReconfirmBanner() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [notice, setNotice] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const deadline = user?.email_reconfirm_deadline
  if (!user || !deadline || user.email_reconfirmation_overdue) return null

  async function resend() {
    setSending(true)
    try {
      await apiFetch('/auth/email/verification', { method: 'POST' })
      setNotice(t('auth.reconfirmEmail.resent'))
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSending(false)
    }
  }

  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
    new Date(deadline),
  )
  return (
    <div
      role="status"
      className="border-b border-panel-line bg-panel px-4 py-2 text-sm text-paper-ink/80 dark:text-fg-muted"
    >
      {t('auth.reconfirmEmail.banner', { date, email: user.email })}{' '}
      {notice ? (
        <span>{notice}</span>
      ) : (
        <button
          type="button"
          onClick={() => void resend()}
          disabled={sending}
          className={`underline ${linkAccent}`}
        >
          {t('auth.verifyEmail.resend')}
        </button>
      )}
    </div>
  )
}
