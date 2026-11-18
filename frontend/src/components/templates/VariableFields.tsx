import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { inputBase, linkAccent } from '../../lib/buttonStyles'
import { CodeRef } from '../common/CodeRef'
import { VariableText } from './VariableText'

/** What is known about a {variable} besides its name: what the template
 * says it stands for, a value that fits the story, and where the text
 * uses it. */
export interface VariableDetail {
  description?: string
  suggested?: string
  uses?: { path: string; code?: string | null; title?: string | null; excerpt: string }[]
  /** Every use, when `uses` only quotes the first ones. */
  count?: number
}

const quietButton = `${linkAccent} rounded-xs text-xs whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg`
const mutedText = 'text-xs text-pretty text-paper-ink/60 dark:text-fg-faint'

/** One input per {variable} a template uses, to write the exercise's own
 * value into its text when it's copied (an inject, a whole scenario).
 * Blank ones stay as {variable}, to complete later. With `details`, each
 * says what it stands for, offers its suggested value (never written in
 * on its own) and quotes where the text uses it. */
export function VariableFields({
  legend,
  hint,
  variables,
  values,
  onChange,
  countLabel,
  details,
}: {
  legend: string
  hint: string
  variables: string[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
  /** How often each variable is used, shown after it (optional). */
  countLabel?: (name: string) => string
  details?: Record<string, VariableDetail>
}) {
  const { t } = useTranslation()
  const baseId = useId()
  if (variables.length === 0) return null
  const suggested = (name: string) => details?.[name]?.suggested?.trim() ?? ''
  // Only the blank ones: what was written, or proposed, is never replaced.
  const toSuggest = variables.filter((name) => suggested(name) && !(values[name] ?? '').trim())
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold tracking-tight">{legend}</legend>
      <p className={mutedText}>{hint}</p>
      {variables.some(suggested) && (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className={mutedText}>{t('templates.variables.suggestedHint')}</span>
          <button
            type="button"
            disabled={toSuggest.length === 0}
            onClick={() =>
              onChange({
                ...values,
                ...Object.fromEntries(toSuggest.map((name) => [name, suggested(name)])),
              })
            }
            className={`${quietButton} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {t('templates.variables.useAllSuggested')}
          </button>
        </p>
      )}
      {variables.map((name) => {
        const detail = details?.[name]
        const inputId = `${baseId}-${name}`
        const descriptionId = detail?.description ? `${inputId}-description` : undefined
        const uses = detail?.uses ?? []
        const more = (detail?.count ?? uses.length) - uses.length
        return (
          <div
            key={name}
            className="grid items-start gap-x-2 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]"
          >
            <div className="min-w-0 sm:pt-2">
              <label htmlFor={inputId} className="break-words">
                <VariableText text={`{${name}}`} />
                {countLabel && (
                  <span className="ml-1.5 text-xs text-paper-ink/60 dark:text-fg-faint">
                    {countLabel(name)}
                  </span>
                )}
              </label>
            </div>
            <div className="min-w-0 space-y-1">
              <input
                id={inputId}
                name={name}
                autoComplete="off"
                spellCheck={false}
                value={values[name] ?? ''}
                maxLength={255}
                placeholder={
                  suggested(name)
                    ? t('templates.variables.example', { value: suggested(name) })
                    : undefined
                }
                aria-describedby={descriptionId}
                onChange={(event) => onChange({ ...values, [name]: event.target.value })}
                className={inputBase}
              />
              {detail?.description && (
                <p id={descriptionId} className={mutedText}>
                  {detail.description}
                </p>
              )}
              {suggested(name) && values[name] !== suggested(name) && (
                <button
                  type="button"
                  onClick={() => onChange({ ...values, [name]: suggested(name) })}
                  className={quietButton}
                  aria-label={t('templates.variables.useSuggestedFor', {
                    value: suggested(name),
                    name: `{${name}}`,
                  })}
                >
                  {t('templates.variables.useSuggested', { value: suggested(name) })}
                </button>
              )}
              {uses.length > 0 && (
                <details className="group">
                  <summary
                    className={`${quietButton} inline-block cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                  >
                    {t('templates.variables.where')}
                  </summary>
                  <ul className="mt-1 space-y-2 border-l border-paper-line pl-3 dark:border-line">
                    {uses.map((use, index) => (
                      <li key={`${use.path}-${index}`} className="space-y-0.5">
                        {use.code && (
                          <CodeRef code={use.code} title={use.title ?? ''} className="text-xs" />
                        )}
                        <p className="text-xs text-pretty break-words text-paper-ink/80 dark:text-fg-muted">
                          <VariableText text={use.excerpt} />
                        </p>
                      </li>
                    ))}
                    {more > 0 && (
                      <li className={mutedText}>
                        {t('templates.variables.moreUses', { count: more })}
                      </li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          </div>
        )
      })}
    </fieldset>
  )
}
