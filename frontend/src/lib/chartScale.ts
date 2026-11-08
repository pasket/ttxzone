/** Pure scale helpers for the dashboard chart primitives -- no DOM, no
 * React, so they're unit-testable on their own. */

const NICE_STEPS = [1, 2, 2.5, 5, 10]

/** Smallest "nice" step (1/2/2.5/5 x 10^n) that splits `max` into at most
 * `tickCount` intervals. */
function niceStep(max: number, tickCount: number): number {
  const rough = max / tickCount
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = NICE_STEPS.find((s) => s * magnitude >= rough) ?? 10
  // Counts are integers -- never a fractional step.
  return Math.max(1, step * magnitude)
}

/** Axis ticks from 0 up to a nice ceiling covering `max`. An empty or
 * all-zero series still gets a usable [0, 1] axis instead of a divide by
 * zero. */
export function niceTicks(max: number, tickCount = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1]
  const step = niceStep(max, tickCount)
  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top; value += step) ticks.push(value)
  return ticks
}

/** Share of `domainMax` as a 0-100 percentage, clamped -- used for bar
 * lengths/heights so layout stays in CSS. */
export function toPercent(value: number, domainMax: number): number {
  if (domainMax <= 0) return 0
  return Math.min(100, Math.max(0, (value / domainMax) * 100))
}
