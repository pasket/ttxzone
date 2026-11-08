import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../hooks/useApiDownload'
import { API_BASE } from '../../lib/api'
import { btnSecondary } from '../../lib/buttonStyles'

const EXPORTS = [
  ['log.pdf', 'logPdf'],
  ['log.csv', 'logCsv'],
  ['aar.pdf', 'aar'],
] as const

/** The session's exports for the team: the execution log (PDF, CSV) and
 * the draft after-action report. */
export function RunDownloads({ ttxId }: { ttxId: string }) {
  const { t, i18n } = useTranslation()
  const download = useApiDownload()
  const lang = i18n.language.slice(0, 2)
  return (
    <section
      aria-label={t('playground.downloads.title')}
      className="flex flex-wrap items-center gap-x-3 gap-y-2"
    >
      <h3 className="text-xs font-semibold uppercase tracking-wide text-paper-ink/60 dark:text-fg-muted">
        {t('playground.downloads.title')}
      </h3>
      <div className="flex flex-wrap gap-2">
        {EXPORTS.map(([name, key]) => {
          const path = `/ttx/${ttxId}/run/export/${name}?lang=${lang}`
          return (
            <a
              key={name}
              href={`${API_BASE}${path}`}
              download
              onClick={download(path)}
              className={`${btnSecondary} inline-flex h-8 items-center py-0 text-xs`}
            >
              {t(`playground.downloads.${key}`)}
            </a>
          )
        })}
      </div>
    </section>
  )
}
