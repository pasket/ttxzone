import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../../hooks/useApiDownload'
import { useDisclosureMenu } from '../../../hooks/useDisclosureMenu'
import { API_BASE } from '../../../lib/api'
import { btnSecondary, floatingSurface } from '../../../lib/buttonStyles'

// Export kinds (dashes) and the document keys of the checklist (underscores).
const KINDS = [
  ['sitman', 'sitman'],
  ['facilitator-guide', 'facilitator_guide'],
  ['inject-cards', 'inject_cards'],
  ['eeg', 'eeg'],
  ['evaluation-plan', 'evaluation_plan'],
  ['feedback-form', 'feedback_form'],
] as const

const menuItemClass =
  'block rounded-xs px-3 py-2 text-sm hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg'

/** The session documents as PDFs, one per audience. While there are
 * unsaved changes, or the MSEL can't be exported yet, the button waits
 * and says why. A <details> disclosure (useDisclosureMenu). */
export function ConductPrepDownloads({
  ttxId,
  blockedReason,
}: {
  ttxId: string
  blockedReason: string | null
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.slice(0, 2)
  const menuRef = useDisclosureMenu()
  const download = useApiDownload()
  const kinds = t('creator.conductPrep.documents.kinds', { returnObjects: true }) as Record<
    string,
    string
  >
  const audiences = t('creator.conductPrep.documents.audiences', {
    returnObjects: true,
  }) as Record<string, string>
  const button = `${btnSecondary} inline-flex h-8 items-center py-0 text-xs`

  if (blockedReason) {
    return (
      <span className="inline-flex items-center gap-2">
        <span id="cp-downloads-blocked" className="text-xs text-paper-ink/60 dark:text-fg-faint">
          {blockedReason}
        </span>
        <button type="button" disabled aria-describedby="cp-downloads-blocked" className={button}>
          {t('creator.conductPrep.documents.download')}
        </button>
      </span>
    )
  }

  return (
    <details ref={menuRef} className="relative">
      <summary className={`${button} cursor-pointer list-none`}>
        {t('creator.conductPrep.documents.download')}
        <span aria-hidden="true" className="ml-1.5">
          ▾
        </span>
      </summary>
      <ul
        aria-label={t('creator.conductPrep.documents.menuLabel')}
        className={`absolute right-0 z-40 mt-1 w-72 space-y-0.5 p-1 ${floatingSurface}`}
      >
        {KINDS.map(([kind, key]) => {
          const path = `/ttx/${ttxId}/conduct-prep/export/${kind}.pdf?lang=${lang}`
          return (
            <li key={kind}>
              <a
                href={`${API_BASE}${path}`}
                download
                onClick={download(path)}
                className={menuItemClass}
              >
                <span className="block font-medium">{kinds[key]}</span>
                <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
                  {audiences[key]}
                </span>
              </a>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
