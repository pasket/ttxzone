import QRCode from 'qrcode'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, inputBase } from '../../lib/buttonStyles'
import { useAuth } from '../../hooks/useAuth'
import type { BackupCodesResponse } from '../../lib/types'
import { BackupCodesReveal } from '../common/BackupCodesReveal'
import { hasFinePointer } from '../../lib/pointer'

export function TotpEnrollment() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [searchParams] = useSearchParams()
  const mandatory = searchParams.get('mandatory') === '1'

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)

  // POST /auth/totp/enroll isn't idempotent -- each call generates and
  // persists a brand-new secret, overwriting the previous one. React 19's
  // StrictMode (see main.tsx) mounts effects twice in dev, so without this
  // guard two enroll calls race and the QR shown can end up scanning a
  // secret different from whichever response the backend persisted last.
  // No unmount-cancellation flag here on purpose: StrictMode's transient
  // mount->cleanup->remount cycle would flip it before the one real
  // in-flight request resolves, silently discarding its result forever.
  // React 18+ already no-ops a setState after a genuine unmount, so
  // there's nothing to guard against by tracking it ourselves.
  const enrollStarted = useRef(false)

  useEffect(() => {
    if (enrollStarted.current) return
    enrollStarted.current = true

    async function startEnrollment() {
      try {
        const { provisioning_uri } = await apiFetch<{ provisioning_uri: string }>(
          '/auth/totp/enroll',
          { method: 'POST' },
        )
        const dataUrl = await QRCode.toDataURL(provisioning_uri)
        setQrDataUrl(dataUrl)
      } catch (err) {
        setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      }
    }
    void startEnrollment()
  }, [t])

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await apiFetch<BackupCodesResponse>('/auth/totp/enroll/confirm', {
        method: 'POST',
        body: JSON.stringify({ code }),
      })
      await refresh()
      setBackupCodes(result.backup_codes)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (backupCodes !== null) {
    return <BackupCodesReveal codes={backupCodes} onAcknowledge={() => navigate('/')} />
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <h3 className="text-balance text-sm font-semibold">{t('auth.totp.enrollTitle')}</h3>
      <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
        {mandatory ? t('auth.totp.mandatoryBanner') : t('auth.totp.enrollInstructions')}
      </p>
      {qrDataUrl && (
        <img
          width={192}
          height={192}
          src={qrDataUrl}
          alt={t('auth.totp.qrAlt')}
          className="h-48 w-48 rounded-md border border-paper-line dark:border-line"
        />
      )}
      <form onSubmit={handleConfirm} className="space-y-2 text-left">
        <label className="block text-sm" htmlFor="totp-enroll-code">
          {t('auth.totp.codeLabel')}
        </label>
        <input
          spellCheck={false}
          id="totp-enroll-code"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus={hasFinePointer()}
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t('auth.totp.codePlaceholder')}
          className={`${inputBase} text-center text-lg tracking-widest`}
          required
        />
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting || qrDataUrl === null}
          className={`w-full ${btnPrimary}`}
        >
          {t('auth.totp.confirmButton')}
        </button>
      </form>
    </div>
  )
}
