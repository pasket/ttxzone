import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PresenceBar, PresenceColumn } from '../src/components/playground/PresenceBar'
import type { RunPresence } from '../src/lib/types'
import { render } from './testUtils'

const NAMED: RunPresence[] = [
  { role: 'controller', name: null },
  { role: 'player', name: 'Ana Ruiz' },
  { role: 'player', name: 'Bea Blue' },
]

describe('PresenceBar', () => {
  it('counts from the server and says how many more there are than names', () => {
    render(<PresenceBar presence={NAMED} counts={{ controller: 1, player: 250 }} />)

    expect(screen.getByText(/Player: 250/)).toBeInTheDocument()
    expect(screen.getByText(/Controller: 1/)).toBeInTheDocument()
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
    expect(screen.getByText('and 248 more')).toBeInTheDocument()
  })

  it('counts the list when the server sends no counts', () => {
    render(<PresenceBar presence={NAMED} />)

    expect(screen.getByText(/Player: 2/)).toBeInTheDocument()
    expect(screen.queryByText(/more$/)).not.toBeInTheDocument()
  })
})

describe('PresenceColumn', () => {
  it('shows the counts and the extra Players on a projector', () => {
    render(
      <PresenceColumn
        presence={NAMED}
        counts={{ controller: 1, player: 40 }}
        folded={false}
        toggle={null}
      />,
    )

    expect(screen.getByText(/Player: 40/)).toBeInTheDocument()
    expect(screen.getByText('and 38 more')).toBeInTheDocument()
  })
})
