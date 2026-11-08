import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CreatorNoExerciseSection } from '../src/components/creator/CreatorNoExerciseSection'
import { render } from './testUtils'

let mockTtxList: Record<string, unknown>[] = []
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    ttxList: mockTtxList,
    activeTtxId: null,
    activeOrganization: {
      organization_id: 'org-1',
      organization_name: 'Acme',
      is_program_manager: false,
      is_planner: true,
    },
  }),
}))

function LocationProbe() {
  return <p data-testid="location">{useLocation().pathname}</p>
}

function renderSection() {
  render(
    <MemoryRouter initialEntries={['/creator/exercise']}>
      <Routes>
        <Route path="/creator/exercise" element={<CreatorNoExerciseSection />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreatorNoExerciseSection', () => {
  beforeEach(() => {
    mockTtxList = []
  })

  it('sends a Planner with no exercise to Creator -> Exercises', () => {
    vi.stubGlobal('fetch', vi.fn())

    renderSection()

    expect(screen.getByTestId('location')).toHaveTextContent('/creator/exercises')
  })

  it('sends someone who manages an exercise on to its page', () => {
    mockTtxList = [
      {
        id: 'ttx-1',
        organization_id: 'org-1',
        role: 'planner',
        plans: true,
        controls: true,
        tags: [],
      },
    ]
    vi.stubGlobal('fetch', vi.fn())

    renderSection()

    expect(screen.getByTestId('location')).toHaveTextContent('/creator/ttx-1/exercise')
  })
})
