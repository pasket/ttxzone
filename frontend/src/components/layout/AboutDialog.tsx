import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import logoModoDark from '../../assets/logos/logo-modo-dark.svg'
import logoModoLight from '../../assets/logos/logo-modo-light.svg'
import { useApiResource } from '../../hooks/useApiResource'
import { useTheme } from '../../hooks/useTheme'
import { AUTHOR, BUILD_INFO, LICENSE_URL, ORIGINAL_SOURCE_URL } from '../../lib/buildInfo'
import { btnSecondary } from '../../lib/buttonStyles'
import { LEGAL_TITLE_KEYS } from '../../lib/legal'
import type { LegalDocumentKind, LegalDocumentListResponse } from '../../lib/types'
import { LegalDocumentDialog } from '../common/LegalDocumentDialog'
import { Modal } from '../common/Modal'

const dtClass = 'text-paper-ink/70 dark:text-fg-muted'
const linkClass = 'underline-offset-2 hover:underline'

const updatedAt = BUILD_INFO.updatedAt ? new Date(BUILD_INFO.updatedAt) : null
// The copyright runs to the last update; without one, to the year the app
// was loaded.
const copyrightYear = (updatedAt ?? new Date()).getFullYear()

/** "About TTX-Zone", from the avatar menu: which build is running (version,
 * commit, date of the last update), its licence and source code, the
 * deployment's legal documents once published, credits and copyright. The
 * author credit and the original source stay in every build (NOTICE); a
 * modified build links its own source through VITE_SOURCE_URL. */
export function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation()
  const { theme } = useTheme()
  const unknown = t('about.unknown')
  const legal = useApiResource<LegalDocumentListResponse>('/legal')
  const legalDocuments = legal.data?.items ?? []
  const [reading, setReading] = useState<LegalDocumentKind | null>(null)

  return (
    <Modal titleId="about-title" onClose={onClose}>
      <img
        src={theme === 'dark' ? logoModoDark : logoModoLight}
        alt=""
        width={640}
        height={240}
        className="h-auto w-40"
      />
      <div className="space-y-1">
        <h2 id="about-title" className="text-balance text-lg font-semibold tracking-tight">
          {t('about.title', { name: t('common.app.name') })}
        </h2>
        <p className="text-sm text-pretty text-paper-ink/70 dark:text-fg-muted">
          {t('common.app.tagline')}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className={dtClass}>{t('about.version')}</dt>
        <dd className="font-mono">{BUILD_INFO.version}</dd>
        <dt className={dtClass}>{t('about.commit')}</dt>
        <dd className="font-mono">{BUILD_INFO.commit ?? unknown}</dd>
        <dt className={dtClass}>{t('about.updatedAt')}</dt>
        <dd>
          {updatedAt ? (
            <time dateTime={BUILD_INFO.updatedAt!}>
              {new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(updatedAt)}
            </time>
          ) : (
            unknown
          )}
        </dd>
        <dt className={dtClass}>{t('about.license')}</dt>
        <dd>
          <a href={LICENSE_URL} target="_blank" rel="noreferrer" className={linkClass}>
            {t('about.licenseName')}
          </a>
        </dd>
        <dt className={dtClass}>{t('about.sourceCode')}</dt>
        <dd className="min-w-0 break-all">
          <a
            href={BUILD_INFO.sourceUrl ?? ORIGINAL_SOURCE_URL}
            target="_blank"
            rel="noreferrer"
            className={`font-mono ${linkClass}`}
          >
            {BUILD_INFO.sourceUrl ?? ORIGINAL_SOURCE_URL}
          </a>
        </dd>
        {legalDocuments.length > 0 && (
          <>
            <dt className={dtClass}>{t('about.legal')}</dt>
            <dd>
              {legalDocuments.map((document, index) => (
                <span key={document.kind}>
                  {index > 0 && ' · '}
                  <button
                    type="button"
                    onClick={() => setReading(document.kind)}
                    className={`${linkClass} text-left`}
                  >
                    {t(LEGAL_TITLE_KEYS[document.kind])}
                  </button>
                </span>
              ))}
            </dd>
          </>
        )}
      </dl>
      <div className="space-y-1 text-sm">
        <h3 className="font-semibold">{t('about.credits')}</h3>
        <p className="text-pretty">
          {t('about.author', { name: t('common.app.name'), author: AUTHOR })}
          {BUILD_INFO.sourceUrl && (
            <>
              {' '}
              <a href={ORIGINAL_SOURCE_URL} target="_blank" rel="noreferrer" className={linkClass}>
                {t('about.originalSource')}
              </a>
            </>
          )}
        </p>
        <p className="text-pretty text-paper-ink/70 dark:text-fg-muted">{t('about.attack')}</p>
        <p className="text-pretty text-paper-ink/70 dark:text-fg-muted">{t('about.typeface')}</p>
      </div>
      <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
        {t('about.copyright', { year: copyrightYear, author: AUTHOR })}
      </p>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('about.close')}
        </button>
      </div>
      {reading && <LegalDocumentDialog kind={reading} onClose={() => setReading(null)} />}
    </Modal>
  )
}
