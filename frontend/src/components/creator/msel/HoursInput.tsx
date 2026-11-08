import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { formatHours, parseHours } from '../../../lib/msel'
import { TextInput } from '../needs/fields'

/** A span typed in hours ("3", "2,5", "2.5") and stored in minutes, up to
 * `maxMinutes` (a day by default): the session length, a phase's time
 * jump. Keeps its own text so a half-typed decimal isn't rewritten under
 * the caret; resyncs when the minutes change from elsewhere (a reload, a
 * save from the server). */
export function HoursInput({
  id,
  minutes,
  invalid = false,
  maxMinutes = 1440,
  onChange,
}: {
  id: string
  minutes: number | null
  invalid?: boolean
  maxMinutes?: number
  onChange: (minutes: number | null) => void
}) {
  const { i18n } = useTranslation()
  const [text, setText] = useState(() => formatHours(minutes, i18n.language))
  if (parseHours(text, maxMinutes) !== minutes) setText(formatHours(minutes, i18n.language))
  return (
    <TextInput
      id={id}
      inputMode="decimal"
      autoComplete="off"
      value={text}
      invalid={invalid}
      hint
      onChange={(value) => {
        const next = parseHours(value, maxMinutes)
        if (next === undefined) return // not a number: ignore the keystroke
        setText(value)
        onChange(next)
      }}
    />
  )
}
