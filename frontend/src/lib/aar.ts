import type { TFunction } from 'i18next'

import type { AarRunOption, ImprovementAction, ImprovementStatus } from './types'

/** An improvement action's states, in their usual order. */
export const IMPROVEMENT_STATUSES: ImprovementStatus[] = [
  'open',
  'in_progress',
  'done',
  'cancelled',
]

export function emptyAction(): ImprovementAction {
  return {
    id: null,
    code: '',
    objective_code: null,
    finding: '',
    action: '',
    owner: '',
    owner_area: '',
    due_date: null,
    status: 'open',
    status_note: '',
    overdue: false,
  }
}

/** "Session 2 (current), 27 Oct 2026": a session a report is written from. */
export function runLabel(t: TFunction, dateFmt: Intl.DateTimeFormat, run: AarRunOption): string {
  return t(run.current ? 'aar.preview.runCurrent' : 'aar.preview.runArchived', {
    number: run.number,
    date: dateFmt.format(new Date(run.started_at)),
  })
}
