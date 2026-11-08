import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { btnNeutralIconGhost } from '../../../lib/buttonStyles'
import { INJECT_FORMATS } from '../../../lib/msel'
import type { InjectFormat } from '../../../lib/types'

const GLYPHS: Record<InjectFormat, ReactNode> = {
  // A message coming in.
  inject: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1.5" />
      <path d="m3.5 6.5 8.5 7 8.5-7" />
    </>
  ),
  // Two people talking.
  discussion: (
    <>
      <path d="M4 5h11v8H9l-3.5 3v-3H4z" />
      <path d="M18 9h2v7h-1.5v2.5L15.5 16H11" />
    </>
  ),
  // Options, one of them chosen.
  poll: (
    <>
      <circle cx="6" cy="7" r="2" />
      <path d="M11 7h9" />
      <circle cx="6" cy="17" r="2" />
      <path d="M11 17h9" />
      <path d="m4.8 7 .9.9 1.6-1.8" />
    </>
  ),
}

/** The first thing a new inject asks: what it is. All three in view, each
 * with what it does; picking one opens its steps. */
export function InjectFormatChooser({
  titleId,
  onChoose,
  onClose,
}: {
  titleId: string
  onChoose: (format: InjectFormat) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-balance">
            {t('creator.msel.formats.chooserTitle')}
          </h2>
          <p className="text-sm text-pretty text-paper-ink/60 dark:text-fg-faint">
            {t('creator.msel.formats.chooserHint')}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('creator.msel.wizard.closeDialog')}
          title={t('creator.msel.wizard.closeDialog')}
          className={btnNeutralIconGhost}
        >
          <span aria-hidden="true" className="text-lg leading-none">
            ×
          </span>
        </button>
      </div>
      <ul className="grid gap-3 md:grid-cols-3">
        {INJECT_FORMATS.map((format) => (
          <li key={format} className="flex">
            <button
              type="button"
              onClick={() => onChoose(format)}
              className="flex w-full flex-col gap-3 rounded-sm border border-paper-line p-4 text-left transition-colors hover:border-accent hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent-fg focus-visible:outline-none dark:border-line"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-7 w-7 text-paper-ink/70 dark:text-fg-muted"
              >
                {GLYPHS[format]}
              </svg>
              <span className="space-y-1">
                <span className="block text-base font-semibold">
                  {t(`creator.msel.formats.${format}`)}
                </span>
                <span className="block text-sm text-pretty text-paper-ink/60 dark:text-fg-faint">
                  {t(`creator.msel.formats.${format}Hint`)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
