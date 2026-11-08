import { describe, expect, it } from 'vitest'

import { emptyInjectFields, templateTexts, toExerciseInject } from '../src/lib/injectLibrary'

const poll = {
  ...emptyInjectFields('en'),
  title: 'Pay or not',
  format: 'poll' as const,
  poll_question: 'Does {organization} pay?',
  poll_options: ['Pay {amount}', 'Refuse'],
  poll_outcomes: ['They come back.', ''],
}

describe('a poll in the library', () => {
  it('counts its texts when looking for variables', () => {
    expect(templateTexts(poll)).toContain('Pay {amount}')
  })

  it('reaches the exercise with its variables filled in', () => {
    const copy = toExerciseInject(
      poll,
      { phaseId: 'p', objectiveIds: [], offset: 10 },
      { organization: 'Acme', amount: '5 BTC' },
      60,
      'Key question',
    )
    expect(copy.format).toBe('poll')
    expect(copy.poll_question).toBe('Does Acme pay?')
    expect(copy.poll_options).toEqual(['Pay 5 BTC', 'Refuse'])
    expect(copy.poll_outcomes).toEqual(['They come back.', ''])
  })
})
