import type { PlatformAuditEvent } from './types'

/** The exercise an activity entry is about, code and name apart, to show
 * it as the rest of the application names a coded row. Entries carry them
 * in `details`; the ones recorded before that only have the label of the
 * time ("TTX-2026-09 Ransomware", or with a "·" between), read here. Null
 * when the entry isn't about an exercise or its label doesn't read so. */
export function exerciseOf(event: PlatformAuditEvent): { code: string; name: string } | null {
  if (event.target_kind !== 'exercise') return null
  const { exercise_code: code, exercise_name: name } = event.details ?? {}
  if (typeof code === 'string' && typeof name === 'string') return { code, name }
  const match = /^(TTX-\d{4}-\d+)(?: · | )(.+)$/.exec(event.target_label ?? '')
  return match ? { code: match[1], name: match[2] } : null
}
