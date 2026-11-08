import { createContext } from 'react'

/** 'success' covers every save/create confirmation; 'error' covers a
 * background commit that failed after its row was already optimistically
 * removed (see useUndoableAction) -- there's no inline field to show that
 * error against any more, so it has to surface here instead. */
export type ToastVariant = 'success' | 'error'

export interface ToastAction {
  label: string
  onAction: () => void
}

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  action?: ToastAction
}

export interface ToastOptions {
  variant?: ToastVariant
  /** An inline action button (e.g. "Undo") shown next to the message. */
  action?: ToastAction
  /** Milliseconds before auto-dismiss; defaults to the provider's own
   * DISPLAY_MS. An undo toast passes the same delay as its grace period,
   * so the toast disappears exactly when Undo stops being effective. */
  duration?: number
}

export interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
