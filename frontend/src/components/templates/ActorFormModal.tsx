import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { ActorFields } from '../../lib/actorLibrary'
import type { LibraryLevel } from '../../lib/libraryLevels'
import { btnPrimary, btnSecondary, inputDisabled } from '../../lib/buttonStyles'
import { ACTOR_TYPES, DELIVERY_METHODS } from '../../lib/msel'
import { hasFinePointer } from '../../lib/pointer'
import type { ActorOrigin, ActorType, DeliveryMethod } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'
import { Field, Select, TextArea, TextInput } from '../creator/needs/fields'
import { ContainerNameInput } from './ContainerNameInput'

export type ActorFormValues = ActorFields & { played_by?: string }

/** Read-only: which library level (and actor) this one was copied from.
 * The name is the original's at copy time, so it still reads after the
 * original is renamed or deleted. */
export function CopiedFrom({ origin, name }: { origin: ActorOrigin; name: string | null }) {
  const { t } = useTranslation()
  return (
    <div className="space-y-1.5">
      <label htmlFor="actor-copied-from" className="block text-sm font-medium">
        {t('templates.actors.fields.copiedFrom')}
      </label>
      <input
        name="actor-copied-from"
        autoComplete="off"
        id="actor-copied-from"
        readOnly
        value={`${t(`templates.actors.origins.${origin}.label`)} · ${name ?? '—'}`}
        className={inputDisabled}
      />
    </div>
  )
}

/** Create or edit one actor of the library (organization or exercise).
 * `played_by` only for an exercise's cast: who voices it depends on the
 * session, so the library doesn't hold it. */
export function ActorFormModal({
  title,
  level,
  initial,
  withPlayedBy = false,
  readOnly = false,
  onSubmit,
  onClose,
}: {
  title: string
  /** Where the actor lives (shown in front of its name). */
  level: LibraryLevel
  initial: ActorFormValues
  withPlayedBy?: boolean
  /** Look, don't change: an organization actor seen from Creator. */
  readOnly?: boolean
  onSubmit: (values: ActorFormValues) => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<ActorFormValues>) => setValues({ ...values, ...patch })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await onSubmit({ ...values, name: values.name.trim() })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="actor-form-title" onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <h2 id="actor-form-title" className="text-balance text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {values.origin && <CopiedFrom origin={values.origin} name={values.origin_name} />}
        <fieldset disabled={readOnly} className="min-w-0 space-y-4">
          <Field id="actor-form-name" label={t('creator.msel.fields.name')}>
            <ContainerNameInput
              id="actor-form-name"
              level={level}
              value={values.name}
              maxLength={255}
              autoFocus={!readOnly && hasFinePointer()}
              onChange={(name) => set({ name })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="actor-form-type" label={t('creator.msel.fields.type')}>
              <Select<ActorType>
                id="actor-form-type"
                value={values.type}
                onChange={(type) => set({ type })}
                options={ACTOR_TYPES.map((value) => ({
                  value,
                  label: t(`creator.msel.actorTypes.${value}`),
                }))}
              />
            </Field>
            <Field id="actor-form-channel" label={t('templates.actors.fields.channel')} optional>
              <Select<DeliveryMethod | ''>
                id="actor-form-channel"
                value={values.channel ?? ''}
                onChange={(channel) => set({ channel: channel || null })}
                options={[
                  { value: '', label: t('templates.actors.noChannel') },
                  ...DELIVERY_METHODS.map((value) => ({
                    value,
                    label: t(`creator.msel.deliveryMethods.${value}`),
                  })),
                ]}
              />
            </Field>
          </div>
          <Field
            id="actor-form-description"
            label={t('templates.actors.fields.description')}
            optional
          >
            <TextArea
              id="actor-form-description"
              value={values.description}
              rows={3}
              placeholder={t('templates.actors.descriptionPlaceholder')}
              onChange={(description) => set({ description })}
            />
          </Field>
          {withPlayedBy && (
            <Field id="actor-form-played-by" label={t('creator.msel.fields.played_by')} optional>
              <TextInput
                id="actor-form-played-by"
                value={values.played_by ?? ''}
                maxLength={255}
                onChange={(played_by) => set({ played_by })}
              />
            </Field>
          )}
        </fieldset>
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
