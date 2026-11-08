import { screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { PlayersTabs } from '../src/components/creator/PlayersTabs'
import { LibrarySection } from '../src/components/templates/LibrarySection'
import { render } from './testUtils'

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ activeOrganizationId: 'org-1', activeTtxId: 'ttx-1' }),
}))
// The kinds' own lists aren't what's under test here.
vi.mock('../src/components/templates/ActorLibrary', () => ({ ActorLibrary: () => null }))
vi.mock('../src/components/templates/InjectLibrary', () => ({ InjectLibrary: () => null }))
vi.mock('../src/components/templates/ScenarioLibrary', () => ({ ScenarioLibrary: () => null }))
vi.mock('../src/components/templates/TagLibrary', () => ({ TagLibrary: () => null }))
vi.mock('../src/components/templates/ThreatActorLibrary', () => ({
  ThreatActorLibrary: () => null,
}))

describe('Page tabs', () => {
  it("switch the Library's kinds under its own URL, keeping the search", () => {
    render(
      <MemoryRouter initialEntries={['/creator/ttx-1/library/injects?q=phish']}>
        <Routes>
          <Route
            path="/creator/:ttxId/library/injects"
            element={<LibrarySection withExercise kind="injects" />}
          />
        </Routes>
      </MemoryRouter>,
    )
    const tabs = within(screen.getByRole('navigation', { name: 'Library' }))
    expect(tabs.getAllByRole('link')).toHaveLength(5)
    expect(tabs.getByRole('link', { name: 'Injects' })).toHaveAttribute('aria-current', 'page')
    expect(tabs.getByRole('link', { name: 'Simulated actors' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/library?q=phish',
    )
    expect(tabs.getByRole('link', { name: 'Tags' })).toHaveAttribute(
      'href',
      '/creator/ttx-1/library/tags?q=phish',
    )
  })

  it("show Players' three pages, with how many wait in Pending", () => {
    render(
      <MemoryRouter initialEntries={['/creator/players/pending']}>
        <PlayersTabs pendingCount={3} />
      </MemoryRouter>,
    )
    const links = screen.getAllByRole('link')
    expect(links.map((l) => l.textContent)).toEqual(['Confirmed', 'Pending3', 'Invitations'])
    expect(links[1]).toHaveAttribute('aria-current', 'page')
  })
})
