import { describe, expect, it } from 'vitest'

import { filterAndSortPeople } from '../src/lib/peopleTable'

const people = [
  {
    full_name: 'Bea',
    email: 'bea@acme.com',
    granted_at: '2026-02-01T00:00:00Z',
    last_login_at: '2026-09-01T00:00:00Z',
  },
  {
    full_name: 'Ana',
    email: 'ana@acme.com',
    granted_at: '2026-03-01T00:00:00Z',
    last_login_at: null,
  },
  {
    full_name: 'Carlos',
    email: 'carlos@other.com',
    granted_at: '2026-01-01T00:00:00Z',
    last_login_at: '2025-01-01T00:00:00Z',
  },
]

function names(sortBy: 'created_at' | 'name' | 'last_login', sortDir: 'asc' | 'desc', search = '') {
  return filterAndSortPeople(people, {
    search,
    sortBy,
    sortDir,
    grantedAt: (p) => p.granted_at,
  }).map((p) => p.full_name)
}

describe('filterAndSortPeople', () => {
  it('sorts by last login with never-logged-in as the least recent', () => {
    expect(names('last_login', 'desc')).toEqual(['Bea', 'Carlos', 'Ana'])
    expect(names('last_login', 'asc')).toEqual(['Ana', 'Carlos', 'Bea'])
  })

  it('sorts by date added and by name', () => {
    expect(names('created_at', 'desc')).toEqual(['Ana', 'Bea', 'Carlos'])
    expect(names('name', 'asc')).toEqual(['Ana', 'Bea', 'Carlos'])
  })

  it('searches name or email, case-insensitively', () => {
    expect(names('name', 'asc', 'OTHER')).toEqual(['Carlos'])
    expect(names('name', 'asc', 'be')).toEqual(['Bea'])
  })
})
