import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { apiFetch } from '../../lib/api'
import {
  actionsCellClass,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
} from '../../lib/buttonStyles'
import {
  panelActionsTh,
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type {
  InstanceOrganization,
  InstanceOrganizationListResponse,
  InstanceProgramManagerListResponse,
  InstanceSettings,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { EditButton } from '../common/EditButton'
import { HelpText } from '../common/HelpText'
import { IconButton } from '../common/IconButton'
import { Modal } from '../common/Modal'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { TableToolbar } from '../common/TableToolbar'
import { atLimit, labelClass, useErrorMessage } from './platformCommon'

/** An organization created for an existing account, which founds it: its
 * Program Manager and one of its Planners, its email domain the
 * organization's. The instance administrator doesn't join it. */
function CreateOrganizationForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await apiFetch<InstanceOrganization>('/instance/organizations', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), program_manager_email: email.trim() }),
      })
      showToast(t('platform.organizations.created'))
      onCreated()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Panel
        title={t('platform.organizations.createTitle')}
        description={
          <HelpText
            id="platform.organizations.createDescription"
            text={t('platform.organizations.createDescription')}
          />
        }
        footer={
          <div className={panelFormActions}>
            <button type="button" onClick={onCancel} className={btnSecondary}>
              {t('platform.organizations.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || name.trim() === '' || email.trim() === ''}
              className={btnPrimary}
            >
              {submitting ? <ButtonSpinner /> : t('platform.organizations.createSubmit')}
            </button>
          </div>
        }
      >
        <div className="max-w-2xl space-y-4">
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="platform-organization-name">
              {t('platform.organizations.nameLabel')}
            </label>
            <input
              id="platform-organization-name"
              name="organization-name"
              autoComplete="off"
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputBase}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClass} htmlFor="platform-organization-pm">
              {t('platform.organizations.programManagerLabel')}
            </label>
            <input
              id="platform-organization-pm"
              name="program-manager-email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              placeholder={t('platform.organizations.programManagerPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="platform-organization-pm-hint"
              className={inputBase}
              required
            />
            <p
              id="platform-organization-pm-hint"
              className="text-xs text-paper-ink/60 dark:text-fg-faint"
            >
              {t('platform.organizations.programManagerHint')}
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

/** One organization from the operator's side: its domain (a Program
 * Manager can't change it) and its Exercise Program Managers -- never the
 * last one removed. Everything else stays in its own Admin. */
function OrganizationEditor({
  organization,
  onChanged,
  onDone,
}: {
  organization: InstanceOrganization
  onChanged: () => void
  onDone: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const managersUrl = `/instance/organizations/${organization.id}/program-managers`
  const managers = useApiResource<InstanceProgramManagerListResponse>(managersUrl)
  const [listed, setListed] = useState<InstanceProgramManagerListResponse | null>(null)
  const [domain, setDomain] = useState(organization.domain ?? '')
  const [savedDomain, setSavedDomain] = useState(organization.domain ?? '')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const items = (listed ?? managers.data)?.items ?? []

  async function run(action: () => Promise<void>) {
    setError(null)
    setBusy(true)
    try {
      await action()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function saveDomain(event: React.FormEvent) {
    event.preventDefault()
    void run(async () => {
      const next = await apiFetch<InstanceOrganization>(
        `/instance/organizations/${organization.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ domain: domain.trim() }),
        },
      )
      setDomain(next.domain ?? '')
      setSavedDomain(next.domain ?? '')
      showToast(t('platform.organizations.edit.domainSaved'))
      onChanged()
    })
  }

  function addManager(event: React.FormEvent) {
    event.preventDefault()
    void run(async () => {
      setListed(
        await apiFetch<InstanceProgramManagerListResponse>(managersUrl, {
          method: 'POST',
          body: JSON.stringify({ email: email.trim() }),
        }),
      )
      setEmail('')
      showToast(t('platform.organizations.edit.added'))
      onChanged()
    })
  }

  function removeManager(userId: string) {
    void run(async () => {
      setListed(
        await apiFetch<InstanceProgramManagerListResponse>(`${managersUrl}/${userId}`, {
          method: 'DELETE',
        }),
      )
      showToast(t('platform.organizations.edit.removed'))
      onChanged()
    })
  }

  return (
    <Panel
      title={organization.name}
      description={
        <HelpText
          id="platform.organizations.edit.description"
          text={t('platform.organizations.edit.description')}
        />
      }
      footer={
        <div className={panelFormActions}>
          <button type="button" onClick={onDone} className={btnSecondary}>
            {t('platform.organizations.edit.done')}
          </button>
        </div>
      }
    >
      <div className="max-w-2xl space-y-6">
        <form onSubmit={saveDomain} className="space-y-1.5">
          <label className={labelClass} htmlFor="platform-organization-domain">
            {t('platform.organizations.edit.domainLabel')}
          </label>
          <div className="flex gap-2">
            <input
              id="platform-organization-domain"
              name="domain"
              autoComplete="off"
              spellCheck={false}
              maxLength={255}
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              aria-describedby="platform-organization-domain-hint"
              className={`${inputBase} font-mono`}
              required
            />
            <button
              type="submit"
              disabled={busy || domain.trim() === '' || domain.trim() === savedDomain}
              className={btnPrimary}
            >
              {t('platform.organizations.edit.saveDomain')}
            </button>
          </div>
          <p
            id="platform-organization-domain-hint"
            className="text-xs text-paper-ink/60 dark:text-fg-faint"
          >
            {t('platform.organizations.edit.domainHint')}
          </p>
        </form>

        <section className="space-y-3" aria-labelledby="platform-organization-pms">
          <h3 id="platform-organization-pms" className="text-sm font-medium">
            {t('platform.organizations.edit.programManagersTitle')}
          </h3>
          {items.length === 0 && !managers.loading ? (
            <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {t('platform.organizations.edit.programManagersEmpty')}
            </p>
          ) : (
            <ul className="divide-y divide-paper-line rounded-sm border border-paper-line dark:divide-line dark:border-line">
              {items.map((manager) => {
                const name = manager.full_name || manager.email
                return (
                  <li key={manager.user_id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="block truncate text-paper-ink/60 dark:text-fg-muted">
                        {manager.email}
                        {manager.disabled && ` · ${t('platform.organizations.edit.disabled')}`}
                      </span>
                    </span>
                    <IconButton
                      label={t('platform.organizations.edit.removeLabel', { name })}
                      onClick={() => removeManager(manager.user_id)}
                      disabled={busy || items.length <= 1}
                    />
                  </li>
                )
              })}
            </ul>
          )}
          <form onSubmit={addManager} className="space-y-1.5">
            <label className={labelClass} htmlFor="platform-organization-add-pm">
              {t('platform.organizations.edit.addLabel')}
            </label>
            <div className="flex gap-2">
              <input
                id="platform-organization-add-pm"
                name="program-manager-email"
                type="email"
                autoComplete="off"
                spellCheck={false}
                placeholder={t('platform.organizations.edit.addPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-describedby="platform-organization-add-pm-hint"
                className={inputBase}
                required
              />
              <button type="submit" disabled={busy || email.trim() === ''} className={btnPrimary}>
                {t('platform.organizations.edit.addSubmit')}
              </button>
            </div>
            <p
              id="platform-organization-add-pm-hint"
              className="text-xs text-paper-ink/60 dark:text-fg-faint"
            >
              {t('platform.organizations.edit.addHint')}
            </p>
          </form>
        </section>
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    </Panel>
  )
}

/** Deleting an organization takes everything in it, so its name is typed
 * to confirm -- the same friction as the Program Manager's own delete. */
function DeleteOrganizationModal({
  organization,
  onClose,
  onDeleted,
}: {
  organization: InstanceOrganization
  onClose: () => void
  onDeleted: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setDeleting(true)
    try {
      await apiFetch(`/instance/organizations/${organization.id}`, { method: 'DELETE' })
      showToast(t('platform.organizations.delete.deleted'))
      onDeleted()
    } catch (err) {
      setError(errorMessage(err))
      setDeleting(false)
    }
  }

  return (
    <Modal titleId="platform-delete-org-title" onClose={onClose}>
      <form onSubmit={handleDelete} className="w-full max-w-sm space-y-3">
        <h2
          id="platform-delete-org-title"
          className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
        >
          {t('platform.organizations.delete.title')}
        </h2>
        <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
          {t('platform.organizations.delete.warning', { name: organization.name })}
        </p>
        <label className={labelClass} htmlFor="platform-delete-org-confirm">
          {t('platform.organizations.delete.confirmLabel', { name: organization.name })}
        </label>
        <input
          name="confirmation"
          id="platform-delete-org-confirm"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
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
            disabled={deleting || confirmation !== organization.name}
            className={`flex-1 ${btnDanger}`}
          >
            {deleting ? <ButtonSpinner /> : t('platform.organizations.delete.submit')}
          </button>
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
        </div>
      </form>
    </Modal>
  )
}

const ORGANIZATIONS_PAGE_SIZE = 20

/** Platform -> Organizations: every organization of the deployment, as
 * many as its tenancy rule leaves room for -- searched (name or domain),
 * sorted and paged on the server, all of it in the URL. The operator
 * creates one (naming its first Exercise Program Manager), edits its
 * domain and Program Managers, or deletes it. */
export function PlatformOrganizationsSection() {
  const { t, i18n } = useTranslation()
  const { refresh } = useAuth()
  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState()
  const settings = useApiResource<InstanceSettings>('/instance/settings')
  const params = new URLSearchParams({
    limit: String(ORGANIZATIONS_PAGE_SIZE),
    offset: String((page - 1) * ORGANIZATIONS_PAGE_SIZE),
    sort_by: sortBy,
    sort_dir: sortDir,
  })
  if (search) params.set('q', search)
  const organizations = useApiResource<InstanceOrganizationListResponse>(
    `/instance/organizations?${params}`,
  )
  const [creating, setCreating] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<InstanceOrganization | null>(null)

  const items = organizations.data?.items ?? []
  const total = organizations.data?.total ?? 0
  const totalPages = Math.ceil(total / ORGANIZATIONS_PAGE_SIZE)
  usePageFallback({ total, pageSize: ORGANIZATIONS_PAGE_SIZE, ready: organizations.data !== null })
  const editing = items.find((o) => o.id === editingId) ?? null
  const full = atLimit(settings.data)

  // A change may touch an organization the administrator also works in
  // (the context bar's list), and always the count under the rule.
  function reload() {
    settings.refetch()
    organizations.refetch()
    void refresh()
  }
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })

  if (creating) {
    return (
      <CreateOrganizationForm
        onCancel={() => setCreating(false)}
        onCreated={() => {
          setCreating(false)
          reload()
        }}
      />
    )
  }
  if (editing) {
    return (
      <OrganizationEditor
        key={editing.id}
        organization={editing}
        onChanged={reload}
        onDone={() => setEditingId(null)}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          title={t('platform.sections.organizations')}
          action={
            <button
              type="button"
              onClick={() => setCreating(true)}
              disabled={full}
              aria-describedby={full ? 'platform-organizations-limit' : undefined}
              className={btnPrimary}
            >
              <span aria-hidden="true">+ </span>
              {t('platform.organizations.create')}
            </button>
          }
        />
        <HelpText
          id="platform.organizations.description"
          text={t('platform.organizations.description')}
        />
        {full && (
          <p
            id="platform-organizations-limit"
            className="text-sm text-paper-ink/70 dark:text-fg-muted"
          >
            {t('platform.organizations.limitReached')}
          </p>
        )}
      </div>
      <Panel
        label={t('platform.sections.organizations')}
        meta={organizations.data ? t('platform.organizations.count', { count: total }) : undefined}
        aside={
          <TableToolbar
            sortDir={sortDir}
            sortBy={sortBy}
            onSortDirChange={setSortDir}
            onSortByChange={setSortBy}
            search={search}
            onSearchChange={setSearch}
          />
        }
        footer={
          totalPages > 1 ? (
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          ) : undefined
        }
        flush
      >
        {organizations.error ? (
          <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
            {organizations.error.message}
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {organizations.loading
              ? t('common.loading')
              : search
                ? t('common.toolbar.noSearchResults', { query: search })
                : t('platform.organizations.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto" aria-busy={organizations.loading}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th scope="col" className={panelTh}>
                    {t('platform.organizations.columns.name')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.organizations.columns.domain')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.organizations.columns.programManagers')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.organizations.columns.created')}
                  </th>
                  <th scope="col" className={panelActionsTh}>
                    {t('common.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {items.map((organization) => (
                  <tr key={organization.id} className={panelTr}>
                    <td className={`${panelTd} font-medium`}>{organization.name}</td>
                    <td className={`${panelTd} font-mono`}>{organization.domain ?? '—'}</td>
                    <td className={`${panelTd} tabular-nums`}>
                      {organization.program_manager_count}
                    </td>
                    <td className={`${panelTd} whitespace-nowrap`}>
                      {dateFormat.format(new Date(organization.created_at))}
                    </td>
                    <td className={panelTd}>
                      <div className={actionsCellClass}>
                        <EditButton
                          label={t('platform.organizations.editLabel', {
                            name: organization.name,
                          })}
                          onClick={() => setEditingId(organization.id)}
                        />
                        <IconButton
                          label={t('platform.organizations.deleteLabel', {
                            name: organization.name,
                          })}
                          onClick={() => setDeleting(organization)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {deleting && (
        <DeleteOrganizationModal
          organization={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
