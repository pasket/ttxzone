import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LeaveOrganization } from '../src/components/account/LeaveOrganization'
import { AuthProvider } from '../src/lib/AuthContext'
import type { OrganizationLeavePreview } from '../src/lib/types'
import { render } from './testUtils'

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const ME = {
  id: 'u1',
  email: 'lee@acme.com',
  full_name: 'Lee',
  totp_enabled: true,
  legal_acceptance_pending: [],
  is_program_manager: true,
  is_planner: true,
  is_instance_admin: false,
  is_last_instance_admin: false,
}

const ORG = {
  organization_id: 'org-1',
  organization_name: 'Acme Corp',
  domain: 'acme.com',
  alias: null,
  logo_url: null,
  is_program_manager: true,
  is_planner: true,
  is_observer: false,
  is_evaluator: false,
}

const PREVIEW: OrganizationLeavePreview = {
  organization_name: 'Acme Corp',
  is_program_manager: true,
  is_last_program_manager: true,
  program_manager_candidates: [{ user_id: 'kim', full_name: 'Kim Planner', email: 'kim@acme.com' }],
  exercises: [
    {
      ttx_id: 'ttx-1',
      ttx_code: 'TTX-2026-01',
      ttx_name: 'Ransomware drill',
      seats: ['planner', 'controller'],
      blocked: null,
      lead_candidates: [
        { user_id: 'kim', full_name: 'Kim Planner', email: 'kim@acme.com' },
        { user_id: 'sam', full_name: 'Sam Planner', email: 'sam@acme.com' },
      ],
    },
  ],
}

function stubApi(preview: OrganizationLeavePreview = PREVIEW) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url)
    if (init?.method === 'POST') return json(204, undefined)
    if (path.endsWith('/auth/me')) return json(200, ME)
    if (path.endsWith('/organizations/mine')) return json(200, { items: [ORG] })
    if (path.endsWith('/leave-preview')) return json(200, preview)
    return json(200, { items: [], total: 0 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('LeaveOrganization', () => {
  it('hands over the Program Manager role and the lead, then leaves', async () => {
    const fetchMock = stubApi()
    const onLeft = vi.fn()
    render(
      <AuthProvider>
        <LeaveOrganization onLeft={onLeft} />
      </AuthProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Leave the organization…' }))
    const manager = await screen.findByLabelText('Who becomes Exercise Program Manager')
    expect(manager).toHaveValue('kim')
    fireEvent.change(screen.getByLabelText('New Lead Planner'), { target: { value: 'sam' } })

    const submit = screen.getByRole('button', { name: 'Leave the organization' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByPlaceholderText('Acme Corp'), { target: { value: 'Acme Corp' } })
    fireEvent.click(submit)

    expect(await screen.findByText('You left Acme Corp')).toBeInTheDocument()
    await waitFor(() => expect(onLeft).toHaveBeenCalled())
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(call?.[0]).toMatch(/\/organizations\/org-1\/leave$/)
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      confirmation: 'Acme Corp',
      program_manager_successor_id: 'kim',
      lead_successors: { 'ttx-1': 'sam' },
    })
  })

  it('stays blocked where the person is the only Controller', async () => {
    const exercise = {
      ...PREVIEW.exercises[0],
      blocked: 'controller' as const,
      lead_candidates: [],
    }
    stubApi({ ...PREVIEW, exercises: [exercise] })
    render(
      <AuthProvider>
        <LeaveOrganization />
      </AuthProvider>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Leave the organization…' }))
    expect(await screen.findByText(/You're its only Controller/)).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Acme Corp'), { target: { value: 'Acme Corp' } })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Leave the organization' })).toBeDisabled(),
    )
  })
})
