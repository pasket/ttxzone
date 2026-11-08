import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useStageRoom } from '../../hooks/useViewedRoom'
import { apiFetch } from '../../lib/api'
import { phaseQuestions } from '../../lib/run'
import type { RunFacilitation, RunRead, RunRooms } from '../../lib/types'
import { FormattedText } from '../common/FormattedText'
import { Panel } from '../common/Panel'
import { CoveredToggle } from './InPlayPanel'

/** The Facilitator's script for the phase in play: its key questions
 * (the ones the Controller put to the table marked) and the facilitator
 * notes of the inject in play. The Facilitator marks the questions put
 * to the table as discussed. */
export function FacilitationPanel({
  ttxId,
  script,
  rooms,
  onChange,
}: {
  ttxId: string
  script: RunFacilitation
  rooms?: RunRooms | null
  onChange: (next: RunRead) => void
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const where = useStageRoom(rooms)
  const { asked, covered } = phaseQuestions(script, where)

  async function toggle(position: number) {
    setBusy(true)
    try {
      onChange(
        await apiFetch<RunRead>(`/ttx/${ttxId}/run/questions/covered`, {
          method: 'POST',
          body: JSON.stringify({
            phase_code: script.phase_code,
            position,
            covered: !covered.has(position),
            room_code: where ?? undefined,
          }),
        }),
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Panel title={t('playground.facilitation.title')} meta={script.phase_name}>
      <div className="space-y-4">
        {script.key_questions.length > 0 && (
          <section aria-label={t('playground.control.keyQuestions')} className="space-y-1">
            <h3 className="text-sm font-semibold">{t('playground.control.keyQuestions')}</h3>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {script.key_questions.map((question, index) => (
                <li key={index}>
                  {question}
                  {asked.has(index) && (
                    <span className="ml-2 text-xs text-success-fg">
                      ✓ {t('playground.control.asked')}
                    </span>
                  )}
                  {asked.has(index) && (
                    <div>
                      <CoveredToggle
                        covered={covered.has(index)}
                        disabled={busy}
                        onToggle={() => void toggle(index)}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
        {script.facilitator_notes && (
          <section aria-label={t('playground.facilitation.notes')} className="space-y-1">
            <h3 className="text-sm font-semibold">
              {t('playground.facilitation.notes')}{' '}
              <span translate="no" className="font-mono font-normal">
                {script.inject_code}
              </span>
            </h3>
            <FormattedText text={script.facilitator_notes} className="text-sm" />
          </section>
        )}
      </div>
    </Panel>
  )
}
