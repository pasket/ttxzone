import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { btnSecondary } from '../../lib/buttonStyles'
import { formatSize } from '../../lib/fileSize'
import type { MselFilePreview } from '../../lib/types'
import { Modal } from './Modal'

/** "Preview" next to a text file's download (a log, a CSV export): opens
 * its beginning as plain text in a dialog -- decoded by the server and
 * shown as text, never rendered, so markup or escape codes in a log are
 * harmless. `path` is the file's download path; the preview is its
 * `/preview`. */
export function TextFilePreviewButton({ path, name }: { path: string; name: string }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('common.files.preview.open', { name })}
        className="text-xs font-medium text-accent-fg hover:text-accent-fg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
      >
        {t('common.files.preview.label')}
      </button>
      {open && <TextFilePreviewDialog path={path} name={name} onClose={() => setOpen(false)} />}
    </>
  )
}

function TextFilePreviewDialog({
  path,
  name,
  onClose,
}: {
  path: string
  name: string
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const preview = useApiResource<MselFilePreview>(`${path}/preview`)
  const [wrap, setWrap] = useState(true)
  const data = preview.data
  const lines = data ? data.text.split('\n').length : 0

  return (
    <Modal titleId="text-file-preview-title" onClose={onClose} size="2xl" align="top">
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2
            id="text-file-preview-title"
            className="min-w-0 break-all font-mono text-base font-semibold"
          >
            {name}
          </h2>
          {data && (
            <p className="text-xs tabular-nums text-paper-ink/60 dark:text-fg-muted">
              {formatSize(data.size_bytes, i18n.language)} · {data.encoding.toUpperCase()} ·{' '}
              {t('common.files.preview.lines', { count: lines })}
            </p>
          )}
        </div>
        {preview.error ? (
          <p role="alert" className="text-sm text-paper-ink/80 dark:text-fg-muted">
            {preview.error.message}
          </p>
        ) : !data ? (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{t('common.loading')}</p>
        ) : (
          <>
            {data.truncated && (
              <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                {t('common.files.preview.truncated', {
                  size: formatSize(data.limit_bytes, i18n.language),
                })}
              </p>
            )}
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={wrap}
                onChange={(event) => setWrap(event.target.checked)}
                className="accent-accent-fg"
              />
              {t('common.files.preview.wrap')}
            </label>
            <pre
              tabIndex={0}
              aria-label={t('common.files.preview.contents', { name })}
              translate="no"
              className={`max-h-[65vh] overflow-auto rounded-sm border border-panel-line bg-field p-3 font-mono text-xs leading-relaxed ${wrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'}`}
            >
              {data.text}
            </pre>
          </>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.files.preview.close')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
