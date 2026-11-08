import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { btnSecondary, inputBase, linkAccent } from '../../../lib/buttonStyles'
import {
  conductFieldId,
  FINDING_KINDS,
  formatDay,
  FINDING_SOURCES,
  newKey,
  rowId,
  type ConductPrepDraft,
  type DraftFinding,
} from '../../../lib/conductPrep'
import { codeRefText } from '../../../lib/codeRef'
import type { FindingKind, FindingSource } from '../../../lib/types'
import { FieldGroup } from '../../common/FieldGroup'
import { IconButton } from '../../common/IconButton'
import { Field, Select, TextArea } from '../needs/fields'
import { Checkbox, DateInput, Hint } from './fields'
import type { StepProps } from './stepProps'

/** Step 2, design validation: the MSEL's technical review (required: a
 * READY MSEL fixes the design) and, optional and scaled to the exercise,
 * the Final Planning Meeting that closes the design, the dry run, and what
 * the reviews of the design found to fix (each naming the review). */
export function ValidationStep(props: StepProps) {
  const { t, i18n } = useTranslation()
  const { prep, draft, update, isInvalid, ttxId } = props
  const ctx = prep.context
  const allValidated = ctx.mandatory_injects_validated >= ctx.mandatory_injects
  const meeting = (date: string | null, done: boolean) =>
    done
      ? date
        ? t('creator.conductPrep.summaries.heldOn', { date: formatDay(date, i18n.language) })
        : t('creator.conductPrep.summaries.held')
      : date
        ? t('creator.conductPrep.summaries.plannedFor', { date: formatDay(date, i18n.language) })
        : undefined
  const fpmFilled =
    draft.fpm_done ||
    draft.fpm_date !== null ||
    draft.fpm_attendees.trim() !== '' ||
    draft.fpm_notes.trim() !== ''
  const openFindings = draft.findings.filter((f) => !f.resolved).length
  return (
    <div className="space-y-5">
      <FieldGroup
        id="cp-msel-review-title"
        number={1}
        title={t('creator.conductPrep.fieldGroups.mselReview.title')}
        hint={t('creator.conductPrep.fieldGroups.mselReview.hint')}
      >
        <div id={conductFieldId('msel')} tabIndex={-1} className="space-y-2 text-sm">
          <p>
            <span className="font-medium">
              {t('creator.conductPrep.validationStep.mselStatus')}:{' '}
            </span>
            {ctx.msel_status
              ? t(`creator.msel.status.${ctx.msel_status}`)
              : t('creator.conductPrep.validationStep.noMsel')}
          </p>
          <div>
            <p className={allValidated ? 'text-success-fg' : 'text-danger-fg'}>
              {t('creator.conductPrep.validationStep.injectsValidated', {
                validated: ctx.mandatory_injects_validated,
                total: ctx.mandatory_injects,
              })}
            </p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={ctx.mandatory_injects}
              aria-valuenow={ctx.mandatory_injects_validated}
              aria-label={t('creator.conductPrep.validationStep.injectsProgress')}
              className="mt-1 h-1.5 w-full max-w-sm overflow-hidden rounded-xs bg-paper-line dark:bg-line"
            >
              <div
                className={`h-full ${allValidated ? 'bg-success' : 'bg-accent'}`}
                style={{
                  width: `${ctx.mandatory_injects ? (100 * ctx.mandatory_injects_validated) / ctx.mandatory_injects : 0}%`,
                }}
              />
            </div>
          </div>
          <Link to={`/creator/${ttxId}/msel?tab=injects`} className={linkAccent}>
            {t('creator.conductPrep.validationStep.openMsel')}
          </Link>
        </div>
      </FieldGroup>

      <FieldGroup
        id="cp-fpm-title"
        number={2}
        optional
        title={t('creator.conductPrep.fieldGroups.fpm.title')}
        hint={t('creator.conductPrep.fieldGroups.fpm.hint')}
        collapsible={{ filled: fpmFilled, summary: meeting(draft.fpm_date, draft.fpm_done) }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={conductFieldId('fpm_date')} label={t('creator.conductPrep.fields.fpm_date')}>
            <DateInput
              id={conductFieldId('fpm_date')}
              value={draft.fpm_date}
              invalid={isInvalid('fpm_date')}
              onChange={(fpm_date) => update({ fpm_date })}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              id={conductFieldId('fpm_done')}
              checked={draft.fpm_done}
              onChange={(fpm_done) => update({ fpm_done })}
            >
              {t('creator.conductPrep.fields.fpm_done')}
            </Checkbox>
          </div>
        </div>
        <Field
          id={conductFieldId('fpm_attendees')}
          label={t('creator.conductPrep.fields.fpm_attendees')}
          optional
        >
          <TextArea
            id={conductFieldId('fpm_attendees')}
            value={draft.fpm_attendees}
            rows={2}
            onChange={(fpm_attendees) => update({ fpm_attendees })}
          />
        </Field>
        <Field
          id={conductFieldId('fpm_notes')}
          label={t('creator.conductPrep.fields.fpm_notes')}
          optional
        >
          <TextArea
            id={conductFieldId('fpm_notes')}
            value={draft.fpm_notes}
            onChange={(fpm_notes) => update({ fpm_notes })}
          />
        </Field>
        <Hint>{t('creator.conductPrep.validationStep.fpmFreeze')}</Hint>
      </FieldGroup>

      <FieldGroup
        id="cp-dry-run-title"
        number={3}
        optional
        title={t('creator.conductPrep.fieldGroups.dryRun.title')}
        hint={t('creator.conductPrep.fieldGroups.dryRun.hint')}
        collapsible={{
          filled: draft.dry_run_done || draft.dry_run_date !== null,
          summary: meeting(draft.dry_run_date, draft.dry_run_done),
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id={conductFieldId('dry_run_date')}
            label={t('creator.conductPrep.fields.dry_run_date')}
          >
            <DateInput
              id={conductFieldId('dry_run_date')}
              value={draft.dry_run_date}
              invalid={isInvalid('dry_run_date')}
              onChange={(dry_run_date) => update({ dry_run_date })}
            />
          </Field>
          <div className="flex items-end pb-2">
            <Checkbox
              id={conductFieldId('dry_run_done')}
              checked={draft.dry_run_done}
              onChange={(dry_run_done) => update({ dry_run_done })}
            >
              {t('creator.conductPrep.fields.dry_run_done')}
            </Checkbox>
          </div>
        </div>
      </FieldGroup>
      <FieldGroup
        id="cp-findings-title"
        number={4}
        optional
        title={t('creator.conductPrep.fieldGroups.findings.title')}
        hint={t('creator.conductPrep.fieldGroups.findings.hint')}
        collapsible={{
          filled: draft.findings.length > 0,
          summary:
            draft.findings.length > 0
              ? t('creator.conductPrep.summaries.findings', {
                  count: draft.findings.length,
                  open: openFindings,
                })
              : undefined,
        }}
      >
        <Findings {...props} />
      </FieldGroup>
    </div>
  )
}

function Findings({ prep, draft, update, removeRow, isInvalid, readOnly }: StepProps) {
  const { t } = useTranslation()
  const kinds = t('creator.conductPrep.validationStep.findingKinds', {
    returnObjects: true,
  }) as Record<string, string>
  const sources = t('creator.conductPrep.validationStep.findingSources', {
    returnObjects: true,
  }) as Record<string, string>
  const refs = [
    ...prep.context.phases.map((p) => ({
      value: `phase:${p.id}`,
      label: codeRefText(p.code, p.title),
    })),
    ...prep.context.injects.map((i) => ({
      value: `inject:${i.id}`,
      label: codeRefText(i.code, i.title),
    })),
  ]

  function patch(id: string, change: Partial<DraftFinding>) {
    update({ findings: draft.findings.map((f) => (rowId(f) === id ? { ...f, ...change } : f)) })
  }

  function remove(finding: DraftFinding, index: number) {
    const id = rowId(finding)
    removeRow(
      t('creator.conductPrep.validationStep.findingRemoved'),
      (d: ConductPrepDraft) => ({ ...d, findings: d.findings.filter((f) => rowId(f) !== id) }),
      (d: ConductPrepDraft) => {
        if (d.findings.some((f) => rowId(f) === id)) return d
        const findings = [...d.findings]
        findings.splice(Math.min(index, findings.length), 0, finding)
        return { ...d, findings }
      },
    )
  }

  return (
    <div className="space-y-3">
      {draft.findings.length === 0 && (
        <Hint>{t('creator.conductPrep.validationStep.noFindings')}</Hint>
      )}
      <ol className="space-y-3">
        {draft.findings.map((finding, index) => {
          const id = rowId(finding)
          const ref = finding.inject_id
            ? `inject:${finding.inject_id}`
            : finding.phase_id
              ? `phase:${finding.phase_id}`
              : ''
          return (
            <li key={id} className="space-y-2 rounded-sm border border-panel-line p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-paper-ink/70 dark:text-fg-muted">
                  {t('creator.conductPrep.validationStep.findingNumber', { number: index + 1 })}
                </span>
                {!readOnly && (
                  <IconButton
                    label={t('creator.conductPrep.validationStep.removeFinding', {
                      number: index + 1,
                    })}
                    onClick={() => remove(finding, index)}
                  />
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field
                  id={`cp-found-in-${id}`}
                  label={t('creator.conductPrep.validationStep.foundIn')}
                >
                  <Select<FindingSource>
                    id={`cp-found-in-${id}`}
                    value={finding.found_in}
                    options={FINDING_SOURCES.map((value) => ({ value, label: sources[value] }))}
                    onChange={(found_in) => patch(id, { found_in })}
                  />
                </Field>
                <Field id={`cp-kind-${id}`} label={t('creator.conductPrep.validationStep.kind')}>
                  <Select<FindingKind>
                    id={`cp-kind-${id}`}
                    value={finding.kind}
                    options={FINDING_KINDS.map((value) => ({ value, label: kinds[value] }))}
                    onChange={(kind) => patch(id, { kind })}
                  />
                </Field>
                <Field
                  id={`cp-ref-${id}`}
                  label={t('creator.conductPrep.validationStep.ref')}
                  optional
                >
                  <select
                    id={conductFieldId('ref', id)}
                    value={ref}
                    onChange={(e) => {
                      const [type, refId] = e.target.value.split(':')
                      patch(id, {
                        inject_id: type === 'inject' ? refId : null,
                        phase_id: type === 'phase' ? refId : null,
                      })
                    }}
                    className={inputBase}
                  >
                    <option value="">{t('creator.conductPrep.validationStep.noRef')}</option>
                    {refs.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field
                id={conductFieldId('description', id)}
                label={t('creator.conductPrep.validationStep.description')}
              >
                <TextArea
                  id={conductFieldId('description', id)}
                  value={finding.description}
                  rows={2}
                  invalid={isInvalid('description', id)}
                  onChange={(description) => patch(id, { description })}
                />
              </Field>
              <Checkbox
                id={conductFieldId('resolved', id)}
                checked={finding.resolved}
                invalid={isInvalid('resolved', id)}
                onChange={(resolved) => patch(id, { resolved })}
              >
                {t('creator.conductPrep.validationStep.resolved')}
              </Checkbox>
            </li>
          )
        })}
      </ol>
      {!readOnly && (
        <button
          type="button"
          className={btnSecondary}
          onClick={() =>
            update({
              findings: [
                ...draft.findings,
                {
                  id: null,
                  key: newKey(),
                  kind: 'ambiguous_inject',
                  // The last finding's review: findings are usually
                  // recorded a review at a time.
                  found_in: draft.findings.at(-1)?.found_in ?? 'dry_run',
                  description: '',
                  inject_id: null,
                  phase_id: null,
                  resolved: false,
                },
              ],
            })
          }
        >
          {t('creator.conductPrep.validationStep.addFinding')}
        </button>
      )}
    </div>
  )
}
