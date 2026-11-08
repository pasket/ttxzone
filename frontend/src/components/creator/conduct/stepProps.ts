import type { ConductPrepDraft } from '../../../lib/conductPrep'
import type { ConductPrep, ValidationReport } from '../../../lib/types'

/** What every step of Creator -> Session plan gets from the page. */
export interface StepProps {
  prep: ConductPrep
  draft: ConductPrepDraft
  update: (patch: Partial<ConductPrepDraft>) => void
  /** Take a row out of the draft with an Undo toast (autosave waits). */
  removeRow: (
    message: string,
    without: (draft: ConductPrepDraft) => ConductPrepDraft,
    restore: (draft: ConductPrepDraft) => ConductPrepDraft,
  ) => void
  /** The live report flags this field (of this row) on the current step. */
  isInvalid: (field: string, itemId?: string | null) => boolean
  report: ValidationReport
  readOnly: boolean
  ttxId: string
  /** Why the session documents can't be downloaded now, if they can't. */
  downloadsBlocked: string | null
}
