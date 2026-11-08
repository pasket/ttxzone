import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, linkAccent } from '../../lib/buttonStyles'
import { consentLabelKey, LEGAL_TITLE_KEYS } from '../../lib/legal'
import type { LegalDocumentKind } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { LegalDocumentDialog } from '../common/LegalDocumentDialog'

/** Shown after sign-in while the deployment has legal documents this
 * account hasn't accepted (a first publication, or a substantial change).
 * Until then the API answers only the account itself, so the way out
 * without accepting is signing out or deleting the account. */
export function LegalAcceptanceGate() {
  const { t } = useTranslation()
  const { user, refresh, logout } = useAuth()
  const navigate = useNavigate()
  const [accepted, setAccepted] = useState(false)
  const [reading, setReading] = useState<LegalDocumentKind | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const pending = user?.legal_acceptance_pending ?? []
  // A first publication isn't "updated" terms for this account.
  const updated = pending.some((document) => document.updated)

  async function accept() {
    setSubmitting(true)
    setError('')
    try {
      await apiFetch('/auth/legal/accept', {
        method: 'POST',
        body: JSON.stringify({
          acceptances: pending.map(({ kind, version }) => ({ kind, version })),
        }),
      })
      await refresh()
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'LEGAL_VERSION_OUTDATED') {
        // Published again meanwhile: show the newer version.
        setAccepted(false)
        setError(t('legal.consent.outdatedError'))
        await refresh()
      } else {
        setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          {t(updated ? 'legal.gate.title' : 'legal.gate.titleFirst')}
        </h1>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t(updated ? 'legal.gate.intro' : 'legal.gate.introFirst', {
            name: t('common.app.name'),
          })}
        </p>
      </div>
      <ul className="space-y-1 text-sm">
        {pending.map((document) => (
          <li key={document.kind} className="flex flex-wrap items-baseline gap-x-2">
            <button
              type="button"
              onClick={() => setReading(document.kind)}
              className={`font-medium underline-offset-2 hover:underline ${linkAccent}`}
            >
              {t(LEGAL_TITLE_KEYS[document.kind])}
            </button>
            <span className="text-paper-ink/60 dark:text-fg-muted">
              {t('legal.gate.version', { version: document.version })}
            </span>
          </li>
        ))}
      </ul>
      <label className="flex items-start gap-2 text-sm" htmlFor="legal-gate-accept">
        <input
          id="legal-gate-accept"
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        />
        {t(consentLabelKey(pending))}
      </label>
      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={accept}
          disabled={!accepted || submitting}
          className={btnPrimary}
        >
          {submitting ? <ButtonSpinner /> : t('legal.gate.accept')}
        </button>
        <button type="button" onClick={() => void logout()} className={btnSecondary}>
          {t('nav.logout')}
        </button>
      </div>
      <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
        {t('legal.gate.decline')}{' '}
        <Link to="/account/settings/privacy" className={linkAccent}>
          {t('legal.gate.deleteAccount')}
        </Link>
      </p>
      {reading && <LegalDocumentDialog kind={reading} onClose={() => setReading(null)} />}
    </div>
  )
}
