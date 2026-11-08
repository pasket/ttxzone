import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { LegalConsent } from '../../hooks/useLegalConsent'
import { linkAccent } from '../../lib/buttonStyles'
import { consentLabelKey, LEGAL_TITLE_KEYS } from '../../lib/legal'
import type { LegalDocumentKind } from '../../lib/types'
import { LegalDocumentDialog } from '../common/LegalDocumentDialog'

/** The signup checkbox for the deployment's published legal documents,
 * with a link to read each one. Renders nothing while none is published. */
export function LegalConsentField({ consent, id }: { consent: LegalConsent; id: string }) {
  const { t } = useTranslation()
  const [reading, setReading] = useState<LegalDocumentKind | null>(null)

  if (consent.documents.length === 0) return null

  return (
    <div className="space-y-1 pt-1">
      <label className="flex items-start gap-2 text-sm" htmlFor={id}>
        <input
          id={id}
          name="accept-legal"
          type="checkbox"
          checked={consent.accepted}
          onChange={(e) => consent.setAccepted(e.target.checked)}
          required
          className="mt-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        />
        {t(consentLabelKey(consent.documents))}
      </label>
      <p className="pl-6 text-sm">
        {consent.documents.map((document, index) => (
          <span key={document.kind}>
            {index > 0 && ' · '}
            <button
              type="button"
              onClick={() => setReading(document.kind)}
              className={`underline-offset-2 hover:underline ${linkAccent}`}
            >
              {t(LEGAL_TITLE_KEYS[document.kind])}
            </button>
          </span>
        ))}
      </p>
      {reading && <LegalDocumentDialog kind={reading} onClose={() => setReading(null)} />}
    </div>
  )
}
