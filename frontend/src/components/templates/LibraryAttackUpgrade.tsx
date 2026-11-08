import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useApiResource } from '../../hooks/useApiResource'
import { useAttackConversionSummary } from '../../hooks/useAttackConversionSummary'
import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnSecondary } from '../../lib/buttonStyles'
import type { LibraryAttackUpgrade as UpgradeResult } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'

/** An organization's library items keep the ATT&CK release they were
 * written against; once the app ships a newer one, this says how many are
 * behind and moves them all (MITRE's replacements applied, deprecated
 * techniques and vanished groups removed -- reported). Exercises keep
 * their own copies as they are. Renders nothing when all are current. */
export function LibraryAttackUpgrade({
  versions,
  url,
  onUpgraded,
}: {
  /** The `attack_version` of each item of the level. */
  versions: string[]
  /** The level's attack-upgrade endpoint. */
  url: string
  onUpgraded: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const summarize = useAttackConversionSummary()
  const [busy, setBusy] = useState(false)
  const latest = useApiResource<{ latest_version: string }>('/attack').data?.latest_version
  const outdated = latest ? versions.filter((version) => version !== latest).length : 0
  if (!latest || outdated === 0) return null

  async function upgrade() {
    setBusy(true)
    try {
      const result = await apiFetch<UpgradeResult>(url, { method: 'POST' })
      onUpgraded()
      showToast(
        [
          t('templates.attackUpgrade.done', {
            count: result.upgraded,
            version: result.attack_version,
          }),
          summarize(result.conversion),
        ]
          .filter(Boolean)
          .join(' '),
      )
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 border-b border-panel-line px-5 py-3 text-sm"
    >
      <div>
        <p className="font-medium">
          {t('templates.attackUpgrade.title', { count: outdated, version: latest })}
        </p>
        <p className="text-xs text-paper-ink/70 dark:text-fg-muted">
          {t('templates.attackUpgrade.body')}
        </p>
      </div>
      <button type="button" disabled={busy} onClick={() => void upgrade()} className={btnSecondary}>
        {busy ? <ButtonSpinner /> : t('templates.attackUpgrade.action', { version: latest })}
      </button>
    </div>
  )
}
