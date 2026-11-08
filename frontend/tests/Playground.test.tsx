import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ControlCenterPanel } from '../src/components/playground/ControlCenterPanel'
import { DecisionLog } from '../src/components/playground/DecisionLog'
import { ExerciseBanner } from '../src/components/playground/ExerciseBanner'
import { InjectStage } from '../src/components/playground/InjectStage'
import { mockFetchOnce } from './mockFetch'
import { EvaluationPanel } from '../src/components/playground/EvaluationPanel'
import { FacilitationPanel } from '../src/components/playground/FacilitationPanel'
import { NotesPanel } from '../src/components/playground/NotesPanel'
import { PhaseTrack } from '../src/components/playground/PhaseTrack'
import { PlaygroundPage } from '../src/components/playground/PlaygroundPage'
import { PollCard } from '../src/components/playground/PollCard'
import { PresenceBar } from '../src/components/playground/PresenceBar'
import { RoomStage } from '../src/components/playground/RoomStage'
import { SessionSummaryPanel } from '../src/components/playground/SessionSummaryPanel'
import type { RunControlInject, RunInject, RunPoint, RunRead } from '../src/lib/types'
import { render } from './testUtils'

const inject = (code: string, title: string, scenario_minute: number): RunInject => ({
  code,
  title,
  content: `${title}. Literal text.`,
  phase_code: 'PH-01',
  delivery_method: 'email',
  sender: { name: 'SOC', type: 'internal', channel: 'email' } as RunInject['sender'],
  recipients: ['Legal'],
  attachment_notes: [],
  images: [],
  scenario_minute,
  released_at: '2026-11-10T08:40:00Z',
  questions: [],
})

const run = (changes: Partial<RunRead> = {}): RunRead => ({
  state: 'live',
  seq: 3,
  started_at: '2026-11-10T08:30:00Z',
  ended_at: null,
  paused_seconds: 0,
  paused_at: null,
  stop_reason: '',
  stop_keyword: 'APPLE',
  scenario_title: 'Ransomware',
  scenario_summary: '',
  incident_start: '13:00:00',
  incident_date: null,
  time_compression: 60,
  session_time: '09:30:00',
  phases: [
    { code: 'PH-01', number: 1, state: 'done', name: 'Escalation', headline: 'Supplier breach' },
    { code: 'PH-02', number: 2, state: 'current', name: 'Data theft', headline: '100 GB stolen' },
    { code: 'PH-03', number: 3, state: 'upcoming', name: null, headline: null },
  ],
  current_phase_code: 'PH-02',
  injects: [inject('INJ-01', 'SOC alert', 0), inject('INJ-02', 'Exfiltration', 1525)],
  can_control: false,
  msel_ready: true,
  plan_ready: true,
  control: null,
  cursor: '3.abc',
  presence: [],
  facilitation: null,
  ...changes,
})

describe('Playground', () => {
  it('shows the exercise band with the stop keyword before the session', () => {
    render(<ExerciseBanner ttxId="ttx-1" run={run({ state: 'not_started' })} apply={() => {}} />)
    expect(screen.getByText('Exercise · Exercise · Exercise')).toBeInTheDocument()
    expect(screen.getByText('«APPLE»')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'APPLE' })).toBeNull()
  })

  it('pauses for a real-world event once the stop keyword is typed', async () => {
    const paused = run({
      state: 'paused',
      paused_at: '2026-11-10T09:00:00Z',
      real_world_at: '2026-11-10T09:00:00Z',
      real_world_by: 'Pat Player',
    })
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => paused }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    const apply = vi.fn()
    render(<ExerciseBanner ttxId="ttx-1" run={run()} apply={apply} />)

    fireEvent.click(screen.getByRole('button', { name: 'APPLE' }))
    const submit = screen.getByRole('button', { name: 'Pause the exercise' })
    const field = screen.getByLabelText('Type «APPLE» to confirm')
    fireEvent.change(field, { target: { value: 'appl' } })
    expect(submit).toBeDisabled()
    fireEvent.change(field, { target: { value: ' apple ' } })
    fireEvent.click(submit)

    await waitFor(() => expect(apply).toHaveBeenCalledWith(paused))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/ttx-1/run/real-world',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ keyword: ' apple ' }) }),
    )
    vi.unstubAllGlobals()
  })

  it('tells every screen the session is paused for a real-world event', () => {
    render(
      <ExerciseBanner
        ttxId="ttx-1"
        run={run({ state: 'paused', real_world_at: '2026-11-10T09:00:00Z' })}
        apply={() => {}}
      />,
    )
    expect(screen.getByText('Paused · Real-world event')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'APPLE' })).toBeNull()
  })

  it('tracks the phases: done with a tick, the current one, the rest nameless', () => {
    render(<PhaseTrack run={run()} />)
    const phases = [...screen.getByRole('list', { name: 'Phases' }).children]
    expect(phases[0]).toHaveTextContent('✓Escalation(done)Supplier breach#1SOC alert#2Exfiltration')
    expect(phases[1]).toHaveAttribute('aria-current', 'step')
    expect(phases[1]).toHaveTextContent('Data theft100 GB stolen')
    expect(phases[2]).toHaveTextContent('Phase 3')
    // The scenario clock at the current inject: 13:00 + 1 d 1 h 25 min.
    expect(screen.getByText('Day 2 · 14:25')).toBeInTheDocument()
    expect(screen.getByText(/Session 09:30 · T\+/)).toBeInTheDocument()
  })

  it('dates the scenario clock when the scene has a date', () => {
    render(<PhaseTrack run={run({ incident_date: '2026-05-03' })} />)
    // 13:00 on Sun 3 May + 1 d 1 h 25 min.
    expect(screen.getByText('Mon, May 4 · 14:25')).toBeInTheDocument()
  })

  it('keeps a long phase name whole for the tooltip and screen readers', () => {
    const long = 'Ransomware and OT crisis across the whole plant'
    render(
      <PhaseTrack
        run={run({
          phases: [{ code: 'PH-01', number: 1, state: 'current', name: long, headline: null }],
        })}
      />,
    )
    const name = screen.getByTitle(long)
    expect(name).toHaveTextContent(long)
    expect(name).toHaveClass('line-clamp-2')
  })

  it('times the last inject at its card, pauses left out, with no reset there', () => {
    // Paused at 08:50 with 2 minutes of pauses since the timer started at 08:40.
    const paused = run({
      state: 'paused',
      can_control: true,
      paused_at: '2026-11-10T08:50:00Z',
      paused_seconds: 180,
      inject_timer_at: '2026-11-10T08:40:00Z',
      inject_timer_paused_seconds: 60,
    })
    render(<RoomStage run={paused} ttxId="ttx-1" />)
    expect(screen.getByRole('timer', { name: 'Since the last inject' })).toHaveTextContent('08:00')
    // Only on the inject it times, the latest.
    expect(screen.getAllByRole('timer')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: /Reset/ })).not.toBeInTheDocument()
  })

  it('closes the play at ENDEX: a closing card with no timer, no REAL WORLD', () => {
    const over = run({
      state: 'live',
      injects: [
        inject('INJ-01', 'SOC alert', 0),
        {
          ...inject('ENDEX', 'ENDEX — End of exercise', 0),
          content: '**The exercise has ended.**\n\n- What went well',
          phase_code: null,
          sender: null,
          recipients: [],
          delivery_method: 'briefing',
        },
      ],
      inject_timer_at: '2026-11-10T08:40:00Z',
      endex_released_at: '2026-11-10T09:30:00Z',
    })
    const { unmount } = render(<RoomStage run={over} ttxId="ttx-1" />)
    expect(screen.getByRole('region', { name: 'ENDEX — End of exercise' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ENDEX — End of exercise' })).toBeInTheDocument()
    expect(screen.getByText('The exercise has ended.').tagName).toBe('STRONG')
    expect(screen.getByRole('listitem')).toHaveTextContent('What went well')
    expect(screen.queryByText('Channel')).not.toBeInTheDocument()
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    unmount()

    render(<ExerciseBanner ttxId="ttx-1" run={over} apply={() => {}} />)
    expect(screen.getByText('ENDEX · Play is over')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'APPLE' })).not.toBeInTheDocument()
  })

  it('puts the latest inject in play and announces it by its number', () => {
    render(<InjectStage ttxId="ttx-1" injects={run().injects} />)
    expect(screen.getByText('New inject #2: Exfiltration')).toBeInTheDocument()
    expect(screen.getByText('Exfiltration. Literal text.')).toBeVisible()
    // The earlier ones live on the phase track, not under the stage.
    expect(screen.queryByText('SOC alert')).toBeNull()
  })

  it('keeps a reader on the inject they picked when a new one comes in', () => {
    const onReview = vi.fn()
    const view = (injects: RunInject[]) => ({
      sequence: new Map(injects.map((i, n) => [i.code, n + 1])),
      showCodes: false,
      reviewing: 'INJ-01',
      onReview,
    })
    const two = run().injects
    const { rerender } = render(<InjectStage ttxId="ttx-1" injects={two} view={view(two)} />)
    expect(screen.getByText('SOC alert. Literal text.')).toBeVisible()
    expect(screen.getByText('Reviewing')).toBeInTheDocument()

    const three = [...two, inject('INJ-03', 'Ransom note', 1600)]
    rerender(<InjectStage ttxId="ttx-1" injects={three} view={view(three)} />)
    // Still reading #1; the bar names the new one in play.
    expect(screen.getByText('SOC alert. Literal text.')).toBeVisible()
    expect(screen.getByText('Ransom note')).toBeInTheDocument()
    expect(screen.getByText('New inject #3: Ransom note')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Back to the inject in play' }))
    expect(onReview).toHaveBeenCalledWith(null)
  })
})

describe('The Playground on a projector', () => {
  const projected = run({
    can_control: true,
    presence: [
      { role: 'player', name: 'Pat Player' },
      { role: 'controller', name: 'Casey Controller' },
    ],
  })

  function renderPage() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => projected }) as Response),
    )
    return render(<PlaygroundPage ttxId="ttx-1" role="controller" dock={() => <p>Panel</p>} />)
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
  })

  it('shows the band, presence and storyline around the stage, never with codes', async () => {
    renderPage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Show on a projector (full screen)' }),
    )

    // Without the Fullscreen API (jsdom), raised over the page.
    const exit = screen.getByRole('button', { name: 'Stop presenting' })
    const root = exit.closest<HTMLElement>('.fixed')!
    expect(root).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')
    // The projector, ahead of the page kept hidden under it.
    const view = within(root.firstElementChild as HTMLElement)
    expect(view.getByText('Exercise · Exercise · Exercise')).toBeInTheDocument()
    expect(view.getByText('Exfiltration. Literal text.').closest('.text-xl')).not.toBeNull()
    expect(view.queryByText('INJ-02')).toBeNull()
    // The Players by name, the team only counted.
    const presence = view.getByRole('complementary', { name: 'Present' })
    expect(within(presence).getByText('Pat Player')).toBeInTheDocument()
    expect(within(presence).queryByText('Casey Controller')).toBeNull()
    expect(view.getByRole('region', { name: 'Storyline' })).toBeInTheDocument()
    expect(view.getByRole('list', { name: 'Injects in Escalation' })).toBeInTheDocument()
    // The dock stays mounted under it, hidden.
    expect(screen.getByText('Panel')).not.toBeVisible()

    fireEvent.click(view.getByRole('button', { name: 'Hide who is present' }))
    expect(within(presence).queryByText('Pat Player')).toBeNull()
    fireEvent.click(view.getByRole('button', { name: 'Hide the storyline' }))
    expect(view.queryByRole('list', { name: 'Injects in Escalation' })).toBeNull()
    expect(localStorage.getItem('ttx_projector_storyline')).toBe('folded')

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('button', { name: 'Stop presenting' })).toBeNull()
    expect(screen.getByText('Panel')).toBeVisible()
    expect(document.body.style.overflow).toBe('')
    expect(screen.getByRole('button', { name: 'Show on a projector (full screen)' })).toHaveFocus()
  })

  it('uses the browser full screen when it has one', async () => {
    const request = vi.fn(function (this: HTMLElement) {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: this })
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    const exit = vi.fn(() => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
      document.dispatchEvent(new Event('fullscreenchange'))
      return Promise.resolve()
    })
    HTMLElement.prototype.requestFullscreen = request
    document.exitFullscreen = exit
    try {
      renderPage()
      fireEvent.click(
        await screen.findByRole('button', { name: 'Show on a projector (full screen)' }),
      )
      expect(request).toHaveBeenCalledOnce()
      const stop = await screen.findByRole('button', { name: 'Stop presenting' })
      // The browser's full screen, not the overlay.
      expect(stop.closest('.fixed')).toBeNull()

      fireEvent.click(stop)
      expect(exit).toHaveBeenCalledOnce()
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: 'Stop presenting' })).toBeNull(),
      )
    } finally {
      // @ts-expect-error -- jsdom has none; put it back that way.
      delete HTMLElement.prototype.requestFullscreen
      // @ts-expect-error -- as above.
      delete document.exitFullscreen
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: null })
    }
  })
})

describe('The story on the phase track', () => {
  const story = run({
    injects: [
      inject('INJ-01', 'SOC alert', 0),
      // Released out of MSEL order: it's #2 in the story.
      inject('INJ-13', 'Conflicting orders', 10),
      { ...inject('INJ-03', 'Ransom note', 20), phase_code: 'PH-02' },
    ],
  })

  function renderPage(role: 'player' | 'controller') {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => story }) as Response),
    )
    return render(<PlaygroundPage ttxId="ttx-1" role={role} dock={() => <p>Panel</p>} />)
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('numbers each phase’s injects in release order and opens one on the stage', async () => {
    renderPage('player')
    const first = await screen.findByRole('list', { name: 'Injects in Escalation' })
    expect(
      within(first)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['#1SOC alert', '#2Conflicting orders'])
    const second = screen.getByRole('list', { name: 'Injects in Data theft' })
    expect(within(second).getByRole('button')).toHaveTextContent('#3Ransom note(in play)')
    expect(screen.getByText('Ransom note. Literal text.')).toBeVisible()

    fireEvent.click(within(first).getByRole('button', { name: /Conflicting orders/ }))
    expect(screen.getByText('Conflicting orders. Literal text.')).toBeVisible()
    expect(screen.getByText('Reviewing · Escalation')).toBeInTheDocument()
    expect(within(first).getByRole('button', { name: /Conflicting orders/ })).toHaveAttribute(
      'aria-current',
      'true',
    )

    fireEvent.click(screen.getByRole('button', { name: 'Back to the inject in play' }))
    expect(screen.getByText('Ransom note. Literal text.')).toBeVisible()
    expect(screen.queryByText('Conflicting orders. Literal text.')).toBeNull()
  })

  it('steps through the story from the inject reviewed', async () => {
    renderPage('player')
    await screen.findByRole('list', { name: 'Injects in Escalation' })
    // From the inject in play: nothing after it; back one starts a review.
    expect(screen.getByRole('button', { name: 'No next inject' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous inject: #2 Conflicting orders' }))
    expect(screen.getByText('Reviewing · Escalation')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous inject: #1 SOC alert' }))
    expect(screen.getByText('SOC alert. Literal text.')).toBeVisible()
    expect(screen.getByRole('button', { name: 'No previous inject' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Next inject: #2 Conflicting orders' }))
    expect(screen.getByText('Conflicting orders. Literal text.')).toBeVisible()
    // Onto the one in play: the review ends.
    fireEvent.click(screen.getByRole('button', { name: 'Next inject: #3 Ransom note' }))
    expect(screen.getByText('Ransom note. Literal text.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Back to the inject in play' })).toBeNull()
  })

  it('never shows a Player the MSEL codes, and shows them to the team', async () => {
    const { unmount } = renderPage('player')
    await screen.findByRole('list', { name: 'Injects in Escalation' })
    expect(document.body).not.toHaveTextContent(/INJ-\d/)
    unmount()

    renderPage('controller')
    await screen.findByRole('list', { name: 'Injects in Escalation' })
    expect(screen.getByText('INJ-03')).toBeInTheDocument()
  })
})

describe('Control center', () => {
  const row = (
    code: string,
    title: string,
    changes: Partial<RunControlInject> = {},
  ): RunControlInject => ({
    code,
    title,
    kind: 'mandatory',
    phase_code: 'PH-01',
    offset_minutes: 0,
    due_minute: 0,
    state: 'pending',
    reason: '',
    trigger_condition: '',
    contingent_purpose: '',
    branch_action_code: null,
    suggested: false,
    expected_actions: [],
    ...changes,
  })
  const control: NonNullable<RunRead['control']> = {
    phases: [
      {
        code: 'PH-01',
        name: 'Escalation',
        start_offset: 0,
        end_offset: 30,
        key_questions: ['Who decides?', 'Who tells the regulator?'],
        released_questions: [0],
        covered_questions: [],
      },
    ],
    injects: [
      row('INJ-01', 'SOC alert', {
        state: 'released',
        expected_actions: [
          {
            code: 'INJ-01-A1',
            description: 'Convene the crisis committee',
            responsible_role: 'CISO',
            expected_within_minutes: 15,
            mark: null,
            note: '',
            marked_at: null,
          },
        ],
      }),
      row('INJ-02', 'Exfiltration', { offset_minutes: 20, due_minute: 20 }),
      row('INJ-03', 'Plan B', {
        kind: 'contingent',
        offset_minutes: null,
        due_minute: 25,
        trigger_condition: 'Nobody convenes the committee',
        branch_action_code: 'INJ-01-A1',
        suggested: true,
      }),
    ],
    msel: { injects: [], phases: [], actors: [] } as unknown as NonNullable<
      RunRead['control']
    >['msel'],
  }
  const controlled = (changes: Partial<RunRead> = {}) =>
    run({
      injects: [inject('INJ-01', 'SOC alert', 0)],
      current_phase_code: 'PH-01',
      can_control: true,
      control,
      ...changes,
    })
  const answering = (body: RunRead) => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => body }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('starts the session once both documents are ready', () => {
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({ state: 'not_started', plan_ready: false })}
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Start exercise' })).toBeDisabled()
    expect(screen.getByText(/must both be ready/)).toBeInTheDocument()
  })

  it('releases the next mandatory inject and applies the answer', async () => {
    const next = controlled({ seq: 4 })
    const fetchMock = answering(next)
    const onChange = vi.fn()
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={onChange} />)
    const upcoming = screen.getByRole('region', { name: 'Next' })

    // The next one goes out at once, no confirmation.
    fireEvent.click(within(upcoming).getByRole('button', { name: 'Release INJ-02' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(next))
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/ttx-1/run/injects/INJ-02/release',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('fires a suggested contingent inject only with a reason', async () => {
    const fetchMock = answering(controlled())
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)
    // On top of the next ones.
    const upcoming = screen.getByRole('region', { name: 'Next' })
    expect(within(upcoming).getByText('Suggested')).toBeInTheDocument()
    expect(screen.getByText('Fires if: Nobody convenes the committee')).toBeInTheDocument()

    fireEvent.click(within(upcoming).getByRole('button', { name: 'Fire INJ-03' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText('Reason'), {
      target: { value: 'Committee never met' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fire' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/injects/INJ-03/release',
        expect.objectContaining({ body: JSON.stringify({ reason: 'Committee never met' }) }),
      ),
    )
  })

  it('shows the previous inject, the one in play and the next three', () => {
    const sequence = {
      ...control,
      injects: [
        row('INJ-00', 'Briefing', { state: 'released', due_minute: 0 }),
        { ...control.injects[0], due_minute: 5 },
        row('INJ-02', 'Exfiltration', { due_minute: 20 }),
        row('INJ-04', 'Backup fails', { due_minute: 35 }),
        row('INJ-05', 'Regulator calls', { due_minute: 35 }),
        row('INJ-06', 'Media leak', { due_minute: 50 }),
      ],
    }
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({
          control: sequence,
          injects: [inject('INJ-00', 'Briefing', 0), inject('INJ-01', 'SOC alert', 5)],
          inject_timer_at: '2026-11-10T08:40:00Z',
          state: 'paused',
          paused_at: '2026-11-10T08:42:05Z',
        })}
        onChange={() => {}}
      />,
    )
    const previous = screen.getByRole('region', { name: 'Previous' })
    expect(within(previous).getByText('INJ-00')).toBeInTheDocument()
    const inPlay = screen.getByRole('region', { name: 'In play' })
    expect(within(inPlay).getByText('INJ-01')).toBeInTheDocument()
    expect(within(inPlay).getByRole('timer')).toHaveTextContent('02:05')
    const upcoming = screen.getByRole('region', { name: 'Next' })
    expect(
      within(upcoming)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining('INJ-02'),
      expect.stringContaining('INJ-04'),
      expect.stringContaining('INJ-05'),
    ])
    expect(within(upcoming).getAllByText('Parallel')).toHaveLength(2)
    expect(within(upcoming).queryByText('INJ-06')).not.toBeInTheDocument()
    expect(
      within(upcoming).getByRole('button', { name: 'Jump to INJ-05 and release it' }),
    ).toBeInTheDocument()
    // Skipping stays in the MSEL list only.
    for (const name of ['Previous', 'In play', 'Next'])
      expect(
        within(screen.getByRole('region', { name })).queryByRole('button', { name: /^Skip/ }),
      ).toBeNull()
  })

  it('shows a branch off the inject in play among the next ones, in T+ order', () => {
    const msel = (code: string, kind: string, branch: object = {}) => ({
      id: `id-${code}`,
      code,
      kind,
      branch_from_id: null,
      rejoin_inject_id: null,
      ...branch,
    })
    const sequence = {
      ...control,
      injects: [
        control.injects[0],
        row('INJ-02', 'Exfiltration', { due_minute: 15 }),
        row('INJ-03', 'Ransomware', { due_minute: 30 }),
        row('INJ-04', 'Regulator', { due_minute: 50 }),
        row('INJ-12', 'Threat intel', {
          kind: 'contingent',
          offset_minutes: null,
          due_minute: 20,
          branch_action_code: 'INJ-01-A1',
        }),
      ],
      msel: {
        injects: [
          msel('INJ-01', 'mandatory'),
          msel('INJ-02', 'mandatory'),
          msel('INJ-03', 'mandatory'),
          msel('INJ-04', 'mandatory'),
          msel('INJ-12', 'contingent', {
            branch_from_id: 'id-INJ-01',
            rejoin_inject_id: 'id-INJ-03',
          }),
        ],
        phases: [],
        actors: [],
      } as unknown as NonNullable<RunRead['control']>['msel'],
    }
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({ control: sequence })}
        onChange={() => {}}
      />,
    )
    const upcoming = screen.getByRole('region', { name: 'Next' })
    // Not suggested yet, but one of the ways on: three rows in all.
    expect(
      within(upcoming)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual([
      expect.stringContaining('INJ-02'),
      expect.stringContaining('INJ-12'),
      expect.stringContaining('INJ-03'),
    ])
    expect(
      within(upcoming).getByText('Two ways on from INJ-01: the storyline or its branch.'),
    ).toBeInTheDocument()
    expect(within(upcoming).getByText('If not observed:')).toBeInTheDocument()
    expect(within(upcoming).getByText('Back at')).toBeInTheDocument()
    expect(within(upcoming).getByRole('button', { name: 'Fire INJ-12' })).toBeInTheDocument()
    expect(within(upcoming).getByRole('button', { name: 'Release INJ-02' })).toBeInTheDocument()
    expect(
      within(upcoming).getByRole('button', { name: 'Jump to INJ-03 and release it' }),
    ).toBeInTheDocument()
  })

  it('asks before jumping ahead; the one jumped over stays pending, out of the window', async () => {
    const fetchMock = answering(controlled())
    const sequence = {
      ...control,
      injects: [
        control.injects[0],
        row('INJ-02', 'Exfiltration', { due_minute: 20 }),
        row('INJ-04', 'Backup fails', { due_minute: 35 }),
      ],
    }
    const { rerender } = render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({ control: sequence })}
        onChange={() => {}}
      />,
    )
    const upcoming = screen.getByRole('region', { name: 'Next' })
    fireEvent.click(within(upcoming).getByRole('button', { name: 'Jump to INJ-04 and release it' }))
    const dialog = screen.getByRole('dialog', { name: 'Release INJ-04 ahead of time?' })
    expect(within(dialog).getByText('INJ-02')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Release' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/injects/INJ-04/release',
        expect.objectContaining({ method: 'POST' }),
      ),
    )

    rerender(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({
          control: {
            ...sequence,
            injects: [
              sequence.injects[0],
              sequence.injects[1],
              { ...sequence.injects[2], state: 'released' },
            ],
          },
          injects: [inject('INJ-01', 'SOC alert', 0), inject('INJ-04', 'Backup fails', 35)],
        })}
        onChange={() => {}}
      />,
    )
    expect(
      within(screen.getByRole('region', { name: 'Next' })).queryByText('INJ-02'),
    ).not.toBeInTheDocument()
  })

  it('releases the previous inject again after a brief confirmation', async () => {
    const fetchMock = answering(controlled())
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({
          injects: [inject('INJ-00', 'Briefing', 0), inject('INJ-01', 'SOC alert', 0)],
        })}
        onChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Release INJ-00 again' }))
    const dialog = screen.getByRole('dialog', { name: 'Re-send INJ-00?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Re-send' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/injects/INJ-00/resend',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  it('resets the time since the last inject from the inject in play', async () => {
    const fetchMock = answering(controlled())
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({ inject_timer_at: '2026-11-10T08:40:00Z' })}
        onChange={() => {}}
      />,
    )
    const inPlay = screen.getByRole('region', { name: 'In play' })
    fireEvent.click(within(inPlay).getByRole('button', { name: 'Reset the inject timer' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/inject-timer/reset',
        expect.objectContaining({ method: 'POST' }),
      ),
    )
  })

  const allOut = {
    ...control,
    injects: control.injects.map((i) => ({
      ...i,
      state: i.kind === 'mandatory' ? ('released' as const) : ('skipped' as const),
      suggested: false,
    })),
  }

  it('offers ENDEX once every mandatory inject is out, worded by default', async () => {
    const fetchMock = answering(controlled())
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({
          injects: [inject('INJ-01', 'SOC alert', 0), inject('INJ-02', 'Exfiltration', 20)],
          control: allOut,
        })}
        onChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send ENDEX' }))
    const dialog = screen.getByRole('dialog', { name: 'Send ENDEX' })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('ENDEX — End of exercise')
    fireEvent.change(within(dialog).getByLabelText('Message'), {
      target: { value: 'Thanks, team.' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send ENDEX' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/endex',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ title: 'ENDEX — End of exercise', content: 'Thanks, team.' }),
        }),
      ),
    )
  })

  it("words ENDEX in the exercise's content language, not the Controller's", () => {
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({
          injects: [inject('INJ-01', 'SOC alert', 0), inject('INJ-02', 'Exfiltration', 20)],
          control: allOut,
        })}
        onChange={() => {}}
        contentLanguage="es"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send ENDEX' }))
    // The dialog itself stays in the Controller's language.
    const dialog = screen.getByRole('dialog', { name: 'Send ENDEX' })
    expect(within(dialog).getByLabelText('Title')).toHaveValue('ENDEX — Fin del ejercicio')
    expect((within(dialog).getByLabelText('Message') as HTMLTextAreaElement).value).toContain(
      'Gracias',
    )
  })

  it('offers no ENDEX while a mandatory inject is pending, and none twice', () => {
    const { unmount } = render(
      <ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Send ENDEX' })).not.toBeInTheDocument()
    unmount()
    render(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({
          injects: [
            inject('INJ-01', 'SOC alert', 0),
            inject('ENDEX', 'ENDEX — End of exercise', 0),
          ],
          control: allOut,
          endex_released_at: '2026-11-10T09:30:00Z',
        })}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Send ENDEX' })).not.toBeInTheDocument()
    expect(screen.getByText(/every phase is closed/)).toBeInTheDocument()
    // Its title already names it: never "ENDEX ENDEX — …".
    expect(document.body.textContent).not.toMatch(/ENDEX\s*\|?\s*ENDEX/)
    expect(screen.getByRole('button', { name: 'Release INJ-01 again' })).toBeDisabled()
    // No play left to pause, time or stop for an emergency: only the end.
    expect(screen.queryByRole('button', { name: 'Pause' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reset the inject timer' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'End exercise' }))
    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).queryByRole('checkbox', { name: /Emergency stop/ }),
    ).not.toBeInTheDocument()
  })

  it('marks an expected action and asks the key questions not yet asked', async () => {
    const fetchMock = answering(controlled())
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)

    fireEvent.click(screen.getByRole('radio', { name: 'Not observed' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/actions/INJ-01-A1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ mark: 'not_observed', note: '' }),
        }),
      ),
    )

    // The first was asked already: only the second can be picked.
    expect(screen.getByRole('checkbox', { name: /Who decides/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /Who tells the regulator/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Ask on INJ-01' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/questions',
        expect.objectContaining({ body: JSON.stringify({ phase_code: 'PH-01', positions: [1] }) }),
      ),
    )
  })

  it('marks an asked key question as covered', async () => {
    const fetchMock = answering(controlled())
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)
    // Only the asked one can be marked.
    const toggles = screen.getAllByRole('button', { name: 'Mark covered' })
    expect(toggles).toHaveLength(1)
    fireEvent.click(toggles[0])
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/questions/covered',
        expect.objectContaining({
          body: JSON.stringify({ phase_code: 'PH-01', position: 0, covered: true }),
        }),
      ),
    )
  })

  it('pauses, and ends the session only once confirmed', async () => {
    const fetchMock = answering(controlled({ state: 'ended' }))
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument()
    // One way to end: no separate STOP button.
    expect(screen.queryByRole('button', { name: 'STOP' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'End exercise' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByLabelText('Reason')).not.toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'End exercise' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/v1/ttx/ttx-1/run/end', expect.anything()),
    )
  })

  it('stops for an emergency only with a reason', async () => {
    const fetchMock = answering(controlled({ state: 'stopped', stop_reason: 'Real outage' }))
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'End exercise' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /Emergency stop/ }))
    const confirm = within(dialog).getByRole('button', { name: 'Stop for emergency' })
    expect(confirm).toBeDisabled()

    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Real outage' } })
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/stop',
        expect.objectContaining({ body: JSON.stringify({ reason: 'Real outage' }) }),
      ),
    )
  })

  it('restarts once over, deleting only a run with no report', async () => {
    const fetchMock = answering(controlled({ state: 'not_started' }))
    const { rerender } = render(
      <ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />,
    )
    expect(screen.queryByRole('button', { name: 'Restart exercise' })).not.toBeInTheDocument()

    rerender(
      <ControlCenterPanel
        ttxId="ttx-1"
        run={controlled({ state: 'ended', run_number: 1, can_delete: false })}
        onChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Restart exercise' }))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: /Delete this run/ })).toBeDisabled()
    expect(within(dialog).getByRole('radio', { name: /Start a new run/ })).toBeChecked()
    // The control word confirms it, any case.
    const restart = within(dialog).getByRole('button', { name: 'Restart' })
    expect(restart).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Type «restart» to confirm'), {
      target: { value: 'Restart' },
    })
    fireEvent.click(restart)
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/restart',
        expect.objectContaining({
          body: JSON.stringify({ mode: 'archive', confirmation: 'Restart' }),
        }),
      ),
    )
  })
})

describe('Playground stage', () => {
  it('makes the inject text larger and smaller, remembered on the device', () => {
    render(<InjectStage ttxId="ttx-1" injects={[inject('INJ-01', 'SOC alert', 0)]} />)
    const text = screen.getByText('SOC alert. Literal text.').closest('div')
    expect(text).toHaveClass('text-base')

    // Two steps up from the default, then no further.
    const larger = screen.getByRole('button', { name: 'Larger text' })
    fireEvent.click(larger)
    fireEvent.click(larger)
    expect(text).toHaveClass('text-xl')
    expect(larger).toBeDisabled()
    expect(localStorage.getItem('ttx_inject_text_step')).toBe('2')

    // Two steps down from the default, then no further.
    const smaller = screen.getByRole('button', { name: 'Smaller text' })
    for (let i = 0; i < 4; i++) fireEvent.click(smaller)
    expect(text).toHaveClass('text-xs')
    expect(smaller).toBeDisabled()
  })

  it('puts the audience on its own row, folded past six', () => {
    const recipients = Array.from({ length: 14 }, (_, i) => `Group ${i + 1}`)
    const { unmount } = render(
      <InjectStage
        ttxId="ttx-1"
        injects={[{ ...inject('INJ-11', 'Reflection', 0), recipients }]}
      />,
    )
    expect(screen.getByText('· 14')).toBeInTheDocument()
    expect(screen.getByText('Group 6')).toBeInTheDocument()
    expect(screen.queryByText('Group 7')).not.toBeInTheDocument()
    const more = screen.getByRole('button', { name: '+8 more' })
    expect(more).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(more)
    expect(screen.getByText('Group 14')).toBeInTheDocument()
    const less = screen.getByRole('button', { name: 'Show less' })
    expect(less).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(less)
    expect(screen.queryByText('Group 14')).not.toBeInTheDocument()
    unmount()

    // Seven fit without a button; none, no audience row.
    render(
      <InjectStage
        ttxId="ttx-1"
        injects={[{ ...inject('INJ-12', 'Short', 0), recipients: recipients.slice(0, 7) }]}
      />,
    )
    expect(screen.getByText('Group 7')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /more/ })).not.toBeInTheDocument()
  })

  it('shows no audience row without recipients', () => {
    render(
      <InjectStage
        ttxId="ttx-1"
        injects={[{ ...inject('INJ-13', 'Nobody', 0), recipients: [] }]}
      />,
    )
    expect(screen.queryByText('Audience')).not.toBeInTheDocument()
  })

  it('shows the key questions put to the table under the inject', () => {
    render(
      <InjectStage
        ttxId="ttx-1"
        injects={[
          {
            ...inject('INJ-01', 'SOC alert', 0),
            questions: [
              { text: 'Who decides?', covered: false },
              { text: 'Who calls the regulator?', covered: true },
            ],
          },
        ]}
      />,
    )
    expect(screen.getByRole('region', { name: 'Questions for the table' })).toHaveTextContent(
      'Who decides?',
    )
    // A covered one stays, dimmed and marked.
    const covered = screen.getByText('Who calls the regulator?')
    expect(covered).toHaveClass('text-paper-ink/60')
    expect(covered).toHaveTextContent('Covered')
  })

  it('hands out the inject’s files to download, with size and SHA-256', () => {
    const sha256 = 'ab'.repeat(32)
    render(
      <InjectStage
        ttxId="ttx-1"
        injects={[
          {
            ...inject('INJ-01', 'SOC alert', 0),
            files: [
              {
                id: 'f-1',
                name: 'edge-fw.pcap',
                size_bytes: 2048,
                sha256,
                description: 'Firewall capture',
              },
            ],
          },
        ]}
      />,
    )
    const files = screen.getByRole('region', { name: 'Files' })
    const link = within(files).getByRole('link', { name: 'Download edge-fw.pcap' })
    expect(link).toHaveAttribute('href', '/api/v1/ttx/ttx-1/run/files/f-1')
    expect(link).toHaveAttribute('download')
    expect(files).toHaveTextContent('2 KB')
    expect(files).toHaveTextContent('Firewall capture')
    expect(within(files).getByTitle(sha256)).toHaveTextContent(`SHA-256 ${sha256.slice(0, 16)}`)
    // A capture only downloads: no preview.
    expect(within(files).queryByRole('button', { name: /Preview/ })).toBeNull()
  })

  it('draws an inject as a simulated email, its text never as markup', () => {
    render(
      <InjectStage
        ttxId="ttx-1"
        injects={[
          {
            ...inject('INJ-01', 'Phishing', 0),
            content: 'Click <b>here</b> to reset.',
            artifact: {
              kind: 'email',
              sender: 'IT Service Desk',
              sender_address: 'helpdesk@example.com',
              recipient: 'All staff',
              subject: 'Mandatory password reset',
              timestamp: 'Day 1, 08:12',
              location: '',
            },
          },
        ]}
      />,
    )
    const email = screen.getByRole('article', { name: 'Email' })
    expect(email).toHaveTextContent('Mandatory password reset')
    expect(email).toHaveTextContent('IT Service Desk <helpdesk@example.com>')
    expect(email).toHaveTextContent('Simulated')
    expect(email).toHaveTextContent('Click <b>here</b> to reset.')
    expect(email.querySelector('b')).toBeNull()
  })

  it('previews a delivered log as plain text', async () => {
    const fetchMock = mockFetchOnce(200, {
      id: 'f-2',
      name: 'auth.log',
      size_bytes: 40,
      text: 'sshd: Failed password\n<script>x</script>',
      truncated: true,
      encoding: 'utf-8',
      limit_bytes: 262144,
    })
    render(
      <InjectStage
        ttxId="ttx-1"
        injects={[
          {
            ...inject('INJ-01', 'SOC alert', 0),
            files: [
              {
                id: 'f-2',
                name: 'auth.log',
                size_bytes: 40,
                sha256: 'cd'.repeat(32),
                description: '',
              },
            ],
          },
        ]}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Preview auth.log' }))
    const contents = await screen.findByLabelText('Contents of auth.log')
    expect(contents).toHaveTextContent('<script>x</script>')
    expect(document.querySelector('script')).toBeNull()
    expect(screen.getByText(/Showing the first 256 KB/)).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toContain('/ttx/ttx-1/run/files/f-2/preview')
  })
})

describe('Control storyline', () => {
  it('has the MSEL strip controls, remembered apart from the MSEL', async () => {
    const { ControlStoryline } = await import('../src/components/playground/ControlStoryline')
    const control = {
      phases: [],
      injects: [],
      msel: { injects: [], phases: [], actors: [], duration_minutes: 120, time_compression: 60 },
    } as unknown as NonNullable<RunRead['control']>
    render(<ControlStoryline run={run({ state: 'live', control })} control={control} />)
    const region = screen.getByRole('region', { name: 'Storyline' })
    // Folded, unpinned, no session time by default; the legend shows.
    expect(within(region).getByRole('button', { name: 'Show' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(region).not.toHaveClass('sticky')
    expect(within(region).getByRole('button', { name: 'Hide the legend' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(within(region).getByRole('button', { name: 'Show session time' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    fireEvent.click(within(region).getByRole('button', { name: 'Show' }))
    expect(localStorage.getItem('ttx_control_storyline_strip')).toBe('open')
    fireEvent.click(within(region).getByRole('button', { name: 'Pin to the top' }))
    expect(region).toHaveClass('sticky')
    expect(localStorage.getItem('ttx_control_storyline_pinned')).toBe('pinned')

    expect(within(region).getByText('Delivered')).toBeInTheDocument()
    fireEvent.click(within(region).getByRole('button', { name: 'Hide the legend' }))
    expect(within(region).queryByText('Delivered')).toBeNull()

    fireEvent.click(within(region).getByRole('button', { name: 'Maximize' }))
    expect(within(region).getByRole('button', { name: 'Restore' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(within(region).getByRole('button', { name: 'Maximize' })).toBeInTheDocument()

    fireEvent.click(within(region).getByRole('button', { name: 'Hide' }))
    expect(localStorage.getItem('ttx_control_storyline_strip')).toBe('closed')
    expect(localStorage.getItem('ttx_msel_storyline_strip')).toBeNull()
  })

  it('draws where the session stands now', async () => {
    const { StorylineGraph } = await import('../src/components/creator/msel/StorylineGraph')
    const { storylineMap } = await import('../src/lib/storylineMap')
    const draft = {
      phases: [],
      injects: [],
      duration_minutes: 120,
      time_compression: 60,
    } as unknown as Parameters<typeof storylineMap>[0]
    render(<StorylineGraph map={storylineMap(draft)} phases={[]} markActions={() => []} now={30} />)
    expect(screen.getByTestId('storyline-now')).toHaveStyle({ left: '25%' })
    expect(screen.queryByTestId('storyline-clock')).toBeNull()
  })

  it('takes the now line to the end once ENDEX is out', async () => {
    const { StorylineGraph } = await import('../src/components/creator/msel/StorylineGraph')
    const { storylineMap } = await import('../src/lib/storylineMap')
    const draft = {
      phases: [],
      injects: [],
      duration_minutes: 120,
      time_compression: 60,
    } as unknown as Parameters<typeof storylineMap>[0]
    const { container } = render(
      <StorylineGraph
        map={storylineMap(draft)}
        phases={[]}
        markActions={() => []}
        now={30}
        finished
        fadeUntraversed
      />,
    )
    const line = screen.getByTestId('storyline-now')
    expect(line).toHaveStyle({ left: '100%' })
    expect(line).toHaveAttribute('data-finished', 'true')
    // ENDEX closes the storyline like a last inject: all of it was run through.
    expect(container.querySelector('svg path[data-faded]')).toBeNull()
  })

  it('draws the storyline past where the session stands paler', async () => {
    const { StorylineGraph } = await import('../src/components/creator/msel/StorylineGraph')
    const { storylineMap } = await import('../src/lib/storylineMap')
    const draft = {
      phases: [],
      injects: [],
      duration_minutes: 120,
      time_compression: 60,
    } as unknown as Parameters<typeof storylineMap>[0]
    const { container, rerender } = render(
      <StorylineGraph map={storylineMap(draft)} phases={[]} markActions={() => []} now={30} />,
    )
    // Only the control center fades what hasn't been run through.
    expect(container.querySelectorAll('svg path')).toHaveLength(1)
    rerender(
      <StorylineGraph
        map={storylineMap(draft)}
        phases={[]}
        markActions={() => []}
        now={30}
        fadeUntraversed
      />,
    )
    const [run, ahead] = container.querySelectorAll('svg path')
    expect(run).toHaveAttribute('d', 'M 0 62 L 250 62')
    expect(run).toHaveClass('stroke-accent')
    expect(ahead).toHaveAttribute('d', 'M 250 62 L 1000 62')
    expect(ahead.getAttribute('class')).toContain('color-mix')
  })

  it('draws the session clock apart when it differs', async () => {
    const { StorylineGraph } = await import('../src/components/creator/msel/StorylineGraph')
    const { storylineMap } = await import('../src/lib/storylineMap')
    const draft = {
      phases: [],
      injects: [],
      duration_minutes: 120,
      time_compression: 60,
    } as unknown as Parameters<typeof storylineMap>[0]
    render(
      <StorylineGraph
        map={storylineMap(draft)}
        phases={[]}
        markActions={() => []}
        now={0}
        clock={60}
      />,
    )
    expect(screen.getByTestId('storyline-clock')).toHaveStyle({ left: '50%' })
  })

  it('places the exercise at its latest delivered inject, not the clock', async () => {
    const { storylineProgress } = await import('../src/lib/run')
    const at = (code: string, due: number, state: RunControlInject['state'] = 'pending') =>
      ({ code, kind: 'mandatory', offset_minutes: due, due_minute: due, state }) as RunControlInject
    const started = new Date(Date.UTC(2026, 9, 23, 9, 50)).toISOString()
    const now = Date.UTC(2026, 9, 23, 10, 21)
    const run = (released: string[]) =>
      ({
        started_at: started,
        ended_at: null,
        paused_at: null,
        paused_seconds: 0,
        injects: released.map((code) => ({ code })),
      }) as unknown as RunRead

    expect(storylineProgress({ ...run([]), started_at: null }, [], now)).toBeNull()
    // 31 min in, only the first inject out and the next due at 30: behind.
    expect(
      storylineProgress(run(['INJ-01']), [at('INJ-01', 0, 'released'), at('INJ-02', 30)], now),
    ).toEqual({ point: 0, clock: 31, drift: 1 })
    // The second one out early: ahead.
    expect(
      storylineProgress(
        run(['INJ-01', 'INJ-02']),
        [at('INJ-01', 0, 'released'), at('INJ-02', 50, 'released'), at('INJ-03', 90)],
        now,
      ),
    ).toEqual({ point: 50, clock: 31, drift: -19 })
    // Out on time, the next one still ahead: on schedule.
    expect(
      storylineProgress(run(['INJ-01']), [at('INJ-01', 20, 'released'), at('INJ-02', 60)], now),
    ).toEqual({ point: 20, clock: 31, drift: 0 })
  })
})

describe('Presence and notes', () => {
  it('counts who is present by role and names them on demand', () => {
    render(
      <PresenceBar
        presence={[
          { role: 'player', name: 'Pat Player' },
          { role: 'player', name: 'Sam Player' },
          { role: 'controller', name: null },
        ]}
      />,
    )
    expect(screen.getByText('Player: 2')).toBeInTheDocument()
    expect(screen.getByText('Controller: 1')).toBeInTheDocument()
    expect(screen.getByText('Pat Player')).toBeInTheDocument()
    // A Player sees the team only as a number.
    expect(screen.queryByText('null')).not.toBeInTheDocument()
  })

  it('shares one strip with the rooms, and keeps it for them alone', () => {
    const { rerender } = render(
      <PresenceBar
        presence={[{ role: 'player', name: 'Pat Player' }]}
        aside={<p>You are in Room A</p>}
      />,
    )
    const strip = screen.getByText('Player: 1').closest('details')!.parentElement!
    expect(strip).toContainElement(screen.getByText('You are in Room A'))

    rerender(<PresenceBar presence={[]} aside={<p>You are in Room A</p>} />)
    expect(screen.getByText('You are in Room A')).toBeInTheDocument()
    expect(screen.queryByText('Present')).not.toBeInTheDocument()

    rerender(<PresenceBar presence={[]} />)
    expect(screen.queryByText('You are in Room A')).not.toBeInTheDocument()
    expect(document.querySelector('details')).toBeNull()
  })

  it("gives the Facilitator the phase's key questions and the inject's notes", () => {
    render(
      <FacilitationPanel
        script={{
          phase_code: 'PH-02',
          phase_name: 'Data theft',
          key_questions: ['Who decides?', 'Who tells the regulator?'],
          released_questions: [1],
          covered_questions: [],
          inject_code: 'INJ-02',
          facilitator_notes: 'Push on the 72-hour deadline.',
        }}
        ttxId="ttx-1"
        onChange={() => {}}
      />,
    )
    expect(screen.getByText('Push on the 72-hour deadline.')).toBeInTheDocument()
    expect(screen.getByText('Who tells the regulator?').closest('li')).toHaveTextContent('Asked')
    expect(screen.getByText('Who decides?').closest('li')).not.toHaveTextContent('Asked')
  })

  it('autosaves the note on the inject in play as the role acted as', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const items =
        init?.method === 'PUT'
          ? [{ id: 'n1', inject_code: 'INJ-02', text: 'Call legal', updated_at: '' }]
          : [{ id: 'n0', inject_code: '', text: 'Overall calm', updated_at: '' }]
      return { ok: true, status: 200, json: async () => ({ items, url }) } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    render(
      <NotesPanel
        ttxId="ttx-1"
        role="player"
        run={run()}
        title="My notes"
        description="Only you can read them."
      />,
    )
    expect(await screen.findByDisplayValue('Overall calm')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('On #2'), { target: { value: 'Call legal' } })
    expect(screen.getAllByText('Not saved yet')[0]).toBeInTheDocument()

    await waitFor(
      () =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/run/notes?as=player',
          expect.objectContaining({
            method: 'PUT',
            body: JSON.stringify({ inject_code: 'INJ-02', text: 'Call legal' }),
          }),
        ),
      { timeout: 2000 },
    )
  })
})

describe('Live evaluation', () => {
  const point = (id: string, inject_code: string, changes: Partial<RunPoint> = {}): RunPoint => ({
    id,
    kind: 'expected_action',
    text: `Point ${id}`,
    criteria: { P: '', S: 'Decided after 30 minutes', M: '', U: '' },
    inject_code,
    action_code: `${inject_code}-A1`,
    responsible_role: 'CISO',
    expected_within_minutes: 15,
    action_mark: null,
    action_note: '',
    rating: null,
    ...changes,
  })
  const evaluation = (points: RunPoint[], rated = 0) => ({
    objectives: [
      { id: 'o1', code: 'OBJ-01', title: 'Decide fast', capability: '', statement: '', points },
    ],
    rated,
    total: points.length,
  })

  it('rates the points of the inject in play, with what each level means', async () => {
    const points = [
      point('p1', 'INJ-02', { action_mark: 'partial', action_note: 'Late' }),
      point('p2', 'INJ-01'),
    ]
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const rated = init?.method === 'PUT'
      const body = rated
        ? evaluation(
            [
              {
                ...points[0],
                rating: { level: 'S', rationale: '', inject_code: 'INJ-02', updated_at: '' },
              },
              points[1],
            ],
            1,
          )
        : evaluation(points)
      return { ok: true, status: 200, json: async () => body } as Response
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<EvaluationPanel ttxId="ttx-1" run={run()} />)

    expect(await screen.findByText('Point p1')).toBeInTheDocument()
    // Only the in-play inject's points until asked for all.
    expect(screen.queryByText('Point p2')).not.toBeInTheDocument()
    expect(screen.getByText(/The Controller saw:/)).toHaveTextContent(
      'The Controller saw: Partial — Late',
    )
    expect(screen.getByText('0 of 2 rated')).toBeInTheDocument()

    const s = screen.getByRole('radio', { name: 'S' })
    expect(s).toHaveAttribute('title', 'Decided after 30 minutes')
    expect(screen.getByRole('radio', { name: 'P' })).toHaveAttribute(
      'title',
      'P — Performed without challenges',
    )
    fireEvent.click(s)
    await waitFor(() => expect(screen.getByText('1 of 2 rated')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/ttx-1/run/ratings/p1',
      expect.objectContaining({ body: JSON.stringify({ level: 'S', rationale: '' }) }),
    )

    fireEvent.click(screen.getByRole('button', { name: 'All my points' }))
    expect(screen.getByText('Point p2')).toBeInTheDocument()
  })
})

describe('Closing the session', () => {
  it('sums up the session for the team, with the dated steps after it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          ({
            ok: true,
            status: 200,
            json: async () => ({
              state: 'ended',
              started_at: '2026-11-10T08:30:00Z',
              ended_at: '2026-11-10T11:40:00Z',
              played_minutes: 175,
              stop_reason: '',
              injects: [
                {
                  code: 'INJ-01',
                  title: 'SOC alert',
                  kind: 'mandatory',
                  state: 'released',
                  reason: '',
                },
                {
                  code: 'INJ-02',
                  title: 'Press call',
                  kind: 'mandatory',
                  state: 'skipped',
                  reason: 'Short on time',
                },
              ],
              actions: { observed: 3, partial: 1, not_observed: 1, unmarked: 0 },
              questions_asked: 4,
              questions_covered: 2,
              ratings: [{ name: 'Eva Luator', rated: 5, total: 8 }],
              levels: { P: 1, S: 3, M: 1, U: 0 },
              team_notes: 6,
              milestones: [{ key: 'ratings_due', on: '2026-11-13' }],
            }),
          }) as Response,
      ),
    )
    render(<SessionSummaryPanel ttxId="ttx-1" seq={9} />)

    expect(await screen.findByText('2 h 55 min played')).toBeInTheDocument()
    // Key figures, each with only the non-zero parts of its breakdown.
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('1 skipped')).toBeInTheDocument()
    expect(screen.queryByText(/not reached/)).not.toBeInTheDocument()
    expect(screen.getByText(/Short on time/)).toBeInTheDocument()
    expect(screen.getByText('5/5')).toBeInTheDocument()
    expect(screen.getByText('3 observed · 1 partial · 1 missed')).toBeInTheDocument()
    expect(screen.getByText('2 covered')).toBeInTheDocument()
    expect(screen.getByText('Some challenges')).toBeInTheDocument()
    expect(screen.getByText('5 of 8 rated')).toBeInTheDocument()
    expect(screen.getByText('Rated EEGs due')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Draft after-action report (PDF)' })).toHaveAttribute(
      'href',
      '/api/v1/ttx/ttx-1/run/export/aar.pdf?lang=en',
    )
    expect(screen.getByRole('link', { name: 'Execution log (CSV)' })).toBeInTheDocument()
  })

  it('renders nothing for someone who may not read it', async () => {
    const fetchMock = vi.fn(
      async () =>
        ({
          ok: false,
          status: 403,
          json: async () => ({
            success: false,
            error: { code: 'TTX_ACCESS_DENIED', message: 'No', ttx_id: null },
          }),
        }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<SessionSummaryPanel ttxId="ttx-1" seq={9} />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByText('How the session went')).not.toBeInTheDocument()
  })
})

describe('Decisions and votes', () => {
  afterEach(() => vi.unstubAllGlobals())

  const answer = (body: RunRead) => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => body }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  const decision = (id: string, text: string, mine: boolean) => ({
    id,
    text,
    inject_code: 'INJ-02',
    room_code: null,
    author: mine ? 'Pat Player' : 'Ctrl Ann',
    role: (mine ? 'player' : 'controller') as 'player' | 'controller',
    at: '2026-11-10T09:00:00Z',
    edited: false,
    mine,
  })

  it('lets a Player record a decision and change only their own', async () => {
    const decided = run({
      decisions: [decision('d-1', 'Isolate the host', false), decision('d-2', 'Call legal', true)],
    })
    const fetchMock = answer(decided)
    const onChange = vi.fn()
    render(<DecisionLog ttxId="ttx-1" run={run()} role="player" onChange={onChange} />)
    expect(screen.getByText('No decisions recorded yet.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Record a decision'), {
      target: { value: ' Call legal ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Record' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/decisions?as=player',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ text: 'Call legal', room_code: null }),
        }),
      ),
    )
    expect(onChange).toHaveBeenCalledWith(decided)

    render(<DecisionLog ttxId="ttx-1" run={decided} role="player" onChange={() => {}} />)
    // Newest first; only their own carries the edit and remove buttons.
    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Call legal')
    expect(within(items[0]).getByRole('button', { name: 'Edit the decision' })).toBeEnabled()
    expect(within(items[1]).queryByRole('button', { name: 'Edit the decision' })).toBeNull()
    expect(items[1]).toHaveTextContent('INJ-02')
  })

  it('shows Observers the log read-only, and keeps it open for the hot wash', () => {
    const decided = run({ decisions: [decision('d-1', 'Isolate the host', false)] })
    const { unmount } = render(
      <DecisionLog ttxId="ttx-1" run={decided} role="observer" onChange={() => {}} />,
    )
    expect(screen.getByText('Isolate the host')).toBeInTheDocument()
    expect(screen.queryByLabelText('Record a decision')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Put to a vote' })).toBeNull()
    unmount()
    render(
      <DecisionLog
        ttxId="ttx-1"
        run={{ ...decided, endex_released_at: '2026-11-10T09:30:00Z' }}
        role="controller"
        onChange={() => {}}
      />,
    )
    // After ENDEX the hot wash still records and votes; once ended, no more.
    expect(screen.getByLabelText('Record a decision')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Put to a vote' })).toBeInTheDocument()
    cleanup()
    render(
      <DecisionLog
        ttxId="ttx-1"
        run={{ ...decided, state: 'ended' }}
        role="controller"
        onChange={() => {}}
      />,
    )
    expect(screen.queryByLabelText('Record a decision')).toBeNull()
  })

  const poll = {
    id: 'p-1',
    question: 'Pay the ransom?',
    options: [
      { text: 'Pay', votes: 1 },
      { text: 'Refuse', votes: 2 },
    ],
    inject_code: 'INJ-02',
    room_code: null,
    open: true,
    voters: 3,
    my_vote: 1,
  }

  it('lets a Player vote and shows the tally, never who voted', async () => {
    const fetchMock = answer(run({ polls: [poll] }))
    render(
      <PollCard ttxId="ttx-1" run={run({ polls: [poll] })} role="player" onChange={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Refuse' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 votes')).toBeInTheDocument()
    expect(screen.getByText(/3 have voted/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close the vote' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Pay' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/polls/p-1/vote?as=player',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ option: 0 }) }),
      ),
    )
  })

  it('shows several open votes at once, each voted on its own', async () => {
    const other = {
      ...poll,
      id: 'p-2',
      question: 'Call the police?',
      options: [
        { text: 'Now', votes: 0 },
        { text: 'Later', votes: 0 },
      ],
      voters: 0,
      my_vote: null,
    }
    const fetchMock = answer(run({ polls: [poll, other] }))
    render(
      <PollCard
        ttxId="ttx-1"
        run={run({ polls: [poll, other] })}
        role="player"
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('region', { name: 'Pay the ransom?' })).toBeInTheDocument()
    const second = screen.getByRole('region', { name: 'Call the police?' })
    fireEvent.click(within(second).getByRole('button', { name: 'Later' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/polls/p-2/vote?as=player',
        expect.objectContaining({ method: 'PUT', body: JSON.stringify({ option: 1 }) }),
      ),
    )
  })

  it('lets the Facilitator close a vote, recording the leading option', async () => {
    const fetchMock = answer(run())
    render(
      <PollCard
        ttxId="ttx-1"
        run={run({ polls: [{ ...poll, my_vote: null }] })}
        role="facilitator"
        onChange={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Refuse' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Close the vote' }))
    const dialog = screen.getByRole('dialog', { name: 'Close the vote' })
    expect(within(dialog).getByRole('radio', { name: /Refuse/ })).toBeChecked()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close the vote' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/polls/p-1/close?as=facilitator',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ record_option: 1, outcome_option: null }),
        }),
      ),
    )
  })

  it('asks which option the table settled on when a poll says what follows', async () => {
    const fetchMock = answer(run())
    const withOutcomes = {
      ...poll,
      my_vote: null,
      planned: true,
      results_visible: false,
      options: poll.options.map((option) => ({ ...option, outcome: `After ${option.text}` })),
    }
    render(
      <PollCard
        ttxId="ttx-1"
        run={run({ polls: [withOutcomes] })}
        role="controller"
        onChange={() => {}}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close the vote' }))
    const dialog = screen.getByRole('dialog', { name: 'Close the vote' })
    const choice = within(dialog).getByRole('group', { name: /settle on/ })
    expect(within(choice).getByRole('radio', { name: /Refuse/ })).toBeChecked()
    expect(within(choice).getByText('After Refuse')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close the vote' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/polls/p-1/close?as=controller',
        expect.objectContaining({
          body: JSON.stringify({ record_option: null, outcome_option: 1 }),
        }),
      ),
    )
  })

  it('shows the consequence with the result, and not before', () => {
    const closed = {
      ...poll,
      my_vote: null,
      planned: true,
      open: false,
      outcome_option: 1,
      outcome: 'The data goes public.',
      inject_code: 'INJ-01',
    }
    const card = (polls: (typeof closed)[]) => (
      <PollCard
        ttxId="ttx-1"
        run={run({ polls })}
        role="player"
        inPlayCode="INJ-01"
        onChange={() => {}}
      />
    )
    const { rerender } = render(card([{ ...closed, results_visible: false }]))
    expect(screen.queryByText('The data goes public.')).toBeNull()
    rerender(card([{ ...closed, results_visible: true }]))
    expect(screen.getByText('The data goes public.')).toBeInTheDocument()
  })

  describe('a poll of the MSEL', () => {
    const planned = {
      ...poll,
      my_vote: null,
      planned: true,
      results_visible: false,
    }
    const card = (polls: (typeof planned)[], role: 'player' | 'controller', presenting = false) => (
      <PollCard
        ttxId="ttx-1"
        run={run({ polls })}
        role={role}
        inPlayCode="INJ-02"
        presenting={presenting}
        showCodes={role !== 'player' && !presenting}
        onChange={() => {}}
      />
    )

    it('lets a Player vote without showing the tally', () => {
      const hidden = {
        ...planned,
        options: planned.options.map((o) => ({ ...o, votes: 0 })),
      }
      render(card([hidden], 'player'))
      expect(screen.getByRole('button', { name: /Refuse/ })).toBeInTheDocument()
      expect(screen.getByText(/3 have voted/)).toBeInTheDocument()
      expect(screen.queryByText(/votes?$/)).toBeNull()
      expect(screen.queryByText('INJ-02')).toBeNull()
    })

    it("keeps the tally off the room's screen, for a Controller too", () => {
      render(card([{ ...planned, open: false }], 'controller', true))
      expect(screen.queryByText(/2 votes/)).toBeNull()
      expect(screen.getByText("The result hasn't been shown yet.")).toBeInTheDocument()
    })

    it('shows the team the tally, and the Controller shows it to the Players', async () => {
      const fetchMock = answer(run())
      render(card([{ ...planned, open: false }], 'controller'))
      expect(screen.getByText(/2 votes/)).toBeInTheDocument()
      expect(screen.getByText('Only the team sees this result.')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Show result' }))
      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          '/api/v1/ttx/ttx-1/run/polls/p-1/results?as=controller',
          expect.objectContaining({ method: 'POST', body: JSON.stringify({ shown: true }) }),
        ),
      )
    })

    it('preselects no decision on closing: one would reach the Players', () => {
      render(card([planned], 'controller'))
      fireEvent.click(screen.getByRole('button', { name: 'Close the vote' }))
      const dialog = screen.getByRole('dialog', { name: 'Close the vote' })
      expect(within(dialog).getByRole('radio', { name: "Don't record a decision" })).toBeChecked()
    })

    it('follows the votes while closing, until someone picks', () => {
      const withOutcomes = (votes: number[]) => ({
        ...planned,
        options: planned.options.map((option, index) => ({
          ...option,
          votes: votes[index],
          outcome: `After ${option.text}`,
        })),
      })
      const empty = planned.options.map(() => 0)
      const { rerender } = render(card([withOutcomes(empty)], 'controller'))
      fireEvent.click(screen.getByRole('button', { name: 'Close the vote' }))
      const dialog = screen.getByRole('dialog', { name: 'Close the vote' })
      expect(within(dialog).getByRole('radio', { name: 'No consequence' })).toBeChecked()

      const vote = empty.map((_, index) => (index === 1 ? 1 : 0))
      rerender(card([withOutcomes(vote)], 'controller'))
      const leading = within(dialog).getAllByRole('radio')[1]
      expect(leading).toBeChecked()

      fireEvent.click(within(dialog).getByRole('radio', { name: 'No consequence' }))
      rerender(card([withOutcomes(vote.map((n) => n * 2))], 'controller'))
      expect(within(dialog).getByRole('radio', { name: 'No consequence' })).toBeChecked()
    })

    it('ranks the result once shown, with each share', () => {
      render(card([{ ...planned, open: false, results_visible: true }], 'player'))
      const rows = screen.getAllByRole('listitem').map((row) => row.textContent)
      expect(rows[0]).toContain('Refuse')
      expect(rows[0]).toContain('67%')
      expect(rows[1]).toContain('Pay')
    })

    it('leaves the stage once another inject is in play', () => {
      render(
        <PollCard
          ttxId="ttx-1"
          run={run({ polls: [{ ...planned, open: false }] })}
          role="controller"
          inPlayCode="INJ-03"
          presenting={false}
          showCodes
          onChange={() => {}}
        />,
      )
      expect(screen.queryByText('Pay the ransom?')).toBeNull()
    })
  })

  it('lets the Controller put a question to the vote', async () => {
    const fetchMock = answer(run())
    render(<DecisionLog ttxId="ttx-1" run={run()} role="controller" onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Put to a vote' }))
    const dialog = screen.getByRole('dialog', { name: 'Put a question to the vote' })
    const open = within(dialog).getByRole('button', { name: 'Open the vote' })
    fireEvent.change(within(dialog).getByLabelText('Question'), {
      target: { value: 'Notify the regulator?' },
    })
    fireEvent.change(within(dialog).getByLabelText('Option 1'), { target: { value: 'Now' } })
    expect(open).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Option 2'), { target: { value: 'Later' } })
    fireEvent.click(open)
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/ttx/ttx-1/run/polls?as=controller',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            question: 'Notify the regulator?',
            options: ['Now', 'Later'],
            room_code: null,
          }),
        }),
      ),
    )
  })
})
