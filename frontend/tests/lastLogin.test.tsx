import { describe, expect, it } from 'vitest'

import { LastLogin } from '../src/components/common/LastLogin'
import { formatRelativeTime, inactivityLevel } from '../src/lib/lastLogin'
import { render, screen } from './testUtils'

const NOW = new Date('2026-09-27T12:00:00Z')

describe('inactivityLevel', () => {
  it('is recent up to 3 calendar months', () => {
    expect(inactivityLevel(new Date('2026-09-26T12:00:00Z'), NOW)).toBe('recent')
    expect(inactivityLevel(new Date('2026-06-28T12:00:00Z'), NOW)).toBe('recent')
  })

  it('escalates past 3, 6 and 12 months', () => {
    expect(inactivityLevel(new Date('2026-06-20T12:00:00Z'), NOW)).toBe('over3Months')
    expect(inactivityLevel(new Date('2026-03-01T12:00:00Z'), NOW)).toBe('over6Months')
    expect(inactivityLevel(new Date('2025-09-01T12:00:00Z'), NOW)).toBe('over12Months')
  })
})

describe('formatRelativeTime', () => {
  it('picks a unit that fits the elapsed time', () => {
    expect(formatRelativeTime(new Date('2026-09-27T11:55:00Z'), NOW, 'en')).toBe('5 minutes ago')
    expect(formatRelativeTime(new Date('2026-09-26T11:00:00Z'), NOW, 'en')).toBe('yesterday')
    expect(formatRelativeTime(new Date('2026-05-20T12:00:00Z'), NOW, 'en')).toBe('4 months ago')
    expect(formatRelativeTime(new Date('2024-08-01T12:00:00Z'), NOW, 'en')).toBe('2 years ago')
  })
})

describe('LastLogin', () => {
  it('shows "Never" when no login is recorded', () => {
    render(<LastLogin value={null} />)
    expect(screen.getByText('Never')).toBeInTheDocument()
  })

  it('spells out a stale-account warning for screen readers', () => {
    render(<LastLogin value="2020-01-01T00:00:00+00:00" />)
    expect(screen.getByText('(No login in over 12 months)')).toBeInTheDocument()
  })

  it('shows a recent login as plain relative time', () => {
    render(<LastLogin value={new Date().toISOString()} />)
    expect(screen.queryByText(/No login in over/)).not.toBeInTheDocument()
  })
})
