import { useTranslation } from 'react-i18next'

import { useActingRole } from '../../hooks/useActingRole'
import { useAuth } from '../../hooks/useAuth'
import type { RunRead } from '../../lib/types'
import { DecisionLog } from './DecisionLog'
import { MetersPanel } from './MetersPanel'
import { EvaluationPanel } from './EvaluationPanel'
import { FacilitationPanel } from './FacilitationPanel'
import { FeedbackForm } from './FeedbackForm'
import { NotesPanel } from './NotesPanel'
import { PlaygroundPage } from './PlaygroundPage'
import { SessionSummaryPanel } from './SessionSummaryPanel'

const AT_THE_TABLE = ['player', 'facilitator', 'observer', 'evaluator'] as const
type TableRole = (typeof AT_THE_TABLE)[number]

const ROLE_NOTES = {
  player: 'execution.landing.player',
  facilitator: 'execution.landing.facilitator',
  observer: 'execution.landing.observer',
  evaluator: 'execution.landing.evaluator',
} as const

/** Playground -> Playground: the live session for the table. Players,
 * Facilitators, Observers and Evaluators all see the same Playground; the
 * docked panel is their own, headed by who they take part as (and what
 * that means at the table): the Facilitator's script, and their notes (a Player's private, the rest for the team). */
export function PlayerLandingSection() {
  const { t } = useTranslation()
  const { activeTtx } = useAuth()
  const acting = useActingRole('playground')
  const role = AT_THE_TABLE.find((r) => r === acting) ?? null
  if (!activeTtx) return null

  const dock = (run: RunRead, apply: (next: RunRead) => void) =>
    role && (
      <div className="space-y-4">
        {(run.state === 'ended' || run.state === 'stopped') && (
          <FeedbackForm ttxId={activeTtx.id} role={role} />
        )}
        {role === 'facilitator' && run.facilitation && (
          <FacilitationPanel
            ttxId={activeTtx.id}
            script={run.facilitation}
            rooms={run.rooms}
            onChange={apply}
          />
        )}
        {role === 'evaluator' && <EvaluationPanel ttxId={activeTtx.id} run={run} />}
        {/* The Lead Evaluator's (the panel shows only to who may read it). */}
        {role === 'evaluator' && (run.state === 'ended' || run.state === 'stopped') && (
          <SessionSummaryPanel ttxId={activeTtx.id} seq={run.seq} />
        )}
        {run.state !== 'not_started' && (
          <DecisionLog ttxId={activeTtx.id} run={run} role={role} onChange={apply} />
        )}
        <MetersPanel ttxId={activeTtx.id} run={run} role={role} onChange={apply} />
        <NotesPanel
          ttxId={activeTtx.id}
          role={role}
          run={run}
          title={t(role === 'player' ? 'playground.notes.mine' : 'playground.notes.title')}
          description={t(notesHint(role))}
        />
      </div>
    )

  return (
    <PlaygroundPage
      ttxId={activeTtx.id}
      role={role}
      dock={dock}
      dockNote={role ? { id: ROLE_NOTES[role], text: t(ROLE_NOTES[role]) } : undefined}
    />
  )
}

function notesHint(role: TableRole) {
  return role === 'player' ? 'playground.notes.privateHint' : 'playground.notes.teamHint'
}
