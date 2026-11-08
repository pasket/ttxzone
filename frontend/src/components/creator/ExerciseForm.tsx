import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { sameIds, useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { apiFetch, ApiError } from '../../lib/api'
import {
  btnPrimary,
  btnSecondary,
  inputBase,
  inputDisabled,
  optionalSuffix,
} from '../../lib/buttonStyles'
import { initials } from '../../lib/initials'
import { panelFormActions } from '../../lib/panelStyles'
import type { TTXRead, TTXTag } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { ImageUploadField } from '../common/ImageUploadField'
import { Panel } from '../common/Panel'
import { FormattedTextArea } from '../common/FormattedTextArea'
import { TagAssignmentField } from '../common/TagAssignmentField'

/** Mirrors the backend's TTX description limit. */
const DESCRIPTION_MAX = 10000

/** The languages an exercise's content can be written in (the supported
 * locales), each named in itself. */
const CONTENT_LANGUAGES = ['en', 'es'] as const
const LANGUAGE_NAME_KEYS = { en: 'nav.languageEn', es: 'nav.languageEs' } as const

/** One form for both creating an exercise (no `exercise`) and editing the
 * active one. Everything -- the image and tags included -- is staged until
 * the single Save, then applied in order: POST/PATCH, image, tags. */
export function ExerciseForm({
  exercise,
  organizationId,
  availableTags,
  tagsHint,
  onSaved,
  onCancel,
  proposed,
}: {
  exercise?: TTXRead
  /** An AI proposal accepted on the page: these fields start as proposed,
   * for the Planner to review and save. */
  proposed?: { name?: string; description?: string; content_language?: string | null }
  organizationId: string
  /** The exercise's own tags (the exercise level of the Library), owned
   * by the host page so its planning team shares them. `undefined` while
   * loading and when creating (a new exercise has none yet), which hides
   * the picker. */
  availableTags: TTXTag[] | undefined
  /** Shown under the tag checkboxes: where to manage the tags. */
  tagsHint?: ReactNode
  onSaved: (saved: TTXRead) => void | Promise<void>
  /** Omitted when there's nowhere to go back to (a first exercise). */
  onCancel?: () => void
}) {
  const { t, i18n } = useTranslation()
  const isEditing = exercise !== undefined
  // An exercise from before it was recorded has none: the select asks.
  const initialLanguage = isEditing
    ? (exercise.content_language ?? '')
    : (CONTENT_LANGUAGES.find((lang) => i18n.language.startsWith(lang)) ?? 'en')
  const [contentLanguage, setContentLanguage] = useState(
    proposed?.content_language ?? initialLanguage,
  )
  const [name, setName] = useState(proposed?.name ?? exercise?.name ?? '')
  const [description, setDescription] = useState(
    proposed?.description ?? exercise?.description ?? '',
  )
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageObjectUrl, setImageObjectUrl] = useState<string | null>(null)
  const [imageRemoved, setImageRemoved] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(
    () => new Set(exercise?.tags.map((tag) => tag.id) ?? []),
  )
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameInputRef.current?.focus()
  }, [])

  // Revoke each staged preview URL once it's replaced, cleared or unmounted.
  useEffect(() => {
    if (!imageObjectUrl) return
    return () => URL.revokeObjectURL(imageObjectUrl)
  }, [imageObjectUrl])

  const dirty =
    imageFile !== null ||
    imageRemoved ||
    name !== (exercise?.name ?? '') ||
    description !== (exercise?.description ?? '') ||
    contentLanguage !== initialLanguage ||
    !sameIds(selectedTagIds, exercise?.tags.map((tag) => tag.id) ?? [])
  useUnsavedChangesWarning(dirty && !submitting)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim().length === 0) {
      setError(t('creator.exercises.nameRequiredError'))
      return
    }
    setSubmitting(true)
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        // Unset (an older exercise) stays unset until someone picks one.
        ...(contentLanguage ? { content_language: contentLanguage } : {}),
      }
      let saved = isEditing
        ? await apiFetch<TTXRead>(`/ttx/${exercise.id}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
          })
        : await apiFetch<TTXRead>('/ttx', {
            method: 'POST',
            body: JSON.stringify({ ...body, organization_id: organizationId }),
          })
      if (imageFile) {
        const formData = new FormData()
        formData.append('file', imageFile)
        saved = await apiFetch<TTXRead>(`/ttx/${saved.id}/image`, {
          method: 'POST',
          body: formData,
        })
      } else if (imageRemoved && exercise?.image_url) {
        saved = await apiFetch<TTXRead>(`/ttx/${saved.id}/image`, { method: 'DELETE' })
      }
      // A tag deleted from the library meanwhile is dropped, not sent --
      // only once the list is known, so a Save before it loads keeps them.
      const tagIds = Array.from(selectedTagIds).filter(
        (id) => !availableTags || availableTags.some((tag) => tag.id === id),
      )
      if (
        !sameIds(
          new Set(tagIds),
          saved.tags.map((tag) => tag.id),
        )
      ) {
        saved = await apiFetch<TTXRead>(`/ttx/${saved.id}/tags/apply`, {
          method: 'PUT',
          body: JSON.stringify({ tag_ids: tagIds }),
        })
      }
      await onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setSubmitting(false)
    }
  }

  const previewUrl = imageRemoved ? null : (imageObjectUrl ?? exercise?.image_url ?? null)

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onCancel) onCancel()
      }}
    >
      <Panel
        title={t(isEditing ? 'creator.exercises.updateTitle' : 'creator.exercises.createTitle')}
        footer={
          <div className={panelFormActions}>
            {onCancel && (
              <button type="button" onClick={onCancel} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
            )}
            <button type="submit" disabled={submitting} className={btnPrimary}>
              {submitting ? (
                <ButtonSpinner />
              ) : (
                t(isEditing ? 'creator.exercises.updateSubmit' : 'creator.exercises.createSubmit')
              )}
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="max-w-sm space-y-5">
            <ImageUploadField
              label={
                <>
                  {t('creator.exercises.imageLabel')}{' '}
                  <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
                </>
              }
              previewUrl={previewUrl}
              fallback={name.trim() ? initials(name) : undefined}
              onFileSelect={(file) => {
                setImageFile(file)
                setImageObjectUrl(URL.createObjectURL(file))
                setImageRemoved(false)
              }}
              onRemove={() => {
                setImageFile(null)
                setImageObjectUrl(null)
                setImageRemoved(true)
              }}
              busy={submitting}
              uploadLabel={t('creator.exercises.uploadImage')}
              removeLabel={t('creator.exercises.removeImage')}
              size="h-16 w-16"
              shape="square"
            />
            <div className="space-y-1.5">
              <label className="block text-sm" htmlFor="exercise-name">
                {t('creator.exercises.nameLabel')}
              </label>
              <input
                autoComplete="off"
                ref={nameInputRef}
                id="exercise-name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={submitting}
                className={submitting ? inputDisabled : inputBase}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm" htmlFor="exercise-content-language">
                {t('creator.exercises.contentLanguageLabel')}
              </label>
              <select
                id="exercise-content-language"
                value={contentLanguage}
                onChange={(e) => setContentLanguage(e.target.value)}
                disabled={submitting}
                className={submitting ? inputDisabled : inputBase}
                aria-describedby="exercise-content-language-hint"
              >
                {!contentLanguage && (
                  <option value="" disabled>
                    {t('creator.exercises.contentLanguageUnset')}
                  </option>
                )}
                {CONTENT_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {t(LANGUAGE_NAME_KEYS[lang])}
                  </option>
                ))}
              </select>
              <p
                id="exercise-content-language-hint"
                className="text-xs text-paper-ink/60 dark:text-fg-muted"
              >
                {t('creator.exercises.contentLanguageHint')}
              </p>
            </div>
          </div>
          {/* The description takes the panel's full width: room to write. */}
          <div className="space-y-1.5">
            <label className="block text-sm" htmlFor="exercise-description">
              {t('creator.exercises.descriptionLabel')}{' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </label>
            <FormattedTextArea
              id="exercise-description"
              value={description}
              onChange={setDescription}
              placeholder={t('creator.exercises.descriptionPlaceholder')}
              rows={10}
              maxLength={DESCRIPTION_MAX}
              disabled={submitting}
            />
          </div>
          {availableTags && (
            <div className="space-y-1.5">
              <span className="block text-sm">{t('creator.exercises.tagsLabel')}</span>
              {availableTags.length > 0 ? (
                <TagAssignmentField
                  availableTags={availableTags}
                  selectedTagIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                />
              ) : (
                <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
                  {t('creator.exercise.noTagsYet')}
                </p>
              )}
              {tagsHint && (
                <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{tagsHint}</p>
              )}
            </div>
          )}
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      </Panel>
    </form>
  )
}
