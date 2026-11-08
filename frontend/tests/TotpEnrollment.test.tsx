import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { AuthProvider } from '../src/lib/AuthContext'
import { TotpEnrollment } from '../src/components/account/TotpEnrollment'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('TotpEnrollment', () => {
  it('calls POST /auth/totp/enroll exactly once even under StrictMode double-invoke', async () => {
    // AuthProvider's own mount-time /auth/me fetch is a plain GET, so
    // StrictMode double-invoking it is harmless -- give it an unlimited
    // 401 responder rather than a single-shot mock. The enroll POST is
    // the one this test actually cares about being called exactly once.
    const meMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
      }),
    } as Response)
    const enrollMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ provisioning_uri: 'otpauth://totp/ttx-zone:x@acme.com?secret=ABC' }),
    } as Response)

    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const url = String(args[0])
      if (url.includes('/auth/me')) return meMock(...args)
      return enrollMock(...args)
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <StrictMode>
        <MemoryRouter>
          <AuthProvider>
            <TotpEnrollment />
          </AuthProvider>
        </MemoryRouter>
      </StrictMode>,
    )

    await screen.findByText('Set up two-factor authentication')
    // Not asserting on the rendered <img> itself: qrcode's toDataURL tries
    // a real <canvas> in a DOM environment, which jsdom doesn't implement
    // without the optional native `canvas` package -- irrelevant to what
    // this test checks (StrictMode shouldn't cause a second enroll call).
    await waitFor(() => expect(enrollMock).toHaveBeenCalled())

    expect(enrollMock).toHaveBeenCalledTimes(1)
  })

  it('shows backup codes after confirming and navigates home once acknowledged', async () => {
    let meCallCount = 0
    const fetchMock = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const url = String(args[0])
      if (url.includes('/auth/me')) {
        meCallCount += 1
        if (meCallCount === 1) {
          return {
            ok: false,
            status: 401,
            json: async () => ({
              error: {
                code: 'NOT_AUTHENTICATED',
                message: 'Authentication required.',
                ttx_id: null,
              },
            }),
          } as Response
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'u1',
            email: 'x@acme.com',
            full_name: 'X',
            totp_enabled: true,
            legal_acceptance_pending: [],
            backup_codes_remaining: 2,
            is_program_manager: false,
            is_planner: false,
          }),
        } as Response
      }
      if (url.includes('/auth/totp/enroll/confirm')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ backup_codes: ['aaaa1111-bbbb2222', 'cccc3333-dddd4444'] }),
        } as Response
      }
      if (url.includes('/auth/totp/enroll')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ provisioning_uri: 'otpauth://totp/ttx-zone:x@acme.com?secret=ABC' }),
        } as Response
      }
      if (url.includes('/ttx')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
        } as Response
      }
      return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(
      <MemoryRouter>
        <AuthProvider>
          <TotpEnrollment />
        </AuthProvider>
      </MemoryRouter>,
    )

    await screen.findByAltText('QR code for authenticator app enrollment')
    fireEvent.change(screen.getByLabelText('6-digit code'), { target: { value: '123456' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enable two-factor authentication' }))

    expect(await screen.findByText('Save your backup codes')).toBeInTheDocument()
    expect(screen.getByText('aaaa1111-bbbb2222')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    expect(mockNavigate).toHaveBeenCalledWith('/')
  })
})
