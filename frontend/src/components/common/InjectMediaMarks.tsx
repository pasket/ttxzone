import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg
      className="h-3.5 w-3.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Small marks beside an inject's title in a list: it carries images
 * and/or files, so it reads at a glance which injects come with material.
 * Monochrome (colour marks state only); the count and a spoken label say
 * what each mark means. Nothing when the inject has neither. */
export function InjectMediaMarks({ images = 0, files = 0 }: { images?: number; files?: number }) {
  const { t } = useTranslation()
  if (images === 0 && files === 0) return null
  const mark = 'inline-flex items-center gap-0.5 tabular-nums'
  return (
    <span className="ml-2 inline-flex items-center gap-2 align-middle text-xs font-normal text-paper-ink/60 dark:text-fg-muted">
      {images > 0 && (
        <span className={mark} title={t('templates.injects.media.images', { count: images })}>
          <Glyph>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <circle cx="9" cy="10" r="1.8" />
            <path d="m21 16-5-5-8 8" />
          </Glyph>
          <span aria-hidden="true">{images}</span>
          <span className="sr-only">{t('templates.injects.media.images', { count: images })}</span>
        </span>
      )}
      {files > 0 && (
        <span className={mark} title={t('templates.injects.media.files', { count: files })}>
          <Glyph>
            <path d="m20 11.5-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4L15 7" />
          </Glyph>
          <span aria-hidden="true">{files}</span>
          <span className="sr-only">{t('templates.injects.media.files', { count: files })}</span>
        </span>
      )}
    </span>
  )
}
