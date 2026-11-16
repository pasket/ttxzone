import { screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { usePageTitle } from '../src/hooks/usePageTitle'
import { render } from './testUtils'

function Page({ heading, context }: { heading: string; context?: string }) {
  usePageTitle(context)
  return <h1>{heading}</h1>
}

describe('usePageTitle', () => {
  it("names the tab after the page's heading, then its context", () => {
    render(<Page heading="Players" context="Ransomware drill" />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(document.title).toBe('Players · Ransomware drill · TTX-Zone')
  })

  it('follows the heading when the page changes it', async () => {
    const { rerender } = render(<Page heading="Loading" />)
    expect(document.title).toBe('Loading · TTX-Zone')
    rerender(<Page heading="Accounts" />)
    await waitFor(() => expect(document.title).toBe('Accounts · TTX-Zone'))
  })
})
