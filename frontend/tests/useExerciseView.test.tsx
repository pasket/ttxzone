import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ExerciseOversightHeader } from '../src/components/admin/ExerciseOversightHeader'
import { useExerciseView } from '../src/hooks/useExerciseView'
import type { TTXRead } from '../src/lib/types'
import { render } from './testUtils'

const row = (id: string, role: string) =>
  ({ id, role, code: 'TTX-2026-01', name: 'Drill' }) as TTXRead

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ ttxList: [row('seat', 'planner'), row('none', 'program_manager')] }),
}))

function Probe({ ttxId }: { ttxId: string }) {
  const { oversight, base } = useExerciseView(ttxId)
  return <p>{`${oversight ? 'reads' : 'works on'} ${base}`}</p>
}

describe('how the caller stands before an exercise', () => {
  it('works on it in Creator from a seat, and reads it in Admin without one', () => {
    render(
      <>
        <Probe ttxId="seat" />
        <Probe ttxId="none" />
      </>,
    )
    expect(screen.getByText('works on /creator/seat')).toBeInTheDocument()
    expect(screen.getByText('reads /admin/exercises/none')).toBeInTheDocument()
  })

  it('heads the read-only view with the way back, why, and the documents', () => {
    render(
      <MemoryRouter>
        <ExerciseOversightHeader exercise={row('none', 'program_manager')} section="msel" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /Back to Exercises/ })).toHaveAttribute(
      'href',
      '/admin/exercises',
    )
    expect(screen.getByRole('status')).toHaveTextContent('nothing here can be changed')
    const tabs = screen.getByRole('navigation', { name: 'The exercise’s documents' })
    const links = [...tabs.querySelectorAll('a')]
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/admin/exercises/none/exercise',
      '/admin/exercises/none/needs',
      '/admin/exercises/none/msel',
      '/admin/exercises/none/conduct-prep',
      '/admin/exercises/none/after-action',
    ])
    expect(links[2]).toHaveAttribute('aria-current', 'page')
  })
})
