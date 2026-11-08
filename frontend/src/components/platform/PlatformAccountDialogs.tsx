import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../hooks/useToast'
import { apiFetch } from '../../lib/api'
import { btnDanger, btnPrimary, btnSecondary, inputBase } from '../../lib/buttonStyles'
import type { InstanceAccount, InstanceAdmin } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { LastLogin } from '../common/LastLogin'
import { Modal } from '../common/Modal'
import { labelClass, useErrorMessage } from './platformCommon'

/** Suspending reaches every organization of the account, so its email is
 * typed to confirm, and organizations it alone runs are named first. */
export function SuspendAccountModal({
  account,
  onClose,
  onSuspended,
}: {
  account: InstanceAccount
  onClose: () => void
  onSuspended: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const name = account.full_name || account.email
  const orphaned = account.organizations.filter((o) => o.sole_program_manager)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch(`/instance/accounts/${account.user_id}/suspend`, {
        method: 'POST',
        body: JSON.stringify({ confirmation }),
      })
      showToast(t('platform.accounts.suspend.suspended', { email: account.email }))
      onSuspended()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Modal titleId="platform-suspend-account-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <h2
          id="platform-suspend-account-title"
          className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
        >
          {t('platform.accounts.suspend.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('platform.accounts.suspend.warning', { name })}
        </p>
        {orphaned.length > 0 && (
          <div className="space-y-2 text-sm text-paper-ink/70 dark:text-fg-muted">
            <p>{t('platform.accounts.suspend.orphaned', { count: orphaned.length })}</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {orphaned.map((o) => (
                <li key={o.id}>{o.name}</li>
              ))}
            </ul>
          </div>
        )}
        <label className={labelClass} htmlFor="platform-suspend-account-confirm">
          {t('platform.accounts.suspend.confirmLabel', { email: account.email })}
        </label>
        <input
          name="confirmation"
          id="platform-suspend-account-confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={account.email}
          className={inputBase}
          autoComplete="off"
        />
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              submitting || confirmation.trim().toLowerCase() !== account.email.toLowerCase()
            }
            className={`flex-1 ${btnDanger}`}
          >
            {submitting ? <ButtonSpinner /> : t('platform.accounts.suspend.submit')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/** Making someone an instance administrator hands them the whole
 * deployment, so the dialog shows who the account is and its email is
 * typed to confirm (plus the step-up apiFetch asks for). */
export function GrantAdminModal({
  account,
  onClose,
  onGranted,
}: {
  account: InstanceAccount
  onClose: () => void
  onGranted: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const name = account.full_name || account.email

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch('/instance/admins', {
        method: 'POST',
        body: JSON.stringify({ user_id: account.user_id, confirmation }),
      })
      showToast(t('platform.accounts.grant.granted', { email: account.email }))
      onGranted()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Modal titleId="platform-grant-admin-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <h2
          id="platform-grant-admin-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {t('platform.accounts.grant.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('platform.accounts.grant.warning', { name })}
        </p>
        <div className="space-y-1 text-sm">
          <p className="text-paper-ink/70 dark:text-fg-muted">
            {t('platform.accounts.grant.check')}
          </p>
          <dl className="space-y-1 rounded-sm border border-paper-line p-3 dark:border-line">
            <div>
              <dt className="sr-only">{t('platform.accounts.columns.account')}</dt>
              <dd>
                <span className="block font-semibold">{name}</span>
                <span className="block text-paper-ink/60 dark:text-fg-muted">{account.email}</span>
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-paper-ink/60 dark:text-fg-muted">
                {t('platform.accounts.columns.organizations')}:
              </dt>
              <dd>
                {account.organizations.length === 0
                  ? t('platform.accounts.noOrganization')
                  : account.organizations.map((o) => o.name).join(', ')}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-paper-ink/60 dark:text-fg-muted">
                {t('common.lastLogin.column')}:
              </dt>
              <dd>
                <LastLogin value={account.last_login_at} />
              </dd>
            </div>
          </dl>
        </div>
        <label className={labelClass} htmlFor="platform-grant-admin-confirm">
          {t('platform.accounts.grant.confirmLabel', { email: account.email })}
        </label>
        <input
          name="confirmation"
          id="platform-grant-admin-confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={account.email}
          className={inputBase}
          autoComplete="off"
        />
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={
              submitting || confirmation.trim().toLowerCase() !== account.email.toLowerCase()
            }
            className={`flex-1 ${btnPrimary}`}
          >
            {submitting ? <ButtonSpinner /> : t('platform.accounts.grant.submit')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
/** Revoking an administrator takes Platform away from them at once, so
 * the email is typed to confirm, like suspending. Never your own (an
 * account's page doesn't manage yourself): another administrator or the
 * console does it. */
export function RevokeAdminModal({
  admin,
  onClose,
  onRevoked,
}: {
  admin: Pick<InstanceAdmin, 'user_id' | 'email'> & { full_name: string | null }
  onClose: () => void
  onRevoked: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const name = admin.full_name || admin.email

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch(`/instance/admins/${admin.user_id}`, { method: 'DELETE' })
      showToast(t('platform.admins.revoke.revoked', { email: admin.email }))
      onRevoked()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <Modal titleId="platform-revoke-admin-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <h2
          id="platform-revoke-admin-title"
          className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
        >
          {t('platform.admins.revoke.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('platform.admins.revoke.warning', { name })}
        </p>
        <label className={labelClass} htmlFor="platform-revoke-admin-confirm">
          {t('platform.admins.revoke.confirmLabel', { email: admin.email })}
        </label>
        <input
          name="confirmation"
          id="platform-revoke-admin-confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder={admin.email}
          className={inputBase}
          autoComplete="off"
        />
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting || confirmation.trim().toLowerCase() !== admin.email.toLowerCase()}
            className={`flex-1 ${btnDanger}`}
          >
            {submitting ? <ButtonSpinner /> : t('platform.admins.revoke.submit')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
