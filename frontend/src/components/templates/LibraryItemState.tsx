import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useToast } from '../../hooks/useToast'
import { apiFetch, ApiError } from '../../lib/api'
import { btnNeutralIconGhost } from '../../lib/buttonStyles'
import type { LibraryItemState } from '../../lib/types'

/** "Disabled" chip of an organization library item deleted while still
 * in use, with how many uses keep it -- text, never colour alone. */
export function DisabledBadge({ item }: { item: LibraryItemState }) {
  const { t } = useTranslation()
  if (!item.disabled_at) return null
  return (
    <span
      title={t('templates.usage.disabledHint')}
      className="inline-flex h-5 items-center gap-1 rounded-xs border border-dashed border-paper-line px-1.5 text-xs font-medium whitespace-nowrap text-paper-ink/70 dark:border-line dark:text-fg-muted"
    >
      {t('templates.usage.disabledBadge')}
      {(item.usage_count ?? 0) > 0 && (
        <span className="font-normal text-paper-ink/60 dark:text-fg-faint">
          · {t('templates.usage.uses', { count: item.usage_count ?? 0 })}
        </span>
      )}
    </span>
  )
}

function RestoreIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

/** Row action that re-enables a disabled organization library item
 * (`url` is the item's own url). Renders nothing for an enabled one. */
export function EnableButton({
  item,
  url,
  name,
  onDone,
}: {
  item: LibraryItemState
  url: string
  name: string
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [busy, setBusy] = useState(false)
  if (!item.disabled_at) return null

  async function enable() {
    setBusy(true)
    try {
      await apiFetch(`${url}/enable`, { method: 'POST' })
      showToast(t('templates.usage.enabled', { name }))
      onDone()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : t('auth.common.genericError'), {
        variant: 'error',
      })
    } finally {
      setBusy(false)
    }
  }

  const label = t('templates.usage.enableLabel', { name })
  return (
    <button
      type="button"
      onClick={() => void enable()}
      disabled={busy}
      aria-label={label}
      title={label}
      className={btnNeutralIconGhost}
    >
      <RestoreIcon />
    </button>
  )
}
