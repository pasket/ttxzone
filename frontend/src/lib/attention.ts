/** Sent when an exercise's documents may have changed what needs fixing
 * (a document saved, proposals decided), so the menu's counts follow
 * without polling. */
export const ATTENTION_CHANGED_EVENT = 'ttx:attention-changed'

/** Sent by apiFetch after any write the page makes went through (a save,
 * an approval, a decision on proposals): whatever counts what's pending
 * reads again, without polling for the page's own changes. */
export const DATA_CHANGED_EVENT = 'ttx:data-changed'

/** Sent when the AI proposals waiting changed outside the page (the AI
 * client proposed something): the open proposals panel reads again. */
export const PROPOSALS_ARRIVED_EVENT = 'ttx:proposals-arrived'

/** How often what can change outside the page is read again, while the
 * tab is visible (background requests: not session activity). */
export const LIVE_REFRESH_MS = 15_000

/** GET /ttx/{id}/attention: issues keeping each document from moving on. */
export interface TTXAttention {
  needs_analysis: number
  msel: number | null
  session_plan: number | null
}

/** The menu section each document lives in. */
export function attentionBySection(a: TTXAttention): Record<string, number> {
  return {
    needs: a.needs_analysis,
    msel: a.msel ?? 0,
    'conduct-prep': a.session_plan ?? 0,
  }
}
