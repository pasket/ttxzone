import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import App from '../src/App'
import { mockFetchOnce } from './mockFetch'

describe('App', () => {
  it('redirects an anonymous visitor to the login screen', async () => {
    mockFetchOnce(401)
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(screen.getAllByAltText('TTX-Zone').length).toBeGreaterThan(0)
  })
})
