import { useTranslation } from 'react-i18next'

import {
  segmentedControl,
  segmentedOptionActive,
  segmentedOptionIdle,
} from '../../lib/buttonStyles'
import type { LibraryLevel } from '../../lib/libraryLevels'

/** TTX-Zone | My organization | This exercise: the level switch every
 * template library (and its pickers) shares. */
export function LibraryLevelSwitch({
  levels,
  value,
  onChange,
}: {
  levels: LibraryLevel[]
  value: LibraryLevel
  onChange: (level: LibraryLevel) => void
}) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('templates.levelsLabel')} className={segmentedControl}>
      {levels.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={key === value}
          onClick={() => onChange(key)}
          className={key === value ? segmentedOptionActive : segmentedOptionIdle}
        >
          {t(`templates.levels.${key}`)}
        </button>
      ))}
    </div>
  )
}
