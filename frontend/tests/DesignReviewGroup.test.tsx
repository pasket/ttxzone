import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DesignReviewGroup } from '../src/components/creator/msel/DesignReviewGroup'
import type { DesignReview } from '../src/lib/types'
import { render } from './testUtils'

function respond(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const REVIEW: DesignReview = {
  has_msel: true,
  has_session_plan: false,
  objectives: [],
  gaps: [
    { kind: 'objective_without_inject', code: 'OBJ-02', title: 'Notify the regulator' },
    { kind: 'phase_without_inject', code: 'PH-04', title: 'Aftermath' },
  ],
  pace: {
    duration_minutes: 180,
    injects: 9,
    timed_injects: 8,
    contingent_injects: 1,
    phases: [],
    quiet_stretches: [{ from_minute: 120, to_minute: 180, after: 'INJ-09', before: null }],
    quiet_threshold_minutes: 36,
  },
  recipients: [],
  formats: { inject: 9 },
  delivery_methods: { email: 9 },
  with_artifact: 0,
  threat_actors: [
    {
      code: 'TA-01',
      name: 'Sandworm Team',
      techniques: 12,
      used: 2,
      injects: 3,
      unused: ['T1486'],
    },
  ],
}

describe('DesignReviewGroup', () => {
  it('names what the chain lacks by code, the quiet stretches and the unused techniques', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(REVIEW))
    vi.stubGlobal('fetch', fetchMock)

    render(<DesignReviewGroup ttxId="t1" />)

    expect(await screen.findByText('Objectives no inject tests')).toBeInTheDocument()
    expect(screen.getByText('OBJ-02')).toBeInTheDocument()
    expect(screen.getByText('Phases without injects')).toBeInTheDocument()
    expect(screen.getByText('PH-04')).toBeInTheDocument()
    expect(screen.getByText(/isn’t open yet/)).toBeInTheDocument()
    expect(screen.getByText('Minute 120 to 180: 60 minutes')).toBeInTheDocument()
    expect(screen.getByText(/2 of 12 techniques used by its injects/)).toBeInTheDocument()
    expect(screen.getByText('T1486')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/ttx\/t1\/design-review$/)
  })

  it('says so when nothing is missing, and shows nothing when it can’t be read', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          respond({ ...REVIEW, gaps: [], has_session_plan: true, threat_actors: [], pace: null }),
        ),
    )
    const { unmount } = render(<DesignReviewGroup ttxId="t1" />)
    expect(await screen.findByText(/Every need has an objective/)).toBeInTheDocument()
    expect(screen.getByText('No long stretch without a timed inject.')).toBeInTheDocument()
    unmount()

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    render(<DesignReviewGroup ttxId="t2" />)
    await vi.waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument())
    expect(screen.queryByText('The chain')).not.toBeInTheDocument()
  })
})
