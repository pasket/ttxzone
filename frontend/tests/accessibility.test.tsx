import { screen } from '@testing-library/react'
import axe from 'axe-core'
import { describe, expect, it } from 'vitest'

import { Modal } from '../src/components/common/Modal'
import { Panel } from '../src/components/common/Panel'
import { PollCard } from '../src/components/playground/PollCard'
import { RoomBar } from '../src/components/playground/RoomStage'
import type { RunPoll, RunRead } from '../src/lib/types'
import { render } from './testUtils'

/** What jsdom can judge: names, roles, labels, structure. Colours need a real
 * browser (`e2e/a11y.e2e.ts`); `region` is about a whole page, not a piece. */
async function violations(root: Element) {
  const { violations: found } = await axe.run(root, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  })
  return found.map((violation) => `${violation.id}: ${violation.nodes[0].html}`)
}

const poll = {
  id: 'p-1',
  question: 'Pay the ransom?',
  options: [
    { text: 'Pay', votes: 1, outcome: 'The data stays out.', impacts: [] },
    { text: 'Refuse', votes: 2, outcome: 'The data goes public.', impacts: [] },
  ],
  inject_code: 'INJ-02',
  room_code: null,
  open: true,
  voters: 3,
  my_vote: null,
  decision_id: null,
  planned: true,
  results_visible: false,
  outcome_option: null,
  outcome: null,
} as unknown as RunPoll

const run = (over: Partial<RunRead>) =>
  ({ state: 'live', injects: [], polls: [poll], rooms: null, ...over }) as unknown as RunRead

describe('accessibility', () => {
  it('a poll, for a Player and for a Controller', async () => {
    for (const role of ['player', 'controller'] as const) {
      const { container, unmount } = render(
        <PollCard
          ttxId="ttx-1"
          run={run({})}
          role={role}
          inPlayCode="INJ-02"
          presenting={false}
          showCodes={role !== 'player'}
          onChange={() => {}}
        />,
      )
      expect(await violations(container)).toEqual([])
      unmount()
    }
  })

  it('the room switcher of the team', async () => {
    const rooms = {
      rooms: [{ code: 'RM-01', name: 'Blue', players: 2, in_main: 0 }],
      in_main: 0,
      main_projected: null,
    }
    const { container } = render(<RoomBar run={run({ rooms } as unknown as Partial<RunRead>)} />)
    expect(await violations(container)).toEqual([])
  })

  it('a panel and a dialog', async () => {
    render(
      <Panel title="Session">
        <Modal titleId="dialog-title" onClose={() => {}}>
          <h2 id="dialog-title">Close the vote</h2>
          <button type="button">Confirm</button>
        </Modal>
      </Panel>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(await violations(document.body)).toEqual([])
  })
})
