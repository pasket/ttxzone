import { fireEvent, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ContextBar } from '../src/components/layout/ContextBar'
import { PrimaryNav } from '../src/components/layout/PrimaryNav'
import { render } from './testUtils'

const ttx = (id: string, code: string, name: string) => ({
  id,
  code,
  name,
  organization_id: 'org-1',
  role: 'planner',
  plans: true,
  controls: true,
  tags: [],
  image_url: null,
})
const exercises = [
  ttx('ttx-1', 'TTX-2026-01', 'Ransomware drill'),
  ttx('ttx-2', 'TTX-2026-02', 'Phishing drill'),
]
let mockList = exercises
let mockActiveTtx: ReturnType<typeof ttx> | null = exercises[0]
const setActiveTtxId = vi.fn()
const org = {
  organization_id: 'org-1',
  organization_name: 'MyOrg',
  is_program_manager: false,
  is_planner: true,
}
vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({
    organizations: [org],
    activeOrganization: org,
    activeOrganizationId: 'org-1',
    setActiveOrganizationId: vi.fn(),
    ttxList: mockList,
    activeTtx: mockActiveTtx,
    activeTtxId: mockActiveTtx?.id ?? null,
    setActiveTtxId,
    executionRole: null,
    setExecutionRole: vi.fn(),
  }),
}))

function Where() {
  return <output aria-label="Path">{useLocation().pathname}</output>
}

function Shell() {
  return (
    <>
      <ContextBar />
      <PrimaryNav collapsed={false} onToggle={() => {}} />
      <Where />
    </>
  )
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/creator/exercises" element={<Shell />} />
        <Route path="/creator/exercises/new" element={<Shell />} />
        <Route path="/creator/library" element={<Shell />} />
        <Route path="/creator/:ttxId/:section" element={<Shell />} />
        <Route path="/playground/:ttxId/:section" element={<Shell />} />
      </Routes>
    </MemoryRouter>,
  )
}

function exerciseSelect() {
  const context = screen.getByRole('navigation', { name: 'Context' })
  return within(context).getByRole('combobox', { name: 'Select exercise' })
}

describe('Creator portfolio in the ContextBar', () => {
  it('ends the exercise selector with All exercises', () => {
    mockList = exercises
    mockActiveTtx = exercises[0]
    renderAt('/creator/ttx-1/needs')
    const select = exerciseSelect()
    expect(Array.from(select.querySelectorAll('option')).map((o) => o.textContent)).toEqual([
      'Ransomware drill',
      'Phishing drill',
      'All exercises',
    ])
    expect(select).toHaveValue('ttx-1')
  })

  it('is a selector even with a single exercise, so the portfolio stays reachable', () => {
    mockList = [exercises[0]]
    mockActiveTtx = exercises[0]
    renderAt('/creator/ttx-1/needs')
    expect(exerciseSelect()).toBeInTheDocument()
  })

  it('opens the portfolio without changing the exercise in context, and shows it as the value', () => {
    mockList = exercises
    mockActiveTtx = exercises[0]
    setActiveTtxId.mockClear()
    renderAt('/creator/ttx-1/needs')

    fireEvent.change(exerciseSelect(), { target: { value: '__all__' } })

    expect(screen.getByRole('status', { name: 'Path' })).toHaveTextContent('/creator/exercises')
    expect(setActiveTtxId).not.toHaveBeenCalled()
    expect(exerciseSelect()).toHaveValue('__all__')
  })

  it("leaves the portfolio for the picked exercise's first page", () => {
    mockList = exercises
    mockActiveTtx = exercises[0]
    setActiveTtxId.mockClear()
    renderAt('/creator/exercises')

    fireEvent.change(exerciseSelect(), { target: { value: 'ttx-2' } })

    expect(setActiveTtxId).toHaveBeenCalledWith('ttx-2')
    expect(screen.getByRole('status', { name: 'Path' })).toHaveTextContent(
      '/creator/ttx-2/exercise',
    )
  })

  it('keeps plain text outside the Creator when there is one exercise', () => {
    mockList = [{ ...exercises[0], role: 'player', plans: false, controls: false }]
    mockActiveTtx = mockList[0]
    renderAt('/playground/ttx-1/dashboard')
    const context = screen.getByRole('navigation', { name: 'Context' })
    expect(within(context).queryByRole('combobox', { name: 'Select exercise' })).toBeNull()
    expect(within(context).getByText('Ransomware drill')).toBeInTheDocument()
  })
})
