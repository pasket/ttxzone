import { useContext } from 'react'

import { ToastContext } from '../lib/toastStore'
import type { ToastContextValue } from '../lib/toastStore'

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (ctx === null) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return ctx
}
