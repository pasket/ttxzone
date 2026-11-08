import { useEffect, useEffectEvent, useState } from 'react'

import { apiFetch } from '../lib/api'
import { ATTENTION_CHANGED_EVENT } from '../lib/attention'
import type { ValidationReport } from '../lib/types'

export type SaveState = 'idle' | 'saving' | 'error'

const LIVE_VALIDATION_DELAY_MS = 400
/** Autosave waits a little longer than the live check, so a burst of
 * typing ends in one save. */
const AUTOSAVE_DELAY_MS = 800

/** Live validation + autosave for a document edited as one page-level
 * draft (the needs analysis, the MSEL). The backend owns the rules:
 *
 * - While there are unsaved changes (`payload` isn't null), the draft is
 *   posted to the document's dry-run endpoint a moment after the last edit;
 *   the returned report replaces the saved document's own until the next
 *   save. A failed check keeps the last report and shows as a failed save
 *   (the draft can't save without one).
 * - A moment later the draft saves itself -- only once the live report was
 *   computed for this exact payload (a slow check must never let a draft
 *   the backend would refuse slip through) and it has none of the
 *   `blockingCodes`; never two saves at once (the revision bump of a save
 *   reschedules this).
 *
 * `onSaved` is the caller's closure at firing time, so it sees the draft
 * the payload was built from. */
export function useAutosavedDocument<TDoc>({
  payload,
  savedReport,
  validateUrl,
  saveUrl,
  enabled,
  blockingCodes,
  onSaved,
  onError,
}: {
  /** The draft as the save body, or null when it matches the saved doc. */
  payload: string | null
  savedReport: ValidationReport
  validateUrl: string
  saveUrl: string
  /** False while edits aren't allowed yet (e.g. not confirmed). */
  enabled: boolean
  blockingCodes: ReadonlySet<string>
  onSaved: (next: TDoc) => void
  onError: (err: unknown) => void
}) {
  const [saveState, setSaveState] = useState<SaveState>('idle')
  // Kept with the payload it was computed for, so autosave can tell a
  // report of the current draft from one of an earlier state.
  const [live, setLive] = useState<{ payload: string; report: ValidationReport } | null>(null)

  useEffect(() => {
    if (payload === null) return
    let cancelled = false
    const timer = window.setTimeout(async () => {
      try {
        const next = await apiFetch<ValidationReport>(validateUrl, {
          method: 'POST',
          body: payload,
        })
        if (cancelled) return
        setLive({ payload, report: next })
        // A check that goes through again clears a failed one.
        setSaveState((state) => (state === 'error' ? 'idle' : state))
      } catch {
        // Keep the previous report; the next edit or the save will retry.
        // Said, though: without a check the draft can't save, and the
        // report on screen is no longer the draft's (an expired session
        // goes to sign in through apiFetch).
        if (!cancelled) setSaveState('error')
      }
    }, LIVE_VALIDATION_DELAY_MS)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [payload, validateUrl])

  const report = payload !== null ? (live?.report ?? savedReport) : savedReport
  const blocked = report.ready.some((issue) => blockingCodes.has(issue.code))
  const checked = payload !== null && live?.payload === payload
  const autosavePayload = enabled && checked && !blocked ? payload : null

  const autosave = useEffectEvent(async (body: string) => {
    if (saveState === 'saving') return
    const done = onSaved
    setSaveState('saving')
    try {
      const next = await apiFetch<TDoc>(saveUrl, { method: 'PUT', body })
      done(next)
      // What needs fixing may have changed: the menu reads it again.
      window.dispatchEvent(new Event(ATTENTION_CHANGED_EVENT))
      setSaveState('idle')
    } catch (err) {
      setSaveState('error')
      onError(err)
    }
  })
  useEffect(() => {
    if (autosavePayload === null) return
    const timer = window.setTimeout(() => void autosave(autosavePayload), AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [autosavePayload])

  return { report, saveState, blocked }
}
