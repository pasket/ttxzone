import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { OrgProposalsPanel } from '../src/components/assistant/OrgProposalsPanel'
import { render } from './testUtils'

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const PROPOSAL = {
  id: 'p1',
  target: 'new_exercise',
  patch: { name: 'Ransomware in the plant', description: 'Tests escalation.' },
  summary: 'Retests two overdue actions.',
  status: 'pending',
  created_at: '2026-11-27T10:00:00Z',
  decided_at: null,
  decision_reason: null,
  decision_note: null,
}

describe('OrgProposalsPanel', () => {
  it('shows nothing with no proposal waiting', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)

    render(<OrgProposalsPanel organizationId="o1" target="new_exercise" onAccept={vi.fn()} />)

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0][0]).toMatch(
      /\/organizations\/o1\/assistant\/proposals\?target=new_exercise$/,
    )
    expect(screen.queryByText(/proposed exercises/)).not.toBeInTheDocument()
  })

  it('hands a proposal to the page and discards one with the reason', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(respond({ items: [PROPOSAL] }))
      .mockResolvedValueOnce(respond({ ...PROPOSAL, status: 'discarded' }))
      .mockResolvedValueOnce(respond({ items: [] }))
    vi.stubGlobal('fetch', fetchMock)
    const onAccept = vi.fn()

    render(<OrgProposalsPanel organizationId="o1" target="new_exercise" onAccept={onAccept} />)

    expect(await screen.findByText('Ransomware in the plant')).toBeInTheDocument()
    expect(screen.getByText('Retests two overdue actions.')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Review the proposal “Ransomware in the plant”' }),
    )
    expect(onAccept).toHaveBeenCalledWith(PROPOSAL)

    fireEvent.click(
      screen.getByRole('button', { name: 'Discard the proposal “Ransomware in the plant”' }),
    )
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'duplicate' } })
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    const [path, init] = fetchMock.mock.calls[1]
    expect(path).toMatch(/\/assistant\/proposals\/p1\/discard$/)
    expect(JSON.parse(init.body)).toEqual({ reason: 'duplicate', note: '' })
    await waitFor(() =>
      expect(screen.queryByText('Ransomware in the plant')).not.toBeInTheDocument(),
    )
  })
})
