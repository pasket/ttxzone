import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'

/** First true overlay dialog in this codebase -- everywhere else
 * (CollapsibleFormSection) expands inline instead of floating over the
 * page, but Invitations' tag assignment (the only thing an invitation
 * token has to edit) needs a focused, modal interaction rather than
 * displacing the whole table. Minimal but correct: role=dialog,
 * aria-modal, Escape closes, backdrop click closes, Tab wraps within the
 * dialog (a real focus trap, not just an initial-focus courtesy), and the
 * dialog root itself gets initial focus so screen readers announce it
 * immediately without depending on children containing a focusable
 * element. On close, focus goes back to whatever had it when the dialog
 * opened (the control that opened it -- or, for an item of a <details>
 * menu that has since folded, that menu's summary) without scrolling, so
 * the page stays exactly where it was; a caller that moves focus itself
 * on close (e.g. to the next row after a delete) is left alone. */
export function Modal({
  titleId,
  onClose,
  children,
  size = 'sm',
  align = 'center',
  onTop = false,
}: {
  titleId: string
  onClose: () => void
  children: ReactNode
  /** 'lg' for a dialog holding a whole form (e.g. a needs-form row), 'xl'
   * for a two-pane picker. */
  size?: 'sm' | 'lg' | 'xl' | '2xl'
  /** 'top' anchors the dialog near the top, so it grows downwards when
   * its content changes height (a wizard's steps) instead of re-centring. */
  align?: 'center' | 'top'
  /** Above every other dialog: one that can open over any of them (the
   * step-up sign-in a dialog's request may ask for). */
  onTop?: boolean
}) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Initial focus, plus a body scroll lock so the page behind the backdrop
  // doesn't scroll while the dialog is open (restored on close).
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      // The dialog is gone by now: if focus fell to the page, nobody moved
      // it on purpose -- hand it back to the opener, where the user was.
      const active = document.activeElement
      if (active && active !== document.body) return
      // An item of a menu that folded when picked can't take focus; its
      // summary can.
      const menu = opener?.closest('details')
      const target =
        menu && !menu.open && opener?.tagName !== 'SUMMARY'
          ? menu.querySelector('summary')
          : opener?.isConnected
            ? opener
            : null
      target?.focus({ preventScroll: true })
    }
  }, [])

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    // A dialog opened from another (the inject dialog's "New actor") sits
    // inside it in the DOM: its keys are its own, never its host's.
    if (event.key === 'Escape' || event.key === 'Tab') event.stopPropagation()
    if (event.key === 'Escape') {
      onClose()
      return
    }
    if (event.key !== 'Tab') return

    // Disabled controls can't take focus, so they must not be the trap's
    // first/last stop either -- Tab would otherwise escape the dialog.
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    )
    if (!focusable || focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      data-testid="modal-backdrop"
      className={`fixed inset-0 ${onTop ? 'z-[60]' : 'z-50'} flex justify-center overscroll-contain bg-black/40 p-4 ${
        align === 'top' ? 'items-start sm:pt-[6vh]' : 'items-center'
      }`}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className={`max-h-full w-full ${size === '2xl' ? 'max-w-6xl' : size === 'xl' ? 'max-w-4xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-sm'} space-y-4 overflow-y-auto overscroll-contain rounded-md border border-paper-line bg-paper-surface-raised p-4 shadow-lg dark:border-line dark:bg-surface-raised dark:shadow-none`}
      >
        {children}
      </div>
    </div>
  )
}
