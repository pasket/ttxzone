import { useEffect, useState } from 'react'

import type { Toast as ToastData } from '../../lib/toastStore'

/** One floating card. `leaving` (owned by ToastProvider, flips ~200ms
 * before removal) drives the fade-out; `visible` drives the fade-in on
 * mount -- both via the same opacity/translate transition so enter and
 * exit read as one consistent motion, not two different effects. */
export function Toast({ leaving, message, variant, action }: ToastData & { leaving: boolean }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  const shown = visible && !leaving

  return (
    <div
      // A failed commit (see toastStore) is urgent, so it interrupts;
      // success confirmations wait for the screen reader to be idle.
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      className={`pointer-events-auto flex max-w-sm items-center gap-3 rounded-lg border border-paper-line bg-paper-surface-raised/80 px-4 py-3 text-sm font-medium text-paper-ink shadow-lg shadow-black/10 backdrop-blur-md transition-[opacity,translate] duration-200 motion-reduce:transition-none dark:border-line dark:bg-surface-raised/80 dark:text-fg dark:shadow-none ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'
      } ${variant === 'error' ? 'border-l-4 border-l-danger' : 'border-l-4 border-l-success'}`}
    >
      <span className="flex-1">{message}</span>
      {action && (
        <button
          type="button"
          onClick={action.onAction}
          className="shrink-0 rounded text-accent-fg hover:text-accent-fg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
