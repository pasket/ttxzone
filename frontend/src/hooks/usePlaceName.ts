import { useTranslation } from 'react-i18next'

import type { RunRead } from '../lib/types'

/** The room a decision or vote was taken in, by name (null without
 * rooms). */
export function usePlaceName(run: RunRead) {
  const { t } = useTranslation()
  return (code: string | null) => {
    if (!code || !run.rooms) return null
    if (code === 'main') return t('playground.rooms.mainRoom')
    return run.rooms.rooms.find((room) => room.code === code)?.name ?? code
  }
}
