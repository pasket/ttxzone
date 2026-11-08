/** Client side of the session policy: when the user was last active (for
 * the inactivity warning) and the session's lifecycle shared across tabs.
 *
 * Every request `apiFetch` sends counts as activity -- the server resets
 * the soft timeout on them too -- except those marked with
 * BACKGROUND_REQUEST_HEADER (polling, live feeds), which the server
 * doesn't count either. Tabs share it through a BroadcastChannel: working
 * in one tab keeps the others from warning, and signing out in one signs
 * out all of them. */

export const BACKGROUND_REQUEST_HEADER = 'X-Background-Request'

const CHANNEL_NAME = 'ttx_session'
// Other tabs only need to hear about activity now and then.
const BROADCAST_INTERVAL_MS = 10_000

type SessionMessage = { type: 'activity'; at: number } | { type: 'ended'; expired: boolean }

let lastActivityAt = Date.now()
let lastBroadcastAt = 0
const activityListeners = new Set<() => void>()
const endedListeners = new Set<(expired: boolean) => void>()
let channel: BroadcastChannel | null | undefined

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel
  channel = null
  if (typeof BroadcastChannel === 'undefined') return channel
  try {
    channel = new BroadcastChannel(CHANNEL_NAME)
    channel.onmessage = (event: MessageEvent<SessionMessage>) => {
      const message = event.data
      if (message?.type === 'activity') setActivity(message.at)
      if (message?.type === 'ended') endedListeners.forEach((listener) => listener(message.expired))
    }
  } catch {
    channel = null
  }
  return channel
}

function setActivity(at: number) {
  if (at <= lastActivityAt) return
  lastActivityAt = at
  activityListeners.forEach((listener) => listener())
}

/** The user did something the server counts as activity. */
export function noteActivity(at: number = Date.now()): void {
  setActivity(at)
  if (at - lastBroadcastAt >= BROADCAST_INTERVAL_MS) {
    lastBroadcastAt = at
    getChannel()?.postMessage({ type: 'activity', at } satisfies SessionMessage)
  }
}

export function lastActivity(): number {
  return lastActivityAt
}

export function subscribeActivity(listener: () => void): () => void {
  getChannel()
  activityListeners.add(listener)
  return () => activityListeners.delete(listener)
}

/** Tell the other tabs the session is over: signed out, or expired. */
export function broadcastSessionEnded(expired: boolean): void {
  getChannel()?.postMessage({ type: 'ended', expired } satisfies SessionMessage)
}

export function subscribeSessionEnded(listener: (expired: boolean) => void): () => void {
  getChannel()
  endedListeners.add(listener)
  return () => endedListeners.delete(listener)
}
