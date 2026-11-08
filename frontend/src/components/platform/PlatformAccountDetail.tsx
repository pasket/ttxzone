import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { apiFetch, ApiError } from '../../lib/api'
import { btnDanger, btnPrimary, btnSecondary, inputBase, linkAccent } from '../../lib/buttonStyles'
import {
  panelFormActions,
  panelFormFields,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import { CONTEXT_ROLE_LABEL_KEYS } from '../../lib/roleLabels'
import type {
  AccountDependencyCategory,
  InstanceAccountDetail,
  InstanceAdminListResponse,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { CodeRef } from '../common/CodeRef'
import { LastLogin } from '../common/LastLogin'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { GrantAdminModal, RevokeAdminModal, SuspendAccountModal } from './PlatformAccountDialogs'
import { ROLE_LABEL_KEYS, badgeBase, labelClass, useErrorMessage } from './platformCommon'

const DEPENDENCY_LABEL_KEYS = {
  organizations: 'platform.account.dependencies.organizations',
  exercises: 'platform.account.dependencies.exercises',
  exercise_requests: 'platform.account.dependencies.exercise_requests',
  invitations: 'platform.account.dependencies.invitations',
  library: 'platform.account.dependencies.library',
  exercise_content: 'platform.account.dependencies.exercise_content',
  instance: 'platform.account.dependencies.instance',
  other: 'platform.account.dependencies.other',
} as const satisfies Record<AccountDependencyCategory, string>

const neutralBadge = `${badgeBase} ml-0 bg-paper-line/60 text-paper-ink/70 dark:bg-line dark:text-fg-muted`
const dangerBadge = `${badgeBase} ml-0 bg-danger/10 text-danger-fg`

/** A row of a settings panel: what it is and its state on the left, the
 * action on the right. */
function SettingRow({
  title,
  state,
  children,
}: {
  title: string
  state: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 space-y-0.5">
        <p className="text-sm font-medium text-paper-ink dark:text-fg">{title}</p>
        <div className="text-sm text-paper-ink/70 dark:text-fg-muted">{state}</div>
      </div>
      {children && <div className="flex shrink-0 flex-wrap gap-2">{children}</div>}
    </div>
  )
}

/** What happens, then confirm: for actions that are undone by the person
 * (a reset) rather than by typing anything. */
function ConfirmModal({
  title,
  children,
  confirmLabel,
  danger = false,
  onConfirm,
  onClose,
}: {
  title: string
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  onConfirm: () => Promise<void>
  onClose: () => void
}) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (err) {
      setError(errorMessage(err))
      setBusy(false)
    }
  }

  return (
    <Modal titleId="platform-account-confirm-title" onClose={onClose}>
      <div className="w-full max-w-md space-y-3">
        <h2
          id="platform-account-confirm-title"
          className="text-balance text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
        <div className="space-y-2 text-sm text-paper-ink/70 dark:text-fg-muted">{children}</div>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className={`flex-1 ${danger ? btnDanger : btnPrimary}`}
          >
            {busy ? <ButtonSpinner /> : confirmLabel}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Name and email, corrected by the operator (a typo, a changed address).
 * Saved as typed; the email stays unique. */
function ProfilePanel({
  account,
  onSaved,
}: {
  account: InstanceAccountDetail
  onSaved: (next: InstanceAccountDetail) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [fullName, setFullName] = useState(account.full_name ?? '')
  const [email, setEmail] = useState(account.email)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const dirty = fullName !== (account.full_name ?? '') || email !== account.email
  useUnsavedChangesWarning(dirty)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaving(true)
    try {
      const next = await apiFetch<InstanceAccountDetail>(`/instance/accounts/${account.user_id}`, {
        method: 'PATCH',
        body: JSON.stringify({ full_name: fullName.trim(), email: email.trim() }),
      })
      onSaved(next)
      showToast(t('platform.account.profile.saved'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save}>
      <Panel
        title={t('platform.account.profile.title')}
        description={t('platform.account.profile.description')}
        footer={
          <div className={panelFormActions}>
            {dirty && (
              <button
                type="button"
                onClick={() => {
                  setFullName(account.full_name ?? '')
                  setEmail(account.email)
                  setError(null)
                }}
                className={btnSecondary}
              >
                {t('common.confirmButton.cancel')}
              </button>
            )}
            <button
              type="submit"
              disabled={!dirty || saving || !fullName.trim() || !email.trim()}
              className={btnPrimary}
            >
              {saving ? <ButtonSpinner /> : t('platform.account.profile.save')}
            </button>
          </div>
        }
      >
        <div className={`space-y-4 ${panelFormFields}`}>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-account-name">
              {t('platform.account.profile.nameLabel')}
            </label>
            <input
              id="platform-account-name"
              name="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputBase}
              autoComplete="off"
              maxLength={255}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-account-email">
              {t('platform.account.profile.emailLabel')}
            </label>
            <input
              id="platform-account-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              autoComplete="off"
              spellCheck={false}
            />
            <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {t('platform.account.profile.emailHint')}
            </p>
          </div>
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      </Panel>
    </form>
  )
}

/** Where the account works: its organizations (roles there) and its
 * exercises (what it is on each) -- read-only, changed in each
 * organization's Admin or exercise team. */
function WorkPanel({ account }: { account: InstanceAccountDetail }) {
  const { t } = useTranslation()
  const nothing = account.organizations.length === 0 && account.exercises.length === 0

  return (
    <Panel
      title={t('platform.account.work.title')}
      meta={t('platform.account.work.summary', {
        organizations: t('platform.account.work.organizations', {
          count: account.organizations.length,
        }),
        exercises: t('platform.account.work.exercises', { count: account.exercises.length }),
      })}
      flush
    >
      {nothing ? (
        <p className="px-5 py-8 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('platform.account.work.empty')}
        </p>
      ) : (
        <div className="divide-y divide-paper-line dark:divide-line">
          {account.organizations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={panelTableHeadRow}>
                    <th scope="col" className={panelTh}>
                      {t('platform.account.work.organizationColumn')}
                    </th>
                    <th scope="col" className={panelTh}>
                      {t('platform.account.work.rolesColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody className={panelTbody}>
                  {account.organizations.map((organization) => (
                    <tr key={organization.id} className={panelTr}>
                      <td className={`${panelTd} font-medium`}>{organization.name}</td>
                      <td className={panelTd}>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {organization.roles.map((r) => t(ROLE_LABEL_KEYS[r])).join(' · ')}
                          {organization.disabled && (
                            <span className={dangerBadge}>
                              {t('admin.usersAndRoles.disabledBadge')}
                            </span>
                          )}
                          {organization.sole_program_manager && (
                            <span className={neutralBadge}>
                              {t('platform.account.work.soleProgramManager')}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {account.exercises.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className={panelTableHeadRow}>
                    <th scope="col" className={panelTh}>
                      {t('platform.account.work.exerciseColumn')}
                    </th>
                    <th scope="col" className={panelTh}>
                      {t('platform.account.work.organizationColumn')}
                    </th>
                    <th scope="col" className={panelTh}>
                      {t('platform.account.work.onItColumn')}
                    </th>
                  </tr>
                </thead>
                <tbody className={panelTbody}>
                  {account.exercises.map((exercise) => (
                    <tr key={exercise.id} className={panelTr}>
                      <td className={panelTd}>
                        <CodeRef code={exercise.code} title={exercise.name} />
                      </td>
                      <td className={panelTd}>{exercise.organization_name}</td>
                      <td className={panelTd}>
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          {exercise.roles.map((r) => t(CONTEXT_ROLE_LABEL_KEYS[r])).join(' · ')}
                          {exercise.lead_planner && (
                            <span className={neutralBadge}>
                              {t('platform.account.work.leadPlanner')}
                            </span>
                          )}
                          {exercise.lead_evaluator && (
                            <span className={neutralBadge}>
                              {t('platform.account.work.leadEvaluator')}
                            </span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

type Pending = 'password' | 'totp' | 'sessions' | null

/** Getting the person back in: a forgotten password (a temporary one,
 * shown once), a lost authenticator, a device left signed in. */
function SecurityPanel({
  account,
  onChanged,
}: {
  account: InstanceAccountDetail
  onChanged: (next?: InstanceAccountDetail) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [pending, setPending] = useState<Pending>(null)
  const [temporary, setTemporary] = useState<string | null>(null)
  const name = account.full_name || account.email

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      showToast(t('platform.account.security.copied'))
    } catch {
      showToast(t('platform.account.security.copyFailed'), { variant: 'error' })
    }
  }

  return (
    <Panel
      title={t('platform.account.security.title')}
      description={t('platform.account.security.description')}
    >
      <div className="divide-y divide-paper-line dark:divide-line">
        <SettingRow
          title={t('platform.account.security.password')}
          state={
            account.password_change_required
              ? t('platform.account.security.passwordPending')
              : t('platform.account.security.passwordSet')
          }
        >
          <button type="button" onClick={() => setPending('password')} className={btnSecondary}>
            {t('platform.account.security.resetPassword')}
          </button>
        </SettingRow>
        {temporary && (
          <div className="space-y-2 py-3" role="status">
            <p className="text-sm font-medium text-paper-ink dark:text-fg">
              {t('platform.account.security.temporaryTitle')}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 select-all rounded-sm border border-paper-line bg-field px-3 py-2 font-mono text-base tracking-wide dark:border-line">
                {temporary}
              </code>
              <button type="button" onClick={() => void copy(temporary)} className={btnSecondary}>
                {t('platform.account.security.copy')}
              </button>
              <button type="button" onClick={() => setTemporary(null)} className={btnSecondary}>
                {t('platform.account.security.done')}
              </button>
            </div>
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('platform.account.security.temporaryHint', { name })}
            </p>
          </div>
        )}
        <SettingRow
          title={t('platform.account.security.twoFactor')}
          state={
            account.totp_enabled
              ? t('platform.account.security.twoFactorOn', {
                  count: account.backup_codes_remaining,
                })
              : account.email_mfa_enabled
                ? t('platform.account.security.twoFactorEmailOnly')
                : t('platform.account.security.twoFactorOff')
          }
        >
          <button
            type="button"
            onClick={() => setPending('totp')}
            disabled={!account.totp_enabled && !account.email_mfa_enabled}
            className={btnSecondary}
          >
            {t('platform.account.security.resetTwoFactor')}
          </button>
        </SettingRow>
        <SettingRow
          title={t('platform.account.security.sessions')}
          state={t('platform.account.security.sessionsCount', { count: account.active_sessions })}
        >
          <button
            type="button"
            onClick={() => setPending('sessions')}
            disabled={account.active_sessions === 0}
            className={btnSecondary}
          >
            {t('platform.account.security.endSessions')}
          </button>
        </SettingRow>
      </div>
      {pending === 'password' && (
        <ConfirmModal
          title={t('platform.account.security.resetPasswordTitle')}
          confirmLabel={t('platform.account.security.resetPassword')}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            const result = await apiFetch<{ temporary_password: string }>(
              `/instance/accounts/${account.user_id}/reset-password`,
              { method: 'POST' },
            )
            setTemporary(result.temporary_password)
            setPending(null)
            onChanged()
          }}
        >
          <p>{t('platform.account.security.resetPasswordBody', { name })}</p>
        </ConfirmModal>
      )}
      {pending === 'totp' && (
        <ConfirmModal
          title={t('platform.account.security.resetTwoFactorTitle')}
          confirmLabel={t('platform.account.security.resetTwoFactor')}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            const next = await apiFetch<InstanceAccountDetail>(
              `/instance/accounts/${account.user_id}/reset-two-factor`,
              { method: 'POST' },
            )
            setPending(null)
            showToast(t('platform.account.security.twoFactorReset'))
            onChanged(next)
          }}
        >
          <p>{t('platform.account.security.resetTwoFactorBody', { name })}</p>
        </ConfirmModal>
      )}
      {pending === 'sessions' && (
        <ConfirmModal
          title={t('platform.account.security.endSessionsTitle')}
          confirmLabel={t('platform.account.security.endSessions')}
          onClose={() => setPending(null)}
          onConfirm={async () => {
            const next = await apiFetch<InstanceAccountDetail>(
              `/instance/accounts/${account.user_id}/end-sessions`,
              { method: 'POST' },
            )
            setPending(null)
            showToast(t('platform.account.security.sessionsEnded'))
            onChanged(next)
          }}
        >
          <p>{t('platform.account.security.endSessionsBody', { name })}</p>
        </ConfirmModal>
      )}
    </Panel>
  )
}

/** Running this instance, and whether the account can sign in at all. */
function AccessPanel({
  account,
  onChanged,
}: {
  account: InstanceAccountDetail
  onChanged: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const admins = useApiResource<InstanceAdminListResponse>('/instance/admins')
  const [dialog, setDialog] = useState<'grant' | 'revoke' | 'suspend' | null>(null)
  const [reactivating, setReactivating] = useState(false)
  const webGrants = admins.data?.web_grants_enabled ?? false
  const activeAdmins = (admins.data?.items ?? []).filter((a) => a.suspended_at === null).length
  const lastAdmin = account.is_instance_admin && account.suspended_at === null && activeAdmins <= 1
  const suspended = account.suspended_at !== null

  async function reactivate() {
    setReactivating(true)
    try {
      await apiFetch(`/instance/accounts/${account.user_id}/reactivate`, { method: 'POST' })
      showToast(t('platform.accounts.reactivated', { email: account.email }))
      onChanged()
    } catch (err) {
      showToast(errorMessage(err), { variant: 'error' })
    } finally {
      setReactivating(false)
    }
  }

  return (
    <Panel title={t('platform.account.access.title')}>
      <div className="divide-y divide-paper-line dark:divide-line">
        <SettingRow
          title={t('platform.account.access.admin')}
          state={
            !webGrants && admins.data
              ? t('platform.admins.consoleOnly')
              : lastAdmin
                ? t('platform.account.access.lastAdmin')
                : account.is_instance_admin
                  ? t('platform.account.access.adminOn')
                  : t('platform.account.access.adminOff')
          }
        >
          {webGrants &&
            (account.is_instance_admin ? (
              !lastAdmin && (
                <button type="button" onClick={() => setDialog('revoke')} className={btnSecondary}>
                  {t('platform.admins.revoke.submit')}
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={() => setDialog('grant')}
                disabled={suspended}
                className={btnSecondary}
              >
                {t('platform.accounts.grant.submit')}
              </button>
            ))}
        </SettingRow>
        <SettingRow
          title={t('platform.account.access.signIn')}
          state={
            suspended
              ? t('platform.account.access.suspendedSince', {
                  date: new Date(account.suspended_at!).toLocaleDateString(),
                })
              : t('platform.account.access.active')
          }
        >
          {suspended ? (
            <button
              type="button"
              onClick={() => void reactivate()}
              disabled={reactivating}
              className={btnSecondary}
            >
              {reactivating ? <ButtonSpinner /> : t('platform.account.access.reactivate')}
            </button>
          ) : (
            <button type="button" onClick={() => setDialog('suspend')} className={btnSecondary}>
              {t('platform.accounts.suspend.submit')}
            </button>
          )}
        </SettingRow>
      </div>
      {dialog === 'grant' && (
        <GrantAdminModal
          account={account}
          onClose={() => setDialog(null)}
          onGranted={() => {
            setDialog(null)
            admins.refetch()
            onChanged()
          }}
        />
      )}
      {dialog === 'revoke' && (
        <RevokeAdminModal
          admin={account}
          onClose={() => setDialog(null)}
          onRevoked={() => {
            setDialog(null)
            admins.refetch()
            onChanged()
          }}
        />
      )}
      {dialog === 'suspend' && (
        <SuspendAccountModal
          account={account}
          onClose={() => setDialog(null)}
          onSuspended={() => {
            setDialog(null)
            onChanged()
          }}
        />
      )}
    </Panel>
  )
}

/** Deleting for good, only an account that left no trace: otherwise it
 * says what keeps it and points to suspending instead. */
function DeletePanel({
  account,
  onDeleted,
}: {
  account: InstanceAccountDetail
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const blocked = account.dependencies.length > 0 || account.is_instance_admin

  async function remove(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setDeleting(true)
    try {
      await apiFetch(`/instance/accounts/${account.user_id}`, {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
      })
      showToast(t('platform.account.delete.deleted', { email: account.email }))
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <Panel
      title={t('platform.account.delete.title')}
      description={t('platform.account.delete.description')}
    >
      {blocked ? (
        <div className="space-y-2 text-sm text-paper-ink/70 dark:text-fg-muted">
          <p>
            {account.is_instance_admin
              ? t('platform.account.delete.adminBlocked')
              : t('platform.account.delete.blocked')}
          </p>
          {account.dependencies.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-5">
              {account.dependencies.map((dependency) => (
                <li key={dependency.category}>
                  {t(DEPENDENCY_LABEL_KEYS[dependency.category], { count: dependency.count })}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('platform.account.delete.allowed')}
          </p>
          <button type="button" onClick={() => setOpen(true)} className={btnDanger}>
            {t('platform.account.delete.submit')}
          </button>
        </div>
      )}
      {open && (
        <Modal titleId="platform-account-delete-title" onClose={() => setOpen(false)}>
          <form onSubmit={remove} className="w-full max-w-md space-y-3">
            <h2
              id="platform-account-delete-title"
              className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
            >
              {t('platform.account.delete.confirmTitle')}
            </h2>
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('platform.account.delete.warning', { email: account.email })}
            </p>
            <label className={labelClass} htmlFor="platform-account-delete-confirm">
              {t('platform.accounts.suspend.confirmLabel', { email: account.email })}
            </label>
            <input
              id="platform-account-delete-confirm"
              name="confirmation"
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
                  deleting || confirmation.trim().toLowerCase() !== account.email.toLowerCase()
                }
                className={`flex-1 ${btnDanger}`}
              >
                {deleting ? <ButtonSpinner /> : t('platform.account.delete.submit')}
              </button>
              <button type="button" onClick={() => setOpen(false)} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Panel>
  )
}

/** Platform -> Accounts -> one account: everything an operator does for a
 * person, by task -- correct who they are, see where they work, get them
 * back in (password, second factor, sessions), what they may reach
 * (instance administrator, suspended) and, if they left no trace, delete
 * them for good. Your own account is shown, not managed: Preferences. */
export function PlatformAccountDetail() {
  const { t, i18n } = useTranslation()
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const back = `/platform/accounts${(location.state as { from?: string } | null)?.from ?? ''}`
  const detail = useApiResource<InstanceAccountDetail>(`/instance/accounts/${userId}`)
  const [fresh, setFresh] = useState<InstanceAccountDetail | null>(null)
  const account = fresh && fresh.user_id === userId ? fresh : detail.data
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  function refetch(next?: InstanceAccountDetail) {
    if (next) setFresh(next)
    else {
      setFresh(null)
      detail.refetch()
    }
  }

  const backLink = (
    <Link to={back} className={`text-sm ${linkAccent}`}>
      <span aria-hidden="true">← </span>
      {t('platform.sections.accounts')}
    </Link>
  )

  if (detail.error) {
    const gone = detail.error instanceof ApiError && detail.error.code === 'ACCOUNT_NOT_FOUND'
    return (
      <div className="space-y-4">
        {backLink}
        <p role="alert" className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {gone ? t('platform.account.notFound') : detail.error.message}
        </p>
      </div>
    )
  }
  if (!account) {
    return <p className="text-sm text-paper-ink/70 dark:text-fg-muted">{t('common.loading')}</p>
  }
  const name = account.full_name || account.email

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {backLink}
        <SectionHeader title={name} />
        <div className="flex flex-wrap items-center gap-2 text-sm text-paper-ink/70 dark:text-fg-muted">
          <span>{account.email}</span>
          {account.is_instance_admin && (
            <span className={neutralBadge}>{t('platform.accounts.adminBadge')}</span>
          )}
          {account.suspended_at && (
            <span className={dangerBadge}>{t('platform.accounts.suspendedBadge')}</span>
          )}
          <span
            className={
              account.totp_enabled || account.email_mfa_enabled ? neutralBadge : dangerBadge
            }
          >
            {account.totp_enabled || account.email_mfa_enabled
              ? t('platform.account.badges.twoFactorOn')
              : t('platform.account.badges.twoFactorOff')}
          </span>
          {account.password_change_required && (
            <span className={neutralBadge}>{t('platform.account.badges.passwordPending')}</span>
          )}
          {account.email_verification_pending && (
            <span className={neutralBadge}>{t('platform.account.badges.emailPending')}</span>
          )}
          {account.email_reconfirmation_overdue && (
            <span className={neutralBadge}>
              {t('platform.account.badges.reconfirmationOverdue')}
            </span>
          )}
        </div>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('platform.account.registered', {
            date: dateFormat.format(new Date(account.created_at)),
          })}
          {' · '}
          {t('platform.account.lastSignIn')} <LastLogin value={account.last_login_at} />
        </p>
      </div>
      {account.is_self ? (
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('platform.account.selfNote')}{' '}
          <Link to="/account/settings/general" className={linkAccent}>
            {t('platform.account.toPreferences')}
          </Link>
        </p>
      ) : (
        <ProfilePanel
          key={`${account.full_name}-${account.email}`}
          account={account}
          onSaved={refetch}
        />
      )}
      <WorkPanel account={account} />
      {!account.is_self && (
        <>
          <SecurityPanel account={account} onChanged={refetch} />
          <AccessPanel account={account} onChanged={() => refetch()} />
          <DeletePanel account={account} onDeleted={() => navigate(back, { replace: true })} />
        </>
      )}
    </div>
  )
}
