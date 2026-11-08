import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { useApiDownload } from '../../../hooks/useApiDownload'
import { API_BASE } from '../../../lib/api'
import { btnSecondary, linkAccent } from '../../../lib/buttonStyles'

/** The full MSEL as a PDF, for the planning team. Offered once the saved
 * MSEL has no errors (the backend enforces it too); while there are
 * unsaved changes it waits, so the document always matches the screen.
 * The session documents (SitMan, guide, cards, EEG) are in the Session plan. */
export function MselDownloads({
  ttxId,
  blockedReason,
}: {
  ttxId: string
  blockedReason: string | null
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language.slice(0, 2)
  const download = useApiDownload()
  const path = `/ttx/${ttxId}/msel/export/msel.pdf?lang=${lang}`
  const button = `${btnSecondary} inline-flex h-8 items-center py-0 text-xs`

  return (
    <span className="inline-flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <Link
        to={`/creator/${ttxId}/conduct-prep?step=documents`}
        className={`${linkAccent} text-xs`}
      >
        {t('creator.msel.downloads.movedHint')}
      </Link>
      {blockedReason ? (
        <>
          <span
            id="msel-downloads-blocked"
            className="text-xs text-paper-ink/60 dark:text-fg-faint"
          >
            {blockedReason}
          </span>
          <button
            type="button"
            disabled
            aria-describedby="msel-downloads-blocked"
            className={button}
          >
            {t('creator.msel.downloads.button')}
          </button>
        </>
      ) : (
        <a href={`${API_BASE}${path}`} download onClick={download(path)} className={button}>
          {t('creator.msel.downloads.button')}
        </a>
      )}
    </span>
  )
}
