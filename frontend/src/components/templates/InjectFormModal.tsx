import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  btnNeutralIconGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputDisabled,
} from '../../lib/buttonStyles'
import {
  INJECT_AUDIENCES,
  INJECT_FAMILIES,
  INJECT_STAGES,
  SYSTEM_VARIABLES,
  templateTexts,
  variablesIn,
} from '../../lib/injectLibrary'
import { ACTOR_TYPES, DELIVERY_METHODS, INJECT_FORMATS, MAX_EXPECTED_ACTIONS } from '../../lib/msel'
import { CAPABILITIES } from '../../lib/needsForm'
import { hasFinePointer } from '../../lib/pointer'
import type {
  ActorType,
  Capability,
  ContentLanguage,
  DeliveryMethod,
  InjectAudience,
  InjectFamily,
  InjectFormat,
  InjectKind,
  InjectStage,
  OrganizationActor,
  OrganizationInjectFields,
  SystemActor,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'
import {
  CheckboxGroup,
  Field,
  ListInput,
  Select,
  TextArea,
  TextInput,
} from '../creator/needs/fields'
import { InjectPollFields } from '../creator/msel/InjectPollFields'
import { ContainerNameInput } from './ContainerNameInput'
import { VariableText } from './VariableText'

const OTHER_SENDER = 'other'
const legendClass = 'text-sm font-semibold tracking-tight'

/** Create or edit one inject of the organization's library. Everything a
 * template carries except its place in an exercise (phase, offset,
 * objectives), which is chosen when it's copied into an MSEL. The ATT&CK
 * techniques come with a copy and can only be removed here. */
export function InjectFormModal({
  title,
  initial,
  systemActors,
  organizationActors,
  readOnly = false,
  onSubmit,
  onClose,
}: {
  title: string
  initial: OrganizationInjectFields
  systemActors: SystemActor[]
  organizationActors: OrganizationActor[]
  /** Look, don't change: an organization inject seen from Creator. */
  readOnly?: boolean
  onSubmit: (values: OrganizationInjectFields) => Promise<void>
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const [values, setValues] = useState(initial)
  const [busy, setBusy] = useState(false)
  const set = (patch: Partial<OrganizationInjectFields>) => setValues({ ...values, ...patch })

  const scenarioVariables = variablesIn(templateTexts(values)).filter(
    (name) => !SYSTEM_VARIABLES.has(name),
  )

  // The sender select: a TTX-Zone or library actor (described, not
  // referenced), or a free one.
  const senderKey =
    values.actor_origin === 'system' && values.actor_origin_id
      ? `system:${values.actor_origin_id}`
      : values.actor_origin === 'organization' && values.actor_origin_id
        ? `organization:${values.actor_origin_id}`
        : OTHER_SENDER
  function pickSender(key: string) {
    const [level, id] = key.split(':')
    if (level === 'system') {
      const actor = systemActors.find((a) => a.id === id)
      if (actor)
        set({
          actor_name: spanish ? actor.name_es : actor.name_en,
          actor_type: actor.type,
          actor_origin: 'system',
          actor_origin_id: actor.id,
        })
    } else if (level === 'organization') {
      const actor = organizationActors.find((a) => a.id === id)
      if (actor)
        set({
          actor_name: actor.name,
          actor_type: actor.type,
          actor_origin: 'organization',
          actor_origin_id: actor.id,
        })
    } else {
      set({ actor_origin: null, actor_origin_id: null })
    }
  }

  const setAction = (
    index: number,
    patch: Partial<OrganizationInjectFields['expected_actions'][0]>,
  ) =>
    set({
      expected_actions: values.expected_actions.map((action, i) =>
        i === index ? { ...action, ...patch } : action,
      ),
    })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      await onSubmit({
        ...values,
        title: values.title.trim(),
        expected_actions: values.expected_actions.filter((a) => a.description.trim()),
        // Defaults only for the scenario variables the texts still use.
        variable_defaults: Object.fromEntries(
          scenarioVariables.map((name) => [name, values.variable_defaults[name] ?? '']),
        ),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal titleId="inject-form-title" onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <h2 id="inject-form-title" className="text-balance text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <fieldset
          disabled={readOnly}
          className="max-h-[65vh] min-w-0 space-y-4 overflow-y-auto pr-1"
        >
          {values.origin && (
            <div className="space-y-1.5">
              <label htmlFor="inject-copied-from" className="block text-sm font-medium">
                {t('templates.injects.form.copiedFrom')}
              </label>
              <input
                name="inject-copied-from"
                autoComplete="off"
                id="inject-copied-from"
                readOnly
                value={`${t(`templates.injects.origins.${values.origin}.label`)} · ${
                  values.origin === 'system' ? `${values.origin_id} ` : ''
                }${values.origin_name ?? '—'}`}
                className={inputDisabled}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <Field id="inject-form-title-input" label={t('templates.injects.form.title')}>
              {/* The inject library's editable level is the organization's
                  (an exercise's injects are edited on the MSEL page). */}
              <ContainerNameInput
                id="inject-form-title-input"
                level="organization"
                value={values.title}
                maxLength={255}
                autoFocus={!readOnly && hasFinePointer()}
                onChange={(value) => set({ title: value })}
              />
            </Field>
            <Field id="inject-form-language" label={t('templates.injects.form.language')}>
              <Select<ContentLanguage>
                id="inject-form-language"
                value={values.language}
                onChange={(language) => set({ language })}
                placeholder={t('templates.injects.form.languageNotStated')}
                options={(['en', 'es'] as const).map((value) => ({
                  value,
                  label: t(`templates.scenarios.languages.${value}`),
                }))}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="inject-form-format" label={t('templates.injects.form.format')}>
              <Select<InjectFormat>
                id="inject-form-format"
                value={values.format}
                onChange={(format) =>
                  set({
                    format,
                    ...(format === 'poll'
                      ? {
                          expected_actions: [],
                          poll_options: values.poll_options.length ? values.poll_options : ['', ''],
                        }
                      : {}),
                  })
                }
                options={INJECT_FORMATS.map((value) => ({
                  value,
                  label: t(`creator.msel.formats.${value}`),
                }))}
              />
            </Field>
            <Field id="inject-form-kind" label={t('templates.injects.form.kind')}>
              <Select<InjectKind>
                id="inject-form-kind"
                value={values.kind}
                onChange={(kind) => set({ kind })}
                options={(['mandatory', 'contingent'] as const).map((value) => ({
                  value,
                  label: t(`creator.msel.kinds.${value}`),
                }))}
              />
            </Field>
            <Field id="inject-form-stage" label={t('templates.injects.form.stage')}>
              <Select<InjectStage>
                id="inject-form-stage"
                value={values.stage}
                onChange={(stage) => set({ stage })}
                options={INJECT_STAGES.map((value) => ({
                  value,
                  label: t(`templates.injects.stages.${value}`),
                }))}
              />
            </Field>
            <Field id="inject-form-audience" label={t('templates.injects.form.audience')}>
              <Select<InjectAudience>
                id="inject-form-audience"
                value={values.audience}
                onChange={(audience) => set({ audience })}
                options={INJECT_AUDIENCES.map((value) => ({
                  value,
                  label: t(`templates.injects.audiences.${value}`),
                }))}
              />
            </Field>
          </div>

          {values.kind === 'contingent' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="inject-form-trigger" label={t('templates.injects.form.trigger')}>
                <TextArea
                  id="inject-form-trigger"
                  value={values.trigger_condition}
                  rows={2}
                  onChange={(trigger_condition) => set({ trigger_condition })}
                />
              </Field>
              <Field id="inject-form-purpose" label={t('templates.injects.form.purpose')}>
                <TextArea
                  id="inject-form-purpose"
                  value={values.contingent_purpose}
                  rows={2}
                  onChange={(contingent_purpose) => set({ contingent_purpose })}
                />
              </Field>
            </div>
          )}

          <Field
            id="inject-form-content"
            label={t('templates.injects.form.content')}
            hint={t('templates.injects.form.contentHint')}
          >
            <TextArea
              id="inject-form-content"
              value={values.content}
              rows={5}
              onChange={(content) => set({ content })}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="inject-form-sender" label={t('templates.injects.form.sender')}>
              <select
                id="inject-form-sender"
                name="inject-form-sender"
                value={senderKey}
                onChange={(event) => pickSender(event.target.value)}
                className={inputBase}
              >
                <optgroup label={t('templates.injects.form.systemActors')}>
                  {systemActors.map((actor) => (
                    <option key={actor.id} value={`system:${actor.id}`}>
                      {spanish ? actor.name_es : actor.name_en}
                    </option>
                  ))}
                </optgroup>
                {organizationActors.length > 0 && (
                  <optgroup label={t('templates.injects.form.organizationActors')}>
                    {organizationActors.map((actor) => (
                      <option key={actor.id} value={`organization:${actor.id}`}>
                        {actor.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={OTHER_SENDER}>{t('templates.injects.form.senderOther')}</option>
              </select>
            </Field>
            <Field id="inject-form-channel" label={t('templates.injects.form.channel')}>
              <Select<DeliveryMethod>
                id="inject-form-channel"
                value={values.delivery_method}
                onChange={(delivery_method) => set({ delivery_method })}
                options={DELIVERY_METHODS.map((value) => ({
                  value,
                  label: t(`creator.msel.deliveryMethods.${value}`),
                }))}
              />
            </Field>
          </div>
          {senderKey === OTHER_SENDER && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="inject-form-sender-name" label={t('templates.injects.form.senderName')}>
                <TextInput
                  id="inject-form-sender-name"
                  value={values.actor_name}
                  maxLength={255}
                  onChange={(actor_name) => set({ actor_name })}
                />
              </Field>
              <Field id="inject-form-sender-type" label={t('templates.injects.form.senderType')}>
                <Select<ActorType>
                  id="inject-form-sender-type"
                  value={values.actor_type}
                  onChange={(actor_type) => set({ actor_type })}
                  options={ACTOR_TYPES.map((value) => ({
                    value,
                    label: t(`creator.msel.actorTypes.${value}`),
                  }))}
                />
              </Field>
            </div>
          )}

          <ListInput
            id="inject-form-recipients"
            label={t('templates.injects.form.recipients')}
            values={values.recipients}
            placeholder={t('templates.injects.form.recipientsPlaceholder')}
            onChange={(recipients) => set({ recipients })}
            optional
          />

          {values.format === 'poll' && (
            <InjectPollFields
              id={(field) => `inject-form-${field}`}
              question={values.poll_question}
              options={values.poll_options}
              outcomes={values.poll_outcomes}
              impacts={[]}
              meters={[]}
              onChange={({ poll_question, poll_options, poll_outcomes }) =>
                set({
                  ...(poll_question === undefined ? {} : { poll_question }),
                  ...(poll_options === undefined ? {} : { poll_options }),
                  ...(poll_outcomes === undefined ? {} : { poll_outcomes }),
                })
              }
            />
          )}

          <fieldset hidden={values.format === 'poll'} className="space-y-3">
            <legend className={legendClass}>{t('templates.injects.form.expectedActions')}</legend>
            {values.expected_actions.map((action, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-sm border border-panel-line p-3 sm:grid-cols-[1fr_12rem_9rem_auto] sm:items-end"
              >
                <Field
                  id={`inject-form-action-${index}`}
                  label={t('templates.injects.form.actionDescription', { index: index + 1 })}
                >
                  <TextInput
                    id={`inject-form-action-${index}`}
                    value={action.description}
                    onChange={(description) => setAction(index, { description })}
                  />
                </Field>
                <Field
                  id={`inject-form-role-${index}`}
                  label={t('templates.injects.form.actionRole')}
                >
                  <TextInput
                    id={`inject-form-role-${index}`}
                    value={action.responsible_role}
                    maxLength={255}
                    onChange={(responsible_role) => setAction(index, { responsible_role })}
                  />
                </Field>
                <Field
                  id={`inject-form-within-${index}`}
                  label={t('templates.injects.form.actionWithin')}
                >
                  <TextInput
                    id={`inject-form-within-${index}`}
                    type="number"
                    min={1}
                    value={action.within_minutes === null ? '' : String(action.within_minutes)}
                    onChange={(text) =>
                      setAction(index, { within_minutes: text ? Math.max(1, Number(text)) : null })
                    }
                  />
                </Field>
                <button
                  type="button"
                  aria-label={t('templates.injects.form.removeAction', { index: index + 1 })}
                  title={t('templates.injects.form.removeAction', { index: index + 1 })}
                  onClick={() =>
                    set({ expected_actions: values.expected_actions.filter((_, i) => i !== index) })
                  }
                  className={btnNeutralIconGhost}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            ))}
            {values.expected_actions.length < MAX_EXPECTED_ACTIONS && (
              <button
                type="button"
                onClick={() =>
                  set({
                    expected_actions: [
                      ...values.expected_actions,
                      { description: '', responsible_role: '', within_minutes: null },
                    ],
                  })
                }
                className={btnSecondary}
              >
                <span aria-hidden="true">+ </span>
                {t('templates.injects.form.addAction')}
              </button>
            )}
          </fieldset>

          <Field id="inject-form-question" label={t('templates.injects.form.keyQuestion')} optional>
            <TextArea
              id="inject-form-question"
              value={values.key_question}
              rows={2}
              placeholder={t('templates.injects.form.keyQuestionPlaceholder')}
              onChange={(key_question) => set({ key_question })}
            />
          </Field>
          <Field id="inject-form-notes" label={t('templates.injects.form.notes')} optional>
            <TextArea
              id="inject-form-notes"
              value={values.facilitator_notes}
              rows={3}
              onChange={(facilitator_notes) => set({ facilitator_notes })}
            />
          </Field>
          <ListInput
            id="inject-form-attachments"
            label={t('templates.injects.form.attachments')}
            values={values.attachment_notes}
            placeholder={t('templates.injects.form.attachmentsPlaceholder')}
            onChange={(attachment_notes) => set({ attachment_notes })}
            optional
          />

          {scenarioVariables.length > 0 && (
            <fieldset className="space-y-2">
              <legend className={legendClass}>{t('templates.injects.form.variables')}</legend>
              <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
                {t('templates.injects.form.variablesHint')}
              </p>
              {scenarioVariables.map((name) => (
                <label
                  key={name}
                  className="grid items-center gap-2 text-sm sm:grid-cols-[12rem_1fr]"
                >
                  <span>
                    <VariableText text={`{${name}}`} />
                  </span>
                  <input
                    name={name}
                    autoComplete="off"
                    spellCheck={false}
                    value={values.variable_defaults[name] ?? ''}
                    maxLength={255}
                    onChange={(event) =>
                      set({
                        variable_defaults: {
                          ...values.variable_defaults,
                          [name]: event.target.value,
                        },
                      })
                    }
                    className={inputBase}
                  />
                </label>
              ))}
            </fieldset>
          )}

          <fieldset className="space-y-4">
            <legend className={legendClass}>{t('templates.injects.form.classification')}</legend>
            <CheckboxGroup<InjectFamily>
              id="inject-form-families"
              legend={t('templates.injects.form.families')}
              options={INJECT_FAMILIES.map(({ family, code }) => ({
                value: family,
                label: `${code} · ${t(`templates.injects.families.${family}`)}`,
              }))}
              selected={values.families}
              onChange={(families) => set({ families })}
              optional
            />
            <CheckboxGroup<Capability>
              id="inject-form-capabilities"
              legend={t('templates.injects.form.capabilities')}
              options={CAPABILITIES.map((value) => ({
                value,
                label: t(`creator.needs.capabilities.${value}`),
              }))}
              selected={values.capabilities}
              onChange={(capabilities) => set({ capabilities })}
              optional
            />
            {values.attack.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-sm font-medium">{t('templates.injects.form.attack')}</p>
                <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                  {t('templates.injects.form.attackHint')}
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {values.attack.map((ref) => (
                    <li
                      key={`${ref.tactic_id}-${ref.technique_id}`}
                      className="inline-flex items-center gap-1 rounded-xs border border-paper-line py-0.5 pr-1 pl-2 text-sm dark:border-line"
                    >
                      <span translate="no" className="font-mono">
                        {ref.technique_id}
                      </span>{' '}
                      {ref.technique_name}
                      <button
                        type="button"
                        aria-label={t('templates.injects.form.removeTechnique', {
                          technique: ref.technique_id,
                        })}
                        onClick={() =>
                          set({
                            attack: values.attack.filter(
                              (r) =>
                                r.technique_id !== ref.technique_id ||
                                r.tactic_id !== ref.tactic_id,
                            ),
                          })
                        }
                        className="rounded-xs px-1 text-paper-ink/60 hover:text-danger-fg focus-visible:ring-2 focus-visible:ring-accent-fg focus-visible:outline-none dark:text-fg-muted"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </fieldset>
        </fieldset>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {readOnly ? t('templates.threats.close') : t('common.confirmButton.cancel')}
          </button>
          {!readOnly && (
            <button type="submit" disabled={busy || !values.title.trim()} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
