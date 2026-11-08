import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { linkAccent } from '../../lib/buttonStyles'

/** The server's minute between two codes by email (email_mfa_service). */
const COOLDOWN_SECONDS = 60

/** "Send a new code", for a code sent by email: waits the server's minute
 * after each send (counting down), so the person isn't refused for asking
 * too soon. Starts waiting: it's shown once a code has gone out. */
export function ResendCodeButton({ onResend }: { onResend: () => Promise<void> }) {
  const { t } = useTranslation()
  const [left, setLeft] = useState(COOLDOWN_SECONDS)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (left <= 0) return
    const timer = window.setTimeout(() => setLeft((s) => s - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [left])

  async function resend() {
    setSending(true)
    try {
      await onResend()
      setLeft(COOLDOWN_SECONDS)
    } finally {
      setSending(false)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void resend()}
      disabled={left > 0 || sending}
      className={`text-sm ${linkAccent} disabled:cursor-default disabled:text-paper-ink/60 dark:disabled:text-fg-muted`}
    >
      {left > 0 ? t('auth.emailCode.resendIn', { seconds: left }) : t('auth.emailCode.resend')}
    </button>
  )
}
