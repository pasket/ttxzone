import { fireEvent, render, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { PersonCombobox } from '../src/components/common/PersonCombobox'

const people = [
  { email: 'ana@acme.com', full_name: 'Ana Ruiz', hint: 'joined Nov 1' },
  { email: 'jose@acme.com', full_name: 'José Pérez' },
  { email: 'rob@acme.com', full_name: 'Rob Red' },
]

function Field({ onChange = () => {} }: { onChange?: (value: string) => void }) {
  const [value, setValue] = useState('')
  return (
    <>
      <label htmlFor="person">Person</label>
      <PersonCombobox
        id="person"
        value={value}
        onChange={(next) => {
          setValue(next)
          onChange(next)
        }}
        options={people}
      />
    </>
  )
}

describe('PersonCombobox', () => {
  it('suggests people by name or email, accents ignored', () => {
    render(<Field />)
    const field = screen.getByRole('combobox', { name: 'Person' })
    expect(field).toHaveAttribute('aria-autocomplete', 'list')

    fireEvent.change(field, { target: { value: 'jose' } })
    expect(field).toHaveAttribute('aria-expanded', 'true')
    const options = within(screen.getByRole('listbox')).getAllByRole('option')
    expect(options).toHaveLength(1)
    expect(options[0]).toHaveTextContent('José Pérez')

    fireEvent.change(field, { target: { value: 'rob@' } })
    expect(within(screen.getByRole('listbox')).getByRole('option')).toHaveTextContent('Rob Red')
  })

  it('moves with the arrow keys and picks with Enter', () => {
    const onChange = vi.fn()
    render(<Field onChange={onChange} />)
    const field = screen.getByRole('combobox', { name: 'Person' })
    fireEvent.focus(field)
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    const second = within(screen.getByRole('listbox')).getAllByRole('option')[1]
    expect(field).toHaveAttribute('aria-activedescendant', second.id)
    expect(second).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(field, { key: 'Enter' })
    expect(field).toHaveValue('jose@acme.com')
    expect(field).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with Escape and keeps any address typed', () => {
    render(<Field />)
    const field = screen.getByRole('combobox', { name: 'Person' })
    fireEvent.change(field, { target: { value: 'outside@else.org' } })
    // Nobody matches: no list, and the address stays.
    expect(field).toHaveAttribute('aria-expanded', 'false')
    expect(field).toHaveValue('outside@else.org')

    fireEvent.change(field, { target: { value: 'a' } })
    expect(field).toHaveAttribute('aria-expanded', 'true')
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(field).toHaveAttribute('aria-expanded', 'false')
    expect(field).toHaveValue('a')
  })
})
