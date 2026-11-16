import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ExerciseDocumentsDialog } from '../src/components/admin/ExerciseDocumentsDialog'
import type { TTXRead } from '../src/lib/types'
import { render } from './testUtils'

function exercise(overrides: Partial<TTXRead>): TTXRead {
  return {
    id: 'ttx-1',
    code: 'TTX-2026-01',
    name: 'Ransomware drill',
    msel_status: 'ready',
    ...overrides,
  } as TTXRead
}

describe('ExerciseDocumentsDialog', () => {
  it('links every document of the exercise as a PDF, named with its code', () => {
    render(<ExerciseDocumentsDialog exercise={exercise({})} onClose={vi.fn()} />)

    expect(screen.getByText('TTX-2026-01')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Needs analysis' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/needs-form/pdf?lang=en',
    )
    expect(screen.getByRole('link', { name: 'MSEL' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/msel/export/msel.pdf?lang=en',
    )
    expect(screen.getByRole('link', { name: 'Situation Manual (SitMan)' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/conduct-prep/export/sitman.pdf?lang=en',
    )
    expect(screen.getByRole('link', { name: 'After-action report' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/aar/export.pdf?lang=en',
    )
    expect(screen.getAllByRole('link')).toHaveLength(9)
  })

  it('leaves out the MSEL and the session documents until the MSEL exists', () => {
    render(<ExerciseDocumentsDialog exercise={exercise({ msel_status: null })} onClose={vi.fn()} />)

    expect(screen.queryByRole('link', { name: 'MSEL' })).not.toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
  })
})
