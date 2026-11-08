import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiResource } from '../../hooks/useApiResource'
import { useAuth } from '../../hooks/useAuth'
import { usePageFallback, useTableUrlState } from '../../hooks/useTableUrlState'
import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { apiFetch } from '../../lib/api'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
  inputCompact,
  linkAccent,
  optionalSuffix,
} from '../../lib/buttonStyles'
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
  EmailOutboxListResponse,
  EmailReconfirmationRead,
  EmailOutboxStatus,
  EmailSettings,
  EmailTestResult,
  SmtpSecurity,
} from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { Modal } from '../common/Modal'
import { Pagination } from '../common/Pagination'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { badgeBase, labelClass, useErrorMessage, useUrlFilter } from './platformCommon'

const SECURITY_OPTIONS: SmtpSecurity[] = ['starttls', 'tls', 'none']

const SECURITY_LABEL_KEYS = {
  starttls: 'platform.email.security.starttls',
  tls: 'platform.email.security.tls',
  none: 'platform.email.security.none',
} as const

// The port each kind of connection usually takes.
const DEFAULT_PORTS: Record<SmtpSecurity, number> = { starttls: 587, tls: 465, none: 25 }

const OUTBOX_STATUSES: EmailOutboxStatus[] = ['pending', 'sent', 'failed']

const STATUS_LABEL_KEYS = {
  pending: 'platform.email.outbox.statuses.pending',
  sent: 'platform.email.outbox.statuses.sent',
  failed: 'platform.email.outbox.statuses.failed',
} as const

const TEMPLATE_LABEL_KEYS = {
  test: 'platform.email.outbox.templates.test',
  password_reset: 'platform.email.outbox.templates.password_reset',
  password_reset_sso: 'platform.email.outbox.templates.password_reset_sso',
  email_verification: 'platform.email.outbox.templates.email_verification',
  mfa_code: 'platform.email.outbox.templates.mfa_code',
  email_invitation: 'platform.email.outbox.templates.email_invitation',
  email_reconfirmation: 'platform.email.outbox.templates.email_reconfirmation',
} as const

const OUTBOX_PAGE_SIZE = 20

const neutralBadge = 'bg-paper-line/60 text-paper-ink/70 dark:bg-line dark:text-fg-muted'

function useDateFormat() {
  const { i18n } = useTranslation()
  return new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' })
}

interface Draft {
  enabled: boolean
  from_address: string
  from_name: string
  reply_to: string
  smtp_host: string
  smtp_port: string
  smtp_security: SmtpSecurity
  smtp_username: string
}

function draftFrom(current: EmailSettings): Draft {
  return {
    enabled: current.configured ? current.enabled : true,
    from_address: current.from_address ?? '',
    from_name: current.from_name ?? '',
    reply_to: current.reply_to ?? '',
    smtp_host: current.smtp_host ?? '',
    smtp_port: String(current.smtp_port ?? DEFAULT_PORTS.starttls),
    smtp_security: current.smtp_security ?? 'starttls',
    smtp_username: current.smtp_username ?? '',
  }
}

/** Where the instance stands: sending or not, and why. */
function StatusPanel({ current }: { current: EmailSettings }) {
  const { t } = useTranslation()
  const dateFormat = useDateFormat()

  const state = current.active
    ? current.last_error && current.pending > 0
      ? 'failing'
      : 'active'
    : current.configured && !current.password_readable
      ? 'unreadable'
      : current.configured && !current.enabled
        ? 'off'
        : 'none'
  const label = {
    active: t('platform.email.status.active'),
    failing: t('platform.email.status.failing'),
    unreadable: t('platform.email.status.unreadable'),
    off: t('platform.email.status.off'),
    none: t('platform.email.status.none'),
  }[state]
  const source = current.pinned_by_env
    ? t('platform.email.status.pinned')
    : current.configured
      ? t('platform.email.status.fromWeb')
      : t('platform.email.status.howTo')

  return (
    <Panel
      title={t('platform.email.status.title')}
      aside={
        <span
          role="status"
          className={`${badgeBase} ml-0 ${state === 'failing' || state === 'unreadable' ? 'bg-danger/10 text-danger-fg' : neutralBadge}`}
        >
          {label}
        </span>
      }
    >
      <div className={`space-y-3 text-sm ${panelFormFields}`}>
        <p>{source}</p>
        {current.configured && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-paper-ink/60 dark:text-fg-muted">
              {t('platform.email.status.lastSent')}
            </dt>
            <dd>
              {current.last_sent_at
                ? dateFormat.format(new Date(current.last_sent_at))
                : t('platform.email.status.never')}
            </dd>
            <dt className="text-paper-ink/60 dark:text-fg-muted">
              {t('platform.email.status.queue')}
            </dt>
            <dd>
              {t('platform.email.status.queueCounts', {
                pending: current.pending,
                failed: current.failed,
              })}
            </dd>
            {current.last_error && (
              <>
                <dt className="text-paper-ink/60 dark:text-fg-muted">
                  {t('platform.email.status.lastError')}
                </dt>
                <dd className="break-words text-danger-fg">
                  {current.last_failed_at &&
                    `${dateFormat.format(new Date(current.last_failed_at))} · `}
                  {current.last_error}
                </dd>
              </>
            )}
          </dl>
        )}
      </div>
    </Panel>
  )
}

/** A message now, outside the queue: whether the server takes it. */
function TestPanel({ current, onSent }: { current: EmailSettings; onSent: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const errorMessage = useErrorMessage()
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<EmailTestResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(
        await apiFetch<EmailTestResult>('/instance/email/test', {
          method: 'POST',
          body: JSON.stringify({ to: to.trim() || null }),
        }),
      )
      onSent()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={send}>
      <Panel
        title={t('platform.email.test.title')}
        description={t('platform.email.test.description')}
      >
        <div className={`space-y-3 ${panelFormFields}`}>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-email-test-to">
              {t('platform.email.test.toLabel')}{' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="platform-email-test-to"
                name="to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder={user?.email ? `${user.email}…` : undefined}
                className={`min-w-0 flex-1 ${inputBase}`}
                autoComplete="off"
              />
              <button type="submit" disabled={busy || !current.active} className={btnSecondary}>
                {busy ? <ButtonSpinner /> : t('platform.email.test.send')}
              </button>
            </div>
          </div>
          {result && (
            <p
              role="status"
              className={`break-words text-sm ${result.ok ? 'text-success-fg' : 'text-danger-fg'}`}
            >
              {result.ok
                ? t('platform.email.test.ok', { to: result.to })
                : t('platform.email.test.failed', { error: result.error })}
            </p>
          )}
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

/** Sender and server. Read-only while the server's configuration pins
 * them or it has no encryption key; saving and removing ask for a recent
 * sign-in and are logged (never the password). */
function ServerPanel({ current, onSaved }: { current: EmailSettings; onSaved: () => void }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const initial = draftFrom(current)
  const [draft, setDraft] = useState<Draft>(initial)
  const [password, setPassword] = useState('')
  const [clearPassword, setClearPassword] = useState(false)
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const readOnly = current.pinned_by_env
  const dirty =
    (Object.keys(initial) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]) ||
    password !== '' ||
    clearPassword
  useUnsavedChangesWarning(dirty && !readOnly)
  const port = Number(draft.smtp_port)
  const valid =
    draft.from_address.trim() !== '' &&
    draft.smtp_host.trim() !== '' &&
    Number.isInteger(port) &&
    port >= 1 &&
    port <= 65535
  const securityOptions = SECURITY_OPTIONS.filter(
    (option) => option !== 'none' || current.allow_insecure || draft.smtp_security === 'none',
  )

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }))
  }

  function changeSecurity(next: SmtpSecurity) {
    setDraft((previous) => ({
      ...previous,
      smtp_security: next,
      // Follow the connection's usual port unless one was typed on purpose.
      smtp_port:
        Number(previous.smtp_port) === DEFAULT_PORTS[previous.smtp_security]
          ? String(DEFAULT_PORTS[next])
          : previous.smtp_port,
    }))
  }

  function reset() {
    setDraft(initial)
    setPassword('')
    setClearPassword(false)
    setError(null)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy('save')
    try {
      await apiFetch<EmailSettings>('/instance/email', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: draft.enabled,
          from_address: draft.from_address.trim(),
          from_name: draft.from_name.trim() || null,
          reply_to: draft.reply_to.trim() || null,
          smtp_host: draft.smtp_host.trim(),
          smtp_port: port,
          smtp_security: draft.smtp_security,
          smtp_username: draft.smtp_username.trim() || null,
          smtp_password: clearPassword ? '' : password || null,
        }),
      })
      setPassword('')
      setClearPassword(false)
      onSaved()
      showToast(t('platform.email.server.saved'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    setError(null)
    setBusy('delete')
    try {
      await apiFetch('/instance/email', { method: 'DELETE' })
      setRemoving(false)
      onSaved()
      showToast(t('platform.email.server.removed'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  function field(
    key: 'from_address' | 'from_name' | 'reply_to' | 'smtp_host' | 'smtp_username',
    label: string,
    options: { optional?: boolean; type?: string; placeholder?: string } = {},
  ) {
    const id = `platform-email-${key.replace('_', '-')}`
    return (
      <div className="space-y-1">
        <label className={labelClass} htmlFor={id}>
          {label}
          {options.optional && (
            <>
              {' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </>
          )}
        </label>
        <input
          id={id}
          name={key}
          type={options.type ?? 'text'}
          value={draft[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={options.placeholder}
          className={inputBase}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    )
  }

  return (
    <form onSubmit={save}>
      <Panel
        title={t('platform.email.server.title')}
        description={
          <HelpText
            id="platform.email.server.description"
            text={t(
              current.pinned_by_env
                ? 'platform.email.server.pinned'
                : 'platform.email.server.description',
            )}
          />
        }
        footer={
          readOnly ? undefined : (
            <div className={panelFormActions}>
              {current.configured && (
                <button
                  type="button"
                  onClick={() => setRemoving(true)}
                  className={`mr-auto ${btnSecondary}`}
                >
                  {t('platform.email.server.remove')}
                </button>
              )}
              {dirty && (
                <button type="button" onClick={reset} className={btnSecondary}>
                  {t('common.confirmButton.cancel')}
                </button>
              )}
              <button
                type="submit"
                disabled={busy !== null || !valid || (current.configured && !dirty)}
                className={btnPrimary}
              >
                {busy === 'save' ? (
                  <ButtonSpinner />
                ) : current.configured ? (
                  t('platform.email.server.save')
                ) : (
                  t('platform.email.server.create')
                )}
              </button>
            </div>
          )
        }
      >
        <fieldset className={`space-y-4 ${panelFormFields}`} disabled={readOnly}>
          <legend className="sr-only">{t('platform.email.server.title')}</legend>
          <h3 className="text-sm font-semibold">{t('platform.email.server.senderHeading')}</h3>
          {field('from_address', t('platform.email.server.fromAddress'), {
            type: 'email',
            placeholder: t('platform.email.server.fromAddressPlaceholder'),
          })}
          {field('from_name', t('platform.email.server.fromName'), { optional: true })}
          {field('reply_to', t('platform.email.server.replyTo'), {
            optional: true,
            type: 'email',
          })}
          <h3 className="pt-2 text-sm font-semibold">{t('platform.email.server.serverHeading')}</h3>
          {field('smtp_host', t('platform.email.server.host'), {
            placeholder: t('platform.email.server.hostPlaceholder'),
          })}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClass} htmlFor="platform-email-security">
                {t('platform.email.server.securityLabel')}
              </label>
              <select
                id="platform-email-security"
                name="smtp_security"
                value={draft.smtp_security}
                onChange={(e) => changeSecurity(e.target.value as SmtpSecurity)}
                className={inputBase}
              >
                {securityOptions.map((option) => (
                  <option key={option} value={option}>
                    {t(SECURITY_LABEL_KEYS[option])}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClass} htmlFor="platform-email-port">
                {t('platform.email.server.port')}
              </label>
              <input
                id="platform-email-port"
                name="smtp_port"
                type="number"
                min={1}
                max={65535}
                inputMode="numeric"
                value={draft.smtp_port}
                onChange={(e) => set('smtp_port', e.target.value)}
                className={inputBase}
                autoComplete="off"
              />
            </div>
          </div>
          <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {t(
              current.allow_insecure
                ? 'platform.email.server.securityHintInsecure'
                : 'platform.email.server.securityHint',
            )}
          </p>
          {field('smtp_username', t('platform.email.server.username'), { optional: true })}
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-email-password">
              {t('platform.email.server.password')}{' '}
              <span className={optionalSuffix}>({t('common.optionalSuffix')})</span>
            </label>
            <input
              id="platform-email-password"
              name="smtp_password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setClearPassword(false)
              }}
              placeholder={
                current.has_password && !clearPassword
                  ? t('platform.email.server.passwordKept')
                  : undefined
              }
              className={inputBase}
              autoComplete="new-password"
            />
            <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {t(
                current.pinned_by_env
                  ? 'platform.email.server.passwordHintPinned'
                  : 'platform.email.server.passwordHint',
              )}
              {current.has_password && !clearPassword && !readOnly && (
                <>
                  {' '}
                  <button
                    type="button"
                    onClick={() => {
                      setPassword('')
                      setClearPassword(true)
                    }}
                    className={linkAccent}
                  >
                    {t('platform.email.server.passwordClear')}
                  </button>
                </>
              )}
            </p>
            {!current.password_readable && (
              <p className="text-sm text-danger-fg">
                {t('platform.email.server.passwordUnreadable')}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabled"
                checked={draft.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
                aria-describedby="platform-email-enabled-hint"
                className="h-4 w-4 accent-cta"
              />
              {t('platform.email.server.enabledLabel')}
            </label>
            <p
              id="platform-email-enabled-hint"
              className="text-sm text-paper-ink/60 dark:text-fg-muted"
            >
              {t('platform.email.server.enabledHint')}
            </p>
          </div>
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
        </fieldset>
      </Panel>
      {removing && (
        <Modal titleId="platform-email-remove-title" onClose={() => setRemoving(false)}>
          <div className="w-full max-w-md space-y-3">
            <h2
              id="platform-email-remove-title"
              className="text-balance text-lg font-semibold tracking-tight"
            >
              {t('platform.email.server.removeTitle')}
            </h2>
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('platform.email.server.removeWarning', { count: current.pending })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy !== null}
                className={`flex-1 ${btnDanger}`}
              >
                {busy === 'delete' ? <ButtonSpinner /> : t('platform.email.server.remove')}
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

/** What went out (and what waits), without its content: kept a fixed
 * number of days. */
function OutboxPanel() {
  const { t } = useTranslation()
  const dateFormat = useDateFormat()
  const { page, setPage } = useTableUrlState('outbox_')
  const [status, setStatus] = useUrlFilter('outbox_status', OUTBOX_STATUSES)
  const params = new URLSearchParams({
    limit: String(OUTBOX_PAGE_SIZE),
    offset: String((page - 1) * OUTBOX_PAGE_SIZE),
  })
  if (status) params.set('status', status)
  const outbox = useApiResource<EmailOutboxListResponse>(`/instance/email/outbox?${params}`)
  const items = outbox.data?.items ?? []
  const total = outbox.data?.total ?? 0
  const totalPages = Math.ceil(total / OUTBOX_PAGE_SIZE)
  usePageFallback({ total, pageSize: OUTBOX_PAGE_SIZE, ready: outbox.data !== null })

  return (
    <Panel
      title={t('platform.email.outbox.title')}
      meta={outbox.data ? t('platform.email.outbox.count', { count: total }) : undefined}
      description={
        outbox.data
          ? t('platform.email.outbox.description', { count: outbox.data.retention_days })
          : undefined
      }
      aside={
        <div className="w-48">
          <label className="sr-only" htmlFor="platform-email-outbox-status">
            {t('platform.email.outbox.filterLabel')}
          </label>
          <select
            id="platform-email-outbox-status"
            name="status"
            value={status ?? ''}
            onChange={(e) => setStatus((e.target.value || null) as EmailOutboxStatus | null)}
            className={`${inputCompact} text-sm`}
          >
            <option value="">{t('platform.email.outbox.allStatuses')}</option>
            {OUTBOX_STATUSES.map((value) => (
              <option key={value} value={value}>
                {t(STATUS_LABEL_KEYS[value])}
              </option>
            ))}
          </select>
        </div>
      }
      footer={
        totalPages > 1 ? (
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        ) : undefined
      }
      flush
    >
      {outbox.error ? (
        <p role="alert" className="px-5 py-4 text-sm text-danger-fg">
          {outbox.error.message}
        </p>
      ) : items.length === 0 ? (
        <p className="px-5 py-12 text-center text-sm text-paper-ink/70 dark:text-fg-muted">
          {outbox.loading ? t('common.loading') : t('platform.email.outbox.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto" aria-busy={outbox.loading}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={panelTableHeadRow}>
                <th scope="col" className={`${panelTh} whitespace-nowrap`}>
                  {t('platform.email.outbox.columns.when')}
                </th>
                <th scope="col" className={panelTh}>
                  {t('platform.email.outbox.columns.to')}
                </th>
                <th scope="col" className={panelTh}>
                  {t('platform.email.outbox.columns.message')}
                </th>
                <th scope="col" className={panelTh}>
                  {t('platform.email.outbox.columns.status')}
                </th>
              </tr>
            </thead>
            <tbody className={panelTbody}>
              {items.map((item) => (
                <tr key={item.id} className={panelTr}>
                  <td className={`${panelTd} whitespace-nowrap tabular-nums`}>
                    <time dateTime={item.created_at}>
                      {dateFormat.format(new Date(item.created_at))}
                    </time>
                  </td>
                  <td className={`${panelTd} break-all`}>{item.to_address}</td>
                  <td className={panelTd}>
                    {item.template in TEMPLATE_LABEL_KEYS
                      ? t(TEMPLATE_LABEL_KEYS[item.template as keyof typeof TEMPLATE_LABEL_KEYS])
                      : item.template}
                  </td>
                  <td className={panelTd}>
                    <span
                      className={`${badgeBase} ml-0 ${item.status === 'failed' ? 'bg-danger/10 text-danger-fg' : neutralBadge}`}
                    >
                      {t(STATUS_LABEL_KEYS[item.status])}
                    </span>
                    {item.attempts > 1 && (
                      <span className="ml-2 text-paper-ink/60 dark:text-fg-muted">
                        {t('platform.email.outbox.attempts', { count: item.attempts })}
                      </span>
                    )}
                    {item.last_error && item.status !== 'sent' && (
                      <span className="block break-words text-paper-ink/60 dark:text-fg-muted">
                        {item.last_error}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

/** Platform -> Email: how the instance sends email -- the server's
 * configuration (read-only here) or set here, with the password stored
 * encrypted. A test message checks it; the outbox shows what went out. */
/** Periodic reconfirmation: after how many days every account confirms
 * its address again. Read-only while the server's configuration pins it;
 * saving asks for a recent sign-in and is logged. */
function ReconfirmationPanel({
  current,
  onSaved,
}: {
  current: EmailReconfirmationRead
  onSaved: () => void
}) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const [on, setOn] = useState(current.days !== null)
  const [days, setDays] = useState(String(current.days ?? 365))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const value = on ? Number(days) : null
  const valid = value === null || (Number.isInteger(value) && value >= 30 && value <= 730)
  const dirty = value !== current.days
  useUnsavedChangesWarning(dirty && !current.pinned_by_env)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!valid) return
    setBusy(true)
    setError(null)
    try {
      await apiFetch<EmailReconfirmationRead>('/instance/email/reconfirmation', {
        method: 'PUT',
        body: JSON.stringify({ days: value }),
      })
      showToast(t('common.toast.savedSuccess'))
      onSaved()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const description = t('platform.email.reconfirmation.description', {
    grace: current.grace_days,
  })
  if (current.pinned_by_env) {
    return (
      <Panel title={t('platform.email.reconfirmation.title')} description={description}>
        <p className="text-sm">
          {current.days === null
            ? t('platform.email.reconfirmation.pinnedOff')
            : t('platform.email.reconfirmation.pinnedDays', { count: current.days })}
        </p>
      </Panel>
    )
  }
  return (
    <form onSubmit={save}>
      <Panel
        title={t('platform.email.reconfirmation.title')}
        description={description}
        footer={
          <div className={panelFormActions}>
            <button type="submit" disabled={busy || !dirty || !valid} className={btnPrimary}>
              {busy ? <ButtonSpinner /> : t('common.confirmButton.save')}
            </button>
          </div>
        }
      >
        <div className={`space-y-3 ${panelFormFields}`}>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="reconfirmation-on"
              checked={on}
              onChange={(e) => setOn(e.target.checked)}
              className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-fg"
            />
            {t('platform.email.reconfirmation.onLabel')}
          </label>
          {on && (
            <div className="space-y-1">
              <label className={labelClass} htmlFor="platform-email-reconfirmation-days">
                {t('platform.email.reconfirmation.daysLabel')}
              </label>
              <input
                id="platform-email-reconfirmation-days"
                name="days"
                type="number"
                min={30}
                max={730}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className={`w-32 ${inputBase}`}
                required
              />
              {!valid && (
                <p className="text-sm text-danger-fg" aria-live="polite">
                  {t('platform.email.reconfirmation.daysRange')}
                </p>
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
    </form>
  )
}

export function PlatformEmailSection() {
  const { t } = useTranslation()
  // Bumped after a save or a test: the outbox list reloads with the status.
  const [outboxKey, setOutboxKey] = useState(0)
  const settings = useApiResource<EmailSettings>('/instance/email')
  const reconfirmation = useApiResource<EmailReconfirmationRead>('/instance/email/reconfirmation')
  const current = settings.data
  const refresh = () => {
    settings.refetch()
    setOutboxKey((value) => value + 1)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader title={t('platform.sections.email')} />
        <HelpText id="platform.email.description" text={t('platform.email.description')} />
      </div>
      {settings.error && (
        <p className="text-sm text-danger-fg" role="alert">
          {settings.error.message}
        </p>
      )}
      {current && (
        <>
          <StatusPanel current={current} />
          <ServerPanel
            key={`${current.updated_at}-${current.configured}-${current.pinned_by_env}`}
            current={current}
            onSaved={refresh}
          />
          {current.configured && <TestPanel current={current} onSent={refresh} />}
          {reconfirmation.data && (
            <ReconfirmationPanel
              key={`${reconfirmation.data.days}-${reconfirmation.data.pinned_by_env}`}
              current={reconfirmation.data}
              onSaved={reconfirmation.refetch}
            />
          )}
          <OutboxPanel key={outboxKey} />
        </>
      )}
    </div>
  )
}
