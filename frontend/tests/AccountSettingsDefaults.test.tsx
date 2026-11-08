import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AccountSettingsDefaults } from '../src/components/account/AccountSettingsDefaults'
import { render } from './testUtils'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

function renderRouted() {
  render(
    <MemoryRouter initialEntries={['/account/settings/defaults']}>
      <Routes>
        <Route path="/account/settings/defaults" element={<AccountSettingsDefaults />} />
        <Route path="/account/settings/general" element={<p>General page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

const mockRefresh = vi.fn(async () => {})
let mockAuth: Record<string, unknown> = {}
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => mockAuth }))

const abc = {
  organization_id: 'abc',
  organization_name: 'Abc',
  is_program_manager: true,
  is_planner: true,
}
const globex = {
  organization_id: 'globex',
  organization_name: 'Globex',
  is_program_manager: true,
  is_planner: false,
}
function ttx(id: string, name: string, organization_id: string, role: string) {
  const plans = role === 'planner'
  return {
    id,
    name,
    organization_id,
    role,
    plans,
    controls: plans,
    facilitates: false,
    description: null,
    created_by_id: 'u',
    created_at: '',
  }
}
const allTtxList = [
  ttx('drill', 'Ransomware drill', 'abc', 'planner'),
  ttx('phish', 'Phishing', 'abc', 'player'),
]

function user(defaults: Record<string, unknown> = {}) {
  return {
    id: 'u',
    email: 'sam@globex.com',
    default_organization_id: null,
    default_role: null,
    default_ttx_id: null,
    ...defaults,
  }
}

function preview() {
  return screen.getByText("You'll start in").nextElementSibling?.textContent
}

describe('AccountSettingsDefaults', () => {
  beforeEach(() => {
    mockRefresh.mockClear()
    mockAuth = { user: user(), organizations: [globex, abc], allTtxList, refresh: mockRefresh }
  })

  it('starts on the first available combination, with concrete values', () => {
    render(<AccountSettingsDefaults />)

    expect(screen.getByLabelText('Organization')).toHaveValue('globex')
    // Globex has a single role and it needs no exercise: nothing to pick.
    expect(screen.getByLabelText('Role')).toHaveValue('program_manager')
    expect(screen.getByLabelText('Role')).toBeDisabled()
    expect(screen.getByLabelText('Exercise')).toBeDisabled()
    expect(screen.getByText('Not needed for Program Manager')).toBeInTheDocument()
    expect(screen.queryByText('First available')).not.toBeInTheDocument()
    expect(preview()).toBe('Globex / Program Manager')
  })

  it('reseeds role and exercise to the first available when the level above changes', () => {
    render(<AccountSettingsDefaults />)

    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'abc' } })
    const role = screen.getByLabelText('Role') as HTMLSelectElement
    expect(Array.from(role.options).map((o) => o.text)).toEqual([
      'Program Manager',
      'Planner',
      'Controller',
      'Player',
    ])
    expect(role).toHaveValue('program_manager')
    expect(preview()).toBe('Abc / Program Manager')

    fireEvent.change(role, { target: { value: 'player' } })
    expect(screen.getByLabelText('Exercise')).toHaveValue('phish')
    expect(preview()).toBe('Abc / Player / Phishing')
  })

  it('saves the concrete combination shown', async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 204, json: async () => ({}) }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<AccountSettingsDefaults />)

    fireEvent.change(screen.getByLabelText('Organization'), { target: { value: 'abc' } })
    fireEvent.change(screen.getByLabelText('Role'), { target: { value: 'planner' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save default' }))

    await waitFor(() => expect(mockRefresh).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/v1/auth/default-context')
    expect(init.method).toBe('PUT')
    expect(JSON.parse(init.body as string)).toEqual({
      organization_id: 'abc',
      role: 'planner',
      ttx_id: 'drill',
    })
  })

  it('shows the fallback for a saved default that is no longer available', () => {
    mockAuth = {
      ...mockAuth,
      user: user({
        default_organization_id: 'abc',
        default_role: 'player',
        default_ttx_id: 'gone',
      }),
    }

    render(<AccountSettingsDefaults />)

    expect(screen.getByLabelText('Organization')).toHaveValue('abc')
    expect(screen.getByLabelText('Role')).toHaveValue('player')
    expect(screen.getByLabelText('Exercise')).toHaveValue('phish')
    expect(preview()).toBe('Abc / Player / Phishing')
  })

  it('redirects to General when there is nothing to choose', () => {
    mockAuth = {
      status: 'ready',
      user: user(),
      organizations: [{ ...globex, is_planner: false }],
      allTtxList: [],
      refresh: mockRefresh,
    }

    renderRouted()

    expect(screen.getByText('General page')).toBeInTheDocument()
  })

  it('does not redirect while auth is still loading', () => {
    mockAuth = {
      status: 'loading',
      user: null,
      organizations: [],
      allTtxList: [],
      refresh: mockRefresh,
    }

    renderRouted()

    expect(screen.queryByText('General page')).not.toBeInTheDocument()
  })
})
