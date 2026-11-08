import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ControlCenterPanel } from '../src/components/playground/ControlCenterPanel'
import { RoomBar, RoomStage } from '../src/components/playground/RoomStage'
import { inPlayAt, phaseQuestions } from '../src/lib/run'
import type { RunInject, RunRead, RunRooms } from '../src/lib/types'
import { render } from './testUtils'

const inject = (code: string, title: string, room_codes: string[] = []): RunInject => ({
  code,
  title,
  content: `${title}. Literal text.`,
  phase_code: 'PH-01',
  delivery_method: 'email',
  sender: null,
  recipients: [],
  attachment_notes: [],
  images: [],
  scenario_minute: 0,
  released_at: '2026-11-10T08:40:00Z',
  questions: [],
  room_codes,
})

const blue = inject('INJ-01', 'EDR alert', ['RM-01'])
const red = inject('INJ-02', 'Press call', ['RM-02'])
const both = inject('INJ-03', 'CEO statement')

const teamRooms: RunRooms = {
  rooms: [
    { code: 'RM-01', name: 'Blue', players: 3, in_main: 1 },
    { code: 'RM-02', name: 'Red', players: 2, in_main: 0 },
  ],
  main_projected: 'INJ-02',
  main_history: ['INJ-02'],
  in_main: 2,
}

const run = (changes: Partial<RunRead> = {}): RunRead => ({
  state: 'live',
  seq: 3,
  cursor: '3.abc',
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
  phases: [{ code: 'PH-01', number: 1, state: 'current', name: 'Detection', headline: null }],
  current_phase_code: 'PH-01',
  injects: [blue, red, both],
  can_control: false,
  msel_ready: true,
  plan_ready: true,
  control: null,
  presence: [],
  facilitation: null,
  rooms: teamRooms,
  ...changes,
})

function Stage({ value }: { value: RunRead }) {
  return (
    <>
      <RoomBar run={value} />
      <RoomStage ttxId="ttx-1" run={value} />
    </>
  )
}

describe('Playground in rooms', () => {
  it('shows a Player their room, with the main room folded below', () => {
    const player = run({
      injects: [blue, red, both],
      rooms: {
        ...teamRooms,
        rooms: [teamRooms.rooms[0]],
        me: { room_code: 'RM-01', room_name: 'Blue', location: 'room' },
      },
    })
    render(<Stage value={player} />)
    expect(screen.getByText('You’re in Blue (RM-01)')).toBeInTheDocument()
    // The room's injects: the latest in play; nothing to choose.
    expect(screen.getByText('CEO statement. Literal text.')).toBeVisible()
    expect(screen.queryByRole('radiogroup')).toBeNull()
    const main = screen.getByText('Main room · 1 inject projected').closest('details')!
    expect(main).not.toHaveAttribute('open')
    expect(within(main).getByText('Press call')).toBeInTheDocument()
    // Numbered in the story the Player lives, the same wherever it shows:
    // their room's injects and the main room's screen, with no gaps.
    expect(within(main).getByText('#2')).toBeInTheDocument()
  })

  it('shows a Player brought to the main room what is on its screen', () => {
    const player = run({
      rooms: {
        ...teamRooms,
        rooms: [teamRooms.rooms[0]],
        me: { room_code: 'RM-01', room_name: 'Blue', location: 'main' },
      },
    })
    render(<Stage value={player} />)
    expect(screen.getByText('You’re in Main room')).toBeInTheDocument()
    expect(screen.getByText('The Controller brought you here.')).toBeInTheDocument()
    expect(screen.getByText('Press call. Literal text.')).toBeVisible()
    expect(screen.getByText('On the main room’s screen')).toBeInTheDocument()
  })

  it('says when nothing is on the main room’s screen', () => {
    render(
      <Stage
        value={run({
          rooms: {
            ...teamRooms,
            main_projected: null,
            me: { room_code: null, room_name: null, location: 'main' },
          },
        })}
      />,
    )
    expect(
      screen.getByText('You have no room yet, so you follow the main room.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Nothing on screen. Wait for the Controller.')).toBeInTheDocument()
  })

  it('lets the team look at any room as its Players see it', () => {
    render(<Stage value={run()} />)
    const rooms = screen.getByRole('radiogroup', { name: 'View' })
    // The first room by default.
    expect(within(rooms).getByRole('radio', { name: /Blue \(RM-01\)/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByText('CEO statement. Literal text.')).toBeVisible()
    expect(screen.queryByText('Press call')).toBeNull()

    fireEvent.click(within(rooms).getByRole('radio', { name: /Red \(RM-02\)/ }))
    expect(screen.queryByText('EDR alert')).toBeNull()
    expect(screen.getByText('CEO statement. Literal text.')).toBeVisible()

    fireEvent.click(within(rooms).getByRole('radio', { name: /Main room/ }))
    expect(screen.getByText('Press call. Literal text.')).toBeVisible()
    expect(screen.getByText('On the main room’s screen')).toBeInTheDocument()
  })

  it('opens a team member on their default room', () => {
    render(<Stage value={run({ rooms: { ...teamRooms, default_room_code: 'RM-02' } })} />)
    const rooms = screen.getByRole('radiogroup', { name: 'View' })
    expect(within(rooms).getByRole('radio', { name: /Red \(RM-02\)/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.queryByText('EDR alert')).toBeNull()
  })

  it('shows nothing about rooms at one table', () => {
    render(<Stage value={run({ rooms: null })} />)
    expect(screen.queryByRole('radiogroup')).toBeNull()
    expect(screen.queryByText(/Main room/)).toBeNull()
  })
})

describe('Control center in rooms', () => {
  const controlled = () =>
    run({
      can_control: true,
      rooms: {
        ...teamRooms,
        players: [
          { user_id: 'ana', name: 'Ana Ruiz', room_code: 'RM-01', location: 'main' },
          { user_id: 'bo', name: 'Bo Blue', room_code: 'RM-01', location: 'room' },
          { user_id: 'una', name: 'Una Seat', room_code: null, location: 'main' },
        ],
      },
      control: {
        phases: [
          {
            code: 'PH-01',
            name: 'Detection',
            start_offset: 0,
            end_offset: 30,
            key_questions: [],
            released_questions: [],
            covered_questions: [],
          },
        ],
        injects: (['INJ-01', 'INJ-02', 'INJ-03'] as const).map((code, index) => ({
          code,
          title: ['EDR alert', 'Press call', 'CEO statement'][index],
          kind: 'mandatory' as const,
          phase_code: 'PH-01',
          offset_minutes: index * 5,
          due_minute: index * 5,
          state: 'released' as const,
          reason: '',
          trigger_condition: '',
          contingent_purpose: '',
          branch_action_code: null,
          suggested: false,
          expected_actions: [],
          room_codes: [['RM-01'], ['RM-02'], []][index],
        })),
        msel: { injects: [], phases: [], actors: [] } as unknown as NonNullable<
          RunRead['control']
        >['msel'],
      },
    })
  const answering = () => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => controlled() }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }
  const body = (fetchMock: ReturnType<typeof answering>, index = 0) =>
    JSON.parse((fetchMock.mock.calls[index] as unknown as [string, RequestInit])[1].body as string)

  it('moves everyone, a room or one Player', async () => {
    const fetchMock = answering()
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)
    const panel = within(screen.getByRole('region', { name: 'Rooms' }))
    expect(panel.getByText('2 in the room · 1 in the main room')).toBeInTheDocument()
    expect(
      panel.getByText('1 Player has no room, so is always in the main room.'),
    ).toBeInTheDocument()

    fireEvent.click(panel.getByRole('button', { name: 'Everyone to the main room' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/v1/ttx/ttx-1/run/players/move',
      expect.objectContaining({ method: 'POST' }),
    ])
    expect(body(fetchMock)).toEqual({ to: 'main' })

    fireEvent.click(
      panel.getByRole('button', { name: 'Send the Players of Blue back to their room' }),
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(body(fetchMock, 1)).toEqual({ to: 'room', room_code: 'RM-01' })

    fireEvent.click(panel.getByRole('button', { name: 'Send Ana Ruiz back to their room' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(body(fetchMock, 2)).toEqual({ to: 'room', user_ids: ['ana'] })
  })

  it('projects a delivered inject in the main room, and stops it', async () => {
    const fetchMock = answering()
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)
    expect(screen.getByText('On screen')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Project INJ-03 in the main room' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(body(fetchMock)).toEqual({ code: 'INJ-03' })

    fireEvent.click(screen.getByRole('button', { name: 'Stop projecting' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(body(fetchMock, 1)).toEqual({ code: null })
  })

  it('seats a Player who has no room', async () => {
    const fetchMock = answering()
    render(<ControlCenterPanel ttxId="ttx-1" run={controlled()} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Seat' }))
    const dialog = within(screen.getByRole('dialog'))
    fireEvent.change(dialog.getByLabelText('Una Seat'), { target: { value: 'RM-02' } })
    fireEvent.click(dialog.getByRole('button', { name: 'Seat' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock.mock.calls[0]).toEqual([
      '/api/v1/ttx/ttx-1/run/seats',
      expect.objectContaining({ method: 'PUT' }),
    ])
    expect(body(fetchMock)).toEqual({ assignments: [{ user_id: 'una', room_code: 'RM-02' }] })
  })
})

describe('Each place on its own', () => {
  const question = (text: string, room_code: string) => ({ text, covered: false, room_code })
  const asked = {
    ...both,
    questions: [question('Who decides?', 'RM-01'), question('Who speaks?', 'RM-02')],
  }

  it('shows the key questions put in the room in view', () => {
    render(<Stage value={run({ injects: [asked], rooms: teamRooms })} />)
    expect(screen.getByText('Who decides?')).toBeInTheDocument()
    expect(screen.queryByText('Who speaks?')).toBeNull()
  })

  it("reads and marks a phase's questions per place", () => {
    const phase = {
      released_questions: [],
      covered_questions: [],
      question_places: [{ room_code: 'RM-01', released_questions: [0, 1], covered_questions: [1] }],
    }
    expect(phaseQuestions(phase, 'RM-01').asked).toEqual(new Set([0, 1]))
    expect(phaseQuestions(phase, 'RM-01').covered).toEqual(new Set([1]))
    expect(phaseQuestions(phase, 'RM-02').asked).toEqual(new Set())
    expect(phaseQuestions({ released_questions: [2], covered_questions: [] }, null).asked).toEqual(
      new Set([2]),
    )
  })

  it('takes the inject in play in each place, not the last one out', () => {
    const value = run({ injects: [blue, red], rooms: teamRooms })
    expect(inPlayAt(value, 'RM-01')?.code).toBe('INJ-01')
    expect(inPlayAt(value, 'RM-02')?.code).toBe('INJ-02')
    const empty = { ...teamRooms, main_history: [], main_projected: null }
    expect(inPlayAt(run({ injects: [blue, red], rooms: empty }), 'main')).toBeUndefined()
    const projected = { ...teamRooms, main_history: ['INJ-01', 'INJ-02'], main_projected: 'INJ-01' }
    expect(inPlayAt(run({ injects: [blue, red], rooms: projected }), 'main')?.code).toBe('INJ-01')
    expect(inPlayAt(run({ injects: [blue, red], rooms: null }), null)?.code).toBe('INJ-02')
  })
})
