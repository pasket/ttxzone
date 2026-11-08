import { useCallback, useState } from 'react'

/** The inject text's sizes: the default in the middle, two smaller and two
 * larger. */
const SIZES = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'] as const
const DEFAULT = 2
// The step away from the default (-2..2), so a saved choice keeps its
// meaning if the scale changes.
const KEY = 'ttx_inject_text_step'

function read(): number {
  try {
    const raw = localStorage.getItem(KEY)
    const offset = raw === null ? 0 : Number(raw)
    const step = DEFAULT + offset
    return Number.isInteger(step) && step >= 0 && step < SIZES.length ? step : DEFAULT
  } catch {
    return DEFAULT
  }
}

function persist(step: number): void {
  try {
    localStorage.setItem(KEY, String(step - DEFAULT))
  } catch {
    // Not remembered on this device; the size still changes.
  }
}

/** How large the Playground shows an inject's text, a step at a time,
 * remembered on this device (a reading preference, like the dock's width). */
export function useInjectTextSize() {
  const [step, setStep] = useState(read)
  const change = useCallback((by: number) => {
    setStep((current) => {
      const next = Math.min(SIZES.length - 1, Math.max(0, current + by))
      persist(next)
      return next
    })
  }, [])
  return {
    className: SIZES[step],
    canShrink: step > 0,
    canGrow: step < SIZES.length - 1,
    shrink: useCallback(() => change(-1), [change]),
    grow: useCallback(() => change(1), [change]),
  }
}
