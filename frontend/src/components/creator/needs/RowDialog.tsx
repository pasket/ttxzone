import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { btnDanger, btnPrimary, btnSecondary } from '../../../lib/buttonStyles'
import { Modal } from '../../common/Modal'

/** The dialog a needs-form row (need, objective, risk) is edited in. Edits
 * stay local until Done, which applies them to the page's draft -- still
 * unsaved until the form's own Save. `initialFocusId` sends the focus to
 * one field, e.g. when the validation summary opens the row. With `dirty`
 * edits, Cancel, Escape or a click outside first ask, in the footer,
 * whether to discard them: long texts are never lost by a stray key.
 *
 * `aside` (e.g. a live preview) is folded behind a toggle next to the
 * title, so the form keeps the full width; opened, it floats over the
 * right of the form, sticky while the form scrolls, still live. Escape
 * folds it first. Whether it's open is remembered for the tab. */
export function RowDialog({
  titleId,
  title,
  onCancel,
  onDone,
  initialFocusId,
  size = 'lg',
  dirty = false,
  aside,
  children,
}: {
  titleId: string
  title: string
  size?: 'lg' | 'xl' | '2xl'
  onCancel: () => void
  onDone: () => void
  initialFocusId?: string | null
  dirty?: boolean
  aside?: { label: string; content: ReactNode }
  children: ReactNode
}) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const [asideOpen, setAsideOpen] = useState(() => readAsideOpen())
  const asideId = useId()
  function toggleAside(open: boolean) {
    setAsideOpen(open)
    try {
      sessionStorage.setItem(ASIDE_KEY, open ? '1' : '0')
    } catch {
      // Storage may be unavailable (private mode): it just isn't remembered.
    }
  }
  const keepRef = useRef<HTMLButtonElement>(null)
  // Runs after Modal's own effect (children's effects run first), so this
  // focus wins over the dialog root's.
  useEffect(() => {
    if (initialFocusId) document.getElementById(initialFocusId)?.focus()
  }, [initialFocusId])
  useEffect(() => {
    if (confirming) keepRef.current?.focus()
  }, [confirming])

  function requestClose() {
    if (aside && asideOpen) toggleAside(false)
    else if (dirty) setConfirming(true)
    else onCancel()
  }

  const form = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <h2 id={titleId} className="text-balance text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {aside && (
          <button
            type="button"
            aria-expanded={asideOpen}
            aria-controls={asideId}
            onClick={() => toggleAside(!asideOpen)}
            className={`${btnSecondary} inline-flex shrink-0 items-center whitespace-nowrap`}
          >
            {aside.label}
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`ml-1.5 h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${asideOpen ? 'rotate-180' : ''}`}
            >
              <path d="m9 6 6 6-6 6" />
            </svg>
          </button>
        )}
      </div>
      {/* Under the title row, so the toggle stays reachable. */}
      <div className="relative">
        <div className="space-y-4">{children}</div>
        {aside && asideOpen && (
          // Spans the form's height so the panel can stick while it
          // scrolls; only the panel itself takes clicks.
          <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-full max-w-sm">
            <section
              id={asideId}
              aria-label={aside.label}
              // Another surface than the form's (the page panels'), a header
              // band and a deep shadow: it reads as a sheet laid over it.
              className="pointer-events-auto sticky top-0 max-h-[calc(100vh-9rem)] overflow-y-auto rounded-md border border-paper-line bg-panel px-3 pb-3 shadow-2xl ring-1 ring-black/10 dark:border-line dark:shadow-black/60 dark:ring-white/5"
            >
              <div className="sticky top-0 -mx-3 mb-3 flex items-center justify-between gap-2 border-b border-panel-line bg-panel bg-[linear-gradient(rgb(0_0_0/0.05),rgb(0_0_0/0.05))] px-3 py-2 dark:bg-[linear-gradient(rgb(255_255_255/0.06),rgb(255_255_255/0.06))]">
                <p className="text-sm font-semibold">{aside.label}</p>
                <button
                  type="button"
                  onClick={() => toggleAside(false)}
                  aria-label={t('creator.needs.preview.close')}
                  className="rounded-xs px-1 text-lg leading-none text-paper-ink/60 hover:text-paper-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg dark:text-fg-faint dark:hover:text-fg"
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
              {aside.content}
            </section>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Modal titleId={titleId} onClose={requestClose} size={size}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          onDone()
        }}
        className="space-y-4"
      >
        {form}
        {/* Stays in view while a long dialog scrolls. */}
        <div className="sticky -bottom-4 -mx-4 -mb-4 border-t border-paper-line bg-paper-surface-raised px-4 py-3 dark:border-line dark:bg-surface-raised">
          {confirming ? (
            <div
              role="alertdialog"
              aria-labelledby={`${titleId}-discard`}
              className="flex flex-wrap items-center justify-end gap-2"
            >
              <p id={`${titleId}-discard`} className="mr-auto text-sm font-medium">
                {t('creator.needs.discard.question')}
              </p>
              <button
                ref={keepRef}
                type="button"
                onClick={() => setConfirming(false)}
                className={btnSecondary}
              >
                {t('creator.needs.discard.keep')}
              </button>
              <button type="button" onClick={onCancel} className={btnDanger}>
                {t('creator.needs.discard.discard')}
              </button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={requestClose} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
              <button type="submit" className={btnPrimary}>
                {t('creator.needs.actions.done')}
              </button>
            </div>
          )}
        </div>
      </form>
    </Modal>
  )
}

const ASIDE_KEY = 'ttx_row_dialog_aside'

function readAsideOpen(): boolean {
  try {
    return sessionStorage.getItem(ASIDE_KEY) === '1'
  } catch {
    return false
  }
}
