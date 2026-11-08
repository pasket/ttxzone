import type { ReactNode } from 'react'

import type { MselDraft } from '../../../lib/msel'
import type { AttackCatalog, Msel, MselRenumberKind, ValidationReport } from '../../../lib/types'

/** What every MSEL tab receives from CreatorMselSection. */
export interface TabProps {
  msel: Msel
  draft: MselDraft
  update: (patch: Partial<MselDraft>) => void
  /** Removes a row with an Undo toast (see useUndoableRowRemoval). */
  removeRow: (field: 'phases' | 'injects' | 'threat_actors', key: string, message: string) => void
  /** Whether the (live) report flags this field, or this row's field. */
  isInvalid: (field: string, itemId?: string | null) => boolean
  report: ValidationReport
  catalog: AttackCatalog | null
  /** False while the needs analysis is being revised. */
  readOnly: boolean
  /** Move the MSEL to the latest ATT&CK release (Scenario tab). */
  upgradeAttack: () => void
  /** Unsaved edits or another action running: the upgrade must wait. */
  attackUpgradeBlocked: boolean
  /** "Reset … codes to … order" for this kind of row, or null when its codes
   * already follow the order (or can't change any more). */
  renumberButton: (kind: MselRenumberKind) => ReactNode
  /** A row the validation summary (or the timeline) asked to open; a new
   * object per request, so asking twice opens it twice. */
  focusRow: { field: string; itemId: string } | null
  /** The page's save state, shown where a dialog edits the draft live
   * (the inject dialog). */
  saveStatus: ReactNode
  /** Open a row of another tab (the timeline opens injects). */
  openRow: (tab: 'injects' | 'phases', itemId: string) => void
}
