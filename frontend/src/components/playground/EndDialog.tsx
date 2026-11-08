import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { btnDanger, btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'

/** The one way to end the session, confirmed because it can't be undone.
 * Ticked as an emergency stop (a real incident, the stop keyword), it asks
 * why -- every screen shows it -- and stops instead of ending. Once ENDEX
 * is out the play is already over, so there's no emergency to stop for
 * (`allowEmergency` false). */
export function EndDialog({
  pending,
  onClose,
  onEnd,
  onStop,
  allowEmergency = true,
}: {
  pending: boolean
  onClose: () => void
  onEnd: () => void
  onStop: (reason: string) => void
  allowEmergency?: boolean
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [emergency, setEmergency] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (emergency) onStop(reason.trim())
          else onEnd()
        }}
        className="space-y-4 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('playground.control.endDialog.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('playground.control.endDialog.description')}
        </p>
        {allowEmergency && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={emergency}
              onChange={(e) => setEmergency(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-accent-fg"
              aria-describedby={`${titleId}-emergency`}
            />
            <span>
              <span className="font-semibold">{t('playground.control.endDialog.emergency')}</span>
              <span
                id={`${titleId}-emergency`}
                className="block text-paper-ink/70 dark:text-fg-muted"
              >
                {t('playground.control.endDialog.emergencyHint')}
              </span>
            </span>
          </label>
        )}
        {emergency && (
          <div className="space-y-1">
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
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('playground.control.cancel')}
          </button>
          <button
            type="submit"
            disabled={pending || (emergency && !reason.trim())}
            className={emergency ? btnDanger : btnPrimary}
          >
            {pending ? (
              <ButtonSpinner />
            ) : emergency ? (
              t('playground.control.endDialog.confirmEmergency')
            ) : (
              t('playground.control.endDialog.confirm')
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
