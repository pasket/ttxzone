import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { AuthProvider } from '../src/lib/AuthContext'
import { WaitingRoom } from '../src/components/auth/WaitingRoom'
import { mockFetchOnce } from './mockFetch'

describe('WaitingRoom', () => {
  it('shows the token input and instructions', async () => {
    mockFetchOnce(401)
    render(
      <MemoryRouter>
        <AuthProvider>
          <WaitingRoom />
        </AuthProvider>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Your profile is active')).toBeInTheDocument()
    expect(screen.getByLabelText('Invitation token')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Or create your own organization' })).toHaveAttribute(
      'href',
      '/account/organizations/new',
    )
  })

  it('shows a confirmation state after successfully submitting a token', async () => {
    const fetchMock = mockFetchOnce(401)
    fetchMock
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response)
      // WaitingRoom's own post-submit refresh() re-checks /auth/me
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
        }),
      } as Response)

    render(
      <MemoryRouter>
        <AuthProvider>
          <WaitingRoom />
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.change(await screen.findByLabelText('Invitation token'), {
      target: { value: 'some-token' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Join exercise' }))

    expect(await screen.findByText('Request submitted')).toBeInTheDocument()
    expect(screen.queryByLabelText('Invitation token')).not.toBeInTheDocument()
  })

  it('shows the organization name suffixed with its domain when redeeming returns one', async () => {
    const fetchMock = mockFetchOnce(401)
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          ttx_id: 'ttx-1',
          ttx_name: 'Drill',
          organization_name: 'Acme Corp',
          organization_domain: 'acme.com',
          role: 'player',
          status: 'pending',
          user: { id: 'user-1', email: 'a@acme.com', full_name: 'A' },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
        }),
      } as Response)

    render(
      <MemoryRouter>
        <AuthProvider>
          <WaitingRoom />
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.change(await screen.findByLabelText('Invitation token'), {
      target: { value: 'some-token' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Join exercise' }))

    expect(
      await screen.findByText(
        'The planning team at Acme Corp (acme.com) needs to approve your request before you can access this exercise.',
      ),
    ).toBeInTheDocument()
  })

  it('logs out and goes to the login page, since it has no header', async () => {
    const fetchMock = mockFetchOnce(401)
    fetchMock.mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) } as Response)
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'NOT_AUTHENTICATED', message: '', ttx_id: null } }),
    } as Response)
    render(
      <MemoryRouter initialEntries={['/']}>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<WaitingRoom />} />
            <Route path="/login" element={<p>Login page</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByText('Login page')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
