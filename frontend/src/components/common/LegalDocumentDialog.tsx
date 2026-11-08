import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { btnSecondary } from '../../lib/buttonStyles'
import { LEGAL_TITLE_KEYS } from '../../lib/legal'
import type { LegalDocumentKind, LegalDocumentRead } from '../../lib/types'
import { FormattedText } from './FormattedText'
import { Modal } from './Modal'

/** One published legal document (the deployment's terms of service or
 * privacy policy), read from the signup form, the acceptance screen and
 * About. In the user's language when published in it, else the one there
 * is, with a note. */
export function LegalDocumentDialog({
  kind,
  onClose,
}: {
  kind: LegalDocumentKind
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const { data, error } = useApiResource<LegalDocumentRead>(
    `/legal/${kind}?lang=${encodeURIComponent(i18n.language)}`,
  )

  return (
    <Modal titleId="legal-document-title" onClose={onClose} size="lg" align="top">
      <div className="space-y-1">
        <h2 id="legal-document-title" className="text-balance text-lg font-semibold tracking-tight">
          {t(LEGAL_TITLE_KEYS[kind])}
        </h2>
        {data && (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('legal.versionLine', {
              version: data.version,
              date: new Intl.DateTimeFormat(i18n.language, { dateStyle: 'long' }).format(
                new Date(data.published_at),
              ),
            })}
          </p>
        )}
      </div>
      {data && !data.requested_language_available && (
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{t('legal.otherLanguage')}</p>
      )}
      {error && <p className="text-sm text-danger-fg">{t('legal.loadError')}</p>}
      {data && (
        <div lang={data.language} className="max-h-[60vh] overflow-y-auto pr-2 text-sm">
          <FormattedText text={data.content} headings />
        </div>
      )}
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={btnSecondary}>
          {t('legal.close')}
        </button>
      </div>
    </Modal>
  )
}
