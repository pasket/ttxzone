import { REAUTHENTICATION_REQUIRED, requestReauthentication } from './reauthentication'
import { BACKGROUND_REQUEST_HEADER, noteActivity } from './sessionActivity'
import { DATA_CHANGED_EVENT } from './attention'

export const API_BASE = '/api/v1'
const CSRF_COOKIE_NAME = 'ttx_csrf_token'
const CSRF_HEADER_NAME = 'X-CSRF-Token'

/** Fired on `window` when a request is refused for lack of a valid
 * session (expired or missing cookie) -- AuthProvider re-checks the
 * session and, if it's gone, drops to anonymous so the guards send the
 * user to /login instead of leaving pages rendering empty. */
export const SESSION_EXPIRED_EVENT = 'ttx:session-expired'

/** The 401s that mean "no valid session" -- not a wrong password
 * (INVALID_CREDENTIALS is also a 401, on login and re-auth forms). */
const SESSION_ERROR_CODES = new Set(['NOT_AUTHENTICATED', 'TOKEN_EXPIRED', 'TOKEN_INVALID'])

export interface ApiErrorBody {
  code: string
  message: string
  ttx_id: string | null
}

export class ApiError extends Error {
  code: string
  ttxId: string | null
  status: number

  constructor(status: number, body: ApiErrorBody) {
    super(body.message)
    this.status = status
    this.code = body.code
    this.ttxId = body.ttx_id
  }
}

/** The app's language, not the browser's (they differ once the user picks
 * one in Preferences): the API answers errors, and seeds content, in it.
 * i18n keeps `<html lang>` in step with it. */
function languageHeaders(headers: Headers): Headers {
  const language = document.documentElement.lang
  if (language && !headers.has('Accept-Language')) headers.set('Accept-Language', language)
  return headers
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Calls the API: session cookie included, CSRF header on writes, errors
 * thrown as `ApiError`. A request refused for want of a recent
 * re-authentication (step-up) asks the user to confirm it's them and,
 * once they have, is sent again. A request with BACKGROUND_REQUEST_HEADER
 * doesn't count as the user's activity. */
/** A write went through: whatever counts what's pending reads again. */
function changed() {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT))
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase()
  const background = new Headers(options.headers).get(BACKGROUND_REQUEST_HEADER) === '1'

  let response = await send(path, method, options)
  if (!background && response.status !== 401) noteActivity()
  if (response.status === 204) {
    if (method !== 'GET' && !background) changed()
    return undefined as T
  }

  let data = await response.json()
  if (
    response.status === 403 &&
    data?.error?.code === REAUTHENTICATION_REQUIRED &&
    (await requestReauthentication())
  ) {
    response = await send(path, method, options)
    if (response.status === 204) {
      if (method !== 'GET' && !background) changed()
      return undefined as T
    }
    data = await response.json()
  }

  if (!response.ok) throw failure(response.status, data)

  if (method !== 'GET' && !background) changed()
  return data as T
}

function send(path: string, method: string, options: RequestInit): Promise<Response> {
  const headers = languageHeaders(new Headers(options.headers))

  if (
    options.body !== undefined &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json')
  }
  if (method !== 'GET') {
    const csrfToken = readCookie(CSRF_COOKIE_NAME)
    if (csrfToken) {
      headers.set(CSRF_HEADER_NAME, csrfToken)
    }
  }

  return fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    credentials: 'include',
  })
}

/** The error of a refused request; one that means the session is gone
 * also tells AuthProvider, which sends the user to sign in again. */
function failure(status: number, data: { error?: ApiErrorBody } | null): ApiError {
  const error = new ApiError(
    status,
    data?.error ?? { code: 'HTTP_ERROR', message: `Request failed (${status}).`, ttx_id: null },
  )
  if (error.status === 401 && SESSION_ERROR_CODES.has(error.code)) {
    window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
  }
  return error
}

/** Downloads a file the API serves (PDF exports, approval evidence) the
 * way `apiFetch` makes requests: a plain link would leave the page for the
 * raw error when the session has expired, and the app would never know.
 * The file keeps the server's name (Content-Disposition). A download that
 * needs a recent re-authentication asks for it and is fetched again, like
 * `apiFetch`. */
export async function apiDownload(path: string): Promise<void> {
  const get = () =>
    fetch(`${API_BASE}${path}`, { credentials: 'include', headers: languageHeaders(new Headers()) })
  let response = await get()
  if (!response.ok) {
    let data = await response.json().catch(() => null)
    if (
      response.status === 403 &&
      data?.error?.code === REAUTHENTICATION_REQUIRED &&
      (await requestReauthentication())
    ) {
      response = await get()
      data = response.ok ? null : await response.json().catch(() => null)
    }
    if (!response.ok) throw failure(response.status, data)
  }
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = match ? decodeURIComponent(match[1]) : (path.split('/').pop() ?? 'download')
  document.body.append(link)
  link.click()
  link.remove()
  // After the click has handed the file to the browser.
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
