import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

import { ExerciseRoomsPanel } from '../src/components/creator/ExerciseRoomsPanel'
import type { RoomsRead, TTXRead } from '../src/lib/types'
import { render } from './testUtils'

const drill = { id: 'ttx-1', name: 'Ransomware drill' } as TTXRead

function json(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response
}

function stubApi(routes: Record<string, Response[]>) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${url.replace('/api/v1', '').split('?')[0]}`
    const queue = routes[key]
    if (!queue?.length) throw new Error(`Unexpected request: ${key}`)
    return queue.length > 1 ? queue.shift()! : queue[0]
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const off: RoomsRead = { uses_rooms: false, structure_locked: false, rooms: [], players: [] }

function player(id: string, name: string, room_id: string | null = null) {
  return {
    user_id: id,
    email: `${id}@acme.com`,
    full_name: name,
    last_login_at: null,
    joined_at: '2026-09-01T00:00:00+00:00',
    room_id,
  }
}

const on: RoomsRead = {
  uses_rooms: true,
  structure_locked: false,
  rooms: [
    { id: 'r1', code: 'RM-01', name: 'Blue', description: 'Technical team', player_count: 1 },
    { id: 'r2', code: 'RM-02', name: 'Red', description: '', player_count: 0 },
  ],
  players: [player('ana', 'Ana Ruiz', 'r1'), player('luis', 'Luis Gil')],
}

function renderPanel() {
  render(
    <MemoryRouter>
      <ExerciseRoomsPanel ttx={drill} />
    </MemoryRouter>,
  )
}

describe('ExerciseRoomsPanel', () => {
  it('is one switch and a line while the exercise has no rooms', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/rooms': [json(200, off), json(200, on)],
      'PUT /ttx/ttx-1/rooms/settings': [json(200, on)],
    })
    renderPanel()

    const toggle = await screen.findByRole('switch', { name: 'This exercise uses rooms' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.queryByText('Main room')).not.toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    fireEvent.click(toggle)
    expect(await screen.findByText('Main room')).toBeInTheDocument()
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({ uses_rooms: true })
    expect(screen.getByText('2 rooms · 2 Players')).toBeInTheDocument()
  })

  it('seats a Player from their row and several at once from the selection', async () => {
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/rooms': [json(200, on)],
      'PUT /ttx/ttx-1/rooms/assignments': [json(200, on)],
    })
    renderPanel()

    const select = await screen.findByRole('combobox', { name: 'Room of Luis Gil' })
    expect(select).toHaveValue('')
    fireEvent.change(select, { target: { value: 'r2' } })
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    )
    const single = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(single[1]!.body as string)).toEqual({
      assignments: [{ user_id: 'luis', room_id: 'r2' }],
    })

    fireEvent.click(screen.getByRole('checkbox', { name: 'Select every Player shown' }))
    const bulk = within(screen.getByRole('group', { name: 'Seat the selected Players' }))
    expect(bulk.getByText('2 selected')).toBeInTheDocument()
    fireEvent.change(bulk.getByRole('combobox'), { target: { value: 'r1' } })
    fireEvent.click(bulk.getByRole('button', { name: 'Seat here' }))
    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(2),
    )
    const many = fetchMock.mock.calls.filter(([, init]) => init?.method === 'PUT')[1]
    expect(JSON.parse(many[1]!.body as string)).toEqual({
      assignments: [
        { user_id: 'ana', room_id: 'r1' },
        { user_id: 'luis', room_id: 'r1' },
      ],
    })
  })

  it('gives a team member the room their view opens on', async () => {
    const withTeam: RoomsRead = {
      ...on,
      team: [
        {
          user_id: 'olga',
          email: 'olga@acme.com',
          full_name: 'Olga Ortiz',
          roles: ['controller', 'evaluator'],
          room_id: null,
        },
      ],
    }
    const fetchMock = stubApi({
      'GET /ttx/ttx-1/rooms': [json(200, withTeam)],
      'PUT /ttx/ttx-1/rooms/assignments': [json(200, withTeam)],
    })
    renderPanel()

    const select = await screen.findByRole('combobox', {
      name: 'Room Olga Ortiz opens the session on',
    })
    expect(screen.getByText('Controller · Evaluator')).toBeInTheDocument()
    fireEvent.change(select, { target: { value: 'r2' } })
    await waitFor(() =>
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(true),
    )
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')!
    expect(JSON.parse(call[1]!.body as string)).toEqual({
      assignments: [{ user_id: 'olga', room_id: 'r2' }],
    })
  })

  it('filters the Players without a room', async () => {
    stubApi({ 'GET /ttx/ttx-1/rooms': [json(200, on)] })
    renderPanel()

    fireEvent.click(await screen.findByRole('radio', { name: 'Without a room (1)' }))
    expect(screen.queryByText('Ana Ruiz')).not.toBeInTheDocument()
    expect(screen.getByText('Luis Gil')).toBeInTheDocument()
  })

  it('locks adding, removing and the switch once the MSEL is ready', async () => {
    stubApi({ 'GET /ttx/ttx-1/rooms': [json(200, { ...on, structure_locked: true })] })
    renderPanel()

    expect(await screen.findByRole('switch')).toBeDisabled()
    expect(screen.getByRole('button', { name: /Add room/ })).toBeDisabled()
    expect(
      screen.getAllByRole('button', { name: "Rooms can't be removed while the MSEL is ready" }),
    ).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Edit Blue' })).toBeEnabled()
    expect(screen.getByRole('combobox', { name: 'Room of Ana Ruiz' })).toBeEnabled()
  })
})
