import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnPrimary, btnSecondary } from '../../lib/buttonStyles'
import { SectionHeader } from './SectionHeader'

/** Shown exactly once, right after the backend generates a fresh batch of
 * TOTP backup codes (initial enrollment or an explicit regenerate) -- the
 * plaintext codes are never retrievable again afterwards, only their
 * Argon2 hash is persisted. Shared by TotpEnrollment and the Security
 * tab's regenerate action so the reveal/copy/acknowledge UX is identical
 * in both places. */
export function BackupCodesReveal({
  codes,
  onAcknowledge,
}: {
  codes: string[]
  onAcknowledge: () => void
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  async function handleCopyAll() {
    await navigator.clipboard.writeText(codes.join('\n'))
    setCopied(true)
  }

  return (
    <div className="w-full max-w-sm space-y-4 text-left">
      <SectionHeader level={2} title={t('common.backupCodes.title')} />
      <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
        {t('common.backupCodes.description')}
      </p>
      <ul
        translate="no"
        className="grid grid-cols-2 gap-1 rounded-md border border-paper-line bg-paper-surface p-3 font-mono text-sm dark:border-line dark:bg-surface"
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void handleCopyAll()}
        className={`w-full ${btnSecondary}`}
      >
        {copied ? t('common.backupCodes.copied') : t('common.backupCodes.copyAll')}
      </button>
      <button type="button" onClick={onAcknowledge} className={`w-full ${btnPrimary}`}>
        {t('common.backupCodes.continueButton')}
      </button>
    </div>
  )
}
