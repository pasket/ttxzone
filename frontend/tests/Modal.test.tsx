import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { Modal } from '../src/components/common/Modal'

describe('Modal', () => {
  it('renders as an accessible dialog labelled by the given element', () => {
    render(
      <Modal titleId="m-title" onClose={vi.fn()}>
        <h2 id="m-title">Assign tags</h2>
      </Modal>,
    )
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'm-title')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal titleId="m-title" onClose={onClose}>
        <h2 id="m-title">Assign tags</h2>
      </Modal>,
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal titleId="m-title" onClose={onClose}>
        <h2 id="m-title">Assign tags</h2>
      </Modal>,
    )
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('moves initial focus inside the dialog', () => {
    render(
      <Modal titleId="m-title" onClose={vi.fn()}>
        <h2 id="m-title">Assign tags</h2>
        <button type="button">First</button>
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toHaveFocus()
  })

  function Opener({ moveFocusOnClose = false }: { moveFocusOnClose?: boolean }) {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open
        </button>
        <button type="button">Elsewhere</button>
        {open && (
          <Modal
            titleId="m-title"
            onClose={() => {
              setOpen(false)
              if (moveFocusOnClose) screen.getByRole('button', { name: 'Elsewhere' }).focus()
            }}
          >
            <h2 id="m-title">Edit</h2>
          </Modal>
        )}
      </>
    )
  }

  it('hands focus back to what opened it, without scrolling the page', () => {
    render(<Opener />)
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    fireEvent.click(opener)
    const focus = vi.spyOn(opener, 'focus')

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(document.activeElement).toBe(opener)
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })

  it('leaves focus where a caller moved it on close', () => {
    render(<Opener moveFocusOnClose />)
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    fireEvent.click(opener)

    fireEvent.click(screen.getByTestId('modal-backdrop'))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Elsewhere' }))
  })

  it("falls back to a folded menu's summary when an item of it opened the dialog", () => {
    function MenuOpener() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <details open>
            <summary>Mark</summary>
            <button
              type="button"
              onClick={(e) => {
                ;(e.currentTarget.closest('details') as HTMLDetailsElement).open = false
                setOpen(true)
              }}
            >
              Open it
            </button>
          </details>
          {open && (
            <Modal titleId="m-title" onClose={() => setOpen(false)}>
              <h2 id="m-title">Edit</h2>
            </Modal>
          )}
        </>
      )
    }
    render(<MenuOpener />)
    const item = screen.getByRole('button', { name: 'Open it' })
    item.focus()
    fireEvent.click(item)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(document.activeElement).toBe(screen.getByText('Mark'))
  })
})
