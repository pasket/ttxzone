import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InjectPollFields } from '../src/components/creator/msel/InjectPollFields'
import { render } from './testUtils'

const METERS = [{ key: 'm1', name: 'Stress' }]

function fields(onChange = vi.fn(), outcomes = ['After pay', 'After refuse']) {
  render(
    <InjectPollFields
      id={(field) => field}
      question="Pay the ransom?"
      options={['Pay', 'Refuse', 'Wait']}
      outcomes={outcomes}
      impacts={[{ m1: 1 }, { m1: 3 }]}
      meters={METERS}
      onChange={onChange}
    />,
  )
  return onChange
}

describe('InjectPollFields', () => {
  it('moves each option with what follows it', () => {
    const onChange = fields()
    fireEvent.click(screen.getByRole('button', { name: 'Move option B down' }))
    expect(onChange).toHaveBeenCalledWith({
      poll_options: ['Pay', 'Wait', 'Refuse'],
      poll_outcomes: ['After pay', '', 'After refuse'],
      poll_impacts: [{ m1: 1 }, {}, { m1: 3 }],
    })
  })

  it('removes an option with what follows it', () => {
    const onChange = fields()
    fireEvent.click(screen.getByRole('button', { name: 'Remove option A' }))
    expect(onChange).toHaveBeenCalledWith({
      poll_options: ['Refuse', 'Wait'],
      poll_outcomes: ['After refuse', ''],
      poll_impacts: [{ m1: 3 }, {}],
    })
  })

  it('writes what follows an option by position', () => {
    const onChange = fields()
    fireEvent.change(screen.getByLabelText(/What follows C/), { target: { value: 'After wait' } })
    expect(onChange).toHaveBeenCalledWith({
      poll_options: ['Pay', 'Refuse', 'Wait'],
      poll_outcomes: ['After pay', 'After refuse', 'After wait'],
      poll_impacts: [{ m1: 1 }, { m1: 3 }, {}],
    })
  })

  it('sets what an option adds to a meter', () => {
    const onChange = fields()
    fireEvent.change(screen.getByLabelText('Stress, option C'), { target: { value: '2' } })
    expect(onChange).toHaveBeenCalledWith({
      poll_options: ['Pay', 'Refuse', 'Wait'],
      poll_outcomes: ['After pay', 'After refuse', ''],
      poll_impacts: [{ m1: 1 }, { m1: 3 }, { m1: 2 }],
    })
  })
})
