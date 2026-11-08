import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TagChip } from '../src/components/common/TagChip'

describe('TagChip', () => {
  it('renders the tag name with the color-specific class', () => {
    render(<TagChip name="Ransomware" color="rose" />)
    const chip = screen.getByText('Ransomware')
    expect(chip.className).toContain('text-tag-rose')
  })

  it('truncates instead of wrapping a long name to a second line', () => {
    render(<TagChip name="A very long tag name that should truncate" color="violet" />)
    const chip = screen.getByText('A very long tag name that should truncate')
    expect(chip.className).toContain('truncate')
  })
})
