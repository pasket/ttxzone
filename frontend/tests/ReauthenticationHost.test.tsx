import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ReauthenticationHost } from '../src/components/common/ReauthenticationHost'
import { requestReauthentication } from '../src/lib/reauthentication'
import { render } from './testUtils'

const mockUser = vi.fn()

vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => ({ user: mockUser() }) }))

function answer(status: number, body: unknown = {}): Response {
  return { ok: status < 400, status, json: async () => body } as Response
}

function refused(code: string, status = 400): Response {
  return answer(status, { success: false, error: { code, message: code, ttx_id: null } })
}

let fetchMock: ReturnType<typeof vi.fn>

const calls = (path: string) =>
  fetchMock.mock.calls.filter(([url]) => String(url).endsWith(path)).map(([, init]) => init)

const sentBody = (path: string) => JSON.parse(String(calls(path).at(-1)!.body))

/** A refused request asking for the dialog, as `apiFetch` does. Wrapped: an
 * async function returning the promise itself would wait for its answer. */
async function ask() {
  render(<ReauthenticationHost />)
  let confirmed = Promise.resolve(false)
  await act(async () => {
    confirmed = requestReauthentication()
  })
  return { confirmed }
}

describe('ReauthenticationHost', () => {
  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) =>
      String(url).endsWith('/auth/step-up/email-code')
        ? answer(200, { sent_to: 'p•••@acme.com' })
        : answer(200),
    )
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    // The pending request is the module's: one left open would answer the next test.
    const cancel = screen.queryByRole('button', { name: 'Cancel' })
    if (cancel) await act(async () => fireEvent.click(cancel))
  })

  it('shows nothing until a request needs it', () => {
    mockUser.mockReturnValue({ mfa_methods: ['totp'], has_password: true })
    render(<ReauthenticationHost />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('answers false with nothing mounted to ask', async () => {
    await expect(requestReauthentication()).resolves.toBe(false)
  })

  it('confirms with an authenticator code and lets the request go again', async () => {
    mockUser.mockReturnValue({ mfa_methods: ['totp'], has_password: true })
    const { confirmed } = await ask()

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await expect(confirmed).resolves.toBe(true)
    expect(sentBody('/auth/step-up')).toEqual({ code: '123456', method: 'totp' })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('asks for the password on an account without a second factor', async () => {
    mockUser.mockReturnValue({ mfa_methods: [], has_password: true })
    const { confirmed } = await ask()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await expect(confirmed).resolves.toBe(true)
    expect(sentBody('/auth/step-up')).toEqual({ password: 'secret' })
  })

  it('sends a code by email at once when that is the preferred method', async () => {
    mockUser.mockReturnValue({
      mfa_methods: ['totp', 'email'],
      mfa_preferred: 'email',
      has_password: true,
    })
    const { confirmed } = await ask()

    expect(await screen.findByText(/p•••@acme.com/)).toBeInTheDocument()
    expect(calls('/auth/step-up/email-code')).toHaveLength(1)
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '654321' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    await expect(confirmed).resolves.toBe(true)
    expect(sentBody('/auth/step-up')).toEqual({ code: '654321', method: 'email' })
  })

  it('switches between the two codes, sending the email only once', async () => {
    mockUser.mockReturnValue({ mfa_methods: ['totp', 'email'], has_password: true })
    await ask()

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '111111' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send me a code by email instead' }))
    expect(await screen.findByText(/p•••@acme.com/)).toBeInTheDocument()
    expect(screen.getByLabelText('6-digit code')).toHaveValue('')

    fireEvent.click(screen.getByRole('button', { name: 'Use the authenticator app instead' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Send me a code by email instead' }))
    await screen.findByRole('button', { name: 'Use the authenticator app instead' })
    expect(calls('/auth/step-up/email-code')).toHaveLength(1)
  })

  it('says why the email could not be sent', async () => {
    fetchMock.mockImplementation(async () => refused('EMAIL_CODE_RATE_LIMITED', 429))
    mockUser.mockReturnValue({ mfa_methods: ['email'], has_password: true })
    await ask()

    expect(await screen.findByText('EMAIL_CODE_RATE_LIMITED')).toBeInTheDocument()
  })

  it('stays open on a wrong code', async () => {
    fetchMock.mockImplementation(async () => refused('INVALID_TOTP_CODE'))
    mockUser.mockReturnValue({ mfa_methods: ['totp'], has_password: true })
    await ask()

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText(/That code is not valid/)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('tells a wrong password apart from a wrong code', async () => {
    fetchMock.mockImplementation(async () => refused('INVALID_CREDENTIALS', 401))
    mockUser.mockReturnValue({ mfa_methods: [], has_password: true })
    await ask()

    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText('Incorrect password.')).toBeInTheDocument()
  })

  it('says when too many wrong codes lock the second factor', async () => {
    fetchMock.mockImplementation(async () => refused('TOO_MANY_ATTEMPTS', 429))
    mockUser.mockReturnValue({ mfa_methods: ['totp'], has_password: true })
    await ask()

    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))

    expect(await screen.findByText(/Too many wrong codes/)).toBeInTheDocument()
  })

  it('answers false when the person cancels, sending nothing', async () => {
    mockUser.mockReturnValue({ mfa_methods: ['totp'], has_password: true })
    const { confirmed } = await ask()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await expect(confirmed).resolves.toBe(false)
    expect(calls('/auth/step-up')).toHaveLength(0)
  })

  it('shares one dialog between requests refused at once', async () => {
    mockUser.mockReturnValue({ mfa_methods: ['totp'], has_password: true })
    const { confirmed: first } = await ask()
    const second = requestReauthentication()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await expect(Promise.all([first, second])).resolves.toEqual([false, false])
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('sends an account with neither to its provider', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign, pathname: '/admin', search: '' })
    fetchMock.mockImplementation(async () =>
      answer(200, { authorize_url: 'https://idp.acme.com/authorize' }),
    )
    mockUser.mockReturnValue({ mfa_methods: [], has_password: false, sso_provider: 'Microsoft' })
    await ask()

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Microsoft' }))

    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://idp.acme.com/authorize'))
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('stays open when the provider cannot be reached', async () => {
    fetchMock.mockImplementation(async () => refused('SSO_UNAVAILABLE', 503))
    mockUser.mockReturnValue({ mfa_methods: [], has_password: false, sso_provider: 'Microsoft' })
    await ask()

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Microsoft' }))

    expect(await screen.findByText('SSO_UNAVAILABLE')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Continue with Microsoft' })).toBeEnabled()
  })
})
