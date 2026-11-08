import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { render } from './testUtils'
import { SessionTimeoutWatcher } from '../src/components/common/SessionTimeoutWatcher'
import { apiFetch, ApiError } from '../src/lib/api'
import { setReauthenticationHandler } from '../src/lib/reauthentication'
import { lastActivity, noteActivity } from '../src/lib/sessionActivity'

const MINUTE = 60_000

/** A moment safely after any activity already recorded. The activity
 * clock only moves forward and starts at the real time the module loaded
 * (plus whatever earlier tests recorded), so a fixed date would be
 * ignored once the real clock passes it. Tests pin time from here on. */
function freshNow(): number {
  return Math.max(Date.now(), lastActivity()) + MINUTE
}

function jsonResponse(status: number, body: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const reauthRequired = {
  error: { code: 'REAUTHENTICATION_REQUIRED', message: "Confirm it's you.", ttx_id: null },
}

describe('apiFetch step-up', () => {
  afterEach(() => setReauthenticationHandler(null))

  it('sends the request again once the user confirmed it is them', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(403, reauthRequired))
      .mockResolvedValueOnce(jsonResponse(200, { done: true }))
    vi.stubGlobal('fetch', fetchMock)
    const handler = vi.fn(async () => true)
    setReauthenticationHandler(handler)

    await expect(apiFetch('/auth/password', { method: 'POST', body: '{}' })).resolves.toEqual({
      done: true,
    })
    expect(handler).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('gives up with the refusal when the user cancels', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse(403, reauthRequired)))
    setReauthenticationHandler(async () => false)

    const error = await apiFetch('/auth/password', { method: 'POST', body: '{}' }).catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('REAUTHENTICATION_REQUIRED')
  })
})

describe('session activity', () => {
  it('counts requests as activity, but not background ones', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200)))
    // Only Date is faked: the awaited fetch mock still resolves normally.
    const start = freshNow()
    vi.useFakeTimers({ now: start, toFake: ['Date'] })
    noteActivity()
    expect(lastActivity()).toBe(start)

    vi.setSystemTime(start + 1000)
    await apiFetch('/ttx', { headers: { 'X-Background-Request': '1' } })
    expect(lastActivity()).toBe(start)

    vi.setSystemTime(start + 2000)
    await apiFetch('/ttx')
    expect(lastActivity()).toBe(start + 2000)
  })
})

const expireSession = vi.fn(async () => {})
const logout = vi.fn(async () => {})
// The mocked session's deadlines, set by each test relative to its start.
const fixture = vi.hoisted(() => ({
  session: {
    idle_timeout_minutes: 30,
    idle_expires_at: '',
    absolute_expires_at: '',
    authenticated_at: '',
    step_up_minutes: 15,
  },
}))

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'ready',
    user: {
      id: 'u1',
      email: 'pm@acme.com',
      totp_enabled: true,
      legal_acceptance_pending: [],
      session: fixture.session,
    },
    expireSession,
    logout,
  }),
}))

describe('SessionTimeoutWatcher', () => {
  afterEach(() => {
    vi.useRealTimers()
    expireSession.mockClear()
  })

  it('warns before the inactivity timeout, keeps the session on request, then ends it', async () => {
    const start = freshNow()
    fixture.session.idle_expires_at = new Date(start + 30 * MINUTE).toISOString()
    // Far enough that the hard-timeout notice stays out of the way.
    fixture.session.absolute_expires_at = new Date(start + 12 * 60 * MINUTE).toISOString()
    fixture.session.authenticated_at = new Date(start).toISOString()
    vi.useFakeTimers({ now: start })
    noteActivity(start)
    expect(lastActivity()).toBe(start)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, {})))
    render(<SessionTimeoutWatcher />)

    // 30 min idle, minus the server's one-minute margin, minus the
    // two-minute warning: shown from minute 27.
    act(() => vi.advanceTimersByTime(26 * MINUTE))
    expect(screen.queryByText('Are you still there?')).toBeNull()
    act(() => vi.advanceTimersByTime(MINUTE + 1000))
    expect(screen.getByText('Are you still there?')).toBeInTheDocument()

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stay signed in' }))
    })
    act(() => vi.advanceTimersByTime(1000))
    expect(screen.queryByText('Are you still there?')).toBeNull()

    act(() => vi.advanceTimersByTime(30 * MINUTE))
    expect(expireSession).toHaveBeenCalledOnce()
  })
})
