import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'

const ME = {
  id: 'u1',
  email: 'ops@acme.com',
  full_name: 'Ops',
  totp_enabled: true,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
  is_instance_admin: true,
  is_last_instance_admin: true,
  can_found_organization: false,
}

const ACME = {
  id: 'org-1',
  name: 'Acme',
  domain: 'acme.com',
  program_manager_count: 1,
  created_at: '2026-10-01T10:00:00Z',
}

function account(id: string, email: string, extra: Record<string, unknown> = {}) {
  return {
    user_id: id,
    email,
    full_name: email.split('@')[0],
    created_at: '2026-10-01T10:00:00Z',
    last_login_at: null,
    is_instance_admin: false,
    suspended_at: null,
    organizations: [],
    ...extra,
  }
}

function accountDetail(id: string) {
  const base = ACCOUNTS.find((a) => a.user_id === id)!
  return {
    ...base,
    totp_enabled: true,
    backup_codes_remaining: 8,
    password_change_required: false,
    active_sessions: 1,
    exercises:
      id === 'u2'
        ? [
            {
              id: 'ttx-1',
              code: 'EX-01',
              name: 'Ransomware',
              organization_id: 'org-1',
              organization_name: 'Acme',
              roles: ['planner', 'controller'],
              lead_evaluator: false,
              lead_planner: true,
            },
          ]
        : [],
    dependencies:
      id === 'u2'
        ? [
            { category: 'exercises', count: 1 },
            { category: 'organizations', count: 2 },
          ]
        : [],
    is_self: id === 'u1',
  }
}

const ACCOUNTS = [
  account('u1', 'ops@acme.com', { is_instance_admin: true }),
  account('u2', 'ciso@acme.com', {
    organizations: [
      {
        id: 'org-1',
        name: 'Acme',
        roles: ['program_manager', 'planner'],
        disabled: false,
        sole_program_manager: true,
      },
    ],
  }),
  account('u3', 'gone@acme.com', { suspended_at: '2026-10-20T10:00:00Z' }),
]

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function admin(id: string, email: string, extra: Record<string, unknown> = {}) {
  return {
    user_id: id,
    email,
    full_name: email.split('@')[0],
    last_login_at: null,
    suspended_at: null,
    ...extra,
  }
}

const AUDIT = [
  {
    id: 'e2',
    created_at: '2026-10-26T10:00:00Z',
    action: 'tenancy.update',
    actor_user_id: 'u1',
    actor_label: 'ops@acme.com',
    target_kind: 'instance',
    target_id: null,
    target_label: null,
    details: {
      before: { mode: 'managed', max_organizations: 1 },
      after: { mode: 'managed', max_organizations: 5 },
    },
  },
  {
    id: 'e1',
    created_at: '2026-10-25T10:00:00Z',
    action: 'instance_admin.grant',
    actor_user_id: null,
    actor_label: 'console',
    target_kind: 'account',
    target_id: 'u1',
    target_label: 'ops@acme.com',
    details: null,
  },
  {
    id: 'e0',
    created_at: '2026-10-24T10:00:00Z',
    action: 'auth.login_failed',
    actor_user_id: null,
    actor_label: 'nobody@acme.com',
    target_kind: 'account',
    target_id: null,
    target_label: 'nobody@acme.com',
    details: { reason: 'unknown_account' },
  },
  {
    id: 'e-1',
    created_at: '2026-10-23T10:00:00Z',
    action: 'auth.login',
    actor_user_id: 'u1',
    actor_label: 'ops@acme.com',
    target_kind: 'account',
    target_id: 'u1',
    target_label: 'ops@acme.com',
    details: { method: 'totp' },
  },
  {
    id: 'e-0',
    created_at: '2026-10-23T09:00:00Z',
    action: 'assistant.proposal_accepted',
    actor_user_id: 'u1',
    actor_label: 'ops@acme.com',
    target_kind: 'exercise',
    target_id: 't1',
    target_label: 'TTX-0003 · Ransomware',
    details: { target: 'inject', operation: 'update', row: 'INJ-27', proposal_id: 'p1' },
  },
]

const NO_WEBHOOK = {
  configured: false,
  url: null,
  enabled: false,
  secret: null,
  has_authorization: false,
  pending: 0,
  last_success_at: null,
  last_failure_at: null,
  last_status: null,
  last_error: null,
  allow_http: false,
}

const WEBHOOK = {
  ...NO_WEBHOOK,
  configured: true,
  url: 'https://siem.acme.com/hook',
  enabled: true,
  secret: 'a-shared-secret-of-enough-length',
}

/** The instance administrator's Platform; `max` is the deployment's cap. */
function stubPlatform(
  max: number | null,
  {
    admins = [admin('u1', 'ops@acme.com')],
    webGrants = true,
    webhook = NO_WEBHOOK,
  }: { admins?: unknown[]; webGrants?: boolean; webhook?: unknown } = {},
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/auth/me')) return json(ME)
    if (url.includes('/instance/admins')) {
      return json(
        { items: admins, web_grants_enabled: webGrants },
        init?.method === 'POST' ? 201 : 200,
      )
    }
    if (url.includes('/instance/audit/webhook/test')) {
      return json({ ok: false, status: 503, error: 'HTTP 503' })
    }
    if (url.includes('/instance/audit/webhook')) {
      if (init?.method === 'PUT') {
        const body = JSON.parse(String(init.body))
        return json({ ...NO_WEBHOOK, ...WEBHOOK, url: body.url, enabled: body.enabled })
      }
      return json(webhook)
    }
    if (url.endsWith('/instance/audit/retention')) {
      return json({ days: 90, log_file_max_mb: 10, log_file_backups: 5 })
    }
    if (url.includes('/instance/audit')) {
      return json({ items: AUDIT, total: AUDIT.length, limit: 50, offset: 0 })
    }
    if (url.endsWith('/instance/settings')) {
      return json({
        tenancy_mode: 'managed',
        max_organizations: max,
        pinned_by_env: false,
        organization_count: 1,
      })
    }
    if (url.endsWith('/instance/organizations/org-1') && init?.method === 'DELETE') {
      return json(undefined, 204)
    }
    if (url.includes('/instance/organizations?')) {
      return json({ items: [ACME], total: 1, limit: 20, offset: 0 })
    }
    if (url.endsWith('/instance/accounts') && init?.method === 'POST') {
      return json({ user_id: 'u2', temporary_password: 'New#4hT8pQs2LmZx' }, 201)
    }
    if (url.endsWith('/instance/accounts/bulk')) {
      const body = JSON.parse(String(init!.body))
      return json({
        done: body.user_ids.length - 1,
        skipped: 1,
        results: body.user_ids.map((id: string, i: number) => ({
          user_id: id,
          email: ACCOUNTS.find((a) => a.user_id === id)?.email ?? null,
          code: i === 0 ? 'LAST_INSTANCE_ADMIN' : null,
          message: i === 0 ? 'last' : null,
        })),
      })
    }
    const one = url.match(/\/instance\/accounts\/(u\d)(\/[\w-]+)?$/)
    if (one && !one[2] && (!init?.method || init.method === 'GET')) {
      return json(accountDetail(one[1]))
    }
    if (one && !one[2] && init?.method === 'PATCH') {
      return json({ ...accountDetail(one[1]), ...JSON.parse(String(init.body)) })
    }
    if (one && !one[2] && init?.method === 'DELETE') return json(undefined, 204)
    if (one?.[2] === '/reset-password') return json({ temporary_password: 'Tmp#2kQ9xYzA7mWp' })
    if (url.includes('/instance/accounts/') && init?.method === 'POST') {
      return json(ACCOUNTS[0])
    }
    if (url.includes('/instance/accounts')) {
      return json({ items: ACCOUNTS, total: ACCOUNTS.length, limit: 20, offset: 0 })
    }
    if (url.includes('/ttx')) return json({ items: [], total: 0, limit: 50, offset: 0 })
    return json({ items: [] })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Platform', () => {
  it('disables Create organization once the deployment is full', async () => {
    window.history.pushState({}, '', '/platform/organizations')
    stubPlatform(1)
    render(<App />)

    expect(
      await screen.findByText(/reached its maximum number of organizations/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create organization' })).toBeDisabled()
  })

  it('allows it while there is room', async () => {
    window.history.pushState({}, '', '/platform/organizations')
    stubPlatform(5)
    render(<App />)

    expect(await screen.findByRole('button', { name: 'Create organization' })).toBeEnabled()
  })

  it('deletes an organization only once its name is typed', async () => {
    window.history.pushState({}, '', '/platform/organizations')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete Acme' }))
    const dialog = screen.getByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Delete organization' })
    expect(submit).toBeDisabled()

    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Acme' } })
    fireEvent.click(submit)

    expect(await screen.findByText('Organization deleted')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/instance/organizations/org-1'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('lists accounts with one action, Manage, that opens the account', async () => {
    window.history.pushState({}, '', '/platform/accounts?status=suspended')
    stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Manage ciso' }))
    expect(screen.queryByRole('button', { name: 'Suspend ciso' })).not.toBeInTheDocument()

    expect(await screen.findByRole('heading', { level: 1, name: 'ciso' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/platform/accounts/u2')
    // Back to the list keeps its filters.
    const main = within(document.getElementById('main-content')!)
    expect(main.getByRole('link', { name: 'Accounts' })).toHaveAttribute(
      'href',
      '/platform/accounts?status=suspended',
    )
  })

  it('sums up where the account works and what keeps it', async () => {
    window.history.pushState({}, '', '/platform/accounts/u2')
    stubPlatform(5)
    render(<App />)

    const work = (await screen.findByRole('heading', { name: 'Where they work' })).closest(
      'section',
    )!
    expect(within(work).getByText('1 organization · 1 exercise')).toBeInTheDocument()
    expect(within(work).getByText('Ransomware')).toBeInTheDocument()
    expect(within(work).getByText('Planner · Controller')).toBeInTheDocument()
    expect(within(work).getByText('Lead Planner')).toBeInTheDocument()
    const remove = screen.getByRole('heading', { name: 'Delete for good' }).closest('section')!
    expect(within(remove).getByText('2 organization roles')).toBeInTheDocument()
    expect(within(remove).queryByRole('button', { name: 'Delete account' })).toBeNull()
  })

  it('corrects the name and email', async () => {
    window.history.pushState({}, '', '/platform/accounts/u2')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Carla' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Account details saved')).toBeInTheDocument()
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === 'PATCH')!
    expect(JSON.parse(String(patch[1]!.body))).toEqual({
      full_name: 'Carla',
      email: 'ciso@acme.com',
    })
  })

  it('resets the password and shows the temporary one once', async () => {
    window.history.pushState({}, '', '/platform/accounts/u2')
    stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reset password' }))
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Reset password' }),
    )

    expect(await screen.findByText('Tmp#2kQ9xYzA7mWp')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(screen.queryByText('Tmp#2kQ9xYzA7mWp')).not.toBeInTheDocument()
  })

  it('suspends an account once its email is typed, naming organizations left without a Program Manager', async () => {
    window.history.pushState({}, '', '/platform/accounts/u2')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Suspend account' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText(/left without an active Exercise Program Manager/)).toBeInTheDocument()
    expect(dialog.getByText('Acme')).toBeInTheDocument()
    const submit = dialog.getByRole('button', { name: 'Suspend account' })
    expect(submit).toBeDisabled()

    fireEvent.change(dialog.getByLabelText('Type ciso@acme.com to confirm'), {
      target: { value: 'ciso@acme.com' },
    })
    fireEvent.click(submit)

    expect(await screen.findByText('ciso@acme.com suspended')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/instance/accounts/u2/suspend'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ confirmation: 'ciso@acme.com' }),
      }),
    )
  })

  it('reactivates a suspended account', async () => {
    window.history.pushState({}, '', '/platform/accounts/u3')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Reactivate' }))

    expect(await screen.findByText('gone@acme.com reactivated')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/instance/accounts/u3/reactivate'),
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('deletes an account that left no trace once its email is typed', async () => {
    window.history.pushState({}, '', '/platform/accounts/u3')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete account' }))
    const dialog = within(screen.getByRole('dialog'))
    const submit = dialog.getByRole('button', { name: 'Delete account' })
    expect(submit).toBeDisabled()
    fireEvent.change(dialog.getByLabelText('Type gone@acme.com to confirm'), {
      target: { value: 'gone@acme.com' },
    })
    fireEvent.click(submit)

    expect(await screen.findByText('gone@acme.com deleted')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/platform/accounts')
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/instance\/accounts\/u3$/),
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ confirmation: 'gone@acme.com' }),
      }),
    )
  })

  it('shows your own account without acting on it', async () => {
    window.history.pushState({}, '', '/platform/accounts/u1')
    stubPlatform(5)
    render(<App />)

    expect(await screen.findByText(/This is your account/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset password' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Delete account' })).toBeNull()
    expect(screen.queryByLabelText('Full name')).toBeNull()
  })

  it('opens on Organizations and lists its sections, with the instance as context', async () => {
    window.history.pushState({}, '', '/platform')
    stubPlatform(5)
    render(<App />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Organizations' }),
    ).toBeInTheDocument()
    expect(window.location.pathname).toBe('/platform/organizations')
    const menu = within(screen.getByRole('navigation', { name: 'Primary' }))
    expect(menu.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Tenancy rule',
      'Accounts',
      'Organizations',
      'Legal documents',
      'Email',
      'Sign-in security',
      'Single sign-on',
      'AI assistant',
      'Activity log',
    ])
    expect(menu.getByRole('link', { name: 'Organizations' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    const context = within(screen.getByRole('navigation', { name: 'Context' }))
    expect(context.getByText('Instance administrator')).toBeInTheDocument()
  })

  it('keeps the tenancy rule in its own section', async () => {
    window.history.pushState({}, '', '/platform/tenancy')
    stubPlatform(5)
    render(<App />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tenancy rule' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Create organization' })).not.toBeInTheDocument()
  })

  it('sends an account with no role anywhere to Platform, not the Waiting Room', async () => {
    // Not resuming a Platform page an earlier test left behind.
    sessionStorage.clear()
    window.history.pushState({}, '', '/')
    stubPlatform(5)
    render(<App />)

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Organizations' }),
    ).toBeInTheDocument()
  })

  it('leads back from the logo to the organization page left before Platform', async () => {
    sessionStorage.setItem(
      'ttx_last_workspace',
      JSON.stringify({ userId: 'u1', path: '/account/settings/general' }),
    )
    window.history.pushState({}, '', '/platform/accounts')
    stubPlatform(5)
    render(<App />)

    await screen.findByRole('heading', { level: 1, name: 'Accounts' })
    fireEvent.click(screen.getAllByRole('link', { name: /TTX-Zone/ })[0])
    expect(window.location.pathname).toBe('/account/settings/general')
  })

  it('never resumes a Platform page from the logo', async () => {
    sessionStorage.setItem(
      'ttx_last_workspace',
      JSON.stringify({ userId: 'u1', path: '/platform/accounts' }),
    )
    window.history.pushState({}, '', '/')
    stubPlatform(5)
    render(<App />)

    // No role anywhere: Platform's first section, not the remembered one.
    await screen.findByRole('heading', { level: 1, name: 'Organizations' })
    expect(window.location.pathname).toBe('/platform/organizations')
  })

  it('makes an account instance administrator once its email is typed', async () => {
    window.history.pushState({}, '', '/platform/accounts/u2')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Make instance administrator' }))
    const dialog = within(screen.getByRole('dialog'))
    // Who the person is, before confirming.
    expect(dialog.getByText('Acme')).toBeInTheDocument()
    const submit = dialog.getByRole('button', { name: 'Make instance administrator' })
    expect(submit).toBeDisabled()
    fireEvent.change(dialog.getByLabelText('Type ciso@acme.com to confirm'), {
      target: { value: 'ciso@acme.com' },
    })
    fireEvent.click(submit)

    expect(
      await screen.findByText('ciso@acme.com is now an instance administrator'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/instance/admins'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ user_id: 'u2', confirmation: 'ciso@acme.com' }),
      }),
    )
  })

  it('leaves the grant to the console when the deployment says so', async () => {
    window.history.pushState({}, '', '/platform/accounts/u2')
    stubPlatform(5, { webGrants: false })
    render(<App />)

    expect(await screen.findByText(/from the server's console only/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make instance administrator' })).toBeNull()
  })

  it('revokes an administrator from their account page', async () => {
    window.history.pushState({}, '', '/platform/accounts/u2')
    const fetchMock = stubPlatform(5, {
      admins: [admin('u1', 'ops@acme.com'), admin('u2', 'ciso@acme.com')],
    })
    const stubbed = fetchMock.getMockImplementation()!
    fetchMock.mockImplementation(async (input, init) => {
      const response = await stubbed(input, init)
      if (String(input).endsWith('/instance/accounts/u2') && (init?.method ?? 'GET') === 'GET') {
        return json({ ...accountDetail('u2'), is_instance_admin: true })
      }
      return response
    })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Type ciso@acme.com to confirm'), {
      target: { value: 'ciso@acme.com' },
    })
    fireEvent.click(dialog.getByRole('button', { name: 'Revoke' }))

    expect(
      await screen.findByText('ciso@acme.com is no longer an instance administrator'),
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/instance/admins/u2'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })

  it('lists administrators among the accounts', async () => {
    window.history.pushState({}, '', '/platform/accounts?admin=yes')
    stubPlatform(5)
    render(<App />)

    expect(await screen.findByRole('heading', { level: 1, name: 'Accounts' })).toBeInTheDocument()
    const menu = within(screen.getByRole('navigation', { name: 'Primary' }))
    expect(menu.queryByRole('link', { name: 'Administrators' })).toBeNull()
  })

  it('splits each account into organizations, roles, administrator and status', async () => {
    window.history.pushState({}, '', '/platform/accounts')
    stubPlatform(5)
    render(<App />)

    const table = await screen.findByRole('table')
    const headers = within(table)
      .getAllByRole('columnheader')
      .map((h) => h.textContent)
    expect(headers).toEqual(
      expect.arrayContaining(['Organizations', 'Roles', 'Instance admin', 'Status']),
    )
    const rows = within(table).getAllByRole('row')
    const ops = within(rows.find((r) => r.textContent?.includes('ops@acme.com'))!)
    expect(ops.getByRole('img', { name: 'Instance administrator' })).toBeInTheDocument()
    expect(ops.getByText('Active')).toBeInTheDocument()
    expect(ops.getByText('No organization')).toBeInTheDocument()
    const ciso = within(rows.find((r) => r.textContent?.includes('ciso@acme.com'))!)
    expect(ciso.getByText('Acme')).toBeInTheDocument()
    expect(ciso.getByText('Program Manager')).toBeInTheDocument()
    expect(ciso.getByText('Planner')).toBeInTheDocument()
    expect(ciso.queryByRole('img', { name: 'Instance administrator' })).toBeNull()
    const gone = within(rows.find((r) => r.textContent?.includes('gone@acme.com'))!)
    expect(gone.getByText('Suspended')).toBeInTheDocument()
  })

  it('creates an account and shows its temporary password once', async () => {
    window.history.pushState({}, '', '/platform/accounts')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Create account' }))
    const submit = screen.getByRole('button', { name: 'Create account' })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Robin Doe' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'Robin@Acme.com' } })
    fireEvent.click(submit)

    expect(await screen.findByText('New#4hT8pQs2LmZx')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/instance\/accounts$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ full_name: 'Robin Doe', email: 'Robin@Acme.com' }),
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open the account' }))
    expect(window.location.pathname).toBe('/platform/accounts/u2')
  })

  it('lists the activity log with its actions, the console and what changed', async () => {
    window.history.pushState({}, '', '/platform/activity')
    stubPlatform(5)
    render(<App />)

    expect(await screen.findByText('Managed (1) → Managed (5)')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(within(rows[1]).getByText('Changed the tenancy rule')).toBeInTheDocument()
    expect(within(rows[2]).getByText('Made instance administrator')).toBeInTheDocument()
    expect(screen.getByText("Server's console")).toBeInTheDocument()
    // Sign-ins too: a failed one names the email typed, never the console.
    expect(within(rows[3]).getByText('Failed sign-in')).toBeInTheDocument()
    expect(within(rows[3]).getAllByText('nobody@acme.com')).toHaveLength(2)
    expect(within(rows[3]).getByText('No such account')).toBeInTheDocument()
    expect(within(rows[4]).getByText('Signed in')).toBeInTheDocument()
    expect(within(rows[4]).getByText('With two-step authentication')).toBeInTheDocument()
    // An AI proposal decided: the row it changed, never what was proposed.
    expect(within(rows[5]).getByText('Accepted an AI assistant proposal')).toBeInTheDocument()
    expect(within(rows[5]).getByText('Change inject INJ-27')).toBeInTheDocument()
    const filter = screen.getByRole('combobox', { name: 'Action' })
    expect(within(filter).getByRole('group', { name: 'Sign-in and account' })).toBeInTheDocument()
  })

  it('shows the fixed retention period and the log files cap', async () => {
    window.history.pushState({}, '', '/platform/activity')
    stubPlatform(5)
    render(<App />)

    expect(await screen.findByText(/^90 days, then deleted/)).toBeInTheDocument()
    expect(
      screen.getByText(
        'Each file rotates at 10 MB and 5 older copies are kept; the oldest is deleted.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByLabelText('Days to keep')).not.toBeInTheDocument()
  })

  it('filters accounts by status and sorts them, the choice kept in the URL', async () => {
    window.history.pushState({}, '', '/platform/accounts?status=suspended&sort=last_login')
    const fetchMock = stubPlatform(5)
    render(<App />)

    expect(await screen.findByRole('combobox', { name: 'Status' })).toHaveValue('suspended')
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(/\/instance\/accounts\?.*sort_by=last_login.*status=suspended/),
        expect.anything(),
      ),
    )
  })

  it('combines the organization, role and administrator filters, and clears them', async () => {
    window.history.pushState({}, '', '/platform/accounts')
    const fetchMock = stubPlatform(5)
    render(<App />)

    const organization = await screen.findByRole('combobox', { name: 'Organization' })
    await within(organization).findByRole('option', { name: 'Acme' })
    // One at a time, as a person picks them.
    fireEvent.change(organization, { target: { value: 'org-1' } })
    await waitFor(() => expect(window.location.search).toBe('?organization=org-1'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Role' }), {
      target: { value: 'planner' },
    })
    await waitFor(() => expect(window.location.search).toContain('role=planner'))
    fireEvent.change(screen.getByRole('combobox', { name: 'Instance admin' }), {
      target: { value: 'no' },
    })

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/instance\/accounts\?.*organization=org-1&role=planner&instance_admin=false/,
        ),
        expect.anything(),
      ),
    )
    expect(window.location.search).toBe('?organization=org-1&role=planner&admin=no')
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(window.location.search).toBe('')
  })

  it('searches organizations on the server', async () => {
    window.history.pushState({}, '', '/platform/organizations?q=acme')
    const fetchMock = stubPlatform(5)
    render(<App />)

    expect(await screen.findByText('Acme')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/instance\/organizations\?.*q=acme/),
      expect.anything(),
    )
  })

  it('downloads the log with the filters on screen', async () => {
    window.history.pushState({}, '', '/platform/activity?action=tenancy.update')
    stubPlatform(5)
    render(<App />)

    const jsonl = await screen.findByRole('link', { name: 'Download JSON Lines' })
    expect(jsonl.getAttribute('href')).toMatch(
      /\/instance\/audit\/export\?action=tenancy.update&format=jsonl$/,
    )
    expect(screen.getByRole('link', { name: 'Download CSV' }).getAttribute('href')).toMatch(
      /format=csv$/,
    )
  })

  it('sets up forwarding to a SIEM', async () => {
    window.history.pushState({}, '', '/platform/activity')
    const fetchMock = stubPlatform(5)
    render(<App />)

    fireEvent.change(await screen.findByLabelText('Collector URL'), {
      target: { value: 'https://siem.acme.com/hook' },
    })
    fireEvent.change(screen.getByLabelText(/Authorization header/), {
      target: { value: 'Splunk abc' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start forwarding' }))

    expect(await screen.findByText('Forwarding saved')).toBeInTheDocument()
    const put = fetchMock.mock.calls.find(
      ([url, init]) => String(url).includes('/instance/audit/webhook') && init?.method === 'PUT',
    )!
    expect(JSON.parse(String(put[1]!.body))).toEqual({
      url: 'https://siem.acme.com/hook',
      enabled: true,
      authorization: 'Splunk abc',
    })
  })

  it('reports how the collector answered a test entry', async () => {
    window.history.pushState({}, '', '/platform/activity')
    stubPlatform(5, { webhook: WEBHOOK })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Send a test entry' }))
    expect(await screen.findByText("The collector didn't accept it: HTTP 503")).toBeInTheDocument()
  })

  it('acts on several accounts at once, never on your own, and reports the ones skipped', async () => {
    window.history.pushState({}, '', '/platform/accounts')
    const fetchMock = stubPlatform(5)
    render(<App />)

    // Your own row has no checkbox; the header one takes the others.
    expect(await screen.findByRole('checkbox', { name: 'Select ciso' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Select ops' })).toBeNull()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select every account on this page' }))
    const bar = within(screen.getByRole('group', { name: 'Act on the selected accounts' }))
    expect(bar.getByText('2 selected')).toBeInTheDocument()

    fireEvent.click(bar.getByRole('button', { name: 'Suspend' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByText('ciso@acme.com')).toBeInTheDocument()
    expect(dialog.getByText('gone@acme.com')).toBeInTheDocument()
    const submit = dialog.getByRole('button', { name: 'Suspend' })
    expect(submit).toBeDisabled()
    fireEvent.change(dialog.getByLabelText('Type 2 to confirm'), { target: { value: '2' } })
    fireEvent.click(submit)

    expect(await dialog.findByText('1 account suspended')).toBeInTheDocument()
    expect(dialog.getByText('1 skipped:')).toBeInTheDocument()
    expect(dialog.getByText(/last instance administrator/)).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/accounts/bulk'))!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      action: 'suspend',
      user_ids: ['u2', 'u3'],
      confirmation: '2',
    })
    // Done: the selection is cleared.
    fireEvent.click(dialog.getByRole('button', { name: 'Done' }))
    expect(screen.queryByRole('group', { name: 'Act on the selected accounts' })).toBeNull()
  })
})
