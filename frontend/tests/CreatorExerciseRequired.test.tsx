import { screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { CreatorExerciseRequired } from '../src/components/creator/CreatorExerciseRequired'
import type { TTXRead } from '../src/lib/types'
import { render } from './testUtils'

let mockTtxList: Partial<TTXRead>[] = []
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ ttxList: mockTtxList, activeTtxId: 'ttx-2' }),
}))

function Location() {
  return <p data-testid="location">{useLocation().pathname}</p>
}

function renderAt(section: 'needs' | 'msel') {
  render(
    <MemoryRouter initialEntries={[`/creator/${section}`]}>
      <Routes>
        <Route
          path={`/creator/${section}`}
          element={<CreatorExerciseRequired section={section} />}
        />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('CreatorExerciseRequired', () => {
  it('asks for an exercise first when there is none', () => {
    mockTtxList = []
    renderAt('needs')
    expect(
      screen.getByText('Create an exercise first to fill in its needs analysis.'),
    ).toBeInTheDocument()
  })

  it("opens the active exercise's section when there is one", () => {
    mockTtxList = [
      { id: 'ttx-1', role: 'planner', plans: true, controls: true },
      { id: 'ttx-2', role: 'planner', plans: true, controls: true },
    ]
    renderAt('msel')
    expect(screen.getByTestId('location')).toHaveTextContent('/creator/ttx-2/msel')
  })
})
