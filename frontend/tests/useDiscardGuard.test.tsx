import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DiscardConfirm } from '../src/components/common/DiscardConfirm'
import { Modal } from '../src/components/common/Modal'
import { useDiscardGuard } from '../src/hooks/useDiscardGuard'
import { render } from './testUtils'

function FormDialog({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const guard = useDiscardGuard(onClose)
  return (
    <Modal titleId="t" onClose={guard.requestClose}>
      <form
        onChange={guard.touch}
        onSubmit={(event) => {
          event.preventDefault()
          onSave()
        }}
      >
        <h2 id="t">Edit actor</h2>
        <label htmlFor="name">Name</label>
        <input id="name" defaultValue="SOC" />
        {guard.confirming ? (
          <DiscardConfirm onKeep={guard.keep} onDiscard={guard.discard} />
        ) : (
          <>
            <button type="button" onClick={guard.requestClose}>
              Cancel
            </button>
            <button type="submit">Save</button>
          </>
        )}
      </form>
    </Modal>
  )
}

describe('a form dialog with the discard guard', () => {
  it('closes at once while nothing was typed', () => {
    const onClose = vi.fn()
    render(<FormDialog onClose={onClose} onSave={vi.fn()} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('asks before throwing away what was typed, and keeps it by default', () => {
    const onClose = vi.fn()
    render(<FormDialog onClose={onClose} onSave={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'National CSIRT' } })

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Discard your changes?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Keep editing' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    expect(screen.getByLabelText('Name')).toHaveValue('National CSIRT')
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('commits its form on Cmd/Ctrl+Enter, like its submit button', () => {
    const onSave = vi.fn()
    render(<FormDialog onClose={vi.fn()} onSave={onSave} />)
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter', ctrlKey: true })
    expect(onSave).toHaveBeenCalledTimes(1)
  })
})
