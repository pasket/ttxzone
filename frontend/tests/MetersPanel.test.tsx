import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { MetersPanel } from '../src/components/playground/MetersPanel'
import type { RunRead } from '../src/lib/types'
import { render } from './testUtils'

const group = {
  room_code: null,
  decisions: 2,
  meters: [{ key: 'm1', name: 'Stress', total: 4, most: 6 }],
}
const run = (patch: Partial<RunRead>) => ({ meters: [group], ...patch }) as RunRead

describe('MetersPanel', () => {
  it('stays away while there is nothing to add up', () => {
    render(
      <MetersPanel ttxId="t" run={run({ meters: [] })} role="controller" onChange={() => {}} />,
    )
    expect(screen.queryByText('Impact meters')).toBeNull()
  })

  it('shows each meter out of the most it could reach', () => {
    render(<MetersPanel ttxId="t" run={run({})} role="player" onChange={() => {}} />)
    expect(screen.getByText('Stress')).toBeInTheDocument()
    expect(screen.getByText('4 of 6')).toBeInTheDocument()
    expect(screen.getByText('2 decisions')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('lets the Controller show the summary to the Players', async () => {
    const onChange = vi.fn()
    const fetchMock = vi.fn(async () => Response.json(run({ meters_shown: true })))
    vi.stubGlobal('fetch', fetchMock)
    render(<MetersPanel ttxId="t" run={run({})} role="controller" onChange={onChange} />)
    expect(screen.getByText('Only the team sees this.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show the summary to the Players' }))
    await waitFor(() => expect(onChange).toHaveBeenCalled())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/t/run/meters',
      expect.objectContaining({ body: JSON.stringify({ shown: true }) }),
    )
  })
})
