import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PlatformSecuritySection } from '../src/components/platform/PlatformSecuritySection'
import type { SecurityPolicy } from '../src/lib/types'
import { render } from './testUtils'

const POLICY: SecurityPolicy = {
  password: { min_length: 8, reject_personal: false, max_age_days: null, history_count: 0 },
  mfa: { program_manager: true, planner: true, evaluator: true, observer: true, player: false },
  accounts_without_totp: { program_manager: 0, planner: 0, evaluator: 0, observer: 0, player: 3 },
}

function respond(body: unknown) {
  return { ok: true, status: 200, json: async () => body } as Response
}

describe('PlatformSecuritySection', () => {
  it('shows the policy and saves both groups together', async () => {
    const saved: SecurityPolicy = {
      ...POLICY,
      password: { ...POLICY.password, min_length: 12, max_age_days: 90 },
      mfa: { ...POLICY.mfa, player: true },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond(POLICY))
      .mockResolvedValueOnce(respond(saved))
    vi.stubGlobal('fetch', fetchMock)

    render(<PlatformSecuritySection />)

    const minLength = await screen.findByLabelText('Minimum length')
    expect(minLength).toHaveValue(8)
    expect(screen.getByText('3 accounts in this role have no authenticator app yet.')).toBeVisible()
    const admin = screen.getByRole('checkbox', { name: /Instance administrator/ })
    expect(admin).toBeChecked()
    expect(admin).toBeDisabled()
    const save = screen.getByRole('button', { name: 'Save policy' })
    expect(save).toBeDisabled()

    fireEvent.change(minLength, { target: { value: '7' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /^Player/ }))
    expect(save).toBeDisabled()
    fireEvent.change(minLength, { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText(/Expires after/), { target: { value: '90' } })
    fireEvent.click(save)

    expect(await screen.findByText('Security policy saved')).toBeInTheDocument()
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toMatch(/\/instance\/security-policy$/)
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body)).toEqual({ password: saved.password, mfa: saved.mfa })
  })
})
