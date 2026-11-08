import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// jsdom doesn't lay pages out, so it has no scrollIntoView.
Element.prototype.scrollIntoView = vi.fn()

import App from '../src/App'
import { GlossaryPanel } from '../src/components/common/GlossaryPanel'

function renderPanel(pageText: string, highlight: 'EEG' | null = null) {
  const onClose = vi.fn()
  render(
    <>
      <main id="main-content">{pageText}</main>
      <GlossaryPanel id="glossary-panel" highlight={highlight} onClose={onClose} />
    </>,
  )
  return { onClose }
}

describe('GlossaryPanel', () => {
  it('lists the terms found on the page first, then every other term', async () => {
    renderPanel('Rate each objective with the EEG and the MSEL.')

    const onPage = await screen.findByRole('region', { name: 'On this page' })
    const terms = within(onPage)
      .getAllByRole('term')
      .map((node) => node.textContent)
    expect(terms).toEqual(['EEG', 'MSEL'])

    const all = screen.getByRole('region', { name: 'All terms' })
    expect(within(all).getByText('Traffic Light Protocol (FIRST)')).toBeInTheDocument()
    expect(within(all).queryByText('Exercise Evaluation Guide')).not.toBeInTheDocument()
  })

  it('searches by term, expansion or description', () => {
    renderPanel('')
    const search = screen.getByRole('searchbox', { name: 'Search terms' })
    expect(search).toHaveFocus()

    fireEvent.change(search, { target: { value: 'after-action' } })
    const results = screen.getByRole('region', { name: 'Results' })
    expect(
      within(results)
        .getAllByRole('term')
        .map((node) => node.textContent),
    ).toEqual(['AAR'])

    fireEvent.change(search, { target: { value: 'zzz' } })
    expect(screen.getByRole('status')).toHaveTextContent('No term matches “zzz”.')
  })

  it('closes on Escape', () => {
    const { onClose } = renderPanel('')
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Glossary' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })
})

describe('Header glossary button', () => {
  function stubSignedInFetch() {
    const meResponse = {
      id: 'u1',
      email: 'owner@acme.com',
      full_name: 'Owner',
      totp_enabled: true,
      legal_acceptance_pending: [],
      is_program_manager: true,
      is_planner: false,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (url.includes('/auth/me')) {
          return { ok: true, status: 200, json: async () => meResponse } as Response
        }
        if (url.includes('/ttx')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ items: [], total: 0, limit: 50, offset: 0 }),
          } as Response
        }
        // The Program Manager's organization -- without one, Admin isn't
        // visible and RequireModule sends /admin back home.
        if (url.includes('/organizations/mine')) {
          const acme = { id: 'org-1', name: 'Acme', is_program_manager: true, is_planner: false }
          return { ok: true, status: 200, json: async () => ({ items: [acme] }) } as Response
        }
        return { ok: true, status: 200, json: async () => ({ items: [] }) } as Response
      }),
    )
  }

  it('opens the panel beside the page and returns focus when closed', async () => {
    window.history.pushState({}, '', '/admin')
    stubSignedInFetch()
    render(<App />)

    const trigger = await screen.findByRole('button', { name: 'Glossary' })
    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const panel = screen.getByRole('dialog', { name: 'Glossary' })
    expect(panel).not.toHaveAttribute('aria-modal')

    fireEvent.click(within(panel).getByRole('button', { name: 'Close glossary' }))
    expect(screen.queryByRole('dialog', { name: 'Glossary' })).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('toggles with the ? key, but not while typing in a field', async () => {
    window.history.pushState({}, '', '/admin')
    stubSignedInFetch()
    render(<App />)
    await screen.findByRole('button', { name: 'Glossary' })
    // /admin lands on /admin/organization first: let that settle, or the
    // panel (the header's own state) may open before the landing re-renders.
    await waitFor(() => expect(window.location.pathname).toBe('/admin/organization'))

    fireEvent.keyDown(document.body, { key: '?' })
    const search = await screen.findByRole('searchbox', { name: 'Search terms' })
    fireEvent.keyDown(search, { key: '?' })
    expect(screen.getByRole('dialog', { name: 'Glossary' })).toBeInTheDocument()

    fireEvent.keyDown(document.body, { key: '?' })
    expect(screen.queryByRole('dialog', { name: 'Glossary' })).not.toBeInTheDocument()
  })

  it('deep-links a term with ?glossary=', async () => {
    window.history.pushState({}, '', '/admin?glossary=EEG')
    stubSignedInFetch()
    render(<App />)

    const panel = await screen.findByRole('dialog', { name: 'Glossary' })
    const eeg = within(panel).getByText('EEG').closest('[data-term]')
    expect(eeg).toHaveClass('border-accent')
  })
})
