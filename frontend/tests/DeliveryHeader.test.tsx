import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DeliveryHeader } from '../src/components/playground/DeliveryHeader'
import type { RunInject } from '../src/lib/types'
import { render } from './testUtils'

const inject = (changes: Partial<RunInject> = {}): RunInject => ({
  code: 'INJ-01',
  title: 'Findings',
  content: 'Body.',
  phase_code: 'PH-01',
  delivery_method: 'email',
  sender: { name: 'CrowdStrike IR', type: 'supplier', channel: 'email' },
  recipients: ['Legal', 'Group IT'],
  attachment_notes: [],
  images: [],
  scenario_minute: 0,
  released_at: '2026-11-10T08:40:00Z',
  questions: [],
  ...changes,
})

describe('DeliveryHeader', () => {
  it('labels the source, channel and audience', () => {
    render(<DeliveryHeader inject={inject()} />)
    expect(screen.getByText('Source')).toBeInTheDocument()
    expect(screen.getByText('CrowdStrike IR')).toBeInTheDocument()
    expect(screen.getByText('Supplier')).toBeInTheDocument()
    expect(screen.getByText('Channel')).toBeInTheDocument()
    expect(screen.getByText('Email')).toBeInTheDocument()
    expect(screen.getByText('Audience')).toBeInTheDocument()
    const audience = screen.getByRole('list')
    expect(
      within(audience)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Legal', 'Group IT'])
  })

  it('leaves out the source without a sender and the audience without recipients', () => {
    render(<DeliveryHeader inject={inject({ sender: null, recipients: [] })} />)
    expect(screen.queryByText('Source')).not.toBeInTheDocument()
    expect(screen.queryByText('Audience')).not.toBeInTheDocument()
    expect(screen.getByText('Channel')).toBeInTheDocument()
  })
})
