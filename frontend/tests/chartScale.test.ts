import { describe, expect, it } from 'vitest'

import { niceTicks, toPercent } from '../src/lib/chartScale'

describe('niceTicks', () => {
  it('returns a usable [0, 1] axis for an empty or all-zero series', () => {
    expect(niceTicks(0)).toEqual([0, 1])
    expect(niceTicks(-3)).toEqual([0, 1])
    expect(niceTicks(Number.NaN)).toEqual([0, 1])
  })

  it('never uses a fractional step for small counts', () => {
    expect(niceTicks(3)).toEqual([0, 1, 2, 3])
  })

  it('rounds the top up to a nice step', () => {
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8])
    expect(niceTicks(37)).toEqual([0, 10, 20, 30, 40])
    expect(niceTicks(120)).toEqual([0, 50, 100, 150])
  })
})

describe('toPercent', () => {
  it('clamps to 0-100 and guards a zero domain', () => {
    expect(toPercent(5, 10)).toBe(50)
    expect(toPercent(20, 10)).toBe(100)
    expect(toPercent(5, 0)).toBe(0)
  })
})
