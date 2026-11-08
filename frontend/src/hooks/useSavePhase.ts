import { useTranslation } from 'react-i18next'

import { formatSpan, savePhaseEdit, type MselDraft, type PhaseDraft } from '../lib/msel'
import { useToast } from './useToast'

/** Saves a phase edited in its dialog -- from the Phases tab or the
 * storyline map alike -- into the MSEL draft, saying in a toast when session
 * left between phases became scenario time. */
export function useSavePhase(
  draft: MselDraft,
  update: (patch: Partial<MselDraft>) => void,
): (phase: PhaseDraft, pushLater: boolean) => void {
  const { t } = useTranslation()
  const { showToast } = useToast()
  return (phase, pushLater) => {
    const { draft: next, closed } = savePhaseEdit(draft, phase, pushLater)
    update({ phases: next.phases, injects: next.injects })
    if (closed.length > 0) {
      const minutes = closed.reduce((total, gap) => total + gap.minutes, 0)
      showToast(
        t('creator.msel.gaps.closed', {
          session: formatSpan(minutes),
          scenario: formatSpan(minutes * draft.time_compression),
        }),
      )
    }
  }
}
