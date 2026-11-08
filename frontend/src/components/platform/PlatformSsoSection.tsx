import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useApiResource } from '../../hooks/useApiResource'
import { useToast } from '../../hooks/useToast'
import { useUnsavedChangesWarning } from '../../hooks/useUnsavedChangesWarning'
import { apiFetch } from '../../lib/api'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputBase,
  optionalSuffix,
} from '../../lib/buttonStyles'
import { panelFormActions, panelFormFields } from '../../lib/panelStyles'
import type { OidcSettingsRead, OidcTestRead } from '../../lib/types'
import { ButtonSpinner } from '../common/ButtonSpinner'
import { HelpText } from '../common/HelpText'
import { Modal } from '../common/Modal'
import { Panel } from '../common/Panel'
import { SectionHeader } from '../common/SectionHeader'
import { badgeBase, labelClass, useErrorMessage } from './platformCommon'

type ProviderKind = 'entra' | 'generic'

const KIND_LABEL_KEYS = {
  entra: 'platform.sso.server.kinds.entra',
  generic: 'platform.sso.server.kinds.generic',
} as const

const TEST_ERROR_KEYS = {
  not_configured: 'platform.sso.test.errors.notConfigured',
  provider_unreachable: 'platform.sso.test.errors.unreachable',
  provider_error: 'platform.sso.test.errors.provider',
} as const

const neutralBadge = 'bg-paper-line/60 text-paper-ink/70 dark:bg-line dark:text-fg-muted'

interface Draft {
  enabled: boolean
  provider_kind: ProviderKind
  display_name: string
  entra_tenant_id: string
  issuer_url: string
  client_id: string
  allow_jit: boolean
  trust_provider_mfa: boolean
}

function draftFrom(current: OidcSettingsRead): Draft {
  return {
    enabled: current.configured ? current.enabled : true,
    provider_kind: current.provider_kind ?? 'entra',
    display_name: current.display_name ?? '',
    entra_tenant_id: current.entra_tenant_id ?? '',
    issuer_url: current.issuer_url ?? '',
    client_id: current.client_id ?? '',
    allow_jit: current.allow_jit,
    trust_provider_mfa: current.trust_provider_mfa,
  }
}

/** Where the instance stands: offered on the sign-in page or not, and why. */
function StatusPanel({ current }: { current: OidcSettingsRead }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const state = current.active
    ? 'active'
    : current.configured && !current.client_secret_readable
      ? 'unreadable'
      : current.configured && !current.enabled
        ? 'off'
        : 'none'
  const label = {
    active: t('platform.sso.status.active'),
    unreadable: t('platform.sso.status.unreadable'),
    off: t('platform.sso.status.off'),
    none: t('platform.sso.status.none'),
  }[state]
  const source = current.pinned_by_env
    ? t('platform.sso.status.pinned')
    : current.redirect_uri === null
      ? t('platform.sso.status.noPublicUrl')
      : current.configured
        ? t('platform.sso.status.fromWeb')
        : t('platform.sso.status.howTo')

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
    } catch {
      // No clipboard: the value is on screen to select.
    }
  }

  return (
    <Panel
      title={t('platform.sso.status.title')}
      aside={
        <span
          role="status"
          className={`${badgeBase} ml-0 ${state === 'unreadable' ? 'bg-danger/10 text-danger-fg' : neutralBadge}`}
        >
          {label}
        </span>
      }
    >
      <div className={`space-y-3 text-sm ${panelFormFields}`}>
        <p>{source}</p>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-4 gap-y-1">
          {current.redirect_uri && (
            <>
              <dt className="text-paper-ink/60 dark:text-fg-muted">
                {t('platform.sso.status.redirectUri')}
              </dt>
              <dd className="flex flex-wrap items-baseline gap-2">
                <code className="break-all font-mono text-xs">{current.redirect_uri}</code>
                <button
                  type="button"
                  onClick={() => void copy(current.redirect_uri ?? '')}
                  className="text-xs text-accent-fg hover:underline"
                >
                  {copied ? t('platform.sso.status.copied') : t('platform.sso.status.copy')}
                </button>
              </dd>
            </>
          )}
          <dt className="text-paper-ink/60 dark:text-fg-muted">
            {t('platform.sso.status.linkedAccounts')}
          </dt>
          <dd>{current.linked_accounts}</dd>
        </dl>
      </div>
    </Panel>
  )
}

/** Fetches the provider's metadata and keys now: no one signs in. */
function TestPanel({ onTested }: { onTested: () => void }) {
  const { t } = useTranslation()
  const errorMessage = useErrorMessage()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<OidcTestRead | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      setResult(await apiFetch<OidcTestRead>('/instance/oidc/test', { method: 'POST' }))
      onTested()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const failure =
    result && !result.ok
      ? result.error && result.error in TEST_ERROR_KEYS
        ? t(TEST_ERROR_KEYS[result.error as keyof typeof TEST_ERROR_KEYS])
        : t('platform.sso.test.errors.provider')
      : null

  return (
    <Panel title={t('platform.sso.test.title')} description={t('platform.sso.test.description')}>
      <div className={`space-y-3 ${panelFormFields}`}>
        <button type="button" onClick={() => void run()} disabled={busy} className={btnSecondary}>
          {busy ? <ButtonSpinner /> : t('platform.sso.test.run')}
        </button>
        {result && (
          <p
            role="status"
            className={`break-words text-sm ${result.ok ? 'text-success-fg' : 'text-danger-fg'}`}
          >
            {result.ok ? t('platform.sso.test.ok') : failure}
            {result.detail && ` (${result.detail})`}
          </p>
        )}
        {error && (
          <p className="text-sm text-danger-fg" aria-live="polite">
            {error}
          </p>
        )}
      </div>
    </Panel>
  )
}

/** The provider. Read-only while the server's configuration pins it or
 * the server can't store the secret; saving and removing ask for a recent
 * sign-in and are logged (never the secret). */
function ProviderPanel({ current, onSaved }: { current: OidcSettingsRead; onSaved: () => void }) {
  const { t } = useTranslation()
  const { showToast } = useToast()
  const errorMessage = useErrorMessage()
  const initial = draftFrom(current)
  const [draft, setDraft] = useState<Draft>(initial)
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState<'save' | 'delete' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const readOnly = current.pinned_by_env || current.redirect_uri === null
  const dirty =
    (Object.keys(initial) as (keyof Draft)[]).some((key) => draft[key] !== initial[key]) ||
    secret !== ''
  useUnsavedChangesWarning(dirty && !readOnly)
  const valid =
    draft.client_id.trim() !== '' &&
    (draft.provider_kind === 'entra'
      ? draft.entra_tenant_id.trim() !== ''
      : draft.issuer_url.trim() !== '') &&
    (current.has_client_secret || secret !== '')

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }))
  }

  function reset() {
    setDraft(initial)
    setSecret('')
    setError(null)
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy('save')
    try {
      await apiFetch<OidcSettingsRead>('/instance/oidc', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: draft.enabled,
          provider_kind: draft.provider_kind,
          display_name: draft.display_name.trim() || null,
          entra_tenant_id:
            draft.provider_kind === 'entra' ? draft.entra_tenant_id.trim() || null : null,
          issuer_url: draft.provider_kind === 'generic' ? draft.issuer_url.trim() || null : null,
          client_id: draft.client_id.trim(),
          client_secret: secret || null,
          allow_jit: draft.allow_jit,
          trust_provider_mfa: draft.trust_provider_mfa,
        }),
      })
      setSecret('')
      onSaved()
      showToast(t('platform.sso.server.saved'))
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
      await apiFetch('/instance/oidc', { method: 'DELETE' })
      setRemoving(false)
      onSaved()
      showToast(t('platform.sso.server.removed'))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  function textField(
    key: 'display_name' | 'entra_tenant_id' | 'issuer_url' | 'client_id',
    label: string,
    options: { placeholder?: string; hint?: string; optional?: boolean } = {},
  ) {
    const id = `platform-sso-${key.replaceAll('_', '-')}`
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
          type="text"
          value={draft[key]}
          onChange={(e) => set(key, e.target.value)}
          placeholder={options.placeholder}
          aria-describedby={options.hint ? `${id}-hint` : undefined}
          className={inputBase}
          autoComplete="off"
          spellCheck={false}
        />
        {options.hint && (
          <p id={`${id}-hint`} className="text-sm text-paper-ink/60 dark:text-fg-muted">
            {options.hint}
          </p>
        )}
      </div>
    )
  }

  function checkbox(
    key: 'enabled' | 'allow_jit' | 'trust_provider_mfa',
    label: string,
    hint: string,
  ) {
    const id = `platform-sso-${key.replaceAll('_', '-')}`
    return (
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name={key}
            checked={draft[key]}
            onChange={(e) => set(key, e.target.checked)}
            aria-describedby={`${id}-hint`}
            className="h-4 w-4 accent-cta"
          />
          {label}
        </label>
        <p id={`${id}-hint`} className="text-sm text-paper-ink/60 dark:text-fg-muted">
          {hint}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={save}>
      <Panel
        title={t('platform.sso.server.title')}
        description={
          <HelpText
            id="platform.sso.server.description"
            text={t(
              current.pinned_by_env
                ? 'platform.sso.server.pinned'
                : current.redirect_uri === null
                  ? 'platform.sso.server.noPublicUrl'
                  : 'platform.sso.server.description',
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
                  {t('platform.sso.server.remove')}
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
                  t('platform.sso.server.save')
                ) : (
                  t('platform.sso.server.create')
                )}
              </button>
            </div>
          )
        }
      >
        <fieldset className={`space-y-4 ${panelFormFields}`} disabled={readOnly}>
          <legend className="sr-only">{t('platform.sso.server.title')}</legend>
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-sso-kind">
              {t('platform.sso.server.kind')}
            </label>
            <select
              id="platform-sso-kind"
              name="provider_kind"
              value={draft.provider_kind}
              onChange={(e) => set('provider_kind', e.target.value as ProviderKind)}
              className={inputBase}
            >
              {(['entra', 'generic'] as const).map((kind) => (
                <option key={kind} value={kind}>
                  {t(KIND_LABEL_KEYS[kind])}
                </option>
              ))}
            </select>
          </div>
          {draft.provider_kind === 'entra'
            ? textField('entra_tenant_id', t('platform.sso.server.tenantId'), {
                placeholder: '00000000-0000-0000-0000-000000000000…',
                hint: t('platform.sso.server.tenantIdHint'),
              })
            : textField('issuer_url', t('platform.sso.server.issuerUrl'), {
                placeholder: t('platform.sso.server.issuerUrlPlaceholder'),
                hint: t('platform.sso.server.issuerUrlHint'),
              })}
          {textField('client_id', t('platform.sso.server.clientId'))}
          <div className="space-y-1">
            <label className={labelClass} htmlFor="platform-sso-client-secret">
              {t('platform.sso.server.clientSecret')}
            </label>
            <input
              id="platform-sso-client-secret"
              name="client_secret"
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder={
                current.has_client_secret ? t('platform.sso.server.clientSecretKept') : undefined
              }
              className={inputBase}
              autoComplete="new-password"
            />
            <p className="text-sm text-paper-ink/60 dark:text-fg-muted">
              {t(
                current.pinned_by_env
                  ? 'platform.sso.server.clientSecretHintPinned'
                  : 'platform.sso.server.clientSecretHint',
              )}
            </p>
            {!current.client_secret_readable && (
              <p className="text-sm text-danger-fg">
                {t('platform.sso.server.clientSecretUnreadable')}
              </p>
            )}
          </div>
          {textField('display_name', t('platform.sso.server.displayName'), {
            optional: true,
            hint: t('platform.sso.server.displayNameHint'),
          })}
          {checkbox(
            'allow_jit',
            t('platform.sso.server.allowJit'),
            t('platform.sso.server.allowJitHint'),
          )}
          {checkbox(
            'trust_provider_mfa',
            t('platform.sso.server.trustMfa'),
            t('platform.sso.server.trustMfaHint'),
          )}
          {checkbox(
            'enabled',
            t('platform.sso.server.enabledLabel'),
            t('platform.sso.server.enabledHint'),
          )}
          {error && (
            <p className="text-sm text-danger-fg" aria-live="polite">
              {error}
            </p>
          )}
        </fieldset>
      </Panel>
      {removing && (
        <Modal titleId="platform-sso-remove-title" onClose={() => setRemoving(false)}>
          <div className="w-full max-w-md space-y-3">
            <h2
              id="platform-sso-remove-title"
              className="text-balance text-lg font-semibold tracking-tight"
            >
              {t('platform.sso.server.removeTitle')}
            </h2>
            <p className="text-sm text-paper-ink/70 dark:text-fg-muted">
              {t('platform.sso.server.removeWarning')}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void remove()}
                disabled={busy !== null}
                className={`flex-1 ${btnDanger}`}
              >
                {busy === 'delete' ? <ButtonSpinner /> : t('platform.sso.server.remove')}
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

/** Platform -> Single sign-on: the identity provider people may sign in
 * with -- the server's configuration (read-only here) or set here, with
 * the client secret stored encrypted. A test checks the provider can be
 * reached. */
export function PlatformSsoSection() {
  const { t } = useTranslation()
  const settings = useApiResource<OidcSettingsRead>('/instance/oidc')
  const current = settings.data

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionHeader title={t('platform.sections.sso')} />
        <HelpText id="platform.sso.description" text={t('platform.sso.description')} />
      </div>
      {settings.error && (
        <p className="text-sm text-danger-fg" role="alert">
          {settings.error.message}
        </p>
      )}
      {current && (
        <>
          <StatusPanel current={current} />
          <ProviderPanel
            key={`${current.updated_at}-${current.configured}-${current.pinned_by_env}`}
            current={current}
            onSaved={settings.refetch}
          />
          {current.configured && <TestPanel onTested={settings.refetch} />}
        </>
      )}
    </div>
  )
}
