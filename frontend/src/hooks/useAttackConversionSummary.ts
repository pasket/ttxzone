import { useTranslation } from 'react-i18next'

import type { AttackConversion } from '../lib/types'

/** "2 replaced: T1566 → T1566.001, …. 1 removed: T1490." -- what moving
 * references onto another ATT&CK release changed, or "" when nothing. */
export function useAttackConversionSummary(): (conversion: AttackConversion) => string {
  const { t } = useTranslation()
  return (conversion) =>
    [
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
    ]
      .filter(Boolean)
      .join(' ')
}
