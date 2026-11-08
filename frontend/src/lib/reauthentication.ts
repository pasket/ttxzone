/** Step-up re-authentication. Sensitive actions answer 403
 * REAUTHENTICATION_REQUIRED when the user hasn't proved who they are on
 * this session recently; `apiFetch` then asks the registered handler (the
 * app's ReauthenticationHost dialog) and, once confirmed, sends the
 * request again. Several refused requests at once share one dialog. */

export const REAUTHENTICATION_REQUIRED = 'REAUTHENTICATION_REQUIRED'

type Handler = () => Promise<boolean>

let handler: Handler | null = null
let pending: Promise<boolean> | null = null

export function setReauthenticationHandler(next: Handler | null): void {
  handler = next
}

/** Resolves true once the user confirmed it's them, false if they didn't
 * (or nothing can ask them). */
export function requestReauthentication(): Promise<boolean> {
  if (handler === null) return Promise.resolve(false)
  pending ??= handler().finally(() => {
    pending = null
  })
  return pending
}
