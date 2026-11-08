import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { FormattedText } from '../src/components/common/FormattedText'
import { FormattedTextArea } from '../src/components/common/FormattedTextArea'

describe('FormattedText', () => {
  it('renders bold, italic, lists and paragraphs as elements, never as HTML', () => {
    const { container } = render(
      <FormattedText
        text={
          'Scope of the **drill**, _OT_ only.\n\n- Detect\n- Contain\n\n1. Notify\n2. Recover\n\n<img src=x onerror=alert(1)>'
        }
      />,
    )

    expect(screen.getByText('drill').tagName).toBe('STRONG')
    expect(screen.getByText('OT').tagName).toBe('EM')
    expect(container.querySelectorAll('ul > li')).toHaveLength(2)
    expect(container.querySelectorAll('ol > li')).toHaveLength(2)
    // Typed markup stays text.
    expect(container.querySelector('img')).toBeNull()
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument()
  })
})

function Editor({ initial = '' }: { initial?: string }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <FormattedTextArea id="desc" value={value} onChange={setValue} />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('FormattedTextArea', () => {
  it('formats the selection from the toolbar and previews it', () => {
    render(<Editor initial={'Contain the incident\nNotify the regulator'} />)
    const area = screen.getByRole('textbox') as HTMLTextAreaElement

    area.setSelectionRange(0, 7)
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }))
    expect(screen.getByTestId('value')).toHaveTextContent('**Contain** the incident')

    area.setSelectionRange(0, area.value.length)
    fireEvent.click(screen.getByRole('button', { name: 'Bulleted list' }))
    expect(screen.getByTestId('value').textContent).toBe(
      '- **Contain** the incident\n- Notify the regulator',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Preview' }))
    expect(screen.getByText('Contain').tagName).toBe('STRONG')
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('applies italic with the keyboard shortcut', () => {
    render(<Editor initial="urgent" />)
    const area = screen.getByRole('textbox') as HTMLTextAreaElement
    area.setSelectionRange(0, 6)
    fireEvent.keyDown(area, { key: 'i', ctrlKey: true })
    expect(screen.getByTestId('value')).toHaveTextContent('_urgent_')
  })
})
