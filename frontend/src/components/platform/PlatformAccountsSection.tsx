import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { ApiError, apiFetch } from '../../lib/api'
import {
  actionsCellClass,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputCompact,
  linkAccent,
} from '../../lib/buttonStyles'
import {
  panelActionsTh,
  panelDivider,
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import { PEOPLE_SORT_OPTIONS } from '../../lib/peopleTable'
import type {
  InstanceAccount,
  InstanceAccountListResponse,
  InstanceOrganizationListResponse,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { EditButton } from '../common/EditButton'
import { HelpText } from '../common/HelpText'
import { LastLogin } from '../common/LastLogin'
import { Modal } from '../common/Modal'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { RoleIcon } from '../common/RoleIcon'
import { RoleMark } from '../common/RoleMatrix'
import { SectionHeader } from '../common/SectionHeader'
import { TableToolbar } from '../common/TableToolbar'
import {
  ACCOUNTS_PAGE_SIZE,
  badgeBase,
  labelClass,
  ROLE_LABEL_KEYS,
  useErrorMessage,
  useUrlFilter,
} from './platformCommon'

const ACCOUNT_STATUSES = ['active', 'suspended'] as const
type AccountStatus = (typeof ACCOUNT_STATUSES)[number]

const STATUS_LABEL_KEYS = {
  active: 'platform.accounts.filters.active',
  suspended: 'platform.accounts.filters.suspended',
} as const satisfies Record<AccountStatus, string>

const ACCOUNT_ROLES = ['program_manager', 'planner', 'evaluator', 'observer'] as const

const ADMIN_FILTERS = ['yes', 'no'] as const

const ADMIN_LABEL_KEYS = {
  yes: 'platform.accounts.filters.adminYes',
  no: 'platform.accounts.filters.adminNo',
} as const satisfies Record<(typeof ADMIN_FILTERS)[number], string>

// Every organization for the filter, by name (the server caps a page at 200).
const ORGANIZATIONS_FOR_FILTER = '/instance/organizations?limit=200&sort_by=name&sort_dir=asc'

// An organization's line, in the Organizations and Roles cells alike.
const orgLine = 'flex h-7 items-center whitespace-nowrap'
// A role held in the organization: neutral (an identity, not a state).
const roleChip =
  'inline-flex h-5 items-center gap-1 rounded-xs bg-paper-line/60 px-1.5 text-xs font-medium text-paper-ink/80 dark:bg-line dark:text-fg-muted'

type BulkAction = 'suspend' | 'reactivate' | 'end_sessions' | 'delete'

const BULK_ACTIONS: BulkAction[] = ['suspend', 'reactivate', 'end_sessions', 'delete']

const BULK_LABEL_KEYS = {
  suspend: 'platform.accounts.bulk.suspend',
  reactivate: 'platform.accounts.bulk.reactivate',
  end_sessions: 'platform.accounts.bulk.end_sessions',
  delete: 'platform.accounts.bulk.delete',
} as const satisfies Record<BulkAction, string>

const BULK_WARNING_KEYS = {
  suspend: 'platform.accounts.bulk.warnings.suspend',
  reactivate: 'platform.accounts.bulk.warnings.reactivate',
  end_sessions: 'platform.accounts.bulk.warnings.end_sessions',
  delete: 'platform.accounts.bulk.warnings.delete',
} as const satisfies Record<BulkAction, string>

const BULK_DONE_KEYS = {
  suspend: 'platform.accounts.bulk.done.suspend',
  reactivate: 'platform.accounts.bulk.done.reactivate',
  end_sessions: 'platform.accounts.bulk.done.end_sessions',
  delete: 'platform.accounts.bulk.done.delete',
} as const satisfies Record<BulkAction, string>

// Locking people out, or deleting: the number typed to confirm.
const TYPED: ReadonlySet<BulkAction> = new Set(['suspend', 'delete'])
// How many emails the dialog names before "and N more".
const NAMED = 8

interface BulkResult {
  done: number
  skipped: number
  results: { user_id: string; email: string | null; code: string | null; message: string | null }[]
}

/** What happens to the selected accounts, then confirm; afterwards, what
 * was done and which ones were skipped, and why (each account goes on its
 * own: your own account, the last administrator, one with dependencies). */
function BulkAccountsModal({
  action,
  accounts,
  onClose,
  onDone,
}: {
  action: BulkAction
  accounts: InstanceAccount[]
  onClose: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<BulkResult | null>(null)
  const typed = TYPED.has(action)
  const count = String(accounts.length)

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const next = await apiFetch<BulkResult>('/instance/accounts/bulk', {
        method: 'POST',
        body: JSON.stringify({
          action,
          user_ids: accounts.map((a) => a.user_id),
          confirmation: typed ? confirmation.trim() : '',
        }),
      })
      setResult(next)
      onDone()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const skipped = result?.results.filter((r) => r.code !== null) ?? []
  return (
    <Modal titleId="platform-accounts-bulk-title" onClose={onClose}>
      <div className="w-full max-w-md space-y-3">
        <h2
          id="platform-accounts-bulk-title"
          className={`text-balance text-lg font-semibold tracking-tight ${action === 'delete' && !result ? 'text-danger-fg' : ''}`}
        >
          {t(BULK_LABEL_KEYS[action])}
          {' · '}
          {t('platform.accounts.bulk.selected', { count: accounts.length })}
        </h2>
        {result ? (
          <div className="space-y-2 text-sm" role="status">
            <p className="text-paper-ink dark:text-fg">
              {t(BULK_DONE_KEYS[action], { count: result.done })}
            </p>
            {skipped.length > 0 && (
              <>
                <p className="text-paper-ink/70 dark:text-fg-muted">
                  {t('platform.accounts.bulk.skipped', { count: skipped.length })}
                </p>
                <ul className="max-h-48 list-disc space-y-0.5 overflow-y-auto pl-5 text-paper-ink/70 dark:text-fg-muted">
                  {skipped.map((r) => (
                    <li key={r.user_id}>
                      <span className="font-medium text-paper-ink dark:text-fg">
                        {r.email ?? t('platform.account.notFound')}
                      </span>
                      {' — '}
                      {errorMessage(
                        new ApiError(409, {
                          code: r.code ?? '',
                          message: r.message ?? '',
                          ttx_id: null,
                        }),
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className={btnPrimary}>
                {t('platform.account.security.done')}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run()
            }}
            className="space-y-3"
          >
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t(BULK_WARNING_KEYS[action])}
            </p>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-paper-ink/70 dark:text-fg-muted">
              {accounts.slice(0, NAMED).map((a) => (
                <li key={a.user_id}>{a.email}</li>
              ))}
              {accounts.length > NAMED && (
                <li>{t('platform.accounts.bulk.andMore', { count: accounts.length - NAMED })}</li>
              )}
            </ul>
            {typed && (
              <>
                <label className={labelClass} htmlFor="platform-accounts-bulk-confirm">
                  {t('platform.accounts.bulk.confirmLabel', { count: accounts.length })}
                </label>
                <input
                  id="platform-accounts-bulk-confirm"
                  name="confirmation"
                  inputMode="numeric"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder={count}
                  className={inputBase}
                  autoComplete="off"
                />
              </>
            )}
            {error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || (typed && confirmation.trim() !== count)}
                className={`flex-1 ${action === 'delete' || action === 'suspend' ? btnDanger : btnPrimary}`}
              >
                {busy ? <ButtonSpinner /> : t(BULK_LABEL_KEYS[action])}
              </button>
              <button type="button" onClick={onClose} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}

/** One of the list's filters: a labelled select whose first option is
 * "all" (no filter); the label stays visible above it, so a picked value
 * still says what it filters. */
function FilterSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
  wide = false,
}: {
  id: string
  label: string
  value: string | null
  allLabel: string
  options: { value: string; label: string }[]
  onChange: (next: string | null) => void
  wide?: boolean
}) {
  return (
    <div className={`space-y-1 ${wide ? 'w-60' : 'w-48'}`}>
      <label htmlFor={id} className="block text-xs text-paper-ink/60 dark:text-fg-muted">
        {label}
      </label>
      <select
        id={id}
        name={id}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
        className={`${inputCompact} text-sm`}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** A new account, made by the operator: name and email, no organization
 * yet (roles come from an organization's Admin, or the administrator
 * grant from the account's page). Its temporary password is shown once,
 * like a reset, and the first sign-in asks for a new one. */
function CreateAccountForm({
  onCancel,
  onCreated,
  onOpen,
}: {
  onCancel: () => void
  onCreated: () => void
  onOpen: (userId: string) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<{ user_id: string; temporary_password: string } | null>(
    null,
  )

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const result = await apiFetch<{ user_id: string; temporary_password: string }>(
        '/instance/accounts',
        {
          method: 'POST',
          body: JSON.stringify({ full_name: name.trim(), email: email.trim() }),
        },
      )
      setCreated(result)
      showToast(t('platform.accounts.create.created', { email: email.trim().toLowerCase() }))
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      showToast(t('platform.account.security.copied'))
    } catch {
      showToast(t('platform.account.security.copyFailed'), { variant: 'error' })
    }
  }

  if (created) {
    return (
      <Panel
        title={t('platform.accounts.create.createdTitle')}
        footer={
          <div className={panelFormActions}>
            <button type="button" onClick={onCancel} className={btnSecondary}>
              {t('platform.account.security.done')}
            </button>
            <button type="button" onClick={() => onOpen(created.user_id)} className={btnPrimary}>
              {t('platform.accounts.create.open')}
            </button>
          </div>
        }
      >
        <div className="max-w-2xl space-y-2" role="status">
          <p className="text-sm font-medium text-paper-ink dark:text-fg">
            {t('platform.account.security.temporaryTitle')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 select-all rounded-sm border border-paper-line bg-field px-3 py-2 font-mono text-base tracking-wide dark:border-line">
              {created.temporary_password}
            </code>
            <button
              type="button"
              onClick={() => void copy(created.temporary_password)}
              className={btnSecondary}
            >
              {t('platform.account.security.copy')}
            </button>
          </div>
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('platform.account.security.temporaryHint', { name: name.trim() })}
          </p>
        </div>
      </Panel>
    )
  }

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title={t('platform.accounts.create.title')}
        description={
          <HelpText
            id="platform.accounts.create.description"
            text={t('platform.accounts.create.description')}
          />
        }
        footer={
          <div className={panelFormActions}>
            <button type="button" onClick={onCancel} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || name.trim() === '' || email.trim() === ''}
              className={btnPrimary}
            >
              {submitting ? <ButtonSpinner /> : t('platform.accounts.create.submit')}
            </button>
          </div>
        }
      >
        <div className="max-w-2xl space-y-4">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="platform-account-name">
              {t('platform.accounts.create.nameLabel')}
            </label>
            <input
              id="platform-account-name"
              name="full-name"
              autoComplete="off"
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="platform-account-email">
              {t('platform.accounts.create.emailLabel')}
            </label>
            <input
              id="platform-account-email"
              name="email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('platform.accounts.create.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputBase}
              required
            />
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

/** Platform -> Accounts: every account of the deployment, whatever its
 * organizations -- searched, sorted and filtered on the server, all of it
 * in the URL. The list is for finding people: each row's Manage opens the
 * account (PlatformAccountDetail), where everything is done (making it
 * an instance administrator too: the badge and the status filter list
 * them); "+ Create account" makes a new one; selecting
 * rows (kept across pages, never your own) acts on several at once --
 * suspend, reactivate, sign out everywhere, delete the ones that left no
 * trace. */
export function PlatformAccountsSection() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState('', PEOPLE_SORT_OPTIONS)
  const [, setSearchParams] = useSearchParams()
  const [status, setStatus] = useUrlFilter('status', ACCOUNT_STATUSES)
  const [organization, setOrganization] = useUrlFilter<string>('organization', null)
  const [role, setRole] = useUrlFilter('role', ACCOUNT_ROLES)
  const [adminFilter, setAdminFilter] = useUrlFilter('admin', ADMIN_FILTERS)
  const organizations = useApiResource<InstanceOrganizationListResponse>(ORGANIZATIONS_FOR_FILTER)
  // Selected rows by id, with what the dialog shows -- across pages.
  const [selected, setSelected] = useState<Map<string, InstanceAccount>>(new Map())
  const [bulk, setBulk] = useState<BulkAction | null>(null)
  const [creating, setCreating] = useState(false)

  const params = new URLSearchParams({
    limit: String(ACCOUNTS_PAGE_SIZE),
    offset: String((page - 1) * ACCOUNTS_PAGE_SIZE),
    sort_by: sortBy,
    sort_dir: sortDir,
  })
  if (search) params.set('q', search)
  if (status) params.set('status', status)
  if (organization) params.set('organization', organization)
  if (role) params.set('role', role)
  if (adminFilter) params.set('instance_admin', String(adminFilter === 'yes'))
  const accounts = useApiResource<InstanceAccountListResponse>(`/instance/accounts?${params}`)
  const items = accounts.data?.items ?? []
  const total = accounts.data?.total ?? 0
  const totalPages = Math.ceil(total / ACCOUNTS_PAGE_SIZE)
  usePageFallback({ total, pageSize: ACCOUNTS_PAGE_SIZE, ready: accounts.data !== null })
  const filtering =
    status !== null || organization !== null || role !== null || adminFilter !== null
  const filtered = search !== '' || filtering

  // One URL update: setSearchParams' updater sees the URL as rendered,
  // so four setters in a row would each undo the one before.
  function clearFilters() {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const key of ['status', 'organization', 'role', 'admin', 'page']) next.delete(key)
        return next
      },
      { replace: true },
    )
  }
  const selectable = items.filter((a) => a.user_id !== user?.id)
  const allOnPage = selectable.length > 0 && selectable.every((a) => selected.has(a.user_id))
  const someOnPage = selectable.some((a) => selected.has(a.user_id))

  function toggle(rows: InstanceAccount[], on: boolean) {
    setSelected((current) => {
      const next = new Map(current)
      for (const row of rows) {
        if (on) next.set(row.user_id, row)
        else next.delete(row.user_id)
      }
      return next
    })
  }

  if (creating) {
    return (
      <div className="space-y-6">
        <SectionHeader title={t('platform.sections.accounts')} />
        <CreateAccountForm
          onCancel={() => setCreating(false)}
          onCreated={() => accounts.refetch()}
          onOpen={(userId) =>
            navigate(`/platform/accounts/${userId}`, { state: { from: location.search } })
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          title={t('platform.sections.accounts')}
          action={
            <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>
              <span aria-hidden="true">+ </span>
              {t('platform.accounts.create.button')}
            </button>
          }
        />
        <HelpText id="platform.accounts.description" text={t('platform.accounts.description')} />
      </div>
      <Panel
        label={t('platform.sections.accounts')}
        meta={accounts.data ? t('platform.accounts.count', { count: total }) : undefined}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              sortOptions={PEOPLE_SORT_OPTIONS}
              sortLabels={{ created_at: t('platform.accounts.registeredSort') }}
            />
          </div>
        }
        footer={
          totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          ) : undefined
        }
        flush
      >
        <div
          role="group"
          aria-label={t('platform.accounts.filters.label')}
          className={`flex flex-wrap items-center gap-2 border-b px-5 py-2.5 ${panelDivider}`}
        >
          <FilterSelect
            id="platform-accounts-status"
            label={t('platform.accounts.filters.status')}
            value={status}
            allLabel={t('platform.accounts.filters.allStatuses')}
            options={ACCOUNT_STATUSES.map((value) => ({
              value,
              label: t(STATUS_LABEL_KEYS[value]),
            }))}
            onChange={(next) => setStatus(next as AccountStatus | null)}
          />
          <FilterSelect
            id="platform-accounts-organization"
            label={t('platform.accounts.filters.organization')}
            value={organization}
            allLabel={t('platform.accounts.filters.allOrganizations')}
            options={[
              { value: 'none', label: t('platform.accounts.noOrganization') },
              ...(organizations.data?.items ?? []).map((o) => ({ value: o.id, label: o.name })),
            ]}
            onChange={setOrganization}
            wide
          />
          <FilterSelect
            id="platform-accounts-role"
            label={t('platform.accounts.filters.role')}
            value={role}
            allLabel={t('platform.accounts.filters.allRoles')}
            options={ACCOUNT_ROLES.map((value) => ({ value, label: t(ROLE_LABEL_KEYS[value]) }))}
            onChange={(next) => setRole(next as (typeof ACCOUNT_ROLES)[number] | null)}
          />
          <FilterSelect
            id="platform-accounts-admin"
            label={t('platform.accounts.filters.instanceAdmin')}
            value={adminFilter}
            allLabel={t('platform.accounts.filters.allAdmin')}
            options={ADMIN_FILTERS.map((value) => ({ value, label: t(ADMIN_LABEL_KEYS[value]) }))}
            onChange={(next) => setAdminFilter(next as (typeof ADMIN_FILTERS)[number] | null)}
          />
          {filtering && (
            <button type="button" onClick={clearFilters} className={`text-sm ${linkAccent}`}>
              {t('platform.accounts.filters.clear')}
            </button>
          )}
        </div>
        {selected.size > 0 && (
          <div
            role="group"
            aria-label={t('platform.accounts.bulk.label')}
            className={`flex flex-wrap items-center gap-2 border-b px-5 py-2.5 ${panelDivider}`}
          >
            <span className="text-sm font-medium text-paper-ink dark:text-fg">
              {t('platform.accounts.bulk.selected', { count: selected.size })}
            </span>
            {BULK_ACTIONS.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => setBulk(action)}
                className={btnSecondary}
              >
                {t(BULK_LABEL_KEYS[action])}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected(new Map())}
              className={`text-sm ${linkAccent}`}
            >
              {t('platform.accounts.bulk.clear')}
            </button>
          </div>
        )}
        {accounts.error ? (
          <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
            {accounts.error.message}
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {accounts.loading
              ? t('common.loading')
              : search
                ? t('common.toolbar.noSearchResults', { query: search })
                : filtered
                  ? t('platform.accounts.emptyFiltered')
                  : t('platform.accounts.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto" aria-busy={accounts.loading}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th scope="col" className={`${panelTh} w-10`}>
                    <input
                      type="checkbox"
                      checked={allOnPage}
                      ref={(input) => {
                        if (input) input.indeterminate = someOnPage && !allOnPage
                      }}
                      disabled={selectable.length === 0}
                      onChange={(e) => toggle(selectable, e.target.checked)}
                      aria-label={t('platform.accounts.bulk.selectPage')}
                      className="h-4 w-4 accent-accent-fg"
                    />
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.accounts.columns.account')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.accounts.columns.organizations')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.accounts.columns.roles')}
                  </th>
                  <th scope="col" className={`${panelTh} whitespace-nowrap text-center`}>
                    {t('platform.accounts.columns.instanceAdmin')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.accounts.columns.status')}
                  </th>
                  <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                    {t('common.lastLogin.column')}
                  </th>
                  <th scope="col" className={panelActionsTh}>
                    {t('common.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {items.map((account) => {
                  const suspended = account.suspended_at !== null
                  const name = account.full_name || account.email
                  return (
                    <tr
                      key={account.user_id}
                      className={`${panelTr} ${suspended ? 'text-paper-ink/60 dark:text-fg-faint' : ''}`}
                    >
                      <td className={panelTd}>
                        {account.user_id !== user?.id && (
                          <input
                            type="checkbox"
                            checked={selected.has(account.user_id)}
                            onChange={(e) => toggle([account], e.target.checked)}
                            aria-label={t('platform.accounts.bulk.selectOne', { name })}
                            className="h-4 w-4 accent-accent-fg"
                          />
                        )}
                      </td>
                      <td className={panelTd}>
                        <span className="block font-semibold text-paper-ink dark:text-fg">
                          {name}
                          {account.user_id === user?.id && (
                            <span className="ml-1.5 text-sm font-normal text-paper-ink/60 dark:text-fg-muted">
                              {t('admin.usersAndRoles.youSuffix')}
                            </span>
                          )}
                        </span>
                        <span className="block text-paper-ink/60 dark:text-fg-muted">
                          {account.email}
                        </span>
                      </td>
                      {account.organizations.length === 0 ? (
                        <td colSpan={2} className={panelTd}>
                          <span className="text-paper-ink/60 dark:text-fg-muted">
                            {t('platform.accounts.noOrganization')}
                          </span>
                        </td>
                      ) : (
                        <>
                          {/* One line per organization in both cells, the
                              same height, so each organization's roles sit
                              level with its name. */}
                          <td className={panelTd}>
                            <ul>
                              {account.organizations.map((organization) => (
                                <li key={organization.id} className={orgLine}>
                                  <span
                                    className={`truncate font-medium ${organization.disabled ? 'text-paper-ink/60 line-through dark:text-fg-faint' : ''}`}
                                  >
                                    {organization.name}
                                  </span>
                                  {organization.disabled && (
                                    <span className={`${badgeBase} bg-danger/10 text-danger-fg`}>
                                      {t('admin.usersAndRoles.disabledBadge')}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td className={panelTd}>
                            <ul>
                              {account.organizations.map((organization) => (
                                <li key={organization.id} className={`${orgLine} gap-1`}>
                                  {organization.roles.map((role) => (
                                    <span key={role} className={roleChip}>
                                      <RoleIcon role={role} />
                                      {t(ROLE_LABEL_KEYS[role])}
                                    </span>
                                  ))}
                                </li>
                              ))}
                            </ul>
                          </td>
                        </>
                      )}
                      <td className={`${panelTd} text-center`}>
                        <RoleMark
                          held={account.is_instance_admin}
                          label={t('platform.accounts.adminBadge')}
                        />
                      </td>
                      <td className={panelTd}>
                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                          <span
                            aria-hidden="true"
                            className={`h-2 w-2 rounded-full ${suspended ? 'bg-danger' : 'bg-success'}`}
                          />
                          {suspended ? (
                            <span className="text-danger-fg">
                              {t('platform.accounts.suspendedBadge')}
                            </span>
                          ) : (
                            <span className="text-paper-ink/80 dark:text-fg-muted">
                              {t('platform.accounts.activeStatus')}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={panelTd}>
                        <LastLogin value={account.last_login_at} />
                      </td>
                      <td className={panelTd}>
                        <div className={actionsCellClass}>
                          <EditButton
                            label={t('platform.accounts.editLabel', { name })}
                            onClick={() =>
                              // The list's filters ride along, for "← Accounts".
                              navigate(`/platform/accounts/${account.user_id}`, {
                                state: { from: location.search },
                              })
                            }
                          />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {bulk && (
        <BulkAccountsModal
          action={bulk}
          accounts={[...selected.values()]}
          onClose={() => setBulk(null)}
          onDone={() => {
            setSelected(new Map())
            accounts.refetch()
          }}
        />
      )}
    </div>
  )
}
