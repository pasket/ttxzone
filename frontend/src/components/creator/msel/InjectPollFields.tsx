import { useTranslation } from 'react-i18next'

import { btnNeutralIconGhost, inputCompact, linkAccent } from '../../../lib/buttonStyles'
import { MAX_POLL_OPTIONS, pollLetter } from '../../../lib/msel'
import type { InjectDraft } from '../../../lib/msel'
import { Field, TextArea, TextInput } from '../needs/fields'
import { METER_LEVEL_KEYS } from './meterLevels'

/** Mirrors the backend's PollQuestion and PollOption limits. */
const QUESTION_MAX = 300
const OPTION_MAX = 200
const OUTCOME_MAX = 1000
const MIN_OPTIONS = 2

/** A poll's question and its options, lettered as the Players see them, each
 * with what follows it. Options and outcomes move together. */
export function InjectPollFields({
  id,
  question,
  options,
  outcomes,
  impacts,
  meters,
  onChange,
}: {
  id: (field: string) => string
  question: string
  options: string[]
  outcomes: string[]
  impacts: Record<string, number>[]
  /** The exercise's meters; none: nothing to say about them. */
  meters: { key: string; name: string }[]
  onChange: (patch: Partial<InjectDraft>) => void
}) {
  const { t } = useTranslation()
  // By position, whatever a saved poll holds.
  const paired = options.map((_, index) => outcomes[index] ?? '')
  const levels = options.map((_, index) => impacts[index] ?? {})
  const setRows = (
    poll_options: string[],
    poll_outcomes: string[],
    poll_impacts: Record<string, number>[] = levels,
  ) => onChange({ poll_options, poll_outcomes, poll_impacts })
  function moved<T>(rows: T[], index: number, to: number): T[] {
    const next = [...rows]
    next.splice(to, 0, ...next.splice(index, 1))
    return next
  }
  function move(index: number, to: number) {
    setRows(moved(options, index, to), moved(paired, index, to), moved(levels, index, to))
  }
  function add() {
    setRows([...options, ''], [...paired, ''], [...levels, {}])
    const row = options.length
    // The new row is where the user types next.
    requestAnimationFrame(() => document.getElementById(`${id('poll_options')}-${row}`)?.focus())
  }
  // The first one is where a warning about them takes the user.
  const outcomeId = (index: number) =>
    index === 0 ? id('poll_outcomes') : `${id('poll_outcomes')}-${index}`
  return (
    <>
      <Field id={id('poll_question')} label={t('creator.msel.fields.poll_question')}>
        <TextInput
          id={id('poll_question')}
          value={question}
          maxLength={QUESTION_MAX}
          onChange={(poll_question) => onChange({ poll_question })}
        />
      </Field>
      <fieldset id={id('poll_options')} tabIndex={-1} className="space-y-2">
        <legend className="text-sm font-medium">{t('creator.msel.fields.poll_options')}</legend>
        <ol className="space-y-2">
          {options.map((option, index) => {
            const letter = pollLetter(index)
            return (
              <li key={index} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="w-5 shrink-0 text-center font-mono text-sm font-medium text-paper-ink/60 dark:text-fg-muted"
                  >
                    {letter}
                  </span>
                  <div className="min-w-0 flex-1">
                    <TextInput
                      id={`${id('poll_options')}-${index}`}
                      aria-label={t('creator.msel.wizard.optionOf', { letter })}
                      value={option}
                      maxLength={OPTION_MAX}
                      onChange={(text) =>
                        setRows(
                          options.map((o, i) => (i === index ? text : o)),
                          paired,
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => move(index, index - 1)}
                    aria-label={t('creator.msel.wizard.moveOptionUp', { letter })}
                    title={t('creator.msel.wizard.moveOptionUp', { letter })}
                    className={`${btnNeutralIconGhost} disabled:opacity-30`}
                  >
                    <span aria-hidden="true">↑</span>
                  </button>
                  <button
                    type="button"
                    disabled={index === options.length - 1}
                    onClick={() => move(index, index + 1)}
                    aria-label={t('creator.msel.wizard.moveOptionDown', { letter })}
                    title={t('creator.msel.wizard.moveOptionDown', { letter })}
                    className={`${btnNeutralIconGhost} disabled:opacity-30`}
                  >
                    <span aria-hidden="true">↓</span>
                  </button>
                  <button
                    type="button"
                    disabled={options.length <= MIN_OPTIONS}
                    onClick={() =>
                      setRows(
                        options.filter((_, i) => i !== index),
                        paired.filter((_, i) => i !== index),
                        levels.filter((_, i) => i !== index),
                      )
                    }
                    aria-label={t('creator.msel.wizard.removeOption', { letter })}
                    title={t('creator.msel.wizard.removeOption', { letter })}
                    className={`${btnNeutralIconGhost} disabled:opacity-30`}
                  >
                    <span aria-hidden="true" className="text-lg leading-none">
                      ×
                    </span>
                  </button>
                </div>
                <div className="pl-7">
                  <Field
                    id={outcomeId(index)}
                    label={t('creator.msel.wizard.outcomeOf', { letter })}
                    optional
                  >
                    <TextArea
                      id={outcomeId(index)}
                      value={paired[index]}
                      rows={2}
                      maxLength={OUTCOME_MAX}
                      onChange={(text) =>
                        setRows(
                          options,
                          paired.map((o, i) => (i === index ? text : o)),
                        )
                      }
                    />
                  </Field>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="flex items-center justify-between gap-3 text-sm">
          {options.length < MAX_POLL_OPTIONS ? (
            <button type="button" onClick={add} className={`${linkAccent} font-medium`}>
              <span aria-hidden="true">+ </span>
              {t('creator.msel.wizard.addOption')}
            </button>
          ) : (
            <span />
          )}
          <span className="text-xs tabular-nums text-paper-ink/60 dark:text-fg-faint">
            {t('creator.msel.wizard.optionCount', {
              count: options.length,
              max: MAX_POLL_OPTIONS,
            })}
          </span>
        </div>
      </fieldset>
      {meters.length > 0 && (
        <fieldset id={id('poll_impacts')} tabIndex={-1} className="space-y-2">
          <legend className="text-sm font-medium">{t('creator.msel.wizard.impactsTitle')}</legend>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <td />
                  {meters.map((meter) => (
                    <th key={meter.key} scope="col" className="px-1 pb-1 text-left font-medium">
                      {meter.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.map((_, index) => {
                  const letter = pollLetter(index)
                  return (
                    <tr key={index}>
                      <th
                        scope="row"
                        className="w-6 pr-1 text-center font-mono font-medium text-paper-ink/60 dark:text-fg-faint"
                      >
                        {letter}
                      </th>
                      {meters.map((meter) => (
                        <td key={meter.key} className="min-w-24 p-1">
                          <select
                            aria-label={t('creator.msel.wizard.impactOf', {
                              meter: meter.name,
                              letter,
                            })}
                            value={levels[index][meter.key] ?? 0}
                            onChange={(event) =>
                              setRows(
                                options,
                                paired,
                                levels.map((row, i) =>
                                  i === index
                                    ? { ...row, [meter.key]: Number(event.target.value) }
                                    : row,
                                ),
                              )
                            }
                            className={inputCompact}
                          >
                            {METER_LEVEL_KEYS.map((key, level) => (
                              <option key={key} value={level}>
                                {t(key)}
                              </option>
                            ))}
                          </select>
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </fieldset>
      )}
    </>
  )
}
