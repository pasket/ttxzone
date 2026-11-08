import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuth } from '../../hooks/useAuth'
import { apiFetch, ApiError } from '../../lib/api'
import { AVATAR_PRESETS, findAvatarPreset } from '../../lib/avatarPresets'
import { ImageUploadField } from '../common/ImageUploadField'

const MAX_BYTES = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export function AvatarPicker() {
  const { t } = useTranslation()
  const { user, refresh } = useAuth()

  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const activePreset =
    user?.avatar_kind === 'preset' && user.avatar_value
      ? findAvatarPreset(user.avatar_value)
      : undefined
  const previewUrl =
    activePreset?.src ??
    (user?.avatar_kind === 'upload' && user.avatar_value ? user.avatar_value : null)

  async function selectPreset(presetKey: string) {
    setError(null)
    setBusyKey(presetKey)
    try {
      await apiFetch('/auth/avatar/preset', {
        method: 'POST',
        body: JSON.stringify({ preset_key: presetKey }),
      })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusyKey(null)
    }
  }

  async function handleFileSelect(file: File) {
    setError(null)

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError(t('account.settings.avatar.invalidType'))
      return
    }
    if (file.size > MAX_BYTES) {
      setError(t('account.settings.avatar.tooLarge'))
      return
    }

    setBusyKey('upload')
    try {
      const formData = new FormData()
      formData.append('file', file)
      await apiFetch('/auth/avatar/upload', { method: 'POST', body: formData })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRemove() {
    setError(null)
    setBusyKey('remove')
    try {
      await apiFetch('/auth/avatar', { method: 'DELETE' })
      await refresh()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
    } finally {
      setBusyKey(null)
    }
  }

  return (
    <div className="space-y-3">
      <ImageUploadField
        label={t('account.settings.avatar.title')}
        previewUrl={previewUrl}
        fallback={user?.full_name.charAt(0).toUpperCase() ?? ''}
        onFileSelect={(file) => void handleFileSelect(file)}
        onRemove={() => void handleRemove()}
        busy={busyKey !== null}
        uploadLabel={t('account.settings.avatar.upload')}
        removeLabel={t('account.settings.avatar.remove')}
        size="h-12 w-12"
      />

      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {AVATAR_PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => void selectPreset(preset.key)}
            disabled={busyKey !== null}
            aria-label={t(preset.labelKey)}
            aria-pressed={user?.avatar_kind === 'preset' && user.avatar_value === preset.key}
            className={`overflow-hidden rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg focus-visible:ring-offset-2 focus-visible:ring-offset-panel ${
              user?.avatar_kind === 'preset' && user.avatar_value === preset.key
                ? 'border-accent'
                : 'border-transparent hover:border-paper-line dark:hover:border-line'
            }`}
          >
            <img width={40} height={40} src={preset.src} alt="" className="h-10 w-10" />
          </button>
        ))}
      </div>

      {error && (
        <p className="text-sm text-danger-fg" aria-live="polite">
          {error}
        </p>
      )}
    </div>
  )
}
