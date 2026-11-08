import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnDanger, btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'

/** Asks why before a control action that needs it: stopping the session,
 * skipping an inject, firing a contingent one. */
export function ReasonDialog({
  title,
  description,
  confirmLabel,
  danger = false,
  pending,
  onClose,
  onConfirm,
}: {
  title: string
  description: string
  confirmLabel: string
  danger?: boolean
  pending: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [reason, setReason] = useState('')
  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onConfirm(reason.trim())
        }}
        className="space-y-3 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{description}</p>
        <label htmlFor={`${titleId}-reason`} className="block text-sm">
          {t('playground.control.reason')}
        </label>
        <textarea
          name={`${titleId}-reason`}
          autoComplete="off"
          id={`${titleId}-reason`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
          rows={3}
          required
          className={inputBase}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending || !reason.trim()}
            className={danger ? btnDanger : btnPrimary}
          >
            {pending ? <ButtonSpinner /> : confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
