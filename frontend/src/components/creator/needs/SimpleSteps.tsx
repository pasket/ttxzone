import { useTranslation } from 'react-i18next'

import { codeRefText } from '../../../lib/codeRef'
import {
  AAR_RECIPIENTS,
  CAPABILITIES,
  fieldDomId,
  FRAMEWORK_OTHER,
  LEVELS,
  MAX_CAPABILITIES,
  TLP_VALUES,
  TRIGGERS,
  objectiveName,
} from '../../../lib/needsForm'
import type { AarRecipient, Tlp } from '../../../lib/types'
import { AcronymText } from '../../common/AcronymText'
import { FieldGroup } from '../../common/FieldGroup'
import { TlpBadge } from '../../common/TlpBadge'
import { CheckboxGroup, Field, ListInput, Select, TextArea, TextInput } from './fields'
import type { StepProps } from './stepProps'

const stepClass = 'space-y-5'

/** A framed group of the needs form, titled from `creator.needs.fieldGroups`. */
function NeedsGroup({
  group,
  number,
  children,
}: {
  group:
    | 'document'
    | 'sponsor'
    | 'findings'
    | 'why'
    | 'regulations'
    | 'capabilities'
    | 'dates'
    | 'people'
  number?: number
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <FieldGroup
      id={`needs-group-${group}`}
      title={t(`creator.needs.fieldGroups.${group}.title`)}
      hint={t(`creator.needs.fieldGroups.${group}.hint`)}
      number={number}
    >
      {children}
    </FieldGroup>
  )
}

/** Section 0 -- document control. */
export function DocumentStep({ form, draft, update, isInvalid }: StepProps) {
  const { t } = useTranslation()
  return (
    <NeedsGroup group="document">
      <dl className="flex flex-wrap gap-x-10 gap-y-3">
        <div className="space-y-1">
          <dt className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('creator.needs.codeLabel')}
          </dt>
          <dd translate="no" className="font-mono text-sm">
            {form.exercise_code}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-paper-ink/60 dark:text-fg-faint">
            {t('creator.needs.fields.tlp')}
          </dt>
          <dd>
            <TlpBadge tlp={draft.tlp} />
          </dd>
        </div>
      </dl>
      <div className="grid gap-5 lg:grid-cols-3">
        <Field
          id={fieldDomId('tlp')}
          label={t('creator.needs.fields.tlp')}
          hint={t(`creator.needs.tlpHints.${draft.tlp}`)}
        >
          <Select<Tlp>
            id={fieldDomId('tlp')}
            value={draft.tlp}
            onChange={(tlp) => update({ tlp })}
            options={TLP_VALUES.map((value) => ({
              value,
              label: t(`creator.needs.tlp.${value}`),
            }))}
          />
        </Field>
        <Field id={fieldDomId('document_date')} label={t('creator.needs.fields.document_date')}>
          <TextInput
            id={fieldDomId('document_date')}
            type="date"
            required
            value={draft.document_date}
            onChange={(document_date) => update({ document_date })}
          />
        </Field>
        <Field id={fieldDomId('design_lead')} label={t('creator.needs.fields.design_lead')}>
          <TextInput
            id={fieldDomId('design_lead')}
            value={draft.design_lead}
            maxLength={255}
            autoComplete="name"
            placeholder={t('creator.needs.placeholders.design_lead')}
            invalid={isInvalid('design_lead')}
            onChange={(design_lead) => update({ design_lead })}
          />
        </Field>
      </div>
    </NeedsGroup>
  )
}

/** Section 1 -- sponsorship and governance. */
export function SponsorshipStep({ draft, update, isInvalid }: StepProps) {
  const { t } = useTranslation()
  return (
    <div className={stepClass}>
      <NeedsGroup group="sponsor">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={fieldDomId('sponsor_name')} label={t('creator.needs.fields.sponsor_name')}>
            <TextInput
              id={fieldDomId('sponsor_name')}
              value={draft.sponsor_name}
              maxLength={255}
              invalid={isInvalid('sponsor_name')}
              onChange={(sponsor_name) => update({ sponsor_name })}
            />
          </Field>
          <Field id={fieldDomId('sponsor_role')} label={t('creator.needs.fields.sponsor_role')}>
            <TextInput
              id={fieldDomId('sponsor_role')}
              value={draft.sponsor_role}
              maxLength={255}
              invalid={isInvalid('sponsor_role')}
              onChange={(sponsor_role) => update({ sponsor_role })}
            />
          </Field>
        </div>
        <Field
          id={fieldDomId('sponsor_motivation')}
          label={t('creator.needs.fields.sponsor_motivation')}
        >
          <TextArea
            id={fieldDomId('sponsor_motivation')}
            value={draft.sponsor_motivation}
            placeholder={t('creator.needs.placeholders.sponsor_motivation')}
            invalid={isInvalid('sponsor_motivation')}
            onChange={(sponsor_motivation) => update({ sponsor_motivation })}
          />
        </Field>
      </NeedsGroup>
      <NeedsGroup group="findings">
        <label
          className={`flex w-fit cursor-pointer items-center gap-2.5 text-sm ${
            isInvalid('findings_closure_commitment') ? 'text-danger-fg' : ''
          }`}
        >
          <input
            id={fieldDomId('findings_closure_commitment')}
            type="checkbox"
            checked={draft.findings_closure_commitment}
            onChange={(e) => update({ findings_closure_commitment: e.target.checked })}
            className="h-4 w-4 shrink-0 accent-accent-fg"
          />
          {t('creator.needs.fields.findings_closure_commitment')}
        </label>
        {/* Two columns, like the sponsor above: labels on one line, fields
            aligned; "other" sits under the recipient it completes. */}
        <div className="grid gap-5 sm:grid-cols-2 sm:items-start">
          <Field id={fieldDomId('findings_owner')} label={t('creator.needs.fields.findings_owner')}>
            <TextInput
              id={fieldDomId('findings_owner')}
              value={draft.findings_owner}
              maxLength={255}
              placeholder={t('creator.needs.placeholders.findings_owner')}
              invalid={isInvalid('findings_owner')}
              onChange={(findings_owner) => update({ findings_owner })}
            />
          </Field>
          <Field id={fieldDomId('aar_recipient')} label={t('creator.needs.fields.aar_recipient')}>
            <Select<AarRecipient>
              id={fieldDomId('aar_recipient')}
              value={draft.aar_recipient}
              placeholder={t('creator.needs.placeholders.aar_recipient')}
              invalid={isInvalid('aar_recipient')}
              onChange={(aar_recipient) => update({ aar_recipient })}
              options={AAR_RECIPIENTS.map((value) => ({
                value,
                label: t(`creator.needs.aarRecipients.${value}`),
              }))}
            />
          </Field>
          {draft.aar_recipient === 'other' && (
            <div className="sm:col-start-2">
              <Field
                id={fieldDomId('aar_recipient_other')}
                label={t('creator.needs.fields.aar_recipient_other')}
              >
                <TextInput
                  id={fieldDomId('aar_recipient_other')}
                  value={draft.aar_recipient_other}
                  maxLength={255}
                  invalid={isInvalid('aar_recipient_other')}
                  onChange={(aar_recipient_other) => update({ aar_recipient_other })}
                />
              </Field>
            </div>
          )}
        </div>
      </NeedsGroup>
    </div>
  )
}

/** Section 2 -- triggers. The regulations list only what helps choose
 * (label, name and who it applies to, grouped by jurisdiction, a "Requires
 * exercises" tag); why a tabletop suits each one appears only for the ones
 * ticked, where it helps shape the objectives. */
export function TriggersStep({ draft, update, isInvalid, catalog }: StepProps) {
  const { t, i18n } = useTranslation()
  const spanish = i18n.language.startsWith('es')
  const frameworks = catalog?.frameworks ?? []
  const selectedFrameworks = frameworks.filter((f) => draft.regulatory_frameworks.includes(f.id))
  return (
    <div className={stepClass}>
      <NeedsGroup group="why">
        <CheckboxGroup
          id={fieldDomId('triggers')}
          legend={t('creator.needs.fields.triggers')}
          options={TRIGGERS.map((value) => ({
            value,
            label: t(`creator.needs.triggers.${value}`),
          }))}
          selected={draft.triggers}
          invalid={isInvalid('triggers')}
          onChange={(triggers) =>
            update({
              triggers,
              // Sub-choices only mean something while their trigger is on.
              regulatory_frameworks: triggers.includes('regulatory')
                ? draft.regulatory_frameworks
                : [],
              regulatory_framework_other: triggers.includes('regulatory')
                ? draft.regulatory_framework_other
                : '',
              trigger_other: triggers.includes('other') ? draft.trigger_other : '',
            })
          }
          columns={2}
        />
        {draft.triggers.includes('other') && (
          <Field id={fieldDomId('trigger_other')} label={t('creator.needs.fields.trigger_other')}>
            <TextInput
              id={fieldDomId('trigger_other')}
              value={draft.trigger_other}
              maxLength={255}
              invalid={isInvalid('trigger_other')}
              onChange={(trigger_other) => update({ trigger_other })}
            />
          </Field>
        )}
      </NeedsGroup>
      {draft.triggers.includes('regulatory') && (
        <NeedsGroup group="regulations">
          <CheckboxGroup
            id={fieldDomId('regulatory_frameworks')}
            legend={t('creator.needs.fields.regulatory_frameworks')}
            legendHidden
            hint={t('creator.needs.regulations.hint')}
            options={[
              ...frameworks.map((f) => ({
                value: f.id,
                label: spanish ? f.label_es : f.label_en,
                description: [
                  spanish ? f.name_es : f.name_en,
                  spanish ? f.scope_es : f.scope_en,
                  ...(f.binding ? [] : [t('creator.needs.regulations.contractual')]),
                ].join(' · '),
                group: t(`creator.needs.regulations.jurisdictions.${f.jurisdiction}`),
                badge: f.requires_exercises
                  ? t('creator.needs.regulations.requiresExercises')
                  : undefined,
              })),
              {
                value: FRAMEWORK_OTHER,
                label: t('creator.needs.regulations.other'),
                group: t('creator.needs.regulations.jurisdictions.OTHER'),
              },
            ]}
            selected={draft.regulatory_frameworks}
            invalid={isInvalid('regulatory_frameworks')}
            onChange={(regulatory_frameworks) =>
              update({
                regulatory_frameworks,
                regulatory_framework_other: regulatory_frameworks.includes(FRAMEWORK_OTHER)
                  ? draft.regulatory_framework_other
                  : '',
              })
            }
            columns={2}
          />
          {draft.regulatory_frameworks.includes(FRAMEWORK_OTHER) && (
            <Field
              id={fieldDomId('regulatory_framework_other')}
              label={t('creator.needs.fields.regulatory_framework_other')}
            >
              <TextInput
                id={fieldDomId('regulatory_framework_other')}
                value={draft.regulatory_framework_other}
                maxLength={255}
                placeholder={t('creator.needs.placeholders.regulatory_framework_other')}
                invalid={isInvalid('regulatory_framework_other')}
                onChange={(regulatory_framework_other) => update({ regulatory_framework_other })}
              />
            </Field>
          )}
          {selectedFrameworks.length > 0 && (
            <section
              aria-labelledby="regulations-rationale-title"
              className="space-y-2 rounded-sm border border-paper-line p-3 dark:border-line"
            >
              <h3 id="regulations-rationale-title" className="text-balance text-sm font-medium">
                {t('creator.needs.regulations.rationaleTitle')}
              </h3>
              <dl className="space-y-2">
                {selectedFrameworks.map((f) => (
                  <div key={f.id} className="grid gap-x-3 gap-y-0.5 sm:grid-cols-[8rem_1fr]">
                    <dt className="text-sm font-semibold">
                      <AcronymText text={spanish ? f.label_es : f.label_en} />
                    </dt>
                    <dd className="text-sm text-pretty text-paper-ink/80 dark:text-fg-muted">
                      {spanish ? f.rationale_es : f.rationale_en}{' '}
                      <span
                        translate="no"
                        className="font-mono text-xs whitespace-nowrap text-paper-ink/60 dark:text-fg-faint"
                      >
                        {f.rationale_reference}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </NeedsGroup>
      )}
    </div>
  )
}

/** Section 4 -- capabilities to validate (at most four). */
export function CapabilitiesStep({ draft, update, isInvalid }: StepProps) {
  const { t } = useTranslation()
  return (
    <NeedsGroup group="capabilities">
      <CheckboxGroup
        id={fieldDomId('capabilities')}
        legend={t('creator.needs.fields.capabilities')}
        legendHidden
        hint={t('creator.needs.hints.capabilitiesLimit', { max: MAX_CAPABILITIES })}
        options={CAPABILITIES.map((value) => ({
          value,
          label: t(`creator.needs.capabilities.${value}`),
          description: draft.objectives
            .filter((objective) => objective.capability === value)
            .map((objective) =>
              codeRefText(
                objective.code,
                objectiveName(objective),
                t('creator.needs.table.pendingCode'),
              ),
            )
            .join('\n'),
        }))}
        selected={draft.capabilities}
        max={MAX_CAPABILITIES}
        invalid={isInvalid('capabilities')}
        columns={2}
        onChange={(capabilities) => update({ capabilities })}
      />
    </NeedsGroup>
  )
}

/** Section 6 -- scope. */
export function ScopeStep({ draft, update, isInvalid }: StepProps) {
  const { t } = useTranslation()
  return (
    <div className={stepClass}>
      <ScopeGroup number={1} id="scope-level" group="level">
        <CheckboxGroup
          id={fieldDomId('levels')}
          legend={t('creator.needs.fields.levels')}
          options={LEVELS.map((value) => ({ value, label: t(`creator.needs.levels.${value}`) }))}
          selected={draft.levels}
          invalid={isInvalid('levels')}
          onChange={(levels) => update({ levels })}
        />
      </ScopeGroup>
      <ScopeGroup number={2} id="scope-scope" group="scope">
        {/* What's in, and what's explicitly out, side by side. */}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={fieldDomId('perimeter')} label={t('creator.needs.fields.perimeter')}>
            <TextArea
              id={fieldDomId('perimeter')}
              value={draft.perimeter}
              placeholder={t('creator.needs.placeholders.perimeter')}
              invalid={isInvalid('perimeter')}
              onChange={(perimeter) => update({ perimeter })}
            />
          </Field>
          <Field id={fieldDomId('out_of_scope')} label={t('creator.needs.fields.out_of_scope')}>
            <TextArea
              id={fieldDomId('out_of_scope')}
              value={draft.out_of_scope}
              placeholder={t('creator.needs.placeholders.out_of_scope')}
              invalid={isInvalid('out_of_scope')}
              onChange={(out_of_scope) => update({ out_of_scope })}
            />
          </Field>
        </div>
      </ScopeGroup>
      {/* The participants are who the MSEL's injects go to: set apart, with
          what they're used for said where they're named. */}
      <ScopeGroup number={3} id="scope-participants" group="participants">
        <div className="space-y-1.5">
          <ListInput
            id={fieldDomId('participating_areas')}
            label={t('creator.needs.fields.participating_areas')}
            values={draft.participating_areas}
            placeholder={t('creator.needs.placeholders.areaInput')}
            invalid={isInvalid('participating_areas')}
            onChange={(participating_areas) => update({ participating_areas })}
          />
          <p className="rounded-sm border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-pretty">
            {t('creator.needs.scopeGroups.areasCallout')}
          </p>
        </div>
        <div className="space-y-1.5">
          <ListInput
            id={fieldDomId('third_parties')}
            label={t('creator.needs.fields.third_parties')}
            values={draft.third_parties}
            placeholder={t('creator.needs.placeholders.thirdPartyInput')}
            optional
            onChange={(third_parties) => update({ third_parties })}
          />
          <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
            {t('creator.needs.scopeGroups.thirdPartiesHint')}
          </p>
        </div>
      </ScopeGroup>
    </div>
  )
}

/** One of the three decisions the scope makes (level, scope, participants):
 * numbered, with what it's for (the participants' note says the MSEL
 * builds on them). */
function ScopeGroup({
  number,
  id,
  group,
  children,
}: {
  number: number
  id: string
  group: 'level' | 'scope' | 'participants'
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <FieldGroup
      id={id}
      number={number}
      title={t(`creator.needs.scopeGroups.${group}.title`)}
      hint={t(`creator.needs.scopeGroups.${group}.hint`)}
    >
      {children}
    </FieldGroup>
  )
}

/** Section 7 -- constraints and assumptions. */
export function ConstraintsStep({ draft, update, isInvalid }: StepProps) {
  const { t } = useTranslation()
  return (
    <div className={stepClass}>
      <NeedsGroup group="dates">
        <div className="grid gap-5 sm:grid-cols-3">
          <Field
            id={fieldDomId('date_window_start')}
            label={t('creator.needs.fields.date_window_start')}
          >
            <TextInput
              id={fieldDomId('date_window_start')}
              type="date"
              value={draft.date_window_start}
              max={draft.date_window_end || undefined}
              invalid={isInvalid('date_window_start')}
              onChange={(date_window_start) => update({ date_window_start })}
            />
          </Field>
          <Field
            id={fieldDomId('date_window_end')}
            label={t('creator.needs.fields.date_window_end')}
          >
            <TextInput
              id={fieldDomId('date_window_end')}
              type="date"
              value={draft.date_window_end}
              min={draft.date_window_start || undefined}
              invalid={isInvalid('date_window_end')}
              onChange={(date_window_end) => update({ date_window_end })}
            />
          </Field>
          <Field
            id={fieldDomId('max_duration_hours')}
            label={t('creator.needs.fields.max_duration_hours')}
          >
            <TextInput
              id={fieldDomId('max_duration_hours')}
              type="number"
              inputMode="numeric"
              min={1}
              max={720}
              value={draft.max_duration_hours}
              invalid={isInvalid('max_duration_hours')}
              onChange={(max_duration_hours) => update({ max_duration_hours })}
            />
          </Field>
        </div>
      </NeedsGroup>
      <NeedsGroup group="people">
        <Field
          id={fieldDomId('key_participants_availability')}
          label={t('creator.needs.fields.key_participants_availability')}
        >
          <TextArea
            id={fieldDomId('key_participants_availability')}
            value={draft.key_participants_availability}
            invalid={isInvalid('key_participants_availability')}
            onChange={(key_participants_availability) => update({ key_participants_availability })}
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id={fieldDomId('confidentiality_restrictions')}
            label={t('creator.needs.fields.confidentiality_restrictions')}
            optional
          >
            <TextArea
              id={fieldDomId('confidentiality_restrictions')}
              value={draft.confidentiality_restrictions}
              onChange={(confidentiality_restrictions) => update({ confidentiality_restrictions })}
            />
          </Field>
          <Field
            id={fieldDomId('budget_and_external_support')}
            label={t('creator.needs.fields.budget_and_external_support')}
            optional
          >
            <TextArea
              id={fieldDomId('budget_and_external_support')}
              value={draft.budget_and_external_support}
              onChange={(budget_and_external_support) => update({ budget_and_external_support })}
            />
          </Field>
        </div>
      </NeedsGroup>
      {/* A fixed statement of the document, not a choice: a TTX never
          touches production systems. */}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked disabled readOnly className="mt-0.5 accent-accent-fg" />
        {t('creator.needs.hints.noOperationalImpact')}
      </label>
    </div>
  )
}
