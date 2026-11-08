import { screen } from '@testing-library/react'

import { render } from './testUtils'
import { describe, expect, it, vi } from 'vitest'

import { AccountSettingsSecurity } from '../src/components/account/AccountSettingsSecurity'

const mockUser = vi.fn()

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    status: 'ready',
    user: mockUser(),
    ttxList: [],
    activeOrganizationId: 'org-1',
    refresh: vi.fn(),
    logout: vi.fn(),
  }),
}))

describe('AccountSettingsSecurity', () => {
  it('shows a locked note instead of the disable control for a Exercise Program Manager with TOTP enabled', () => {
    mockUser.mockReturnValue({
      id: 'u1',
      email: 'admin@acme.com',
      full_name: 'Admin',
      totp_enabled: true,
      legal_acceptance_pending: [],
      backup_codes_remaining: 8,
      is_program_manager: true,
      is_planner: false,
    })

    render(<AccountSettingsSecurity />)

    expect(
      screen.getByText(
        'Two-factor authentication is mandatory for your role and cannot be disabled.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Disable two-factor authentication' })).toBeNull()
    expect(screen.getByText('8 backup codes remaining.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate backup codes' })).toBeInTheDocument()
  })

  it('shows a locked note instead of the disable control for a Planner with TOTP enabled', () => {
    mockUser.mockReturnValue({
      id: 'u2',
      email: 'eval@acme.com',
      full_name: 'Eval',
      totp_enabled: true,
      legal_acceptance_pending: [],
      backup_codes_remaining: 5,
      is_program_manager: false,
      is_planner: true,
    })

    render(<AccountSettingsSecurity />)

    expect(
      screen.getByText(
        'Two-factor authentication is mandatory for your role and cannot be disabled.',
      ),
    ).toBeInTheDocument()
  })

  it('shows the disable control for a plain user with TOTP enabled', () => {
    mockUser.mockReturnValue({
      id: 'u3',
      email: 'plain@acme.com',
      full_name: 'Plain',
      totp_enabled: true,
      legal_acceptance_pending: [],
      backup_codes_remaining: 10,
      is_program_manager: false,
      is_planner: false,
    })

    render(<AccountSettingsSecurity />)

    expect(
      screen.getByRole('button', { name: 'Disable two-factor authentication' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regenerate backup codes' })).toBeInTheDocument()
  })

  it('offers a code by email to a Player and lets someone with both pick the first one asked', () => {
    mockUser.mockReturnValue({
      id: 'u4',
      email: 'pat@acme.com',
      full_name: 'Pat',
      totp_enabled: true,
      legal_acceptance_pending: [],
      backup_codes_remaining: 10,
      is_program_manager: false,
      is_planner: false,
      email_mfa_enabled: true,
      email_mfa_available: true,
      mfa_methods: ['totp', 'email', 'backup_code'],
      mfa_preferred: 'email',
    })

    render(<AccountSettingsSecurity />)

    expect(
      screen.getByText('On: sign-in can ask for a code sent to pat@acme.com.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn off codes by email' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Code by email/ })).toBeChecked()
  })

  it('tells a Program Manager that the code by email does not replace the app', () => {
    mockUser.mockReturnValue({
      id: 'u5',
      email: 'pm@acme.com',
      full_name: 'PM',
      totp_enabled: false,
      legal_acceptance_pending: [],
      backup_codes_remaining: 0,
      is_program_manager: true,
      is_planner: false,
      email_mfa_enabled: false,
      email_mfa_available: true,
      mfa_methods: [],
      mfa_preferred: null,
    })

    render(<AccountSettingsSecurity />)

    expect(
      screen.getByText(
        "For your role it's an alternative to the authenticator app, which stays required.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on codes by email' })).toBeInTheDocument()
  })
})
