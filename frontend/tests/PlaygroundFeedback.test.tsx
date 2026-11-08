import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FeedbackForm } from '../src/components/playground/FeedbackForm'
import { FeedbackResults } from '../src/components/playground/FeedbackResults'
import { render } from './testUtils'

const form = {
  available: true,
  submitted: false,
  intro: 'Rate each statement.',
  statements: [
    { key: 'objectives_clear', text: 'The objectives of the exercise were clear.' },
    { key: 'OBJ-01', text: 'We met this objective: OBJ-01 | Decide fast' },
  ],
  open_questions: [{ key: 'strengths', text: 'Strengths you observed' }],
}

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response

describe('The feedback form', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends the answers once, anonymously, as the role acted as', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? json(undefined, 204) : json(form),
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<FeedbackForm ttxId="ttx-1" role="player" />)

    expect(await screen.findByText(/Your answers are anonymous/)).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('radio', { name: '4' })[0])
    fireEvent.change(screen.getByLabelText('Strengths you observed'), {
      target: { value: 'Calm under pressure' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send my answers' }))

    expect(await screen.findByText(/your answers have been sent/)).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/ttx/ttx-1/run/feedback?as=player',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          scores: { objectives_clear: 4 },
          answers: { strengths: 'Calm under pressure' },
        }),
      }),
    )
  })

  it("isn't shown before the session is over", async () => {
    const fetchMock = vi.fn(async () => json({ ...form, available: false }))
    vi.stubGlobal('fetch', fetchMock)
    render(<FeedbackForm ttxId="ttx-1" role="player" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    expect(screen.queryByText('Feedback form')).not.toBeInTheDocument()
  })
})

describe('The feedback results', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows only the count under the minimum, then the averages and answers', async () => {
    const results = {
      responses: 2,
      players: 2,
      team: 0,
      minimum: 3,
      shown: false,
      statements: [],
      answers: {},
      open_questions: [{ key: 'strengths', text: 'Strengths you observed' }],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => json(results)),
    )
    const { unmount } = render(<FeedbackResults ttxId="ttx-1" seq={1} />)
    expect(await screen.findByText('2 answers (2 Players, 0 team)')).toBeInTheDocument()
    expect(screen.getByText(/at least 3/)).toBeInTheDocument()
    unmount()

    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        json({
          ...results,
          responses: 3,
          players: 3,
          shown: true,
          statements: [
            {
              key: 'objectives_clear',
              text: 'The objectives were clear.',
              n: 3,
              average: 3.33,
              distribution: [0, 0, 2, 1, 0],
            },
          ],
          answers: { strengths: ['Calm', 'Fast'] },
        }),
      ),
    )
    render(<FeedbackResults ttxId="ttx-1" seq={2} />)
    expect(await screen.findByText('3.3 · n=3')).toBeInTheDocument()
    expect(screen.getByText('Calm')).toBeInTheDocument()
  })
})
