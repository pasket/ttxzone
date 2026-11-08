import { useTranslation } from 'react-i18next'

import { COMPRESSION_PRESETS, formatSpan, incidentMinutesAt, mselFieldId } from '../../../lib/msel'
import { FieldGroup } from '../../common/FieldGroup'
import { FormattedTextArea } from '../../common/FormattedTextArea'
import { Field, Select, TextInput } from '../needs/fields'
import { HoursInput } from './HoursInput'
import { MetersField } from './MetersField'
import type { TabProps } from './tabProps'

/** Mirrors the backend's LongText limit on the summary. */
const SUMMARY_MAX = 5000

const COMPRESSION_LABEL_KEYS: Partial<
  Record<
    number,
    | 'creator.msel.compression.realTime'
    | 'creator.msel.compression.tenMinutes'
    | 'creator.msel.compression.thirtyMinutes'
    | 'creator.msel.compression.oneHour'
    | 'creator.msel.compression.fourHours'
    | 'creator.msel.compression.oneDay'
  >
> = {
  1: 'creator.msel.compression.realTime',
  10: 'creator.msel.compression.tenMinutes',
  30: 'creator.msel.compression.thirtyMinutes',
  60: 'creator.msel.compression.oneHour',
  240: 'creator.msel.compression.fourHours',
  1440: 'creator.msel.compression.oneDay',
}

/** Tab 1 -- the scenario: what Players are told, the session and scenario
 * times (the threat actors behind it have their own tab). */
export function ScenarioTab({ msel, draft, update, isInvalid, readOnly }: TabProps) {
  const { t } = useTranslation()
  // A saved value outside the presets (from before they existed) stays
  // selectable rather than silently changing.
  const compressionOptions = COMPRESSION_PRESETS.includes(draft.time_compression)
    ? COMPRESSION_PRESETS
    : [...COMPRESSION_PRESETS, draft.time_compression].sort((a, b) => a - b)
  function compressionLabel(minutes: number): string {
    const key = COMPRESSION_LABEL_KEYS[minutes]
    return key ? t(key) : t('creator.msel.compression.custom', { span: formatSpan(minutes) })
  }
  return (
    <fieldset disabled={readOnly} className="space-y-5">
      <FieldGroup
        id="msel-group-story"
        title={t('creator.msel.fieldGroups.story.title')}
        hint={t('creator.msel.fieldGroups.story.hint')}
      >
        <Field id={mselFieldId('title')} label={t('creator.msel.fields.title')}>
          <TextInput
            id={mselFieldId('title')}
            value={draft.title}
            maxLength={255}
            placeholder={t('creator.msel.placeholders.title')}
            invalid={isInvalid('title')}
            onChange={(title) => update({ title })}
          />
        </Field>
        <Field id={mselFieldId('summary')} label={t('creator.msel.fields.summary')}>
          {/* Read to the players and printed in the situation manual:
              bold, italic and lists help it scan. */}
          <FormattedTextArea
            id={mselFieldId('summary')}
            value={draft.summary}
            rows={8}
            maxLength={SUMMARY_MAX}
            placeholder={t('creator.msel.placeholders.summary')}
            invalid={isInvalid('summary')}
            disabled={readOnly}
            onChange={(summary) => update({ summary })}
          />
        </Field>
      </FieldGroup>
      <FieldGroup
        id="msel-group-time"
        title={t('creator.msel.fieldGroups.time.title')}
        hint={t('creator.msel.fieldGroups.time.hint')}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            id={mselFieldId('exercise_start')}
            label={t('creator.msel.fields.exercise_start')}
            optional
          >
            <TextInput
              id={mselFieldId('exercise_start')}
              type="time"
              value={draft.exercise_start}
              onChange={(exercise_start) => update({ exercise_start })}
            />
          </Field>
          <Field
            id={mselFieldId('incident_start')}
            label={t('creator.msel.fields.incident_start')}
            hint={t('creator.msel.hints.incident_start')}
            optional
          >
            <TextInput
              id={mselFieldId('incident_start')}
              type="time"
              hint
              value={draft.incident_start}
              onChange={(incident_start) => update({ incident_start })}
            />
          </Field>
          <Field
            id={mselFieldId('incident_date')}
            label={t('creator.msel.fields.incident_date')}
            hint={t('creator.msel.hints.incident_date')}
            optional
          >
            <TextInput
              id={mselFieldId('incident_date')}
              type="date"
              hint
              value={draft.incident_date}
              onChange={(incident_date) => update({ incident_date })}
            />
          </Field>
          <Field
            id={mselFieldId('duration_minutes')}
            label={t('creator.msel.fields.duration_minutes')}
            hint={
              msel.needs.max_duration_hours
                ? t('creator.msel.hints.duration', { max: msel.needs.max_duration_hours })
                : t('creator.msel.hints.durationNoMax')
            }
          >
            <HoursInput
              id={mselFieldId('duration_minutes')}
              minutes={draft.duration_minutes}
              invalid={isInvalid('duration_minutes')}
              onChange={(duration_minutes) => update({ duration_minutes })}
            />
          </Field>
          <Field
            id={mselFieldId('time_compression')}
            label={t('creator.msel.fields.time_compression')}
            hint={t('creator.msel.hints.time_compression')}
          >
            <Select
              id={mselFieldId('time_compression')}
              value={String(draft.time_compression)}
              hint
              options={compressionOptions.map((minutes) => ({
                value: String(minutes),
                label: compressionLabel(minutes),
              }))}
              onChange={(value) => update({ time_compression: Number(value) })}
            />
          </Field>
        </div>
        {/* The values only make sense together: show what they add up to. */}
        {draft.duration_minutes !== null && draft.duration_minutes > 0 && (
          <div
            aria-live="polite"
            className="space-y-2 rounded-sm border border-paper-line p-3 dark:border-line"
          >
            <dl className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div>
                <dt className="text-xs text-paper-ink/60 dark:text-fg-faint">
                  {t('creator.msel.timeSummary.meeting')}
                </dt>
                <dd className="text-base font-semibold">{formatSpan(draft.duration_minutes)}</dd>
              </div>
              <span aria-hidden="true" className="text-paper-ink/40 dark:text-fg-faint">
                →
              </span>
              <div>
                <dt className="text-xs text-paper-ink/60 dark:text-fg-faint">
                  {t('creator.msel.timeSummary.incident')}
                </dt>
                <dd className="text-base font-semibold">
                  {formatSpan(incidentMinutesAt(draft, draft.duration_minutes))}
                </dd>
              </div>
            </dl>
            <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
              {t('creator.msel.timeSummary.injectsNote')}
            </p>
          </div>
        )}
      </FieldGroup>
      <MetersField
        meters={draft.meters}
        invalid={isInvalid('meters')}
        onChange={(meters) => update({ meters })}
      />
    </fieldset>
  )
}
