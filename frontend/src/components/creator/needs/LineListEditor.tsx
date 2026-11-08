import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { inputBase, linkAccent } from '../../../lib/buttonStyles'
import { AcronymText } from '../../common/AcronymText'
import { IconButton } from '../../common/IconButton'
import { useAutoGrow } from '../../../hooks/useAutoGrow'

/** A one-per-line text edited as a list: a row per line (the success
 * criterion's conditions, the evidence's items). Enter adds a row below,
 * Backspace on an empty row removes it, a paste with line breaks becomes
 * rows. The value stays a string with "\n" between rows -- blank rows are
 * kept while editing and dropped by whoever reads it (lib/needsForm's
 * textLines, the backend). `id` goes on the first row, where a validation
 * entry lands. */
export function LineListEditor({
  id,
  label,
  hint,
  value,
  onChange,
  addLabel,
  rowLabel,
  placeholder,
  max = 8,
  numbered = false,
  invalid = false,
  optional = false,
  legendHidden = false,
  assist,
}: {
  id: string
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
  addLabel: string
  /** The accessible name of row `n` (1-based). */
  rowLabel: (n: number) => string
  placeholder?: string
  max?: number
  numbered?: boolean
  invalid?: boolean
  optional?: boolean
  /** For screen readers only, when the surrounding block's heading says it. */
  legendHidden?: boolean
  /** Shown under a row, e.g. an offer to split or move it. */
  assist?: (line: string, index: number) => ReactNode
}) {
  const { t } = useTranslation()
  const rows = value === '' ? [''] : value.split('\n')
  const refs = useRef<(HTMLTextAreaElement | null)[]>([])
  // Where the caret goes once the rows re-render (after Enter, Backspace,
  // a paste): set by an edit, consumed by the effect after the render.
  const focusAt = useRef<{ index: number; end: boolean } | null>(null)
  useEffect(() => {
    const target = focusAt.current
    if (!target) return
    focusAt.current = null
    const element = refs.current[target.index]
    if (!element) return
    element.focus()
    const at = target.end ? element.value.length : 0
    element.setSelectionRange(at, at)
  })
  const setFocusAt = (target: { index: number; end: boolean }) => {
    focusAt.current = target
  }

  function set(next: string[]) {
    onChange(next.join('\n'))
  }

  function edit(index: number, text: string) {
    // A paste with line breaks becomes rows (up to the limit).
    const parts = text.split('\n')
    const next = [...rows.slice(0, index), ...parts, ...rows.slice(index + 1)].slice(0, max)
    set(next)
    if (parts.length > 1)
      setFocusAt({ index: Math.min(index + parts.length - 1, max - 1), end: true })
  }

  function insertAfter(index: number) {
    if (rows.length >= max) return
    set([...rows.slice(0, index + 1), '', ...rows.slice(index + 1)])
    setFocusAt({ index: index + 1, end: false })
  }

  function remove(index: number) {
    if (rows.length === 1) return set([''])
    set(rows.filter((_, i) => i !== index))
    setFocusAt({ index: Math.max(0, index - 1), end: true })
  }

  const hintId = `${id}-hint`
  return (
    <fieldset className="space-y-2" aria-describedby={hint ? hintId : undefined}>
      <legend className={legendHidden ? 'sr-only' : 'text-sm font-medium'}>
        <AcronymText text={label} />
        {optional && (
          <span className="font-normal text-paper-ink/60 dark:text-fg-faint">
            {' '}
            ({t('common.optionalSuffix')})
          </span>
        )}
      </legend>
      {hint && (
        <p id={hintId} className="text-xs text-paper-ink/60 dark:text-fg-faint">
          {hint}
        </p>
      )}
      <ol className="space-y-2">
        {rows.map((row, index) => (
          // Rows have no identity of their own: the index is the row.
          <li key={index} className="space-y-1">
            <div className="flex items-start gap-2">
              {numbered ? (
                <span
                  aria-hidden="true"
                  className="w-5 shrink-0 pt-2 text-right text-sm tabular-nums text-paper-ink/60 dark:text-fg-faint"
                >
                  {index + 1}.
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="mt-3 h-3 w-3 shrink-0 rounded-xs border border-paper-line dark:border-line"
                />
              )}
              <LineInput
                id={index === 0 ? id : `${id}-${index}`}
                inputRef={(element) => {
                  refs.current[index] = element
                }}
                value={row}
                label={rowLabel(index + 1)}
                placeholder={index === 0 ? placeholder : undefined}
                invalid={invalid && index === 0}
                onChange={(text) => edit(index, text)}
                onEnter={() => insertAfter(index)}
                onBackspaceEmpty={() => remove(index)}
              />
              <IconButton
                label={t('creator.needs.lineList.remove', { row: rowLabel(index + 1) })}
                onClick={() => remove(index)}
                disabled={rows.length === 1 && row === ''}
              />
            </div>
            {assist && row.trim() && <div className="pl-7">{assist(row, index)}</div>}
          </li>
        ))}
      </ol>
      {rows.length < max && (
        <button
          type="button"
          onClick={() => insertAfter(rows.length - 1)}
          className={`ml-7 rounded-xs text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg ${linkAccent}`}
        >
          <span aria-hidden="true">+ </span>
          {addLabel}
        </button>
      )}
    </fieldset>
  )
}

function LineInput({
  id,
  inputRef,
  value,
  label,
  placeholder,
  invalid,
  onChange,
  onEnter,
  onBackspaceEmpty,
}: {
  id: string
  inputRef: (element: HTMLTextAreaElement | null) => void
  value: string
  label: string
  placeholder?: string
  invalid: boolean
  onChange: (value: string) => void
  onEnter: () => void
  onBackspaceEmpty: () => void
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null)
  useAutoGrow(ref, value)
  return (
    <textarea
      ref={(element) => {
        ref.current = element
        inputRef(element)
      }}
      id={id}
      name={id}
      rows={1}
      autoComplete="off"
      value={value}
      maxLength={1000}
      aria-label={label}
      aria-invalid={invalid || undefined}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
          event.preventDefault()
          onEnter()
        } else if (event.key === 'Backspace' && value === '') {
          event.preventDefault()
          onBackspaceEmpty()
        }
      }}
      className={`${inputBase} min-w-0 flex-1 resize-none leading-relaxed ${
        invalid ? 'border-danger dark:border-danger' : ''
      }`}
    />
  )
}
