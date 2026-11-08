import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { codeRefText } from '../../lib/codeRef'
import { useApiResource } from '../../hooks/useApiResource'
import { useAttackConversionSummary } from '../../hooks/useAttackConversionSummary'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnPrimary, btnSecondary, linkAccent } from '../../lib/buttonStyles'
import {
  contentLanguage,
  proposedPhaseIndex,
  templateTexts,
  toExerciseInject,
  variablesIn,
} from '../../lib/injectLibrary'
import { formatOffset } from '../../lib/msel'
import type { AttackConversion, Msel, OrganizationInjectFields } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'
import { CheckboxGroup, Field, Select, TextInput } from '../creator/needs/fields'
import { VariableFields } from './VariableFields'
import { objectiveName } from '../../lib/needsForm'

const noteClass = 'text-sm text-pretty text-paper-ink/70 dark:text-fg-muted'

/** Add a library inject to the exercise's MSEL: the choices that only make
 * sense inside the exercise -- phase (proposed by the inject's stage),
 * session minute, objectives (proposed by its capabilities) -- and the
 * scenario details its {variables} stand for. The sender is found in the
 * cast or added to it by the server. */
export function InjectCopyDialog({
  fields,
  ttxId,
  onClose,
  onCopied,
}: {
  fields: OrganizationInjectFields
  ttxId: string
  onClose: () => void
  onCopied: (msel: Msel) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const summarize = useAttackConversionSummary()
  const { activeOrganization, ttxList } = useAuth()
  const exerciseLanguage = ttxList.find((ttx) => ttx.id === ttxId)?.content_language
  // An organization inject written in another language: said, never
  // blocked (its text is adapted in the MSEL).
  const otherLanguage =
    fields.language && exerciseLanguage && fields.language !== contentLanguage(exerciseLanguage, '')
      ? fields.language
      : null
  const resource = useApiResource<Msel>(`/ttx/${ttxId}/msel`)
  const msel = resource.data
  const variables = variablesIn(templateTexts(fields))

  return (
    <Modal titleId="inject-copy-title" onClose={onClose} size="lg">
      <h2 id="inject-copy-title" className="text-balance text-lg font-semibold tracking-tight">
        {t('templates.injects.copy.title', { name: fields.title })}
      </h2>
      {otherLanguage && exerciseLanguage && (
        <p className={noteClass}>
          {t('templates.injects.copy.languageMismatch', {
            inject: t(`templates.injects.copy.languageNames.${otherLanguage}`),
            exercise: t(
              `templates.injects.copy.languageNames.${contentLanguage(exerciseLanguage, '')}`,
            ),
          })}
        </p>
      )}
      {resource.error ? (
        <p className={noteClass}>
          {resource.error instanceof ApiError && resource.error.code === 'NEEDS_FORM_NOT_APPROVED'
            ? t('templates.injects.copy.notAvailable')
            : resource.error.message}
        </p>
      ) : !msel ? (
        <ButtonSpinner />
      ) : !msel.editable ? (
        <p className={noteClass}>{t('templates.injects.copy.readOnly')}</p>
      ) : msel.phases.length === 0 ? (
        <p className={noteClass}>
          {t('templates.injects.copy.noPhases')}{' '}
          <Link to={`/creator/${ttxId}/msel?tab=phases`} className={linkAccent}>
            {t('templates.injects.copy.goToPhases')}
          </Link>
        </p>
      ) : (
        <CopyForm
          fields={fields}
          msel={msel}
          variables={variables}
          initialValues={Object.fromEntries(
            variables.map((name) => [
              name,
              name === 'organization'
                ? (activeOrganization?.organization_name ?? '')
                : name === 'organization_short'
                  ? (activeOrganization?.alias ?? '')
                  : (fields.variable_defaults[name] ?? ''),
            ]),
          )}
          onCancel={onClose}
          onSubmit={async (payload) => {
            try {
              const { msel: next, conversion } = await apiFetch<{
                msel: Msel
                conversion: AttackConversion
              }>(`/ttx/${ttxId}/msel/injects`, {
                method: 'POST',
                body: JSON.stringify(payload),
              })
              // Its techniques were moved onto the MSEL's ATT&CK release:
              // say what changed, if anything.
              showToast(
                [
                  t('templates.injects.copiedToExercise', {
                    name: payload.title,
                    code: next.injects[next.injects.length - 1]?.code ?? '',
                  }),
                  summarize(conversion),
                ]
                  .filter(Boolean)
                  .join(' '),
              )
              onCopied(next)
            } catch (err) {
              showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
                variant: 'error',
              })
            }
          }}
        />
      )}
      {(resource.error || (msel && (!msel.editable || msel.phases.length === 0))) && (
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('templates.injects.detail.close')}
          </button>
        </div>
      )}
    </Modal>
  )
}

function CopyForm({
  fields,
  msel,
  variables,
  initialValues,
  onSubmit,
  onCancel,
}: {
  fields: OrganizationInjectFields
  msel: Msel
  variables: string[]
  initialValues: Record<string, string>
  onSubmit: (payload: ReturnType<typeof toExerciseInject>) => Promise<void>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [phaseId, setPhaseId] = useState(
    msel.phases[proposedPhaseIndex(fields.stage, msel.phases.length)].id,
  )
  // Minutes after the chosen phase starts (0 = as it opens); sent as
  // session minutes (T+).
  const [offset, setOffset] = useState('0')
  const phaseStart = msel.phases.find((p) => p.id === phaseId)?.start_offset ?? 0
  const [objectiveIds, setObjectiveIds] = useState(
    msel.needs.objectives
      .filter((o) => fields.capabilities.includes(o.capability))
      .map((o) => o.id),
  )
  const [values, setValues] = useState(initialValues)
  const [busy, setBusy] = useState(false)
  // Whose activity the template's techniques are: the scenario's first
  // threat actor by default ("" = none yet), or noise.
  const threatActors = msel.threat_actors ?? []
  const [attribution, setAttribution] = useState(threatActors[0]?.id ?? '')

  function pickPhase(id: string) {
    setPhaseId(id)
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    try {
      const payload = toExerciseInject(
        fields,
        {
          phaseId,
          objectiveIds,
          offset: offset === '' ? null : phaseStart + Math.max(0, Number(offset)),
        },
        values,
        msel.time_compression,
        t('templates.injects.copy.keyQuestionLabel'),
      )
      await onSubmit({
        ...payload,
        ...(fields.attack.length > 0
          ? attribution === 'noise'
            ? { attack_attribution: 'noise' as const, threat_actor_id: null }
            : { attack_attribution: 'threat_actor' as const, threat_actor_id: attribution || null }
          : {}),
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="inject-copy-phase" label={t('templates.injects.copy.phase')}>
            <Select<string>
              id="inject-copy-phase"
              value={phaseId}
              onChange={pickPhase}
              options={msel.phases.map((p) => ({
                value: p.id,
                label: codeRefText(p.code, p.name),
              }))}
            />
          </Field>
          {fields.kind === 'mandatory' && (
            <Field
              id="inject-copy-offset"
              label={t('templates.injects.copy.offset')}
              hint={
                offset === ''
                  ? undefined
                  : t('creator.msel.hints.offsetInSession', {
                      time: formatOffset(phaseStart + Math.max(0, Number(offset))),
                    })
              }
            >
              <TextInput
                id="inject-copy-offset"
                type="number"
                min={0}
                value={offset}
                onChange={setOffset}
              />
            </Field>
          )}
        </div>
        {fields.format === 'inject' && (
          <CheckboxGroup<string>
            id="inject-copy-objectives"
            legend={t('templates.injects.copy.objectives')}
            hint={t('templates.injects.copy.objectivesHint')}
            options={msel.needs.objectives.map((o) => ({
              value: o.id,
              code: o.code,
              label: objectiveName(o),
              badge: t(`creator.needs.capabilities.${o.capability}`),
            }))}
            selected={objectiveIds}
            onChange={setObjectiveIds}
          />
        )}
        {fields.attack.length > 0 && (
          <Field
            id="inject-copy-attribution"
            label={t('templates.injects.copy.attribution')}
            hint={t('templates.injects.copy.attributionHint', {
              count: fields.attack.length,
            })}
          >
            <Select<string>
              id="inject-copy-attribution"
              hint
              value={attribution}
              onChange={setAttribution}
              options={[
                ...(threatActors.length === 0
                  ? [{ value: '', label: t('creator.msel.attribution.chooseActor') }]
                  : threatActors.map((a) => ({ value: a.id, label: codeRefText(a.code, a.name) }))),
                { value: 'noise', label: t('creator.msel.attribution.noise') },
              ]}
            />
          </Field>
        )}
        <VariableFields
          legend={t('templates.injects.copy.variables')}
          hint={t('templates.injects.copy.variablesHint')}
          variables={variables}
          values={values}
          onChange={setValues}
        />
        {fields.actor_name && (
          <p className={noteClass}>
            {t('templates.injects.copy.sender', { name: fields.actor_name })}
          </p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          {t('common.confirmButton.cancel')}
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? <ButtonSpinner /> : t('templates.injects.copy.submit')}
        </button>
      </div>
    </form>
  )
}
