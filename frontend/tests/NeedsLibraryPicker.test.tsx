import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  ObjectiveLibraryDialog,
  RiskLibraryDialog,
} from '../src/components/creator/needs/NeedsLibraryPicker'
import { mockFetchOnce } from './mockFetch'
import { render } from './testUtils'

vi.mock('../src/hooks/useAuth', () => ({
  useAuth: () => ({ activeTtx: { content_language: 'es' } }),
}))

const objective = {
  id: 'classify-severity',
  capability: 'incident_classification',
  title_en: 'Classify the incident',
  title_es: 'Clasificar el incidente',
  statement_en: 'Statement',
  statement_es: 'Enunciado',
  criterion_en: ['A'],
  criterion_es: ['B'],
  evidence_en: [],
  evidence_es: [],
  regulatory_requirement_ids: [],
  time_box_minutes: 30,
}

const risk = (id: string, risk_en: string, risk_es: string) => ({
  id,
  category: 'conduct',
  risk_en,
  risk_es,
  mitigation_en: 'M',
  mitigation_es: 'Mitigación',
  default: false,
})

describe('needs analysis library pickers', () => {
  it('offers only the ticked capabilities, in the exercise language', async () => {
    mockFetchOnce(200, {
      items: [objective, { ...objective, id: 'other', capability: 'legal_forensics' }],
    })
    const onPick = vi.fn()
    render(
      <ObjectiveLibraryDialog
        capabilities={['incident_classification']}
        onPick={onPick}
        onClose={() => {}}
      />,
    )
    fireEvent.click(await screen.findByLabelText(/Clasificar el incidente/))
    expect(screen.getAllByRole('radio')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Use this objective' }))
    expect(onPick).toHaveBeenCalledWith(objective, 'es')
  })

  it('adds the ticked risks and skips those already in the form', async () => {
    mockFetchOnce(200, {
      items: [risk('a', 'Overrun', 'Falta de tiempo'), risk('b', 'Leak', 'Filtración')],
    })
    const onAdd = vi.fn()
    render(<RiskLibraryDialog existing={['filtración ']} onAdd={onAdd} onClose={() => {}} />)
    const leak = await screen.findByRole('checkbox', { name: /Filtración/ })
    expect(leak).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Falta de tiempo/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 risk' }))
    expect(onAdd).toHaveBeenCalledWith([{ risk: 'Falta de tiempo', mitigation: 'Mitigación' }])
  })
})
