import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { apiFetch } from '../lib/api'
import {
  ATTENTION_CHANGED_EVENT,
  attentionBySection,
  DATA_CHANGED_EVENT,
  LIVE_REFRESH_MS,
  type TTXAttention,
} from '../lib/attention'
import { PROPOSALS_CHANGED_EVENT } from '../lib/proposalLabels'
import { BACKGROUND_REQUEST_HEADER } from '../lib/sessionActivity'

/** By menu section, how many validation issues keep the exercise's
 * documents from moving on, whatever their origin. Read again on each
 * page, after any write of the page (a save, an approval, a decision on
 * proposals), on focus, and now and then while the tab is visible. */
export function useDocumentAttention(ttxId: string | null | undefined): Record<string, number> {
  const { pathname } = useLocation()
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const again = () => setTick((n) => n + 1)
    const events = [ATTENTION_CHANGED_EVENT, PROPOSALS_CHANGED_EVENT, DATA_CHANGED_EVENT, 'focus']
    for (const name of events) window.addEventListener(name, again)
    // Another member of the team may change a document too.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') again()
    }, LIVE_REFRESH_MS * 2)
    return () => {
      for (const name of events) window.removeEventListener(name, again)
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!ttxId) return
    let cancelled = false
    apiFetch<TTXAttention>(`/ttx/${ttxId}/attention`, {
      headers: { [BACKGROUND_REQUEST_HEADER]: '1' },
    })
      .then((attention) => {
        if (!cancelled) setCounts(attentionBySection(attention))
      })
      .catch(() => {
        if (!cancelled) setCounts({})
      })
    return () => {
      cancelled = true
    }
  }, [ttxId, tick, pathname])

  return ttxId ? counts : {}
}
