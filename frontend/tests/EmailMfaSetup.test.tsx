import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EmailMfaSetup } from '../src/components/account/EmailMfaSetup'
import { render } from './testUtils'

const mockUser = vi.fn()
const refresh = vi.fn()

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser(), refresh }),
}))

function answer(status: number, body: unknown = {}): Response {
  return { ok: status < 400, status, json: async () => body } as Response
}

function refused(message: string): Response {
  return answer(400, { success: false, error: { code: 'REFUSED', message, ttx_id: null } })
}

const ON = { email: 'pat@acme.com', email_mfa_enabled: true, email_mfa_available: true }
const OFF = { email: 'pat@acme.com', email_mfa_enabled: false, email_mfa_available: true }

let fetchMock: ReturnType<typeof vi.fn>

const called = (path: string, method: string) =>
  fetchMock.mock.calls.filter(([url, init]) => String(url).endsWith(path) && init.method === method)

async function codeAsked() {
  fireEvent.click(screen.getByRole('button', { name: 'Turn on codes by email' }))
  return screen.findByLabelText('6-digit code')
}

describe('EmailMfaSetup', () => {
  beforeEach(() => {
    refresh.mockReset()
    fetchMock = vi.fn(async () => answer(200, { sent_to: 'p•••@acme.com' }))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => vi.unstubAllGlobals())

  it('turns on with the code sent to the address', async () => {
    mockUser.mockReturnValue(OFF)
    render(<EmailMfaSetup mandatory={false} />)

    fireEvent.change(await codeAsked(), { target: { value: '123456' } })
    expect(screen.getByText(/p•••@acme.com/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    const [[, init]] = called('/auth/mfa/email/enable/confirm', 'POST')
    expect(JSON.parse(String(init.body))).toEqual({ code: '123456' })
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument()
  })

  it('clears a refused code and says why, without turning on', async () => {
    mockUser.mockReturnValue(OFF)
    render(<EmailMfaSetup mandatory={false} />)
    const input = await codeAsked()

    fetchMock.mockImplementation(async () => refused('That code is not valid.'))
    fireEvent.change(input, { target: { value: '000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Turn on' }))

    expect(await screen.findByText('That code is not valid.')).toBeInTheDocument()
    expect(screen.getByLabelText('6-digit code')).toHaveValue('')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('says why the code could not be sent, and stays where it was', async () => {
    fetchMock.mockImplementation(async () => refused('Too many messages to this address.'))
    mockUser.mockReturnValue(OFF)
    render(<EmailMfaSetup mandatory={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Turn on codes by email' }))

    expect(await screen.findByText('Too many messages to this address.')).toBeInTheDocument()
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on codes by email' })).toBeEnabled()
  })

  it('goes back without confirming', async () => {
    mockUser.mockReturnValue(OFF)
    render(<EmailMfaSetup mandatory={false} />)
    await codeAsked()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByRole('button', { name: 'Turn on codes by email' })).toBeInTheDocument()
    expect(called('/auth/mfa/email/enable/confirm', 'POST')).toHaveLength(0)
  })

  it('turns off', async () => {
    mockUser.mockReturnValue(ON)
    render(<EmailMfaSetup mandatory={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Turn off codes by email' }))

    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(called('/auth/mfa/email', 'DELETE')).toHaveLength(1)
  })

  it('says why it could not turn off, and stays on', async () => {
    fetchMock.mockImplementation(async () => refused('Your role needs a second factor.'))
    mockUser.mockReturnValue(ON)
    render(<EmailMfaSetup mandatory={false} />)

    fireEvent.click(screen.getByRole('button', { name: 'Turn off codes by email' }))

    expect(await screen.findByText('Your role needs a second factor.')).toBeInTheDocument()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('offers nothing where the platform sends no email', () => {
    mockUser.mockReturnValue({ ...OFF, email_mfa_available: false })
    render(<EmailMfaSetup mandatory />)

    expect(screen.getByText(/doesn't send email/)).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByText(/alternative to the authenticator/)).not.toBeInTheDocument()
  })

  it('still lets an account turn it off when the platform stopped sending', () => {
    mockUser.mockReturnValue({ ...ON, email_mfa_available: false })
    render(<EmailMfaSetup mandatory={false} />)

    expect(screen.getByText(/isn't sending email right now/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn off codes by email' })).toBeInTheDocument()
  })

  it('says where it is only an alternative to the authenticator', () => {
    mockUser.mockReturnValue(OFF)
    render(<EmailMfaSetup mandatory />)

    expect(screen.getByText(/alternative to the authenticator/)).toBeInTheDocument()
  })
})
