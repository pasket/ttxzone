import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { useUndoableAction } from '../../hooks/useUndoableAction'
import { apiFetch, ApiError } from '../../lib/api'
import {
  actionsCellClass,
  btnDanger,
  btnNeutralIconGhost,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputCompact,
  inputDisabled,
} from '../../lib/buttonStyles'
import type { ContextRole } from '../../lib/moduleAccess'
import {
  panelActionsTh,
  panelFormActions,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import { PEOPLE_SORT_OPTIONS } from '../../lib/peopleTable'
import type {
  DomainAccount,
  DomainAccountListResponse,
  InstancePolicy,
  OrgMemberExerciseListResponse,
  OrgMemberListResponse,
  OrgMemberRead,
  OrgRole,
  OrgRoleInvitation,
  OrgRoleInvitationCreateResponse,
  OrgRoleInvitationListResponse,
  OrganizationTag,
  OrganizationTagListResponse,
} from '../../lib/types'
import { AcronymText } from '../common/AcronymText'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { EditButton } from '../common/EditButton'
import { HelpText } from '../common/HelpText'
import { IconButton } from '../common/IconButton'
import { LastLogin } from '../common/LastLogin'
import { Modal } from '../common/Modal'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { RestoreIcon } from '../common/RestoreIcon'
import { RoleColumnHeader, RoleMark } from '../common/RoleMatrix'
import { RoleGuide } from '../common/RoleGuide'
import { RoleIcon } from '../common/RoleIcon'
import { SectionHeader } from '../common/SectionHeader'
import { TableToolbar } from '../common/TableToolbar'
import { TagAssignmentField } from '../common/TagAssignmentField'
import { TagChip } from '../common/TagChip'

const PAGE_SIZE = 20

/** The matrix's columns, by role hierarchy. Each grant keeps its own API
 * route (Program Manager's asks for step-up and never drops to zero;
 * the others revoke in cascade from the organization's exercises). */
const ROLES: {
  role: OrgRole
  path: string
  icon: ContextRole
  column:
    | 'admin.usersAndRoles.columns.programManager'
    | 'admin.usersAndRoles.columns.planner'
    | 'admin.usersAndRoles.columns.observer'
    | 'admin.usersAndRoles.columns.evaluator'
  label: 'roles.programManager' | 'admin.sections.planners' | 'roles.observer' | 'roles.evaluator'
  hint:
    | 'admin.usersAndRoles.hints.programManager'
    | 'admin.usersAndRoles.hints.planner'
    | 'admin.usersAndRoles.hints.observer'
    | 'admin.usersAndRoles.hints.evaluator'
  guide:
    | 'admin.usersAndRoles.guide.programManager'
    | 'admin.usersAndRoles.guide.planner'
    | 'admin.usersAndRoles.guide.observer'
    | 'admin.usersAndRoles.guide.evaluator'
  /** The exercise role revoking this grant takes away. */
  exerciseRole: string | null
}[] = [
  {
    role: 'program_manager',
    path: 'program-managers',
    icon: 'program_manager',
    column: 'admin.usersAndRoles.columns.programManager',
    label: 'roles.programManager',
    hint: 'admin.usersAndRoles.hints.programManager',
    guide: 'admin.usersAndRoles.guide.programManager',
    exerciseRole: null,
  },
  {
    role: 'planner',
    path: 'planners',
    icon: 'planner',
    column: 'admin.usersAndRoles.columns.planner',
    label: 'admin.sections.planners',
    hint: 'admin.usersAndRoles.hints.planner',
    guide: 'admin.usersAndRoles.guide.planner',
    exerciseRole: 'planner',
  },
  {
    role: 'observer',
    path: 'observers',
    icon: 'observer',
    column: 'admin.usersAndRoles.columns.observer',
    label: 'roles.observer',
    hint: 'admin.usersAndRoles.hints.observer',
    guide: 'admin.usersAndRoles.guide.observer',
    exerciseRole: 'observer',
  },
  {
    role: 'evaluator',
    path: 'evaluators',
    icon: 'evaluator',
    column: 'admin.usersAndRoles.columns.evaluator',
    label: 'roles.evaluator',
    hint: 'admin.usersAndRoles.hints.evaluator',
    guide: 'admin.usersAndRoles.guide.evaluator',
    exerciseRole: 'evaluator',
  },
]

const ROLE_VALUES = ROLES.map((r) => r.role)
const STATUS_VALUES = ['active', 'disabled'] as const

const errorText = (err: unknown, fallback: string) =>
  err instanceof ApiError ? err.message : fallback

/** Admin -> Users and roles: everyone holding a role in the organization,
 * as a read-only matrix -- people in rows, roles in columns. A role here
 * authorizes: the exercise's team then assigns people to it on each
 * exercise. Roles and tags change in the person's editor (pencil);
 * removing a role takes it off every exercise of the organization.
 * Removing the person deletes them, or -- while they're still on
 * exercises -- disables them until they're taken off those. Every request
 * targets the organization selected in the context bar. */
export function AdminUsersAndRolesSection() {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const { user, activeOrganization, activeOrganizationId, refresh } = useAuth()
  const orgBase = `/organizations/${activeOrganizationId}`

  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState('', PEOPLE_SORT_OPTIONS)
  const [searchParams, setSearchParams] = useSearchParams()
  const rawRole = searchParams.get('role')
  const roleFilter = ROLE_VALUES.find((role) => role === rawRole) ?? null
  const rawStatus = searchParams.get('status')
  const statusFilter = STATUS_VALUES.find((status) => status === rawStatus) ?? null

  const [data, setData] = useState<OrgMemberListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [refreshTick, setRefreshTick] = useState(0)
  const total = data?.total ?? 0
  usePageFallback({ total, pageSize: PAGE_SIZE, ready: !loading })

  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState<OrgMemberRead | null>(null)
  const [deleting, setDeleting] = useState<OrgMemberRead | null>(null)
  const [enablingId, setEnablingId] = useState<string | null>(null)
  const [availableTags, setAvailableTags] = useState<OrganizationTag[]>([])
  const triggerRefs = useRef<Map<string, HTMLElement>>(new Map())
  // Newcomers from the organization's allowed domains with no role yet --
  // only where accounts can't found their own organization (the server
  // answers empty in "open").
  const [addingEmail, setAddingEmail] = useState('')
  const newcomers = useApiResource<DomainAccountListResponse>(
    activeOrganizationId && user?.can_found_organization === false
      ? `${orgBase}/domain-accounts`
      : null,
  )
  // Where accounts found their own organizations ("open"), people outside
  // the organization's own domain are invited, not added: their offers
  // wait here until they answer.
  const policy = useApiResource<InstancePolicy>('/instance/policy')
  const invitesOutside =
    policy.data?.tenancy_mode === 'open' ? (activeOrganization?.domain ?? '') : null
  const invitations = useApiResource<OrgRoleInvitationListResponse>(
    activeOrganizationId ? `${orgBase}/role-invitations` : null,
  )

  useEffect(() => {
    if (!activeOrganizationId) return
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String((page - 1) * PAGE_SIZE),
          sort_dir: sortDir,
          sort_by: sortBy,
          q: search,
        })
        if (roleFilter) params.set('role', roleFilter)
        if (statusFilter) params.set('status', statusFilter)
        const next = await apiFetch<OrgMemberListResponse>(`${orgBase}/members?${params}`)
        if (!cancelled) {
          setData(next)
          setLoadError(false)
        }
      } catch {
        if (!cancelled) setLoadError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [
    orgBase,
    activeOrganizationId,
    page,
    sortDir,
    sortBy,
    search,
    roleFilter,
    statusFilter,
    refreshTick,
  ])

  useEffect(() => {
    if (!activeOrganizationId) return
    let cancelled = false
    async function loadTags() {
      try {
        const tags = await apiFetch<OrganizationTagListResponse>(
          `${orgBase}/tags?limit=200&offset=0`,
        )
        if (!cancelled) setAvailableTags(tags.items)
      } catch {
        // No tag picker rather than a broken page.
      }
    }
    void loadTags()
    return () => {
      cancelled = true
    }
  }, [orgBase, activeOrganizationId])

  if (!activeOrganization?.is_program_manager) return null

  const reload = () => setRefreshTick((tick) => tick + 1)

  function setFilter(key: 'role' | 'status', value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (value) next.set(key, value)
        else next.delete(key)
        next.delete('page')
        return next
      },
      { replace: true },
    )
  }

  function focusTrigger(key: string) {
    triggerRefs.current.get(key)?.focus()
  }

  async function enable(member: OrgMemberRead) {
    setEnablingId(member.user_id)
    try {
      await apiFetch(`${orgBase}/members/${member.user_id}/enable`, { method: 'POST' })
      showToast(t('admin.usersAndRoles.enabledToast', { name: member.full_name }))
      reload()
    } catch (err) {
      showToast(errorText(err, t('auth.common.genericError')), { variant: 'error' })
    } finally {
      setEnablingId(null)
    }
  }

  const items = data?.items ?? []
  const counts = data?.role_counts ?? {}
  const managerCount = counts.program_manager ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  if (adding) {
    return (
      <AddPersonForm
        orgBase={orgBase}
        availableTags={availableTags}
        initialEmail={addingEmail}
        suggestions={newcomers.data?.items ?? []}
        invitesOutside={invitesOutside}
        onClose={() => {
          setAdding(false)
          setAddingEmail('')
        }}
        onAdded={(outcome) => {
          setAdding(false)
          setAddingEmail('')
          if (outcome === 'invited') {
            invitations.refetch()
            return
          }
          newcomers.refetch()
          // Newest first, so the new row is on page 1.
          if (page === 1 && sortDir === 'desc' && sortBy === 'created_at') reload()
          else {
            setSortBy('created_at')
            setSortDir('desc')
          }
          void refresh()
        }}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          title={t('admin.usersAndRoles.title')}
          action={
            <button type="button" onClick={() => setAdding(true)} className={btnPrimary}>
              <span aria-hidden="true">+ </span>
              {t('admin.usersAndRoles.addPerson')}
            </button>
          }
        />
        <RoleGuide
          id="admin.usersAndRoles.intro"
          intro={t('admin.usersAndRoles.intro')}
          items={ROLES.map((r) => ({ role: r.icon, name: t(r.column), description: t(r.guide) }))}
          footnote={t('admin.usersAndRoles.guideFootnote')}
        />
      </div>

      <Panel
        label={t('admin.usersAndRoles.title')}
        meta={loading && !data ? undefined : t('admin.usersAndRoles.count', { count: total })}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="users-and-roles-role-filter">
              {t('admin.usersAndRoles.roleFilter')}
            </label>
            <div className="w-56">
              <select
                id="users-and-roles-role-filter"
                name="role"
                value={roleFilter ?? ''}
                onChange={(e) => setFilter('role', e.target.value)}
                className={`${inputCompact} text-sm`}
              >
                <option value="">{t('admin.usersAndRoles.allRoles')}</option>
                {ROLES.map((r) => (
                  <option key={r.role} value={r.role}>
                    {t(r.label)}
                  </option>
                ))}
              </select>
            </div>
            <label className="sr-only" htmlFor="users-and-roles-status-filter">
              {t('admin.usersAndRoles.statusFilter')}
            </label>
            <div className="w-56">
              <select
                id="users-and-roles-status-filter"
                name="status"
                value={statusFilter ?? ''}
                onChange={(e) => setFilter('status', e.target.value)}
                className={`${inputCompact} text-sm`}
              >
                <option value="">{t('admin.usersAndRoles.allStatuses')}</option>
                <option value="active">{t('admin.usersAndRoles.statusActive')}</option>
                <option value="disabled">{t('admin.usersAndRoles.statusDisabled')}</option>
              </select>
            </div>
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              sortOptions={PEOPLE_SORT_OPTIONS}
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
        {loadError && !data && (
          <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
            {t('admin.usersAndRoles.loadError')}
          </p>
        )}
        {data && items.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {search
              ? t('common.toolbar.noSearchResults', { query: search })
              : t('admin.usersAndRoles.empty')}
          </p>
        )}
        {items.length > 0 && (
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="w-full min-w-[56rem] text-left">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th scope="col" className={`${panelTh} sticky left-0 z-10 bg-panel`}>
                    {t('admin.usersAndRoles.columns.person')}
                  </th>
                  {ROLES.map((r) => (
                    <RoleColumnHeader
                      key={r.role}
                      icon={r.icon}
                      count={counts[r.role] ?? 0}
                      label={t(r.column)}
                      hint={t(r.hint)}
                    />
                  ))}
                  <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                    {t('common.lastLogin.column')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('admin.usersAndRoles.columns.tags')}
                  </th>
                  <th scope="col" className={panelActionsTh}>
                    {t('common.table.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {items.map((member) => (
                  <tr
                    key={member.user_id}
                    className={`${panelTr} ${member.disabled ? 'text-paper-ink/60 dark:text-fg-faint' : ''}`}
                  >
                    <th
                      scope="row"
                      className={`${panelTd} sticky left-0 z-10 bg-panel text-left font-normal`}
                    >
                      <span className="block font-semibold text-paper-ink dark:text-fg">
                        {member.full_name}
                        {member.user_id === user?.id && (
                          <span className="ml-1.5 text-sm font-normal text-paper-ink/60 dark:text-fg-muted">
                            {t('admin.usersAndRoles.youSuffix')}
                          </span>
                        )}
                        {member.disabled && (
                          <span
                            title={t('admin.usersAndRoles.disabledHint')}
                            className="ml-2 inline-flex h-5 items-center rounded-xs bg-danger/10 px-1.5 align-middle text-xs font-medium text-danger-fg"
                          >
                            {t('admin.usersAndRoles.disabledBadge')}
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-paper-ink/70 dark:text-fg-muted">
                        {member.email}
                      </span>
                    </th>
                    {ROLES.map((r) => (
                      <td key={r.role} className={`${panelTd} text-center`}>
                        <RoleMark
                          held={member.roles.includes(r.role)}
                          label={t('admin.usersAndRoles.cellLabel', {
                            role: t(r.label),
                            name: member.full_name,
                          })}
                        />
                      </td>
                    ))}
                    <td className={panelTd}>
                      <LastLogin value={member.last_login_at} />
                    </td>
                    <td className={panelTd}>
                      <div className="flex flex-wrap gap-1">
                        {member.tags.map((tag) => (
                          <TagChip
                            key={tag.id}
                            name={tag.name}
                            color={tag.color}
                            customHex={tag.custom_hex}
                          />
                        ))}
                      </div>
                    </td>
                    <td className={panelTd}>
                      <div className={actionsCellClass}>
                        {member.disabled ? (
                          <button
                            type="button"
                            onClick={() => void enable(member)}
                            disabled={enablingId !== null}
                            aria-label={t('admin.usersAndRoles.enableLabel', {
                              name: member.full_name,
                            })}
                            title={t('admin.usersAndRoles.enableLabel', {
                              name: member.full_name,
                            })}
                            className={btnNeutralIconGhost}
                          >
                            {enablingId === member.user_id ? <ButtonSpinner /> : <RestoreIcon />}
                          </button>
                        ) : (
                          <EditButton
                            ref={(node) => {
                              if (node) triggerRefs.current.set(`edit-${member.user_id}`, node)
                            }}
                            label={t('admin.usersAndRoles.editLabel', { name: member.full_name })}
                            onClick={() => setEditing(member)}
                          />
                        )}
                        <IconButton
                          label={t('admin.usersAndRoles.deleteLabel', { name: member.full_name })}
                          onClick={(event) => {
                            triggerRefs.current.set(`delete-${member.user_id}`, event.currentTarget)
                            setDeleting(member)
                          }}
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

      {(newcomers.data?.items.length ?? 0) > 0 && (
        <Panel
          title={t('admin.usersAndRoles.newcomers.title')}
          description={
            <HelpText
              id="admin.usersAndRoles.newcomers.description"
              text={t('admin.usersAndRoles.newcomers.description')}
            />
          }
          flush
        >
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th scope="col" className={panelTh}>
                    {t('admin.usersAndRoles.newcomers.person')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('admin.usersAndRoles.newcomers.lastLogin')}
                  </th>
                  <th scope="col" className={panelActionsTh}>
                    <span className="sr-only">{t('admin.usersAndRoles.newcomers.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {newcomers.data?.items.map((account) => (
                  <tr key={account.user_id} className={panelTr}>
                    <td className={panelTd}>
                      <span className="block font-medium">{account.full_name}</span>
                      <span className="block text-paper-ink/60 dark:text-fg-muted">
                        {account.email}
                      </span>
                    </td>
                    <td className={panelTd}>
                      <LastLogin value={account.last_login_at} />
                    </td>
                    <td className={`${panelTd} text-right`}>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingEmail(account.email)
                          setAdding(true)
                        }}
                        className={btnSecondary}
                      >
                        {t('admin.usersAndRoles.newcomers.giveRole')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <PendingInvitationsPanel
        orgBase={orgBase}
        items={invitations.data?.items ?? []}
        onChanged={invitations.refetch}
      />

      {editing && (
        <EditPersonModal
          member={editing}
          orgBase={orgBase}
          availableTags={availableTags}
          lastManager={editing.roles.includes('program_manager') && managerCount <= 1}
          onClose={() => {
            const id = editing.user_id
            setEditing(null)
            focusTrigger(`edit-${id}`)
          }}
          onSaved={async (lostAdmin) => {
            const isYou = editing.user_id === user?.id
            setEditing(null)
            showToast(t('common.toast.savedSuccess'))
            if (isYou) await refresh()
            if (isYou && lostAdmin) navigate('/')
            else reload()
          }}
        />
      )}

      {deleting && (
        <DeletePersonModal
          member={deleting}
          orgBase={orgBase}
          organizationName={activeOrganization.organization_name}
          onClose={() => {
            const id = deleting.user_id
            setDeleting(null)
            focusTrigger(`delete-${id}`)
          }}
          onDone={async (status) => {
            const isYou = deleting.user_id === user?.id
            showToast(
              status === 'deleted'
                ? t('admin.usersAndRoles.deletedToast', { name: deleting.full_name })
                : t('admin.usersAndRoles.disabledToast', { name: deleting.full_name }),
            )
            setDeleting(null)
            if (isYou) {
              await refresh()
              navigate('/')
            } else reload()
          }}
        />
      )}
    </div>
  )
}

/** Section 1 of the person's editor and of Add person: one checkbox per
 * role with what it allows. */
function RolesFieldset({
  selected,
  onToggle,
  disabled,
  lockedReason,
}: {
  selected: Set<OrgRole>
  onToggle: (role: OrgRole) => void
  disabled: boolean
  /** Roles that can't be unticked, and why. */
  lockedReason?: Partial<Record<OrgRole, string>>
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-2.5">
      <legend className="mb-2 text-sm font-semibold text-paper-ink dark:text-fg">
        {t('admin.usersAndRoles.sectionRoles')}
      </legend>
      {ROLES.map((r) => {
        const reason = lockedReason?.[r.role]
        return (
          <label
            key={r.role}
            title={reason}
            className={`flex items-start gap-2.5 text-sm ${reason ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              name={`role-${r.role}`}
              checked={selected.has(r.role)}
              onChange={() => onToggle(r.role)}
              disabled={disabled || reason !== undefined}
              className="mt-0.5 h-4 w-4 accent-accent-fg"
            />
            <span>
              <span className="inline-flex items-center gap-1.5 font-medium text-paper-ink dark:text-fg">
                <RoleIcon role={r.icon} />
                <span>
                  <AcronymText text={t(r.column)} />
                </span>
              </span>
              <span className="block text-paper-ink/60 dark:text-fg-muted">
                {reason ?? t(r.hint)}
              </span>
            </span>
          </label>
        )
      })}
      <p className="text-xs text-paper-ink/60 dark:text-fg-faint">
        {t('admin.usersAndRoles.domainHint')}
      </p>
    </fieldset>
  )
}

function TagsFieldset({
  availableTags,
  selected,
  onChange,
}: {
  availableTags: OrganizationTag[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const { t } = useTranslation()
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-paper-ink dark:text-fg">
        {t('admin.usersAndRoles.sectionTags')}
      </legend>
      <TagAssignmentField
        availableTags={availableTags}
        selectedTagIds={selected}
        onChange={onChange}
      />
    </fieldset>
  )
}

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set)
  if (next.has(value)) next.delete(value)
  else next.add(value)
  return next
}

/** The organization's offers still waiting for an answer: the address the
 * Program Manager typed and the roles, nothing about any account. Hidden
 * while there are none. Withdraw with Undo. */
function PendingInvitationsPanel({
  orgBase,
  items,
  onChanged,
}: {
  orgBase: string
  items: OrgRoleInvitation[]
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const runUndoable = useUndoableAction()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const visible = items.filter((item) => !hidden.has(item.id))
  if (visible.length === 0) return null

  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' })
  const roleNames = (roles: OrgRole[]) =>
    ROLES.filter((def) => roles.includes(def.role))
      .map((def) => t(def.label))
      .join(', ')

  function withdraw(item: OrgRoleInvitation) {
    runUndoable({
      message: t('admin.usersAndRoles.invitations.withdrawnToast', { email: item.email }),
      undoLabel: t('common.toast.undo'),
      onRemove: () => setHidden((prev) => new Set(prev).add(item.id)),
      onRestore: () =>
        setHidden((prev) => {
          const next = new Set(prev)
          next.delete(item.id)
          return next
        }),
      onCommit: async () => {
        try {
          await apiFetch(`${orgBase}/role-invitations/${item.id}`, { method: 'DELETE' })
          onChanged()
        } catch (err) {
          setHidden((prev) => {
            const next = new Set(prev)
            next.delete(item.id)
            return next
          })
          showToast(errorText(err, t('auth.common.genericError')), { variant: 'error' })
        }
      },
    })
  }

  return (
    <Panel
      title={t('admin.usersAndRoles.invitations.title')}
      meta={t('admin.usersAndRoles.invitations.count', { count: visible.length })}
      description={
        <HelpText
          id="admin.usersAndRoles.invitations.description"
          text={t('admin.usersAndRoles.invitations.description')}
        />
      }
      flush
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className={panelTableHeadRow}>
              <th scope="col" className={panelTh}>
                {t('admin.usersAndRoles.invitations.email')}
              </th>
              <th scope="col" className={panelTh}>
                {t('admin.usersAndRoles.invitations.roles')}
              </th>
              <th scope="col" className={panelTh}>
                {t('admin.usersAndRoles.invitations.invitedBy')}
              </th>
              <th scope="col" className={panelTh}>
                {t('admin.usersAndRoles.invitations.expires')}
              </th>
              <th scope="col" className={panelActionsTh}>
                <span className="sr-only">{t('admin.usersAndRoles.invitations.actions')}</span>
              </th>
            </tr>
          </thead>
          <tbody className={panelTbody}>
            {visible.map((item) => (
              <tr key={item.id} className={panelTr}>
                <td className={`${panelTd} font-medium`}>{item.email}</td>
                <td className={panelTd}>{roleNames(item.roles)}</td>
                <td className={panelTd}>{item.invited_by_name ?? '—'}</td>
                <td className={panelTd}>{date.format(new Date(item.expires_at))}</td>
                <td className={panelTd}>
                  <div className={actionsCellClass}>
                    <IconButton
                      label={t('admin.usersAndRoles.invitations.withdrawLabel', {
                        email: item.email,
                      })}
                      onClick={() => withdraw(item)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** Create pattern: replaces the list while open. One email, its roles and
 * tags, in one request: the server grants them at once, or -- where
 * accounts found their own organizations, outside the organization's own
 * domain -- offers them for the person to accept ("invited"). */
function AddPersonForm({
  orgBase,
  availableTags,
  initialEmail = '',
  suggestions = [],
  invitesOutside = null,
  onClose,
  onAdded,
}: {
  orgBase: string
  availableTags: OrganizationTag[]
  /** A newcomer picked from the allowed-domain list. */
  initialEmail?: string
  /** Accounts from the allowed domains without a role, offered as the
   * email field's suggestions (empty in "open"). */
  suggestions?: DomainAccount[]
  /** The organization's own domain where people outside it are invited
   * rather than added ("open" tenancy); null otherwise. */
  invitesOutside?: string | null
  onClose: () => void
  onAdded: (outcome: OrgRoleInvitationCreateResponse['outcome']) => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const [email, setEmail] = useState(initialEmail)
  const [selected, setSelected] = useState<Set<OrgRole>>(new Set())
  const [tags, setTags] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    emailRef.current?.focus()
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    const roles = ROLES.filter((def) => selected.has(def.role)).map((def) => def.role)
    try {
      const result = await apiFetch<OrgRoleInvitationCreateResponse>(
        `${orgBase}/role-invitations`,
        {
          method: 'POST',
          body: JSON.stringify({ email, roles, tag_ids: Array.from(tags) }),
        },
      )
      showToast(
        result.outcome === 'invited'
          ? t('admin.usersAndRoles.invitedToast', { email: email.trim().toLowerCase() })
          : t('admin.usersAndRoles.addedToast', { count: roles.length }),
      )
      onAdded(result.outcome)
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose()
      }}
    >
      <Panel
        title={t('admin.usersAndRoles.addTitle')}
        description={
          invitesOutside
            ? t('admin.usersAndRoles.addDescriptionInvite', { domain: invitesOutside })
            : t('admin.usersAndRoles.addDescription')
        }
        footer={
          <div className={panelFormActions}>
            <button type="button" onClick={onClose} className={btnSecondary}>
              {t('common.confirmButton.cancel')}
            </button>
            <button
              type="submit"
              disabled={submitting || selected.size === 0}
              className={btnPrimary}
            >
              {submitting ? <ButtonSpinner /> : t('admin.usersAndRoles.addSubmit')}
            </button>
          </div>
        }
      >
        <div className="max-w-xl space-y-6">
          <div className="space-y-2">
            <label className="block text-sm" htmlFor="users-and-roles-email">
              {invitesOutside
                ? t('admin.usersAndRoles.emailLabelInvite')
                : t('admin.usersAndRoles.emailLabel')}
            </label>
            <input
              ref={emailRef}
              id="users-and-roles-email"
              name="email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('admin.usersAndRoles.emailPlaceholder')}
              disabled={submitting}
              className={submitting ? inputDisabled : inputBase}
              list={suggestions.length > 0 ? 'users-and-roles-email-suggestions' : undefined}
            />
            {suggestions.length > 0 && (
              <datalist id="users-and-roles-email-suggestions">
                {suggestions.map((account) => (
                  <option key={account.user_id} value={account.email}>
                    {account.full_name}
                  </option>
                ))}
              </datalist>
            )}
          </div>
          <RolesFieldset
            selected={selected}
            onToggle={(role) => setSelected((prev) => toggled(prev, role))}
            disabled={submitting}
          />
          <TagsFieldset availableTags={availableTags} selected={tags} onChange={setTags} />
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

/** The person's editor: 1. Roles, 2. Tags, one Save. Removing a role
 * says which exercises lose them; removing Program Manager asks for the
 * full name. */
function EditPersonModal({
  member,
  orgBase,
  availableTags,
  lastManager,
  onClose,
  onSaved,
}: {
  member: OrgMemberRead
  orgBase: string
  availableTags: OrganizationTag[]
  lastManager: boolean
  onClose: () => void
  onSaved: (lostAdmin: boolean) => Promise<void>
}) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<Set<OrgRole>>(() => new Set(member.roles))
  const [tags, setTags] = useState<Set<string>>(() => new Set(member.tags.map((tag) => tag.id)))
  const [exercises, setExercises] = useState<OrgMemberExerciseListResponse['items']>([])
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    apiFetch<OrgMemberExerciseListResponse>(`${orgBase}/members/${member.user_id}/exercises`)
      .then((res) => {
        if (!cancelled) setExercises(res.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [orgBase, member.user_id])

  const removed = ROLES.filter((r) => member.roles.includes(r.role) && !selected.has(r.role))
  const added = ROLES.filter((r) => !member.roles.includes(r.role) && selected.has(r.role))
  const removingManager = removed.some((r) => r.role === 'program_manager')
  const cascades = removed
    .map((r) => ({
      role: t(r.label),
      // A team member who is also an exercise's Evaluator / Observer
      // loses that role there too (and stays on the team).
      codes: exercises
        .filter(
          (e) =>
            e.role === r.exerciseRole ||
            (e.role === 'planner' &&
              ((r.exerciseRole === 'evaluator' && e.evaluates) ||
                (r.exerciseRole === 'observer' && e.observes))),
        )
        .map((e) => `${e.code} ${e.name}`),
    }))
    .filter((c) => c.codes.length > 0)
  const initialTags = new Set(member.tags.map((tag) => tag.id))
  const tagsChanged = tags.size !== initialTags.size || [...tags].some((id) => !initialTags.has(id))

  async function save() {
    setBusy(true)
    setErrors([])
    const failed: string[] = []
    for (const r of added) {
      try {
        await apiFetch(`${orgBase}/${r.path}`, {
          method: 'POST',
          body: JSON.stringify({ email: member.email }),
        })
      } catch (err) {
        failed.push(
          t('admin.usersAndRoles.roleError', {
            role: t(r.label),
            message: errorText(err, t('auth.common.genericError')),
          }),
        )
      }
    }
    if (tagsChanged) {
      try {
        await apiFetch(`${orgBase}/members/${member.user_id}/tags`, {
          method: 'PUT',
          body: JSON.stringify({ tag_ids: Array.from(tags) }),
        })
      } catch (err) {
        failed.push(errorText(err, t('auth.common.genericError')))
      }
    }
    // Revokes last: the person may lose every grant (and leave the list).
    for (const r of removed) {
      try {
        await apiFetch(`${orgBase}/${r.path}/${member.user_id}`, { method: 'DELETE' })
      } catch (err) {
        failed.push(
          t('admin.usersAndRoles.roleError', {
            role: t(r.label),
            message: errorText(err, t('auth.common.genericError')),
          }),
        )
      }
    }
    setBusy(false)
    if (failed.length === 0) await onSaved(removingManager)
    else setErrors(failed)
  }

  const nothingChanged = removed.length === 0 && added.length === 0 && !tagsChanged
  const needsName = removingManager && confirmation !== member.full_name

  return (
    <Modal titleId="edit-person-title" onClose={onClose} size="lg">
      <div className="w-full space-y-6">
        <div className="space-y-1">
          <h2 id="edit-person-title" className="text-balance text-lg font-semibold tracking-tight">
            {t('admin.usersAndRoles.editTitle', { name: member.full_name })}
          </h2>
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">{member.email}</p>
        </div>
        <RolesFieldset
          selected={selected}
          onToggle={(role) => setSelected((prev) => toggled(prev, role))}
          disabled={busy}
          lockedReason={
            lastManager
              ? { program_manager: t('admin.organization.programManagers.lastOneHint') }
              : undefined
          }
        />
        {cascades.length > 0 && (
          <div
            role="status"
            className="space-y-1 rounded-sm border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-paper-ink dark:text-fg"
          >
            {cascades.map((c) => (
              <p key={c.role}>
                {t('admin.usersAndRoles.cascadeWarning', {
                  role: c.role,
                  exercises: c.codes.join(', '),
                })}
              </p>
            ))}
          </div>
        )}
        {removingManager && (
          <div className="space-y-1.5">
            <label className="block text-sm" htmlFor="edit-person-confirm">
              {t('admin.organization.programManagers.removeConfirmLabel', {
                name: member.full_name,
              })}
            </label>
            <input
              id="edit-person-confirm"
              name="confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={member.full_name}
              className={inputBase}
            />
          </div>
        )}
        <TagsFieldset availableTags={availableTags} selected={tags} onChange={setTags} />
        {errors.length > 0 && (
          <ul className="space-y-1 text-sm text-danger-fg" aria-live="polite">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnSecondary}>
            {t('common.confirmButton.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || nothingChanged || needsName}
            className={btnPrimary}
          >
            {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Remove from the organization: typed full name. Says up front whether
 * the person goes for good or -- still on exercises -- is disabled; someone
 * already disabled and still on exercises gets only the list (nothing to do
 * until they're taken off them). */
function DeletePersonModal({
  member,
  orgBase,
  organizationName,
  onClose,
  onDone,
}: {
  member: OrgMemberRead
  orgBase: string
  organizationName: string
  onClose: () => void
  onDone: (status: 'deleted' | 'disabled') => Promise<void>
}) {
  const { t } = useTranslation()
  const [exercises, setExercises] = useState<OrgMemberExerciseListResponse['items'] | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    apiFetch<OrgMemberExerciseListResponse>(`${orgBase}/members/${member.user_id}/exercises`)
      .then((res) => {
        if (!cancelled) setExercises(res.items)
      })
      .catch(() => {
        if (!cancelled) setExercises([])
      })
    return () => {
      cancelled = true
    }
  }, [orgBase, member.user_id])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const result = await apiFetch<{ status: 'deleted' | 'disabled' }>(
        `${orgBase}/members/${member.user_id}`,
        { method: 'DELETE' },
      )
      await onDone(result.status)
    } catch (err) {
      setError(errorText(err, t('auth.common.genericError')))
      setBusy(false)
    }
  }

  const inUse = (exercises ?? []).map((e) => `${e.code} ${e.name}`)
  const alreadyDisabled = member.disabled && inUse.length > 0

  return (
    <Modal titleId="delete-person-title" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-3">
        <h2
          id="delete-person-title"
          className="text-balance text-lg font-semibold tracking-tight text-danger-fg"
        >
          {t('admin.usersAndRoles.deleteTitle')}
        </h2>
        {exercises === null ? (
          <ButtonSpinner />
        ) : inUse.length > 0 ? (
          <div className="space-y-2 text-sm text-paper-ink/70 dark:text-fg-muted">
            <p>
              {t(
                alreadyDisabled
                  ? 'admin.usersAndRoles.deleteAlreadyDisabled'
                  : 'admin.usersAndRoles.deleteInUse',
                { name: member.full_name, organization: organizationName },
              )}
            </p>
            <ul className="list-disc space-y-0.5 pl-5">
              {inUse.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
            {t('admin.usersAndRoles.deleteFree', {
              name: member.full_name,
              organization: organizationName,
            })}
          </p>
        )}
        {alreadyDisabled ? (
          <div className="flex justify-end">
            <button type="button" onClick={onClose} className={btnSecondary}>
              {t('admin.usersAndRoles.deleteClose')}
            </button>
          </div>
        ) : (
          <>
            <label className="block text-sm" htmlFor="delete-person-confirm">
              {t('admin.organization.programManagers.removeConfirmLabel', {
                name: member.full_name,
              })}
            </label>
            <input
              id="delete-person-confirm"
              name="confirmation"
              autoComplete="off"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={member.full_name}
              className={inputBase}
            />
            {error && (
              <p className="text-sm text-danger-fg" aria-live="polite">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || exercises === null || confirmation !== member.full_name}
                className={`flex-1 ${btnDanger}`}
              >
                {busy ? (
                  <ButtonSpinner />
                ) : inUse.length > 0 ? (
                  t('admin.usersAndRoles.disableSubmit')
                ) : (
                  t('admin.usersAndRoles.deleteSubmit')
                )}
              </button>
              <button type="button" onClick={onClose} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
            </div>
          </>
        )}
      </form>
    </Modal>
  )
}
