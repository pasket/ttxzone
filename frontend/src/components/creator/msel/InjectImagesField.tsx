import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, apiFetch } from '../../../lib/api'
import { btnNeutralIconGhost, btnSecondary, inputBase } from '../../../lib/buttonStyles'
import { mselImageUrl, type InjectImageDraft } from '../../../lib/msel'
import type { MselImageUpload } from '../../../lib/types'
import { ButtonSpinner } from '../../common/ButtonSpinner'
import { IconButton } from '../../common/IconButton'

/** The backend's MAX_INJECT_IMAGES. */
export const MAX_INJECT_IMAGES = 10

/** What an upload refusal means, by the backend's code. */
const UPLOAD_ERRORS: Record<string, 'invalidType' | 'tooLarge' | 'limit'> = {
  MSEL_IMAGE_INVALID_TYPE: 'invalidType',
  MSEL_IMAGE_TOO_LARGE: 'tooLarge',
  MSEL_IMAGE_LIMIT: 'limit',
}

/** The images an inject shows the players (a ransom note, a leak-site
 * screenshot...), in order, each with an optional caption. A picked file
 * is uploaded at once (the server re-encodes it) and joins the list; the
 * MSEL's save links it. Removing one only drops it from this inject. */
export function InjectImagesField({
  id,
  ttxId,
  images,
  disabled,
  onChange,
}: {
  id: string
  ttxId: string
  images: InjectImageDraft[]
  disabled: boolean
  onChange: (images: InjectImageDraft[]) => void
}) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = images.length >= MAX_INJECT_IMAGES

  async function upload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const image = await apiFetch<MselImageUpload>(`/ttx/${ttxId}/msel/images`, {
        method: 'POST',
        body,
      })
      onChange([
        ...images,
        { image_id: image.id, caption: '', width: image.width, height: image.height },
      ])
    } catch (caught) {
      const key = caught instanceof ApiError ? UPLOAD_ERRORS[caught.code] : undefined
      setError(t(`creator.msel.images.errors.${key ?? 'generic'}`))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function move(index: number, by: -1 | 1) {
    const next = [...images]
    const [image] = next.splice(index, 1)
    next.splice(index + by, 0, image)
    onChange(next)
  }

  return (
    <fieldset id={id} tabIndex={-1} className="min-w-0 space-y-2">
      <legend className="text-sm font-medium">
        {t('creator.msel.images.legend')}{' '}
        <span className="font-normal text-paper-ink/60 dark:text-fg-faint">
          ({t('common.optionalSuffix')})
        </span>
      </legend>
      <p id={`${id}-hint`} className="text-xs text-paper-ink/60 dark:text-fg-faint">
        {t('creator.msel.images.hint')}
      </p>
      {images.length > 0 && (
        <ul className="space-y-2">
          {images.map((image, index) => (
            <li
              key={image.image_id}
              className="flex items-start gap-3 rounded-xs border border-paper-line p-2 dark:border-line"
            >
              <img
                width={112}
                height={80}
                loading="lazy"
                src={mselImageUrl(ttxId, image.image_id)}
                alt={image.caption || t('creator.msel.images.alt', { n: index + 1 })}
                className="h-20 w-28 shrink-0 rounded-xs bg-field object-contain"
              />
              <label className="min-w-0 flex-1 space-y-1">
                <span className="block text-xs text-paper-ink/60 dark:text-fg-faint">
                  {t('creator.msel.images.caption')}
                </span>
                <input
                  name={`image-caption-${image.image_id}`}
                  autoComplete="off"
                  value={image.caption}
                  maxLength={255}
                  disabled={disabled}
                  onChange={(event) =>
                    onChange(
                      images.map((other, i) =>
                        i === index ? { ...other, caption: event.target.value } : other,
                      ),
                    )
                  }
                  className={`${inputBase} w-full`}
                />
              </label>
              {!disabled && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    className={btnNeutralIconGhost}
                    disabled={index === 0}
                    aria-label={t('creator.msel.images.moveUp', { n: index + 1 })}
                    title={t('creator.msel.images.moveUp', { n: index + 1 })}
                    onClick={() => move(index, -1)}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    className={btnNeutralIconGhost}
                    disabled={index === images.length - 1}
                    aria-label={t('creator.msel.images.moveDown', { n: index + 1 })}
                    title={t('creator.msel.images.moveDown', { n: index + 1 })}
                    onClick={() => move(index, 1)}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <IconButton
                    label={t('creator.msel.images.remove', { n: index + 1 })}
                    onClick={() => onChange(images.filter((_, i) => i !== index))}
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
            accept="image/png,image/jpeg,image/webp"
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
            {uploading ? <ButtonSpinner /> : t('creator.msel.images.add')}
          </button>
          {full && (
            <span className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.msel.images.full', { max: MAX_INJECT_IMAGES })}
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
