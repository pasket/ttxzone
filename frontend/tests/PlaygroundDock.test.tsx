import { fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PlaygroundPage } from '../src/components/playground/PlaygroundPage'
import { render } from './testUtils'

const run = {
  state: 'live',
  seq: 1,
  cursor: '1.x',
  started_at: '2026-11-10T08:30:00Z',
  ended_at: null,
  paused_seconds: 0,
  paused_at: null,
  stop_reason: '',
  stop_keyword: 'APPLE',
  scenario_title: '',
  scenario_summary: '',
  incident_start: null,
  incident_date: null,
  time_compression: 60,
  session_time: null,
  phases: [],
  current_phase_code: null,
  injects: [],
  can_control: false,
  msel_ready: true,
  plan_ready: true,
  control: null,
  presence: [],
  facilitation: null,
}

function stubRun() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, status: 200, json: async () => run }) as Response),
  )
}

function renderPage() {
  return render(<PlaygroundPage ttxId="ttx-1" role="player" dock={() => <p>My panel body</p>} />)
}

describe('The Playground dock', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('resizes from the keyboard within its limits and remembers it', async () => {
    stubRun()
    renderPage()
    const separator = await screen.findByRole('separator', { name: 'Resize your panel' })
    expect(separator).toHaveAttribute('aria-valuenow', '360')

    fireEvent.keyDown(separator, { key: 'ArrowLeft' })
    expect(separator).toHaveAttribute('aria-valuenow', '376')
    fireEvent.keyDown(separator, { key: 'Home' })
    expect(separator).toHaveAttribute('aria-valuenow', '280')
    fireEvent.keyDown(separator, { key: 'ArrowRight' })
    expect(separator).toHaveAttribute('aria-valuenow', '280')
    fireEvent.keyDown(separator, { key: 'End' })
    expect(separator).toHaveAttribute('aria-valuenow', '640')
    expect(JSON.parse(localStorage.getItem('ttx_dock_playground')!).width).toBe(640)
  })

  it('heads the dock with the role and its note, the toggle on the same row', async () => {
    stubRun()
    render(
      <PlaygroundPage
        ttxId="ttx-1"
        role="player"
        dockNote={{ id: 'execution.landing.player', text: 'Read each inject.' }}
        dock={() => <p>My panel body</p>}
      />,
    )
    const header = (await screen.findByText('You take part as Player')).closest('div')!
    expect(header).toContainElement(screen.getByRole('button', { name: 'Fold your panel' }))
    expect(screen.getByText('Read each inject.')).toBeInTheDocument()
  })

  it('folds to a rail, remembered on this device', async () => {
    stubRun()
    const { unmount } = renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Fold your panel' }))
    expect(screen.queryByText('My panel body')).not.toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
    // The role stays on the rail.
    expect(screen.getByTitle('Player')).toHaveTextContent('You take part as Player')
    unmount()

    renderPage()
    expect(await screen.findByRole('button', { name: 'Unfold your panel' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('becomes two tabs on a narrow screen', async () => {
    stubRun()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} })),
    )
    renderPage()
    const panelTab = await screen.findByRole('tab', { name: 'Your panel' })
    expect(screen.getByRole('tab', { name: 'Playground' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('My panel body')).not.toBeInTheDocument()

    fireEvent.click(panelTab)
    expect(screen.getByText('My panel body')).toBeInTheDocument()
    expect(screen.getByText('You take part as Player')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Fold your panel' })).not.toBeInTheDocument()
    expect(screen.queryByRole('separator')).not.toBeInTheDocument()
  })
})
