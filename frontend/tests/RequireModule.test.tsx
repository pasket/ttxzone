import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { RequireModule } from '../src/components/layout/RequireModule'
import { AuthContext, type AuthContextValue } from '../src/lib/authStore'
import type { OrganizationSummary, TTXRead } from '../src/lib/types'

function authValue(org: Partial<OrganizationSummary>, ttxList: Partial<TTXRead>[] = []) {
  const activeOrganization = {
    id: 'org-1',
    name: 'Acme',
    is_program_manager: false,
    is_planner: false,
    ...org,
  } as OrganizationSummary
  return {
    status: 'ready',
    user: null,
    ttxList: ttxList as TTXRead[],
    allTtxList: ttxList as TTXRead[],
    organizations: [activeOrganization],
    activeOrganizationId: activeOrganization.id,
    activeOrganization,
    setActiveOrganizationId: () => {},
    activeTtxId: null,
    activeTtx: null,
    setActiveTtxId: () => {},
    refresh: async () => {},
    logout: async () => {},
  } as AuthContextValue
}

function renderAt(path: string, value: AuthContextValue) {
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/" element={<p>home</p>} />
          <Route
            path="*"
            element={
              <RequireModule>
                <p>module</p>
              </RequireModule>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RequireModule', () => {
  it('sends a Program Manager who opens a Creator URL back home', () => {
    renderAt(
      '/creator/ttx-1/msel',
      authValue({ is_program_manager: true }, [{ id: 'ttx-1', role: 'program_manager' }]),
    )
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('lets a Planner into Creator, even before their first exercise', () => {
    renderAt('/creator/exercise', authValue({ is_planner: true }))
    expect(screen.getByText('module')).toBeInTheDocument()
  })

  it('keeps a Player out of Admin', () => {
    renderAt('/admin/organization', authValue({}, [{ id: 'ttx-1', role: 'player' }]))
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('lets a Player into Execution', () => {
    renderAt('/playground/enrollments', authValue({}, [{ id: 'ttx-1', role: 'player' }]))
    expect(screen.getByText('module')).toBeInTheDocument()
  })
})
