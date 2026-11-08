import { useRef } from 'react'
import type { ReactNode } from 'react'

import { btnSecondary } from '../../lib/buttonStyles'
import { ButtonSpinner } from './ButtonSpinner'

/** Shared shape for every "circular image + Upload/Remove" field in the
 * app (Avatar, Organization logo, TTX exercise image) -- same preview
 * slot, same buttons, same reserved-space behavior.
 * Upload timing is the caller's business (immediate API call for
 * Avatar/Logo, staged-until-form-submit for TTX images) -- this
 * component only reports which file was picked, via `onFileSelect`.
 * The preview slot is always in the DOM at a fixed size, even with no
 * image and no `fallback`, so picking a file never shifts layout. With
 * no `fallback` and no image, the slot renders fully empty (no
 * background) rather than an accent-colored blank circle -- decoration
 * only appears once there's something to show. `shape="square"` is for
 * brand marks (the Organization logo): rounded-square hairline tile with a
 * neutral fallback, matching the profile's identity band. */
export function ImageUploadField({
  label,
  previewUrl,
  fallback,
  onFileSelect,
  onRemove,
  busy = false,
  uploadLabel,
  removeLabel,
  size = 'h-12 w-12',
  shape = 'circle',
}: {
  label: ReactNode
  previewUrl: string | null
  fallback?: ReactNode
  onFileSelect: (file: File) => void
  onRemove?: () => void
  busy?: boolean
  uploadLabel: string
  removeLabel?: string
  size?: string
  shape?: 'circle' | 'square'
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasContent = previewUrl !== null || fallback !== undefined

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFileSelect(file)
  }

  return (
    <div className="space-y-2">
      <span className="block text-sm text-paper-ink dark:text-fg">{label}</span>
      <div className="flex items-center gap-3">
        <div
          className={`flex ${size} shrink-0 items-center justify-center overflow-hidden ${
            shape === 'square'
              ? 'rounded-md border border-paper-line bg-hover text-base font-semibold text-paper-ink/70 dark:border-line dark:text-fg-muted'
              : `rounded-full ${hasContent ? 'bg-accent text-base font-semibold text-ink' : ''}`
          }`}
        >
          {previewUrl ? (
            <img
              width={64}
              height={64}
              src={previewUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            fallback
          )}
        </div>
        <input
          name="image"
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className={btnSecondary}
        >
          {busy ? <ButtonSpinner /> : uploadLabel}
        </button>
        {onRemove && previewUrl && removeLabel && (
          <button type="button" onClick={onRemove} disabled={busy} className={btnSecondary}>
            {removeLabel}
          </button>
        )}
      </div>
    </div>
  )
}
