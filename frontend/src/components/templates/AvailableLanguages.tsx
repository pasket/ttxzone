import { useTranslation } from 'react-i18next'

import type { ContentLanguage } from '../../lib/types'

/** The languages a library item's content exists in -- a fact about the
 * item, whatever the reader's own language. As codes, since the column
 * repeats them on every row; the names are for hover and screen readers.
 * Nothing stated: a dash. */
export function AvailableLanguages({ languages }: { languages: readonly ContentLanguage[] }) {
  const { t } = useTranslation()
  if (languages.length === 0) return <>—</>
  const name = (value: ContentLanguage) => t(`templates.scenarios.languages.${value}`)
  return (
    <>
      <span aria-hidden="true" translate="no" className="inline-flex gap-1">
        {languages.map((value) => (
          <span
            key={value}
            title={name(value)}
            className="rounded-xs border border-panel-line px-1.5 font-mono text-xs/5 text-paper-ink/70 uppercase dark:text-fg-muted"
          >
            {value}
          </span>
        ))}
      </span>
      <span className="sr-only">{languages.map(name).join(', ')}</span>
    </>
  )
}
