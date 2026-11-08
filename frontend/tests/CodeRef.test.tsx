import { describe, expect, it } from 'vitest'

import { CodeRef, CodeRefList, CodeText } from '../src/components/common/CodeRef'
import { fireEvent, render, screen } from './testUtils'

const items = ['01', '02', '03', '04', '05', '06'].map((n) => ({
  key: n,
  code: `OBJ-${n}`,
  title: `Objective ${n}`,
}))

describe('CodeRef', () => {
  it('stacks the code over its title in a table cell', () => {
    render(<CodeRef variant="stacked" code="OBJ-02" title="Applied software engineering" />)
    // Like a checkbox option and its description: the code as the label,
    // the title muted and smaller under it.
    expect(screen.getByText('OBJ-02')).toHaveClass('text-sm')
    const title = screen.getByText('Applied software engineering')
    expect(title).toHaveClass('text-xs')
    expect(title).toHaveAttribute('title', 'Applied software engineering')
  })

  it('puts the code and a cut title on one line, the bar hidden from screen readers', () => {
    const { container } = render(
      <CodeRef
        code="OBJ-01"
        title="Contain the ransomware outbreak within four hours of detection"
      />,
    )
    expect(container).toHaveTextContent('OBJ-01|, Contain the ransomware outbreak within f…')
    expect(screen.getByText('|')).toHaveAttribute('aria-hidden', 'true')
  })
})

describe('CodeRefList', () => {
  it('shows four, one per line, and unfolds the rest from a link', () => {
    render(<CodeRefList items={items} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: '+2 more' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  it('says nothing with a dash, and offers no link up to four', () => {
    const { container } = render(<CodeRefList items={[]} />)
    expect(container).toHaveTextContent('—')
    render(<CodeRefList items={items.slice(0, 4)} />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})

describe('CodeText', () => {
  it('keeps the codes inside a sentence from translation', () => {
    render(
      <p>
        <CodeText text="PH-02 | Escalation starts before PH-01 | Detection ends." />
      </p>,
    )
    expect(screen.getByText('PH-02')).toHaveAttribute('translate', 'no')
    expect(screen.getByText('PH-01')).toHaveAttribute('translate', 'no')
  })
})
