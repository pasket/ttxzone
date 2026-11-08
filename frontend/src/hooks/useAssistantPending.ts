import { useEffect, useRef, useState } from 'react'

import { apiFetch } from '../lib/api'
import { DATA_CHANGED_EVENT, LIVE_REFRESH_MS, PROPOSALS_ARRIVED_EVENT } from '../lib/attention'
import {
  countBySection,
  PROPOSALS_CHANGED_EVENT,
  type ProposalSection,
} from '../lib/proposalLabels'
import type { ProposalListResponse } from '../lib/proposals'
import { BACKGROUND_REQUEST_HEADER } from '../lib/sessionActivity'

/** The person's AI proposals waiting on the exercise, counted by the
 * Creator section they wait in -- for the header, so they're found from
 * any page. Read again after any write of the page and on focus, and every
 * LIVE_REFRESH_MS while the tab is visible (the AI client proposes from
 * another app); when new ones arrive, PROPOSALS_ARRIVED_EVENT tells an open
 * panel. */
export function useAssistantPending(
  ttxId: string | null | undefined,
): Partial<Record<ProposalSection, number>> {
  const [counts, setCounts] = useState<Partial<Record<ProposalSection, number>>>({})
  const [tick, setTick] = useState(0)
  const seen = useRef<string | null>(null)

  useEffect(() => {
    const again = () => setTick((n) => n + 1)
    const onVisible = () => {
      if (document.visibilityState === 'visible') again()
    }
    const events = [PROPOSALS_CHANGED_EVENT, DATA_CHANGED_EVENT, 'focus']
    for (const name of events) window.addEventListener(name, again)
    document.addEventListener('visibilitychange', onVisible)
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') again()
    }, LIVE_REFRESH_MS)
    return () => {
      for (const name of events) window.removeEventListener(name, again)
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!ttxId) return
    let cancelled = false
    apiFetch<ProposalListResponse>(`/ttx/${ttxId}/assistant/proposals`, {
      headers: { [BACKGROUND_REQUEST_HEADER]: '1' },
    })
      .then((list) => {
        if (cancelled) return
        setCounts(countBySection(list.items))
        const ids = list.items
          .map((p) => p.id)
          .sort()
          .join(',')
        // Proposals the page didn't make: an open panel reads them in.
        if (seen.current !== null && ids !== seen.current) {
          window.dispatchEvent(new Event(PROPOSALS_ARRIVED_EVENT))
        }
        seen.current = ids
      })
      .catch(() => {
        if (!cancelled) setCounts({})
      })
    return () => {
      cancelled = true
    }
  }, [ttxId, tick])

  return ttxId ? counts : {}
}
