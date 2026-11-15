import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import App from '../src/App'
import { FormattedText } from '../src/components/common/FormattedText'
import { AccountLegalPanel } from '../src/components/account/AccountLegalPanel'
import { RegisterCard } from '../src/components/auth/RegisterCard'
import { AuthProvider } from '../src/lib/AuthContext'
import { LegalPendingBanner } from '../src/components/common/LegalPendingBanner'
import { LEGAL_ACCEPTANCE_REQUIRED_EVENT, apiFetch } from '../src/lib/api'
import { render as renderWithToasts } from './testUtils'

function json(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

const PUBLISHED = {
  items: [
    { kind: 'terms', version: 3, published_at: '2026-10-20T10:00:00Z', languages: ['en', 'es'] },
    { kind: 'privacy', version: 1, published_at: '2026-10-01T10:00:00Z', languages: ['en'] },
  ],
}

const TERMS = {
  kind: 'terms',
  version: 3,
  published_at: '2026-10-20T10:00:00Z',
  language: 'en',
  requested_language_available: true,
  content: '# Terms of service\n\n## 1. Your account\n\nKeep it **safe**.',
}

describe('FormattedText headings', () => {
  it('renders "# " titles only when asked to', () => {
    const { rerender } = render(<FormattedText text={'# Title\n\nBody'} headings />)
    expect(screen.getByRole('heading', { name: 'Title' })).toBeInTheDocument()

    rerender(<FormattedText text={'# Title\n\nBody'} />)
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByText('# Title')).toBeInTheDocument()
  })
})

describe('Signup acceptance', () => {
  it('asks for the published documents and sends their versions', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/instance/policy')) {
        return json({ tenancy_mode: 'open', can_found_organization: true })
      }
      if (url.includes('/auth/me')) {
        return json(
          {
            error: { code: 'NOT_AUTHENTICATED', message: 'Authentication required.', ttx_id: null },
          },
          401,
        )
      }
      if (url.endsWith('/legal')) return json(PUBLISHED)
      if (url.includes('/legal/terms')) return json(TERMS)
      if (url.includes('/auth/register') && init?.method === 'POST') return json({}, 201)
      return json({ items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <MemoryRouter>
        <AuthProvider>
          <RegisterCard />
        </AuthProvider>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByText('Create my account'))
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Pat' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'pat@acme.com' } })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'Correcthorse123456!' },
    })
    fireEvent.change(screen.getByLabelText('Confirm password'), {
      target: { value: 'Correcthorse123456!' },
    })

    const consent = await screen.findByLabelText(
      'I accept the terms of service and the privacy policy.',
    )
    const submit = screen.getByRole('button', { name: 'Create account' })
    expect(submit).toBeDisabled()

    // Each document opens in a dialog to read it first.
    fireEvent.click(screen.getByRole('button', { name: 'Terms of service' }))
    const dialog = await screen.findByRole('dialog', { name: 'Terms of service' })
    expect(within(dialog).getByRole('heading', { name: '1. Your account' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    fireEvent.click(consent)
    expect(submit).toBeEnabled()
    fireEvent.click(submit)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/auth/register'),
        expect.objectContaining({ method: 'POST' }),
      ),
    )
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/register'))!
    expect(JSON.parse(String(call[1]!.body)).accepted_legal).toEqual([
      { kind: 'terms', version: 3 },
      { kind: 'privacy', version: 1 },
    ])
  })
})

describe('Acceptance after a substantial change', () => {
  it('holds the account on the acceptance screen until it accepts', async () => {
    let pending = [{ kind: 'terms', version: 3, updated: true }]
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/legal/accept')) {
        pending = []
        return { ok: true, status: 204, json: async () => undefined } as Response
      }
      if (url.includes('/auth/me')) {
        return json({
          id: 'u1',
          email: 'pat@acme.com',
          full_name: 'Pat',
          totp_enabled: false,
          legal_acceptance_pending: pending,
          is_program_manager: false,
          is_planner: false,
          is_instance_admin: false,
          can_found_organization: false,
        })
      }
      if (url.includes('/ttx') || url.includes('/organizations/mine')) {
        return json({ items: [], total: 0, limit: 50, offset: 0 })
      }
      void init
      return json({ items: [] })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/admin')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Updated terms' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/account/legal')
    // Nothing else is loaded while held there.
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/ttx'))).toBe(false)
    expect(screen.getByRole('link', { name: 'Delete my account' })).toHaveAttribute(
      'href',
      '/account/settings/privacy',
    )

    const accept = screen.getByRole('button', { name: 'Accept and continue' })
    expect(accept).toBeDisabled()
    fireEvent.click(screen.getByLabelText('I accept the terms of service.'))
    fireEvent.click(accept)

    await waitFor(() => expect(window.location.pathname).not.toBe('/account/legal'))
    const call = fetchMock.mock.calls.find(([url]) => String(url).includes('/auth/legal/accept'))!
    expect(JSON.parse(String(call[1]!.body))).toEqual({
      acceptances: [{ kind: 'terms', version: 3 }],
    })
  })
})

describe('Acceptance of a first publication', () => {
  it("doesn't call the terms updated", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/me')) {
          return json({
            id: 'u1',
            email: 'pat@acme.com',
            full_name: 'Pat',
            totp_enabled: false,
            legal_acceptance_pending: [
              { kind: 'terms', version: 1, updated: false },
              { kind: 'privacy', version: 1, updated: false },
            ],
            is_program_manager: false,
            is_planner: false,
            is_instance_admin: false,
            can_found_organization: false,
          })
        }
        return json({ items: [], total: 0, limit: 50, offset: 0 })
      }),
    )
    window.history.pushState({}, '', '/')
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Before you continue' })).toBeInTheDocument()
    expect(screen.getByText(/To use TTX-Zone, read and accept/)).toBeInTheDocument()
  })
})

describe('Platform -> Legal documents', () => {
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

  it('saves a draft and publishes its first version', async () => {
    let terms = {
      kind: 'terms',
      draft: { content: {}, updated_at: null },
      has_unpublished_changes: false,
      versions: [] as unknown[],
    }
    const privacy = {
      kind: 'privacy',
      draft: { content: {}, updated_at: null },
      has_unpublished_changes: false,
      versions: [],
    }
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/me')) return json(ME)
      if (url.includes('/instance/settings')) {
        return json({
          tenancy_mode: 'managed',
          max_organizations: 1,
          pinned_by_env: false,
          organization_count: 0,
        })
      }
      if (url.includes('/instance/legal/terms/draft')) {
        const content = JSON.parse(String(init!.body)).content
        terms = { ...terms, draft: { content, updated_at: '2026-10-25T10:00:00Z' } }
        terms.has_unpublished_changes = true
        return json(terms)
      }
      if (url.includes('/instance/legal/terms/publish')) {
        terms = {
          ...terms,
          has_unpublished_changes: false,
          versions: [
            {
              version: 1,
              published_at: '2026-10-25T10:00:00Z',
              published_by: 'Ops',
              requires_acceptance: true,
              languages: ['en'],
            },
          ],
        }
        return json(terms, 201)
      }
      if (url.includes('/instance/legal')) return json({ items: [terms, privacy] })
      return json({ items: [], total: 0, limit: 50, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/platform/legal')
    render(<App />)

    expect(await screen.findByText(/Nothing is published yet/)).toBeInTheDocument()
    const termsPanel = (await screen.findByRole('heading', { name: 'Terms of service' })).closest(
      'section',
    )!
    expect(within(termsPanel).getByText('Not published')).toBeInTheDocument()

    fireEvent.change(within(termsPanel).getByLabelText('Terms of service in English'), {
      target: { value: '# Terms\n\nBe nice.' },
    })
    expect(within(termsPanel).getByRole('button', { name: 'Publish…' })).toBeDisabled()
    fireEvent.click(within(termsPanel).getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(within(termsPanel).getByRole('button', { name: 'Publish…' })).toBeEnabled(),
    )

    fireEvent.click(within(termsPanel).getByRole('button', { name: 'Publish…' }))
    const dialog = await screen.findByRole('dialog', {
      name: 'Publish the Terms of service (version 1)',
    })
    expect(within(dialog).getByText(/This is the first version/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Publish' }))

    expect(await within(termsPanel).findByText(/Version 1 ·/)).toBeInTheDocument()
    const publish = fetchMock.mock.calls.find(([url]) =>
      String(url).includes('/instance/legal/terms/publish'),
    )!
    expect(JSON.parse(String(publish[1]!.body))).toEqual({ requires_acceptance: true })
  })

  it('points a fresh instance to the templates, and stops once something is written', async () => {
    const drafts: Record<string, Record<string, string>> = { terms: {}, privacy: {} }
    const listItem = (kind: string) => ({
      kind,
      draft: { content: drafts[kind], updated_at: null },
      has_unpublished_changes: false,
      versions: [],
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/auth/me')) return json(ME)
      if (url.includes('/instance/settings')) {
        return json({
          tenancy_mode: 'managed',
          max_organizations: 1,
          pinned_by_env: false,
          organization_count: 0,
        })
      }
      if (url.includes('/instance/legal')) {
        return json({ items: [listItem('terms'), listItem('privacy')] })
      }
      return json({ items: [], total: 0, limit: 50, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/platform/legal')
    const { unmount } = render(<App />)

    expect(await screen.findByText(/Nothing written yet either/)).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Start from template' })
    expect(button.className).toContain('bg-cta')
    unmount()

    drafts.terms = { en: 'Our terms' }
    window.history.pushState({}, '', '/platform/legal')
    render(<App />)
    expect(await screen.findByDisplayValue('Our terms')).toBeInTheDocument()
    expect(screen.queryByText(/Nothing written yet either/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start from template' }).className).not.toContain(
      'bg-cta',
    )
  })

  it('shows the templates in the editors once written into the drafts', async () => {
    const drafts: Record<string, Record<string, string>> = {
      terms: { en: 'Old terms' },
      privacy: { en: 'Old privacy' },
    }
    const listItem = (kind: string) => ({
      kind,
      draft: { content: drafts[kind], updated_at: '2026-10-25T10:00:00Z' },
      has_unpublished_changes: true,
      versions: [],
    })
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/me')) return json(ME)
      if (url.includes('/instance/settings')) {
        return json({
          tenancy_mode: 'managed',
          max_organizations: 1,
          pinned_by_env: false,
          organization_count: 0,
        })
      }
      if (url.includes('/instance/legal/templates')) {
        return json({
          items: [
            { kind: 'terms', content: { en: 'Terms by Acme' } },
            { kind: 'privacy', content: { en: 'Privacy by Acme' } },
          ],
        })
      }
      const draft = url.match(/\/instance\/legal\/(\w+)\/draft/)
      if (draft) {
        drafts[draft[1]] = JSON.parse(String(init!.body)).content
        return json(listItem(draft[1]))
      }
      if (url.includes('/instance/legal')) {
        return json({ items: [listItem('terms'), listItem('privacy')] })
      }
      return json({ items: [], total: 0, limit: 50, offset: 0 })
    })
    vi.stubGlobal('fetch', fetchMock)
    window.history.pushState({}, '', '/platform/legal')
    render(<App />)

    expect(await screen.findByDisplayValue('Old terms')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Start from template' }))
    const dialog = await screen.findByRole('dialog', { name: 'Start from template' })
    fireEvent.change(within(dialog).getByLabelText('Operator (person or company name)'), {
      target: { value: 'Acme' },
    })
    fireEvent.change(within(dialog).getByLabelText('Contact email'), {
      target: { value: 'privacy@acme.com' },
    })
    fireEvent.change(within(dialog).getByLabelText('Applicable law and courts'), {
      target: { value: 'Spain' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Write into the drafts' }))

    expect(await screen.findByDisplayValue('Terms by Acme')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Privacy by Acme')).toBeInTheDocument()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()
  })
})

const ME = {
  id: 'u1',
  email: 'pat@acme.com',
  full_name: 'Pat',
  totp_enabled: true,
  legal_acceptance_pending: [],
  is_program_manager: false,
  is_planner: false,
  is_instance_admin: false,
  is_last_instance_admin: false,
}

function renderPanel() {
  return renderWithToasts(
    <MemoryRouter>
      <AuthProvider>
        <AccountLegalPanel />
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('Preferences -> Privacy', () => {
  it('lists the versions the account accepted, and when', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/auth/me')) return json(ME)
        if (url.endsWith('/legal')) return json(PUBLISHED)
        if (url.includes('/auth/legal/acceptances')) {
          return json({
            items: [
              { kind: 'terms', version: 3, accepted_at: '2026-10-21T08:00:00Z' },
              { kind: 'terms', version: 2, accepted_at: '2026-09-01T08:00:00Z' },
            ],
          })
        }
        return json({ items: [] })
      }),
    )
    renderPanel()

    const table = await screen.findByRole('table', { name: 'Versions you accepted' })
    const rows = within(table).getAllByRole('row')
    expect(rows).toHaveLength(3)
    expect(within(rows[1]).getByText('Terms of service')).toBeInTheDocument()
    expect(within(rows[1]).getByText('3')).toBeInTheDocument()
    // The current version of each published document, to read.
    expect(screen.getByRole('button', { name: 'Privacy policy' })).toBeInTheDocument()
    expect(screen.getByText('Current version: 1')).toBeInTheDocument()
    // Nothing pending: nothing to accept.
    expect(screen.queryByRole('button', { name: /^Accept version/ })).not.toBeInTheDocument()
  })

  it('accepts each pending document on its own', async () => {
    let pending = [
      { kind: 'terms', version: 3, updated: true },
      { kind: 'privacy', version: 1, updated: false },
    ]
    const accepted: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        if (url.endsWith('/auth/legal/accept')) {
          const body = JSON.parse(String(init?.body))
          accepted.push(body)
          pending = pending.filter((document) => document.kind !== body.acceptances[0].kind)
          return { ok: true, status: 204, json: async () => undefined } as Response
        }
        if (url.endsWith('/auth/me')) return json({ ...ME, legal_acceptance_pending: pending })
        if (url.endsWith('/legal')) return json(PUBLISHED)
        return json({ items: [] })
      }),
    )
    renderPanel()

    expect(await screen.findAllByText('Pending acceptance')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Accept version 3' }))
    await waitFor(() => expect(screen.getAllByText('Pending acceptance')).toHaveLength(1))
    expect(accepted).toEqual([{ acceptances: [{ kind: 'terms', version: 3 }] }])
    expect(screen.queryByRole('button', { name: 'Accept version 3' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Accept version 1' })).toBeInTheDocument()
  })

  it('shows nothing while nothing is published or accepted', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) =>
      String(input).endsWith('/auth/me') ? json(ME) : json({ items: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)
    renderPanel()
    await waitFor(() => {
      const urls = fetchMock.mock.calls.map(([input]) => String(input))
      expect(urls.some((url) => url.endsWith('/legal'))).toBe(true)
      expect(urls.some((url) => url.includes('/auth/legal/acceptances'))).toBe(true)
    })
    expect(screen.queryByText('Legal documents')).not.toBeInTheDocument()
  })
})

describe('LegalPendingBanner', () => {
  function stubMe(pending: unknown[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.endsWith('/auth/me')) return json({ ...ME, legal_acceptance_pending: pending })
        return json({ items: [] })
      }),
    )
  }

  function renderBanner(path = '/admin') {
    return renderWithToasts(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <LegalPendingBanner />
        </AuthProvider>
      </MemoryRouter>,
    )
  }

  it('says what to accept and links to where it is accepted', async () => {
    stubMe([{ kind: 'privacy', version: 1, updated: false }])
    renderBanner()
    expect(await screen.findByText(/Accept the privacy policy to continue\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Review and accept' })).toHaveAttribute(
      'href',
      '/account/settings/privacy',
    )
  })

  it('names both documents when both are pending, and hides on Privacy itself', async () => {
    const both = [
      { kind: 'terms', version: 1, updated: false },
      { kind: 'privacy', version: 1, updated: false },
    ]
    stubMe(both)
    const { unmount } = renderBanner()
    expect(
      await screen.findByText(/Accept the terms of service and the privacy policy to continue\./),
    ).toBeInTheDocument()
    unmount()

    stubMe(both)
    renderBanner('/account/settings/privacy')
    await waitFor(() => expect(fetch).toHaveBeenCalled())
    expect(screen.queryByRole('link', { name: 'Review and accept' })).not.toBeInTheDocument()
  })
})

describe('apiFetch', () => {
  it('tells the app when a request is refused for legal documents to accept', async () => {
    const heard = vi.fn()
    window.addEventListener(LEGAL_ACCEPTANCE_REQUIRED_EVENT, heard)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json(
          {
            success: false,
            error: {
              code: 'LEGAL_ACCEPTANCE_REQUIRED',
              message: 'Accept the terms of service and the privacy policy to continue.',
              ttx_id: null,
            },
          },
          403,
        ),
      ),
    )
    await expect(apiFetch('/organizations/mine')).rejects.toThrow()
    expect(heard).toHaveBeenCalledTimes(1)
    window.removeEventListener(LEGAL_ACCEPTANCE_REQUIRED_EVENT, heard)
  })
})
