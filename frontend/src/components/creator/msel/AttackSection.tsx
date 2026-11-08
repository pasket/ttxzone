import { useTranslation } from 'react-i18next'

import { btnSecondary } from '../../../lib/buttonStyles'
import type { TabProps } from './tabProps'

type Props = Pick<
  TabProps,
  'msel' | 'draft' | 'catalog' | 'readOnly' | 'upgradeAttack' | 'attackUpgradeBlocked'
>

/** The MITRE ATT&CK release the MSEL is pinned to (what every name and
 * link refers to) and, when the app ships a newer one, the explicit
 * upgrade -- in Threat actors, under the actors it applies to. */
export function AttackRelease({
  msel,
  catalog,
  readOnly,
  upgradeAttack,
  attackUpgradeBlocked,
}: Omit<Props, 'draft'>) {
  const { t, i18n } = useTranslation()
  const released = catalog
    ? new Date(`${catalog.released}T00:00:00Z`).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : null
  const newer = catalog !== null && catalog.latest_version !== msel.attack_version

  return (
    <div className="space-y-2">
      <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
        {released
          ? t('creator.msel.attack.version', { version: msel.attack_version, date: released })
          : t('creator.msel.attack.versionShort', { version: msel.attack_version })}
      </p>
      {newer && !readOnly && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-paper-line p-3 text-sm dark:border-line"
        >
          <div>
            <p className="font-medium">
              {t('creator.msel.attack.upgradeTitle', { latest: catalog.latest_version })}
            </p>
            <p className="text-paper-ink/70 dark:text-fg-muted">
              {t('creator.msel.attack.upgradeBody', { current: msel.attack_version })}
            </p>
          </div>
          <button
            type="button"
            disabled={attackUpgradeBlocked}
            onClick={upgradeAttack}
            className={btnSecondary}
          >
            {t('creator.msel.attack.upgradeAction', { latest: catalog.latest_version })}
          </button>
        </div>
      )}
    </div>
  )
}
