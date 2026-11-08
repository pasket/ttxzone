import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiDownload } from '../../hooks/useApiDownload'
import { useApiResource } from '../../hooks/useApiResource'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { API_BASE, apiFetch } from '../../lib/api'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputCompact,
  linkAccent,
  optionalSuffix,
} from '../../lib/buttonStyles'
import { LEGAL_TITLE_KEYS } from '../../lib/legal'
import { TARGET_LABEL_KEYS } from '../../lib/proposalLabels'
import {
  panelFormActions,
  panelFormFields,
  panelTableHeadRow,
  panelTbody,
  panelTd,
  panelTh,
  panelTr,
} from '../../lib/panelStyles'
import type {
  AuditRetention,
  AuditWebhook,
  AuditWebhookTest,
  PlatformAuditAction,
  PlatformAuditEvent,
  PlatformAuditListResponse,
  SortBy,
  TenancyMode,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { Modal } from '../common/Modal'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { TableToolbar } from '../common/TableToolbar'
import {
  badgeBase,
  labelClass,
  MODE_LABEL_KEYS,
  useErrorMessage,
  useUrlFilter,
} from './platformCommon'

const ACTIVITY_PAGE_SIZE = 50

// The log sorts by date only.
const DATE_SORT: readonly SortBy[] = ['created_at']

// The filter's two groups: what accounts do to sign in, and administration.
const AUTH_ACTIONS: PlatformAuditAction[] = [
  'auth.login',
  'auth.login_failed',
  'auth.login_locked',
  'auth.signup_locked',
  'auth.mfa_failed',
  'auth.mfa_locked',
  'auth.backup_code_login',
  'auth.step_up',
  'auth.step_up_failed',
  'auth.logout',
  'auth.register',
  'auth.password_change',
  'auth.totp_enable',
  'auth.totp_disable',
  'auth.backup_codes_regenerate',
  'auth.mfa_email_sent',
  'auth.mfa_email_enable',
  'auth.mfa_email_disable',
  'auth.mfa_preferred',
  'auth.mfa_skipped',
  'auth.sso_link',
  'auth.sso_unlink',
  'auth.token_create',
  'auth.token_revoke',
]

const ADMIN_ACTIONS: PlatformAuditAction[] = [
  'organization.create',
  'organization.domain',
  'organization.delete',
  'program_manager.grant',
  'program_manager.revoke',
  'account.create',
  'account.suspend',
  'account.reactivate',
  'account.update',
  'account.password_reset',
  'account.totp_reset',
  'account.sessions_end',
  'account.delete',
  'instance_admin.grant',
  'instance_admin.revoke',
  'legal.publish',
  'legal.acceptances_export',
  'tenancy.update',
  'security_policy.update',
  'free_email_domain.add',
  'free_email_domain.remove',
  'free_email_domain.enable',
  'free_email_domain.disable',
  'audit.export',
  'audit_webhook.update',
  'audit_webhook.rotate_secret',
  'audit_webhook.delete',
  'email.settings_update',
  'email.settings_delete',
  'email.test',
  'email.reconfirmation_update',
  'sso.settings_update',
  'sso.settings_delete',
  'sso.test',
  'assistant.settings_update',
  'assistant.proposal_accepted',
  'assistant.proposal_discarded',
]

// Organization and exercise work, done without a step-up.
const WORK_ACTIONS: PlatformAuditAction[] = [
  'organization.leave',
  'organization.allowed_domain',
  'library.item_delete',
  'exercise.delete',
  'exercise.member_joined',
  'exercise.needs_approved',
  'exercise.needs_approval_recorded',
  'exercise.scenario_applied',
  'exercise.aar_final',
  'exercise.aar_reopened',
]

const AUDIT_ACTIONS = [...AUTH_ACTIONS, ...ADMIN_ACTIONS, ...WORK_ACTIONS]

// Refused or blocked attempts, worth a second look.
const FAILED_ACTIONS: ReadonlySet<PlatformAuditAction> = new Set([
  'auth.login_failed',
  'auth.login_locked',
  'auth.signup_locked',
  'auth.mfa_failed',
  'auth.mfa_locked',
  'auth.step_up_failed',
])

const AUDIT_ACTION_KEYS = {
  'tenancy.update': 'platform.activity.actions.tenancy.update',
  'security_policy.update': 'platform.activity.actions.security_policy.update',
  'free_email_domain.add': 'platform.activity.actions.free_email_domain.add',
  'free_email_domain.remove': 'platform.activity.actions.free_email_domain.remove',
  'free_email_domain.enable': 'platform.activity.actions.free_email_domain.enable',
  'free_email_domain.disable': 'platform.activity.actions.free_email_domain.disable',
  'organization.create': 'platform.activity.actions.organization.create',
  'organization.domain': 'platform.activity.actions.organization.domain',
  'organization.delete': 'platform.activity.actions.organization.delete',
  'program_manager.grant': 'platform.activity.actions.program_manager.grant',
  'program_manager.revoke': 'platform.activity.actions.program_manager.revoke',
  'account.create': 'platform.activity.actions.account.create',
  'account.suspend': 'platform.activity.actions.account.suspend',
  'account.reactivate': 'platform.activity.actions.account.reactivate',
  'account.update': 'platform.activity.actions.account.update',
  'account.password_reset': 'platform.activity.actions.account.password_reset',
  'account.totp_reset': 'platform.activity.actions.account.totp_reset',
  'account.sessions_end': 'platform.activity.actions.account.sessions_end',
  'account.delete': 'platform.activity.actions.account.delete',
  'instance_admin.grant': 'platform.activity.actions.instance_admin.grant',
  'instance_admin.revoke': 'platform.activity.actions.instance_admin.revoke',
  'legal.publish': 'platform.activity.actions.legal.publish',
  'legal.acceptances_export': 'platform.activity.actions.legal.acceptances_export',
  'audit.export': 'platform.activity.actions.audit.export',
  'audit_webhook.update': 'platform.activity.actions.audit_webhook.update',
  'audit_webhook.rotate_secret': 'platform.activity.actions.audit_webhook.rotate_secret',
  'audit_webhook.delete': 'platform.activity.actions.audit_webhook.delete',
  'email.settings_update': 'platform.activity.actions.email.settings_update',
  'email.settings_delete': 'platform.activity.actions.email.settings_delete',
  'email.test': 'platform.activity.actions.email.test',
  'email.reconfirmation_update': 'platform.activity.actions.email.reconfirmation_update',
  'sso.settings_update': 'platform.activity.actions.sso.settings_update',
  'sso.settings_delete': 'platform.activity.actions.sso.settings_delete',
  'sso.test': 'platform.activity.actions.sso.test',
  'assistant.settings_update': 'platform.activity.actions.assistant.settings_update',
  'assistant.proposal_accepted': 'platform.activity.actions.assistant.proposal_accepted',
  'assistant.proposal_discarded': 'platform.activity.actions.assistant.proposal_discarded',
  'organization.leave': 'platform.activity.actions.organization.leave',
  'organization.allowed_domain': 'platform.activity.actions.organization.allowed_domain',
  'library.item_delete': 'platform.activity.actions.library.item_delete',
  'exercise.delete': 'platform.activity.actions.exercise.delete',
  'exercise.member_joined': 'platform.activity.actions.exercise.member_joined',
  'exercise.needs_approved': 'platform.activity.actions.exercise.needs_approved',
  'exercise.needs_approval_recorded': 'platform.activity.actions.exercise.needs_approval_recorded',
  'exercise.scenario_applied': 'platform.activity.actions.exercise.scenario_applied',
  'exercise.aar_final': 'platform.activity.actions.exercise.aar_final',
  'exercise.aar_reopened': 'platform.activity.actions.exercise.aar_reopened',
  'auth.login': 'platform.activity.actions.auth.login',
  'auth.login_failed': 'platform.activity.actions.auth.login_failed',
  'auth.login_locked': 'platform.activity.actions.auth.login_locked',
  'auth.signup_locked': 'platform.activity.actions.auth.signup_locked',
  'auth.mfa_failed': 'platform.activity.actions.auth.mfa_failed',
  'auth.mfa_locked': 'platform.activity.actions.auth.mfa_locked',
  'auth.backup_code_login': 'platform.activity.actions.auth.backup_code_login',
  'auth.logout': 'platform.activity.actions.auth.logout',
  'auth.register': 'platform.activity.actions.auth.register',
  'auth.password_change': 'platform.activity.actions.auth.password_change',
  'auth.totp_enable': 'platform.activity.actions.auth.totp_enable',
  'auth.totp_disable': 'platform.activity.actions.auth.totp_disable',
  'auth.backup_codes_regenerate': 'platform.activity.actions.auth.backup_codes_regenerate',
  'auth.mfa_email_sent': 'platform.activity.actions.auth.mfa_email_sent',
  'auth.mfa_email_enable': 'platform.activity.actions.auth.mfa_email_enable',
  'auth.mfa_email_disable': 'platform.activity.actions.auth.mfa_email_disable',
  'auth.mfa_preferred': 'platform.activity.actions.auth.mfa_preferred',
  'auth.mfa_skipped': 'platform.activity.actions.auth.mfa_skipped',
  'auth.step_up': 'platform.activity.actions.auth.step_up',
  'auth.step_up_failed': 'platform.activity.actions.auth.step_up_failed',
  'auth.sso_link': 'platform.activity.actions.auth.sso_link',
  'auth.sso_unlink': 'platform.activity.actions.auth.sso_unlink',
  'auth.token_create': 'platform.activity.actions.auth.token_create',
  'auth.token_revoke': 'platform.activity.actions.auth.token_revoke',
} as const satisfies Record<PlatformAuditAction, string>

const REASON_KEYS = {
  unknown_account: 'platform.activity.reasons.unknown_account',
  password: 'platform.activity.reasons.password',
  suspended: 'platform.activity.reasons.suspended',
  no_password: 'platform.activity.reasons.no_password',
  account_not_found: 'platform.activity.reasons.account_not_found',
  link_required: 'platform.activity.reasons.link_required',
  email_unverified: 'platform.activity.reasons.email_unverified',
  token_invalid: 'platform.activity.reasons.token_invalid',
  state_invalid: 'platform.activity.reasons.state_invalid',
  state_expired: 'platform.activity.reasons.state_expired',
  cancelled: 'platform.activity.reasons.cancelled',
  provider_error: 'platform.activity.reasons.provider_error',
  provider_unreachable: 'platform.activity.reasons.provider_unreachable',
  session_mismatch: 'platform.activity.reasons.session_mismatch',
  identity_mismatch: 'platform.activity.reasons.identity_mismatch',
  identity_taken: 'platform.activity.reasons.identity_taken',
  already_linked: 'platform.activity.reasons.already_linked',
  mfa_required: 'platform.activity.reasons.mfa_required',
  not_recent: 'platform.activity.reasons.not_recent',
  unavailable: 'platform.activity.reasons.unavailable',
} as const

const METHOD_KEYS = {
  password: 'platform.activity.methods.password',
  totp: 'platform.activity.methods.totp',
  sso: 'platform.activity.methods.sso',
} as const

const VIA_KEYS = {
  account: 'platform.activity.via.account',
  organization: 'platform.activity.via.organization',
  invitation: 'platform.activity.via.invitation',
  sso: 'platform.activity.via.sso',
} as const

/** A detail's value as one of a lookup's keys, or null. */
function pick<K extends string>(keys: Record<K, string>, value: unknown): K | null {
  return typeof value === 'string' && value in keys ? (value as K) : null
}

/** The rule as the log recorded it, e.g. "Managed (5)". */
function useRuleText() {
  const { t } = useTranslation()
  return (rule: unknown) => {
    const { mode, max_organizations: max } = (rule ?? {}) as {
      mode?: TenancyMode
      max_organizations?: number | null
    }
    if (!mode || !(mode in MODE_LABEL_KEYS)) return '—'
    const label = t(MODE_LABEL_KEYS[mode])
    if (mode === 'single') return label
    return `${label} (${max ?? t('platform.activity.noCap')})`
  }
}

/** What an entry acted on, and how, in a line. */
function EventTarget({ event }: { event: PlatformAuditEvent }) {
  const { t } = useTranslation()
  const ruleText = useRuleText()
  const details = event.details ?? {}
  let main: string = event.target_label ?? '—'
  let extra: string | null = null
  if (event.action === 'tenancy.update') {
    main = t('platform.activity.thisInstance')
    extra = `${ruleText(details.before)} → ${ruleText(details.after)}`
  } else if (
    event.action === 'legal.acceptances_export' ||
    event.action === 'security_policy.update'
  ) {
    main = t('platform.activity.thisInstance')
  } else if (event.action === 'organization.domain') {
    extra = `${String(details.before ?? '—')} → ${String(details.after ?? '—')}`
  } else if (
    event.action === 'program_manager.grant' ||
    event.action === 'program_manager.revoke'
  ) {
    extra = typeof details.account === 'string' ? details.account : null
  } else if (event.action === 'organization.allowed_domain') {
    extra = typeof details.domain === 'string' ? details.domain : null
  } else if (event.action === 'exercise.aar_final' || event.action === 'exercise.aar_reopened') {
    extra =
      typeof details.version === 'number'
        ? t('platform.activity.version', { version: details.version })
        : null
  } else if (event.action === 'exercise.scenario_applied') {
    extra = typeof details.name === 'string' ? details.name : null
  } else if (event.action === 'organization.create') {
    extra = typeof details.program_manager === 'string' ? details.program_manager : null
  } else if (event.action === 'legal.publish') {
    const kind = event.target_label
    main =
      kind && kind in LEGAL_TITLE_KEYS
        ? t(LEGAL_TITLE_KEYS[kind as keyof typeof LEGAL_TITLE_KEYS])
        : main
    extra =
      typeof details.version === 'number'
        ? t('platform.activity.version', { version: details.version })
        : null
  } else if (event.action === 'account.update') {
    // What changed, before -> after (name and/or email).
    extra =
      Object.values(details)
        .map((change) => {
          const { before, after } = (change ?? {}) as { before?: unknown; after?: unknown }
          return `${String(before ?? '—')} → ${String(after ?? '—')}`
        })
        .join(' · ') || null
  } else if (event.action.startsWith('assistant.proposal_')) {
    // Which row of the exercise, never what was proposed.
    const kind = pick(TARGET_LABEL_KEYS, details.target)
    const target = kind ? t(TARGET_LABEL_KEYS[kind]) : null
    const code = typeof details.row === 'string' ? details.row : ''
    extra = target
      ? details.operation === 'create'
        ? t('assistant.create', { target })
        : details.operation === 'delete'
          ? t('assistant.remove', { target, code })
          : t('assistant.update', { target, code })
      : null
  } else if (event.action.startsWith('auth.')) {
    // How it went: why it failed, which factor, how the account came.
    const reason = pick(REASON_KEYS, details.reason)
    const method = pick(METHOD_KEYS, details.method ?? details.factor)
    const via = pick(VIA_KEYS, details.via)
    extra = reason
      ? t(REASON_KEYS[reason])
      : method
        ? t(METHOD_KEYS[method])
        : via
          ? t(VIA_KEYS[via])
          : typeof details.minutes === 'number'
            ? t('platform.activity.lockedFor', { minutes: details.minutes })
            : null
  } else if (event.action === 'audit.export') {
    main = t('platform.activity.thisLog')
    extra = typeof details.format === 'string' ? details.format.toUpperCase() : null
  } else if (event.action.startsWith('audit_webhook.')) {
    main = t('platform.activity.thisLog')
    extra = typeof details.url === 'string' ? details.url : null
  } else if (event.action === 'email.test') {
    main = t('platform.activity.thisInstance')
    extra =
      typeof details.to === 'string'
        ? t(details.ok ? 'platform.activity.emailTestOk' : 'platform.activity.emailTestFailed', {
            to: details.to,
          })
        : null
  } else if (event.action === 'sso.test') {
    main = t('platform.activity.thisInstance')
    extra = t(details.ok ? 'platform.activity.ssoTestOk' : 'platform.activity.ssoTestFailed')
  } else if (event.action.startsWith('sso.')) {
    main = t('platform.activity.thisInstance')
    const after = (details.after ?? details.before ?? {}) as { display_name?: unknown }
    extra = typeof after.display_name === 'string' ? after.display_name : null
  } else if (event.action.startsWith('email.')) {
    main = t('platform.activity.thisInstance')
    const after = (details.after ?? details.before ?? {}) as { smtp_host?: unknown }
    extra = typeof after.smtp_host === 'string' ? after.smtp_host : null
  }
  return (
    <>
      <span className="block">{main}</span>
      {extra && <span className="block text-paper-ink/60 dark:text-fg-muted">{extra}</span>}
    </>
  )
}

/** Platform -> Activity log: what happens on this instance -- what was
 * done to it and every account's sign-ins -- as it read at
 * the time -- searched (who / on what), filtered by action and sorted by
 * date on the server, all of it in the URL. Read-only by design; the same
 * filters download it (JSON Lines for a log shipper, CSV), and the
 * forwarding panel streams it to a SIEM as it happens. */
export function PlatformActivitySection() {
  const { t, i18n } = useTranslation()
  const download = useApiDownload()
  const { page, setPage, sortDir, setSortDir, sortBy, setSortBy, search, setSearch } =
    useTableUrlState('', DATE_SORT)
  const [action, setAction] = useUrlFilter('action', AUDIT_ACTIONS)
  const filters = new URLSearchParams()
  if (action) filters.set('action', action)
  if (search) filters.set('q', search)
  const params = new URLSearchParams(filters)
  params.set('limit', String(ACTIVITY_PAGE_SIZE))
  params.set('offset', String((page - 1) * ACTIVITY_PAGE_SIZE))
  params.set('sort_dir', sortDir)
  const log = useApiResource<PlatformAuditListResponse>(`/instance/audit?${params}`)
  const items = log.data?.items ?? []
  const total = log.data?.total ?? 0
  const totalPages = Math.ceil(total / ACTIVITY_PAGE_SIZE)
  usePageFallback({ total, pageSize: ACTIVITY_PAGE_SIZE, ready: log.data !== null })
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const exportPath = (format: 'jsonl' | 'csv') => {
    const query = new URLSearchParams(filters)
    query.set('format', format)
    return `/instance/audit/export?${query}`
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader
          title={t('platform.sections.activity')}
          action={
            <div className="flex flex-wrap gap-2">
              {(['jsonl', 'csv'] as const).map((format) => (
                <a
                  key={format}
                  href={`${API_BASE}${exportPath(format)}`}
                  download
                  onClick={download(exportPath(format))}
                  className={btnSecondary}
                >
                  {t(
                    format === 'jsonl'
                      ? 'platform.activity.downloadJsonl'
                      : 'platform.activity.downloadCsv',
                  )}
                </a>
              ))}
            </div>
          }
        />
        <HelpText id="platform.activity.description" text={t('platform.activity.description')} />
      </div>
      <Panel
        label={t('platform.sections.activity')}
        meta={log.data ? t('platform.activity.count', { count: total }) : undefined}
        aside={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="platform-activity-action">
              {t('platform.activity.filterLabel')}
            </label>
            <div className="w-64">
              <select
                id="platform-activity-action"
                name="action"
                value={action ?? ''}
                onChange={(e) => setAction((e.target.value || null) as PlatformAuditAction | null)}
                className={`${inputCompact} text-sm`}
              >
                <option value="">{t('platform.activity.allActions')}</option>
                <optgroup label={t('platform.activity.groupAuth')}>
                  {AUTH_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {t(AUDIT_ACTION_KEYS[a])}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('platform.activity.groupAdmin')}>
                  {ADMIN_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {t(AUDIT_ACTION_KEYS[a])}
                    </option>
                  ))}
                </optgroup>
                <optgroup label={t('platform.activity.groupWork')}>
                  {WORK_ACTIONS.map((a) => (
                    <option key={a} value={a}>
                      {t(AUDIT_ACTION_KEYS[a])}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>
            <TableToolbar
              sortDir={sortDir}
              sortBy={sortBy}
              onSortDirChange={setSortDir}
              onSortByChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              sortOptions={DATE_SORT}
              sortLabels={{ created_at: t('platform.activity.dateSort') }}
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
        {log.error ? (
          <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
            {log.error.message}
          </p>
        ) : items.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
            {log.loading
              ? t('common.loading')
              : search
                ? t('common.toolbar.noSearchResults', { query: search })
                : action
                  ? t('platform.activity.emptyFiltered')
                  : t('platform.activity.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto" aria-busy={log.loading}>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={panelTableHeadRow}>
                  <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                    {t('platform.activity.columns.when')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.activity.columns.who')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.activity.columns.action')}
                  </th>
                  <th scope="col" className={panelTh}>
                    {t('platform.activity.columns.target')}
                  </th>
                </tr>
              </thead>
              <tbody className={panelTbody}>
                {items.map((event) => (
                  <tr key={event.id} className={panelTr}>
                    <td className={`${panelTd} whitespace-nowrap tabular-nums`}>
                      <time dateTime={event.created_at}>
                        {dateFormat.format(new Date(event.created_at))}
                      </time>
                    </td>
                    <td className={panelTd}>
                      {/* No account and no email: the server's console. A
                          sign-in attempt with no account keeps the email typed. */}
                      {event.actor_user_id === null && event.actor_label === 'console'
                        ? t('platform.activity.console')
                        : event.actor_label}
                    </td>
                    <td
                      className={`${panelTd} ${FAILED_ACTIONS.has(event.action) ? 'text-danger-fg' : ''}`}
                    >
                      {event.action in AUDIT_ACTION_KEYS
                        ? t(AUDIT_ACTION_KEYS[event.action])
                        : event.action}
                    </td>
                    <td className={panelTd}>
                      <EventTarget event={event} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <RetentionPanel />
      <ForwardingPanel onChanged={log.refetch} />
    </div>
  )
}

/** Platform -> Activity log -> Retention: read-only. The log keeps its
 * entries a fixed number of days (never deleting one still queued for the
 * SIEM); the server's log files are capped by size (.env) or left to its
 * logrotate. */
function RetentionPanel() {
  const { t } = useTranslation()
  const retention = useApiResource<AuditRetention>('/instance/audit/retention')

  return (
    <Panel title={t('platform.retention.title')} description={t('platform.retention.description')}>
      <dl className={`space-y-3 text-sm ${panelFormFields}`}>
        <div>
          <dt className="font-semibold">{t('platform.retention.activityLog')}</dt>
          <dd className="text-paper-ink/70 dark:text-fg-muted">
            {retention.data
              ? t('platform.retention.activityLogDays', { count: retention.data.days })
              : '…'}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">{t('platform.retention.serverLogs')}</dt>
          <dd className="text-paper-ink/70 dark:text-fg-muted">
            {!retention.data
              ? '…'
              : retention.data.log_file_max_mb > 0
                ? t('platform.retention.serverLogsCapped', {
                    size: retention.data.log_file_max_mb,
                    count: retention.data.log_file_backups,
                  })
                : t('platform.retention.serverLogsRule')}
          </dd>
        </div>
      </dl>
    </Panel>
  )
}

/** Platform -> Activity log -> Forward to a SIEM: a webhook (the
 * collector's URL, an optional Authorization header) that receives every
 * new entry, signed with the shared secret shown here. Saving, a new
 * secret and removing ask for a recent sign-in and are logged. */
function ForwardingPanel({ onChanged }: { onChanged: () => void }) {
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const webhook = useApiResource<AuditWebhook>('/instance/audit/webhook')
  const current = webhook.data
  const [url, setUrl] = useState<string | null>(null)
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [authorization, setAuthorization] = useState('')
  const [clearAuthorization, setClearAuthorization] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'save' | 'test' | 'rotate' | 'delete' | null>(null)
  const [testResult, setTestResult] = useState<AuditWebhookTest | null>(null)
  const [secretShown, setSecretShown] = useState(false)
  const [removing, setRemoving] = useState(false)

  const urlValue = url ?? current?.url ?? ''
  const enabledValue = enabled ?? (current?.configured ? current.enabled : true)
  const dirty =
    (url !== null && url !== (current?.url ?? '')) ||
    (enabled !== null && enabled !== current?.enabled) ||
    authorization !== '' ||
    clearAuthorization
  useUnsavedChangesWarning(dirty)
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  function reset() {
    setUrl(null)
    setEnabled(null)
    setAuthorization('')
    setClearAuthorization(false)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy('save')
    try {
      await apiFetch<AuditWebhook>('/instance/audit/webhook', {
        method: 'PUT',
        body: JSON.stringify({
          url: urlValue,
          enabled: enabledValue,
          authorization: clearAuthorization ? '' : authorization || null,
        }),
      })
      reset()
      webhook.refetch()
      onChanged()
      showToast(t('platform.forwarding.saved'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function act(kind: 'test' | 'rotate' | 'delete') {
    setError(null)
    setBusy(kind)
    try {
      if (kind === 'test') {
        const result = await apiFetch<AuditWebhookTest>('/instance/audit/webhook/test', {
          method: 'POST',
        })
        setTestResult(result)
      } else if (kind === 'rotate') {
        await apiFetch('/instance/audit/webhook/rotate-secret', { method: 'POST' })
        setSecretShown(true)
        showToast(t('platform.forwarding.rotated'))
      } else {
        await apiFetch('/instance/audit/webhook', { method: 'DELETE' })
        reset()
        setRemoving(false)
        setTestResult(null)
        showToast(t('platform.forwarding.removed'))
      }
      webhook.refetch()
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function copySecret(secret: string) {
    try {
      await navigator.clipboard.writeText(secret)
      showToast(t('platform.forwarding.copied'))
    } catch {
      showToast(t('platform.forwarding.copyFailed'), { variant: 'error' })
    }
  }

  const status = !current?.configured
    ? null
    : !current.enabled
      ? t('platform.forwarding.statusOff')
      : current.last_error
        ? t('platform.forwarding.statusFailing', {
            error: current.last_error,
            count: current.pending,
          })
        : current.last_success_at
          ? t('platform.forwarding.statusOk', {
              date: dateFormat.format(new Date(current.last_success_at)),
            })
          : t('platform.forwarding.statusWaiting')

  return (
    <form onSubmit={save}>
      <Panel
        title={t('platform.forwarding.title')}
        description={t(
          current?.allow_http
            ? 'platform.forwarding.descriptionHttp'
            : 'platform.forwarding.description',
        )}
        aside={
          status ? (
            <span
              className={`${badgeBase} ml-0 ${current?.last_error && current.enabled ? 'bg-danger/10 text-danger-fg' : 'bg-paper-line/60 text-paper-ink/70 dark:bg-line dark:text-fg-muted'}`}
              role="status"
            >
              {status}
            </span>
          ) : undefined
        }
        footer={
          <div className={panelFormActions}>
            {current?.configured && (
              <button
                type="button"
                onClick={() => setRemoving(true)}
                className={`mr-auto ${btnSecondary}`}
              >
                {t('platform.forwarding.remove')}
              </button>
            )}
            {dirty && (
              <button type="button" onClick={reset} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
            )}
            <button
              type="submit"
              disabled={busy !== null || urlValue.trim() === '' || (current?.configured && !dirty)}
              className={btnPrimary}
            >
              {busy === 'save' ? (
                <ButtonSpinner />
              ) : current?.configured ? (
                t('platform.forwarding.save')
              ) : (
                t('platform.forwarding.create')
              )}
            </button>
          </div>
        }
      >
        <div className={`space-y-4 ${panelFormFields}`}>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-forwarding-url">
              {t('platform.forwarding.urlLabel')}
            </label>
            <input
              id="platform-forwarding-url"
              name="url"
              type="url"
              inputMode="url"
              value={urlValue}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('platform.forwarding.urlPlaceholder')}
              className={inputBase}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-forwarding-authorization">
              {t('platform.forwarding.authorizationLabel')}{' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </label>
            <input
              id="platform-forwarding-authorization"
              name="authorization"
              type="password"
              value={authorization}
              onChange={(e) => {
                setAuthorization(e.target.value)
                setClearAuthorization(false)
              }}
              placeholder={
                current?.has_authorization && !clearAuthorization
                  ? t('platform.forwarding.authorizationKept')
                  : t('platform.forwarding.authorizationPlaceholder')
              }
              className={inputBase}
              autoComplete="new-password"
            />
            <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {t('platform.forwarding.authorizationHint')}
              {current?.has_authorization && !clearAuthorization && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => {
                      setAuthorization('')
                      setClearAuthorization(true)
                    }}
                    className={linkAccent}
                  >
                    {t('platform.forwarding.authorizationClear')}
                  </button>
                </>
              )}
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="enabled"
              checked={enabledValue}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 accent-cta"
            />
            {t('platform.forwarding.enabledLabel')}
          </label>
          {current?.configured && current.secret && (
            <div className="space-y-1">
              <span className={labelClass} id="platform-forwarding-secret-label">
                {t('platform.forwarding.secretLabel')}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <code
                  aria-labelledby="platform-forwarding-secret-label"
                  className="min-w-0 flex-1 truncate rounded-sm border border-paper-line bg-field px-3 py-2 font-mono text-sm dark:border-line"
                >
                  {secretShown ? current.secret : '•'.repeat(24)}
                </code>
                <button
                  type="button"
                  onClick={() => setSecretShown((shown) => !shown)}
                  className={btnSecondary}
                >
                  {secretShown ? t('platform.forwarding.hide') : t('platform.forwarding.show')}
                </button>
                <button
                  type="button"
                  onClick={() => void copySecret(current.secret!)}
                  className={btnSecondary}
                >
                  {t('platform.forwarding.copy')}
                </button>
                <button
                  type="button"
                  onClick={() => void act('rotate')}
                  disabled={busy !== null}
                  className={btnSecondary}
                >
                  {busy === 'rotate' ? <ButtonSpinner /> : t('platform.forwarding.rotate')}
                </button>
              </div>
              <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
                {t('platform.forwarding.secretHint')}
              </p>
            </div>
          )}
          {current?.configured && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void act('test')}
                disabled={busy !== null || dirty}
                className={btnSecondary}
              >
                {busy === 'test' ? <ButtonSpinner /> : t('platform.forwarding.test')}
              </button>
              {testResult && (
                <span
                  role="status"
                  className={`text-sm ${testResult.ok ? 'text-success-fg' : 'text-danger-fg'}`}
                >
                  {testResult.ok
                    ? t('platform.forwarding.testOk', { status: testResult.status })
                    : t('platform.forwarding.testFailed', { error: testResult.error })}
                </span>
              )}
            </div>
          )}
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
        </div>
      </Panel>
      {removing && (
        <Modal titleId="platform-forwarding-remove-title" onClose={() => setRemoving(false)}>
          <div className="w-full max-w-md space-y-3">
            <h2
              id="platform-forwarding-remove-title"
              className="text-balance text-lg font-semibold tracking-tight"
            >
              {t('platform.forwarding.removeTitle')}
            </h2>
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('platform.forwarding.removeWarning', { count: current?.pending ?? 0 })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void act('delete')}
                disabled={busy !== null}
                className={`flex-1 ${btnDanger}`}
              >
                {busy === 'delete' ? <ButtonSpinner /> : t('platform.forwarding.remove')}
              </button>
              <button type="button" onClick={() => setRemoving(false)} className={btnSecondary}>
                {t('common.confirmButton.cancel')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </form>
  )
}
