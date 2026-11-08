import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { inputBase } from '../../../lib/buttonStyles'
import {
  CALENDAR_FIELDS,
  conductFieldId,
  deadlineDate,
  DOCUMENT_KINDS,
  formatDay,
} from '../../../lib/conductPrep'
import { FieldGroup } from '../../common/FieldGroup'
import { ConductPrepDownloads } from './ConductPrepDownloads'
import { Checkbox, Hint } from './fields'
import type { StepProps } from './stepProps'

/** Step 4, documents and follow-up: each session document, who it's for
 * and (optional) whether it was reviewed; then the deadlines of the
 * evaluation that follows the session -- hot wash, debrief, rated EEGs,
 * the after-action report and its meeting -- as days after it. */
export function DocumentsStep(props: StepProps) {
  const { draft, update, ttxId, downloadsBlocked } = props
  const { t } = useTranslation()
  const kinds = t('creator.conductPrep.documents.kinds', { returnObjects: true }) as Record<
    string,
    string
  >
  const audiences = t('creator.conductPrep.documents.audiences', {
    returnObjects: true,
  }) as Record<string, string>

  function toggle(kind: string, reviewed: boolean) {
    update({
      documents_reviewed: reviewed
        ? DOCUMENT_KINDS.filter((k) => k === kind || draft.documents_reviewed.includes(k))
        : draft.documents_reviewed.filter((k) => k !== kind),
    })
  }

  return (
    <div className="space-y-5">
      <FieldGroup
        id="cp-documents-title"
        number={1}
        title={t('creator.conductPrep.fieldGroups.documents.title')}
        hint={t('creator.conductPrep.fieldGroups.documents.hint')}
      >
        <ul
          id={conductFieldId('documents_reviewed')}
          tabIndex={-1}
          className="divide-y divide-panel-line"
        >
          {DOCUMENT_KINDS.map((kind) => (
            <li key={kind} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium">{kinds[kind]}</p>
                <p className="text-xs text-paper-ink/60 dark:text-fg-faint">{audiences[kind]}</p>
              </div>
              <Checkbox
                id={conductFieldId('documents_reviewed', kind)}
                checked={draft.documents_reviewed.includes(kind)}
                onChange={(reviewed) => toggle(kind, reviewed)}
              >
                {t('creator.conductPrep.documents.reviewed')}
              </Checkbox>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Hint>{t('creator.conductPrep.documents.marking')}</Hint>
          <ConductPrepDownloads ttxId={ttxId} blockedReason={downloadsBlocked} />
        </div>
      </FieldGroup>

      <FieldGroup
        id="cp-calendar-title"
        number={2}
        optional
        title={t('creator.conductPrep.fieldGroups.calendar.title')}
        hint={t('creator.conductPrep.fieldGroups.calendar.hint')}
        // Folded: it starts with the usual deadlines.
        collapsible={{
          filled: false,
          summary: t('creator.conductPrep.summaries.calendar', {
            report: draft.draft_aar_days,
            meeting: draft.after_action_meeting_days,
          }),
        }}
      >
        <Calendar {...props} />
      </FieldGroup>
    </div>
  )
}

/** The evaluation calendar: each milestone after the session, what it
 * is, and its deadline in days -- the usual ones by default, since a date
 * can rarely be fixed this early. Dates follow the session date. */
function Calendar({ draft, update, isInvalid }: StepProps) {
  const { t, i18n } = useTranslation()
  const fields = t('creator.conductPrep.fields', { returnObjects: true }) as Record<string, string>
  return (
    <ol className="divide-y divide-panel-line rounded-sm border border-panel-line">
      {CALENDAR_FIELDS.map((field) => {
        const days = draft[field]
        const day = deadlineDate(draft.session_date, days)
        return (
          <li
            key={field}
            className="grid gap-x-4 gap-y-2 p-3 sm:grid-cols-[1fr_auto] sm:items-center"
          >
            <div className="space-y-0.5">
              <label htmlFor={conductFieldId(field)} className="text-sm font-medium">
                {fields[field]}
              </label>
              <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
                {t(`creator.conductPrep.calendar.explanations.${field}`)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:justify-end">
              <span className="w-20">
                <DaysInput
                  id={conductFieldId(field)}
                  value={days}
                  invalid={isInvalid(field)}
                  onChange={(value) => update({ [field]: value })}
                />
              </span>
              <span className="text-paper-ink/70 dark:text-fg-muted">
                {t('creator.conductPrep.calendar.daysAfter', { count: days })}
              </span>
              <span className="w-full text-paper-ink/60 sm:w-auto dark:text-fg-faint">
                {day
                  ? t('creator.conductPrep.calendar.onDate', {
                      date: formatDay(day, i18n.language),
                    })
                  : t('creator.conductPrep.calendar.pendingSession')}
              </span>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/** Whole days, 0-365: typed freely, kept in range; a cleared field
 * comes back to its value when left. */
function DaysInput({
  id,
  value,
  invalid,
  onChange,
}: {
  id: string
  value: number
  invalid: boolean
  onChange: (value: number) => void
}) {
  const [text, setText] = useState<string | null>(null)
  return (
    <input
      autoComplete="off"
      id={id}
      name={id}
      type="number"
      inputMode="numeric"
      min={0}
      max={365}
      value={text ?? String(value)}
      aria-invalid={invalid || undefined}
      onChange={(event) => {
        const typed = event.target.value
        setText(typed)
        const number = Number(typed)
        if (typed.trim() !== '' && Number.isInteger(number) && number >= 0 && number <= 365) {
          onChange(number)
        }
      }}
      onBlur={() => setText(null)}
      className={`${inputBase} tabular-nums`}
    />
  )
}
