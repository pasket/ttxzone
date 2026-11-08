import { useTranslation } from 'react-i18next'

import { btnSecondary } from '../../lib/buttonStyles'

/** "Renumber in … order": shown only while a document's codes have gaps or
 * don't follow its order and it's still a first draft (the server says so).
 * Waits for unsaved changes, since the server renumbers what's saved. */
export function RenumberButton({
  label,
  hint,
  blocked,
  onClick,
}: {
  label: string
  /** What it follows, when not the order shown (the default hint). */
  hint?: string
  blocked: boolean
  onClick: () => void
}) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      disabled={blocked}
      onClick={onClick}
      title={blocked ? t('common.renumber.wait') : (hint ?? t('common.renumber.hint'))}
      className={btnSecondary}
    >
      {label}
    </button>
  )
}
