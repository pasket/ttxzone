import { fireEvent, screen } from '@testing-library/react'

import { render } from './testUtils'
import { describe, expect, it, vi } from 'vitest'

import { ChangePassword } from '../src/components/account/ChangePassword'

function fillForm(current: string, next: string, confirm: string) {
  fireEvent.change(screen.getByLabelText('Current password'), {
    target: { value: current },
  })
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: next } })
  fireEvent.change(screen.getByLabelText('Confirm new password'), {
    target: { value: confirm },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Update password' }))
}

describe('ChangePassword', () => {
  it('keeps submit disabled and shows unmet requirements for a weak new password', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<ChangePassword />)
    fillForm('Correcthorse123!', 'short12', 'short12')

    expect(screen.getByText(/At least 8 characters/)).toBeInTheDocument()
    expect(screen.getByText(/One uppercase letter/)).toBeInTheDocument()
    expect(screen.getByText(/One symbol/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Update password' })).toBeDisabled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('blocks submit client-side when new and confirm passwords differ', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<ChangePassword />)
    fillForm('Correcthorse123!', 'Brand-new-password-1!', 'Brand-new-password-2!')

    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the server error when the current password is wrong', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid password.', ttx_id: null },
      }),
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<ChangePassword />)
    fillForm('wrong-password', 'Brand-new-password-1!', 'Brand-new-password-1!')

    expect(await screen.findByText('Invalid password.')).toBeInTheDocument()
  })

  it('submits current/new password and shows success', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 204,
      json: async () => undefined,
    } as Response)
    vi.stubGlobal('fetch', fetchMock)

    render(<ChangePassword />)
    fillForm('Correcthorse123!', 'Brand-new-password-1!', 'Brand-new-password-1!')

    expect(await screen.findByText('Changes saved successfully')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/password'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          current_password: 'Correcthorse123!',
          new_password: 'Brand-new-password-1!',
        }),
      }),
    )
  })
})
