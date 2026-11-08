import { useId } from 'react'
import { useTranslation } from 'react-i18next'

import { btnPrimary, btnSecondary } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { Modal } from '../common/Modal'

/** A brief yes/no before a control action that breaks the sequence:
 * releasing an inject ahead of time, re-sending one already delivered. */
export function ConfirmActionDialog({
  title,
  description,
  items = [],
  confirmLabel,
  pending,
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  /** The coded rows it's about, listed under the description. */
  items?: { code: string; title: string }[]
  confirmLabel: string
  pending: boolean
  onClose: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm()
        }}
        className="space-y-3 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{description}</p>
        {items.length > 0 && (
          <ul className="space-y-1 text-sm">
            {items.map((item) => (
              <li key={item.code}>
                <CodeRef code={item.code} title={item.title} />
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? <ButtonSpinner /> : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
