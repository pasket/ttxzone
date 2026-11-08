import { screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { SectionNav } from '../src/components/layout/PrimaryNav'
import { CREATOR_SECTIONS } from '../src/lib/navSections'
import { render } from './testUtils'

describe('The menu counts what each document needs fixed', () => {
  it('shows the count of each section, and a dot with its name when folded', () => {
    const menu = {
      sections: CREATOR_SECTIONS,
      activeSection: 'needs',
      linkTo: (s: { path: string }) => `/creator/t1/${s.path}`,
      pending: { msel: 12, 'conduct-prep': 1 },
      onToggle: () => undefined,
    }
    const { rerender } = render(
      <MemoryRouter>
        <SectionNav collapsed={false} {...menu} />
      </MemoryRouter>,
    )

    const msel = screen.getByRole('link', { name: /MSEL/ })
    expect(msel).toHaveTextContent('12')
    expect(msel).toHaveAccessibleName(/12 issues to fix/)
    expect(screen.getByRole('link', { name: /Session plan/ })).toHaveAccessibleName(
      /1 issue to fix/,
    )
    expect(screen.getByRole('link', { name: /Needs analysis/ })).not.toHaveTextContent(/\d/)

    rerender(
      <MemoryRouter>
        <SectionNav collapsed {...menu} />
      </MemoryRouter>,
    )
    expect(screen.getByRole('link', { name: /MSEL/ })).toHaveAttribute(
      'title',
      'MSEL · 12 issues to fix',
    )
  })
})
