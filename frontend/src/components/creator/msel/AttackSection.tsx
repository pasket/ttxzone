import { useTranslation } from 'react-i18next'

import { useAttackConversionSummary } from '../../../hooks/useAttackConversionSummary'
import { btnSecondary } from '../../../lib/buttonStyles'
import type { AttackCatalog, Msel } from '../../../lib/types'

/** The MITRE ATT&CK release the MSEL is pinned to: what every name and
 * link refers to. While a newer one is offered (`AttackUpgradeNotice`,
 * above the tabs, says what it changes), the update is here too: this is
 * where the release is read. */
export function AttackRelease({
  msel,
  catalog,
  readOnly,
  upgradeAttack,
  attackUpgradeBlocked,
}: {
  msel: Msel
  catalog: AttackCatalog | null
  readOnly: boolean
  upgradeAttack: () => void
  attackUpgradeBlocked: boolean
}) {
  const { t, i18n } = useTranslation()
  const released = catalog
    ? new Date(`${catalog.released}T00:00:00Z`).toLocaleDateString(i18n.language, {
        year: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : null
  const upgrade = readOnly ? null : msel.attack_upgrade
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-pretty text-paper-ink/60 dark:text-fg-faint">
        {released
          ? t('creator.msel.attack.version', { version: msel.attack_version, date: released })
          : t('creator.msel.attack.versionShort', { version: msel.attack_version })}
      </p>
      {upgrade && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">
            {t('creator.msel.attack.upgradeTitle', { latest: upgrade.to_version })}
          </span>
          <button
            type="button"
            disabled={attackUpgradeBlocked}
            onClick={upgradeAttack}
            className={btnSecondary}
          >
            {t('creator.msel.attack.upgradeAction', { latest: upgrade.to_version })}
          </button>
        </div>
      )}
    </div>
  )
}

/** Above every tab while the MSEL is on an older ATT&CK release than the
 * app ships: what moving to the latest would change in it, what happens to
 * its status, and the update itself. A draft the update changes nothing in
 * moves on its own when opened, so this shows for the rest: something would
 * change, or the MSEL is past draft. */
export function AttackUpgradeNotice({
  msel,
  blocked,
  onUpgrade,
}: {
  msel: Msel
  blocked: boolean
  onUpgrade: () => void
}) {
  const { t } = useTranslation()
  const summarize = useAttackConversionSummary()
  const upgrade = msel.attack_upgrade
  if (!upgrade) return null
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-paper-line p-3 text-sm dark:border-line"
    >
      <div className="min-w-0">
        <p className="font-medium">
          {t('creator.msel.attack.upgradeTitle', { latest: upgrade.to_version })}
        </p>
        <p className="text-pretty text-paper-ink/70 dark:text-fg-muted">
          {upgrade.neutral
            ? t('creator.msel.attack.upgradeNeutral', { current: msel.attack_version })
            : t('creator.msel.attack.upgradeChanges', { current: msel.attack_version })}{' '}
          {summarize(upgrade)}
          {upgrade.reopens && ` ${t('creator.msel.attack.upgradeReopens')}`}
        </p>
      </div>
      <button type="button" disabled={blocked} onClick={onUpgrade} className={btnSecondary}>
        {t('creator.msel.attack.upgradeAction', { latest: upgrade.to_version })}
      </button>
    </div>
  )
}
