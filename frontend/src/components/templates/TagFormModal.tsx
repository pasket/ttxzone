import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { LibraryLevel } from '../../lib/libraryLevels'
import { hasFinePointer } from '../../lib/pointer'
import {
  CUSTOM_HEX_PATTERN,
  TAG_COLOR_LABEL_KEYS,
  TAG_COLORS,
  tagColorProps,
  type TagColor,
} from '../../lib/tagColors'
import { TAG_NAME_MAX, type TagFields } from '../../lib/tagLibrary'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'
import { TagChip } from '../common/TagChip'
import { Field, TextInput } from '../creator/needs/fields'
import { CopiedFrom } from './ActorFormModal'
import { ContainerNameInput } from './ContainerNameInput'

/** Create or edit one tag of the library (organization or exercise):
 * name, colour and -- for a copy -- what it was copied from. */
export function TagFormModal({
  title,
  level,
  initial,
  readOnly = false,
  onSubmit,
  onClose,
}: {
  title: string
  /** Where the tag lives (shown in front of its name). */
  level: LibraryLevel
  initial: TagFields
  /** Look, don't change: an organization tag seen from Creator. */
  readOnly?: boolean
  onSubmit: (values: TagFields) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<TagFields>) => setValues({ ...values, ...patch })
  const swatch = tagColorProps(values.color, values.custom_hex)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    const customHex = values.color === 'custom' ? (values.custom_hex ?? '') : null
    if (customHex !== null && !CUSTOM_HEX_PATTERN.test(customHex)) {
      setError(t('tagLibrary.customHexInvalid'))
      return
    }
    setError(null)
    setBusy(true)
    try {
      await onSubmit({ ...values, name: values.name.trim(), custom_hex: customHex })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="tag-form-title" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <h2 id="tag-form-title" className="text-balance text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {values.origin && <CopiedFrom origin={values.origin} name={values.origin_name} />}
        <fieldset disabled={readOnly} className="min-w-0 space-y-4">
          <Field id="tag-form-name" label={t('tagLibrary.nameLabel')}>
            <ContainerNameInput
              id="tag-form-name"
              level={level}
              value={values.name}
              maxLength={TAG_NAME_MAX}
              autoFocus={!readOnly && hasFinePointer()}
              onChange={(name) => set({ name })}
            />
          </Field>
          <Field id="tag-form-color" label={t('tagLibrary.colorLabel')}>
            <div className="flex items-center gap-2">
              <select
                id="tag-form-color"
                name="color"
                value={values.color}
                onChange={(e) => set({ color: e.target.value as TagColor })}
                className={inputBase}
              >
                {TAG_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {t(TAG_COLOR_LABEL_KEYS[c])}
                  </option>
                ))}
              </select>
              {/* An <option> can't carry a swatch: live preview beside it. */}
              <span
                aria-hidden="true"
                style={swatch.style}
                className={`h-5 w-5 shrink-0 rounded-full border ${swatch.className}`}
              />
            </div>
          </Field>
          {values.color === 'custom' && (
            <Field id="tag-form-custom-hex" label={t('tagLibrary.customHexLabel')}>
              <TextInput
                id="tag-form-custom-hex"
                value={values.custom_hex ?? ''}
                maxLength={7}
                required
                placeholder={t('tagLibrary.customHexPlaceholder')}
                onChange={(custom_hex) => set({ custom_hex })}
              />
            </Field>
          )}
          <div className="flex items-center gap-2 text-sm text-paper-ink/70 dark:text-fg-muted">
            <span>{t('tagLibrary.preview')}</span>
            <TagChip
              name={values.name.trim() || t('tagLibrary.nameLabel')}
              color={values.color}
              customHex={values.color === 'custom' ? values.custom_hex : null}
            />
          </div>
        </fieldset>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {readOnly ? t('templates.threats.close') : t('common.confirmButton.cancel')}
          </button>
          {!readOnly && (
            <button type="submit" disabled={busy || !values.name.trim()} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
