import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AssistantRequestsPanel } from '../src/components/assistant/AssistantRequestsPanel'
import { render } from './testUtils'

function respond(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

const ROWS = [{ id: 'i1', code: 'INJ-01', title: 'EDR alert' }]
const WAITING = {
  id: 'r1',
  section: 'msel',
  row_id: 'i1',
  row_code: 'INJ-01',
  note: 'Make it read like a SOC alert.',
  status: 'open',
  created_at: '2026-11-27T10:00:00Z',
  answered_at: null,
}

function stub(routes: Record<string, () => Response>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).replace('/api/v1', '').split('?')[0]}`
    const route = routes[key]
    if (!route) throw new Error(`Unexpected request: ${key}`)
    return route()
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('AssistantRequestsPanel', () => {
  it('shows nothing where the assistant is off', async () => {
    const fetchMock = stub({
      'GET /ttx/t1/assistant/requests': () => respond({ items: [], enabled: false }),
    })

    render(<AssistantRequestsPanel ttxId="t1" section="msel" rows={ROWS} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(screen.queryByText('Ask the AI assistant')).not.toBeInTheDocument()
  })

  it('lists this page’s requests, leaves a new one about a row and withdraws one', async () => {
    let items = [WAITING, { ...WAITING, id: 'r2', section: 'needs', note: 'Elsewhere' }]
    const fetchMock = stub({
      'GET /ttx/t1/assistant/requests': () => respond({ items, enabled: true }),
      'POST /ttx/t1/assistant/requests': () => respond({ ...WAITING, id: 'r3' }, 201),
      'DELETE /ttx/t1/assistant/requests/r1': () => {
        items = []
        return respond(null, 204)
      },
    })

    render(<AssistantRequestsPanel ttxId="t1" section="msel" rows={ROWS} />)

    expect(await screen.findByText('Make it read like a SOC alert.')).toBeInTheDocument()
    expect(screen.getByText('INJ-01')).toBeInTheDocument()
    // Another page's request isn't this page's.
    expect(screen.queryByText('Elsewhere')).not.toBeInTheDocument()
    expect(screen.getByText('1 waiting')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '+ Ask the assistant' }))
    const dialog = await screen.findByRole('dialog', { name: 'Ask the AI assistant' })
    const submit = within(dialog).getByRole('button', { name: 'Leave request' })
    expect(submit).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('About'), { target: { value: 'i1' } })
    fireEvent.change(within(dialog).getByLabelText('What you need'), {
      target: { value: ' Add a second alert ' },
    })
    fireEvent.click(submit)

    expect(await screen.findByText('Request left for the assistant')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({
      section: 'msel',
      row_id: 'i1',
      note: 'Add a second alert',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(await screen.findByText('Nothing waiting for the assistant.')).toBeInTheDocument()
  })
})
