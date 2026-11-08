import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useRunFeed } from '../src/hooks/useRunFeed'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  url: string
  listeners: Record<string, (() => void)[]> = {}
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  addEventListener(type: string, listener: () => void) {
    ;(this.listeners[type] ??= []).push(listener)
  }
  ring() {
    this.listeners.change?.forEach((listener) => listener())
  }
  close() {
    this.closed = true
  }
}

const view = (seq: number) => ({ state: 'live', seq, cursor: `${seq}.x`, presence: [] })

describe('useRunFeed', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    FakeEventSource.instances = []
  })

  it('opens the stream as the role and fetches whenever it rings', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    let seq = 1
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => view(seq) }) as Response,
    )
    vi.stubGlobal('fetch', fetchMock)
    const { result } = renderHook(() => useRunFeed('ttx-1', 'player'))

    await waitFor(() => expect(result.current.run?.seq).toBe(1))
    const source = FakeEventSource.instances[0]
    expect(source.url).toBe('/api/v1/ttx/ttx-1/run/stream?as=player')

    act(() => source.onopen?.())
    seq = 2
    act(() => source.ring())
    await waitFor(() => expect(result.current.run?.seq).toBe(2))
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/v1/ttx/ttx-1/run?as=player&since=1.x',
      expect.anything(),
    )
  })

  it('falls back to polling when the stream keeps failing', async () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, json: async () => view(1) }) as Response),
    )
    const { unmount } = renderHook(() => useRunFeed('ttx-1', null))
    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1))
    const source = FakeEventSource.instances[0]
    act(() => {
      source.onerror?.()
      source.onerror?.()
      source.onerror?.()
    })
    expect(source.closed).toBe(true)
    unmount()
  })
})
