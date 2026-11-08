import type { ReactNode } from 'react'

import type { NeedsFormDraft } from '../../../lib/needsForm'
import type { NeedsForm, NeedsRenumberKind, RegulatoryCatalog } from '../../../lib/types'

/** What every editable step receives from CreatorNeedsFormSection. */
export interface StepProps {
  form: NeedsForm
  draft: NeedsFormDraft
  update: (patch: Partial<NeedsFormDraft>) => void
  /** Removes a row with an Undo toast (see useUndoableRowRemoval). */
  removeRow: (field: 'needs' | 'objectives' | 'risks', key: string, message: string) => void
  /** Whether the saved form breaks a rule on this field (or row). */
  isInvalid: (field: string, itemId?: string | null) => boolean
  catalog: RegulatoryCatalog | null
  /** A row the validation summary asked to open (row steps only); a new
   * object per request, so asking twice opens it twice. */
  focusRow: { field: string; itemId: string } | null
  /** An objective to start, asked for by a fix under a warning shown in
   * another section (a HIGH need nobody answers, a capability with no
   * objective): prefilled; a new object per request. Objectives only. */
  newObjective?: { needKey?: string; capability?: string } | null
  /** "Renumber by creation date" for needs (only with gaps) or "Renumber in
   * list order" for objectives; null when there is nothing to change (or
   * it can't change any more). */
  renumberButton: (kind: NeedsRenumberKind) => ReactNode
}
