import { describe, expect, it } from 'vitest'

import { exerciseOf } from '../src/lib/platformActivity'
import type { PlatformAuditEvent } from '../src/lib/types'

const event = (changes: Partial<PlatformAuditEvent>): PlatformAuditEvent => ({
  id: 'e1',
  created_at: '2026-11-17T10:00:00Z',
  action: 'exercise.member_joined',
  actor_user_id: 'u1',
  actor_label: 'ada@acme.com',
  target_kind: 'exercise',
  target_id: 't1',
  target_label: 'TTX-2026-09 Ransomware drill',
  details: null,
  ...changes,
})

describe('the exercise of an activity entry', () => {
  it('comes from the entry, code and name apart', () => {
    expect(
      exerciseOf(event({ details: { exercise_code: 'TTX-2026-09', exercise_name: 'Drill 2' } })),
    ).toEqual({ code: 'TTX-2026-09', name: 'Drill 2' })
  })

  it('is read from the label of entries recorded before that', () => {
    expect(exerciseOf(event({}))).toEqual({ code: 'TTX-2026-09', name: 'Ransomware drill' })
    expect(exerciseOf(event({ target_label: 'TTX-2026-10 · Phishing' }))).toEqual({
      code: 'TTX-2026-10',
      name: 'Phishing',
    })
  })

  it('is nothing for another kind of entry, or a label that reads otherwise', () => {
    expect(exerciseOf(event({ target_kind: 'organization', target_label: 'Acme' }))).toBeNull()
    expect(exerciseOf(event({ target_label: 'Ransomware drill' }))).toBeNull()
  })
})
