import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/useAuth'
import { linkAccent } from '../../lib/buttonStyles'

const PRIVACY_PATH = '/account/settings/privacy'

const MESSAGE_KEYS = {
  both: 'legal.banner.both',
  terms: 'legal.banner.terms',
  privacy: 'legal.banner.privacy',
} as const

/** Legal documents this account hasn't accepted yet -- typically published
 * while it was signed in, so the API refuses most requests and each screen
 * shows that refusal. One line under the header saying what to accept,
 * with a link to Preferences -> Privacy, where each one is read and
 * accepted. Nothing there itself, or with nothing pending. */
export function LegalPendingBanner() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { pathname } = useLocation()

  const pending = user?.legal_acceptance_pending ?? []
  if (pending.length === 0 || pathname === PRIVACY_PATH) return null

  const kinds = new Set(pending.map((document) => document.kind))
  const which =
    kinds.has('terms') && kinds.has('privacy') ? 'both' : kinds.has('terms') ? 'terms' : 'privacy'
  return (
    <div
      role="status"
      className="border-b border-panel-line bg-panel px-4 py-2 text-sm text-paper-ink/80 dark:text-fg-muted"
    >
      {t(MESSAGE_KEYS[which])}{' '}
      <Link to={PRIVACY_PATH} className={`font-medium underline ${linkAccent}`}>
        {t('legal.banner.review')}
      </Link>
    </div>
  )
}
