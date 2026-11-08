import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { Toast as ToastCard } from '../components/common/Toast'
import { ToastContext } from './toastStore'
import type { Toast, ToastOptions } from './toastStore'

const DISPLAY_MS = 3000
const FADE_MS = 200

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<(Toast & { leaving: boolean })[]>([])
  const nextId = useRef(0)
  // Each toast's fade and removal: cancelled when the provider goes away, so
  // no state update lands after it (a test's teardown, a full sign-out).
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  const later = useCallback((run: () => void, ms: number) => {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      run()
    }, ms)
    timers.current.add(timer)
  }, [])

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const { variant = 'success', action, duration = DISPLAY_MS } = options
      const id = nextId.current++
      setToasts((prev) => [...prev, { id, message, variant, action, leaving: false }])

      later(() => {
        setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)))
      }, duration)
      later(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, duration + FADE_MS)
    },
    [later],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-auto lg:right-4 lg:top-4 lg:items-end">
        {toasts.map((toast) => (
          <ToastCard key={toast.id} {...toast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
