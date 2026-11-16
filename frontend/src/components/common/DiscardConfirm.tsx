import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { btnDanger, btnSecondary } from '../../lib/buttonStyles'

/** "Discard your changes?" in a form dialog's footer, in place of its
 * buttons, when it's closed with something typed (`hooks/useDiscardGuard`):
 * Keep editing takes the focus, so a stray Escape never loses a long text. */
export function DiscardConfirm({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void
  onDiscard: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const keepRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    keepRef.current?.focus()
  }, [])
  return (
    <div
      role="alertdialog"
      aria-labelledby={id}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <p id={id} className="mr-auto text-sm font-medium">
        {t('creator.needs.discard.question')}
      </p>
      <button ref={keepRef} type="button" onClick={onKeep} className={btnSecondary}>
        {t('creator.needs.discard.keep')}
      </button>
      <button type="button" onClick={onDiscard} className={btnDanger}>
        {t('creator.needs.discard.discard')}
      </button>
    </div>
  )
}
