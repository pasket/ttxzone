import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AvatarPicker } from '../src/components/account/AvatarPicker'
import { AuthProvider } from '../src/lib/AuthContext'

function meResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'u1',
    email: 'owner@acme.com',
    full_name: 'Owner',
    totp_enabled: true,
    legal_acceptance_pending: [],
    is_program_manager: true,
    avatar_kind: null,
    avatar_value: null,
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function stubAuth(fetchMock: ReturnType<typeof vi.fn>) {
  fetchMock
    .mockResolvedValueOnce(jsonResponse(200, meResponse()))
    .mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 }))
    .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
}

function renderPicker() {
  const fetchMock = vi.fn()
  stubAuth(fetchMock)
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthProvider>
      <AvatarPicker />
    </AuthProvider>,
  )
  return fetchMock
}

describe('AvatarPicker', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('selecting a preset posts the preset key and refreshes the session', async () => {
    const fetchMock = renderPicker()
    await screen.findByText('Avatar')

    fetchMock
      .mockResolvedValueOnce(jsonResponse(204, undefined))
      .mockResolvedValueOnce(
        jsonResponse(200, meResponse({ avatar_kind: 'preset', avatar_value: 'executive-1' })),
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Executive' })[0])

    await screen.findByRole('button', { name: 'Remove' })

    const [url, options] = fetchMock.mock.calls[3]
    expect(url).toBe('/api/v1/auth/avatar/preset')
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body as string)).toEqual({ preset_key: 'executive-1' })
  })

  it('rejects an oversized file client-side without calling the backend', async () => {
    const fetchMock = renderPicker()
    await screen.findByText('Avatar')

    const oversized = new File([new Uint8Array(3 * 1024 * 1024)], 'photo.png', {
      type: 'image/png',
    })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [oversized] } })

    expect(await screen.findByText(/maximum allowed size/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('rejects an unsupported file type client-side without calling the backend', async () => {
    const fetchMock = renderPicker()
    await screen.findByText('Avatar')

    const badFile = new File(['not-an-image'], 'doc.pdf', { type: 'application/pdf' })
    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files: [badFile] } })

    expect(await screen.findByText(/unsupported image type/i)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('removing the avatar calls DELETE and refreshes the session', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, meResponse({ avatar_kind: 'preset', avatar_value: 'executive-1' })),
      )
      .mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <AuthProvider>
        <AvatarPicker />
      </AuthProvider>,
    )
    const removeButton = await screen.findByRole('button', { name: 'Remove' })

    fetchMock
      .mockResolvedValueOnce(jsonResponse(204, undefined))
      .mockResolvedValueOnce(jsonResponse(200, meResponse()))
      .mockResolvedValueOnce(jsonResponse(200, { items: [], total: 0, limit: 50, offset: 0 }))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }))

    fireEvent.click(removeButton)

    const [url, options] = await vi.waitFor(() => {
      const call = fetchMock.mock.calls[3]
      if (!call) throw new Error('not called yet')
      return call
    })
    expect(url).toBe('/api/v1/auth/avatar')
    expect(options.method).toBe('DELETE')
  })
})
