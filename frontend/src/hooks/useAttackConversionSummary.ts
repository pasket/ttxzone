import { useTranslation } from 'react-i18next'

import type { AttackConversion, AttackUpgradeChanges } from '../lib/types'

/** "2 replaced: T1566 → T1566.001, …. 1 removed: T1490." -- what moving
 * references onto another ATT&CK release changed, or "" when nothing. An
 * MSEL's upgrade also says which techniques it keeps under another tactic
 * and which MITRE renamed or filed under other tactics. */
export function useAttackConversionSummary(): (
  conversion: AttackConversion & Partial<AttackUpgradeChanges>,
) => string {
  const { t } = useTranslation()
  return (conversion) => {
    const moved = conversion.moved ?? []
    const movedIds = new Set(moved.map((move) => move.technique_id))
    const changed = (conversion.changed ?? []).filter((id) => !movedIds.has(id))
    return [
      conversion.replaced.length
        ? t('creator.msel.attack.replaced', {
            count: conversion.replaced.length,
            list: conversion.replaced.map((r) => `${r.from_id} → ${r.to_id}`).join(', '),
          })
        : '',
      conversion.removed.length
        ? t('creator.msel.attack.removed', {
            count: conversion.removed.length,
            list: conversion.removed.join(', '),
          })
        : '',
      moved.length
        ? t('creator.msel.attack.moved', {
            count: moved.length,
            list: moved
              .map((m) => `${m.technique_id} (${m.from_tactic_id} → ${m.to_tactic_id})`)
              .join(', '),
          })
        : '',
      changed.length
        ? t('creator.msel.attack.changed', { count: changed.length, list: changed.join(', ') })
        : '',
    ]
      .filter(Boolean)
      .join(' ')
  }
}
