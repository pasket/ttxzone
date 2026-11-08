import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError, apiFetch } from '../../lib/api'
import { btnPrimary, btnSecondary, inputBase, optionalSuffix } from '../../lib/buttonStyles'
import type { MyLeaveRequest } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { Modal } from '../common/Modal'

/** A Player asks to leave an exercise: the Planners decide (Creator ->
 * Players -> Pending requests). The reason is optional. */
export function LeaveRequestDialog({
  ttxId,
  ttxName,
  onClose,
  onSent,
}: {
  ttxId: string
  ttxName: string
  onClose: () => void
  onSent: (request: MyLeaveRequest) => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setPending(true)
    setError(null)
    try {
      onSent(
        await apiFetch<MyLeaveRequest>(`/ttx/${ttxId}/leave-request`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        }),
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('auth.common.genericError'))
      setPending(false)
    }
  }

  return (
    <Modal titleId={titleId} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
        className="space-y-4 p-6"
      >
        <h2 id={titleId} className="text-lg font-semibold">
          {t('execution.enrollments.leaveRequest.title', { name: ttxName })}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('execution.enrollments.leaveRequest.body')}
        </p>
        <div className="space-y-1">
          <label htmlFor={`${titleId}-reason`} className="block text-sm">
            {t('execution.enrollments.leaveRequest.reason')}{' '}
            <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
          </label>
          <textarea
            name={`${titleId}-reason`}
            autoComplete="off"
            id={`${titleId}-reason`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className={inputBase}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger-fg">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button type="submit" disabled={pending} className={btnPrimary}>
            {pending ? <ButtonSpinner /> : t('execution.enrollments.leaveRequest.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
