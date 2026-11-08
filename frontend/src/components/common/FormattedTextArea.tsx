import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../lib/buttonStyles'
import { FormattedText } from './FormattedText'

type Action = 'bold' | 'italic' | 'bullets' | 'numbers'

/** A text area with basic formatting -- bold, italic, bullet and numbered
 * lists (buttons, and Cmd/Ctrl+B / I) -- written as the small Markdown
 * subset `FormattedText` renders, plus a Write / Preview switch. The
 * value stays plain text, so it saves and reads like any other field. */
export function FormattedTextArea({
  id,
  value,
  onChange,
  placeholder,
  rows = 8,
  maxLength,
  disabled = false,
  describedBy,
  invalid = false,
  headings = false,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  disabled?: boolean
  describedBy?: string
  /** Flagged by validation: a red border, and `aria-invalid`. */
  invalid?: boolean
  /** Preview "# " titles too (long documents: the legal ones). */
  headings?: boolean
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)

  // Apply, then put the selection back where it makes sense.
  function commit(next: string, start: number, end: number) {
    onChange(next)
    requestAnimationFrame(() => {
      const area = ref.current
      if (!area) return
      area.focus()
      area.setSelectionRange(start, end)
    })
  }

  function apply(action: Action) {
    const area = ref.current
    if (!area || disabled) return
    const { selectionStart: start, selectionEnd: end } = area
    if (action === 'bold' || action === 'italic') {
      const mark = action === 'bold' ? '**' : '_'
      const selected = value.slice(start, end)
      // Already wrapped: unwrap.
      if (
        value.slice(start - mark.length, start) === mark &&
        value.slice(end, end + mark.length) === mark
      ) {
        commit(
          value.slice(0, start - mark.length) + selected + value.slice(end + mark.length),
          start - mark.length,
          end - mark.length,
        )
        return
      }
      const word = selected || t('common.formatting.sample')
      commit(
        value.slice(0, start) + mark + word + mark + value.slice(end),
        start + mark.length,
        start + mark.length + word.length,
      )
      return
    }
    // Lists act on every line the selection touches.
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    const nextBreak = value.indexOf('\n', end)
    const lineEnd = nextBreak === -1 ? value.length : nextBreak
    const lines = value.slice(lineStart, lineEnd).split('\n')
    const marker = action === 'bullets' ? /^- / : /^\d+\. /
    const listed = lines.every((line) => marker.test(line))
    const changed = lines.map((line, index) => {
      const bare = line.replace(/^(- |\d+\. )/, '')
      if (listed) return bare
      return action === 'bullets' ? `- ${bare}` : `${index + 1}. ${bare}`
    })
    const block = changed.join('\n')
    commit(
      value.slice(0, lineStart) + block + value.slice(lineEnd),
      lineStart,
      lineStart + block.length,
    )
  }

  const tools: { action: Action; label: string; shortcut?: string; icon: React.ReactNode }[] = [
    {
      action: 'bold',
      label: t('common.formatting.bold'),
      shortcut: 'B',
      icon: <span className="font-bold">B</span>,
    },
    {
      action: 'italic',
      label: t('common.formatting.italic'),
      shortcut: 'I',
      icon: <span className="font-serif italic">I</span>,
    },
    { action: 'bullets', label: t('common.formatting.bulletList'), icon: <BulletsIcon /> },
    { action: 'numbers', label: t('common.formatting.numberedList'), icon: <NumbersIcon /> },
  ]

  return (
    <div
      className={`rounded-sm border bg-field focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-fg ${invalid ? 'border-danger dark:border-danger' : 'border-paper-line dark:border-line'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper-line px-1.5 py-1 dark:border-line">
        <div
          role="toolbar"
          aria-label={t('common.formatting.toolbar')}
          aria-controls={id}
          className="flex items-center gap-0.5"
        >
          {tools.map((tool) => (
            <button
              key={tool.action}
              type="button"
              aria-label={tool.label}
              title={tool.shortcut ? `${tool.label} (⌘/Ctrl+${tool.shortcut})` : tool.label}
              disabled={disabled || preview}
              // Keep the selection in the text area while clicking.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => apply(tool.action)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-xs text-sm text-paper-ink/80 hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg disabled:opacity-40 dark:text-fg-muted"
            >
              {tool.icon}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('common.formatting.mode')} className={segmentedControl}>
          <button
            type="button"
            aria-pressed={!preview}
            onClick={() => setPreview(false)}
            className={!preview ? segmentedOptionActive : segmentedOptionIdle}
          >
            {t('common.formatting.write')}
          </button>
          <button
            type="button"
            aria-pressed={preview}
            onClick={() => setPreview(true)}
            className={preview ? segmentedOptionActive : segmentedOptionIdle}
          >
            {t('common.formatting.preview')}
          </button>
        </div>
      </div>
      {preview ? (
        <div className="min-h-32 px-3 py-2 text-sm">
          {value.trim() ? (
            <FormattedText text={value} headings={headings} />
          ) : (
            <p className="text-paper-ink/60 dark:text-fg-faint">
              {t('common.formatting.emptyPreview')}
            </p>
          )}
        </div>
      ) : (
        <textarea
          ref={ref}
          id={id}
          name={id}
          autoComplete="off"
          value={value}
          rows={rows}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (!(event.metaKey || event.ctrlKey) || event.altKey) return
            const key = event.key.toLowerCase()
            if (key === 'b' || key === 'i') {
              event.preventDefault()
              apply(key === 'b' ? 'bold' : 'italic')
            }
          }}
          className="block w-full resize-y bg-transparent px-3 py-2 text-sm text-paper-ink outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-fg"
        />
      )}
    </div>
  )
}

function BulletsIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <circle cx="2.5" cy="4" r="1.2" />
      <circle cx="2.5" cy="8" r="1.2" />
      <circle cx="2.5" cy="12" r="1.2" />
      <rect x="5.5" y="3.25" width="9" height="1.5" rx="0.5" />
      <rect x="5.5" y="7.25" width="9" height="1.5" rx="0.5" />
      <rect x="5.5" y="11.25" width="9" height="1.5" rx="0.5" />
    </svg>
  )
}

function NumbersIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <text x="0.5" y="5.5" fontSize="5" fontFamily="inherit">
        1
      </text>
      <text x="0.5" y="13.5" fontSize="5" fontFamily="inherit">
        2
      </text>
      <rect x="5.5" y="3.25" width="9" height="1.5" rx="0.5" />
      <rect x="5.5" y="11.25" width="9" height="1.5" rx="0.5" />
    </svg>
  )
}
