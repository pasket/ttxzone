/** Descriptions that don't fit on one line (page intros, panel and tab
 * descriptions) fold to that line, cut with "…", behind "Show more": open
 * the first time a viewer meets one, folded from then on unless they open
 * it again. The
 * choice lives in this browser only (like the theme), keyed by the text's
 * i18n key. */

const STORAGE_KEY = 'ttx_help'

/** `seen`: shown open once (folded next time); `open` / `folded`: the
 * viewer's own choice. */
type HelpState = 'seen' | 'open' | 'folded'

function readAll(): Record<string, HelpState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, HelpState>) : {}
  } catch {
    return {}
  }
}

function write(id: string, state: HelpState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [id]: state }))
  } catch {
    // Storage unavailable: the description just opens again next time.
  }
}

/** Whether a description starts open: the first time, or when the viewer
 * left it open. */
export function startsOpen(id: string): boolean {
  const state = readAll()[id]
  return state === undefined || state === 'open'
}

/** Records that a description was shown open on its own, so it starts
 * folded next time. A choice the viewer made is kept. */
export function markSeen(id: string) {
  if (readAll()[id] === undefined) write(id, 'seen')
}

export function rememberChoice(id: string, open: boolean) {
  write(id, open ? 'open' : 'folded')
}
