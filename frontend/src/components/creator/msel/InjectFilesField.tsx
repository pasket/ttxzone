import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiDownload } from '../../../hooks/useApiDownload'
import { ApiError, API_BASE, apiFetch } from '../../../lib/api'
import { btnNeutralIconGhost, btnSecondary, inputBase, linkAccent } from '../../../lib/buttonStyles'
import { formatSize } from '../../../lib/fileSize'
import { isTextPreviewable } from '../../../lib/textPreview'
import { mselFilePath, type InjectFileDraft } from '../../../lib/msel'
import type { MselFileUpload } from '../../../lib/types'
import { ButtonSpinner } from '../../common/ButtonSpinner'
import { FileDigest } from '../../common/FileDigest'
import { TextFilePreviewButton } from '../../common/TextFilePreview'
import { IconButton } from '../../common/IconButton'

/** The backend's MAX_INJECT_FILES. */
export const MAX_INJECT_FILES = 10

/** What an upload refusal means, by the backend's code. */
const UPLOAD_ERRORS: Record<string, 'tooLarge' | 'empty' | 'limit'> = {
  MSEL_FILE_TOO_LARGE: 'tooLarge',
  MSEL_FILE_EMPTY: 'empty',
  MSEL_FILE_LIMIT: 'limit',
}

/** The files an inject hands the players to download and analyse (a log
 * excerpt, a packet capture, a memory dump...), in order, each with an
 * optional description. Any type: the server stores it as uploaded and
 * only ever serves it as a download. A picked file is uploaded at once and
 * joins the list; the MSEL's save links it. Removing one only drops it
 * from this inject. */
export function InjectFilesField({
  id,
  ttxId,
  files,
  disabled,
  onChange,
}: {
  id: string
  ttxId: string
  files: InjectFileDraft[]
  disabled: boolean
  onChange: (files: InjectFileDraft[]) => void
}) {
  const { t, i18n } = useTranslation()
  const download = useApiDownload()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = files.length >= MAX_INJECT_FILES

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const stored = await apiFetch<MselFileUpload>(`/ttx/${ttxId}/msel/files`, {
        method: 'POST',
        body,
      })
      onChange([
        ...files,
        {
          file_id: stored.id,
          name: stored.name,
          size_bytes: stored.size_bytes,
          sha256: stored.sha256,
          description: '',
        },
      ])
    } catch (caught) {
      const key = caught instanceof ApiError ? UPLOAD_ERRORS[caught.code] : undefined
      setError(t(`creator.msel.files.errors.${key ?? 'generic'}`))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function move(index: number, by: -1 | 1) {
    const next = [...files]
    const [file] = next.splice(index, 1)
    next.splice(index + by, 0, file)
    onChange(next)
  }

  return (
    <fieldset id={id} tabIndex={-1} className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">
        {t('creator.msel.files.legend')}{' '}
        <span className="font-normal text-paper-ink/60 dark:text-fg-faint">
          ({t('common.optionalSuffix')})
        </span>
      </legend>
      <p id={`${id}-hint`} className="text-xs text-paper-ink/60 dark:text-fg-faint">
        {t('creator.msel.files.hint')}
      </p>
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={file.file_id}
              className="flex items-start gap-3 rounded-xs border border-paper-line p-2 dark:border-line"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                  <a
                    href={`${API_BASE}${mselFilePath(ttxId, file.file_id)}`}
                    download
                    onClick={download(mselFilePath(ttxId, file.file_id))}
                    className={`min-w-0 truncate ${linkAccent}`}
                  >
                    {file.name}
                  </a>
                  <span className="shrink-0 text-xs tabular-nums text-paper-ink/60 dark:text-fg-faint">
                    {formatSize(file.size_bytes, i18n.language)}
                  </span>
                  {isTextPreviewable(file.name) && (
                    <TextFilePreviewButton
                      path={mselFilePath(ttxId, file.file_id)}
                      name={file.name}
                    />
                  )}
                </p>
                <FileDigest sha256={file.sha256} />
                <label className="block space-y-1">
                  <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
                    {t('creator.msel.files.description')}
                  </span>
                  <input
                    name={`file-description-${file.file_id}`}
                    autoComplete="off"
                    value={file.description}
                    maxLength={255}
                    disabled={disabled}
                    onChange={(event) =>
                      onChange(
                        files.map((other, i) =>
                          i === index ? { ...other, description: event.target.value } : other,
                        ),
                      )
                    }
                    className={`${inputBase} w-full`}
                  />
                </label>
              </div>
              {!disabled && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={btnNeutralIconGhost}
                    disabled={index === 0}
                    aria-label={t('creator.msel.files.moveUp', { name: file.name })}
                    title={t('creator.msel.files.moveUp', { name: file.name })}
                    onClick={() => move(index, -1)}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className={btnNeutralIconGhost}
                    disabled={index === files.length - 1}
                    aria-label={t('creator.msel.files.moveDown', { name: file.name })}
                    title={t('creator.msel.files.moveDown', { name: file.name })}
                    onClick={() => move(index, 1)}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <IconButton
                    label={t('creator.msel.files.remove', { name: file.name })}
                    onClick={() => onChange(files.filter((_, i) => i !== index))}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!disabled && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void upload(file)
            }}
          />
          <button
            type="button"
            className={btnSecondary}
            disabled={uploading || full}
            aria-describedby={`${id}-hint`}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <ButtonSpinner /> : t('creator.msel.files.add')}
          </button>
          {full && (
            <span className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.msel.files.full', { max: MAX_INJECT_FILES })}
            </span>
          )}
          {error && (
            <span role="alert" className="text-xs text-danger-fg">
              {error}
            </span>
          )}
        </div>
      )}
    </fieldset>
  )
}
