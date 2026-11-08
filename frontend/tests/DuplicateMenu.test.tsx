import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DuplicateMenu } from '../src/components/templates/DuplicateMenu'
import { render } from './testUtils'

function renderMenu(onPick = vi.fn()) {
  render(
    <>
      <DuplicateMenu
        label="Duplicate Phishing"
        toOrganization="To my organization"
        toExercise="To this exercise"
        showOrganization
        showExercise
        onPick={onPick}
      />
      <p>Outside</p>
    </>,
  )
  const summary = screen.getByLabelText('Duplicate Phishing')
  const details = summary.closest('details')!
  return { summary, details, onPick }
}

describe('DuplicateMenu', () => {
  it('closes on Escape and gives focus back to its trigger', () => {
    const { summary, details } = renderMenu()
    details.open = true
    fireEvent.keyDown(screen.getByRole('button', { name: 'To my organization' }), {
      key: 'Escape',
    })
    expect(details.open).toBe(false)
    expect(summary).toHaveFocus()
  })

  it('closes on a click outside it', () => {
    const { details } = renderMenu()
    details.open = true
    fireEvent.pointerDown(screen.getByText('Outside'))
    expect(details.open).toBe(false)
  })

  it('closes once an item is picked', () => {
    const { details, onPick } = renderMenu()
    details.open = true
    fireEvent.click(screen.getByRole('button', { name: 'To this exercise' }))
    expect(onPick).toHaveBeenCalledWith('exercise')
    expect(details.open).toBe(false)
  })
})

describe('DuplicateMenu targets', () => {
  it('renders nothing when no target applies', () => {
    render(
      <DuplicateMenu
        label="Duplicate Phishing"
        toOrganization="To my organization"
        toExercise="To this exercise"
        showOrganization={false}
        showExercise={false}
        onPick={() => {}}
      />,
    )
    expect(screen.queryByLabelText('Duplicate Phishing')).not.toBeInTheDocument()
  })
})
