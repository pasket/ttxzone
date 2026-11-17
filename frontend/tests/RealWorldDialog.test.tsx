import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RealWorldDialog } from '../src/components/playground/RealWorldDialog'
import { foldStopKeyword } from '../src/lib/stopKeyword'
import { render } from './testUtils'

describe('The stop keyword', () => {
  it('is compared without case, accents or spare spaces', () => {
    expect(foldStopKeyword('  pinzon de   hierro ')).toBe(foldStopKeyword('PINZÓN DE HIERRO'))
    expect(foldStopKeyword('pinzondehierro')).not.toBe(foldStopKeyword('PINZÓN DE HIERRO'))
  })

  it('lets someone without accents at hand pause the exercise', () => {
    render(
      <RealWorldDialog
        ttxId="ttx-1"
        keyword="PINZÓN DE HIERRO"
        onClose={() => {}}
        apply={() => {}}
      />,
    )
    const pause = screen.getByRole('button', { name: 'Pause the exercise' })
    const field = screen.getByRole('textbox')
    expect(field).toHaveAccessibleDescription('Capitals, accents and extra spaces don’t matter.')
    fireEvent.change(field, { target: { value: 'pinzon' } })
    expect(pause).toBeDisabled()
    fireEvent.change(field, { target: { value: 'pinzon de hierro' } })
    expect(pause).toBeEnabled()
  })
})
