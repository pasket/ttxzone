import { useCallback, useEffect, useRef, useState } from 'react'

import { API_BASE, apiFetch } from '../lib/api'
import { BACKGROUND_REQUEST_HEADER } from '../lib/sessionActivity'
import type { RunRead } from '../lib/types'

/** How often the Playground asks for news when it can't be told. */
export const RUN_POLL_MS = 3000
/** With the stream up, a fetch anyway this often (a missed ring heals). */
const SAFETY_MS = 30000
/** After this many stream errors in a row, poll -- and try the stream again later. */
const STREAM_FAILURES = 3
const STREAM_RETRY_MS = 60000

/** The live session of an exercise as the role the user acts as (`role`:
 * it marks them present). The server rings (`GET /run/stream`,
 * Server-Sent Events) whenever the session moves or someone comes or goes;
 * each ring fetches `GET /run` with the cursor held (204 while nothing
 * changed). Without the stream -- no EventSource, or it keeps failing --
 * it polls every 3 s and tries the stream again a minute later. Fetches
 * are background requests (they don't keep an idle session alive); none
 * while the tab is hidden. `apply` takes the view a Controller's action
 * answered with. */
export function useRunFeed(ttxId: string, role: string | null) {
  const [run, setRun] = useState<RunRead | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const seen = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let source: EventSource | null = null
    let streaming = false
    let failures = 0
    let lastFetch = 0
    let inFlight = false
    let again = false
    let retryTimer: number | undefined

    async function fetchNow() {
      if (cancelled || document.hidden) return
      if (inFlight) {
        again = true
        return
      }
      inFlight = true
      lastFetch = Date.now()
      const params = new URLSearchParams()
      if (role) params.set('as', role)
      if (seen.current) params.set('since', seen.current)
      const query = params.size ? `?${params}` : ''
      try {
        const result = await apiFetch<RunRead | undefined>(`/ttx/${ttxId}/run${query}`, {
          headers: { [BACKGROUND_REQUEST_HEADER]: '1' },
        })
        if (!cancelled) {
          if (result) {
            seen.current = result.cursor
            setRun(result)
          }
          setError(null)
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        inFlight = false
        if (again && !cancelled) {
          again = false
          void fetchNow()
        }
      }
    }

    function openStream() {
      if (cancelled || source || typeof EventSource === 'undefined' || document.hidden) return
      const query = role ? `?as=${encodeURIComponent(role)}` : ''
      source = new EventSource(`${API_BASE}/ttx/${ttxId}/run/stream${query}`, {
        withCredentials: true,
      })
      source.addEventListener('change', () => void fetchNow())
      source.onopen = () => {
        streaming = true
        failures = 0
      }
      source.onerror = () => {
        streaming = false
        failures += 1
        if (failures >= STREAM_FAILURES) {
          closeStream()
          retryTimer = window.setTimeout(() => {
            failures = 0
            openStream()
          }, STREAM_RETRY_MS)
        }
      }
    }

    function closeStream() {
      source?.close()
      source = null
      streaming = false
    }

    // Polling while there's no stream; a safety fetch now and then with one.
    const ticker = window.setInterval(() => {
      if (document.hidden) return
      if (!streaming || Date.now() - lastFetch >= SAFETY_MS) void fetchNow()
    }, RUN_POLL_MS)

    function onVisibility() {
      if (document.hidden) {
        closeStream()
      } else {
        openStream()
        void fetchNow()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    seen.current = null
    void fetchNow()
    openStream()
    return () => {
      cancelled = true
      window.clearInterval(ticker)
      window.clearTimeout(retryTimer)
      document.removeEventListener('visibilitychange', onVisibility)
      closeStream()
    }
  }, [ttxId, role])

  // An action's answer is the Controller's view without presence: the
  // next fetch still takes the whole view once.
  const apply = useCallback((next: RunRead) => {
    seen.current = null
    setRun((current) => ({ ...next, presence: current?.presence ?? next.presence }))
  }, [])

  return { run, error, apply }
}
